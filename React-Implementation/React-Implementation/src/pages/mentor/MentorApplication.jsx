import { useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { RoleContext } from '../../context/RoleContext';
import mentorApplicationsApi from '../../services/mentorApplicationsApi';
import uploadsApi from '../../services/uploadsApi';
import adminApi from '../../services/adminApi';
import FormInput from '../../components/common/FormInput';
import VerifyEmailBanner from '../../components/common/VerifyEmailBanner';
import { CREDENTIAL_STATUS } from '../../constants/credentialStatus';
import { formatDateTime } from '../../utils/dateFormatter';
import './mentorApplication.css';

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const MentorApplication = () => {
  const { user } = useContext(AuthContext);
  const { isMentorApproved, mentorAppStatus, switchRole, refreshMentorStatus } = useContext(RoleContext);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [existingApp, setExistingApp] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [minYearsRequired, setMinYearsRequired] = useState(5);
  const [cooldownInfo, setCooldownInfo] = useState(null);
  const [nowTs] = useState(() => Date.now());

  // Form fields
  const [name, setName] = useState(() => user?.name || user?.username || '');
  const [email, setEmail] = useState(() => user?.email || '');
  const [bio, setBio] = useState('');
  const [skills, setSkills] = useState('');
  const [portfolio, setPortfolio] = useState('');
  const [yearsOfExperience, setYearsOfExperience] = useState('');

  // CV Upload state
  const [cvUploading, setCvUploading] = useState(false);
  const [cvData, setCvData] = useState(null);
  const [cvError, setCvError] = useState('');

  // DigiLocker verification state
  const [digiLockerLoading, setDigiLockerLoading] = useState(false);
  const [digiLockerDocs, setDigiLockerDocs] = useState([]);
  const [digiLockerConnected, setDigiLockerConnected] = useState(false);
  const [digiLockerError, setDigiLockerError] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [emailNotVerifiedError, setEmailNotVerifiedError] = useState(false);

  const loadApplication = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    try {
      let statusData = null;
      try {
        statusData = await mentorApplicationsApi.getMyStatus({ userId: user.id });
      } catch (err) {
        console.warn('[MentorApplication] Fallback fetching mentor application status:', err);
      }

      if (statusData && statusData.status !== undefined) {
        if (statusData.mentorUnlocked || statusData.status === 'approved') {
          setExistingApp(statusData.application || { status: 'approved' });
          setShowForm(false);
          if (typeof refreshMentorStatus === 'function') {
            await refreshMentorStatus();
          }
        } else if (statusData.status === 'pending') {
          setExistingApp(statusData.application);
          setShowForm(false);
        } else if (statusData.status === 'rejected') {
          setExistingApp(statusData.application);
          if (statusData.inCooldown || statusData.cooldownAvailableAt) {
            setCooldownInfo({
              inCooldown: Boolean(statusData.inCooldown),
              availableAt: statusData.cooldownAvailableAt || null,
              cooldownDays: statusData.cooldownDays || 14,
            });
          } else {
            setCooldownInfo(null);
          }
        } else {
          // none
          setExistingApp(null);
          setShowForm(true);
        }
      } else {
        const apps = await mentorApplicationsApi.list({ userId: user.id });
        const list = Array.isArray(apps) ? apps : [];
        list.sort((a, b) => {
          const timeA = new Date(a.createdAt || a.applicationDate || 0).getTime();
          const timeB = new Date(b.createdAt || b.applicationDate || 0).getTime();
          return timeB - timeA;
        });
        const activeList = list.filter((a) => a.status !== 'superseded');
        const myApp = activeList[0] || list[0];

        if (myApp) {
          setExistingApp(myApp);
          if (myApp.status === 'approved') {
            setShowForm(false);
            if (typeof refreshMentorStatus === 'function') {
              await refreshMentorStatus();
            }
          }
        } else {
          setExistingApp(null);
          setShowForm(true);
        }
      }
    } catch (err) {
      console.error('Error fetching mentor application:', err);
      setShowForm(true);
    } finally {
      setLoading(false);
    }
  }, [user, refreshMentorStatus]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadApplication();

    const handleFocus = () => loadApplication();
    const handleStatusUpdate = () => loadApplication();

    window.addEventListener('focus', handleFocus);
    window.addEventListener('teamforge:mentor_status_updated', handleStatusUpdate);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('teamforge:mentor_status_updated', handleStatusUpdate);
    };
  }, [loadApplication]);

  useEffect(() => {
    adminApi.getPublicConfig()
      .then((cfg) => {
        const tenure = cfg?.minimumTenure ?? cfg?.mentorMinYearsExperience;
        if (tenure !== undefined) {
          setMinYearsRequired(Math.max(5, Number(tenure)));
        }
      })
      .catch(() => {});
  }, []);

  // CV File Selection & Upload
  const handleCvChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCvError('');

    // Phase 8: Validate file extension
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setCvError('Invalid file type. Only PDF documents (.pdf) are allowed.');
      e.target.value = '';
      return;
    }

    // Phase 8: Validate max file size (5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setCvError(`File size (${formatBytes(file.size)}) exceeds the maximum allowed limit of 5 MB.`);
      e.target.value = '';
      return;
    }

    setCvUploading(true);
    try {
      const res = await uploadsApi.uploadCv(file);
      setCvData({
        filename: res.filename,
        originalName: res.originalName || file.name,
        size: res.size || file.size,
        url: res.url,
      });
    } catch (err) {
      if (err?.code === 'UNSUPPORTED_FILE_TYPE' || err?.statusCode === 400) {
        setCvError(err?.serverMessage || err?.message || 'Unsupported file type. Allowed format: PDF (.pdf) with a valid %PDF- signature.');
      } else {
        setCvError(err?.serverMessage || err.message || 'Failed to upload CV file. Please try again.');
      }
    } finally {
      setCvUploading(false);
      e.target.value = '';
    }
  };

  // DigiLocker Connection & Verification
  const handleConnectDigiLocker = async () => {
    setDigiLockerError('');
    const applicantName = (name || user?.name || user?.username || '').trim();
    if (!applicantName) {
      setDigiLockerError('Please enter your Full Name above before connecting DigiLocker to ensure credential matching.');
      return;
    }

    setDigiLockerLoading(true);
    try {
      const res = await mentorApplicationsApi.pullDigiLockerDocuments(applicantName);
      const docs = Array.isArray(res.documents) ? res.documents : [];
      setDigiLockerDocs(docs);
      setDigiLockerConnected(true);
    } catch (err) {
      setDigiLockerError(err.message || 'Failed to connect to DigiLocker sandbox.');
    } finally {
      setDigiLockerLoading(false);
    }
  };

  const handleRemoveDoc = (indexToRemove) => {
    setDigiLockerDocs((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Download CV for existing application
  const handleDownloadCv = async (filename, originalName) => {
    try {
      const blob = await uploadsApi.downloadCv(filename);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = originalName || filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert(err.message || 'Failed to download CV file.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!name.trim()) {
      setError('Please provide your full name.');
      return;
    }
    if (!email.trim()) {
      setError('Please provide your email address.');
      return;
    }
    const numYears = Number(yearsOfExperience);
    const minRequired = Math.max(5, minYearsRequired);
    if (
      !yearsOfExperience ||
      isNaN(numYears) ||
      !Number.isInteger(numYears) ||
      numYears < minRequired ||
      numYears > 40
    ) {
      if (!Number.isInteger(numYears) && !isNaN(numYears)) {
        setError('Years of experience must be a whole number between 5 and 40.');
      } else if (numYears > 40) {
        setError('Maximum 40 years of professional experience allowed.');
      } else {
        setError(`Minimum ${minRequired} years of professional experience required for mentor eligibility (up to 40).`);
      }
      return;
    }
    if (!skills.trim()) {
      setError('Please specify at least one skill or area of expertise.');
      return;
    }
    if (!bio.trim() || bio.trim().length < 10) {
      setError('Please provide a motivation statement of at least 10 characters describing your mentoring focus.');
      return;
    }

    // Phase 8 Enforcement: CV is mandatory
    if (!cvData?.filename) {
      setError('A CV upload (.pdf, max 5MB) is required for mentor application.');
      return;
    }

    // Credential enforcement: At least one verified credential required
    const verifiedDocs = digiLockerDocs.filter(
      (d) => d.status === CREDENTIAL_STATUS.VERIFIED || d.verificationStatus === 'verified'
    );
    const unverifiedDocs = digiLockerDocs.filter(
      (d) => !(d.status === CREDENTIAL_STATUS.VERIFIED || d.verificationStatus === 'verified')
    );

    if (verifiedDocs.length === 0) {
      if (unverifiedDocs.length > 0) {
        setError('Your connected credentials could not be verified (e.g. name mismatch). At least one verified credential is required.');
      } else {
        setError('At least one verified credential from DigiLocker is required. Please click "Connect DigiLocker (Demo)" below.');
      }
      return;
    }

    const parsedSkills = skills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    setSubmitting(true);
    try {
      // Submit only verified credentials; unverified ones are excluded
      const payload = {
        userId: String(user?.id || '1'),
        name: name.trim(),
        email: email.trim(),
        university: (user?.university || user?.profile?.university || user?.profile?.uni || '').trim() || undefined,
        bio: bio.trim(),
        motivation: bio.trim(),
        years: numYears,
        yearsOfExperience: numYears,
        experience: `${numYears} years`,
        skills: parsedSkills.length > 0 ? parsedSkills : undefined,
        expertise: parsedSkills.join(', '),
        linkedin: portfolio.trim() || undefined,
        portfolio: portfolio.trim() || undefined,
        cvFileName: cvData.filename,
        cvOriginalName: cvData.originalName,
        cvFileSize: cvData.size,
        cvUrl: cvData.url,
        certificates: verifiedDocs,
        excludedCertificates: unverifiedDocs,
      };

      const created = await mentorApplicationsApi.create(payload);
      setEmailNotVerifiedError(false);
      const excludedMsg = unverifiedDocs.length > 0 ? ` (Note: ${unverifiedDocs.length} unverified credential(s) were excluded)` : '';
      setSuccess(`Your mentor application with ${verifiedDocs.length} verified credential(s) has been submitted successfully for admin review!${excludedMsg}`);
      setExistingApp(created);
      setShowForm(false);
      if (typeof refreshMentorStatus === 'function') {
        await refreshMentorStatus();
      }
    } catch (err) {
      if (err?.code === 'EMAIL_NOT_VERIFIED' || /verify your email/i.test(err?.serverMessage || err?.message || '')) {
        setEmailNotVerifiedError(true);
      }
      if (err?.code === 'REAPPLY_COOLDOWN' || err?.availableAt) {
        setCooldownInfo({
          inCooldown: true,
          availableAt: err.availableAt || null,
          cooldownDays: err.cooldownDays || 14,
        });
      }
      setError(err?.serverMessage || err?.message || 'Failed to submit mentor application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoToMentoredProjects = () => {
    switchRole('Mentor');
    navigate('/mentor/projects');
  };

  const formVerifiedDocs = digiLockerDocs.filter(
    (d) => d.status === CREDENTIAL_STATUS.VERIFIED || d.verificationStatus === 'verified'
  );
  const formUnverifiedDocs = digiLockerDocs.filter(
    (d) => !(d.status === CREDENTIAL_STATUS.VERIFIED || d.verificationStatus === 'verified')
  );
  const formVerifiedCount = formVerifiedDocs.length;
  const formUnverifiedCount = formUnverifiedDocs.length;
  const canSubmitApplication = !submitting && Boolean(cvData?.filename) && formVerifiedCount > 0;

  const currentStatus = String(
    isMentorApproved ? 'approved' : (existingApp?.status || mentorAppStatus || '')
  ).toLowerCase();

  return (
    <div className="tf-mentor-app-container">
      <div className="tf-mentor-app-header">
        <h1 className="tf-mentor-app-title">Mentor Application & Status</h1>
        <p className="tf-mentor-app-subtitle">
          Mentors guide student and open source teams, review architecture, and facilitate project milestones.
        </p>
      </div>

      <div className="tf-mentor-app-card">
        {loading ? (
          <p style={{ color: 'var(--muted-fg, #64748b)' }}>Checking application status...</p>
        ) : isMentorApproved || currentStatus === 'approved' ? (
          <div className="tf-mentor-app-status-box approved">
            <div className="tf-mentor-app-status-header">
              <h2 className="tf-mentor-app-status-title">🎉 Mentor Access Unlocked</h2>
              <span
                style={{
                  background: '#dcfce7',
                  color: '#15803d',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                }}
              >
                Approved
              </span>
            </div>
            <p className="tf-mentor-app-status-desc">
              Your application has been approved by the platform administrator. You now have full access to the Mentor role, incoming requests, and the mentor workspace.
            </p>
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="tf-mentor-app-btn-primary"
                onClick={handleGoToMentoredProjects}
              >
                Switch to Mentor
              </button>
              <button
                type="button"
                className="tf-mentor-app-btn-outline"
                onClick={() => navigate('/mentor/projects')}
              >
                Go to Mentor dashboard
              </button>
            </div>
          </div>
        ) : existingApp && !showForm ? (
          <>
            {currentStatus === 'pending' && (
              <div className="tf-mentor-app-status-box pending">
                <div className="tf-mentor-app-status-header">
                  <h2 className="tf-mentor-app-status-title">⏳ Application Under Review</h2>
                  <span
                    style={{
                      background: '#fef3c7',
                      color: '#b45309',
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                    }}
                  >
                    Pending Review
                  </span>
                </div>
                <p className="tf-mentor-app-status-desc">
                  Your mentor application is currently being reviewed by administrators. The Mentor role and mentor workspaces will remain locked until your application is approved.
                </p>
                <div className="tf-mentor-app-details-grid">
                  <div className="tf-mentor-app-detail-item">
                    <div className="tf-mentor-app-detail-label">Applicant Name</div>
                    <div className="tf-mentor-app-detail-val">{existingApp.name || user?.name || 'N/A'}</div>
                  </div>
                  <div className="tf-mentor-app-detail-item">
                    <div className="tf-mentor-app-detail-label">Email</div>
                    <div className="tf-mentor-app-detail-val">{existingApp.email || user?.email || 'N/A'}</div>
                  </div>
                  {existingApp.skills && (
                    <div className="tf-mentor-app-detail-item">
                      <div className="tf-mentor-app-detail-label">Expertise / Skills</div>
                      <div className="tf-mentor-app-detail-val">
                        {Array.isArray(existingApp.skills)
                          ? existingApp.skills.join(', ')
                          : String(existingApp.skills)}
                      </div>
                    </div>
                  )}
                  {(existingApp.years !== undefined || existingApp.yearsOfExperience !== undefined || existingApp.experience) && (
                    <div className="tf-mentor-app-detail-item">
                      <div className="tf-mentor-app-detail-label">Experience</div>
                      <div className="tf-mentor-app-detail-val">
                        {existingApp.years !== undefined || existingApp.yearsOfExperience !== undefined
                          ? `${existingApp.years ?? existingApp.yearsOfExperience} years`
                          : existingApp.experience}
                      </div>
                    </div>
                  )}
                  {existingApp.createdAt && (
                    <div className="tf-mentor-app-detail-item">
                      <div className="tf-mentor-app-detail-label">Submitted On</div>
                      <div className="tf-mentor-app-detail-val">
                        {new Date(existingApp.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  )}
                </div>

                {/* Submitted CV Section */}
                <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border, #e2e8f0)' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--fg, #0f172a)' }}>
                    📄 Submitted Curriculum Vitae (CV)
                  </div>
                  {existingApp.cvFileName ? (
                    <div className="tf-mentor-file-pill">
                      <div className="tf-mentor-file-info">
                        <span style={{ fontSize: '1.2rem' }}>📎</span>
                        <div>
                          <div className="tf-mentor-file-name">{existingApp.cvOriginalName || existingApp.cvFileName}</div>
                          {existingApp.cvFileSize && (
                            <div className="tf-mentor-file-size">{formatBytes(existingApp.cvFileSize)} · Secure PDF</div>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          type="button"
                          className="tf-mentor-app-btn-outline"
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                          onClick={() => handleDownloadCv(existingApp.cvFileName, existingApp.cvOriginalName)}
                        >
                          Download CV
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p style={{ fontSize: '0.85rem', color: 'var(--muted-fg, #64748b)' }}>No CV file stored on record.</p>
                  )}
                </div>

                {/* Submitted DigiLocker Credentials */}
                {((Array.isArray(existingApp.certificates) && existingApp.certificates.length > 0) ||
                  (Array.isArray(existingApp.excludedCertificates) && existingApp.excludedCertificates.length > 0)) && (
                  <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border, #e2e8f0)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--fg, #0f172a)' }}>
                        🛡️ DigiLocker Credentials
                      </div>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1e40af' }}>
                        {(existingApp.certificates?.length || 0)} of {((existingApp.certificates?.length || 0) + (existingApp.excludedCertificates?.length || 0))} verified
                      </span>
                    </div>

                    {Array.isArray(existingApp.certificates) && existingApp.certificates.map((cert, idx) => (
                      <div key={idx} className="tf-mentor-cert-item">
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{cert.title || cert.name || cert.documentType}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--muted-fg, #64748b)' }}>
                            {cert.issuer} · Holder: {cert.holderName} · Doc #{cert.documentNumber}
                          </div>
                        </div>
                        <span className="tf-mentor-digilocker-badge verified">
                          ✓ Verified
                        </span>
                      </div>
                    ))}

                    {Array.isArray(existingApp.excludedCertificates) && existingApp.excludedCertificates.length > 0 && (
                      <div style={{ marginTop: '0.75rem' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#b91c1c', marginBottom: '4px' }}>
                          Excluded / Unverified Credentials ({existingApp.excludedCertificates.length})
                        </div>
                        {existingApp.excludedCertificates.map((cert, idx) => (
                          <div key={`excluded-${idx}`} className="tf-mentor-cert-item" style={{ background: '#fef2f2', borderColor: '#fecaca' }}>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#991b1b' }}>{cert.title || cert.name || cert.documentType}</div>
                              <div style={{ fontSize: '0.8rem', color: '#b91c1c' }}>
                                {cert.issuer} · Holder: {cert.holderName} · Doc #{cert.documentNumber}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '2px' }}>
                                ⚠️ {cert.mismatchReason || 'Holder name does not match profile name'}
                              </div>
                            </div>
                            <span className="tf-mentor-digilocker-badge mismatch">
                              ⚠️ Name Mismatch
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {currentStatus === 'rejected' && (
              <div className="tf-mentor-app-status-box rejected">
                <div className="tf-mentor-app-status-header">
                  <h2 className="tf-mentor-app-status-title">❌ Application Not Approved</h2>
                  <span
                    style={{
                      background: '#fee2e2',
                      color: '#b91c1c',
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                    }}
                  >
                    Rejected
                  </span>
                </div>
                <p className="tf-mentor-app-status-desc">
                  Your previous mentor application was not approved by the administrator. Mentor workspaces remain locked.
                </p>

                {existingApp.rejectionReason && (
                  <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', marginBottom: '1rem', color: '#991b1b', fontSize: '0.875rem' }}>
                    <strong>Reason:</strong> {existingApp.rejectionReason}
                  </div>
                )}

                {(() => {
                  const cooldownDays = cooldownInfo?.cooldownDays || 14;
                  const fallbackAvailableAt = existingApp?.rejectedAt
                    ? new Date(new Date(existingApp.rejectedAt).getTime() + cooldownDays * 24 * 60 * 60 * 1000).toISOString()
                    : null;
                  const availableAt = cooldownInfo?.availableAt || fallbackAvailableAt;
                  const inCooldown = Boolean(
                    cooldownInfo?.inCooldown ||
                    (availableAt && new Date(availableAt).getTime() > nowTs)
                  );
                  return (
                    <>
                      {inCooldown && availableAt && (
                        <div
                          data-testid="mentor-reapply-cooldown"
                          style={{
                            background: '#fffbeb',
                            border: '1px solid #fde68a',
                            borderRadius: '8px',
                            padding: '10px 14px',
                            marginBottom: '1rem',
                            color: '#92400e',
                            fontSize: '0.88rem',
                          }}
                        >
                          ⏳ Re-application cooldown active ({cooldownDays} days after rejection). You can re-apply on{' '}
                          <strong>{formatDateTime(availableAt)}</strong>.
                        </div>
                      )}
                      <div style={{ marginTop: '1rem' }}>
                        <button
                          type="button"
                          className="tf-mentor-app-btn-primary"
                          disabled={inCooldown}
                          onClick={() => setShowForm(true)}
                        >
                          {inCooldown ? 'Re-application in Cooldown' : 'Submit New Application'}
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </>
        ) : (
          <div>
            <div className="tf-mentor-app-notice">
              <span>🔒</span>
              <span>
                The Mentor role requires admin review and verified credentials. Submit your details, CV, and connect DigiLocker below.
              </span>
            </div>

            {(emailNotVerifiedError || user?.emailVerified === false) && <VerifyEmailBanner forceShow />}
            {error && <div className="tf-mentor-app-error">{error}</div>}
            {success && <div className="tf-mentor-app-success">{success}</div>}

            <form onSubmit={handleSubmit} className="tf-mentor-app-form">
              <FormInput
                label="Full Name"
                name="mentor-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Riya Sharma"
                required
              />

              <FormInput
                label="Email Address"
                name="mentor-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. mentor@example.com"
                required
              />

              <FormInput
                label="Years of Professional Experience"
                name="mentor-years-experience"
                type="number"
                min={Math.max(5, minYearsRequired)}
                max="40"
                step="1"
                value={yearsOfExperience}
                onChange={(e) => setYearsOfExperience(e.target.value)}
                placeholder={`e.g. ${Math.max(5, minYearsRequired)}`}
                helperText={`Whole number between ${Math.max(5, minYearsRequired)} and 40 years of professional experience required.`}
                required
              />

              <FormInput
                label="Areas of Expertise / Skills"
                name="mentor-skills"
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder="e.g. React, NestJS, System Design, DevOps (comma separated)"
                helperText="Separate skills with commas."
                required
              />

              <FormInput
                label="LinkedIn Profile / Portfolio URL (Optional)"
                name="mentor-portfolio"
                type="url"
                value={portfolio}
                onChange={(e) => setPortfolio(e.target.value)}
                placeholder="e.g. https://www.linkedin.com/in/yourprofile"
              />

              <FormInput
                label="Motivation Statement"
                name="mentor-bio"
                multiline
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Describe why you want to mentor student and collaborator teams (minimum 10 characters)..."
                required
              />

              {/* CV Upload Section */}
              <div className="tf-mentor-app-field">
                <label className="tf-mentor-app-label">
                  Curriculum Vitae (CV) - PDF Only (Max 5MB) <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <div className="tf-mentor-upload-section">
                  {cvData ? (
                    <div className="tf-mentor-file-pill">
                      <div className="tf-mentor-file-info">
                        <span style={{ fontSize: '1.25rem' }}>📄</span>
                        <div>
                          <div className="tf-mentor-file-name">{cvData.originalName}</div>
                          <div className="tf-mentor-file-size">{formatBytes(cvData.size)} · Verified PDF</div>
                        </div>
                      </div>
                      <div>
                        <input
                          type="file"
                          id="mentor-cv-replace-file"
                          accept=".pdf,application/pdf"
                          style={{ display: 'none' }}
                          onChange={handleCvChange}
                          disabled={cvUploading}
                        />
                        <label
                          htmlFor="mentor-cv-replace-file"
                          className="tf-mentor-app-btn-outline"
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', cursor: 'pointer', margin: 0 }}
                        >
                          {cvUploading ? '⏳ Uploading...' : 'Replace CV'}
                        </label>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <input
                        type="file"
                        id="mentor-cv-file"
                        accept=".pdf,application/pdf"
                        style={{ display: 'none' }}
                        onChange={handleCvChange}
                        disabled={cvUploading}
                      />
                      <label htmlFor="mentor-cv-file" className="tf-mentor-upload-btn-label">
                        <span>{cvUploading ? '⏳ Uploading CV...' : '📎 Choose PDF File'}</span>
                      </label>
                      <span className="tf-mentor-app-hint" style={{ marginLeft: '12px' }}>
                        Accepted format: .pdf up to 5 MB
                      </span>
                    </div>
                  )}
                  {cvError && (
                    <div style={{ color: '#dc2626', fontSize: '0.85rem' }}>{cvError}</div>
                  )}
                </div>
              </div>

              {/* DigiLocker Verification Section */}
              <div className="tf-mentor-app-field">
                <label className="tf-mentor-app-label">
                  Educational & Professional Credentials Verification <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <div className="tf-mentor-digilocker-banner">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.25rem' }}>🛡️</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e40af' }}>
                          Simulated DigiLocker (demo)
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#3b82f6' }}>
                          Connect your DigiLocker account to verify educational & professional credentials.
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="tf-mentor-app-btn-outline"
                      style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem', background: '#ffffff' }}
                      onClick={handleConnectDigiLocker}
                      disabled={digiLockerLoading}
                    >
                      {digiLockerLoading ? 'Connecting...' : digiLockerConnected ? 'Re-sync DigiLocker' : 'Connect DigiLocker (Demo)'}
                    </button>
                  </div>

                  {digiLockerError && (
                    <div style={{ color: '#dc2626', fontSize: '0.85rem' }}>{digiLockerError}</div>
                  )}

                  {digiLockerDocs.length > 0 && (
                    <div style={{ marginTop: '0.75rem' }}>
                      <div className="tf-mentor-summary-line">
                        <span>
                          🛡️ Credentials: <strong>{formVerifiedCount} verified</strong>, <strong>{formUnverifiedCount} not verified</strong>
                        </span>
                        {formUnverifiedCount > 0 && (
                          <span style={{ fontSize: '0.75rem', color: '#b91c1c' }}>
                            Unverified credentials are excluded automatically on submission
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1e3a8a', marginTop: '8px', marginBottom: '4px' }}>
                        Retrieved Credentials ({digiLockerDocs.length})
                      </div>

                      {digiLockerDocs.map((doc, idx) => {
                        const isDocVerified =
                          doc.status === CREDENTIAL_STATUS.VERIFIED || doc.verificationStatus === 'verified';
                        return (
                          <div key={idx} className="tf-mentor-cert-item">
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                                {doc.title || doc.name || doc.documentType}
                              </div>
                              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                {doc.issuer} · Holder: <strong>{doc.holderName}</strong> · Doc #{doc.documentNumber}
                              </div>
                              {!isDocVerified && (
                                <div style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '2px' }}>
                                  ⚠️ {doc.mismatchReason || 'Holder name does not match your profile name'}
                                </div>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span
                                className={`tf-mentor-digilocker-badge ${isDocVerified ? 'verified' : 'mismatch'}`}
                              >
                                {isDocVerified ? '✓ Verified' : '⚠️ Name Mismatch'}
                              </span>
                              {!isDocVerified && (
                                <button
                                  type="button"
                                  className="tf-mentor-remove-btn"
                                  onClick={() => handleRemoveDoc(idx)}
                                  title="Remove unverified credential"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="tf-mentor-app-actions" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
                {(!cvData?.filename || formVerifiedCount === 0) && (
                  <span style={{ fontSize: '0.8rem', color: '#dc2626', marginRight: 'auto' }}>
                    {!cvData?.filename && formVerifiedCount === 0
                      ? '⚠️ Attach CV and verify at least 1 DigiLocker credential to submit'
                      : !cvData?.filename
                      ? '⚠️ Attach CV to submit'
                      : '⚠️ At least 1 verified DigiLocker credential is required'}
                  </span>
                )}
                {existingApp && (
                  <button
                    type="button"
                    className="tf-mentor-app-btn-outline"
                    onClick={() => setShowForm(false)}
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  className="tf-mentor-app-btn-primary"
                  disabled={!canSubmitApplication}
                >
                  {submitting ? 'Submitting Application...' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default MentorApplication;
