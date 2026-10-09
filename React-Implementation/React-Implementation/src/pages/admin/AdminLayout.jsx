import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import './AdminLayout.css';

const AdminLayout = () => {
  const navigate = useNavigate();

  const handleExit = () => {
    navigate('/dashboard');
  };

  const portalRole = sessionStorage.getItem('teamforge.portalRole');
  const isSuperUserFlag = sessionStorage.getItem('teamforge.isSuperUser') === 'true';
  const role = sessionStorage.getItem('teamforge.role');
  const isSuperUser = 
    isSuperUserFlag || 
    portalRole?.toLowerCase() === 'superuser' || 
    portalRole?.toLowerCase() === 'super user' ||
    role?.toLowerCase() === 'superuser' ||
    role?.toLowerCase() === 'super user';

  return (
    <div id="admin-dashboard-screen" className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-logo">
          <div className="admin-logo-icon">TF</div>
          <span>Portal</span>
          <span className={`admin-role-badge ${isSuperUser ? 'su-badge' : 'admin-badge'}`}>
            {isSuperUser ? 'Super User' : 'Admin'}
          </span>
        </div>
        
        <NavLink end to="/admin" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
          📊 Dashboard
        </NavLink>
        <NavLink to="/admin/users" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
          👥 Users
        </NavLink>
        <NavLink to="/admin/projects" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
          📁 Projects
        </NavLink>
        <NavLink to="/admin/mentor-apps" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
          📋 Mentor Applications
        </NavLink>
        <NavLink to="/admin/mentor-revenue" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
          💰 Revenue &amp; Escrow
        </NavLink>
        <NavLink to="/admin/audit" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
          📜 Audit Log
        </NavLink>

        {isSuperUser && (
          <div className="su-only-nav">
            <div className="admin-nav-divider">Super User</div>
            <NavLink to="/admin/su-admins" className={({ isActive }) => `admin-nav-item su-nav-item ${isActive ? 'active' : ''}`}>
              🔐 Manage Admins
            </NavLink>
            <NavLink to="/admin/su-config" className={({ isActive }) => `admin-nav-item su-nav-item ${isActive ? 'active' : ''}`}>
              ⚙️ Platform Config
            </NavLink>
          </div>
        )}

        <div className="flex-spacer"></div>
        <button className="admin-nav-item admin-exit-btn" onClick={handleExit}>
          ← Exit Portal
        </button>
      </aside>
      
      <main className="admin-main-content" style={{ flex: 1, overflowY: 'auto' }}>
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
