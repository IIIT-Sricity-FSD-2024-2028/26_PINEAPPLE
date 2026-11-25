import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile, signInWithPopup } from 'firebase/auth';
import { auth, googleProvider, githubProvider } from '../services/firebase.js';
import { AuthContext } from '../context/AuthContext';
import authApi from '../services/authApi';
import { getAuthMode, setAccessToken } from '../services/apiClient';
import { recordPortalAuditEntry } from '../services/adminApi';
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

const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
    <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
    <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
    <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
  </svg>
);

const GithubIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
  </svg>
);

const Signup = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { login, signup } = useContext(AuthContext);
  const navigate = useNavigate();
  const mode = getAuthMode();

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      if (mode === 'legacy') {
        setError('Google Sign-In is only supported under Firebase mode.');
        setLoading(false);
        return;
      }
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;
      const token = await fbUser.getIdToken();
      setAccessToken(token);

      const me = await authApi.getMe().catch(() => null);
      if (me && me.profileComplete !== false) {
        navigate('/dashboard');
      } else {
        navigate('/complete-profile', {
          state: {
            name: fbUser.displayName || '',
            email: fbUser.email || '',
          },
        });
      }
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user') {
        setLoading(false);
        return;
      }
      setError(err.message || 'Google sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGithubSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      if (mode === 'legacy') {
        setError('GitHub Sign-In is only supported under Firebase mode.');
        setLoading(false);
        return;
      }
      const result = await signInWithPopup(auth, githubProvider);
      const fbUser = result.user;
      const token = await fbUser.getIdToken();
      setAccessToken(token);

      const me = await authApi.getMe().catch(() => null);
      if (me && me.profileComplete !== false) {
        navigate('/dashboard');
      } else {
        navigate('/complete-profile', {
          state: {
            name: fbUser.displayName || '',
            email: fbUser.email || '',
          },
        });
      }
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user') {
        setLoading(false);
        return;
      }
      setError(err.message || 'GitHub sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError("Passwords don't match!");
      return;
    }
    
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    const cleanedEmail = email.trim();
    const emailPrefix = cleanedEmail.split('@')[0]?.trim() || 'User';

    if (!cleanedEmail || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);

    try {
      // 1. JWT Mode
      if (mode === 'jwt') {
        try {
          const createdUser = await signup({
            email: cleanedEmail,
            password,
            role: "Collaborator",
          });
          if (createdUser?.profileComplete === false) {
            navigate('/complete-profile', {
              state: { email: cleanedEmail, name: createdUser?.name || emailPrefix },
            });
          } else {
            navigate('/dashboard');
          }
          return;
        } catch (jwtErr) {
          setError(jwtErr?.message || 'Signup failed');
          return;
        }
      }

      // 2. Firebase Mode
      if (mode === 'firebase') {
        let userCred;
        try {
          userCred = await createUserWithEmailAndPassword(auth, cleanedEmail, password);
        } catch (fbErr) {
          if (fbErr.code === 'auth/email-already-in-use') {
            setError('An account with this email already exists.');
          } else {
            setError(fbErr.message || 'Signup failed');
          }
          return;
        }

        try {
          if (auth.currentUser) {
            await updateProfile(auth.currentUser, { displayName: emailPrefix });
          }

          recordPortalAuditEntry({
            action: 'signup',
            actor: emailPrefix,
            target: 'Account Registration',
            event: `New user "${cleanedEmail}" signed up (${cleanedEmail})`,
            details: { role: 'Collaborator' },
          });

          navigate('/complete-profile', {
            state: { email: cleanedEmail, name: emailPrefix },
          });
          return;
        } catch (profileErr) {
          console.warn('Post-signup step failed; deleting Firebase user to prevent orphan account:', profileErr);
          try {
            if (userCred?.user) {
              await userCred.user.delete();
            }
          } catch (delErr) {
            console.error('Failed to rollback Firebase user:', delErr);
          }
          setError(profileErr.message || 'Signup failed');
          return;
        }
      }

      // 3. Fallback / Auth Signup
      const signupRes = await authApi.signup({
        email: cleanedEmail,
        password,
        role: "Collaborator",
      });
      if (signupRes?.accessToken) {
        setAccessToken(signupRes.accessToken);
      }
      const createdUser = signupRes?.user || signupRes;

      recordPortalAuditEntry({
        action: 'signup',
        actor: createdUser?.name || emailPrefix,
        target: 'Account Registration',
        event: `New user "${createdUser?.name || cleanedEmail}" signed up (${cleanedEmail})`,
        details: { role: 'Collaborator' },
      });

      login(createdUser);
      if (createdUser?.profileComplete === false) {
        navigate('/complete-profile', {
          state: { email: cleanedEmail, name: createdUser?.name || emailPrefix },
        });
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Signup failed');
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
            <button type="button" onClick={() => navigate('/')} className="home-btn">
              <HomeIcon />
            </button>
          </div>
          
          <div id="signup-view" className="view-section">
            <h1 className="main-title">New User?</h1>
            <div style={{ marginBottom: "1rem" }}></div>
            
            {error && <div className="error-message">{error}</div>}

            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="input-group">
                <label>Email Address</label>
                <input 
                  type="email" 
                  autoComplete="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <label>Password</label>
                <div className="password-wrapper">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button 
                    type="button" 
                    className="toggle-password"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <EyeIcon />
                  </button>
                </div>
              </div>

              <div className="input-group">
                <label>Confirm Password</label>
                <div className="password-wrapper">
                  <input 
                    type={showConfirmPassword ? "text" : "password"} 
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  <button 
                    type="button" 
                    className="toggle-password"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    <EyeIcon />
                  </button>
                </div>
              </div>

              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Creating Account...' : 'Sign Up'}
              </button>
            </form>

            <div className="divider">
              <span>or sign up with</span>
            </div>

            <div className="social-login">
              <button type="button" className="btn-social" onClick={handleGoogleSignIn} disabled={loading}>
                <GoogleIcon /> Sign up with google
              </button>
              <button type="button" className="btn-social" onClick={handleGithubSignIn} disabled={loading}>
                <GithubIcon /> Sign up with github
              </button>
            </div>

            <p className="subtitle" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              Already have an account? <span onClick={() => navigate('/login')} style={{ cursor: 'pointer', color: '#514639', fontWeight: 700 }}>Log In</span>
            </p>
          </div>
        </div>
        
        <div className="image-section">
          <img src="/Assets/login_sin.jpg" alt="Developer Illustration" />
        </div>
      </div>
    </div>
  );
};

export default Signup;
