import { useState, useRef, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { RoleContext } from '../context/RoleContext';
import { NotificationContext } from '../context/NotificationContext';
import Avatar from './common/Avatar';
import './navbar.css';

const Navbar = ({ onMenuClick }) => {
  const navigate = useNavigate();
  const { user, logout } = useContext(AuthContext);
  const { currentRole, switchRole, isMentorApproved, mentorAppStatus } = useContext(RoleContext);
  const { unreadCount } = useContext(NotificationContext) || {};

  const [roleOpen, setRoleOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const roleDropdownRef = useRef(null);
  const profileDropdownRef = useRef(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        roleDropdownRef.current &&
        !roleDropdownRef.current.contains(event.target)
      ) {
        setRoleOpen(false);
      }
      if (
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(event.target)
      ) {
        setProfileOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleRoleSelect = (newRole) => {
    if (newRole === 'Mentor' && !isMentorApproved) {
      setRoleOpen(false);
      navigate('/mentor/apply');
      return;
    }
    const success = switchRole(newRole);
    setRoleOpen(false);
    if (!success && newRole === 'Mentor') {
      navigate('/mentor/apply');
      return;
    }
    if (newRole === 'Mentor') {
      navigate('/mentor/projects');
    } else if (newRole === 'Project Owner') {
      navigate('/owner/dashboard');
    } else if (newRole === 'Collaborator') {
      navigate('/dashboard');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const activeRoleName = currentRole || 'Collaborator';
  const roleClassModifier = activeRoleName.toLowerCase().replace(/\s+/g, '-');

  const displayName = user?.name || user?.profile?.fullName || user?.username || 'User';
  const avatarUrl = user?.avatarUrl || user?.profile?.avatarUrl;
  const apiBase = 'http://localhost:3000';
  const fullAvatarUrl = avatarUrl
    ? avatarUrl.startsWith('http') || avatarUrl.startsWith('data:') || avatarUrl.startsWith('blob:')
      ? avatarUrl
      : `${apiBase}${avatarUrl}`
    : null;

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <button type="button" className="menu-btn" onClick={onMenuClick}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 6H20M4 12H20M4 18H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="navbar-brand" onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
          <div className="logo-box">TF</div>
          <span className="brand-name">TeamForge</span>
        </div>
      </div>

      <div className="navbar-right">
        {/* Role Switcher Dropdown */}
        <div className="dropdown-container" ref={roleDropdownRef}>
          <button
            type="button"
            className={`role-btn ${roleClassModifier}`}
            onClick={() => {
              setRoleOpen((prev) => !prev);
              setProfileOpen(false);
            }}
          >
            {activeRoleName}
            <svg className={`chevron-down ${roleOpen ? 'rotated' : ''}`} viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>

          <div className={`dropdown-menu role-menu ${roleOpen ? 'show' : ''}`}>
            <div className="dropdown-header">SWITCH ROLE</div>

            <div
              className={`dropdown-item ${activeRoleName === 'Collaborator' ? 'active' : ''}`}
              onClick={() => handleRoleSelect('Collaborator')}
            >
              <span className="dot blue"></span>
              <span className="role-name">Collaborator</span>
              {activeRoleName === 'Collaborator' && <span className="status-text">Active</span>}
            </div>

            <div
              className={`dropdown-item ${activeRoleName === 'Project Owner' ? 'active' : ''}`}
              onClick={() => handleRoleSelect('Project Owner')}
            >
              <span className="dot brown"></span>
              <span className="role-name">Project Owner</span>
              {activeRoleName === 'Project Owner' && <span className="status-text">Active</span>}
            </div>

            <div
              className={`dropdown-item ${activeRoleName === 'Mentor' ? 'active' : ''}`}
              onClick={() => handleRoleSelect('Mentor')}
            >
              {isMentorApproved ? (
                <span className="star-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#f5b041">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </span>
              ) : (
                <span className="star-icon" style={{ fontSize: '13px' }}>🔒</span>
              )}
              <span className="role-name">Mentor</span>
              {activeRoleName === 'Mentor' ? (
                <span className="status-text">Active</span>
              ) : isMentorApproved ? (
                <span className="status-text brown-text">Unlocked</span>
              ) : (
                <span className="status-text" style={{ color: '#94a3b8' }}>
                  {mentorAppStatus === 'pending'
                    ? 'Pending'
                    : mentorAppStatus === 'rejected'
                    ? 'Rejected'
                    : 'Locked'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="nav-actions">
          {/* Notifications Icon Button */}
          <button
            type="button"
            className="icon-btn notification-btn"
            onClick={() => navigate('/notifications')}
            title={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : "Notifications"}
            aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadCount > 0 && (
              <span className="nav-notif-badge" title={`${unreadCount} unread`}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Profile Dropdown */}
          <div className="dropdown-container" ref={profileDropdownRef}>
            <div
              className="user-profile"
              onClick={() => {
                setProfileOpen((prev) => !prev);
                setRoleOpen(false);
              }}
            >
              <Avatar
                src={fullAvatarUrl}
                name={displayName}
                size="sm"
                alt={displayName}
              />
              <span className="username">{displayName}</span>
              <svg className={`chevron-down small ${profileOpen ? 'rotated' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>

            <div className={`dropdown-menu profile-menu ${profileOpen ? 'show' : ''}`}>
              <div className="profile-info">
                <div className="profile-name">{displayName}</div>
                <div className="profile-role">{activeRoleName}</div>
              </div>
              <div className="dropdown-divider"></div>
              <div
                className="dropdown-item"
                onClick={() => {
                  setProfileOpen(false);
                  navigate('/profile');
                }}
              >
                Profile
              </div>
              <div
                className="dropdown-item"
                onClick={() => {
                  setProfileOpen(false);
                  navigate('/settings');
                }}
              >
                Settings
              </div>
              <div
                className="dropdown-item"
                onClick={() => {
                  setProfileOpen(false);
                  navigate('/help');
                }}
              >
                Help & Support
              </div>
              <div
                className="dropdown-item text-danger"
                onClick={handleLogout}
              >
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
