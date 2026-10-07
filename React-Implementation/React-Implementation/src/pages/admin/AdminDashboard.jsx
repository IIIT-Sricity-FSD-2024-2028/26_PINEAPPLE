import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import adminApi from '../../services/adminApi';
import './AdminDashboard.css';

// SVG Components
const TeamForgeLogo = () => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
  </svg>
);

const UsersIcon = () => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
  </svg>
);

const MentorIcon = () => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"/>
  </svg>
);

const WarningIcon = () => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
  </svg>
);

const SecurityIcon = () => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
  </svg>
);

const LogOutIcon = () => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
  </svg>
);

const DashboardIcon = () => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
  </svg>
);

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [auditLog, setAuditLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const role = sessionStorage.getItem('teamforge.portalRole');
  const email = sessionStorage.getItem('teamforge.adminEmail');

  useEffect(() => {
    if (!role) {
      navigate('/admin/login');
      return;
    }
    fetchDashboardData();
  }, [role, navigate]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch stats and audit log concurrently
      const [statsData, auditData] = await Promise.all([
        adminApi.getStats(role),
        adminApi.getAuditLog(role).catch(() => []) // Fallback if not implemented
      ]);
      setStats(statsData);
      setAuditLog(auditData);
    } catch (error) {
      console.error('Error fetching admin data:', error);
      // Generate some mock stats if API fails, just so it's not totally empty during migration testing
      // Remove this fallback in true production if backend is strict
      if (process.env.NODE_ENV === 'development') {
        setStats({
          totalUsers: 145, activeUsers: 130, warnedUsers: 10, suspendedUsers: 5,
          pendingMentorApps: 3, flaggedOrWarned: 15, auditCount: 42
        });
        setAuditLog([
          { type: 'security', event: 'Failed login attempt (admin@teamforge.io)', timestamp: new Date().toISOString() }
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('teamforge.adminToken');
    sessionStorage.removeItem('teamforge.portalRole');
    sessionStorage.removeItem('teamforge.adminEmail');
    navigate('/admin/login');
  };

  const renderSidebar = () => (
    <div className="admin-sidebar">
      <div className="admin-sidebar-header">
        <div className="admin-logo">
          <TeamForgeLogo />
          <span>TeamForge</span>
        </div>
        <div className={`admin-role-badge ${role === 'superuser' ? 'su-badge' : ''}`}>
          {role === 'superuser' ? 'Super User' : 'Admin'}
        </div>
        <div style={{ fontSize: '12px', color: '#8b949e', marginTop: '8px' }}>{email}</div>
      </div>
      <div className="admin-nav">
        <button className={`admin-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
          <DashboardIcon /> Dashboard
        </button>
        <button className={`admin-nav-item ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
          <UsersIcon /> Users
        </button>
        {/* Render other tabs like projects, mentor apps, audit, etc. */}
        <button className={`admin-nav-item ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => setActiveTab('audit')}>
          <SecurityIcon /> Audit Log
        </button>
        
        {role === 'superuser' && (
          <button className={`admin-nav-item ${activeTab === 'config' ? 'active' : ''}`} onClick={() => setActiveTab('config')}>
            <SecurityIcon /> System Config
          </button>
        )}
      </div>
      <div className="admin-sidebar-footer">
        <button className="admin-nav-item danger" onClick={handleLogout}>
          <LogOutIcon /> Exit Portal
        </button>
      </div>
    </div>
  );

  const renderDashboardTab = () => {
    if (loading) return <div className="admin-loading">Loading system data...</div>;
    if (!stats) return <div className="admin-empty">Failed to load dashboard statistics.</div>;

    const activePct = Math.round((stats.activeUsers / stats.totalUsers) * 100) || 0;
    const warnedPct = Math.round((stats.warnedUsers / stats.totalUsers) * 100) || 0;
    const suspendedPct = Math.round((stats.suspendedUsers / stats.totalUsers) * 100) || 0;

    return (
      <div className="admin-content">
        <div className="admin-kpi-grid">
          <div className="admin-kpi-card">
            <div className="admin-kpi-header"><UsersIcon /> Total Users</div>
            <div className="admin-kpi-value">{stats.totalUsers}</div>
            <div className="admin-kpi-sub">{stats.activeUsers} active</div>
          </div>
          <div className="admin-kpi-card">
            <div className="admin-kpi-header"><MentorIcon /> Mentor Apps</div>
            <div className="admin-kpi-value">{stats.pendingMentorApps}</div>
            <div className="admin-kpi-sub">{stats.pendingMentorApps} pending</div>
          </div>
          <div className="admin-kpi-card">
            <div className="admin-kpi-header"><WarningIcon /> Flagged / Warned</div>
            <div className="admin-kpi-value">{stats.flaggedOrWarned}</div>
            <div className="admin-kpi-sub">{stats.suspendedUsers} suspended</div>
          </div>
          <div className="admin-kpi-card">
            <div className="admin-kpi-header"><SecurityIcon /> Audit Events</div>
            <div className="admin-kpi-value">{stats.auditCount || auditLog.length}</div>
            <div className="admin-kpi-sub">{stats.auditCount || auditLog.length} entries</div>
          </div>
        </div>

        <div className="admin-dash-panels">
          <div className="admin-panel">
            <div className="admin-panel-header">Platform Health Overview</div>
            <div className="admin-panel-body">
              <div className="admin-health-row">
                <div className="admin-health-labels">
                  <span>Active Users</span>
                  <span>{stats.activeUsers} / {stats.totalUsers}</span>
                </div>
                <div className="admin-health-track">
                  <div className="admin-health-fill fill-green" style={{ width: `${activePct}%` }}></div>
                </div>
              </div>
              <div className="admin-health-row">
                <div className="admin-health-labels">
                  <span>Warned Users</span>
                  <span>{stats.warnedUsers} / {stats.totalUsers}</span>
                </div>
                <div className="admin-health-track">
                  <div className="admin-health-fill fill-yellow" style={{ width: `${warnedPct}%` }}></div>
                </div>
              </div>
              <div className="admin-health-row">
                <div className="admin-health-labels">
                  <span>Suspended Users</span>
                  <span>{stats.suspendedUsers} / {stats.totalUsers}</span>
                </div>
                <div className="admin-health-track">
                  <div className="admin-health-fill fill-red" style={{ width: `${suspendedPct}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          <div className="admin-panel">
            <div className="admin-panel-header">Recent Security Events</div>
            <div className="admin-panel-body" style={{ padding: '0 24px' }}>
              {auditLog.length > 0 ? (
                auditLog.slice(0, 5).map((entry, idx) => (
                  <div className="admin-event-row" key={idx}>
                    <span className={`admin-event-chip ${entry.type || 'system'}`}>
                      {(entry.type || 'SYSTEM').toUpperCase()}
                    </span>
                    <div>
                      <div className="admin-event-text">{entry.event}</div>
                      <div className="admin-event-time">
                        {new Date(entry.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="admin-event-row">
                  <div className="admin-event-text" style={{ color: '#8b949e', padding: '16px 0' }}>No recent events.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return renderDashboardTab();
      case 'users':
        return <div className="admin-content"><div className="admin-panel"><div className="admin-panel-body">Users management view placeholder.</div></div></div>;
      case 'audit':
        return <div className="admin-content"><div className="admin-panel"><div className="admin-panel-body">Audit log view placeholder.</div></div></div>;
      default:
        return <div className="admin-content">View not found.</div>;
    }
  };

  return (
    <div className="admin-portal-wrapper">
      {renderSidebar()}
      <div className="admin-main">
        <div className="admin-header">
          <h2>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h2>
        </div>
        {renderContent()}
      </div>
    </div>
  );
};

export default AdminDashboard;
