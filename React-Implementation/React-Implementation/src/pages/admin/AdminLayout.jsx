import { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logoutAdminPortal } from '../../store/thunks/sessionThunks.js';
import { fetchOpenReportsCount } from '../../store/thunks/reportsThunks.js';
import { selectOpenReportsCount } from '../../store/selectors/reportsSelectors.js';
import {
  canAccess,
  selectIsSuperUser,
  selectSession,
} from '../../store/selectors/sessionSelectors.js';
import './AdminLayout.css';

const AdminLayoutContent = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const openReportsCount = useSelector(selectOpenReportsCount);
  const sessionState = useSelector(selectSession);
  const isSuperUser = useSelector(selectIsSuperUser);

  const handleExit = async () => {
    await dispatch(logoutAdminPortal());
    navigate('/', { replace: true });
  };

  const hasPermission = (key) => canAccess(sessionState, key);

  const canAccessReports = hasPermission('reports');

  useEffect(() => {
    if (!canAccessReports) return;
    dispatch(fetchOpenReportsCount());
  }, [canAccessReports, dispatch]);

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
        
        {hasPermission('dashboard') && (
          <NavLink end to="/admin" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            📊 Dashboard
          </NavLink>
        )}
        {hasPermission('users') && (
          <NavLink to="/admin/users" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            👥 Users
          </NavLink>
        )}
        {hasPermission('projects') && (
          <NavLink to="/admin/projects" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            📁 Projects
          </NavLink>
        )}
        {hasPermission('mentor_apps') && (
          <NavLink to="/admin/mentor-apps" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            📋 Mentor Applications
          </NavLink>
        )}
        {hasPermission('revenue') && (
          <NavLink to="/admin/mentor-revenue" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            💰 Revenue &amp; Escrow
          </NavLink>
        )}
        {hasPermission('reports') && (
          <NavLink to="/admin/reports" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <span>🚩 Reports &amp; Appeals</span>
            {openReportsCount > 0 && (
              <span
                data-testid="admin-reports-count-badge"
                className="admin-badge-count"
                style={{
                  marginLeft: 'auto',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  borderRadius: '999px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '1px 7px',
                }}
              >
                {openReportsCount}
              </span>
            )}
          </NavLink>
        )}
        {hasPermission('support') && (
          <NavLink to="/admin/support" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            🛟 Support Inbox
          </NavLink>
        )}
        {hasPermission('audit') && (
          <NavLink to="/admin/audit" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            📜 Audit Log
          </NavLink>
        )}

        {!isSuperUser && (
          <NavLink to="/admin/su-config" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            ⏱️ Scheduled Jobs
          </NavLink>
        )}

        {isSuperUser && (
          <div className="su-only-nav">
            <div className="admin-nav-divider">Super User</div>
            <NavLink to="/admin/su-admins" className={({ isActive }) => `admin-nav-item su-nav-item ${isActive ? 'active' : ''}`}>
              🔐 Manage Admins
            </NavLink>
            <NavLink to="/admin/su-config" className={({ isActive }) => `admin-nav-item su-nav-item ${isActive ? 'active' : ''}`}>
              ⚙️ Platform Config &amp; Jobs
            </NavLink>
          </div>
        )}

        <div className="flex-spacer"></div>
        <button className="admin-nav-item admin-exit-btn" onClick={handleExit}>
          ← Exit Portal
        </button>
      </aside>
      
      <main className="admin-main-content">
        <Outlet />
      </main>
    </div>
  );
};

const AdminLayout = AdminLayoutContent;
export default AdminLayout;
