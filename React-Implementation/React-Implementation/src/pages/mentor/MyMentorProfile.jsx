import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectCurrentUser } from '../../store/selectors/sessionSelectors';
import {
  fetchMyMentorProfile,
  saveMentorProfile,
  toggleMentorAvailability,
} from '../../store/thunks/mentorProfilesThunks';
import {
  selectHasExistingMentorProfile,
  selectIsSavingMentorProfile,
  selectMentorProfilesWorking,
  selectMyMentorProfile,
  selectMyMentorProfileStatus,
} from '../../store/selectors/mentorProfilesSelectors';
import { dismissToast, enqueueToast } from '../../store/slices/uiSlice';
import { selectToasts } from '../../store/selectors/uiSelectors';
import FormInput from '../../components/common/FormInput';
import MentorCard from '../../components/features/MentorCard';
import {
  PRICE_MIN,
  PRICE_MAX,
  validatePriceInput,
} from '../../utils/mentorProfileValidation';
import './myMentorProfile.css';

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

const MyMentorProfileContent = () => {
  const user = useSelector(selectCurrentUser);
  const dispatch = useDispatch();

  const myProfile = useSelector(selectMyMentorProfile);
  const hasExistingProfile = useSelector(selectHasExistingMentorProfile);
  const myProfileStatus = useSelector(selectMyMentorProfileStatus);
  const saving = useSelector(selectIsSavingMentorProfile);
  const working = useSelector(selectMentorProfilesWorking);
  const toasts = useSelector(selectToasts);
  const latestToast =
    Array.isArray(toasts) && toasts.length > 0
      ? toasts[toasts.length - 1]
      : null;

  const loading = myProfileStatus === 'idle' || myProfileStatus === 'loading';
  const feedback = working.feedbackNotice || null;
  const [fieldErrors, setFieldErrors] = useState({});

  const showToast = (message, type = 'success') => {
    dispatch(enqueueToast({ message, type, durationMs: 4000 }));
  };

  useEffect(() => {
    if (!latestToast?.id) return undefined;
    const t = setTimeout(() => {
      dispatch(dismissToast(latestToast.id));
    }, latestToast.durationMs || 4000);
    return () => clearTimeout(t);
  }, [dispatch, latestToast?.id, latestToast?.durationMs]);

  // Controlled form keystroke state (local per D6 until Save; re-initialized once profile loads)
  const [hydratedKey, setHydratedKey] = useState('init');
  const currentSourceKey =
    myProfileStatus === 'succeeded'
      ? `loaded:${myProfile?.id || 'empty'}`
      : 'init';
  const [name, setName] = useState(() => user?.name || user?.profile?.fullName || '');
  const [title, setTitle] = useState('');
  const [bio, setBio] = useState('');
  const [skillsInput, setSkillsInput] = useState('');
  const [experienceYears, setExperienceYears] = useState(3);
  const [sessionPrice, setSessionPrice] = useState(1000);
  const [isAvailable, setIsAvailable] = useState(true);
  const [maxActiveMentees, setMaxActiveMentees] = useState(3);

  if (myProfileStatus === 'succeeded' && hydratedKey !== currentSourceKey) {
    setHydratedKey(currentSourceKey);
    if (myProfile && myProfile.id) {
      setName(myProfile.name || user?.name || '');
      setTitle(myProfile.title || '');
      setBio(myProfile.bio || '');
      setSkillsInput(
        Array.isArray(myProfile.skills) ? myProfile.skills.join(', ') : '',
      );
      setExperienceYears(myProfile.experienceYears ?? '');
      setSessionPrice(myProfile.sessionPrice ?? '');
      setIsAvailable(myProfile.isAvailable !== false);
      setMaxActiveMentees(myProfile.maxActiveMentees ?? 3);
    } else {
      setName(user?.name || user?.profile?.fullName || '');
      setTitle('');
      setBio('');
      setSkillsInput('');
      setExperienceYears('');
      setSessionPrice('');
      setIsAvailable(true);
      setMaxActiveMentees(3);
    }
  }

  useEffect(() => {
    dispatch(fetchMyMentorProfile({ userId: user?.id, force: true }));
  }, [dispatch, user?.id]);

  const parsedSkills = skillsInput
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const handleToggleAvailability = async (e) => {
    const nextVal = e.target.checked;
    setIsAvailable(nextVal);
    try {
      await dispatch(
        toggleMentorAvailability({
          isAvailable: nextVal,
          userId: user?.id,
        }),
      ).unwrap();
      showToast(
        nextVal
          ? 'You are now available for bookings'
          : 'You are now unavailable for bookings',
        'success',
      );
    } catch (err) {
      setIsAvailable(!nextVal);
      const msg =
        err?.message || 'Failed to update availability.';
      showToast(msg, 'error');
    }
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (saving) return;

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
      const firstErrMsg =
        errors.sessionPrice ||
        errors.name ||
        errors.title ||
        errors.bio ||
        errors.skills ||
        errors.experienceYears;
      showToast(firstErrMsg, 'error');
      return;
    }

    const payload = {
      name: name.trim() || user?.name || 'Mentor',
      title: title.trim() || 'Software Mentor',
      bio: bio.trim() || 'Experienced mentor ready to guide student projects.',
      skills:
        parsedSkills.length > 0
          ? parsedSkills
          : ['Mentorship', 'Software Engineering'],
      experienceYears: Number(experienceYears) || 1,
      sessionPrice: Number(sessionPrice),
      languages: ['English'],
      isAvailable: Boolean(isAvailable),
      maxActiveMentees: Math.min(10, Math.max(1, Number(maxActiveMentees) || 3)),
    };

    try {
      const result = await dispatch(
        saveMentorProfile({
          payload,
          isUpdate: hasExistingProfile,
          userId: user?.id,
          syncAvailability: true,
        }),
      ).unwrap();

      const saved = result?.saved;
      if (saved && (saved.id || saved.userId)) {
        setName(saved.name || name);
        setTitle(saved.title || title);
        setBio(saved.bio || bio);
        setSkillsInput(
          Array.isArray(saved.skills) ? saved.skills.join(', ') : skillsInput,
        );
        setExperienceYears(saved.experienceYears ?? experienceYears);
        setSessionPrice(saved.sessionPrice ?? sessionPrice);
        setIsAvailable(saved.isAvailable !== false);
        setMaxActiveMentees(saved.maxActiveMentees ?? maxActiveMentees);
      }

      showToast('Mentor profile saved', 'success');
    } catch (err) {
      const serverMsg =
        err?.message ||
        'Failed to save mentor profile. Please check all fields.';
      const errCode = err?.code;
      if (
        errCode === 'INVALID_PRICE' ||
        (serverMsg && serverMsg.includes('between 1 and 100,000'))
      ) {
        setFieldErrors((prev) => ({ ...prev, sessionPrice: serverMsg }));
      }
      showToast(serverMsg, 'error');
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
              avatar={user?.avatarUrl || user?.profile?.avatarUrl || user?.avatar}
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

      {/* Toast Notification (backed by uiSlice) */}
      {latestToast && (
        <div
          role="alert"
          data-testid="toast"
          className={`tf-mentor-toast ${latestToast.type}`}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            backgroundColor: latestToast.type === 'error' ? '#ef4444' : '#10b981',
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
          <span style={{ fontWeight: 700 }}>{latestToast.type === 'error' ? '✕' : '✓'}</span>
          <span>{latestToast.message}</span>
        </div>
      )}
    </div>
  );
};

const MyMentorProfile = MyMentorProfileContent;
export default MyMentorProfile;
