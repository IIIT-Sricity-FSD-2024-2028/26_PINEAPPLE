const fs = require('fs');
const path = require('path');

// 1. Update FirebaseService.ts
const fbServicePath = path.resolve(__dirname, '../back-end/src/firebase/firebase.service.ts');
let fbService = fs.readFileSync(fbServicePath, 'utf8');

if (!fbService.includes('seedDefaultAdminAccounts')) {
  fbService = fbService.replace(
    '  onModuleInit() {\n    this.initializeFirebase();\n  }',
    `  async onModuleInit() {
    this.initializeFirebase();
    await this.seedDefaultAdminAccounts().catch((err) => {
      this.logger.warn(\`Firebase admin auto-seed skipped: \${err?.message}\`);
    });
  }`
  );

  const seedMethod = `
  async seedDefaultAdminAccounts() {
    if (!this.initialized || !this.app) return;
    const accounts = [
      {
        uid: 'u-superuser',
        email: 'superuser@teamforge.io',
        password: 'Super@123',
        displayName: 'Super User',
        role: 'superuser',
        permissions: ['*'],
      },
      {
        uid: 'u-admin',
        email: 'admin@teamforge.io',
        password: 'admin123',
        displayName: 'Admin User',
        role: 'admin',
        permissions: ['*'],
      },
    ];

    for (const acc of accounts) {
      try {
        let user: any;
        try {
          user = await this.auth.getUserByEmail(acc.email);
        } catch (e: any) {
          if (e.code === 'auth/user-not-found') {
            user = await this.auth.createUser({
              uid: acc.uid,
              email: acc.email,
              password: acc.password,
              displayName: acc.displayName,
            });
            this.logger.log(\`Created Firebase admin account for \${acc.email}\`);
          } else {
            throw e;
          }
        }
        await this.auth.setCustomUserClaims(user.uid, {
          name: acc.displayName,
          role: acc.role,
          portalRole: acc.role,
          permissions: acc.permissions,
        });
      } catch (err: any) {
        this.logger.warn(\`Could not sync Firebase admin account \${acc.email}: \${err.message}\`);
      }
    }
  }
`;

  fbService = fbService.replace('  isEmulator(): boolean {', seedMethod + '\n  isEmulator(): boolean {');
  fs.writeFileSync(fbServicePath, fbService, 'utf8');
  console.log('Updated FirebaseService.ts');
}

// 2. Update AdminLogin.jsx
const adminLoginPath = path.resolve(__dirname, '../React-Implementation/React-Implementation/src/pages/admin/AdminLogin.jsx');

const updatedAdminLogin = `import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, signOut as fbSignOut } from 'firebase/auth';
import { auth } from '../../services/firebase.js';
import { getAuthMode, setAccessToken } from '../../services/apiClient.js';
import adminApi from '../../services/adminApi';
import FormInput from '../../components/common/FormInput';
import './AdminLogin.css';

const TeamForgeLogo = () => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
  </svg>
);

const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
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
          sessionStorage.setItem('teamforge.adminToken', tokenResult.token);
          sessionStorage.setItem('teamforge.portalRole', role === 'superuser' ? 'superuser' : 'admin');
          sessionStorage.setItem('teamforge.adminEmail', userCred.user.email);
          sessionStorage.setItem('teamforge.adminPermissions', JSON.stringify(perms));
          sessionStorage.setItem('teamforge.adminName', userCred.user.displayName || 'Admin');
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
      sessionStorage.setItem('teamforge.adminToken', response.token || 'mock_admin_token');
      sessionStorage.setItem('teamforge.portalRole', response.role || 'admin');
      sessionStorage.setItem('teamforge.adminEmail', cleanEmail);
      sessionStorage.setItem('teamforge.adminPermissions', JSON.stringify(response.permissions || []));
      sessionStorage.setItem('teamforge.adminName', response.name || 'Admin');
      setAccessToken(response.token || null);
      
      // Redirect to admin dashboard
      navigate('/admin');
    } catch (err) {
      console.error('Admin login failed:', err);
      const code = err.code || '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
        setError('Incorrect password. Please verify your credentials and try again.');
      } else if (code === 'auth/user-not-found') {
        setError('Admin account not found. Please verify your email.');
      } else {
        setError(err.message || 'Invalid credentials. Please try again.');
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
`;

fs.writeFileSync(adminLoginPath, updatedAdminLogin, 'utf8');
console.log('Updated AdminLogin.jsx');
