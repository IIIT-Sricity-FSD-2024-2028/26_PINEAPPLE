import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { selectIsAuthenticated } from '../store/selectors/sessionSelectors';
import {
  getCurrentAuthMode,
  requestPasswordReset,
} from '../store/thunks/sessionThunks';
import FormInput from '../components/common/FormInput';
import SafeLink from '../components/common/SafeLink';
import './Auth.css';

const HomeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
    <polyline points="9 22 9 12 15 12 15 22"></polyline>
  </svg>
);

const ForgotPasswordContent = () => {
  const dispatch = useDispatch();
  const [identifier, setIdentifier] = useState('');
  const [submittedIdentifier, setSubmittedIdentifier] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const [message, setMessage] = useState('');
  const [deliveryHint, setDeliveryHint] = useState('');
  const [devNotice, setDevNotice] = useState(null);
  const [error, setError] = useState('');

  const timerRef = useRef(null);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const navigate = useNavigate();
  const mode = getCurrentAuthMode();
  const isProduction = import.meta.env.PROD;

  // Resend countdown timer
  useEffect(() => {
    if (resendTimer > 0) {
      timerRef.current = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [resendTimer]);

  // Redirect signed-in users to dashboard
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSend = async (targetIdent, isResend = false) => {
    setError('');
    if (isResend) {
      setResending(true);
    } else {
      setLoading(true);
    }

    const genericMsg = 'If an account with that email or username exists, password reset instructions have been sent.';
    const trimmed = targetIdent.trim();

    try {
      const response = await dispatch(requestPasswordReset(trimmed)).unwrap();
      if (mode === 'firebase' || response?.mode === 'firebase') {
        setMessage(genericMsg);
        setIsSubmitted(true);
        setSubmittedIdentifier(trimmed);
        setResendTimer(30);

        const isEmulator = import.meta.env.VITE_USE_AUTH_EMULATOR === 'true';
        if (isEmulator && !isProduction) {
          setDevNotice({
            type: 'emulator',
            note: 'The password reset link appears in the Firebase Emulator console and in the Emulator UI at http://localhost:4000/auth under the "Emails" tab.',
          });
        } else {
          setDeliveryHint('Check your inbox and spam folder. The link expires in 15 minutes.');
          setDevNotice(null);
        }
        return;
      }

      setMessage(response?.message || genericMsg);
      setIsSubmitted(true);
      setSubmittedIdentifier(trimmed);
      setResendTimer(30);
      setDeliveryHint('Check your inbox and spam folder. The link expires in 15 minutes.');

      if (!isProduction) {
        if (response?.mode === 'ethereal' && response?.previewUrl) {
          setDevNotice({
            type: 'ethereal',
            previewUrl: response.previewUrl,
          });
        } else if (response?.mode === 'console' && response?.resetLink) {
          setDevNotice({
            type: 'console',
            resetLink: response.resetLink,
          });
        } else {
          setDevNotice(null);
        }
      } else {
        setDevNotice(null);
      }
    } catch (err) {
      if (err?.status === 429) {
        setError('Too many password reset requests. Please wait before trying again.');
      } else {
        setError(err?.serverMessage || err?.message || 'Unable to process password reset request. Please try again.');
      }
    } finally {
      setLoading(false);
      setResending(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = identifier.trim();
    if (!trimmed) {
      setError('Please enter your email or username.');
      return;
    }
    handleSend(trimmed, false);
  };

  const handleResend = () => {
    if (resendTimer > 0 || resending || loading) return;
    handleSend(submittedIdentifier || identifier, true);
  };

  const handleResetForm = () => {
    setIsSubmitted(false);
    setMessage('');
    setDeliveryHint('');
    setDevNotice(null);
    setError('');
    setResendTimer(0);
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

          <div id="forgot-password-view" className="view-section">
            <h1 className="main-title uppercase">FORGOT PASSWORD?</h1>
            <p className="subtitle">
              Enter your email address or username and we will generate instructions to reset your password.
            </p>

            {error && (
              <div className="error-message" role="alert">
                {error}
              </div>
            )}

            {isSubmitted ? (
              <div className="submitted-state" style={{ marginTop: '8px' }}>
                {message && (
                  <div
                    className="success-message"
                    role="status"
                    style={{
                      color: '#15803d',
                      backgroundColor: '#f0fdf4',
                      border: '1px solid #86efac',
                      padding: '0.85rem 1rem',
                      borderRadius: '10px',
                      fontSize: '0.88rem',
                      marginBottom: '1rem',
                      lineHeight: 1.5,
                    }}
                  >
                    {message}
                  </div>
                )}

                {deliveryHint && (
                  <p style={{ color: '#475569', fontSize: '0.88rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                    📬 {deliveryHint}
                  </p>
                )}

                {!isProduction && devNotice?.type === 'ethereal' && (
                  <div
                    className="demo-notice"
                    style={{
                      backgroundColor: '#eff6ff',
                      border: '1px solid #93c5fd',
                      color: '#1e40af',
                      padding: '0.85rem 1rem',
                      borderRadius: '10px',
                      fontSize: '0.85rem',
                      marginBottom: '1.25rem',
                      lineHeight: 1.5,
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: '4px' }}>
                      🧪 Demo Mode: Ethereal Test Inbox
                    </div>
                    <p style={{ margin: '0 0 8px 0' }}>
                      No real email was sent. You can preview the generated email in the Ethereal test inbox:
                    </p>
                    <SafeLink
                      href={devNotice.previewUrl}
                      style={{
                        display: 'inline-block',
                        background: '#2563eb',
                        color: '#ffffff',
                        padding: '6px 14px',
                        borderRadius: '6px',
                        textDecoration: 'none',
                        fontWeight: 600,
                        fontSize: '0.82rem',
                      }}
                    >
                      Open Ethereal Preview Inbox &rarr;
                    </SafeLink>
                  </div>
                )}

                {!isProduction && devNotice?.type === 'console' && (
                  <div
                    className="demo-notice"
                    style={{
                      backgroundColor: '#fffbeb',
                      border: '1px solid #fcd34d',
                      color: '#92400e',
                      padding: '0.85rem 1rem',
                      borderRadius: '10px',
                      fontSize: '0.85rem',
                      marginBottom: '1.25rem',
                      lineHeight: 1.5,
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: '4px' }}>
                      ⚙️ Demo Mode: Console Only
                    </div>
                    <p style={{ margin: '0 0 6px 0' }}>
                      No real email was sent. The password reset link was printed to the back-end console.
                    </p>
                    {devNotice.resetLink && (
                      <SafeLink
                        href={devNotice.resetLink}
                        style={{
                          color: '#2563eb',
                          fontWeight: 700,
                          wordBreak: 'break-all',
                          textDecoration: 'underline',
                          fontSize: '0.82rem',
                        }}
                      >
                        {devNotice.resetLink}
                      </SafeLink>
                    )}
                  </div>
                )}

                {!isProduction && devNotice?.type === 'emulator' && (
                  <div
                    className="emulator-notice"
                    style={{
                      backgroundColor: '#eff6ff',
                      border: '1px solid #93c5fd',
                      color: '#1e40af',
                      padding: '0.85rem 1rem',
                      borderRadius: '10px',
                      fontSize: '0.85rem',
                      marginBottom: '1.25rem',
                      lineHeight: 1.5,
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: '4px' }}>
                      🧪 Firebase Emulator Notice
                    </div>
                    <p style={{ margin: 0 }}>
                      {devNotice.note}
                    </p>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleResend}
                    disabled={resendTimer > 0 || resending}
                    style={{
                      opacity: (resendTimer > 0 || resending) ? 0.6 : 1,
                      cursor: (resendTimer > 0 || resending) ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {resending
                      ? 'Resending...'
                      : resendTimer > 0
                      ? `Resend instructions in ${resendTimer}s`
                      : 'Resend instructions'}
                  </button>

                  <button
                    type="button"
                    onClick={handleResetForm}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary, #2563eb)',
                      cursor: 'pointer',
                      fontSize: '0.88rem',
                      textDecoration: 'underline',
                      padding: '6px 0',
                    }}
                  >
                    Use a different email or username
                  </button>
                </div>
              </div>
            ) : (
              <form className="auth-form" onSubmit={handleSubmit}>
                <FormInput
                  label="Email or Username"
                  name="identifier"
                  id="forgot-identifier"
                  type="text"
                  placeholder="name@example.com or username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  disabled={loading}
                />

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading}
                  style={{ opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
                >
                  {loading ? 'Sending request...' : 'Send reset link'}
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
    </div>
  );
};

const ForgotPassword = ForgotPasswordContent;
export default ForgotPassword;
