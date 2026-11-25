import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, signOut as fbSignOut } from 'firebase/auth';
import { auth } from '../../services/firebase.js';
import { getAuthMode, setAccessToken } from '../../services/apiClient.js';
import adminApi from '../../services/adminApi';
import FormInput from '../../components/common/FormInput';
import SuspendedAccountPanel from '../../components/common/SuspendedAccountPanel';
import storage from '../../utils/storage';
import './AdminLogin.css';

const TeamForgeLogo = () => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
  </svg>
);

const AdminLogin = () => {
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [suspendedInfo, setSuspendedInfo] = useState(() => {
    if (location.state?.suspendedInfo) return location.state.suspendedInfo;
    try {
      if (typeof window !== 'undefined') {
        const stored = sessionStorage.getItem('teamforge_suspended_info');
        if (stored) return JSON.parse(stored);
      }
    } catch {
      // ignore
    }
    return null;
  });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(() => {
    if (location.state?.serverRestartMessage) return location.state.serverRestartMessage;
    if (location.state?.demoResetMessage) return location.state.demoResetMessage;
    return storage.consumeServerRestartNotice() || storage.consumeDemoResetNotice() || '';
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError('Email and password are required');
      return;
    }

    setLoading(true);
    try {
      const mode = getAuthMode();
      if (mode === 'firebase') {
        try {
          const userCred = await signInWithEmailAndPassword(auth, cleanEmail, password);
          const tokenResult = await userCred.user.getIdTokenResult(true);
          const role = (tokenResult.claims.role || tokenResult.claims.portalRole || '').toLowerCase();
          if (!['admin', 'superuser', 'portal_admin'].includes(role)) {
            await fbSignOut(auth);
            throw new Error('This account does not have administrator portal privileges.');
          }
          const perms = tokenResult.claims.permissions || ['*'];
          storage.setAdminSession({
            token: tokenResult.token,
            portalRole: role === 'superuser' ? 'superuser' : 'admin',
            email: userCred.user.email,
            permissions: perms,
            name: userCred.user.displayName || 'Admin',
          });
          setAccessToken(tokenResult.token);
          navigate('/admin');
          return;
        } catch (fbErr) {
          console.warn('[AdminLogin] Firebase auth error, attempting backend portal auth fallback:', fbErr?.code || fbErr?.message);
          if (fbErr?.message?.includes('portal privileges')) {
            throw fbErr;
          }
        }
      }

      // Backend adminApi login (works for JWT mode and seamless fallback)
      const response = await adminApi.login({ email: cleanEmail, password });
      
      // Store token or session info securely
      storage.setAdminSession({
        token: response.token || 'mock_admin_token',
        portalRole: response.role || 'admin',
        email: cleanEmail,
        permissions: response.permissions || [],
        name: response.name || 'Admin',
      });
      setAccessToken(response.token || null);
      
      // Redirect to admin dashboard
      navigate('/admin');
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
        setSuspendedInfo(info);
        setPassword('');
        setError('');
        return;
      }
      const code = err?.code || err?.data?.code || '';
      const msg = String(err?.message || '');
      if (msg.toLowerCase().includes('suspended') || msg.toLowerCase().includes('disabled')) {
        setError('This admin account is suspended or disabled. Contact super user.');
      } else if (
        code === 'TOO_MANY_ATTEMPTS' ||
        err?.statusCode === 429 ||
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
            onDismiss={() => setSuspendedInfo(null)}
          />
        )}

        {notice && (
          <div
            role="status"
            data-testid="demo-reset-login-notice"
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
            <span>{notice}</span>
            <button
              type="button"
              onClick={() => setNotice('')}
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

export default AdminLogin;
