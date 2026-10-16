import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import mentorMarketplaceApi from '../../services/mentorMarketplaceApi';
import FormInput from '../../components/common/FormInput';
import MentorCard from '../../components/features/MentorCard';
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

const MyMentorProfile = () => {
  const { user } = useContext(AuthContext);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [hasExistingProfile, setHasExistingProfile] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [bio, setBio] = useState('');
  const [skillsInput, setSkillsInput] = useState('');
  const [experienceYears, setExperienceYears] = useState(3);
  const [sessionPrice, setSessionPrice] = useState(1000);
  const [sessionDuration, setSessionDuration] = useState(60);
  const [availabilityTime, setAvailabilityTime] = useState('Anytime');
  const [isAvailable, setIsAvailable] = useState(true);

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
          setSessionDuration(data.sessionDuration ?? 60);
          setAvailabilityTime(data.availability || 'Anytime');
          setIsAvailable(data.isAvailable !== false);
        } else if (isMounted) {
          // First load with no profile yet: empty form, not an error
          setHasExistingProfile(false);
          setName(user?.name || user?.profile?.fullName || '');
          setTitle('');
          setBio('');
          setSkillsInput('');
          setExperienceYears('');
          setSessionPrice('');
          setSessionDuration(60);
          setAvailabilityTime('Anytime');
          setIsAvailable(true);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    const priceNum = Number(sessionPrice) || 0;
    if (priceNum <= 0) {
      setFeedback({ type: 'error', message: 'Session price must be greater than 0 INR.' });
      setSaving(false);
      return;
    }

    const payload = {
      name: name.trim() || user?.name || 'Mentor',
      title: title.trim() || 'Software Mentor',
      bio: bio.trim() || 'Experienced mentor ready to guide student projects.',
      skills: parsedSkills.length > 0 ? parsedSkills : ['Mentorship', 'Software Engineering'],
      experienceYears: Number(experienceYears) || 1,
      sessionPrice: priceNum,
      sessionDuration: Number(sessionDuration) || 60,
      availability: availabilityTime,
      languages: ['English'],
      isAvailable: Boolean(isAvailable),
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
        setSessionDuration(saved.sessionDuration ?? sessionDuration);
        setAvailabilityTime(saved.availability || availabilityTime);
        setIsAvailable(saved.isAvailable !== false);
      }

      setFeedback({
        type: 'success',
        message: 'Your mentor profile and session pricing have been saved and published to the marketplace!',
      });
    } catch (err) {
      console.error('Failed to save mentor profile:', err);
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to save mentor profile. Please check all fields.',
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
            Configure your public listing, session pricing, and availability. Project owners see these details when booking mentorship.
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

          <form onSubmit={handleSubmit} className="tf-mentor-form">
            <FormInput
              label="Display Name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Kiran Bose"
              required
            />

            <FormInput
              label="Headline / Expertise"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Full-stack Architect & Cloud Specialist"
              required
            />

            <FormInput
              label="Bio & Mentoring Focus"
              name="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Describe your background and how you guide teams through their project milestones..."
              multiline
              rows={4}
              required
            />

            <FormInput
              label="Skills (comma separated)"
              name="skills"
              value={skillsInput}
              onChange={(e) => setSkillsInput(e.target.value)}
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
                onChange={(e) => setExperienceYears(e.target.value)}
                required
              />

              <FormInput
                label="Session Price (INR ₹)"
                name="sessionPrice"
                type="number"
                min="100"
                step="50"
                value={sessionPrice}
                onChange={(e) => setSessionPrice(e.target.value)}
                required
              />
            </div>

            <div className="tf-mentor-form-row">
              <FormInput
                label="Availability Schedule"
                name="availability"
                value={availabilityTime}
                onChange={(e) => setAvailabilityTime(e.target.value)}
                options={['Anytime', 'Weekdays', 'Weekends']}
              />

              <FormInput
                label="Session Duration"
                name="sessionDuration"
                value={sessionDuration}
                onChange={(e) => setSessionDuration(Number(e.target.value))}
                options={[
                  { value: 30, label: '30 Minutes' },
                  { value: 60, label: '60 Minutes' },
                  { value: 90, label: '90 Minutes' },
                ]}
              />
            </div>

            {/* Availability Toggle */}
            <div className="tf-mentor-toggle-box">
              <label className="tf-mentor-toggle-label">
                <input
                  type="checkbox"
                  checked={isAvailable}
                  onChange={(e) => setIsAvailable(e.target.checked)}
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
              onclick={(e) => {
                e.preventDefault();
                handleSubmit(e);
              }}
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
              schedule={availabilityTime}
              sessionPrice={sessionPrice || 0}
              available={isAvailable}
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
    </div>
  );
};

export default MyMentorProfile;
