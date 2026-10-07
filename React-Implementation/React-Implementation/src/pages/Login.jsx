import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { usersApi } from '../services/usersApi';
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

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (email && password) {
        const users = await usersApi.list();
        const normalizedIdentity = email.trim().toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
        const matchedUser = (Array.isArray(users) ? users : []).find((candidate) => {
          const normalizedEmail = String(candidate.email || "").toLocaleLowerCase();
          const normalizedName = String(candidate.name || "")
            .toLocaleLowerCase()
            .replace(/[^a-z0-9]/g, "");
          const normalizedUsername = (candidate.username || normalizedEmail.split("@")[0] || "")
            .toLocaleLowerCase()
            .replace(/[^a-z0-9]/g, "");

          return normalizedEmail === email.trim().toLocaleLowerCase()
            || normalizedName === normalizedIdentity
            || normalizedUsername === normalizedIdentity;
        });

        if (!matchedUser) {
          setError('No account matches that username or email.');
          return;
        }

        if (matchedUser.password && matchedUser.password !== password) {
          setError('Incorrect password. Please try again.');
          return;
        }

        login(matchedUser);
        navigate('/dashboard');
      } else {
        setError('Please enter both email and password.');
      }
    } catch (err) {
      setError(err.message || 'Login failed');
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
          
          <div id="login-view" className="view-section">
            <h1 className="main-title uppercase">WELCOME BACK!</h1>
            <p className="subtitle">
              Don't have a account, <span onClick={() => navigate('/signup')} style={{ cursor: 'pointer', color: '#514639', fontWeight: 700 }}>Sign up</span>
            </p>
            
            {error && <div className="error-message">{error}</div>}

            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="input-group">
                <label>Username / Email</label>
                <input 
                  type="text" 
                  autoComplete="username"
                  placeholder="username or name@example.com"
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
                    placeholder="••••••"
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

              <div className="options-row">
                <label className="remember-me">
                  <input type="radio" name="remember" />
                  <span>Remember me</span>
                </label>
                <a href="#" className="forgot-password">Forget password?</a>
              </div>

              <button type="submit" className="btn-primary">Sign In</button>
            </form>

            <div className="divider">
              <span>or continue with</span>
            </div>

            <div className="social-login">
              <button className="btn-social">
                <GoogleIcon /> Sign in with google
              </button>
              <button className="btn-social">
                <GithubIcon /> Sign in with github
              </button>
            </div>
          </div>
        </div>
        
        <div className="image-section">
          {/* Note: Updated path based on previous dir output where assets are usually mapped via public. If standard vite: /Assets/login_sin.jpg */}
          <img src="/Assets/login_sin.jpg" alt="Developer Illustration" />
        </div>
      </div>
    </div>
  );
};

export default Login;
