import { useState, useEffect, useContext, useRef, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { UIContext } from '../context/UIContext';
import usersApi from '../services/usersApi';
import uploadsApi from '../services/uploadsApi';
import { resolveApiBaseUrl } from '../services/apiClient';
import FormInput from '../components/common/FormInput';
import Avatar from '../components/common/Avatar';
import ConfirmModal from '../components/common/ConfirmModal';
import './settings.css';

const INDIAN_PHONE_RE = /^[6-9]\d{9}$/;
const USERNAME_RE = /^[a-zA-Z0-9._-]{3,30}$/;
const FULLNAME_RE = /^[a-zA-Z][a-zA-Z\s.'-]*$/;
const SKILL_RE = /^[a-zA-Z0-9+#.\-\s]+$/;

// SVG Icons
const ProfileIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>
);

const PaletteIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10"></circle>
    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path>
    <path d="M2 12h20"></path>
  </svg>
);

const TrashIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    <line x1="10" y1="11" x2="10" y2="17"></line>
    <line x1="14" y1="11" x2="14" y2="17"></line>
  </svg>
);

const UploadIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
    <polyline points="17 8 12 3 7 8"></polyline>
    <line x1="12" y1="3" x2="12" y2="15"></line>
  </svg>
);

function getInitials(name) {
  return String(name || '')
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || 'TF';
}

