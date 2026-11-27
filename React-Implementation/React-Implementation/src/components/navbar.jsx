import { useState, useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { selectUnreadNotificationsCount } from '../store/selectors/notificationsSelectors';
import { selectChatUnreadSummary } from '../store/selectors/communicationSelectors';
import {
  selectActiveRole,
  selectAllowedRoles,
  selectCurrentUser,
  selectIsMentorApproved,
  selectMentorAppStatus,
} from '../store/selectors/sessionSelectors';
import {
  logoutSessionUser,
  switchUserRole,
} from '../store/thunks/sessionThunks';
import { useChatUnreadPolling } from '../hooks/useChatPolling';
import Avatar from './common/Avatar';
import './navbar.css';

const NavbarContent = ({ onMenuClick }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector(selectCurrentUser);
  const isMentorApproved = useSelector(selectIsMentorApproved);
  const mentorAppStatus = useSelector(selectMentorAppStatus);
  const activeRole = useSelector(selectActiveRole);
  const allowedRoles = useSelector(selectAllowedRoles);
  const unreadCount = useSelector(selectUnreadNotificationsCount);
  const chatUnread = useSelector(selectChatUnreadSummary);

  const [roleOpen, setRoleOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const roleDropdownRef = useRef(null);
  const profileDropdownRef = useRef(null);
  const chatDropdownRef = useRef(null);

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
      if (
        chatDropdownRef.current &&
        !chatDropdownRef.current.contains(event.target)
      ) {
        setChatOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useChatUnreadPolling(dispatch, {
    userId: user?.id,
    enabled: Boolean(user?.id),
    intervalMs: 60000,
    immediate: true,
  });

  const handleRoleSelect = async (newRole) => {
    setRoleOpen(false);
    if (newRole === 'Mentor' && !isMentorApproved) {
      navigate('/mentor/apply');
      return;
    }
    const homePath = await dispatch(switchUserRole(newRole)).unwrap().catch(() => null);
    if (homePath) {
      navigate(homePath);
    }
  };

  const handleLogout = async () => {
    await dispatch(logoutSessionUser());
    navigate('/login');
  };

  const activeRoleName = activeRole || 'Collaborator';
  const roleClassModifier = activeRoleName.toLowerCase().replace(/\s+/g, '-');

  const displayName =
    user?.profile?.fullName ||
    user?.fullName ||
    (user?.name && user?.name !== user?.username ? user?.name : null) ||
    user?.name ||
    user?.username ||
    'User';

  const avatarUrl =
    user?.avatarUrl || user?.profile?.avatarUrl || user?.avatar || user?.profile?.avatar || null;
  const avatarVersion = user?.updatedAt || user?.profile?.updatedAt || null;

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
        {allowedRoles && allowedRoles.length > 1 && (
          <div
            className="dropdown-container"
            ref={roleDropdownRef}
            data-testid="navbar-role"
            data-active-role={activeRoleName}
          >
            <button
              type="button"
              className={`role-btn ${roleClassModifier}`}
              data-testid="role-selector-trigger"
              data-active-role={activeRoleName}
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
        )}

        <div className="nav-actions">
          {/* Unread Project Chat Button & Quick Dropdown (Phase 15) */}
          <div className="dropdown-container" ref={chatDropdownRef}>
            <button
              type="button"
              className="icon-btn notification-btn"
              data-testid="navbar-chat-link"
              onClick={() => {
                setChatOpen((prev) => !prev);
                setRoleOpen(false);
                setProfileOpen(false);
              }}
              title={chatUnread.total > 0 ? `${chatUnread.total} unread project chat message${chatUnread.total === 1 ? '' : 's'}` : 'Project Chats'}
              aria-label={chatUnread.total > 0 ? `${chatUnread.total} unread project chat messages` : 'Project Chats'}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              {chatUnread.total > 0 && (
                <span
                  className="nav-notif-badge"
                  data-testid="navbar-chat-badge"
                  title={`${chatUnread.total} unread messages`}
                >
                  {chatUnread.total > 99 ? '99+' : chatUnread.total}
                </span>
              )}
            </button>

            <div
              className={`dropdown-menu chat-menu ${chatOpen ? 'show' : ''}`}
              data-testid="navbar-chat-dropdown"
              style={{ width: '270px', right: 0 }}
            >
              <div className="dropdown-header">Project Chats</div>
              {chatUnread.byProject.length === 0 ? (
                <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.84rem', color: '#64748b' }}>
                  No active project chats yet.
                </div>
              ) : (
                chatUnread.byProject.map((item) => {
                  const baseRoute =
                    activeRoleName === 'Project Owner'
                      ? `/owner/workspace/${item.projectId}?tab=chat`
                      : activeRoleName === 'Mentor'
                        ? `/mentor/workspace/${item.projectId}?tab=chat`
                        : `/workspace/${item.projectId}?tab=chat`;
                  return (
                    <div
                      key={item.projectId}
                      className="dropdown-item"
                      data-testid={`navbar-chat-item-${item.projectId}`}
                      style={{ justifyContent: 'space-between', gap: '8px' }}
                      onClick={() => {
                        setChatOpen(false);
                        navigate(baseRoute);
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.projectTitle}
                      </span>
                      {item.unreadCount > 0 && (
                        <span
                          style={{
                            backgroundColor: '#ef4444',
                            color: '#ffffff',
                            borderRadius: '999px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '1px 7px',
                            flexShrink: 0,
                          }}
                        >
                          {item.unreadCount > 99 ? '99+' : item.unreadCount}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

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
                src={avatarUrl}
                version={avatarVersion}
                name={displayName}
                size="sm"
                alt={displayName}
              />
              <span className="username" title={displayName}>{displayName}</span>
              <svg className={`chevron-down small ${profileOpen ? 'rotated' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>

            <div className={`dropdown-menu profile-menu ${profileOpen ? 'show' : ''}`}>
              <div className="profile-header">
                <div className="profile-name" title={displayName}>{displayName}</div>
                <div className="profile-email" title={user?.email || 'user@teamforge.io'}>{user?.email || 'user@teamforge.io'}</div>
              </div>

              <div className="dropdown-divider"></div>

              <div
                className="dropdown-item"
                onClick={() => {
                  setProfileOpen(false);
                  navigate('/profile');
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span>My Profile</span>
              </div>

              <div
                className="dropdown-item"
                onClick={() => {
                  setProfileOpen(false);
                  navigate('/settings');
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                <span>Settings</span>
              </div>

              <div className="dropdown-divider"></div>

              <div className="dropdown-item logout-item" onClick={handleLogout}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span>Log out</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

const Navbar = NavbarContent;
export default Navbar;
