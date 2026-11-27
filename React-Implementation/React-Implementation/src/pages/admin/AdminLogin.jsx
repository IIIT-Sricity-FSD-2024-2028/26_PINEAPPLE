import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { consumeNotice, clearSuspendedInfo } from '../../store/slices/sessionSlice';
import {
  selectSessionNotices,
  selectSuspendedInfo,
} from '../../store/selectors/sessionSelectors';
import { loginAdminPortal } from '../../store/thunks/sessionThunks';
import { sanitizeAdminNextPath } from '../../routes/adminNavigation';
import FormInput from '../../components/common/FormInput';
import SuspendedAccountPanel from '../../components/common/SuspendedAccountPanel';
import './AdminLogin.css';

const TeamForgeLogo = () => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
  </svg>
);

const AdminLoginContent = () => {
  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const storeSuspendedInfo = useSelector(selectSuspendedInfo);
  const sessionNotices = useSelector(selectSessionNotices);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localSuspendedInfo, setLocalSuspendedInfo] = useState(
    () => location.state?.suspendedInfo || null,
  );
  const suspendedInfo = localSuspendedInfo || storeSuspendedInfo || null;
  const [error, setError] = useState('');
  const [dismissedNotice, setDismissedNotice] = useState(false);
  const [notice, setNotice] = useState(
    () =>
      location.state?.serverRestartMessage ||
      sessionNotices.serverRestart ||
      '',
  );
  const effectiveNotice = dismissedNotice ? '' : notice;
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sessionNotices.serverRestart) {
      dispatch(consumeNotice('serverRestart'));
    }
  }, [dispatch, sessionNotices.serverRestart]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLocalSuspendedInfo(null);
    dispatch(clearSuspendedInfo());

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError('Email and password are required');
      return;
    }

    setLoading(true);
    try {
      await dispatch(loginAdminPortal({ email: cleanEmail, password })).unwrap();
      const rawNext = new URLSearchParams(location.search).get('next');
      navigate(sanitizeAdminNextPath(rawNext), { replace: true });
    } catch (err) {
      console.error('Admin login failed:', err);
      if (err?.code === 'ACCOUNT_SUSPENDED' || err?.data?.code === 'ACCOUNT_SUSPENDED') {
        const info = err.data || {
          reason: err.reason,
          suspendedAt: err.suspendedAt,
          suspensionType: err.suspensionType,
          appealAvailable: err.appealAvailable,
          supportContact: err.supportContact,
        };
        setLocalSuspendedInfo(info);
        setPassword('');
        setError('');
        return;
      }
      const code = err?.code || err?.data?.code || '';
      const msg = String(err?.serverMessage || err?.message || '');
      if (msg.toLowerCase().includes('portal privileges')) {
        setError(msg);
      } else if (msg.toLowerCase().includes('suspended') || msg.toLowerCase().includes('disabled')) {
        setError('This admin account is suspended or disabled. Contact super user.');
      } else if (
        code === 'TOO_MANY_ATTEMPTS' ||
        err?.statusCode === 429 ||
        err?.status === 429 ||
        msg.toLowerCase().includes('too many')
      ) {
        const secs =
          Number(err?.retryAfterSeconds || err?.retryAfter || err?.cooldownSeconds || 0) ||
          (err?.retryAt ? Math.max(1, Math.ceil((new Date(err.retryAt).getTime() - Date.now()) / 1000)) : 0);
        if (secs > 0) {
          const mins = Math.floor(secs / 60);
          const rem = secs % 60;
          const dur = mins > 0 ? `${mins}m ${String(rem).padStart(2, '0')}s` : `${rem}s`;
          setError(`Too many failed login attempts. Please try again in ${dur}.`);
        } else {
          setError('Too many failed login attempts. Please try again later.');
        }
      } else if (code === 'PASSWORD_REQUIRED') {
        setError('Password is required.');
      } else {
        setError('Invalid credentials. Please verify your email and password.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-wrapper">
      <div className="admin-login-card">
        <div className="admin-login-logo">
          <TeamForgeLogo />
          <h1>TeamForge</h1>
        </div>
        <h2 className="admin-login-title">Portal Access</h2>

        {suspendedInfo && (
          <SuspendedAccountPanel
            info={suspendedInfo}
            onDismiss={() => {
              setLocalSuspendedInfo(null);
              if (storeSuspendedInfo) dispatch(clearSuspendedInfo());
            }}
          />
        )}

        {effectiveNotice && (
          <div
            role="status"
            data-testid="admin-login-notice"
            style={{
              background: '#ecfdf5',
              border: '1px solid #10b981',
              color: '#065f46',
              padding: '10px 12px',
              borderRadius: '8px',
              marginBottom: '12px',
              fontSize: '0.88rem',
              fontWeight: 500,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>{effectiveNotice}</span>
            <button
              type="button"
              onClick={() => {
                setDismissedNotice(true);
                setNotice('');
              }}
              aria-label="Dismiss notice"
              style={{ background: 'none', border: 'none', color: '#065f46', cursor: 'pointer', fontWeight: 700 }}
            >
              ×
            </button>
          </div>
        )}

        {error && <div className="admin-login-error">{error}</div>}
        
        <form className="admin-login-form" onSubmit={handleLogin}>
          <FormInput
            id="admin-email"
            type="email"
            label="Admin Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@teamforge.io"
            autoComplete="email"
            required
          />
          <FormInput
            id="admin-password"
            type="password"
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
          <button type="submit" className="admin-login-btn" disabled={loading}>
            {loading ? 'Authenticating...' : 'Secure Sign In'}
          </button>
        </form>
        
        <div className="admin-login-hint">
          Authorized personnel only. All access attempts are logged.
          <br /><br />
          Hint: admin@teamforge.io / admin123
          <br />
          Super User: superuser@teamforge.io / Super@123
        </div>
      </div>
    </div>
  );
};

const AdminLogin = AdminLoginContent;
export default AdminLogin;
