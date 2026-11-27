import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { selectIsAuthenticated } from '../store/selectors/sessionSelectors';
import {
  completePasswordReset,
  verifyFirebaseResetCode,
} from '../store/thunks/sessionThunks';
import './Auth.css';

const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
    <circle cx="12" cy="12" r="3"></circle>
  </svg>
);

const HomeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
    <polyline points="9 22 9 12 15 12 15 22"></polyline>
  </svg>
);

const ResetPasswordContent = () => {
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const oobCode = searchParams.get('oobCode') || searchParams.get('code') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [generalError, setGeneralError] = useState('');

  const [isTokenValidating, setIsTokenValidating] = useState(Boolean(oobCode));
  const [isTokenInvalid, setIsTokenInvalid] = useState(!token && !oobCode);
  const [verifiedEmail, setVerifiedEmail] = useState('');

  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const toastTimeoutRef = useRef(null);
  const redirectTimeoutRef = useRef(null);

  const isAuthenticated = useSelector(selectIsAuthenticated);
  const navigate = useNavigate();

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
      if (redirectTimeoutRef.current) clearTimeout(redirectTimeoutRef.current);
    };
  }, []);

  // Verify Firebase oobCode if present
  useEffect(() => {
    let isMounted = true;
    if (oobCode) {
      dispatch(verifyFirebaseResetCode(oobCode))
        .unwrap()
        .then((email) => {
          if (!isMounted) return;
          setVerifiedEmail(email);
          setIsTokenInvalid(false);
          setIsTokenValidating(false);
        })
        .catch((err) => {
          if (!isMounted) return;
          setIsTokenInvalid(true);
          setIsTokenValidating(false);
          const code = err?.code || '';
          if (code === 'auth/expired-action-code') {
            setGeneralError('This password reset link has expired. Please request a new one.');
          } else if (code === 'auth/invalid-action-code') {
            setGeneralError('This password reset link is invalid or has already been used.');
          } else {
            setGeneralError(err?.serverMessage || err?.message || 'Invalid password reset link.');
          }
        });
    }

    return () => {
      isMounted = false;
    };
  }, [dispatch, oobCode]);

  // Redirect signed-in users to dashboard
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const computeStrength = (pwd) => {
    if (!pwd) return { label: '', color: '#94a3b8', percent: 0 };
    if (pwd.length < 6) return { label: 'Too short (min 6)', color: '#ef4444', percent: 25 };

    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 1) return { label: 'Weak', color: '#f59e0b', percent: 40 };
    if (score <= 3) return { label: 'Medium', color: '#3b82f6', percent: 70 };
    return { label: 'Strong', color: '#10b981', percent: 100 };
  };

  const strength = computeStrength(password);

  const validateInputs = () => {
    let valid = true;
    setPasswordError('');
    setConfirmError('');
    setGeneralError('');

    if (!password) {
      setPasswordError('Please enter a new password.');
      valid = false;
    } else if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters long.');
      valid = false;
    }

    if (!confirmPassword) {
      setConfirmError('Please confirm your new password.');
      valid = false;
    } else if (password !== confirmPassword) {
      setConfirmError("Passwords don't match!");
      valid = false;
    }

    return valid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!token && !oobCode) {
      setIsTokenInvalid(true);
      setGeneralError('Missing password reset token. Please request a new link.');
      return;
    }

    if (!validateInputs()) {
      return;
    }

    setLoading(true);
    try {
      const response = await dispatch(
        completePasswordReset({ token, oobCode, newPassword: password }),
      ).unwrap();
      setSuccessMessage(
        response?.message || 'Password has been successfully reset! Redirecting to login...',
      );
      showToast('Password updated, please sign in', 'success');
      if (redirectTimeoutRef.current) clearTimeout(redirectTimeoutRef.current);
      redirectTimeoutRef.current = setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      const msg = err?.serverMessage || err?.message || 'Failed to reset password.';
      setGeneralError(msg);
      if (
        msg.toLowerCase().includes('expired') ||
        msg.toLowerCase().includes('invalid') ||
        msg.toLowerCase().includes('already been used') ||
        msg.toLowerCase().includes('action-code') ||
        msg.toLowerCase().includes('token')
      ) {
        setIsTokenInvalid(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-container">
        <div className="form-section">
          <div className="auth-header">
            <div className="brand-group">
              <div className="logo-placeholder">TF</div>
              <h2>TeamForge</h2>
            </div>
            <button type="button" onClick={() => navigate('/')} className="home-btn" aria-label="Go to home">
              <HomeIcon />
            </button>
          </div>

          <div id="reset-password-view" className="view-section">
            <h1 className="main-title uppercase">RESET PASSWORD</h1>
            <p className="subtitle">
              {verifiedEmail
                ? `Set a new password for ${verifiedEmail}.`
                : 'Enter and confirm your new account password below.'}
            </p>

            {generalError && (
              <div className="error-message" role="alert">
                {generalError}
              </div>
            )}

            {isTokenValidating && (
              <div style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.25rem', padding: '10px 0' }}>
                Verifying password reset link...
              </div>
            )}

            {isTokenInvalid && !isTokenValidating && (
              <div
                style={{
                  backgroundColor: '#fef2f2',
                  border: '1px solid #f87171',
                  color: '#991b1b',
                  padding: '1rem',
                  borderRadius: '10px',
                  fontSize: '0.88rem',
                  marginBottom: '1.25rem',
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: '4px' }}>Invalid or Expired Link</div>
                <p style={{ margin: '0 0 10px 0' }}>
                  This password reset link is either missing, has expired, or has already been used.
                </p>
                <Link
                  to="/forgot-password"
                  style={{
                    display: 'inline-block',
                    background: '#991b1b',
                    color: '#ffffff',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontWeight: 600,
                    textDecoration: 'none',
                    fontSize: '0.85rem',
                  }}
                >
                  Request a new password reset link &rarr;
                </Link>
              </div>
            )}

            {successMessage && (
              <div
                className="success-message"
                role="status"
                style={{
                  color: '#15803d',
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #86efac',
                  padding: '1rem',
                  borderRadius: '10px',
                  fontSize: '0.88rem',
                  marginBottom: '1.25rem',
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: '4px' }}>✓ Success</div>
                <p style={{ margin: 0 }}>
                  {successMessage}
                </p>
              </div>
            )}

            {!isTokenInvalid && !isTokenValidating && !successMessage && (
              <form className="auth-form" onSubmit={handleSubmit}>
                <div className="input-group">
                  <label htmlFor="new-password">New Password</label>
                  <div className="password-wrapper">
                    <input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (passwordError) setPasswordError('');
                      }}
                      required
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="toggle-password"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      <EyeIcon />
                    </button>
                  </div>

                  {password && (
                    <div style={{ marginTop: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '3px' }}>
                        <span style={{ color: '#64748b' }}>Strength:</span>
                        <span style={{ color: strength.color, fontWeight: 600 }}>{strength.label}</span>
                      </div>
                      <div style={{ width: '100%', height: '4px', background: '#e2e8f0', borderRadius: '2px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${strength.percent}%`,
                            height: '100%',
                            background: strength.color,
                            transition: 'width 0.3s ease, background 0.3s ease',
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {passwordError && (
                    <span
                      className="field-error-text"
                      style={{ color: 'var(--destructive, #ef4444)', fontSize: '0.82rem', marginTop: '4px', display: 'block' }}
                    >
                      {passwordError}
                    </span>
                  )}
                </div>

                <div className="input-group">
                  <label htmlFor="confirm-new-password">Confirm Password</label>
                  <div className="password-wrapper">
                    <input
                      id="confirm-new-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (confirmError) setConfirmError('');
                      }}
                      required
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="toggle-password"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    >
                      <EyeIcon />
                    </button>
                  </div>
                  {confirmError && (
                    <span
                      className="field-error-text"
                      style={{ color: 'var(--destructive, #ef4444)', fontSize: '0.82rem', marginTop: '4px', display: 'block' }}
                    >
                      {confirmError}
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading}
                  style={{ opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
                >
                  {loading ? 'Updating password...' : 'Update Password'}
                </button>
              </form>
            )}

            <div className="back-to-login">
              <Link to="/login" className="link-brown">
                &larr; Back to Sign In
              </Link>
            </div>
          </div>
        </div>

        <div className="image-section">
          <img src="/Assets/login_sin.jpg" alt="Developer Illustration" />
        </div>
      </div>

      {toast.visible && (
        <div className="settings-toast-container" id="toast" style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999 }}>
          <div
            className={`settings-toast ${toast.type}`}
            style={{
              background: '#0f172a',
              color: '#ffffff',
              padding: '12px 20px',
              borderRadius: '8px',
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.9rem',
            }}
          >
            <span style={{ color: '#10b981', fontWeight: 700 }}>✓</span>
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};

const ResetPassword = ResetPasswordContent;
export default ResetPassword;
