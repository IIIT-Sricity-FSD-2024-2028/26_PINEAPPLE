import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import SuspendedAccountPanel from '../components/common/SuspendedAccountPanel';
import storage from '../utils/storage';
import { setAccessToken } from '../services/apiClient';
import tokenManager from '../services/tokenManager';
import './Auth.css';

const Suspended = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [info] = useState(() => {
    if (location.state?.suspendedInfo) {
      return location.state.suspendedInfo;
    }
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem('teamforge_suspended_info');
        if (stored) return JSON.parse(stored);
      } catch {
        // ignore
      }
    }
    return {
      reason: 'Your account has been suspended by administration.',
      suspendedAt: new Date().toISOString(),
      suspensionType: 'manual',
      appealAvailable: false,
      supportContact: 'support@teamforge.io',
    };
  });

  useEffect(() => {
    // Clear all auth sessions on arrival
    storage.clearUserSessionKeys();
    storage.clearAdminSession();
    setAccessToken(null);
    tokenManager.clear();
  }, []);

  const handleBackToLogin = () => {
    try {
      sessionStorage.removeItem('teamforge_suspended_info');
    } catch {
      // ignore
    }
    navigate('/login');
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-container" style={{ maxWidth: '480px', margin: '40px auto' }}>
        <div className="form-section" style={{ width: '100%' }}>
          <div className="auth-header">
            <div className="brand-group">
              <div className="logo-placeholder">TF</div>
              <h2>TeamForge</h2>
            </div>
          </div>

          <div className="view-section">
            <SuspendedAccountPanel info={info} />

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={handleBackToLogin}
                data-testid="back-to-login-btn"
                style={{ width: '100%' }}
              >
                Back to login
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Suspended;
