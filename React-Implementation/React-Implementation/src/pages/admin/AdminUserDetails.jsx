import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import adminApi from '../../services/adminApi';
import mentorshipApi from '../../services/mentorshipApi';
import StatCard from '../../components/common/StatCard';
import Badge from '../../components/common/Badge';
import Avatar from '../../components/common/Avatar';
import DataTable from '../../components/common/DataTable';
import EmptyState from '../../components/common/EmptyState';
import './AdminUserDetails.css';

const AdminUserDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const [isProcessing, setIsProcessing] = useState(false);
  const toastTimeoutRef = useRef(null);

  const showToast = (message, type = 'success') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ visible: true, message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 4000);
  };

  useEffect(() => {
    let isMounted = true;
    const fetchUserDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        const [data, badgesData] = await Promise.all([
          adminApi.getUserDetails(id),
          mentorshipApi.getBadges(id).catch(() => []),
        ]);
        if (isMounted) {
          const rawBadges = Array.isArray(badgesData) && badgesData.length > 0
            ? badgesData
            : (Array.isArray(data?.mentorRecommendations) ? data.mentorRecommendations : []);
          setUser({
            ...data,
            mentorRecommendations: rawBadges,
          });
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to load user details.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchUserDetails();
    return () => {
      isMounted = false;
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, [id]);

  const handleAction = async (actionType) => {
    setIsProcessing(true);
    try {
      let successMsg = '';
      if (actionType === 'warn') {
        await adminApi.warnUser(id, { reason: 'Administrative warning issued' });
        successMsg = 'Warning recorded successfully.';
      } else if (actionType === 'suspend') {
        await adminApi.suspendUser(id);
        successMsg = 'User suspended. Account access restricted.';
      } else if (actionType === 'activate') {
        await adminApi.updateUserStatus(id, { status: 'Active' });
        successMsg = 'User account reactivated and restored.';
      } else if (actionType === 'flag') {
        await adminApi.flagUser(id);
        successMsg = 'User account flagged for administrative monitoring.';
      } else if (actionType === 'unflag') {
        await adminApi.updateUserStatus(id, { status: 'Active' });
        successMsg = 'Account flag removed.';
      }

      // Immediately synchronize status badge, counts, and action labels from backend response
      const freshUser = await adminApi.getUserDetails(id);
      if (freshUser) {
        setUser(freshUser);
      }
      showToast(successMsg, 'success');
    } catch (err) {
      showToast(`Action failed: ${err.message || 'Unknown error'}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-page">
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted-fg)' }}>
          Loading user profile...
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="admin-page">
        <button className="btn btn-outline mb-4" onClick={() => navigate('/admin/users')}>
          &larr; Back to Users
        </button>
        <EmptyState
          title="User not found"
          message={error || 'The requested user could not be located in the platform database.'}
          actionLabel="Return to User Management"
          onAction={() => navigate('/admin/users')}
        />
      </div>
    );
  }

  const isSuspended = (user.status || '').toLowerCase() === 'suspended';
  const isFlagged = user.flags === true || user.flagged === true || (user.status || '').toLowerCase() === 'flagged';
  const isWarned = (user.status || '').toLowerCase() === 'warned' || (user.warnings && user.warnings > 0);

  const formatJoined = (rawDate) => {
    if (!rawDate) return 'Jan 2024';
    const parsed = new Date(rawDate);
    if (!isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
    return String(rawDate);
  };
  const formattedJoinedDate = formatJoined(user.joinedDate || user.profile?.joined || user.joined || user.createdAt);

  const projectColumns = [
    {
      header: 'Project Title',
      accessor: 'title',
      render: (p) => <strong>{p.title}</strong>,
    },
    {
      header: 'Role',
      accessor: 'role',
      render: (p) => <Badge variant={p.role === 'Owner' ? 'warning' : 'info'}>{p.role}</Badge>,
    },
    {
      header: 'Difficulty',
      accessor: 'difficulty',
      render: (p) => p.difficulty || '—',
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (p) => (
        <Badge variant={p.isCompleted ? 'completed' : (p.status?.toLowerCase() || 'open')}>
          {p.isCompleted ? 'Completed' : (p.status || 'Active')}
        </Badge>
      ),
    },
    {
      header: 'Progress',
      accessor: 'progress',
      render: (p) => `${p.progress ?? 0}%`,
    },
  ];

  const taskColumns = [
    {
      header: 'Task Title',
      accessor: 'title',
      render: (t) => <strong>{t.title}</strong>,
    },
    {
      header: 'Project',
      accessor: 'projectName',
      render: (t) => t.projectName || '—',
    },
    {
      header: 'Priority',
      accessor: 'priority',
      render: (t) => <Badge variant={t.priority || 'medium'}>{t.priority || 'Medium'}</Badge>,
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (t) => (
        <Badge variant={(t.status || '').toLowerCase() === 'approved' ? 'completed' : 'info'}>
          {t.status || 'Open'}
        </Badge>
      ),
    },
    {
      header: 'XP',
      accessor: 'awardedXp',
      align: 'right',
      render: (t) => (
        <span style={{ fontWeight: 600, color: 'var(--primary, #6366f1)' }}>
          +{t.awardedXp || 50} XP
        </span>
      ),
    },
  ];

  return (
    <div className="admin-page admin-user-details-page">
      <div className="admin-user-details-header">
        <button className="btn btn-outline" onClick={() => navigate('/admin/users')}>
          &larr; Back to Users
        </button>

        <div className="admin-user-actions-toolbar" role="toolbar" aria-label="User moderation actions">
          <button
            className="admin-user-action-btn admin-action-warn"
            onClick={() => handleAction('warn')}
            disabled={isProcessing}
          >
            Issue Warning
          </button>
          {!isSuspended ? (
            <button
              className="admin-user-action-btn admin-action-suspend"
              onClick={() => handleAction('suspend')}
              disabled={isProcessing}
            >
              Suspend User
            </button>
          ) : (
            <button
              className="admin-user-action-btn admin-action-activate"
              onClick={() => handleAction('activate')}
              disabled={isProcessing}
            >
              Reactivate User
            </button>
          )}
          {isFlagged ? (
            <button
              className="admin-user-action-btn admin-action-unflag"
              onClick={() => handleAction('unflag')}
              disabled={isProcessing}
            >
              Remove Flag
            </button>
          ) : (
            <button
              className="admin-user-action-btn admin-action-flag"
              onClick={() => handleAction('flag')}
              disabled={isProcessing}
            >
              Flag Account
            </button>
          )}
        </div>
      </div>

      {toast.visible && (
        <div className={`admin-user-toast ${toast.type}`} role="alert">
          <span>{toast.message}</span>
          <button
            type="button"
            className="admin-user-toast-close"
            onClick={() => setToast((prev) => ({ ...prev, visible: false }))}
            aria-label="Dismiss feedback"
          >
            &times;
          </button>
        </div>
      )}

      {/* User Hero Banner */}
      <div className="admin-user-hero">
        <Avatar name={user.name} size="lg" />
        <div className="admin-user-hero-info">
          <div className="admin-user-hero-title">
            <h2>{user.name}</h2>
            {isFlagged && <span style={{ fontSize: '1.25rem' }} title="Flagged account">🏳</span>}
          </div>
          <div className="admin-user-hero-meta">
            <span>{user.email}</span> &bull; <span>@{user.username}</span> &bull; <span>{user.university || user.uni || 'Not specified'}</span>
          </div>
          <div className="admin-user-hero-tags">
            <Badge variant={user.role === 'Mentor' ? 'warning' : 'info'}>
              {user.role}
            </Badge>
            <Badge variant={isSuspended ? 'danger' : isWarned ? 'warning' : 'success'}>
              {user.status}
            </Badge>
            <span style={{ fontSize: '0.8rem', color: 'var(--muted-fg, #6b7280)', marginLeft: '4px' }}>
              Member since {formattedJoinedDate}
            </span>
          </div>
        </div>
      </div>

      {/* KPI StatCards */}
      <div className="admin-user-stats-grid">
        <StatCard label="Total Experience" value={`${Number(user.xp || 0).toLocaleString()} XP`} />
        <StatCard label="Reputation Score" value={`${Number(user.rep || 0).toLocaleString()} Rep`} />
        <StatCard label="Associated Projects" value={user.projectsCount || 0} />
        <StatCard label="Tasks Completed" value={user.completedTasksCount || 0} />
        <StatCard label="Warnings Issued" value={user.warnings || 0} />
        <StatCard label="Mentor Authorization" value={user.mentorStatus || 'None'} />
      </div>

      <div className="admin-user-details-grid">
        {/* Left Column: Projects & Contributions */}
        <div className="admin-user-left-col">
          <div className="admin-user-section-card">
            <h3 className="admin-user-section-title">
              <span>📁</span> Associated Projects ({user.projects?.length || 0})
            </h3>
            {user.projects && user.projects.length > 0 ? (
              <DataTable
                columns={projectColumns}
                data={user.projects}
                keyField="id"
              />
            ) : (
              <EmptyState
                title="No projects found"
                message="This user is not currently an owner or collaborator on any projects."
              />
            )}
          </div>

          <div className="admin-user-section-card">
            <h3 className="admin-user-section-title">
              <span>📋</span> Task Contribution History ({user.contributions?.length || 0})
            </h3>
            {user.contributions && user.contributions.length > 0 ? (
              <DataTable
                columns={taskColumns}
                data={user.contributions}
                keyField="id"
              />
            ) : (
              <EmptyState
                title="No task contributions"
                message="This user has not completed or been assigned any project tasks yet."
              />
            )}
          </div>
        </div>

        {/* Right Column: Skills & Recent Activity */}
        <div className="admin-user-right-col">
          <div className="admin-user-section-card">
            <h3 className="admin-user-section-title">
              <span>🛠️</span> Technical Skills
            </h3>
            {Array.isArray(user.skills) && user.skills.length > 0 ? (
              <div className="admin-user-skills-wrap">
                {user.skills.map((s, idx) => (
                  <span key={idx} className="admin-user-skill-chip">{s}</span>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--muted-fg, #6b7280)', fontSize: '0.88rem', margin: 0 }}>
                No technical skills recorded on profile.
              </p>
            )}
          </div>

          {/* Mentor Recommendations Card */}
          <div className="admin-user-section-card">
            <h3 className="admin-user-section-title">
              <span>🏅</span> Mentor Recommendations ({Array.isArray(user.mentorRecommendations) ? user.mentorRecommendations.length : 0})
            </h3>
            {Array.isArray(user.mentorRecommendations) && user.mentorRecommendations.length > 0 ? (
              <div className="admin-user-recommendations-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {user.mentorRecommendations.map((rec, idx) => (
                  <div
                    key={rec.id || idx}
                    style={{
                      padding: '12px 16px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--surface-alt, #f8fafc)',
                      border: '1px solid var(--border, #e2e8f0)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <Badge variant="warning">
                        {rec.badgeName || rec.badgeType || 'Recommendation'}
                      </Badge>
                      {rec.awardedAt && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--muted-fg, #6b7280)' }}>
                          {new Date(rec.awardedAt).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.88rem', color: 'var(--fg, #1e293b)' }}>
                      Given by <strong>{rec.mentorName || rec.mentor}</strong> on{' '}
                      <em>{rec.projectTitle || rec.project}</em>
                    </div>
                    {(rec.comment || rec.note) && (
                      <div
                        style={{
                          marginTop: '6px',
                          fontSize: '0.84rem',
                          color: 'var(--muted-fg, #64748b)',
                          fontStyle: 'italic',
                          borderLeft: '3px solid #f59e0b',
                          paddingLeft: '8px',
                        }}
                      >
                        &ldquo;{rec.comment || rec.note}&rdquo;
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--muted-fg, #6b7280)', fontSize: '0.88rem', margin: 0, fontStyle: 'italic' }}>
                No recommendation badges awarded to this user yet.
              </p>
            )}
          </div>

          <div className="admin-user-section-card">
            <h3 className="admin-user-section-title">
              <span>📜</span> Recent Activity
            </h3>
            {Array.isArray(user.recentActivity) && user.recentActivity.length > 0 ? (
              <div className="admin-user-activity-list">
                {user.recentActivity.map((item, idx) => (
                  <div key={item.id || idx} className="admin-user-activity-item">
                    <div className="admin-user-activity-event">{item.event || item.action}</div>
                    <div className="admin-user-activity-meta">
                      <span>{item.action}</span>
                      <span>{item.timestamp ? new Date(item.timestamp).toLocaleDateString() : '—'}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--muted-fg, #6b7280)', fontSize: '0.88rem', margin: 0 }}>
                No recent activity records logged for this user.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminUserDetails;
