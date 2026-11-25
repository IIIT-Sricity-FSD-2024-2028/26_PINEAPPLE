import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import authApi from '../../services/authApi';

const VerifyEmailBanner = ({ forceShow = false } = {}) => {
  const { user, isAuthenticated, updateUser, refreshUser } = useContext(AuthContext);
  const [sending, setSending] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [hiddenByVerified, setHiddenByVerified] = useState(false);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  if (!isAuthenticated || !user || hiddenByVerified || (!forceShow && user.emailVerified !== false)) {
    return null;
  }

  const formatCooldown = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`;
  };

  const handleResend = async () => {
    if (sending || cooldownSeconds > 0) return;
    setSending(true);
    setStatusMessage('');
    setErrorMessage('');
    try {
      const res = await authApi.resendVerification();
      setCooldownSeconds(Number(res?.cooldownSeconds) || 120);
      setStatusMessage(res?.message || 'Verification email sent. Please check your inbox.');
    } catch (err) {
      if (err?.code === 'EMAIL_ALREADY_VERIFIED' || err?.statusCode === 409 || err?.status === 409) {
        setHiddenByVerified(true);
        setStatusMessage('');
        setErrorMessage('');
        if (typeof refreshUser === 'function') {
          await refreshUser().catch(() => {});
        } else if (typeof updateUser === 'function') {
          updateUser({ emailVerified: true });
        }
        return;
      }
      const retrySecs =
        Number(err?.cooldownSeconds || err?.data?.cooldownSeconds) ||
        (err?.retryAt ? Math.max(1, Math.ceil((new Date(err.retryAt).getTime() - Date.now()) / 1000)) : 0);
      if (retrySecs > 0) {
        setCooldownSeconds(retrySecs);
      }
      setErrorMessage(err?.message || 'Could not resend verification email.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      role="region"
      aria-label="Email verification required"
      data-testid="verify-email-banner"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        padding: '0.75rem 1rem',
        marginBottom: '1rem',
        borderRadius: '8px',
        backgroundColor: '#fffbeb',
        border: '1px solid #fcd34d',
        color: '#92400e',
        fontSize: '0.9rem',
      }}
    >
      <div>
        <strong>Verify your email address</strong> — Check <code>{user.email}</code> to unlock creating projects, applying to teams, posting in chat, and booking mentors.
        {statusMessage && (
          <div data-testid="verify-email-status" style={{ color: '#065f46', marginTop: '0.25rem', fontWeight: 500 }}>
            {statusMessage}
          </div>
        )}
        {errorMessage && (
          <div data-testid="verify-email-error" style={{ color: '#b91c1c', marginTop: '0.25rem', fontWeight: 500 }}>
            {errorMessage}
          </div>
        )}
      </div>
      <button
        type="button"
        data-testid="resend-verification-btn"
        disabled={sending || cooldownSeconds > 0}
        onClick={handleResend}
        style={{
          padding: '0.45rem 0.9rem',
          borderRadius: '6px',
          border: '1px solid #d97706',
          backgroundColor: cooldownSeconds > 0 ? '#fde68a' : '#d97706',
          color: cooldownSeconds > 0 ? '#78350f' : '#ffffff',
          fontWeight: 600,
          fontSize: '0.84rem',
          cursor: sending || cooldownSeconds > 0 ? 'not-allowed' : 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {sending
          ? 'Sending...'
          : cooldownSeconds > 0
          ? `Resend available in ${formatCooldown(cooldownSeconds)}`
          : 'Resend Verification Email'}
      </button>
    </div>
  );
};

export default VerifyEmailBanner;
