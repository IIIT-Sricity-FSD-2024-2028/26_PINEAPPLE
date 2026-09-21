import {useNavigate} from "react-router-dom";
import './navbar.css';

const Navbar = ({ onMenuClick }) => {
  const navigate = useNavigate();
  function handleNavigate(link) {
    // Handle link click logic here, e.g., navigate to the link
    navigate(link);
  }
  return (
    <nav className="navbar">
      <div className="navbar-left">
        <button className="menu-btn" onClick={onMenuClick}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 6H20M4 12H20M4 18H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="navbar-brand">
          <div className="logo-box">TF</div>
          <span className="brand-name">TeamForge</span>
        </div>
      </div>
      
      <div className="navbar-right">
        <div className="dropdown-container">
          <button className="role-btn">
            Collaborator 
            <svg className="chevron-down" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
          
          <div className="dropdown-menu role-menu">
            <div className="dropdown-header">SWITCH ROLE</div>
            <div className="dropdown-item active">
              <span className="dot blue"></span>
              <span className="role-name">Collaborator</span>
              <span className="status-text">Active</span>
            </div>
            <div className="dropdown-item">
              <span className="dot brown"></span>
              <span className="role-name">Project Owner</span>
            </div>
            <div className="dropdown-item">
              <span className="star-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#f5b041">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              </span>
              <span className="role-name">Mentor</span>
              <span className="status-text brown-text">Unlocked</span>
            </div>
          </div>
        </div>
        
        <div className="nav-actions">
          <button className="icon-btn notification-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="badge"></span>
          </button>
          
          <div className="dropdown-container">
            <div className="user-profile">
              <div className="avatar">A</div>
              <span className="username">arjunsharma</span>
              <svg className="chevron-down small" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
            
            <div className="dropdown-menu profile-menu">
              <div className="profile-info">
                <div className="profile-name">arjunsharma</div>
              </div>
              <div className="dropdown-divider"></div>
              <div className="dropdown-item" onClick={() => handleNavigate('/profile')}>
                Profile
              </div>
              <div className="dropdown-item" onClick={() => handleNavigate('/settings')}>
                Settings
              </div>
              <div className="dropdown-item" onClick={() => handleNavigate('/help')}>
                Help & Support
              </div>
              <div className="dropdown-item text-danger">
                Logout
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
