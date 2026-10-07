import { useContext } from 'react';
import './sidebar.css';
import { useNavigate } from "react-router-dom";
import { RoleContext } from "../context/RoleContext";


const pages = [
  {
    title: 'Dashboard',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"></rect>
        <rect x="14" y="3" width="7" height="7"></rect>
        <rect x="14" y="14" width="7" height="7"></rect>
        <rect x="3" y="14" width="7" height="7"></rect>
      </svg>
    ),
    link: '/dashboard',
  },
  {
    title: 'Leaderboard',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20V10"></path>
        <path d="M18 20V4"></path>
        <path d="M6 20v-4"></path>
      </svg>
    ),
    link: '/leaderboard',
  },
  {
    title: 'Notifications',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
      </svg>
    ),
    link: '/notifications',
  },
  {
    title: 'Profile',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
      </svg>
    ),
    link: '/profile',
  },
  {
    title: 'Settings',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
      </svg>
    ),
    link: '/settings',
  },
  {
    title: 'Help & Support',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>
    ),
    link: '/help',
  },
];

const Sidebar = ({ isOpen }) => {
  const navigate = useNavigate();
  const { currentRole } = useContext(RoleContext);

  const isOwner = currentRole === 'Project Owner';

  function handleNavigate(link) {
    if (link === '/dashboard' && isOwner) {
      navigate('/owner/dashboard');
    } else {
      navigate(link);
    }
  }

  return (
    <aside className={`sidebar ${isOpen ? 'open' : 'closed'}`}>
      <div className="sidebar-section">
        {isOpen && <h3 className="section-title">GLOBAL</h3>}
        
        <ul className="nav-list">
          {pages.map((page, index) => (
            <li key={index} className="nav-item" onClick={() => handleNavigate(page.link)}>
              <span className="nav-link">
                <span className="icon-wrapper">{page.icon}</span>
                {isOpen && <span className="nav-text">{page.title}</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {isOwner ? (
        <div className="sidebar-section">
          {isOpen && <h3 className="section-title">PROJECT OWNER</h3>}
          <ul className="nav-list">
            <li className="nav-item" onClick={() => handleNavigate('/create-project')}>
              <span className="nav-link">
                <span className="icon-wrapper icon-yellow">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </span>
                {isOpen && <span className="nav-text">Create Project</span>}
              </span>
            </li>
            <li className="nav-item" onClick={() => handleNavigate('/my-projects')}>
              <span className="nav-link">
                <span className="icon-wrapper icon-green">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                  </svg>
                </span>
                {isOpen && <span className="nav-text">My Projects</span>}
              </span>
            </li>
            <li className="nav-item" onClick={() => handleNavigate('/mentors')}>
              <span className="nav-link">
                <span className="icon-wrapper icon-purple">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </span>
                {isOpen && <span className="nav-text">Mentors</span>}
              </span>
            </li>
          </ul>
        </div>
      ) : (
        <div className="sidebar-section">
          {isOpen && <h3 className="section-title">COLLABORATOR</h3>}
          <ul className="nav-list">
            <li className="nav-item" onClick={() => handleNavigate('/projects')}>
              <span className="nav-link">
                <span className="icon-wrapper icon-yellow">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                  </svg>
                </span>
                {isOpen && <span className="nav-text">Projects</span>}
              </span>
            </li>
            <li className="nav-item" onClick={() => handleNavigate('/applied-projects')}>
              <span className="nav-link">
                <span className="icon-wrapper icon-green">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zM9 17l-5-5 1.41-1.41L9 14.17l7.59-7.59L18 8l-9 9z"></path>
                  </svg>
                </span>
                {isOpen && <span className="nav-text">Applied Projects</span>}
              </span>
            </li>
            <li className="nav-item" onClick={() => handleNavigate('/my-work')}>
              <span className="nav-link">
                <span className="icon-wrapper icon-purple">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                  </svg>
                </span>
                {isOpen && <span className="nav-text">My Work</span>}
              </span>
            </li>
          </ul>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
