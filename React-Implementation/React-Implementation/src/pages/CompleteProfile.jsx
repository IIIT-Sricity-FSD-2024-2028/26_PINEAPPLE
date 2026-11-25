import { useState, useEffect, useContext } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { usersApi } from '../services/usersApi';
import { authApi } from '../services/authApi';
import './completeProfile.css';

const CompleteProfile = () => {
  const { user, isAuthenticated, loading, status, updateUser, refreshUser } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();

  const initialName = location.state?.name || user?.name || '';
  const [name, setName] = useState(initialName);
  const [username, setUsername] = useState('');
  const [university, setUniversity] = useState('');

  useEffect(() => {
    if (!name && (user?.name || user?.email)) {
      setName(user.name || user.email.split('@')[0] || '');
    }
  }, [user, name]);

  const [asyncAvailability, setAsyncAvailability] = useState({
    checkedUsername: '',
    available: null,
  });
  const [conflictUsername, setConflictUsername] = useState('');
  const [generalError, setGeneralError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const cleanUsername = (username || '').trim().toLowerCase();
  const isFormatValid = /^[a-zA-Z0-9_-]{3,30}$/.test(cleanUsername);

  let usernameStatus = 'idle';
  let usernameMessage = '';

  if (!cleanUsername) {
    usernameStatus = 'idle';
    usernameMessage = '';
  } else if (!isFormatValid) {
    usernameStatus = 'invalid';
    usernameMessage = 'Username must be 3-30 characters (letters, numbers, _, -)';
  } else if (conflictUsername && conflictUsername === cleanUsername) {
    usernameStatus = 'taken';
    usernameMessage = 'This username is already taken';
  } else if (asyncAvailability.checkedUsername === cleanUsername) {
    if (asyncAvailability.available === true) {
      usernameStatus = 'available';
      usernameMessage = 'Username is available';
    } else if (asyncAvailability.available === false) {
      usernameStatus = 'taken';
      usernameMessage = 'This username is already taken';
    }
  } else {
    usernameStatus = 'checking';
    usernameMessage = 'Checking availability...';
  }

  // Debounced availability check
  useEffect(() => {
    if (!cleanUsername || !isFormatValid) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await usersApi.checkUsernameAvailable(cleanUsername);
        setAsyncAvailability({
          checkedUsername: cleanUsername,
          available: res?.available !== false,
        });
      } catch (err) {
        console.warn('[CompleteProfile] Availability check error:', err);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [cleanUsername, isFormatValid]);

  // Auth & Profile Complete Guards
  if (loading || status === 'loading') {
    return (
      <div className="complete-profile-wrapper">
        <div className="complete-profile-loading">Loading account...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.profileComplete === true) {
    return <Navigate to="/dashboard" replace />;
  }

  const isFormValid =
    name.trim().length >= 2 &&
    usernameStatus === 'available' &&
    !submitting;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError('');

    const cleanUsername = (username || '').trim().toLowerCase();
    const cleanName = (name || '').trim();

    if (!cleanName) {
      setGeneralError('Please enter your full name.');
      return;
    }

    if (!cleanUsername) {
      setGeneralError('Please choose a username.');
      return;
    }

    if (usernameStatus === 'taken') {
      setGeneralError('This username is already taken.');
      return;
    }

    if (usernameStatus === 'invalid') {
      setGeneralError('Username must be 3-30 characters (letters, numbers, _, -).');
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        name: cleanName,
        username: cleanUsername,
        university: university.trim() || undefined,
        role: 'Collaborator',
      };

      const res = await authApi.createProfile(payload);

      if (typeof refreshUser === 'function') {
        await refreshUser().catch(() => {});
      } else {
        updateUser({
          ...(res || {}),
          name: cleanName,
          username: cleanUsername,
          profileComplete: true,
          needsUsernameConfirmation: false,
        });
      }

      navigate('/dashboard', { replace: true });
    } catch (err) {
      const code = err?.code || err?.data?.code;
      const errField = err?.field || err?.data?.field;
      const msg = err.message || 'Failed to complete profile. Please try again.';
      if (code === 'CONTENT_NOT_ALLOWED') {
        setGeneralError(errField ? `${errField}: ${msg}` : msg);
      } else if (msg.toLowerCase().includes('already taken') || err.status === 409) {
        setConflictUsername(cleanUsername);
        setGeneralError('This username is already taken. Please choose another.');
      } else {
        setGeneralError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="complete-profile-wrapper">
      <div className="complete-profile-card">
        <div className="complete-profile-header">
          <div className="complete-profile-badge">Step 2 of 2</div>
          <h1 className="complete-profile-title">Complete Your Profile</h1>
          <p className="complete-profile-subtitle">
            Welcome to TeamForge! Please choose a unique username and confirm your details before continuing.
          </p>
        </div>

        {generalError && (
          <div className="complete-profile-error" role="alert">
            {generalError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="complete-profile-form" noValidate>
          <div className="form-group">
            <label htmlFor="username-input" className="form-label">
              Username <span className="required-star">*</span>
            </label>
            <div
              className={`username-input-box input-with-status ${
                usernameStatus === 'available' ? 'is-valid' : ''
              } ${usernameStatus === 'taken' || usernameStatus === 'invalid' ? 'is-invalid' : ''} ${
                usernameStatus === 'checking' ? 'is-checking' : ''
              } ${submitting ? 'is-disabled' : ''}`}
            >
              <span className="username-at" aria-hidden="true">@</span>
              <input
                id="username-input"
                type="text"
                className={`form-input username-field ${
                  usernameStatus === 'available' ? 'is-valid' : ''
                } ${usernameStatus === 'taken' || usernameStatus === 'invalid' ? 'is-invalid' : ''}`}
                placeholder="unique_username"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                autoComplete="off"
                autoFocus
                required
                disabled={submitting}
              />
              {usernameStatus === 'checking' && (
                <span className="status-indicator checking" title="Checking...">
                  ⟳
                </span>
              )}
              {usernameStatus === 'available' && (
                <span className="status-indicator valid" title="Available">
                  ✓
                </span>
              )}
              {(usernameStatus === 'taken' || usernameStatus === 'invalid') && (
                <span className="status-indicator invalid" title="Unavailable">
                  ✕
                </span>
              )}
            </div>
            {usernameMessage && (
              <span
                className={`field-hint ${
                  usernameStatus === 'available'
                    ? 'hint-success'
                    : usernameStatus === 'checking'
                    ? 'hint-checking'
                    : 'hint-error'
                }`}
                role={usernameStatus === 'taken' || usernameStatus === 'invalid' ? 'alert' : 'status'}
              >
                {usernameMessage}
              </span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="name-input" className="form-label">
              Full Name <span className="required-star">*</span>
            </label>
            <input
              id="name-input"
              type="text"
              className="form-input"
              placeholder="e.g. Jane Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="university-input" className="form-label">
              University / Institution <span className="optional-tag">(Optional)</span>
            </label>
            <input
              id="university-input"
              type="text"
              className="form-input"
              placeholder="e.g. Stanford University"
              value={university}
              onChange={(e) => setUniversity(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="btn-complete-profile"
            disabled={!isFormValid}
          >
            {submitting ? 'Saving Profile...' : 'Complete Profile & Continue →'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CompleteProfile;
