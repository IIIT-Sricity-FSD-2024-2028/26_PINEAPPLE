import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchOpenReportsCount } from '../../store/thunks/reportsThunks';
import { selectOpenReportsCount } from '../../store/selectors/reportsSelectors';
import { fetchDashboardStats } from '../../store/thunks/adminUsersThunks';
import {
  selectDashboardStats,
  selectDashboardStatsStatus,
} from '../../store/selectors/adminUsersSelectors';
import { fetchAuditLogs } from '../../store/thunks/auditLogThunks';
import {
  selectAllAuditLogs,
  selectAuditLogStatus,
  selectRecentAuditEvents,
} from '../../store/selectors/auditLogSelectors';
import StatCard from '../../components/common/StatCard';
import './AdminDashboard.css';

const AdminDashboardContent = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const openReportsCount = useSelector(selectOpenReportsCount);
  const stats = useSelector(selectDashboardStats);
  const statsStatus = useSelector(selectDashboardStatsStatus);
  const allAuditLogs = useSelector(selectAllAuditLogs);
  const recentEvents = useSelector(selectRecentAuditEvents);
  const auditStatus = useSelector(selectAuditLogStatus);

  const loading =
    (statsStatus === 'idle' || statsStatus === 'loading') &&
    (auditStatus === 'idle' || auditStatus === 'loading');

  useEffect(() => {
    dispatch(fetchOpenReportsCount());
    dispatch(fetchDashboardStats());
    dispatch(fetchAuditLogs());
  }, [dispatch]);

  const auditEventsCount = stats.auditEvents || allAuditLogs.length || 0;

  const getPercentage = (count) => {
    const total = Number(stats.totalUsers) || 0;
    if (total <= 0) return 0;
    const value = Number(count) || 0;
    return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
  };

  const formatEventText = (entry) => {
    if (!entry) return '';
    if (typeof entry.event === 'string' && entry.event.trim()) return entry.event;
    if (typeof entry.details === 'string' && entry.details.trim()) return entry.details;
    if (entry.details && typeof entry.details === 'object') {
      if (entry.details.reason) return `${entry.action || 'Action'}: ${entry.details.reason}`;
      if (entry.details.message) return entry.details.message;
      try {
        return JSON.stringify(entry.details);
      } catch {
        return String(entry.details);
      }
    }
    if (entry.action && entry.target) {
      return `${entry.actor || 'User'} performed ${entry.action} on ${entry.target}`;
    }
    return entry.action || 'System event';
  };

  const formatTime = (entry) => {
    if (entry?.timestampFormatted) return entry.timestampFormatted;
    if (entry?.timestamp) return entry.timestamp;
    if (entry?.createdAt) {
      try {
        const d = new Date(entry.createdAt);
        return Number.isNaN(d.getTime()) ? 'Just now' : d.toLocaleString();
      } catch {
        return 'Just now';
      }
    }
    return 'Just now';
  };

  const getAuditChipClass = (type) => {
    const types = {
      task: 'task',
      mentor: 'mentor',
      warning: 'warning',
      suspension: 'warning',
      xp: 'xp',
      reputation: 'xp',
      project: 'task',
      system: 'system',
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

      {/* KPI Cards using reusable StatCard component */}
      <div className="admin-dash-grid-top mt-3">
        <StatCard
          icon="👥"
          label="Total Users"
          value={stats.totalUsers}
          meta={`${stats.activeUsers} active`}
          onClick={() => navigate('/admin/users')}
        />
        <StatCard
          icon="📖"
          label="Pending Mentor Apps"
          value={stats.pendingMentorApps}
          meta="Awaiting review"
          onClick={() => navigate('/admin/mentor-apps')}
        />
        <StatCard
          icon="⚠️"
          label="Flagged / Warned"
          value={stats.flaggedWarned}
          meta={`${stats.suspendedUsers} suspended`}
          onClick={() => navigate('/admin/users')}
        />
        <StatCard
          icon="📜"
          label="Audit Events"
          value={auditEventsCount}
          meta="Recorded events"
          onClick={() => navigate('/admin/audit')}
        />
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
              <div className="admin-action-sub" id="admin-action-audit-sub">{auditEventsCount} entries</div>
            </div>
          </div>
          <div className="admin-action-count" id="admin-action-audit-count">{auditEventsCount}</div>
        </button>

        <button className="admin-action-card" data-testid="admin-action-reports-card" onClick={() => navigate('/admin/reports')}>
          <div className="admin-action-left">
            <div className="admin-action-icon">🚩</div>
            <div>
              <div className="admin-action-title">Open Reports &amp; Appeals</div>
              <div className="admin-action-sub" id="admin-action-reports-sub">{openReportsCount} open reports</div>
            </div>
          </div>
          <div className="admin-action-count" id="admin-action-reports-count" data-testid="admin-action-reports-count">{openReportsCount}</div>
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
            <div className="admin-health-head"><span>Warned</span><span id="admin-health-warned-label">{stats.warnedUsers ?? 0} / {stats.totalUsers}</span></div>
            <div className="admin-health-track">
              <div className="admin-health-fill warning" id="admin-health-warned-fill" style={{ width: `${getPercentage(stats.warnedUsers ?? 0)}%` }}></div>
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
                <div className="admin-event-row" key={entry.id || index}>
                  <span className={getAuditChipClass(entry.type || 'system')}>{String(entry.type || 'system').toUpperCase()}</span>
                  <div>
                    <div className="admin-event-text">{formatEventText(entry)}</div>
                    <div className="admin-event-time">{formatTime(entry)}</div>
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

const AdminDashboard = AdminDashboardContent;
export default AdminDashboard;
