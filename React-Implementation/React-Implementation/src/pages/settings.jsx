import { useState, useEffect, useContext, useRef, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { UIContext } from '../context/UIContext';
import usersApi from '../services/usersApi';
import uploadsApi from '../services/uploadsApi';
import { resolveApiBaseUrl } from '../services/apiClient';
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

const BellIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
  </svg>
);

const EyeIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
    <circle cx="12" cy="12" r="3"></circle>
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

const DEFAULT_NOTIFICATIONS = {
  taskAssigned: true,
  taskApproved: true,
  projectInvite: true,
  mentorRequest: false,
  weeklyDigest: true,
};

const DEFAULT_PRIVACY = {
  publicProfile: true,
  showXP: true,
  showOnLeaderboard: true,
  showEmail: false,
};

const NOTIF_TOGGLES_CONFIG = [
  { key: 'taskAssigned', label: 'Task Assigned', sub: 'When a task is assigned to you' },
  { key: 'taskApproved', label: 'Task Approved', sub: 'When your task gets approved' },
  { key: 'projectInvite', label: 'Project Invite', sub: 'When invited to a project' },
  { key: 'mentorRequest', label: 'Mentor Request', sub: 'When someone requests mentorship' },
  { key: 'weeklyDigest', label: 'Weekly Digest', sub: 'Summary of your activity' },
];

const PRIVACY_TOGGLES_CONFIG = [
  { key: 'publicProfile', label: 'Public Profile', sub: 'Others can view your profile' },
  { key: 'showXP', label: 'Show XP on Profile', sub: 'Display your XP publicly' },
  { key: 'showOnLeaderboard', label: 'Appear on Leaderboard', sub: 'Show in public rankings' },
  { key: 'showEmail', label: 'Show Email Address', sub: 'Make your email visible to project collaborators' },
];

