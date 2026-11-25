const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../React-Implementation/React-Implementation/src/pages/mentor/MentorApplication.jsx');

const content = `import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { RoleContext } from '../../context/RoleContext';
import mentorApplicationsApi from '../../services/mentorApplicationsApi';
import uploadsApi from '../../services/uploadsApi';
import adminApi from '../../services/adminApi';
import FormInput from '../../components/common/FormInput';
import './mentorApplication.css';

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return '';
  if (bytes < 1024) return \`\${bytes} B\`;
  if (bytes < 1024 * 1024) return \`\${(bytes / 1024).toFixed(1)} KB\`;
  return \`\${(bytes / (1024 * 1024)).toFixed(2)} MB\`;
}

const MentorApplication = () => {
  const { user } = useContext(AuthContext);
  const { isMentorApproved, mentorAppStatus, switchRole, refreshMentorStatus } = useContext(RoleContext);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [existingApp, setExistingApp] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [minYearsRequired, setMinYearsRequired] = useState(4);

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

  useEffect(() => {
    let isMounted = true;
    const loadApplication = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      try {
        const apps = await mentorApplicationsApi.list({ userId: user.id });
        if (!isMounted) return;
        const list = Array.isArray(apps) ? apps : [];
        const myApp = list.find(
          (a) =>
            String(a.userId) === String(user.id) ||
            (user.email && a.email && a.email.toLowerCase() === user.email.toLowerCase())
        );

        if (myApp) {
          setExistingApp(myApp);
        } else {
          setShowForm(true);
        }
      } catch (err) {
        console.error('Error fetching mentor application:', err);
        if (isMounted) setShowForm(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    adminApi.getPublicConfig()
      .then((cfg) => {
        if (isMounted && cfg?.mentorMinYearsExperience !== undefined) {
          setMinYearsRequired(cfg.mentorMinYearsExperience);
        }
      })
      .catch(() => {});

    loadApplication();
    return () => {
      isMounted = false;
    };
  }, [user?.id, user?.email]);

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
      setCvError(\`File size (\${formatBytes(file.size)}) exceeds the maximum allowed limit of 5 MB.\`);
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
      setCvError(err.message || 'Failed to upload CV file. Please try again.');
    } finally {
      setCvUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveCv = async () => {
    if (cvData?.filename) {
      try {
        await uploadsApi.deleteCv(cvData.filename);
      } catch {
        // non-critical cleanup
      }
    }
    setCvData(null);
    setCvError('');
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

  // Delete CV for existing application (Privacy compliance)
  const handleDeleteExistingCv = async (appId) => {
    if (!window.confirm('Are you sure you want to delete your stored CV file from the server? This action permanently erases the file for your privacy.')) {
      return;
    }
    try {
      await mentorApplicationsApi.deleteCv(appId);
      setExistingApp((prev) => (prev ? { ...prev, cvFileName: null, cvUrl: null } : prev));
      alert('Your CV file has been permanently deleted from server storage.');
    } catch (err) {
      alert(err.message || 'Failed to delete CV file.');
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
    const numYears = parseInt(yearsOfExperience, 10);
    if (!yearsOfExperience || isNaN(numYears) || numYears < minYearsRequired || numYears > 50) {
      setError(\`Minimum \${minYearsRequired} years of professional experience required for mentor eligibility.\`);
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

    // Phase 8 Enforcement: At least one verified DigiLocker document is mandatory
    const hasVerifiedCert = digiLockerDocs.some((d) => d.verificationStatus === 'verified');
    if (!hasVerifiedCert) {
      const hasMismatch = digiLockerDocs.some((d) => d.verificationStatus === 'mismatch');
      if (hasMismatch) {
        setError('Your connected credentials have name mismatches. Please ensure the name matches your official documents.');
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
      const payload = {
        userId: String(user?.id || '1'),
        name: name.trim(),
        email: email.trim(),
        bio: bio.trim(),
        motivation: bio.trim(),
        years: numYears,
        yearsOfExperience: numYears,
        experience: \`\${numYears} years\`,
        skills: parsedSkills.length > 0 ? parsedSkills : undefined,
        expertise: parsedSkills.join(', '),
        linkedin: portfolio.trim() || undefined,
        portfolio: portfolio.trim() || undefined,
        cvFileName: cvData.filename,
        cvOriginalName: cvData.originalName,
        cvFileSize: cvData.size,
        cvUrl: cvData.url,
        certificates: digiLockerDocs,
      };

      const created = await mentorApplicationsApi.create(payload);
      setSuccess('Your mentor application and verified credentials have been submitted successfully for admin review!');
      setExistingApp(created);
      setShowForm(false);
      if (typeof refreshMentorStatus === 'function') {
        await refreshMentorStatus();
      }
    } catch (err) {
      setError(err?.message || 'Failed to submit mentor application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoToMentoredProjects = () => {
    switchRole('Mentor');
    navigate('/mentor/projects');
  };

  const currentStatus = String(existingApp?.status || mentorAppStatus || '').toLowerCase();

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
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                className="tf-mentor-app-btn-primary"
                onClick={handleGoToMentoredProjects}
              >
                Go to Mentored Projects
              </button>
              <button
                type="button"
                className="tf-mentor-app-btn-outline"
                onClick={() => navigate('/mentor/requests')}
              >
                View Mentor Requests
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
                          ? \`\${existingApp.years ?? existingApp.yearsOfExperience} years\`
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
                        <button
                          type="button"
                          className="tf-mentor-remove-btn"
                          title="Permanently erase this file for privacy"
                          onClick={() => handleDeleteExistingCv(existingApp.id)}
                        >
                          Delete Stored CV
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p style={{ fontSize: '0.85rem', color: 'var(--muted-fg, #64748b)' }}>No CV file stored on record.</p>
                  )}
                </div>

                {/* Submitted DigiLocker Credentials */}
                {Array.isArray(existingApp.certificates) && existingApp.certificates.length > 0 && (
                  <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border, #e2e8f0)' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--fg, #0f172a)' }}>
                      🛡️ Verified DigiLocker Credentials
                    </div>
                    {existingApp.certificates.map((cert, idx) => (
                      <div key={idx} className="tf-mentor-cert-item">
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{cert.title || cert.name}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--muted-fg, #64748b)' }}>
                            {cert.issuer} · Doc #{cert.documentNumber}
                          </div>
                        </div>
                        <span className={\`tf-mentor-digilocker-badge \${cert.verificationStatus === 'verified' ? 'verified' : 'mismatch'}\`}>
                          {cert.verificationStatus === 'verified' ? '✓ Verified' : '⚠️ Name Mismatch'}
                        </span>
                      </div>
                    ))}
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

                {existingApp.cvFileName && (
                  <div style={{ marginBottom: '1rem' }}>
                    <button
                      type="button"
                      className="tf-mentor-remove-btn"
                      onClick={() => handleDeleteExistingCv(existingApp.id)}
                    >
                      Delete Stored CV for Privacy
                    </button>
                  </div>
                )}

                <div style={{ marginTop: '1rem' }}>
                  <button
                    type="button"
                    className="tf-mentor-app-btn-primary"
                    onClick={() => setShowForm(true)}
                  >
                    Submit New Application
                  </button>
                </div>
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
                min={minYearsRequired}
                max="50"
                value={yearsOfExperience}
                onChange={(e) => setYearsOfExperience(e.target.value)}
                placeholder={\`e.g. \${minYearsRequired}\`}
                helperText={\`Minimum \${minYearsRequired} years of professional experience required for mentor eligibility.\`}
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
                      <button
                        type="button"
                        className="tf-mentor-remove-btn"
                        onClick={handleRemoveCv}
                      >
                        Remove CV
                      </button>
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
                    <div style={{ marginTop: '0.5rem' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1e3a8a', marginBottom: '4px' }}>
                        Retrieved Credentials ({digiLockerDocs.length})
                      </div>
                      {digiLockerDocs.map((doc, idx) => (
                        <div key={idx} className="tf-mentor-cert-item">
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{doc.title || doc.name}</div>
                            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                              {doc.issuer} · Holder: {doc.holderName} · Doc #{doc.documentNumber}
                            </div>
                          </div>
                          <span className={\`tf-mentor-digilocker-badge \${doc.verificationStatus === 'verified' ? 'verified' : 'mismatch'}\`}>
                            {doc.verificationStatus === 'verified' ? '✓ Verified' : '⚠️ Name Mismatch'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="tf-mentor-app-actions">
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
                  disabled={submitting}
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
`;

fs.writeFileSync(targetPath, content, 'utf8');
console.log('Successfully wrote updated MentorApplication.jsx');
