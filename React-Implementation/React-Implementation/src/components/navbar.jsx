import React, { useState, useRef, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { RoleContext } from '../context/RoleContext';
import './navbar.css';

const Navbar = ({ onMenuClick }) => {
  const navigate = useNavigate();
  const { user, logout } = useContext(AuthContext);
  const { currentRole, switchRole } = useContext(RoleContext);

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
    switchRole(newRole);
    setRoleOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const activeRoleName = currentRole || 'Collaborator';
  const roleClassModifier = activeRoleName.toLowerCase().replace(/\s+/g, '-');

  const displayName = user?.name || user?.profile?.fullName || user?.username || 'User';
  const userInitials = displayName.slice(0, 1).toUpperCase();
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
              <span className="star-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#f5b041">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </span>
              <span className="role-name">Mentor</span>
              {activeRoleName === 'Mentor' ? (
                <span className="status-text">Active</span>
              ) : (
                <span className="status-text brown-text">Unlocked</span>
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
            title="Notifications"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="badge"></span>
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
              <div className="avatar">
                {fullAvatarUrl ? (
                  <img src={fullAvatarUrl} alt={displayName} className="navbar-avatar-img" />
                ) : (
                  userInitials
                )}
              </div>
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
