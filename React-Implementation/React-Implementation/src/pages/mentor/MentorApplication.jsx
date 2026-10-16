import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { RoleContext } from '../../context/RoleContext';
import mentorApplicationsApi from '../../services/mentorApplicationsApi';
import adminApi from '../../services/adminApi';
import FormInput from '../../components/common/FormInput';
import './mentorApplication.css';

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
      setError(`Minimum ${minYearsRequired} years of professional experience required for mentor eligibility.`);
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
        experience: `${numYears} years`,
        skills: parsedSkills.length > 0 ? parsedSkills : undefined,
        expertise: parsedSkills.join(', '),
        linkedin: portfolio.trim() || undefined,
        portfolio: portfolio.trim() || undefined,
      };

      const created = await mentorApplicationsApi.create(payload);
      setSuccess('Your mentor application has been submitted successfully for admin review!');
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
                  Your previous mentor application was not approved by the administrator. Mentor workspaces remain locked. You may update your profile information and re-apply below.
                </p>
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
                The Mentor role requires admin review. Once submitted, administrators will review your application before unlocking mentor privileges.
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
                placeholder={`e.g. ${minYearsRequired}`}
                helperText={`Minimum ${minYearsRequired} years of professional experience required for mentor eligibility.`}
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
