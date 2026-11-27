import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  selectCurrentUser,
  selectIsMentorApproved,
  selectMentorAppStatus,
} from '../../store/selectors/sessionSelectors';
import {
  evaluateMentorStatus,
  switchUserRole,
} from '../../store/thunks/sessionThunks';
import {
  downloadMentorCv,
  fetchDigiLockerStatus,
  fetchMentorMinYearsConfig,
  fetchMyMentorApplicationStatus,
  pullDigiLockerDocuments,
  submitMentorApplication,
  uploadMentorCv,
} from '../../store/thunks/mentorApplicationsThunks';
import {
  clearMentorAppMessages,
  removeDigiLockerDocAt,
  setMentorAppCvError,
  setMentorAppDigiLockerError,
  setMentorAppSubmitError,
  setShowMentorForm,
} from '../../store/slices/mentorApplicationsSlice';
import {
  selectDigiLockerState,
  selectMentorApplicationsWorking,
  selectMentorCvState,
  selectMinYearsRequired,
  selectMyApplicationLoadStatus,
  selectMyMentorApplication,
  selectMyMentorCooldownInfo,
  selectMyMentorStatusData,
} from '../../store/selectors/mentorApplicationsSelectors';
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

const MentorApplicationContent = () => {
  const user = useSelector(selectCurrentUser);
  const isMentorApproved = useSelector(selectIsMentorApproved);
  const mentorAppStatus = useSelector(selectMentorAppStatus);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const refreshMentorStatus = useCallback(
    () => dispatch(evaluateMentorStatus()).unwrap(),
    [dispatch],
  );
  const switchRole = useCallback(
    (role) => dispatch(switchUserRole(role)),
    [dispatch],
  );

  const myStatusData = useSelector(selectMyMentorStatusData);
  const existingApp = useSelector(selectMyMentorApplication);
  const loadStatus = useSelector(selectMyApplicationLoadStatus);
  const minYearsRequired = useSelector(selectMinYearsRequired);
  const cooldownInfo = useSelector(selectMyMentorCooldownInfo);
  const { cvData, cvUploading } = useSelector(selectMentorCvState);
  const {
    docs: digiLockerDocs,
    connected: digiLockerConnected,
    loading: digiLockerLoading,
  } = useSelector(selectDigiLockerState);
  const working = useSelector(selectMentorApplicationsWorking);
  const myLastFetchedAt = useSelector((state) => state?.mentorApplications?.myLastFetchedAt || null);
  const submitting = useSelector((state) =>
    Boolean(state?.mentorApplications?.submitting),
  );

  // Only show the initial blocking spinner before the first status fetch completes;
  // background focus refreshes must never unmount the form or wipe file/typed inputs.
  const loading =
    Boolean(user?.id) &&
    !myLastFetchedAt &&
    (loadStatus === 'idle' || loadStatus === 'loading');
  const showForm =
    working.showFormOverride !== null
      ? working.showFormOverride
      : !existingApp;
  const cvError = working.cvError || '';
  const digiLockerError = working.digiLockerError || '';
  const error = working.submitError || '';
  const success = working.submitSuccess || '';
  const emailNotVerifiedError = Boolean(working.emailNotVerifiedError);
  const [nowTs] = useState(() => Date.now());
  const cvInputRef = useRef(null);
  const [selectedCvFile, setSelectedCvFile] = useState(null);

  // Controlled Form keystroke state (local per Decision D6)
  const [name, setName] = useState(() => user?.name || user?.username || '');
  const [email, setEmail] = useState(() => user?.email || '');
  const [bio, setBio] = useState('');
  const [skills, setSkills] = useState('');
  const [portfolio, setPortfolio] = useState('');
  const [yearsOfExperience, setYearsOfExperience] = useState('');

  const skipFocusRefreshRef = useRef(false);
  useEffect(() => {
    skipFocusRefreshRef.current = Boolean(
      cvUploading || submitting || selectedCvFile || cvData?.filename || showForm,
    );
  }, [cvUploading, submitting, selectedCvFile, cvData, showForm]);

  const loadApplication = useCallback(async () => {
    if (!user?.id) return;
    const action = await dispatch(
      fetchMyMentorApplicationStatus({ userId: user.id, force: true }),
    );
    const data = action?.payload;
    if (
      (data?.mentorUnlocked || data?.status === 'approved') &&
      typeof refreshMentorStatus === 'function'
    ) {
      await refreshMentorStatus();
    }
  }, [dispatch, user, refreshMentorStatus]);

  useEffect(() => {
    loadApplication();

    // Returning from OS file picker fires window.focus; never refetch while the applicant form is active
    const handleFocus = () => {
      if (!skipFocusRefreshRef.current) {
        loadApplication();
      }
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadApplication]);

  useEffect(() => {
    dispatch(fetchMentorMinYearsConfig());
    dispatch(fetchDigiLockerStatus());
  }, [dispatch]);

  // CV File Selection & Upload
  const handleCvChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedCvFile(file);
    dispatch(setMentorAppCvError(''));

    // Phase 8: Validate file extension
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      dispatch(
        setMentorAppCvError('Invalid file type. Only PDF documents (.pdf) are allowed.'),
      );
      e.target.value = '';
      return;
    }

    // Phase 8: Validate max file size (5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      dispatch(
        setMentorAppCvError(
          `File size (${formatBytes(file.size)}) exceeds the maximum allowed limit of 5 MB.`,
        ),
      );
      e.target.value = '';
      return;
    }

    try {
      await dispatch(uploadMentorCv(file)).unwrap();
    } catch {
      // Friendly error stored in working.cvError by mentorApplicationsSlice
    } finally {
      e.target.value = '';
    }
  };

  // DigiLocker Connection & Verification
  const handleConnectDigiLocker = async () => {
    dispatch(setMentorAppDigiLockerError(''));
    const applicantName = (name || user?.name || user?.username || '').trim();
    if (!applicantName) {
      dispatch(
        setMentorAppDigiLockerError(
          'Please enter your Full Name above before connecting DigiLocker to ensure credential matching.',
        ),
      );
      return;
    }

    try {
      await dispatch(pullDigiLockerDocuments({ applicantName })).unwrap();
    } catch {
      // Error stored in working.digiLockerError
    }
  };

  const handleRemoveDoc = (indexToRemove) => {
    dispatch(removeDigiLockerDocAt(indexToRemove));
  };

  // Download CV for existing application
  const handleDownloadCv = async (filename, originalName) => {
    try {
      await dispatch(downloadMentorCv({ filename, originalName })).unwrap();
    } catch (err) {
      alert(err?.message || 'Failed to download CV file.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    dispatch(clearMentorAppMessages());

    if (!name.trim()) {
      dispatch(setMentorAppSubmitError('Please provide your full name.'));
      return;
    }
    if (!email.trim()) {
      dispatch(setMentorAppSubmitError('Please provide your email address.'));
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
        dispatch(
          setMentorAppSubmitError(
            'Years of experience must be a whole number between 5 and 40.',
          ),
        );
      } else if (numYears > 40) {
        dispatch(
          setMentorAppSubmitError(
            'Maximum 40 years of professional experience allowed.',
          ),
        );
      } else {
        dispatch(
          setMentorAppSubmitError(
            `Minimum ${minRequired} years of professional experience required for mentor eligibility (up to 40).`,
          ),
        );
      }
      return;
    }
    if (!skills.trim()) {
      dispatch(
        setMentorAppSubmitError(
          'Please specify at least one skill or area of expertise.',
        ),
      );
      return;
    }
    if (!bio.trim() || bio.trim().length < 10) {
      dispatch(
        setMentorAppSubmitError(
          'Please provide a motivation statement of at least 10 characters describing your mentoring focus.',
        ),
      );
      return;
    }

    // Phase 8 Enforcement: CV is mandatory
    if (!cvData?.filename) {
      dispatch(
        setMentorAppSubmitError(
          'A CV upload (.pdf, max 5MB) is required for mentor application.',
        ),
      );
      return;
    }

    // Credential enforcement: At least one verified credential required
    const verifiedDocs = digiLockerDocs.filter(
      (d) => d.status === CREDENTIAL_STATUS.VERIFIED || d.verificationStatus === 'verified',
    );
    const unverifiedDocs = digiLockerDocs.filter(
      (d) => !(d.status === CREDENTIAL_STATUS.VERIFIED || d.verificationStatus === 'verified'),
    );

    if (verifiedDocs.length === 0) {
      if (unverifiedDocs.length > 0) {
        dispatch(
          setMentorAppSubmitError(
            'Your connected credentials could not be verified (e.g. name mismatch). At least one verified credential is required.',
          ),
        );
      } else {
        dispatch(
          setMentorAppSubmitError(
            'At least one verified credential from DigiLocker is required. Please click "Connect DigiLocker (Demo)" below.',
          ),
        );
      }
      return;
    }

    const parsedSkills = skills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const payload = {
      userId: String(user?.id || '1'),
      name: name.trim(),
      email: email.trim(),
      university:
        (
          user?.university ||
          user?.profile?.university ||
          user?.profile?.uni ||
          ''
        ).trim() || undefined,
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

    try {
      await dispatch(
        submitMentorApplication({
          payload,
          excludedCount: unverifiedDocs.length,
          verifiedCount: verifiedDocs.length,
        }),
      ).unwrap();
      if (typeof refreshMentorStatus === 'function') {
        await refreshMentorStatus();
      }
    } catch {
      // Friendly error, cooldown, and verification notice handled in mentorApplicationsSlice
    }
  };

  void myStatusData;

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
                          onClick={() => dispatch(setShowMentorForm(true))}
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
                  <input
                    type="file"
                    id="mentor-cv-file"
                    ref={cvInputRef}
                    accept=".pdf,application/pdf"
                    style={{ display: 'none' }}
                    onChange={handleCvChange}
                    disabled={cvUploading}
                  />
                  {cvData ? (
                    <div className="tf-mentor-file-pill">
                      <div className="tf-mentor-file-info">
                        <span style={{ fontSize: '1.25rem' }}>📄</span>
                        <div>
                          <div className="tf-mentor-file-name">
                            {cvUploading && selectedCvFile ? selectedCvFile.name : cvData.originalName}
                          </div>
                          <div className="tf-mentor-file-size">
                            {cvUploading && selectedCvFile
                              ? `${formatBytes(selectedCvFile.size)} · Uploading...`
                              : `${formatBytes(cvData.size)} · Verified PDF`}
                          </div>
                        </div>
                      </div>
                      <div>
                        <label
                          htmlFor="mentor-cv-file"
                          className="tf-mentor-app-btn-outline"
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', cursor: 'pointer', margin: 0 }}
                        >
                          {cvUploading ? '⏳ Uploading...' : 'Replace CV'}
                        </label>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label htmlFor="mentor-cv-file" className="tf-mentor-upload-btn-label">
                        <span>{cvUploading ? '⏳ Uploading CV...' : '📎 Choose PDF File'}</span>
                      </label>
                      <span className="tf-mentor-app-hint" style={{ marginLeft: '12px' }}>
                        Accepted format: .pdf up to 5 MB
                      </span>
                      {selectedCvFile && (
                        <div className="tf-mentor-file-pill" style={{ marginTop: '8px' }}>
                          <div className="tf-mentor-file-info">
                            <span style={{ fontSize: '1.1rem' }}>📄</span>
                            <div>
                              <div className="tf-mentor-file-name">{selectedCvFile.name}</div>
                              <div className="tf-mentor-file-size">
                                {formatBytes(selectedCvFile.size)}
                                {cvUploading ? ' · Uploading...' : cvError ? ' · Upload failed' : ''}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {cvError && (
                    <div role="alert" style={{ color: '#dc2626', fontSize: '0.85rem' }}>{cvError}</div>
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
                    onClick={() => dispatch(setShowMentorForm(false))}
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

const MentorApplication = MentorApplicationContent;
export default MentorApplication;