export const Settings = () => {
  const navigate = useNavigate();
  const avatarInputId = useId();
  const { user, logout, updateUser } = useContext(AuthContext);
  const { theme, setTheme } = useContext(UIContext);

  const [activeSection, setActiveSection] = useState('all');
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingNotifs, setSavingNotifs] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [savingAppearance, setSavingAppearance] = useState(false);
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

  // Notifications & Privacy & Appearance states
  const [notifications, setNotifications] = useState(() => {
    try {
      const stored = localStorage.getItem('teamforge.notificationSettings');
      return stored ? { ...DEFAULT_NOTIFICATIONS, ...JSON.parse(stored) } : DEFAULT_NOTIFICATIONS;
    } catch {
      return DEFAULT_NOTIFICATIONS;
    }
  });

  const [privacy, setPrivacy] = useState(() => {
    try {
      const stored = localStorage.getItem('teamforge.privacySettings');
      return stored ? { ...DEFAULT_PRIVACY, ...JSON.parse(stored) } : DEFAULT_PRIVACY;
    } catch {
      return DEFAULT_PRIVACY;
    }
  });

  const [selectedTheme, setSelectedTheme] = useState(theme || 'light');

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

  // Smooth scroll to target section card with visual highlight pulse
  const scrollToSection = (sectionKey, targetId) => {
    setActiveSection(sectionKey);

    if (sectionKey === 'all') {
      const scrollParent = document.querySelector('.app-content') || window;
      if (scrollParent.scrollTo) {
        scrollParent.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }

    const targetEl = document.getElementById(targetId);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      targetEl.classList.remove('section-highlight');
      void targetEl.offsetWidth; // Trigger reflow for CSS animation
      targetEl.classList.add('section-highlight');
      setTimeout(() => {
        targetEl.classList.remove('section-highlight');
      }, 1600);
    }
  };

  // Scroll spy: Update active pill automatically as the user scrolls
  useEffect(() => {
    const sectionIds = [
      { key: 'profile', id: 'settings-section-profile' },
      { key: 'notifications', id: 'settings-section-notifications' },
      { key: 'privacy', id: 'settings-section-privacy' },
      { key: 'appearance', id: 'settings-section-appearance' },
      { key: 'danger', id: 'settings-section-danger' },
    ];

    const scrollContainer = document.querySelector('.app-content');
    if (!scrollContainer) return;

    let isThrottled = false;
    const handleScroll = () => {
      if (isThrottled) return;
      isThrottled = true;
      requestAnimationFrame(() => {
        isThrottled = false;
        if (scrollContainer.scrollTop < 120) {
          setActiveSection('all');
          return;
        }

        const containerRect = scrollContainer.getBoundingClientRect();
        for (let i = sectionIds.length - 1; i >= 0; i--) {
          const el = document.getElementById(sectionIds[i].id);
          if (el) {
            const rect = el.getBoundingClientRect();
            if (rect.top <= containerRect.top + 240) {
              setActiveSection(sectionIds[i].key);
              break;
            }
          }
        }
      });
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Handle URL hash on initial load (e.g. /settings#notifications)
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      const sectionMap = {
        profile: 'settings-section-profile',
        notifications: 'settings-section-notifications',
        privacy: 'settings-section-privacy',
        appearance: 'settings-section-appearance',
        danger: 'settings-section-danger',
        'settings-section-profile': 'settings-section-profile',
        'settings-section-notifications': 'settings-section-notifications',
        'settings-section-privacy': 'settings-section-privacy',
        'settings-section-appearance': 'settings-section-appearance',
        'settings-section-danger': 'settings-section-danger',
      };
      const targetId = sectionMap[hash];
      if (targetId) {
        setTimeout(() => {
          scrollToSection(hash.replace('settings-section-', ''), targetId);
        }, 300);
      }
    }
  }, []);


  // Initial load & Hydration from backend / localStorage
  useEffect(() => {
    let ignore = false;
    const hydrateSettings = async () => {
      try {
        const userId = localStorage.getItem('teamforge.backendUserId') || user?.id || '1';
        let backendUser = null;

        try {
          backendUser = await usersApi.get(userId);
        } catch (apiErr) {
          console.warn('Backend unavailable, hydrating settings from local storage/context:', apiErr);
        }

        if (ignore) return;

        let localProfile = {};
        try {
          const stored = localStorage.getItem('teamforge.userProfile');
          if (stored) localProfile = JSON.parse(stored);
        } catch {
          // ignore parsing error
        }

        const currentName =
          localProfile?.fullName ||
          user?.name ||
          user?.profile?.fullName ||
          backendUser?.name ||
          backendUser?.profile?.fullName ||
          'User';
        const currentUsername =
          localProfile?.username ||
          user?.username ||
          user?.profile?.username ||
          backendUser?.profile?.username ||
          (currentName.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'user');
        const currentBio =
          localProfile?.bio ||
          backendUser?.profile?.bio ||
          user?.bio ||
          'Full-stack Developer · IIT Delhi';
        const currentPhone =
          localProfile?.phone ||
          backendUser?.phone ||
          backendUser?.profile?.phone ||
          user?.phone ||
          '9876543210';
        const currentLinkedin =
          localProfile?.linkedin ||
          backendUser?.linkedIn ||
          backendUser?.profile?.linkedin ||
          user?.linkedIn ||
          'https://linkedin.com/in/yourprofile';
        const currentSkills =
          localProfile?.skills ||
          backendUser?.profile?.skills ||
          user?.skills ||
          ['React', 'Python', 'Machine Learning'];
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

        if (backendUser?.profile?.notificationSettings) {
          setNotifications(prev => ({ ...prev, ...backendUser.profile.notificationSettings }));
        }
        if (backendUser?.profile?.privacySettings) {
          setPrivacy(prev => ({ ...prev, ...backendUser.profile.privacySettings }));
        }

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

    setErrors(newErrors);
    if (hasError) {
      showToast('Please fix the errors in the profile form', 'error');
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
      const userId = localStorage.getItem('teamforge.backendUserId') || user?.id || '1';
      let backendUpdatedUser = null;
      try {
        backendUpdatedUser = await usersApi.update(
          userId,
          {
            name: cleanedName,
            phone: cleanedPhone,
            linkedIn: cleanedLinkedin,
            avatarUrl: finalAvatarUrl,
            profile: updatedProfilePayload,
          },
          'Administrator'
        );
      } catch (apiErr) {
        console.warn('Backend unavailable for profile update, persisting locally.', apiErr);
      }

      // 4. Update Local Storage & Context
      localStorage.setItem('teamforge.userProfile', JSON.stringify(updatedProfilePayload));

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

  // Notification Save
  const handleSaveNotifications = async () => {
    setSavingNotifs(true);
    try {
      localStorage.setItem('teamforge.notificationSettings', JSON.stringify(notifications));

      const userId = localStorage.getItem('teamforge.backendUserId') || user?.id || '1';
      try {
        await usersApi.update(userId, {
          profile: {
            notificationSettings: notifications,
          },
        });
      } catch {
        // Backend optional fallback
      }

      showToast('Notification settings saved');
    } catch (err) {
      console.error('Failed to save notification settings:', err);
      showToast('Failed to save notification settings', 'error');
    } finally {
      setSavingNotifs(false);
    }
  };

  // Privacy Save
  const handleSavePrivacy = async () => {
    setSavingPrivacy(true);
    try {
      localStorage.setItem('teamforge.privacySettings', JSON.stringify(privacy));

      const userId = localStorage.getItem('teamforge.backendUserId') || user?.id || '1';
      try {
        await usersApi.update(userId, {
          profile: {
            privacySettings: privacy,
          },
        });
      } catch {
        // Backend optional fallback
      }

      showToast('Privacy settings saved');
    } catch (err) {
      console.error('Failed to save privacy settings:', err);
      showToast('Failed to save privacy settings', 'error');
    } finally {
      setSavingPrivacy(false);
    }
  };

  // Appearance Save
  const handleSaveAppearance = () => {
    setSavingAppearance(true);
    try {
      if (setTheme) {
        setTheme(selectedTheme);
      } else {
        localStorage.setItem('teamforge.theme', selectedTheme);
        document.documentElement.setAttribute('data-theme', selectedTheme);
      }
      showToast('Appearance saved');
    } catch (err) {
      console.error('Failed to save appearance:', err);
      showToast('Failed to save appearance', 'error');
    } finally {
      setSavingAppearance(false);
    }
  };

  // Delete Account
  const handleConfirmDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      const userId = localStorage.getItem('teamforge.backendUserId') || user?.id || '1';
      try {
        await usersApi.remove(userId);
      } catch (apiErr) {
        console.warn('Backend delete returned warning:', apiErr);
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
      {/* Navigation Quick Pills (directly below Navbar) */}
      <div className="settings-nav-pills">
        <button
          type="button"
          className={`settings-nav-pill ${activeSection === 'all' ? 'active' : ''}`}
          onClick={() => scrollToSection('all', 'page-settings')}
        >
          All Settings
        </button>
        <button
          type="button"
          className={`settings-nav-pill ${activeSection === 'profile' ? 'active' : ''}`}
          onClick={() => scrollToSection('profile', 'settings-section-profile')}
        >
          👤 Profile
        </button>
        <button
          type="button"
          className={`settings-nav-pill ${activeSection === 'notifications' ? 'active' : ''}`}
          onClick={() => scrollToSection('notifications', 'settings-section-notifications')}
        >
          🔔 Notifications
        </button>
        <button
          type="button"
          className={`settings-nav-pill ${activeSection === 'privacy' ? 'active' : ''}`}
          onClick={() => scrollToSection('privacy', 'settings-section-privacy')}
        >
          👁️ Privacy
        </button>
        <button
          type="button"
          className={`settings-nav-pill ${activeSection === 'appearance' ? 'active' : ''}`}
          onClick={() => scrollToSection('appearance', 'settings-section-appearance')}
        >
          🎨 Appearance
        </button>
        <button
          type="button"
          className={`settings-nav-pill ${activeSection === 'danger' ? 'active' : ''}`}
          onClick={() => scrollToSection('danger', 'settings-section-danger')}
        >
          🗑️ Danger Zone
        </button>
      </div>

      {/* Header */}
      <div className="settings-header">
        <div className="settings-header-top">
          <div>
            <h1 className="settings-title">Settings</h1>
            <p className="settings-subtitle">Manage your account preferences and privacy.</p>
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

          {/* Avatar Upload */}
          <div className="settings-form-group">
            <label className="settings-label" htmlFor={avatarInputId}>Avatar Upload</label>
            <div className="settings-avatar-wrapper">
              <div className="settings-avatar-box">
                {displayAvatar ? (
                  <img
                    id="settings-avatar-preview"
                    src={displayAvatar}
                    alt="Avatar Preview"
                    className="settings-avatar-img"
                  />
                ) : (
                  <div id="settings-avatar-initials" className="settings-avatar-initials">
                    {initials}
                  </div>
                )}
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
            <div className="settings-form-group">
              <label className="settings-label" htmlFor="settings-full-name">
                Full Name <span className="settings-label-sub">(Required)</span>
              </label>
              <input
                id="settings-full-name"
                name="fullName"
                type="text"
                className="settings-input"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: '' }));
                }}
                aria-invalid={Boolean(errors.fullName)}
                placeholder="e.g. Alex Morgan"
              />
              {errors.fullName && <div className="settings-field-error">⚠️ {errors.fullName}</div>}
            </div>

            <div className="settings-form-group">
              <label className="settings-label" htmlFor="settings-username">
                Username <span className="settings-label-sub">(Unique handle)</span>
              </label>
              <input
                id="settings-username"
                name="username"
                type="text"
                className="settings-input"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (errors.username) setErrors((prev) => ({ ...prev, username: '' }));
                }}
                aria-invalid={Boolean(errors.username)}
                placeholder="e.g. alexmorgan"
              />
              {errors.username && <div className="settings-field-error">⚠️ {errors.username}</div>}
            </div>
          </div>

          {/* Bio */}
          <div className="settings-form-group">
            <label className="settings-label" htmlFor="settings-bio">
              Bio <span className="settings-label-sub">(10 - 180 characters)</span>
            </label>
            <textarea
              id="settings-bio"
              name="bio"
              rows={3}
              className="settings-textarea"
              value={bio}
              onChange={(e) => {
                setBio(e.target.value);
                if (errors.bio) setErrors((prev) => ({ ...prev, bio: '' }));
              }}
              aria-invalid={Boolean(errors.bio)}
              placeholder="e.g. Full-stack Developer · IIT Delhi"
            />
            <div className="settings-input-char-count">{bio.length} / 180 chars</div>
            {errors.bio && <div className="settings-field-error">⚠️ {errors.bio}</div>}
          </div>

          {/* Phone & LinkedIn Grid */}
          <div className="settings-form-grid">
            <div className="settings-form-group">
              <label className="settings-label" htmlFor="settings-phone">
                Phone Number <span className="settings-label-sub">(Indian 10-digit)</span>
              </label>
              <input
                id="settings-phone"
                name="phone"
                type="tel"
                className="settings-input"
                placeholder="9876543210"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' }));
                }}
                aria-invalid={Boolean(errors.phone)}
              />
              {errors.phone ? (
                <div id="settings-phone-error" className="settings-field-error">
                  ⚠️ {errors.phone}
                </div>
              ) : (
                <div id="settings-phone-error" className="settings-field-error" style={{ display: 'none' }}></div>
              )}
            </div>

            <div className="settings-form-group">
              <label className="settings-label" htmlFor="settings-linkedin">
                LinkedIn Profile URL
              </label>
              <input
                id="settings-linkedin"
                name="linkedin"
                type="url"
                className="settings-input"
                placeholder="https://linkedin.com/in/yourprofile"
                value={linkedin}
                onChange={(e) => {
                  setLinkedin(e.target.value);
                  if (errors.linkedin) setErrors((prev) => ({ ...prev, linkedin: '' }));
                }}
                aria-invalid={Boolean(errors.linkedin)}
              />
              {errors.linkedin && <div className="settings-field-error">⚠️ {errors.linkedin}</div>}
            </div>
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

      {/* ═══════════ CARD 2: NOTIFICATIONS ═══════════ */}
      <div className="settings-card" id="settings-section-notifications">
          <div className="settings-section-header">
            <div className="settings-icon-badge">
              <BellIcon />
            </div>
            <div>
              <h2 className="settings-section-title">Notifications</h2>
              <p className="settings-section-desc">Choose what updates you receive.</p>
            </div>
          </div>

          <div id="notif-toggles" className="settings-toggles-list">
            {NOTIF_TOGGLES_CONFIG.map(({ key, label, sub }) => (
              <div key={key} className="settings-toggle-row">
                <div className="settings-toggle-text">
                  <div className="settings-toggle-label">{label}</div>
                  <div className="settings-toggle-sub">{sub}</div>
                </div>
                <label className="settings-toggle-switch">
                  <input
                    type="checkbox"
                    className="settings-toggle-input"
                    checked={Boolean(notifications[key])}
                    onChange={(e) =>
                      setNotifications((prev) => ({ ...prev, [key]: e.target.checked }))
                    }
                  />
                  <span className="settings-toggle-track"></span>
                  <span className="settings-toggle-thumb"></span>
                </label>
              </div>
            ))}
          </div>

          <div className="settings-btn-row">
            <button
              id="save-notifications-btn"
              type="button"
              className="settings-btn-primary"
              disabled={savingNotifs}
              onClick={handleSaveNotifications}
            >
              {savingNotifs ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

      {/* ═══════════ CARD 3: PRIVACY ═══════════ */}
      <div className="settings-card" id="settings-section-privacy">
          <div className="settings-section-header">
            <div className="settings-icon-badge">
              <EyeIcon />
            </div>
            <div>
              <h2 className="settings-section-title">Privacy</h2>
              <p className="settings-section-desc">Control what others can see.</p>
            </div>
          </div>

          <div id="privacy-toggles" className="settings-toggles-list">
            {PRIVACY_TOGGLES_CONFIG.map(({ key, label, sub }) => (
              <div key={key} className="settings-toggle-row">
                <div className="settings-toggle-text">
                  <div className="settings-toggle-label">{label}</div>
                  <div className="settings-toggle-sub">{sub}</div>
                </div>
                <label className="settings-toggle-switch">
                  <input
                    type="checkbox"
                    className="settings-toggle-input"
                    checked={Boolean(privacy[key])}
                    onChange={(e) =>
                      setPrivacy((prev) => ({ ...prev, [key]: e.target.checked }))
                    }
                  />
                  <span className="settings-toggle-track"></span>
                  <span className="settings-toggle-thumb"></span>
                </label>
              </div>
            ))}
          </div>

          <div className="settings-btn-row">
            <button
              id="save-privacy-btn"
              type="button"
              className="settings-btn-primary"
              disabled={savingPrivacy}
              onClick={handleSavePrivacy}
            >
              {savingPrivacy ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

      {/* ═══════════ CARD 4: APPEARANCE ═══════════ */}
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
              className={`settings-theme-option ${selectedTheme === 'light' ? 'selected' : ''}`}
              onClick={() => {
                setSelectedTheme('light');
                if (setTheme) setTheme('light');
              }}
            >
              <div className="settings-theme-icon">☀️</div>
              <div>
                <h3 className="settings-theme-title">Light Theme</h3>
                <p className="settings-theme-desc">Warm, modern, and clean aesthetic.</p>
              </div>
            </div>

            <div
              className={`settings-theme-option ${selectedTheme === 'dark' ? 'selected' : ''}`}
              onClick={() => {
                setSelectedTheme('dark');
                if (setTheme) setTheme('dark');
              }}
            >
              <div className="settings-theme-icon">🌙</div>
              <div>
                <h3 className="settings-theme-title">Dark Theme</h3>
                <p className="settings-theme-desc">Sleek, deep contrast for low-light environments.</p>
              </div>
            </div>
          </div>

          <div className="settings-form-group" style={{ maxWidth: '260px' }}>
            <label className="settings-label" htmlFor="theme-select">
              Select Mode
            </label>
            <select
              id="theme-select"
              className="settings-select"
              value={selectedTheme}
              onChange={(e) => {
                const newMode = e.target.value;
                setSelectedTheme(newMode);
                if (setTheme) setTheme(newMode);
              }}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>

          <div className="settings-btn-row">
            <button
              id="save-appearance-btn"
              type="button"
              className="settings-btn-primary"
              disabled={savingAppearance}
              onClick={handleSaveAppearance}
            >
              {savingAppearance ? 'Saving...' : 'Save'}
            </button>
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
      {isDeleteModalOpen && (
        <div className="settings-modal-overlay">
          <div className="settings-modal-box">
            <h3 className="settings-modal-title">
              <TrashIcon /> Confirm Account Deletion
            </h3>
            <p className="settings-modal-body">
              Are you sure you want to delete your TeamForge account? This action is permanent and cannot be undone.
              All your records, task submissions, and project associations will be removed.
            </p>
            <div className="settings-modal-actions">
              <button
                type="button"
                className="settings-btn-secondary"
                disabled={deletingAccount}
                onClick={() => setIsDeleteModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="settings-btn-destructive"
                disabled={deletingAccount}
                onClick={handleConfirmDeleteAccount}
              >
                {deletingAccount ? 'Deleting...' : 'Yes, Delete My Account'}
              </button>
            </div>
          </div>
        </div>
      )}

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
