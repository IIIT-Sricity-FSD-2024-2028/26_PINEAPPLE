import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import adminApi from '../../services/adminApi';
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
    
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }

    setLoading(true);
    try {
      const response = await adminApi.login({ email, password });
      
      // Store token or session info securely
      sessionStorage.setItem('teamforge.adminToken', response.token || 'mock_admin_token');
      sessionStorage.setItem('teamforge.portalRole', response.role || 'admin');
      sessionStorage.setItem('teamforge.adminEmail', email);
      
      // Redirect to admin dashboard
      navigate('/admin/dashboard');
    } catch (err) {
      console.error('Admin login failed:', err);
      setError(err.message || 'Invalid credentials. Please try again.');
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
          <div className="admin-form-group">
            <label htmlFor="admin-email">Admin Email</label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@teamforge.io"
              autoComplete="email"
              required
            />
          </div>
          <div className="admin-form-group">
            <label htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>
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
