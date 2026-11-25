import { useState, useEffect, useContext, useRef } from 'react';
import { AuthContext } from '../../context/AuthContext';
import mentorMarketplaceApi from '../../services/mentorMarketplaceApi';
import FormInput from '../../components/common/FormInput';
import MentorCard from '../../components/features/MentorCard';
import './myMentorProfile.css';

export const PRICE_MIN = 1;
export const PRICE_MAX = 100000;
export const INVALID_PRICE_MESSAGE = 'Enter a whole number between 1 and 100,000';

export function validatePriceInput(val) {
  if (val === '' || val === null || val === undefined) {
    return INVALID_PRICE_MESSAGE;
  }
  const str = String(val).trim();
  if (!/^\d+$/.test(str)) {
    return INVALID_PRICE_MESSAGE;
  }
  const num = Number(str);
  if (!Number.isInteger(num) || num < PRICE_MIN || num > PRICE_MAX) {
    return INVALID_PRICE_MESSAGE;
  }
  return '';
}

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const MyMentorProfile = () => {
  const { user } = useContext(AuthContext);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [hasExistingProfile, setHasExistingProfile] = useState(false);

  // Toast Notification state
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const toastTimeoutRef = useRef(null);

  const showToast = (message, type = 'success') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ visible: true, message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 4000);
  };

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  // Form State
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [bio, setBio] = useState('');
  const [skillsInput, setSkillsInput] = useState('');
  const [experienceYears, setExperienceYears] = useState(3);
  const [sessionPrice, setSessionPrice] = useState(1000);
  const [isAvailable, setIsAvailable] = useState(true);
  const [maxActiveMentees, setMaxActiveMentees] = useState(3);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      try {
        let data = null;
        try {
          data = await mentorMarketplaceApi.myProfile(undefined, user?.id);
        } catch (err) {
          // Treat "not found" / 404 on load as "no profile yet", do not show error
          if (err?.message?.toLowerCase().includes('not found') || err?.message?.includes('404')) {
            data = null;
          } else {
            console.error('Failed to load mentor profile:', err);
          }
        }

        if (isMounted && data && data.id) {
          setHasExistingProfile(true);
          setName(data.name || user?.name || '');
          setTitle(data.title || '');
          setBio(data.bio || '');
          setSkillsInput(Array.isArray(data.skills) ? data.skills.join(', ') : '');
          setExperienceYears(data.experienceYears ?? '');
          setSessionPrice(data.sessionPrice ?? '');
          setIsAvailable(data.isAvailable !== false);
          setMaxActiveMentees(data.maxActiveMentees ?? 3);
        } else if (isMounted) {
          // First load with no profile yet: empty form, not an error
          setHasExistingProfile(false);
          setName(user?.name || user?.profile?.fullName || '');
          setTitle('');
          setBio('');
          setSkillsInput('');
          setExperienceYears('');
          setSessionPrice('');
          setIsAvailable(true);
          setMaxActiveMentees(3);
        }
      } catch (err) {
        console.error('Failed to load mentor profile:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const parsedSkills = skillsInput
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const handleToggleAvailability = async (e) => {
    const nextVal = e.target.checked;
    setIsAvailable(nextVal);
    try {
      await mentorMarketplaceApi.updateAvailability(nextVal, undefined, user?.id);
      showToast(nextVal ? 'You are now available for bookings' : 'You are now unavailable for bookings', 'success');
    } catch (err) {
      setIsAvailable(!nextVal); // revert on error
      const msg = err?.serverMessage || err?.message || 'Failed to update availability.';
      showToast(msg, 'error');
    }
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (saving) return; // Prevent double submission

    setFieldErrors({});
    const errors = {};

    if (!name.trim()) {
      errors.name = 'Display name is required.';
    }
    if (!title.trim()) {
      errors.title = 'Headline / Expertise is required.';
    }
    if (!bio.trim()) {
      errors.bio = 'Bio & Mentoring Focus is required.';
    }
    if (!skillsInput.trim() || parsedSkills.length === 0) {
      errors.skills = 'At least one skill is required.';
    }

    const priceErr = validatePriceInput(sessionPrice);
    if (priceErr) {
      errors.sessionPrice = priceErr;
    }

    const expNum = Number(experienceYears);
    if (experienceYears === '' || isNaN(expNum) || expNum < 0) {
      errors.experienceYears = 'Years of experience is required.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstErrMsg = errors.sessionPrice || errors.name || errors.title || errors.bio || errors.skills || errors.experienceYears;
      showToast(firstErrMsg, 'error');
      return;
    }

    setSaving(true);
    setFeedback(null);

    const payload = {
      name: name.trim() || user?.name || 'Mentor',
      title: title.trim() || 'Software Mentor',
      bio: bio.trim() || 'Experienced mentor ready to guide student projects.',
      skills: parsedSkills.length > 0 ? parsedSkills : ['Mentorship', 'Software Engineering'],
      experienceYears: Number(experienceYears) || 1,
      sessionPrice: Number(sessionPrice),
      languages: ['English'],
      isAvailable: Boolean(isAvailable),
      maxActiveMentees: Math.min(10, Math.max(1, Number(maxActiveMentees) || 3)),
    };

    try {
      let saved = null;
      if (hasExistingProfile) {
        saved = await mentorMarketplaceApi.updateProfile(payload, undefined, user?.id);
      } else {
        saved = await mentorMarketplaceApi.createProfile(payload, undefined, user?.id);
        setHasExistingProfile(true);
      }

      await mentorMarketplaceApi.updateAvailability(Boolean(isAvailable), undefined, user?.id).catch(() => {});

      if (saved && (saved.id || saved.userId)) {
        setHasExistingProfile(true);
        setName(saved.name || name);
        setTitle(saved.title || title);
        setBio(saved.bio || bio);
        setSkillsInput(Array.isArray(saved.skills) ? saved.skills.join(', ') : skillsInput);
        setExperienceYears(saved.experienceYears ?? experienceYears);
        setSessionPrice(saved.sessionPrice ?? sessionPrice);
        setIsAvailable(saved.isAvailable !== false);
        setMaxActiveMentees(saved.maxActiveMentees ?? maxActiveMentees);
      }

      showToast('Mentor profile saved', 'success');
      setFeedback({
        type: 'success',
        message: 'Your mentor profile and pricing have been saved and published to the marketplace!',
      });
    } catch (err) {
      console.error('Failed to save mentor profile:', err);
      const serverMsg =
        err?.serverMessage ||
        err?.data?.message ||
        err?.response?.data?.message ||
        err?.message ||
        'Failed to save mentor profile. Please check all fields.';
      const errCode = err?.code || err?.data?.code || err?.response?.data?.code;
      if (errCode === 'INVALID_PRICE' || (serverMsg && serverMsg.includes('between 1 and 100,000'))) {
        setFieldErrors((prev) => ({ ...prev, sessionPrice: serverMsg }));
      }
      showToast(serverMsg, 'error');
      setFeedback({
        type: 'error',
        message: serverMsg,
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="tf-mentor-profile-container">
        <p className="text-sm text-muted">Loading your mentor profile...</p>
      </div>
    );
  }

  return (
    <div className="tf-mentor-profile-container">
      <div className="tf-mentor-profile-header">
        <div>
          <h1 className="tf-mentor-profile-title">My Mentor Profile</h1>
          <p className="tf-mentor-profile-subtitle">
            Configure your public listing, pricing, and availability. Project owners see these details when booking mentorship.
          </p>
        </div>
      </div>

      {feedback && (
        <div className={`tf-mentor-profile-feedback ${feedback.type}`}>
          {feedback.message}
        </div>
      )}

      <div className="tf-mentor-profile-layout">
        {/* Left Column: Edit Form */}
        <div className="tf-mentor-profile-card">
          <h2 className="tf-mentor-card-heading">
            <UserIcon /> Mentor Details &amp; Pricing
          </h2>

          <form onSubmit={handleSubmit} className="tf-mentor-form" noValidate>
            <FormInput
              label="Display Name"
              name="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: '' }));
              }}
              error={fieldErrors.name}
              placeholder="e.g. Kiran Bose"
              required
            />

            <FormInput
              label="Headline / Expertise"
              name="title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (fieldErrors.title) setFieldErrors((prev) => ({ ...prev, title: '' }));
              }}
              error={fieldErrors.title}
              placeholder="e.g. Full-stack Architect & Cloud Specialist"
              required
            />

            <FormInput
              label="Bio & Mentoring Focus"
              name="bio"
              value={bio}
              onChange={(e) => {
                setBio(e.target.value);
                if (fieldErrors.bio) setFieldErrors((prev) => ({ ...prev, bio: '' }));
              }}
              error={fieldErrors.bio}
              placeholder="Describe your background and how you guide teams through their project milestones..."
              multiline
              rows={4}
              required
            />

            <FormInput
              label="Skills (comma separated)"
              name="skills"
              value={skillsInput}
              onChange={(e) => {
                setSkillsInput(e.target.value);
                if (fieldErrors.skills) setFieldErrors((prev) => ({ ...prev, skills: '' }));
              }}
              error={fieldErrors.skills}
              placeholder="e.g. React, Node.js, System Design, DevOps"
              required
            />

            <div className="tf-mentor-form-row">
              <FormInput
                label="Years of Experience"
                name="experienceYears"
                type="number"
                min="0"
                max="50"
                value={experienceYears}
                onChange={(e) => {
                  setExperienceYears(e.target.value);
                  if (fieldErrors.experienceYears) setFieldErrors((prev) => ({ ...prev, experienceYears: '' }));
                }}
                error={fieldErrors.experienceYears}
                required
              />

              <FormInput
                label="Price (INR)"
                name="sessionPrice"
                id="sessionPrice"
                type="number"
                min="1"
                max="100000"
                step="1"
                inputMode="numeric"
                value={sessionPrice}
                onKeyDown={(e) => {
                  if (['e', 'E', '+', '-'].includes(e.key)) {
                    e.preventDefault();
                  }
                }}
                onChange={(e) => {
                  const val = e.target.value;
                  setSessionPrice(val);
                  if (val && /^\d+$/.test(val)) {
                    const num = Number(val);
                    if (num >= PRICE_MIN && num <= PRICE_MAX) {
                      setFieldErrors((prev) => ({ ...prev, sessionPrice: '' }));
                    }
                  }
                }}
                onBlur={() => {
                  const err = validatePriceInput(sessionPrice);
                  setFieldErrors((prev) => ({ ...prev, sessionPrice: err }));
                }}
                error={fieldErrors.sessionPrice}
                required
              />
            </div>

            <FormInput
              label="Max Active Mentees (1–10)"
              name="maxActiveMentees"
              type="number"
              min="1"
              max="10"
              value={maxActiveMentees}
              onChange={(e) => setMaxActiveMentees(e.target.value)}
              helperText="Maximum concurrent active mentored projects or sessions before your profile shows Full."
            />

            {/* Availability Toggle */}
            <div className="tf-mentor-toggle-box">
              <label className="tf-mentor-toggle-label">
                <input
                  type="checkbox"
                  checked={isAvailable}
                  onChange={handleToggleAvailability}
                  disabled={saving}
                  data-testid="availability-toggle"
                  className="tf-mentor-checkbox"
                />
                <span className="tf-mentor-toggle-text">
                  <strong>Available for new project bookings</strong>
                  <small>When unchecked, your profile is marked as &quot;Unavailable&quot; in the directory.</small>
                </span>
              </label>
            </div>

            <button
              type="submit"
              className="tf-mentor-btn-save"
              disabled={saving}
              data-testid="save-mentor-profile-btn"
            >
              <CheckIcon />
              <span>{saving ? 'Saving...' : 'Save & Publish Profile'}</span>
            </button>
          </form>
        </div>

        {/* Right Column: Live Marketplace Preview */}
        <div className="tf-mentor-preview-section">
          <div className="tf-mentor-preview-sticky">
            <div className="tf-mentor-preview-tag">
              Marketplace Live Preview
            </div>

            <MentorCard
              name={name || user?.name || 'Your Name'}
              avatar={user?.avatar}
              headline={title || 'Professional Title'}
              bio={bio || 'Your bio will appear here to prospective project owners looking for mentorship.'}
              skills={parsedSkills.length > 0 ? parsedSkills : ['React', 'System Design']}
              experienceYears={experienceYears}
              sessionPrice={/^\d+$/.test(String(sessionPrice).trim()) ? Number(sessionPrice) : 0}
              available={isAvailable}
              maxActiveMentees={Number(maxActiveMentees) || 3}
              university={user?.university || user?.profile?.university || ''}
              action={{
                label: isAvailable ? 'Book with Escrow' : 'Currently Unavailable',
                disabled: true,
              }}
            />

            <p className="tf-mentor-preview-note">
              This is an interactive preview of your mentor card in the Owner Mentors Directory.
            </p>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast.visible && (
        <div
          role="alert"
          data-testid="toast"
          className={`tf-mentor-toast ${toast.type}`}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            backgroundColor: toast.type === 'error' ? '#ef4444' : '#10b981',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: '8px',
            boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.95rem',
            fontWeight: 500,
          }}
        >
          <span style={{ fontWeight: 700 }}>{toast.type === 'error' ? '✕' : '✓'}</span>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
};

export default MyMentorProfile;
