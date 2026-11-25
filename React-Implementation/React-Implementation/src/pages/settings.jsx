import { useState, useEffect, useContext, useRef, useId, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { UIContext } from '../context/UIContext';
import usersApi from '../services/usersApi';
import uploadsApi from '../services/uploadsApi';
import { resolveApiBaseUrl } from '../services/apiClient';
import FormInput from '../components/common/FormInput';
import Avatar from '../components/common/Avatar';
import Badge from '../components/common/Badge';
import Modal from '../components/common/Modal';
import { RecaptchaVerifier, signInWithPhoneNumber, updateProfile } from 'firebase/auth';
import { phoneVerifyAuth, auth } from '../services/firebase';
import storage from '../utils/storage';
import './settings.css';

const INDIAN_PHONE_RE = /^[6-9]\d{9}$/;
const SKILL_RE = /^[a-zA-Z0-9+#.\-\s]+$/;
const UNIVERSITY_RE = /^[a-zA-Z0-9\s.,&\-'()]+$/;

const SUGGESTED_UNIVERSITIES = [
  'IIT Bombay',
  'IIT Delhi',
  'IIT Madras',
  'BITS Pilani',
  'VIT Vellore',
  'Anna University',
  'Indian Institute of Science, Bangalore',
  'Stanford University',
  'MIT',
  'Harvard University',
];

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
  const avatarInputId = useId();
  const navigate = useNavigate();
  const { user, updateUser, refreshUser, logout } = useContext(AuthContext);
  const { theme, setTheme } = useContext(UIContext);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);

  // Notification digest state (Phase 18)
  const [digestEnabled, setDigestEnabled] = useState(true);
  const [digestHour, setDigestHour] = useState(9);
  const [utcOffsetMinutes] = useState(() => -new Date().getTimezoneOffset());
  const [savingDigest, setSavingDigest] = useState(false);

  // Data export state (Phase 18)
  const [exportState, setExportState] = useState(null);
  const [requestingExport, setRequestingExport] = useState(false);
  const [downloadingExport, setDownloadingExport] = useState(false);
  const [exportError, setExportError] = useState('');

  // Account deletion state (Phase 18 / Part 2: Active tasks & obligations guards)
  const [deleteUsernameConfirm, setDeleteUsernameConfirm] = useState('');
  const [isDeleteConfirmModalOpen, setIsDeleteConfirmModalOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState('');
  const [deleteObligations, setDeleteObligations] = useState([]);
  const [deleteTaskBlockers, setDeleteTaskBlockers] = useState([]);
  const [deletionCheck, setDeletionCheck] = useState(null);
  const [checkingDeletionEligibility, setCheckingDeletionEligibility] = useState(false);

  // Profile State
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [savedEmail, setSavedEmail] = useState('');
  const [profileError, setProfileError] = useState('');
  const [emailVerifyNotice, setEmailVerifyNotice] = useState('');
  const [bio, setBio] = useState('');
  const [university, setUniversity] = useState('');
  const [phone, setPhone] = useState('');
  const [savedPhone, setSavedPhone] = useState('');
  const [savedPhoneVerified, setSavedPhoneVerified] = useState(false);
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const phoneInputRef = useRef(null);

  // Phone OTP Verification Modal State (Phase 3)
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const [otpStep, setOtpStep] = useState(1);
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [otpLockSeconds, setOtpLockSeconds] = useState(0);
  const confirmationResultRef = useRef(null);
  const recaptchaVerifierRef = useRef(null);
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
    email: '',
    bio: '',
    university: '',
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

  const fetchDeletionEligibility = useCallback(async () => {
    if (!user) return;
    setCheckingDeletionEligibility(true);
    try {
      const res = await usersApi.checkDeletionEligibility();
      setDeletionCheck(res);
    } catch (err) {
      console.warn('[settings] Failed to check deletion eligibility:', err);
    } finally {
      setCheckingDeletionEligibility(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDeletionEligibility();
  }, [fetchDeletionEligibility]);

  // Handle URL hash on initial load (e.g. /settings#appearance)
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      const sectionMap = {
        profile: 'settings-section-profile',
        appearance: 'settings-section-appearance',
        'settings-section-profile': 'settings-section-profile',
        'settings-section-appearance': 'settings-section-appearance',
      };
      const targetId = sectionMap[hash];
      if (targetId) {
        const timerId = setTimeout(() => {
          document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
        return () => clearTimeout(timerId);
      }
    }
  }, []);

  // Initial load & hydration strictly from backend API / AuthContext
  useEffect(() => {
    let ignore = false;
    const hydrateSettings = async () => {
      try {
        const userId = user?.id || storage.getBackendUserId() || '';
        let backendUser = null;

        if (userId) {
          try {
            backendUser = await usersApi.getMe();
          } catch (apiErr) {
            console.warn('Could not load backend user for settings, falling back to AuthContext:', apiErr);
          }
          try {
            if (typeof usersApi.getSettings === 'function') {
              const digestCfg = await usersApi.getSettings();
              if (!ignore && digestCfg) {
                setDigestEnabled(digestCfg.digestEnabled !== false);
                if (Number.isInteger(digestCfg.digestHour)) setDigestHour(digestCfg.digestHour);
              }
            }
            if (typeof usersApi.listExports === 'function') {
              const expList = await usersApi.listExports();
              if (!ignore && Array.isArray(expList) && expList.length > 0) {
                setExportState(expList[0]);
              }
            }
          } catch (subErr) {
            console.warn('[settings] Non-critical settings hydration notice:', subErr);
          }
        }

        if (ignore) return;

        const currentName =
          backendUser?.name ||
          backendUser?.profile?.fullName ||
          user?.name ||
          user?.profile?.fullName ||
          '';
        const currentUsername =
          backendUser?.username ||
          backendUser?.profile?.username ||
          user?.username ||
          user?.profile?.username ||
          (currentName ? currentName.toLowerCase().replace(/[^a-z0-9]+/g, '') : '');
        const currentBio =
          backendUser?.profile?.bio ||
          backendUser?.bio ||
          user?.bio ||
          '';
        const currentPhone =
          backendUser?.phone ||
          backendUser?.profile?.phone ||
          user?.phone ||
          user?.profile?.phone ||
          '';
        const isVerified = Boolean(
          backendUser?.phoneVerified ??
          backendUser?.profile?.phoneVerified ??
          user?.phoneVerified ??
          user?.profile?.phoneVerified
        );
        const phoneDigits = currentPhone.replace(/^\+91/, '').trim();
        setPhone(phoneDigits);
        setSavedPhone(currentPhone ? (currentPhone.startsWith('+91') ? currentPhone : `+91${phoneDigits}`) : '');
        setSavedPhoneVerified(isVerified);
        setIsPhoneVerified(isVerified && Boolean(phoneDigits));
        const currentLinkedin =
          backendUser?.linkedIn ||
          backendUser?.profile?.linkedin ||
          user?.linkedIn ||
          '';
        const currentSkills =
          backendUser?.profile?.skills ||
          backendUser?.skills ||
          user?.skills ||
          [];
        const currentAvatar =
          backendUser?.profile?.avatarUrl ||
          backendUser?.avatarUrl ||
          user?.avatarUrl ||
          user?.profile?.avatarUrl ||
          '';

        const currentEmail =
          backendUser?.email ||
          user?.email ||
          '';
        setFullName(currentName);
        setUsername(currentUsername);
        setEmail(currentEmail);
        setSavedEmail(currentEmail);
        setBio(currentBio);
        const currentUni =
          backendUser?.university ||
          backendUser?.profile?.university ||
          backendUser?.profile?.uni ||
          user?.university ||
          user?.profile?.university ||
          user?.profile?.uni ||
          '';
        setUniversity(currentUni);
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

  // Cleanup reCAPTCHA on unmount (Phase 3)
  useEffect(() => {
    return () => {
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
        } catch (err) {
          console.warn("[settings] Error clearing recaptchaVerifier on unmount:", err);
        }
        recaptchaVerifierRef.current = null;
      }
    };
  }, []);

  // Resend OTP countdown timer
  useEffect(() => {
    let timer = null;
    if (isOtpModalOpen && otpStep === 2 && resendTimer > 0) {
      timer = setInterval(() => {
        setResendTimer((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isOtpModalOpen, otpStep, resendTimer]);

  // Phase 16: 15-minute OTP lockout countdown timer
  useEffect(() => {
    if (!isOtpModalOpen || otpLockSeconds <= 0) return;
    const timer = setInterval(() => {
      setOtpLockSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [isOtpModalOpen, otpLockSeconds]);

  const handlePhoneChange = (e) => {
    const val = e.target.value.replace(/[^\d+]/g, '');
    setPhone(val);
    if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' }));

    const rawInputDigits = val.replace(/^\+91/, '').trim();
    const rawSavedDigits = (savedPhone || '').replace(/^\+91/, '').trim();

    if (rawInputDigits !== rawSavedDigits) {
      setIsPhoneVerified(false);
    } else if (rawInputDigits === rawSavedDigits && savedPhoneVerified) {
      setIsPhoneVerified(true);
    }
  };

  const getFriendlyErrorMessage = (err) => {
    const code = err?.code || '';
    const msg = String(err?.message || '').toLowerCase();
    if (code === 'auth/invalid-phone-number' || msg.includes('invalid-phone')) {
      return 'Please enter a valid phone number in E.164 format (+91XXXXXXXXXX).';
    }
    if (code === 'auth/invalid-verification-code' || msg.includes('invalid-verification-code')) {
      return 'Invalid verification code. Please check the code and try again.';
    }
    if (code === 'auth/code-expired' || msg.includes('code-expired')) {
      return 'The verification code has expired. Please request a new code.';
    }
    if (code === 'auth/session-expired' || msg.includes('session-expired')) {
      return 'Verification session expired. Please request a new code.';
    }
    if (code === 'auth/quota-exceeded' || msg.includes('quota-exceeded') || msg.includes('quota exceeded')) {
      return 'Daily SMS limit reached on this Firebase plan; use a test number.';
    }
    if (code === 'auth/too-many-requests' || msg.includes('too-many-requests')) {
      return 'Too many requests. Please wait a few moments before trying again.';
    }
    if (code === 'auth/captcha-check-failed' || msg.includes('captcha')) {
      return 'reCAPTCHA verification failed. Please try again.';
    }
    if (code === 'auth/network-request-failed' || msg.includes('network')) {
      return 'Network error. Please check your internet connection.';
    }
    if (code === 'auth/sms-region-not-allowed' || msg.includes('region')) {
      return 'SMS delivery is not supported for this region on the Firebase free plan. To test without real SMS charges, add this number in Firebase Console (Authentication > Sign-in method > Phone > Phone numbers for testing) with a fixed code (e.g. 123456), or enable India (+91) under Authentication > Settings > SMS Region Policy.';
    }
    if (err?.status === 503 || msg.includes('not configured')) {
      return 'Phone verification is not configured on the server.';
    }
    if (err?.status === 409 || msg.includes('already linked')) {
      return 'This phone number is already linked to another account.';
    }
    if (err?.status === 429 || msg.includes('too many verification attempts')) {
      return 'Too many verification attempts. Please wait an hour before trying again.';
    }
    return err?.message || 'Verification failed. Please try again.';
  };

  const formatLockCountdown = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}m ${String(s).padStart(2, '0')}s`;
  };

  const handleOpenOtpModal = () => {
    const digits = phone.replace(/^\+91/, '').trim();
    if (!INDIAN_PHONE_RE.test(digits)) {
      setErrors((prev) => ({ ...prev, phone: 'Enter a valid 10-digit Indian phone number to verify.' }));
      return;
    }
    setOtpStep(1);
    setOtpCode('');
    setOtpError('');
    setWrongAttempts(0);
    setResendTimer(0);
    setOtpLockSeconds(0);
    setIsOtpModalOpen(true);

    usersApi
      .getPhoneOtpStatus()
      .then((status) => {
        if (!status) return;
        if (status.locked) {
          const secs = Number(status.remainingSeconds) || 900;
          setWrongAttempts(Number(status.wrongAttempts) || 5);
          setOtpLockSeconds(secs);
          setOtpError('Too many incorrect OTP attempts. Please wait until the lockout expires.');
        } else if (Number(status.wrongAttempts) > 0) {
          setWrongAttempts(Number(status.wrongAttempts));
        }
      })
      .catch(() => {});
  };

  const handleCloseOtpModal = () => {
    setIsOtpModalOpen(false);
    setOtpStep(1);
    setOtpCode('');
    setOtpError('');
    setWrongAttempts(0);
    setResendTimer(0);
    setOtpLockSeconds(0);
    confirmationResultRef.current = null;
    if (recaptchaVerifierRef.current) {
      try {
        recaptchaVerifierRef.current.clear();
      } catch (err) {
        console.warn("[settings] Error clearing recaptchaVerifier on cancel:", err);
      }
      recaptchaVerifierRef.current = null;
    }
  };

  const handleSendOtp = async () => {
    setOtpSending(true);
    setOtpError('');
    try {
      if (!phoneVerifyAuth) {
        throw new Error('Phone verification is not configured');
      }
      const cleanDigits = phone.replace(/^\+91/, '').trim();
      const e164 = `+91${cleanDigits}`;

      if (!recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current = new RecaptchaVerifier(
          phoneVerifyAuth,
          'recaptcha-container',
          {
            size: 'invisible',
            callback: () => {
              // reCAPTCHA solved
            },
            'expired-callback': () => {
              setOtpError('reCAPTCHA expired. Please try again.');
            },
          }
        );
        await recaptchaVerifierRef.current.render();
      }

      const confirmation = await signInWithPhoneNumber(phoneVerifyAuth, e164, recaptchaVerifierRef.current);
      confirmationResultRef.current = confirmation;
      setOtpStep(2);
      setOtpCode('');
      setWrongAttempts(0);
      setResendTimer(30);
    } catch (err) {
      console.error('[Phone Verification Send Error]', err?.code || err?.message);
      const friendly = getFriendlyErrorMessage(err);
      setOtpError(friendly);
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
        } catch (err2) {
          console.warn("[settings] Error clearing recaptchaVerifier on error:", err2);
        }
        recaptchaVerifierRef.current = null;
      }
    } finally {
      setOtpSending(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0 || otpSending) return;
    setWrongAttempts(0);
    setOtpError('');
    await handleSendOtp();
  };

  const handleOtpCodeChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
    setOtpCode(digits);
    if (otpError) setOtpError('');
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    const digits = (pasted.match(/\d/g) || []).join('').slice(0, 6);
    if (digits) {
      setOtpCode(digits);
      if (otpError) setOtpError('');
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6 || otpVerifying || wrongAttempts >= 5 || otpLockSeconds > 0) return;
    setOtpVerifying(true);
    setOtpError('');

    try {
      if (!confirmationResultRef.current) {
        throw new Error('Verification session expired. Please request a new code.');
      }

      const userCredential = await confirmationResultRef.current.confirm(otpCode);
      const idToken = await userCredential.user.getIdToken();

      // Immediately sign out of isolated phone-verify instance
      try {
        await phoneVerifyAuth.signOut();
      } catch (err) {
        console.warn("[settings] Error signing out isolated phoneVerifyAuth:", err);
      }

      // Send to our backend
      const updatedUser = await usersApi.verifyPhone(idToken);

      const cleanDigits = phone.replace(/^\+91/, '').trim();
      const verifiedPhoneE164 = `+91${cleanDigits}`;
      setSavedPhone(verifiedPhoneE164);
      setSavedPhoneVerified(true);
      setIsPhoneVerified(true);
      setPhone(cleanDigits);

      if (updateUser) {
        updateUser({
          ...user,
          phone: verifiedPhoneE164,
          phoneVerified: true,
          phoneVerifiedAt: updatedUser?.phoneVerifiedAt || new Date().toISOString(),
          profile: {
            ...(user?.profile || {}),
            phone: verifiedPhoneE164,
            phoneVerified: true,
            phoneVerifiedAt: updatedUser?.phoneVerifiedAt || new Date().toISOString(),
          },
        });
      }

      showToast('Phone number verified successfully!', 'success');
      if (typeof refreshUser === 'function') {
        await refreshUser().catch(() => {});
      }
      handleCloseOtpModal();
    } catch (err) {
      console.error('[Phone Verification Confirm Error]', err?.code || err?.message || err?.status);
      const serverCode = err?.code || err?.data?.code;
      if (serverCode === 'OTP_LOCKED') {
        const secs = Number(err?.cooldownSeconds || err?.data?.cooldownSeconds) || 900;
        setWrongAttempts(5);
        setOtpLockSeconds(secs);
        setOtpError(err?.message || 'Too many wrong OTP attempts. Verification locked for 15 minutes.');
        return;
      }

      let nextWrong = wrongAttempts + 1;
      try {
        await usersApi.recordFailedOtpAttempt();
      } catch (recErr) {
        const recCode = recErr?.code || recErr?.data?.code;
        if (recCode === 'OTP_LOCKED') {
          const secs = Number(recErr?.cooldownSeconds || recErr?.data?.cooldownSeconds) || 900;
          setWrongAttempts(5);
          setOtpLockSeconds(secs);
          setOtpError(recErr?.message || 'Too many wrong OTP attempts. Verification locked for 15 minutes.');
          return;
        }
        if (typeof recErr?.wrongAttempts === 'number') {
          nextWrong = recErr.wrongAttempts;
        }
      }

      setWrongAttempts(nextWrong);
      if (nextWrong >= 5) {
        setOtpLockSeconds((prev) => (prev > 0 ? prev : 900));
        setOtpError('Too many wrong attempts (5/5). Code is void and verification is locked for 15 minutes.');
      } else {
        const friendly = getFriendlyErrorMessage(err);
        setOtpError(friendly);
      }
    } finally {
      setOtpVerifying(false);
    }
  };

  // Handle Avatar selection
  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, avatar: 'Avatar file size must be less than 2MB' }));
      showToast('Avatar file size must be less than 2MB', 'error');
      e.target.value = '';
      return;
    }

    const allowedMimes = ['image/png', 'image/jpeg', 'image/webp'];
    const lowerName = String(file.name || '').toLowerCase();
    const hasAllowedExt =
      lowerName.endsWith('.png') ||
      lowerName.endsWith('.jpg') ||
      lowerName.endsWith('.jpeg') ||
      lowerName.endsWith('.webp');
    const isSvg = lowerName.endsWith('.svg') || file.type === 'image/svg+xml';

    if (isSvg || !allowedMimes.includes(file.type) || !hasAllowedExt) {
      const msg = 'Unsupported file type. Allowed formats: PNG, JPG, JPEG, WEBP.';
      setErrors((prev) => ({ ...prev, avatar: msg }));
      showToast(msg, 'error');
      e.target.value = '';
      return;
    }

    setErrors((prev) => ({ ...prev, avatar: '' }));
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
    setProfileError('');
    setEmailVerifyNotice('');
    const cleanedName = fullName.trim().replace(/\s+/g, ' ');
    const cleanedUsername = username.trim();
    const cleanedEmail = email.trim().toLowerCase();
    const cleanedBio = bio.trim();
    const cleanedUniversity = university.trim();
    const cleanedPhone = phone.trim();
    const cleanedLinkedin = linkedin.trim();

    const newErrors = {
      fullName: '',
      username: '',
      email: '',
      bio: '',
      university: '',
      phone: '',
      linkedin: '',
      skill: '',
    };
    let hasError = false;

    if (cleanedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanedEmail)) {
      newErrors.email = 'Enter a valid email address';
      hasError = true;
    }

    // Full name validation
    if (!cleanedName) {
      newErrors.fullName = 'Full name is required';
      hasError = true;
    } else if (cleanedName.length < 2 || cleanedName.length > 60) {
      newErrors.fullName = 'Full name must be 2 to 60 characters';
      hasError = true;
    }

    // Username is permanent once chosen at profile completion; non-editable
    if (!cleanedUsername) {
      newErrors.username = 'Username is required';
      hasError = true;
    }

    // Bio validation
    if (cleanedBio && (cleanedBio.length < 10 || cleanedBio.length > 180)) {
      newErrors.bio = 'Bio must be 10 to 180 characters when provided';
      hasError = true;
    }

    // University validation
    if (cleanedUniversity) {
      if (cleanedUniversity.length < 2 || cleanedUniversity.length > 100) {
        newErrors.university = 'University must be between 2 and 100 characters';
        hasError = true;
      } else if (!UNIVERSITY_RE.test(cleanedUniversity)) {
        newErrors.university = "University contains invalid characters. Use letters, numbers, spaces, and common punctuation (. , & - ' ( ))";
        hasError = true;
      }
    }

    // Phone validation
    const cleanPhoneDigits = cleanedPhone.replace(/^\+91/, '').trim();
    const cleanSavedDigits = (savedPhone || '').replace(/^\+91/, '').trim();
    const phoneChanged = cleanPhoneDigits !== cleanSavedDigits;

    if (cleanPhoneDigits && !INDIAN_PHONE_RE.test(cleanPhoneDigits)) {
      newErrors.phone = 'Enter a valid Indian phone number.';
      hasError = true;
    } else if (cleanPhoneDigits && phoneChanged && !isPhoneVerified) {
      newErrors.phone = 'Verify your new phone number to save it';
      hasError = true;
    }

    // LinkedIn validation
    if (cleanedLinkedin) {
      if (cleanedLinkedin.length > 2048) {
        newErrors.linkedin = 'URL must not exceed 2048 characters';
        hasError = true;
      } else {
        try {
          const parsed = new URL(cleanedLinkedin);
          if (
            !(parsed.protocol === 'https:' || parsed.protocol === 'http:') ||
            !parsed.hostname ||
            !/linkedin\.com$/i.test(parsed.hostname.replace(/^www\./i, ''))
          ) {
            newErrors.linkedin = 'LinkedIn URL must be on linkedin.com';
            hasError = true;
          }
        } catch (err) {
          console.warn("[settings] LinkedIn URL parse error:", err);
          newErrors.linkedin = 'Enter a valid LinkedIn URL (starting with http:// or https://)';
          hasError = true;
        }
      }
    }

    // Check username availability with backend before proceeding (only if no existing username)
    const userId = user?.id || storage.getBackendUserId() || '';
    if (!newErrors.username && cleanedUsername && !user?.username) {
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
          if (uploadErr?.code === 'UNSUPPORTED_FILE_TYPE' || uploadErr?.statusCode === 400) {
            const msg = uploadErr?.serverMessage || uploadErr?.message || 'Unsupported file type. Allowed formats: PNG, JPG, JPEG, WEBP.';
            setErrors((prev) => ({ ...prev, avatar: msg }));
            showToast(msg, 'error');
            setSavingProfile(false);
            return;
          }
          console.warn('Avatar upload failed, falling back to local preview:', uploadErr);
          showToast('Avatar upload failed. Server unavailable.', 'error');
        }
      }

      // Remove phone if user cleared it
      if (!cleanPhoneDigits && cleanSavedDigits) {
        try {
          await usersApi.deletePhone();
          setSavedPhone('');
          setSavedPhoneVerified(false);
          setIsPhoneVerified(false);
        } catch (delErr) {
          console.warn('Could not remove phone on backend:', delErr);
        }
      }

      const finalPhone = cleanPhoneDigits ? (savedPhone || `+91${cleanPhoneDigits}`) : '';
      const emailChanged = Boolean(
        cleanedEmail && cleanedEmail !== (savedEmail || '').trim().toLowerCase(),
      );

      // 2. Prepare allow-listed SelfUpdateUserDto payload (never send username, phone, phoneVerified, uni, role, status, xp)
      const safeProfilePayload = {
        fullName: cleanedName,
        bio: cleanedBio,
        university: cleanedUniversity,
        linkedin: cleanedLinkedin,
        skills,
        avatarUrl: finalAvatarUrl,
      };

      const apiUpdatePayload = {
        name: cleanedName,
        bio: cleanedBio,
        university: cleanedUniversity,
        skills,
        linkedIn: cleanedLinkedin,
        avatarUrl: finalAvatarUrl,
        profile: safeProfilePayload,
      };
      if (emailChanged) {
        apiUpdatePayload.email = cleanedEmail;
      }

      const localStorageProfilePayload = {
        ...safeProfilePayload,
        username: cleanedUsername,
        uni: cleanedUniversity,
        email: cleanedEmail || savedEmail,
        phone: finalPhone,
        phoneVerified: isPhoneVerified,
      };

      // 3. Update backend API
      const userId = user?.id || storage.getBackendUserId() || '';
      let backendUpdatedUser = null;
      if (userId) {
        try {
          backendUpdatedUser = await usersApi.update(userId, apiUpdatePayload);
        } catch (apiErr) {
          const code = apiErr?.code || apiErr?.data?.code;
          const errField = apiErr?.field || apiErr?.data?.field;
          const status = apiErr?.statusCode || apiErr?.status;
          if (code === 'FIELD_NOT_ALLOWED') {
            const msg = apiErr?.message || 'One or more fields are not allowed.';
            setProfileError(msg);
            showToast(msg, 'error');
            setSavingProfile(false);
            return;
          }
          if (code === 'NOT_YOUR_ACCOUNT' || status === 403) {
            const msg = apiErr?.message || 'You can only update your own account.';
            setProfileError(msg);
            showToast(msg, 'error');
            setSavingProfile(false);
            return;
          }
          if (code === 'EMAIL_TAKEN' || String(apiErr?.message || '').toLowerCase().includes('email already exists')) {
            setErrors((prev) => ({ ...prev, email: 'An account with this email already exists' }));
            setProfileError('An account with this email already exists');
            showToast('An account with this email already exists', 'error');
            setSavingProfile(false);
            return;
          }
          if (code === 'CONTENT_NOT_ALLOWED') {
            const targetField = errField === 'name' ? 'fullName' : errField === 'skills' ? 'skill' : (errField || 'bio');
            setErrors((prev) => ({
              ...prev,
              [targetField]: apiErr.message || 'Contains content that is not allowed.',
            }));
            showToast(apiErr.message || 'Content not allowed.', 'error');
            setSavingProfile(false);
            return;
          }
          if (status === 409 || String(apiErr?.message || '').toLowerCase().includes('already taken')) {
            setErrors((prev) => ({ ...prev, username: 'This username is already taken' }));
            showToast('This username is already taken', 'error');
            setSavingProfile(false);
            return;
          }
          if (status === 400) {
            const msg = apiErr.message || 'Please check your profile fields.';
            setProfileError(msg);
            showToast(msg, 'error');
            setSavingProfile(false);
            return;
          }
          console.warn('Backend unavailable for profile update.', apiErr);
        }
      }

      // 4. Refresh AuthContext from backend (no full-user localStorage cache)
      const nextEmailVerified = emailChanged
        ? false
        : backendUpdatedUser?.emailVerified !== undefined
        ? Boolean(backendUpdatedUser.emailVerified)
        : user?.emailVerified !== false;

      const updatedUserObj = {
        ...(user || {}),
        ...(backendUpdatedUser || {}),
        id: userId,
        name: cleanedName,
        email: cleanedEmail || backendUpdatedUser?.email || user?.email || '',
        emailVerified: nextEmailVerified,
        university: cleanedUniversity,
        phone: cleanedPhone,
        linkedIn: cleanedLinkedin,
        avatarUrl: finalAvatarUrl,
        profile: {
          ...(user?.profile || {}),
          ...(backendUpdatedUser?.profile || {}),
          ...localStorageProfilePayload,
          fullName: cleanedName,
        },
      };

      if (auth?.currentUser) {
        try {
          await updateProfile(auth.currentUser, { displayName: cleanedName });
        } catch (err) {
          console.warn('[settings] Could not update Firebase displayName:', err);
        }
      }

      if (typeof refreshUser === 'function') {
        await refreshUser().catch(() => {});
      }
      if (updateUser) {
        updateUser(updatedUserObj);
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('teamforge:user_updated', { detail: updatedUserObj }));
      }

      setFullName(cleanedName);
      setUsername(cleanedUsername);
      if (cleanedEmail) {
        setEmail(cleanedEmail);
        if (emailChanged) {
          setSavedEmail(cleanedEmail);
        }
      }
      setBio(cleanedBio);
      setPhone(cleanedPhone);
      setLinkedin(cleanedLinkedin);

      if (emailChanged) {
        const noticeMsg = 'Check your new email to verify it';
        setEmailVerifyNotice(noticeMsg);
        showToast(noticeMsg);
      } else {
        showToast('Profile settings saved');
      }
    } catch (err) {
      console.error('Failed to save profile settings:', err);
      const serverMsg = err.serverMessage || err.message || '';
      if (err.code === 'INVALID_URL' || /url/i.test(serverMsg)) {
        setErrors((prev) => ({
          ...prev,
          linkedin: serverMsg || 'Invalid URL format (must start with http:// or https://, max 2048 chars)',
        }));
      }
      showToast(serverMsg || 'Error saving profile settings', 'error');
    } finally {
      setSavingProfile(false);
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

          {profileError && (
            <div
              data-testid="profile-error-banner"
              role="alert"
              style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#b91c1c', padding: '12px 16px', borderRadius: '10px', marginBottom: '20px', fontSize: '0.9rem', fontWeight: 600 }}
            >
              {profileError}
            </div>
          )}

          {emailVerifyNotice && (
            <div
              data-testid="email-verify-notice"
              role="status"
              style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid #3b82f6', color: '#1d4ed8', padding: '12px 16px', borderRadius: '10px', marginBottom: '20px', fontSize: '0.9rem', fontWeight: 600 }}
            >
              {emailVerifyNotice}
            </div>
          )}

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
                    accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
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
                {errors.avatar && (
                  <p data-testid="avatar-upload-error" role="alert" style={{ color: '#dc2626', fontSize: '0.84rem', marginTop: '4px' }}>
                    {errors.avatar}
                  </p>
                )}
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

            <div className="form-group settings-readonly-field" data-testid="username-readonly-block">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>Username</span>
                <span role="img" aria-label="locked" title="Your username can't be changed" style={{ fontSize: '0.85rem' }}>
                  🔒
                </span>
              </label>
              <div
                data-testid="username-readonly-display"
                style={{
                  padding: '10px 14px',
                  borderRadius: '6px',
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  color: '#334155',
                  fontWeight: 600,
                  fontSize: '0.925rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span style={{ color: '#64748b' }}>@</span>
                <span>{username || user?.username || '—'}</span>
              </div>
              <div
                className="form-helper-text"
                data-testid="username-readonly-note"
                style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <span aria-hidden="true">🔒</span>
                <span>Your username can&apos;t be changed</span>
              </div>
            </div>
          </div>

          {/* Email Address */}
          <FormInput
            label="Email Address"
            name="email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
            }}
            error={errors.email}
            helperText="Changing your email requires re-verification and revokes other active sessions."
            placeholder="you@example.com"
          />

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

          {/* University / Institution */}
          <FormInput
            label="University / Institution"
            name="university"
            value={university}
            onChange={(e) => {
              setUniversity(e.target.value);
              if (errors.university) setErrors((prev) => ({ ...prev, university: '' }));
            }}
            error={errors.university}
            placeholder="e.g. IIT Bombay, Stanford University"
            helperText="Optional (2 - 100 characters)"
            list="university-suggestions"
          />
          <datalist id="university-suggestions">
            {SUGGESTED_UNIVERSITIES.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>

          {/* Phone & LinkedIn Grid */}
          <div className="settings-form-grid">
            <div className="settings-phone-container">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label htmlFor="settings-phone-input" className="tf-form-label" style={{ marginBottom: 0 }}>
                    Phone Number
                  </label>
                  <Badge variant={isPhoneVerified ? 'success' : 'secondary'} size="sm">
                    {isPhoneVerified ? 'Verified' : 'Not verified'}
                  </Badge>
                </div>
                {isPhoneVerified ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsPhoneVerified(false);
                      phoneInputRef.current?.focus();
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#2563eb',
                      cursor: 'pointer',
                      fontSize: '0.825rem',
                      fontWeight: 500,
                      padding: 0,
                      textDecoration: 'underline',
                    }}
                  >
                    Change number
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleOpenOtpModal}
                    disabled={!INDIAN_PHONE_RE.test(phone.replace(/^\+91/, '').trim())}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: INDIAN_PHONE_RE.test(phone.replace(/^\+91/, '').trim()) ? '#2563eb' : '#94a3b8',
                      cursor: INDIAN_PHONE_RE.test(phone.replace(/^\+91/, '').trim()) ? 'pointer' : 'not-allowed',
                      fontSize: '0.825rem',
                      fontWeight: 500,
                      padding: 0,
                      textDecoration: INDIAN_PHONE_RE.test(phone.replace(/^\+91/, '').trim()) ? 'underline' : 'none',
                    }}
                  >
                    Verify
                  </button>
                )}
              </div>
              <FormInput
                id="settings-phone-input"
                name="phone"
                type="tel"
                helperText="Indian 10-digit (shown with +91)"
                placeholder="9876543210"
                value={phone}
                onChange={handlePhoneChange}
                error={errors.phone}
              />
            </div>

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
                Add skills as tags. These appear on your profile.
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

      {/* ═══════════ CARD 3: NOTIFICATION DIGEST (Phase 18) ═══════════ */}
      <div className="settings-card" id="settings-section-digest" data-testid="settings-digest-card">
        <div className="settings-section-header">
          <div>
            <h2 className="settings-section-title">Notification digest</h2>
            <p className="settings-section-desc">
              Batch routine updates (likes, applicants, comments, badges) into one daily summary at your chosen hour. Warnings, payments, disputes, and urgent deadlines (&lt;24h) still arrive immediately.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.92rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              data-testid="digest-enabled-toggle"
              checked={digestEnabled}
              onChange={(e) => setDigestEnabled(e.target.checked)}
            />
            <span>Enable daily notification digest</span>
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <label htmlFor="digest-hour-select" style={{ fontSize: '0.88rem', fontWeight: 600 }}>
              Delivery hour:
            </label>
            <select
              id="digest-hour-select"
              data-testid="digest-hour-select"
              className="settings-input"
              style={{ maxWidth: '160px' }}
              value={digestHour}
              disabled={!digestEnabled}
              onChange={(e) => setDigestHour(Number(e.target.value))}
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {`${String(h).padStart(2, '0')}:00`}
                </option>
              ))}
            </select>
            <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
              Local offset: UTC{utcOffsetMinutes >= 0 ? `+${(utcOffsetMinutes / 60).toFixed(1).replace('.0', '')}` : (utcOffsetMinutes / 60).toFixed(1).replace('.0', '')}
            </span>
          </div>
          <div>
            <button
              type="button"
              data-testid="save-digest-btn"
              className="settings-btn-primary"
              disabled={savingDigest}
              onClick={async () => {
                if (savingDigest) return;
                setSavingDigest(true);
                try {
                  const saved = await usersApi.updateSettings({
                    digestEnabled,
                    digestHour: Number(digestHour),
                    utcOffsetMinutes,
                  });
                  if (saved) {
                    setDigestEnabled(saved.digestEnabled !== false);
                    setDigestHour(saved.digestHour ?? digestHour);
                  }
                  showToast('Notification digest settings saved.');
                } catch (err) {
                  showToast(err?.serverMessage || err?.message || 'Failed to save digest settings.', 'error');
                } finally {
                  setSavingDigest(false);
                }
              }}
            >
              {savingDigest ? 'Saving...' : 'Save Digest Settings'}
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════ CARD 4: YOUR DATA (Phase 18) ═══════════ */}
      <div className="settings-card" id="settings-section-your-data" data-testid="settings-your-data-card">
        <div className="settings-section-header">
          <div>
            <h2 className="settings-section-title">Your data</h2>
            <p className="settings-section-desc">
              Request a complete JSON archive of your own profile, projects, tasks, requests, messages, notifications, reputation/XP history, warnings, sessions, and payments. Links stay active for 24 hours (1 request per hour).
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
          <div>
            <button
              type="button"
              data-testid="request-export-btn"
              className="settings-btn-primary"
              disabled={requestingExport}
              onClick={async () => {
                if (requestingExport) return;
                setRequestingExport(true);
                setExportError('');
                try {
                  const res = await usersApi.requestExport();
                  setExportState(res);
                  showToast('Your data export JSON is ready for download.');
                } catch (err) {
                  setExportError(err?.serverMessage || err?.message || 'Failed to request data export.');
                } finally {
                  setRequestingExport(false);
                }
              }}
            >
              {requestingExport ? 'Preparing Export...' : 'Request Data Export'}
            </button>
          </div>
          {exportError && (
            <div data-testid="export-error" style={{ color: '#b91c1c', fontSize: '0.86rem', background: '#fef2f2', padding: '8px 10px', borderRadius: '6px' }}>
              ⚠️ {exportError}
            </div>
          )}
          {exportState && (
            <div
              data-testid="export-status-box"
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                fontSize: '0.88rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <div>
                <strong>Status:</strong> {exportState.status} · <strong>Expires:</strong>{' '}
                {exportState.expiresAt ? new Date(exportState.expiresAt).toLocaleString() : '24h'}
              </div>
              {exportState.status === 'ready' && (
                <button
                  type="button"
                  data-testid="download-export-link"
                  className="settings-btn-primary"
                  disabled={downloadingExport}
                  onClick={async () => {
                    if (downloadingExport) return;
                    setDownloadingExport(true);
                    setExportError('');
                    try {
                      const file = await usersApi.downloadExport(exportState.exportId || exportState.id);
                      if (typeof document !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
                        const blob = new Blob([file.text], { type: 'application/json;charset=utf-8' });
                        const href = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = href;
                        a.download = file.filename || `teamforge-export-${exportState.exportId || exportState.id}.json`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(href);
                      }
                      showToast('JSON export downloaded.');
                    } catch (err) {
                      setExportError(err?.serverMessage || err?.message || 'Failed to download export.');
                    } finally {
                      setDownloadingExport(false);
                    }
                  }}
                >
                  {downloadingExport ? 'Downloading...' : 'Download JSON'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══════════ CARD 5: DELETE ACCOUNT (Phase 18) ═══════════ */}
      {(() => {
        const expectedUsername = String(username || user?.username || '').trim().toLowerCase();
        const typedUsername = String(deleteUsernameConfirm || '').trim().toLowerCase();
        const isUsernameMatched = Boolean(expectedUsername && typedUsername === expectedUsername);
        const isBlockedFromDeletion = Boolean(
          deletionCheck && !deletionCheck.canDelete &&
          ((Array.isArray(deletionCheck.taskBlockers) && deletionCheck.taskBlockers.length > 0) ||
           (Array.isArray(deletionCheck.obligations) && deletionCheck.obligations.length > 0))
        );

        const handleConfirmDeleteAccount = async () => {
          if (deletingAccount) return;
          setDeletingAccount(true);
          setDeleteAccountError('');
          setDeleteObligations([]);
          setDeleteTaskBlockers([]);
          try {
            await usersApi.deleteMyAccount({
              username: deleteUsernameConfirm.trim(),
            });
            setIsDeleteConfirmModalOpen(false);
            try {
              storage.setAccountDeletedNotice('Your account was deleted.');
            } catch (storageErr) {
              console.warn('[settings] Could not persist account deleted notice:', storageErr);
            }
            showToast('Your account was deleted.');
            navigate('/', {
              replace: true,
              state: { accountDeletedMessage: 'Your account was deleted.' },
            });
            if (typeof logout === 'function') {
              await logout();
            }
          } catch (err) {
            setIsDeleteConfirmModalOpen(false);
            setDeleteAccountError(
              err?.serverMessage || err?.message || 'Could not delete account.',
            );
            if (Array.isArray(err?.obligations)) {
              setDeleteObligations(err.obligations);
            }
            if (Array.isArray(err?.taskBlockers)) {
              setDeleteTaskBlockers(err.taskBlockers);
            }
          } finally {
            setDeletingAccount(false);
          }
        };

        return (
          <>
            <div
              className="settings-card"
              id="settings-section-delete-account"
              data-testid="settings-delete-account-card"
              style={{ borderColor: '#fecaca' }}
            >
              <div className="settings-section-header">
                <div>
                  <h2 className="settings-section-title" style={{ color: '#b91c1c' }}>Delete account</h2>
                  <p className="settings-section-desc">
                    Permanently deletes and anonymises your account while keeping completed work and chat under &ldquo;Deleted user&rdquo;. You must close or complete all owned projects and settle any active mentor sessions or escrow first.
                  </p>
                </div>
              </div>

              {/* Active obligations / Task blockers banner */}
              {isBlockedFromDeletion && (
                <div
                  data-testid="deletion-blockers-warning"
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#fff7ed',
                    border: '1px solid #fdba74',
                    fontSize: '0.86rem',
                    color: '#9a3412',
                    marginTop: '12px',
                    marginBottom: '10px',
                    maxWidth: '520px',
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: '6px' }}>
                    ⚠️ Account Deletion Blocked
                  </div>
                  <p style={{ margin: '0 0 6px', fontSize: '0.84rem' }}>
                    You cannot delete your account while you have active tasks or unsettled obligations. Please complete or resolve them first:
                  </p>
                  {Array.isArray(deletionCheck?.taskBlockers) && deletionCheck.taskBlockers.length > 0 && (
                    <div style={{ marginTop: '6px' }}>
                      <strong style={{ fontSize: '0.82rem' }}>Active Tasks:</strong>
                      <ul data-testid="deletion-task-blockers-list" style={{ margin: '4px 0 0', paddingLeft: '18px' }}>
                        {deletionCheck.taskBlockers.map((b) => (
                          <li key={b.taskId}>
                            <span>{b.taskTitle} ({b.status}) in project </span>
                            <Link
                              to={`/collaborator/workspace/${b.projectId}`}
                              style={{ color: '#c2410c', textDecoration: 'underline', fontWeight: 600 }}
                            >
                              {b.projectTitle}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {Array.isArray(deletionCheck?.obligations) && deletionCheck.obligations.length > 0 && (
                    <div style={{ marginTop: '6px' }}>
                      <strong style={{ fontSize: '0.82rem' }}>Open Obligations:</strong>
                      <ul data-testid="deletion-obligations-list" style={{ margin: '4px 0 0', paddingLeft: '18px' }}>
                        {deletionCheck.obligations.map((ob, idx) => (
                          <li key={ob.id || idx}>
                            {ob.reason || `${ob.type}: ${ob.title || ob.id} (${ob.status})`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px', maxWidth: '460px' }}>
                <FormInput
                  label="Type your username to confirm"
                  name="deleteUsernameConfirm"
                  data-testid="delete-account-username"
                  placeholder={username || user?.username || 'your_username'}
                  value={deleteUsernameConfirm}
                  onChange={(e) => {
                    setDeleteUsernameConfirm(e.target.value);
                    if (deleteAccountError) setDeleteAccountError('');
                  }}
                />
                {deleteAccountError && (
                  <div
                    role="alert"
                    data-testid="delete-account-error"
                    style={{ color: '#b91c1c', background: '#fef2f2', padding: '10px 12px', borderRadius: '6px', fontSize: '0.86rem' }}
                  >
                    <div>⚠️ {deleteAccountError}</div>
                    {deleteTaskBlockers.length > 0 && (
                      <div style={{ marginTop: '6px' }}>
                        <strong>Active Tasks Blocking Deletion:</strong>
                        <ul data-testid="delete-error-task-blockers-list" style={{ margin: '4px 0 0', paddingLeft: '18px' }}>
                          {deleteTaskBlockers.map((b) => (
                            <li key={b.taskId}>
                              <span>{b.taskTitle} ({b.status}) in project </span>
                              <Link
                                to={`/collaborator/workspace/${b.projectId}`}
                                style={{ color: '#991b1b', textDecoration: 'underline', fontWeight: 600 }}
                              >
                                {b.projectTitle}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {deleteObligations.length > 0 && (
                      <ul data-testid="delete-obligations-list" style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
                        {deleteObligations.map((ob, idx) => (
                          <li key={ob.id || idx}>{ob.reason || `${ob.type}: ${ob.title || ob.id} (${ob.status})`}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                <div>
                  <button
                    type="button"
                    data-testid="delete-account-btn"
                    disabled={deletingAccount || !isUsernameMatched || isBlockedFromDeletion}
                    style={{
                      padding: '9px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      background: deletingAccount || !isUsernameMatched || isBlockedFromDeletion ? '#fca5a5' : '#dc2626',
                      color: '#fff',
                      fontWeight: 600,
                      cursor: deletingAccount || !isUsernameMatched || isBlockedFromDeletion ? 'not-allowed' : 'pointer',
                    }}
                    onClick={() => {
                      if (deletingAccount || !isUsernameMatched || isBlockedFromDeletion) return;
                      setDeleteAccountError('');
                      setDeleteObligations([]);
                      setDeleteTaskBlockers([]);
                      setIsDeleteConfirmModalOpen(true);
                    }}
                  >
                    {deletingAccount ? 'Deleting Account...' : 'Delete Account'}
                  </button>
                </div>
              </div>
            </div>

            <Modal
              isOpen={isDeleteConfirmModalOpen}
              title="Delete your account?"
              onClose={() => {
                if (!deletingAccount) setIsDeleteConfirmModalOpen(false);
              }}
              closeDisabled={deletingAccount}
              size="sm"
              testId="delete-confirm-modal"
              footer={
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', width: '100%' }}>
                  <button
                    type="button"
                    data-testid="delete-confirm-cancel-btn"
                    disabled={deletingAccount}
                    onClick={() => setIsDeleteConfirmModalOpen(false)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#fff',
                      color: '#334155',
                      fontWeight: 600,
                      cursor: deletingAccount ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    data-testid="delete-confirm-submit-btn"
                    disabled={deletingAccount}
                    onClick={handleConfirmDeleteAccount}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#dc2626',
                      color: '#fff',
                      fontWeight: 600,
                      cursor: deletingAccount ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {deletingAccount ? 'Deleting Account...' : 'Yes, delete my account'}
                  </button>
                </div>
              }
            >
              <p style={{ color: '#475569', fontSize: '0.92rem', marginTop: 0, lineHeight: 1.5 }}>
                Please review what happens when you confirm deletion:
              </p>
              <ul style={{ color: '#334155', fontSize: '0.9rem', paddingLeft: '20px', lineHeight: 1.6, margin: '8px 0 0' }}>
                <li>Your profile is permanently erased and your active sessions end.</li>
                <li>Your completed work and messages stay under &ldquo;Deleted user&rdquo;.</li>
                <li>This action cannot be undone.</li>
              </ul>
            </Modal>
          </>
        );
      })()}



      {/* ═══════════ PHONE OTP VERIFICATION MODAL (Phase 3) ═══════════ */}
      <Modal
        isOpen={isOtpModalOpen}
        title={otpStep === 1 ? 'Verify Phone Number' : 'Enter One-Time Password'}
        onClose={handleCloseOtpModal}
        size="sm"
      >
        {otpStep === 1 ? (
          <div>
            <p style={{ color: '#475569', fontSize: '0.9rem', marginBottom: '10px', lineHeight: 1.5 }}>
              We will verify ownership of <strong>+91 {phone.replace(/^\+91/, '').trim()}</strong> by sending a 6-digit SMS one-time password through Firebase Phone Authentication.
            </p>

            <div
              style={{
                color: '#475569',
                fontSize: '0.8rem',
                marginBottom: '14px',
                lineHeight: 1.5,
                background: '#f8fafc',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
              }}
            >
              💡 <strong>Instant Test Numbers (Zero SMS quota &amp; region-free):</strong>
              <div style={{ marginTop: '4px', color: '#334155' }}>
                • <code>+91 9494221549</code> &rarr; Code: <strong>123456</strong><br />
                • <code>+91 9876543210</code> &rarr; Code: <strong>123456</strong><br />
                • <code>+91 7981538727</code> &rarr; Code: <strong>890634</strong>
              </div>
            </div>

            <div id="recaptcha-container" style={{ margin: '12px 0' }}></div>

            {otpError && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '6px',
                  color: '#dc2626',
                  padding: '10px 12px',
                  fontSize: '0.85rem',
                  marginBottom: '14px',
                }}
              >
                {otpError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCloseOtpModal}
                disabled={otpSending}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  background: '#fff',
                  cursor: otpSending ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSendOtp}
                disabled={otpSending || otpLockSeconds > 0}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  background: otpLockSeconds > 0 ? '#94a3b8' : '#2563eb',
                  color: '#fff',
                  fontWeight: 500,
                  cursor: otpSending || otpLockSeconds > 0 ? 'not-allowed' : 'pointer',
                }}
              >
                {otpLockSeconds > 0
                  ? `Locked (${formatLockCountdown(otpLockSeconds)})`
                  : otpSending
                  ? 'Sending OTP...'
                  : 'Send OTP'}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p style={{ color: '#475569', fontSize: '0.9rem', marginBottom: '14px', lineHeight: 1.5 }}>
              Enter the 6-digit OTP code sent to <strong>+91 {phone.replace(/^\+91/, '').trim()}</strong>.
            </p>

            <FormInput
              label="6-Digit OTP"
              name="otpCode"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              maxLength={6}
              value={otpCode}
              onChange={handleOtpCodeChange}
              onPaste={handleOtpPaste}
              autoFocus
              error={otpError}
              helperText={
                otpLockSeconds > 0
                  ? `Verification locked — try again in ${formatLockCountdown(otpLockSeconds)}`
                  : wrongAttempts > 0
                  ? `${Math.max(0, 5 - wrongAttempts)} attempt(s) remaining`
                  : 'Enter the 6-digit verification code'
              }
              disabled={wrongAttempts >= 5 || otpLockSeconds > 0 || otpVerifying}
            />

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '12px',
                fontSize: '0.85rem',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setOtpStep(1);
                  setOtpError('');
                  setWrongAttempts(0);
                }}
                disabled={otpVerifying}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563eb',
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline',
                }}
              >
                Change number
              </button>

              {resendTimer > 0 ? (
                <span style={{ color: '#64748b' }}>Resend code in {resendTimer}s</span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={otpSending || otpVerifying}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#2563eb',
                    cursor: 'pointer',
                    padding: 0,
                    textDecoration: 'underline',
                  }}
                >
                  {otpSending ? 'Resending...' : 'Resend OTP'}
                </button>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '24px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCloseOtpModal}
                disabled={otpVerifying}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  background: '#fff',
                  cursor: otpVerifying ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleVerifyOtp}
                disabled={otpCode.length !== 6 || wrongAttempts >= 5 || otpVerifying}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  background: otpCode.length === 6 && wrongAttempts < 5 ? '#2563eb' : '#94a3b8',
                  color: '#fff',
                  fontWeight: 500,
                  cursor: otpCode.length === 6 && wrongAttempts < 5 && !otpVerifying ? 'pointer' : 'not-allowed',
                }}
              >
                {otpVerifying ? 'Verifying...' : 'Verify'}
              </button>
            </div>
          </div>
        )}
      </Modal>

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
