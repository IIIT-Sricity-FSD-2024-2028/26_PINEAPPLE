import { useState, useEffect, useContext, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import authApi from '../services/authApi';
import './Auth.css';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const token = (searchParams.get('token') || '').trim();
  const { updateUser, refreshUser, user } = useContext(AuthContext);
  const updateUserRef = useRef(updateUser);
  const refreshUserRef = useRef(refreshUser);
  const hasUserRef = useRef(Boolean(user));
  useEffect(() => {
    updateUserRef.current = updateUser;
    refreshUserRef.current = refreshUser;
    hasUserRef.current = Boolean(user);
  }, [updateUser, refreshUser, user]);

  const [status, setStatus] = useState(() => (token ? 'verifying' : 'missing'));
  const [message, setMessage] = useState(() =>
    token ? 'Verifying your email address...' : 'Missing verification token in the link.'
  );

  useEffect(() => {
    if (!token) return;
    let active = true;

    authApi
      .verifyEmail(token)
      .then(async (res) => {
        if (!active) return;
        setStatus('success');
        setMessage(res?.message || 'Your email address has been verified.');
        if (typeof refreshUserRef.current === 'function') {
          await refreshUserRef.current().catch(() => {});
        }
        if (hasUserRef.current && updateUserRef.current) {
          updateUserRef.current({
            emailVerified: true,
            emailVerifiedAt: res?.user?.emailVerifiedAt || new Date().toISOString(),
          });
        }
      })
      .catch((err) => {
        if (!active) return;
        setStatus('error');
        setMessage(err?.message || 'This verification link is invalid, already used, or expired.');
      });

    return () => {
      active = false;
    };
  }, [token]);

  return (
    <div className="auth-container">
      <div className="auth-card" style={{ maxWidth: '460px', textAlign: 'center' }} data-testid="verify-email-page">
        <div className="auth-header">
          <div className="auth-logo">TF</div>
          <h1 className="auth-title">
            {status === 'success'
              ? 'Email Verified'
              : status === 'error' || status === 'missing'
              ? 'Verification Issue'
              : 'Verifying Email'}
          </h1>
        </div>

        <p
          data-testid="verify-email-result-msg"
          style={{
            padding: '0.9rem 1rem',
            borderRadius: '8px',
            marginBottom: '1.25rem',
            backgroundColor:
              status === 'success' ? '#ecfdf5' : status === 'verifying' ? '#eff6ff' : '#fef2f2',
            color: status === 'success' ? '#065f46' : status === 'verifying' ? '#1e40af' : '#991b1b',
            border: `1px solid ${
              status === 'success' ? '#a7f3d0' : status === 'verifying' ? '#bfdbfe' : '#fecaca'
            }`,
          }}
        >
          {message}
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to={user ? '/dashboard' : '/login'} className="btn btn-primary">
            {user ? 'Go to Dashboard' : 'Continue to Login'}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
