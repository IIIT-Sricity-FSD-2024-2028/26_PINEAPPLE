import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import adminApi from '../../services/adminApi';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    pendingMentorApps: 0,
    flaggedWarned: 0,
    suspendedUsers: 0,
    auditEvents: 0
  });
  const [recentEvents, setRecentEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        // Using Promise.all to fetch stats and audit logs concurrently
        const [statsData, auditData] = await Promise.all([
          adminApi.getStats(),
          adminApi.getAuditLog()
        ]);
        
        // Populate stats (fallback to 0 if API fields differ)
        setStats({
          totalUsers: statsData?.totalUsers || 0,
          activeUsers: statsData?.activeUsers || 0,
          pendingMentorApps: statsData?.pendingMentorApps || 0,
          flaggedWarned: statsData?.flaggedWarned || 0,
          suspendedUsers: statsData?.suspendedUsers || 0,
          auditEvents: statsData?.auditEvents || (auditData?.length || 0)
        });

        // Set recent events (top 5 from the audit log)
        setRecentEvents((auditData || []).slice(0, 5));
      } catch (error) {
        console.error("Failed to fetch admin dashboard data", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const getPercentage = (count) => {
    return stats.totalUsers > 0 ? Math.round((count / stats.totalUsers) * 100) : 0;
  };

  const getAuditChipClass = (type) => {
    const types = {
      task: 'task',
      mentor: 'mentor',
      warning: 'warning',
      xp: 'xp',
      system: 'system'
    };
    return `admin-event-chip ${types[type] || 'system'}`;
  };

  if (loading) {
    return <div className="admin-page"><p>Loading Dashboard...</p></div>;
  }

  return (
    <div id="admin-dash" className="admin-page">
      <div className="admin-dash-head">
        <h1>Platform Overview</h1>
        <p className="page-subtitle mt-1">Real-time snapshot of TeamForge activity.</p>
      </div>

      <div className="admin-dash-grid-top mt-3">
        <div className="admin-kpi-card">
          <div className="admin-kpi-row">
            <div className="admin-kpi-icon info">👥</div>
            <span className="admin-kpi-meta" id="admin-kpi-users-active">{stats.activeUsers} active</span>
          </div>
          <div className="admin-kpi-value" id="admin-kpi-users-total">{stats.totalUsers}</div>
          <div className="admin-kpi-label">Total Users</div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-row">
            <div className="admin-kpi-icon">📖</div>
            <span className="admin-kpi-meta">Awaiting review</span>
          </div>
          <div className="admin-kpi-value" id="admin-kpi-mentor-pending">{stats.pendingMentorApps}</div>
          <div className="admin-kpi-label">Pending Mentor Apps</div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-row">
            <div className="admin-kpi-icon">⚠️</div>
            <span className="admin-kpi-meta" id="admin-kpi-suspended-meta">{stats.suspendedUsers} suspended</span>
          </div>
          <div className="admin-kpi-value" id="admin-kpi-flagged-warned">{stats.flaggedWarned}</div>
          <div className="admin-kpi-label">Flagged / Warned</div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-row">
            <div className="admin-kpi-icon">📜</div>
          </div>
          <div className="admin-kpi-value" id="admin-kpi-audit-events">{stats.auditEvents}</div>
          <div className="admin-kpi-label">Audit Events</div>
        </div>
      </div>

      <div className="admin-dash-grid-actions mt-3">
        <button className="admin-action-card" onClick={() => navigate('/admin/mentor-apps')}>
          <div className="admin-action-left">
            <div className="admin-action-icon">📖</div>
            <div>
              <div className="admin-action-title">Review Mentor Applications</div>
              <div className="admin-action-sub" id="admin-action-mentor-sub">{stats.pendingMentorApps} pending</div>
            </div>
          </div>
          <div className="admin-action-count" id="admin-action-mentor-count">{stats.pendingMentorApps}</div>
        </button>

        <button className="admin-action-card" onClick={() => navigate('/admin/users')}>
          <div className="admin-action-left">
            <div className="admin-action-icon">🛡️</div>
            <div>
              <div className="admin-action-title">Manage Flagged Users</div>
              <div className="admin-action-sub" id="admin-action-flagged-sub">{stats.flaggedWarned} flagged</div>
            </div>
          </div>
          <div className="admin-action-count" id="admin-action-flagged-count">{stats.flaggedWarned}</div>
        </button>

        <button className="admin-action-card" onClick={() => navigate('/admin/audit')}>
          <div className="admin-action-left">
            <div className="admin-action-icon">📜</div>
            <div>
              <div className="admin-action-title">View Full Audit Log</div>
              <div className="admin-action-sub" id="admin-action-audit-sub">{stats.auditEvents} entries</div>
            </div>
          </div>
          <div className="admin-action-count" id="admin-action-audit-count">{stats.auditEvents}</div>
        </button>
      </div>

      <div className="admin-dash-grid-bottom mt-3">
        <div className="admin-panel">
          <div className="admin-panel-title">↗ User Health</div>

          <div className="admin-health-item">
            <div className="admin-health-head"><span>Active</span><span id="admin-health-active-label">{stats.activeUsers} / {stats.totalUsers}</span></div>
            <div className="admin-health-track">
              <div className="admin-health-fill success" id="admin-health-active-fill" style={{ width: `${getPercentage(stats.activeUsers)}%` }}></div>
            </div>
          </div>

          <div className="admin-health-item">
            <div className="admin-health-head"><span>Warned</span><span id="admin-health-warned-label">{stats.flaggedWarned} / {stats.totalUsers}</span></div>
            <div className="admin-health-track">
              <div className="admin-health-fill warning" id="admin-health-warned-fill" style={{ width: `${getPercentage(stats.flaggedWarned)}%` }}></div>
            </div>
          </div>

          <div className="admin-health-item">
            <div className="admin-health-head"><span>Suspended</span><span id="admin-health-suspended-label">{stats.suspendedUsers} / {stats.totalUsers}</span></div>
            <div className="admin-health-track">
              <div className="admin-health-fill danger" id="admin-health-suspended-fill" style={{ width: `${getPercentage(stats.suspendedUsers)}%` }}></div>
            </div>
          </div>
        </div>

        <div className="admin-panel">
          <div className="admin-panel-title">📜 Recent Events</div>
          <div className="admin-events-list" id="admin-dash-recent-events">
            {recentEvents.length > 0 ? (
              recentEvents.map((entry, index) => (
                <div className="admin-event-row" key={index}>
                  <span className={getAuditChipClass(entry.type || 'system')}>{String(entry.type || 'system').toUpperCase()}</span>
                  <div>
                    <div className="admin-event-text">{entry.event || entry.details}</div>
                    <div className="admin-event-time">{entry.timestamp || new Date(entry.createdAt).toLocaleString()}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="admin-users-empty">No recent events.</div>
            )}
          </div>
          <button className="admin-events-link" onClick={() => navigate('/admin/audit')}>View full audit log →</button>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