export const Settings = () => {
  const navigate = useNavigate();
  const avatarInputId = useId();
  const { user, logout, updateUser } = useContext(AuthContext);
  const { theme, setTheme } = useContext(UIContext);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Profile State
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [phone, setPhone] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [skills, setSkills] = useState([]);
  const [skillInput, setSkillInput] = useState('');

  // Avatar state
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarPreview, setAvatarPreview] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const fileInputRef = useRef(null);

  // Field validation errors
  const [errors, setErrors] = useState({
    fullName: '',
    username: '',
    bio: '',
    phone: '',
    linkedin: '',
    skill: '',
  });

  const handleSelectTheme = (newMode) => {
    if (setTheme) {
      setTheme(newMode);
    }
    showToast(`Switched to ${newMode === 'dark' ? 'Dark' : 'Light'} theme`);
  };

  // Toast Notification
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const toastTimeoutRef = useRef(null);

  const showToast = (message, type = 'success') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ visible: true, message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 3500);
  };

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  // Handle URL hash on initial load (e.g. /settings#appearance)
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      const sectionMap = {
        profile: 'settings-section-profile',
        appearance: 'settings-section-appearance',
        danger: 'settings-section-danger',
        'settings-section-profile': 'settings-section-profile',
        'settings-section-appearance': 'settings-section-appearance',
        'settings-section-danger': 'settings-section-danger',
      };
      const targetId = sectionMap[hash];
      if (targetId) {
        setTimeout(() => {
          document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
      }
    }
  }, []);


  // Initial load & Hydration from backend / localStorage
  useEffect(() => {
    let ignore = false;
    const hydrateSettings = async () => {
      try {
        const userId = localStorage.getItem('teamforge.backendUserId') || user?.id || '';
        let backendUser = null;

        if (userId) {
          try {
            backendUser = await usersApi.get(userId);
          } catch (apiErr) {
            console.warn('Backend unavailable, hydrating settings from local storage/context:', apiErr);
          }
        }

        if (ignore) return;

        let localProfile = {};
        if (userId) {
          try {
            const stored = localStorage.getItem(`teamforge.userProfile_${userId}`);
            if (stored) localProfile = JSON.parse(stored);
          } catch {
            // ignore parsing error
          }
        }

        const currentName =
          localProfile?.fullName ||
          user?.name ||
          user?.profile?.fullName ||
          backendUser?.name ||
          backendUser?.profile?.fullName ||
          '';
        const currentUsername =
          localProfile?.username ||
          user?.username ||
          user?.profile?.username ||
          backendUser?.profile?.username ||
          (currentName ? currentName.toLowerCase().replace(/[^a-z0-9]+/g, '') : '');
        const currentBio =
          localProfile?.bio ||
          backendUser?.profile?.bio ||
          user?.bio ||
          '';
        const currentPhone =
          localProfile?.phone ||
          backendUser?.phone ||
          backendUser?.profile?.phone ||
          user?.phone ||
          '';
        const currentLinkedin =
          localProfile?.linkedin ||
          backendUser?.linkedIn ||
          backendUser?.profile?.linkedin ||
          user?.linkedIn ||
          '';
        const currentSkills =
          localProfile?.skills ||
          backendUser?.profile?.skills ||
          user?.skills ||
          [];
        const currentAvatar =
          localProfile?.avatarUrl ||
          backendUser?.profile?.avatarUrl ||
          backendUser?.avatarUrl ||
          user?.avatarUrl ||
          user?.profile?.avatarUrl ||
          '';

        setFullName(currentName);
        setUsername(currentUsername);
        setBio(currentBio);
        setPhone(currentPhone);
        setLinkedin(currentLinkedin);
        setSkills(Array.isArray(currentSkills) ? currentSkills : []);
        setAvatarUrl(currentAvatar);
      } catch (err) {
        console.error('Error hydrating settings:', err);
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    hydrateSettings();
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle Avatar selection
  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast('Avatar file size must be less than 2MB', 'error');
      e.target.value = '';
      return;
    }

    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file', 'error');
      e.target.value = '';
      return;
    }

    setAvatarFile(file);
    const objectUrl = URL.createObjectURL(file);
    setAvatarPreview(objectUrl);
  };

  const handleRemoveAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview('');
    setAvatarUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Skill management
  const handleAddSkill = () => {
    const trimmed = skillInput.trim().replace(/\s+/g, ' ');
    setErrors((prev) => ({ ...prev, skill: '' }));

    if (!trimmed) {
      showToast('Skill cannot be empty', 'error');
      return;
    }
    if (trimmed.length < 2 || trimmed.length > 40) {
      showToast('Skill must be 2 to 40 characters', 'error');
      return;
    }
    if (!SKILL_RE.test(trimmed)) {
      showToast('Skill contains invalid characters', 'error');
      return;
    }
    if (skills.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      showToast('Skill already added', 'error');
      return;
    }
    if (skills.length >= 20) {
      showToast('You can add up to 20 skills', 'error');
      return;
    }

    const updated = [...skills, trimmed];
    setSkills(updated);
    setSkillInput('');
  };

  const handleRemoveSkill = (skillToRemove) => {
    setSkills(skills.filter((s) => s !== skillToRemove));
  };

  const handleUsernameBlur = async () => {
    const cleaned = username.trim();
    if (!cleaned) return;
    if (!USERNAME_RE.test(cleaned)) {
      setErrors((prev) => ({ ...prev, username: 'Username must be 3-30 chars using letters, numbers, . _ -' }));
      return;
    }
    const userId = localStorage.getItem('teamforge.backendUserId') || user?.id || '';
    try {
      const res = await usersApi.checkUsernameAvailable(cleaned, userId);
      if (res && res.available === false) {
        setErrors((prev) => ({ ...prev, username: 'This username is already taken' }));
      } else {
        setErrors((prev) => ({ ...prev, username: '' }));
      }
    } catch (e) {
      console.warn('Availability check error:', e);
    }
  };

  // Profile Save
  const handleSaveProfile = async () => {
    const cleanedName = fullName.trim().replace(/\s+/g, ' ');
    const cleanedUsername = username.trim();
    const cleanedBio = bio.trim();
    const cleanedPhone = phone.trim();
    const cleanedLinkedin = linkedin.trim();

    const newErrors = {
      fullName: '',
      username: '',
      bio: '',
      phone: '',
      linkedin: '',
      skill: '',
    };
    let hasError = false;

    // Full name validation
    if (!cleanedName) {
      newErrors.fullName = 'Full name is required';
      hasError = true;
    } else if (cleanedName.length < 2 || cleanedName.length > 60) {
      newErrors.fullName = 'Full name must be 2 to 60 characters';
      hasError = true;
    } else if (!FULLNAME_RE.test(cleanedName)) {
      newErrors.fullName = 'Full name contains invalid characters';
      hasError = true;
    }

    // Username validation
    if (!cleanedUsername) {
      newErrors.username = 'Username is required';
      hasError = true;
    } else if (!USERNAME_RE.test(cleanedUsername)) {
      newErrors.username = 'Username must be 3-30 chars using letters, numbers, . _ -';
      hasError = true;
    }

    // Bio validation
    if (cleanedBio && (cleanedBio.length < 10 || cleanedBio.length > 180)) {
      newErrors.bio = 'Bio must be 10 to 180 characters when provided';
      hasError = true;
    }

    // Phone validation
    if (cleanedPhone && !INDIAN_PHONE_RE.test(cleanedPhone)) {
      newErrors.phone = 'Enter a valid Indian phone number.';
      hasError = true;
    }

    // LinkedIn validation
    if (cleanedLinkedin) {
      try {
        const parsed = new URL(cleanedLinkedin);
        if (
          !(parsed.protocol === 'https:' || parsed.protocol === 'http:') ||
          !/linkedin\.com$/i.test(parsed.hostname.replace(/^www\./i, ''))
        ) {
          newErrors.linkedin = 'LinkedIn URL must be on linkedin.com';
          hasError = true;
        }
      } catch {
        newErrors.linkedin = 'Enter a valid LinkedIn URL';
        hasError = true;
      }
    }

    // Check username availability with backend before proceeding
    const userId = localStorage.getItem('teamforge.backendUserId') || user?.id || '';
    if (!newErrors.username && cleanedUsername) {
      try {
        const avail = await usersApi.checkUsernameAvailable(cleanedUsername, userId);
        if (avail && avail.available === false) {
          newErrors.username = 'This username is already taken';
          hasError = true;
        }
      } catch (checkErr) {
        console.warn('Pre-save availability check error:', checkErr);
      }
    }

    setErrors(newErrors);
    if (hasError) {
      showToast(newErrors.username || 'Please fix the errors in the profile form', 'error');
      return;
    }

    setSavingProfile(true);
    let finalAvatarUrl = avatarUrl;

    try {
      // 1. Upload Avatar if new file chosen
      if (avatarFile) {
        try {
          const uploadRes = await uploadsApi.uploadAvatar(avatarFile);
          finalAvatarUrl = uploadRes?.url || uploadRes?.path || (uploadRes?.filename ? `/uploads/${uploadRes.filename}` : null) || avatarUrl;
          setAvatarUrl(finalAvatarUrl);
          setAvatarPreview('');
          setAvatarFile(null);
        } catch (uploadErr) {
          console.warn('Avatar upload failed, falling back to local preview:', uploadErr);
          showToast('Avatar upload failed. Server unavailable.', 'error');
        }
      }

      // 2. Prepare Payload
      const updatedProfilePayload = {
        fullName: cleanedName,
        username: cleanedUsername,
        bio: cleanedBio,
        phone: cleanedPhone,
        linkedin: cleanedLinkedin,
        skills,
        avatarUrl: finalAvatarUrl,
      };

      // 3. Update backend API
      const userId = localStorage.getItem('teamforge.backendUserId') || user?.id || '';
      let backendUpdatedUser = null;
      if (userId) {
        try {
          backendUpdatedUser = await usersApi.update(
            userId,
            {
              name: cleanedName,
              username: cleanedUsername,
              phone: cleanedPhone,
              linkedIn: cleanedLinkedin,
              avatarUrl: finalAvatarUrl,
              profile: updatedProfilePayload,
            },
            'Administrator'
          );
        } catch (apiErr) {
          if (apiErr?.status === 409 || String(apiErr?.message || '').toLowerCase().includes('already taken')) {
            setErrors((prev) => ({ ...prev, username: 'This username is already taken' }));
            showToast('This username is already taken', 'error');
            setSavingProfile(false);
            return;
          }
          console.warn('Backend unavailable for profile update, persisting locally.', apiErr);
        }
      }

      // 4. Update Local Storage & Context
      if (userId) {
        localStorage.setItem(`teamforge.userProfile_${userId}`, JSON.stringify(updatedProfilePayload));
      }

      const updatedUserObj = {
        ...(user || {}),
        ...(backendUpdatedUser || {}),
        id: userId,
        name: cleanedName,
        phone: cleanedPhone,
        linkedIn: cleanedLinkedin,
        avatarUrl: finalAvatarUrl,
        profile: {
          ...(user?.profile || {}),
          ...(backendUpdatedUser?.profile || {}),
          ...updatedProfilePayload,
          fullName: cleanedName,
        },
      };

      if (updateUser) {
        updateUser(updatedUserObj);
      }

      setFullName(cleanedName);
      setUsername(cleanedUsername);
      setBio(cleanedBio);
      setPhone(cleanedPhone);
      setLinkedin(cleanedLinkedin);

      showToast('Profile settings saved');
    } catch (err) {
      console.error('Failed to save profile settings:', err);
      showToast('Error saving profile settings', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  // Delete Account
  const handleConfirmDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      const userId = localStorage.getItem('teamforge.backendUserId') || user?.id || '';
      if (userId) {
        try {
          await usersApi.remove(userId);
        } catch (apiErr) {
          console.warn('Backend delete returned warning:', apiErr);
        }
        localStorage.removeItem(`teamforge.userProfile_${userId}`);
        localStorage.removeItem(`teamforge.notificationSettings_${userId}`);
        localStorage.removeItem(`teamforge.privacySettings_${userId}`);
      }

      localStorage.removeItem('teamforge.backendUserId');
      localStorage.removeItem('teamforge.currentUser');
      localStorage.removeItem('teamforge.userProfile');
      localStorage.removeItem('teamforge.notificationSettings');
      localStorage.removeItem('teamforge.privacySettings');
      sessionStorage.clear();

      setIsDeleteModalOpen(false);
      showToast('Account deleted successfully');
      if (logout) logout();
      navigate('/login');
    } catch (err) {
      console.error('Account deletion failed:', err);
      showToast('Account deletion failed', 'error');
      setIsDeleteModalOpen(false);
    } finally {
      setDeletingAccount(false);
    }
  };

  const displayName = fullName || user?.name || user?.profile?.fullName || 'User';
  const initials = getInitials(displayName);
  const apiBase = resolveApiBaseUrl ? resolveApiBaseUrl() : 'http://localhost:3000';
  const displayAvatar = avatarPreview || (avatarUrl ? (avatarUrl.startsWith('http') || avatarUrl.startsWith('data:') ? avatarUrl : `${apiBase}${avatarUrl}`) : null);

  if (loading) {
    return (
      <div className="settings-page" style={{ textAlign: 'center', marginTop: '60px' }}>
        <p style={{ color: 'var(--muted-fg, #6b7280)', fontWeight: 600, fontSize: '1.1rem' }}>
          Loading your settings...
        </p>
      </div>
    );
  }

  return (
    <div id="page-settings" className="settings-page">
      {/* Header */}
      <div className="settings-header">
        <div className="settings-header-top">
          <div>
            <h1 className="settings-title">Settings</h1>
            <p className="settings-subtitle">Manage your account and appearance.</p>
          </div>
        </div>
      </div>

      {/* ═══════════ CARD 1: PROFILE INFO ═══════════ */}
      <div className="settings-card" id="settings-section-profile">
          <div className="settings-section-header">
            <div className="settings-icon-badge">
              <ProfileIcon />
            </div>
            <div>
              <h2 className="settings-section-title">Profile Information</h2>
              <p className="settings-section-desc">Update your public profile details.</p>
            </div>
          </div>

          {user?.profile?.needsUsernameChange && (
            <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid #f59e0b', color: '#b45309', padding: '12px 16px', borderRadius: '10px', marginBottom: '20px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>⚠️</span>
              <div>
                <strong>Username Update Required:</strong> A duplicate username was identified on your account. Please choose a new, unique username and save your profile.
              </div>
            </div>
          )}

          {/* Avatar Upload */}
          <div className="settings-form-group">
            <label className="settings-label" htmlFor={avatarInputId}>Avatar Upload</label>
            <div className="settings-avatar-wrapper">
              <div className="settings-avatar-box">
                <Avatar
                  src={displayAvatar}
                  name={displayName}
                  initials={initials}
                  size="xl"
                />
              </div>
              <div className="settings-avatar-actions">
                <div className="settings-avatar-btn-row">
                  <label htmlFor={avatarInputId} className="settings-file-label">
                    <UploadIcon />
                    <span>Choose Image</span>
                  </label>
                  <input
                    type="file"
                    id={avatarInputId}
                    ref={fileInputRef}
                    className="settings-file-input"
                    accept="image/*"
                    onChange={handleAvatarChange}
                  />
                  {(displayAvatar || avatarFile) && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      className="settings-avatar-remove-btn"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <p className="settings-avatar-note">
                  Select an image (max 2MB, JPG/PNG/WebP) to set as your profile avatar.
                </p>
              </div>
            </div>
          </div>

          {/* Form Grid: Full Name & Username */}
          <div className="settings-form-grid">
            <FormInput
              label="Full Name"
              name="fullName"
              required
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: '' }));
              }}
              error={errors.fullName}
              placeholder="e.g. Alex Morgan"
            />

            <FormInput
              label="Username"
              name="username"
              required
              helperText="Unique handle"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (errors.username) setErrors((prev) => ({ ...prev, username: '' }));
              }}
              onBlur={handleUsernameBlur}
              error={errors.username}
              placeholder="e.g. alexmorgan"
            />
          </div>

          {/* Bio */}
          <FormInput
            label="Bio"
            name="bio"
            multiline
            rows={3}
            value={bio}
            onChange={(e) => {
              setBio(e.target.value);
              if (errors.bio) setErrors((prev) => ({ ...prev, bio: '' }));
            }}
            error={errors.bio}
            placeholder="e.g. Full-stack Developer · IIT Delhi"
            helperText={`${bio.length} / 180 chars (10 - 180 characters)`}
          />

          {/* Phone & LinkedIn Grid */}
          <div className="settings-form-grid">
            <FormInput
              label="Phone Number"
              name="phone"
              type="tel"
              helperText="Indian 10-digit"
              placeholder="9876543210"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' }));
              }}
              error={errors.phone}
            />

            <FormInput
              label="LinkedIn Profile URL"
              name="linkedin"
              type="url"
              placeholder="https://linkedin.com/in/yourprofile"
              value={linkedin}
              onChange={(e) => {
                setLinkedin(e.target.value);
                if (errors.linkedin) setErrors((prev) => ({ ...prev, linkedin: '' }));
              }}
              error={errors.linkedin}
            />
          </div>

          <hr className="settings-divider" />

          {/* My Skills */}
          <div className="settings-form-group">
            <div className="settings-skills-header">
              <label className="settings-label" htmlFor="skill-input">My Skills</label>
              <p className="settings-section-desc">
                Add skills as tags. These appear on your profile and dashboard.
              </p>
            </div>
            <div className="settings-skills-input-row">
              <input
                id="skill-input"
                type="text"
                className="settings-input settings-skill-input"
                placeholder="e.g. React, Python, Machine Learning"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSkill();
                  }
                }}
              />
              <button
                id="add-skill-btn"
                type="button"
                className="settings-btn-add-skill"
                onClick={handleAddSkill}
              >
                + Add
              </button>
            </div>

            {/* Skills container */}
            <div id="skills-container" className="settings-skills-tags-container">
              {skills.length > 0 ? (
                skills.map((skill) => (
                  <span key={skill} className="settings-skill-badge">
                    {skill}
                    <button
                      type="button"
                      className="settings-skill-remove"
                      onClick={() => handleRemoveSkill(skill)}
                      aria-label={`Remove skill ${skill}`}
                    >
                      &times;
                    </button>
                  </span>
                ))
              ) : (
                <div className="settings-empty-skills">No skills added yet. Type a skill above and click Add.</div>
              )}
            </div>
          </div>

          <div className="settings-btn-row">
            <button
              id="save-profile-btn"
              type="button"
              className="settings-btn-primary"
              disabled={savingProfile}
              onClick={handleSaveProfile}
            >
              {savingProfile ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </div>
        </div>

      {/* ═══════════ CARD 2: APPEARANCE ═══════════ */}
      <div className="settings-card" id="settings-section-appearance">
        <div className="settings-section-header">
          <div className="settings-icon-badge">
            <PaletteIcon />
          </div>
          <div>
            <h2 className="settings-section-title">Appearance</h2>
            <p className="settings-section-desc">Customize your interface theme.</p>
          </div>
        </div>

        <div className="settings-theme-selector-grid">
          <div
            className={`settings-theme-option ${theme === 'light' ? 'selected' : ''}`}
            onClick={() => handleSelectTheme('light')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') handleSelectTheme('light');
            }}
          >
            <div className="settings-theme-icon">☀️</div>
            <div>
              <h3 className="settings-theme-title">Light Theme</h3>
              <p className="settings-theme-desc">Warm, modern, and clean aesthetic.</p>
            </div>
          </div>

          <div
            className={`settings-theme-option ${theme === 'dark' ? 'selected' : ''}`}
            onClick={() => handleSelectTheme('dark')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') handleSelectTheme('dark');
            }}
          >
            <div className="settings-theme-icon">🌙</div>
            <div>
              <h3 className="settings-theme-title">Dark Theme</h3>
              <p className="settings-theme-desc">Sleek, deep contrast for low-light environments.</p>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════ CARD 5: DANGER ZONE ═══════════ */}
      <div className="settings-card danger-card" id="settings-section-danger">
          <div className="settings-section-header">
            <div className="settings-icon-badge danger">
              <TrashIcon />
            </div>
            <div>
              <h2 className="settings-section-title danger">Danger Zone</h2>
              <p className="settings-section-desc">Irreversible account actions.</p>
            </div>
          </div>

          <div className="settings-danger-callout">
            Deleting your account will permanently remove your user profile, active project memberships,
            tasks, submitted proofs, and earned reputation XP. This action cannot be reversed.
          </div>

          <button
            id="delete-account-btn"
            type="button"
            className="settings-btn-destructive"
            onClick={() => setIsDeleteModalOpen(true)}
          >
            <TrashIcon /> Delete Account
          </button>
        </div>

      {/* ═══════════ MODAL: CONFIRM DELETION ═══════════ */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDeleteAccount}
        title="Confirm Account Deletion"
        message="Are you sure you want to delete your TeamForge account? This action is permanent and cannot be undone. All your records, task submissions, and project associations will be removed."
        confirmText="Yes, Delete My Account"
        loading={deletingAccount}
        variant="danger"
        icon={<TrashIcon />}
      />

      {/* ═══════════ TOAST NOTIFICATION ═══════════ */}
      {toast.visible && (
        <div className="settings-toast-container" id="toast">
          <div className={`settings-toast ${toast.type}`}>
            <span className="settings-toast-icon">
              {toast.type === 'success' && '✓'}
              {toast.type === 'error' && '✕'}
              {toast.type === 'info' && 'ℹ'}
            </span>
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
