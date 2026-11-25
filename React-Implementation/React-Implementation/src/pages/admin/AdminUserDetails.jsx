import { formatMemberSince, formatDateTime } from '../../utils/dateFormatter';
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import adminApi from '../../services/adminApi';
import mentorshipApi from '../../services/mentorshipApi';
import mentorMarketplaceApi from '../../services/mentorMarketplaceApi';
import StatCard from '../../components/common/StatCard';
import Badge from '../../components/common/Badge';
import Avatar from '../../components/common/Avatar';
import DataTable from '../../components/common/DataTable';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
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

  // Reputation history pagination state
  const [repTypeFilter, setRepTypeFilter] = useState('all');
  const [repPage, setRepPage] = useState(1);
  const [repTotal, setRepTotal] = useState(0);
  const [reputationEntries, setReputationEntries] = useState([]);
  const [mentorFeedbackData, setMentorFeedbackData] = useState(null);

  // Moderation action modal state
  const [modalAction, setModalAction] = useState(null); // 'warn' | 'suspend' | 'activate' | null
  const [explanation, setExplanation] = useState('');
  const [explanationError, setExplanationError] = useState('');

  const showToast = (message, type = 'success') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ visible: true, message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 4000);
  };

  const openModerationModal = (actionType) => {
    setModalAction(actionType);
    setExplanation('');
    setExplanationError('');
  };

  const closeModerationModal = () => {
    setModalAction(null);
    setExplanation('');
    setExplanationError('');
  };

  const handleSubmitModeration = async () => {
    const trimmed = explanation.trim();
    if (trimmed.length < 10) {
      setExplanationError('Written explanation must be at least 10 characters.');
      return;
    }
    setIsProcessing(true);
    try {
      let successMsg = '';
      if (modalAction === 'warn') {
        await adminApi.warnUser(id, { reason: trimmed });
        successMsg = 'Warning recorded successfully.';
      } else if (modalAction === 'suspend') {
        const res = await adminApi.suspendUser(id, { reason: trimmed });
        if (res?.status === 'pending_second_approval') {
          successMsg = 'Pending second approval — waiting for another admin or Super User within 72 hours.';
        } else {
          successMsg = 'User suspended. Account access restricted.';
        }
      } else if (modalAction === 'activate') {
        await adminApi.reactivateUser(id, { reason: trimmed });
        successMsg = 'User account reactivated and restored.';
      }

      closeModerationModal();

      const freshUser = await adminApi.getUserDetails(id);
      if (freshUser) {
        setUser(freshUser);
      }
      showToast(successMsg, 'success');
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Action failed.';
      showToast(`Action failed: ${errMsg}`, 'error');
      setExplanationError(errMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFlagAction = async (flagAction) => {
    setIsProcessing(true);
    try {
      if (flagAction === 'flag') {
        await adminApi.flagUser(id);
        showToast('User account flagged for administrative monitoring.', 'success');
      } else {
        await adminApi.updateUserStatus(id, { status: 'Active' });
        showToast('Account flag removed.', 'success');
      }
      const freshUser = await adminApi.getUserDetails(id);
      if (freshUser) setUser(freshUser);
    } catch (err) {
      showToast(`Action failed: ${err.message || 'Unknown error'}`, 'error');
    } finally {
      setIsProcessing(false);
    }
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

  useEffect(() => {
    let isMounted = true;
    const fetchRep = async () => {
      if (!id || typeof adminApi.getUserReputation !== 'function') return;
      try {
        const res = await adminApi.getUserReputation(id, { page: repPage, limit: 20, type: repTypeFilter });
        if (isMounted && res) {
          setReputationEntries(Array.isArray(res.items) ? res.items : []);
          setRepTotal(Number(res.total) || 0);
        }
      } catch (err) {
        console.warn('Failed to fetch user reputation entries:', err);
      }
    };
    fetchRep();
    return () => { isMounted = false; };
  }, [id, repPage, repTypeFilter]);

  useEffect(() => {
    let isMounted = true;
    const isMentorUser = Boolean(
      user &&
      (String(user.role || '').toLowerCase() === 'mentor' ||
        user.mentorUnlocked ||
        user.profile?.mentorUnlocked)
    );
    if (!id || !isMentorUser || typeof mentorMarketplaceApi.getAdminMentorFeedback !== 'function') {
      return () => { isMounted = false; };
    }
    mentorMarketplaceApi.getAdminMentorFeedback(id)
      .then((res) => {
        if (isMounted && res) setMentorFeedbackData(res);
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, [id, user]);



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
  const isWarned = (user.status || '').toLowerCase() === 'warned' || (user.warnings && (Array.isArray(user.warnings) ? user.warnings.length > 0 : user.warnings > 0));
  const activeWarnings = user.activeWarningsCount ?? user.warningsCount ?? (
    Array.isArray(user.warnings)
      ? user.warnings.filter((w) => typeof w === 'object' ? w.active !== false : true).length
      : (typeof user.warnings === 'number' ? user.warnings : 0)
  );

  const formattedJoinedDate = formatMemberSince(user.createdAt || user.joinedDate || user.profile?.createdAt || user.profile?.joined);

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
            onClick={() => openModerationModal('warn')}
            disabled={isProcessing}
          >
            Issue Warning
          </button>
          {!isSuspended ? (
            <button
              className="admin-user-action-btn admin-action-suspend"
              onClick={() => openModerationModal('suspend')}
              disabled={isProcessing}
            >
              Suspend User
            </button>
          ) : (
            <button
              className="admin-user-action-btn admin-action-activate"
              onClick={() => openModerationModal('activate')}
              disabled={isProcessing}
            >
              Reactivate User
            </button>
          )}
          {isFlagged ? (
            <button
              className="admin-user-action-btn admin-action-unflag"
              onClick={() => handleFlagAction('unflag')}
              disabled={isProcessing}
            >
              Remove Flag
            </button>
          ) : (
            <button
              className="admin-user-action-btn admin-action-flag"
              onClick={() => handleFlagAction('flag')}
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
            <span
              title={user.email}
              style={{
                maxWidth: '280px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'inline-block',
                verticalAlign: 'bottom',
              }}
            >
              {user.email}
            </span> &bull; <span>@{user.username}</span> &bull; <span>{user.university || user.uni || 'Not specified'}</span>
            {user.phone ? (
              <>
                {' '}&bull;{' '}
                <span>
                  📞 {user.phone}{' '}
                  <Badge variant={user.phoneVerified ? 'success' : 'secondary'} size="sm">
                    {user.phoneVerified ? 'Verified' : 'Not verified'}
                  </Badge>
                </span>
              </>
            ) : null}
          </div>
          <div className="admin-user-hero-tags">
            <Badge variant={user.role === 'Mentor' ? 'warning' : 'info'}>
              {user.role}
            </Badge>
            <Badge variant={isSuspended ? 'danger' : isWarned ? 'warning' : 'success'}>
              {user.status}
            </Badge>
            {activeWarnings > 0 && (
              <Badge variant="warning">{activeWarnings}/4 Warnings</Badge>
            )}
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
        <StatCard label="Active Warnings" value={`${activeWarnings}/4`} />
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

          {/* Warning History Section Card */}
          <div className="admin-user-section-card" data-testid="warning-history-card">
            <h3 className="admin-user-section-title">
              <span>⚠️</span> Warning History ({Array.isArray(user.warningHistory) ? user.warningHistory.length : (Array.isArray(user.warnings) ? user.warnings.length : 0)})
            </h3>
            {Array.isArray(user.pendingModerationActions) && user.pendingModerationActions.some((a) => a.status === 'pending') && (
              <div
                data-testid="user-pending-second-approval-banner"
                style={{
                  padding: '10px 14px',
                  marginBottom: '12px',
                  borderRadius: '8px',
                  background: '#fef3c7',
                  border: '1px solid #fde68a',
                  color: '#92400e',
                  fontSize: '0.86rem',
                }}
              >
                Pending Second Approval — Waiting for another admin or Super User to approve or reject suspension request.
              </div>
            )}
            {(() => {
              const items = Array.isArray(user.warningHistory) && user.warningHistory.length > 0
                ? user.warningHistory
                : (Array.isArray(user.warnings) ? user.warnings : []);
              if (items.length === 0) {
                return (
                  <p style={{ color: 'var(--muted-fg, #6b7280)', fontSize: '0.88rem', margin: 0, fontStyle: 'italic' }}>
                    No warnings recorded for this user.
                  </p>
                );
              }
              return (
                <div className="admin-user-warnings-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {items.map((w, idx) => {
                    const reason = typeof w === 'object' ? w.reason : String(w);
                    const rawDate = typeof w === 'object' ? (w.createdAt || w.issuedAt) : null;
                    const issuedAt = rawDate ? new Date(rawDate).toLocaleDateString() : '—';
                    const issuedBy = typeof w === 'object' ? (w.moderatorName || w.issuedBy || 'Administrator') : 'Administrator';
                    const wStatus = typeof w === 'object' ? (w.status || (w.active === false ? 'removed' : 'active')).toLowerCase() : 'active';
                    const isActive = wStatus === 'active';
                    const isExpired = wStatus === 'expired';
                    const badgeLabel = isActive ? 'Active' : isExpired ? 'Expired' : wStatus === 'cleared' ? 'Cleared' : 'Removed / Appealed';
                    const badgeVariant = isActive ? 'warning' : 'secondary';
                    return (
                      <div
                        key={w.id || idx}
                        className="admin-user-warning-item"
                        style={{
                          padding: '12px 16px',
                          borderRadius: '8px',
                          backgroundColor: isActive ? '#fffbeb' : 'var(--surface-alt, #f8fafc)',
                          border: `1px solid ${isActive ? '#fde68a' : 'var(--border, #e2e8f0)'}`,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.9rem', color: isActive ? '#92400e' : '#64748b' }}>
                            Warning #{idx + 1}
                          </span>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <Badge variant={badgeVariant} data-testid={`warning-status-${w.id || idx}`}>
                              {badgeLabel}
                            </Badge>
                            <span style={{ fontSize: '0.8rem', color: 'var(--muted-fg, #6b7280)' }}>
                              {issuedAt}
                            </span>
                          </div>
                        </div>
                        <div style={{ fontSize: '0.88rem', color: 'var(--fg, #1e293b)' }}>
                          <strong>Reason:</strong> {reason}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--muted-fg, #64748b)', marginTop: '4px' }}>
                          Issued by: {issuedBy}
                          {isExpired && w.expiredAt ? ` · Expired: ${new Date(w.expiredAt).toLocaleDateString()}` : ''}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
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

          {/* Phase 10: Reputation Ledger Section Card */}
          <div className="admin-user-section-card" data-testid="admin-reputation-card">
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '12px' }}>
              <h3 className="admin-user-section-title" style={{ margin: 0 }}>
                <span>⚖️</span> Reputation Ledger ({repTotal})
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <label htmlFor="admin-rep-filter" style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--muted-fg, #6b7280)' }}>Filter:</label>
                <select
                  id="admin-rep-filter"
                  data-testid="admin-reputation-filter"
                  value={repTypeFilter}
                  onChange={(e) => {
                    setRepTypeFilter(e.target.value);
                    setRepPage(1);
                  }}
                  style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--border, #cbd5e1)', fontSize: '0.82rem' }}
                >
                  <option value="all">All</option>
                  <option value="initial">Initial signup</option>
                  <option value="task_approved">Task approved</option>
                  <option value="project_completed">Project completed</option>
                  <option value="warning">Warning penalty</option>
                  <option value="warning_removed">Appeal accepted</option>
                  <option value="deadline_missed">Deadline penalty</option>
                  <option value="seed">Starting reputation (Seed)</option>
                </select>
              </div>
            </div>

            {reputationEntries.length > 0 ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {reputationEntries.map((entry) => {
                    const deltaVal = Number(entry.delta || 0);
                    const label =
                      entry.type === 'seed'
                        ? 'Starting reputation'
                        : entry.reason || (
                          entry.type === 'task_approved' ? `Task approved: ${entry.refId || ''}` :
                          entry.type === 'project_completed' ? `Project completed: ${entry.refId || ''}` :
                          entry.type === 'warning' ? `Warning penalty: ${entry.refId || ''}` :
                          entry.type === 'warning_removed' ? `Warning appeal accepted: ${entry.refId || ''}` :
                          entry.type === 'deadline_missed' ? `Missed deadline penalty: ${entry.refId || ''}` :
                          entry.type === 'initial' ? 'Initial signup reputation' :
                          entry.type || 'Reputation adjustment'
                        );
                    return (
                      <div
                        key={entry.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid var(--border, #e2e8f0)',
                          backgroundColor: 'var(--surface-alt, #f8fafc)',
                          fontSize: '0.84rem',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 500, color: 'var(--fg, #1e293b)' }}>{label}</span>
                            {entry.type && (
                              <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '1px 7px', borderRadius: '999px', backgroundColor: '#e2e8f0', color: '#334155' }}>
                                {entry.type}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--muted-fg, #64748b)', marginTop: '2px' }}>
                            {formatDateTime(entry.createdAt)}
                          </div>
                        </div>
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: '0.88rem',
                            color: deltaVal > 0 ? '#16a34a' : deltaVal < 0 ? '#dc2626' : '#64748b',
                          }}
                        >
                          {deltaVal > 0 ? `+${deltaVal}` : deltaVal} Rep
                        </span>
                      </div>
                    );
                  })}
                </div>

                {repTotal > 20 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', fontSize: '0.82rem' }}>
                    <span style={{ color: 'var(--muted-fg, #6b7280)' }}>
                      Page {repPage} of {Math.ceil(repTotal / 20) || 1} ({repTotal} total)
                    </span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={repPage <= 1}
                        onClick={() => setRepPage((p) => Math.max(1, p - 1))}
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={repPage >= Math.ceil(repTotal / 20)}
                        onClick={() => setRepPage((p) => p + 1)}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p style={{ color: 'var(--muted-fg, #6b7280)', fontSize: '0.88rem', margin: 0, fontStyle: 'italic' }}>
                No reputation ledger records found.
              </p>
            )}
          </div>

          {mentorFeedbackData && (
            <div className="admin-user-section-card" data-testid="admin-mentor-feedback-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <h3 className="admin-user-section-title" style={{ margin: 0 }}>
                  <span>⭐</span> Mentor Feedback &amp; Lifecycle
                </h3>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <Badge variant="info">
                    Avg Rating: {mentorFeedbackData.averageRating ?? 'N/A'} ({mentorFeedbackData.totalFeedbackCount || 0})
                  </Badge>
                  <Badge variant={(mentorFeedbackData.abandonmentHistory?.length || 0) > 0 ? 'warning' : 'secondary'}>
                    Abandonment Incidents: {mentorFeedbackData.abandonmentHistory?.length || 0}
                  </Badge>
                </div>
              </div>

              {Array.isArray(mentorFeedbackData.feedback) && mentorFeedbackData.feedback.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                  {mentorFeedbackData.feedback.map((fb) => (
                    <div
                      key={fb.id}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border, #e2e8f0)',
                        background: 'var(--surface-alt, #f8fafc)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', marginBottom: '4px' }}>
                        <strong>{fb.ownerName || `Owner #${fb.studentId}`}</strong>
                        <span>★ {fb.rating} / 5 · {fb.createdAt ? formatMemberSince(fb.createdAt) : ''}</span>
                      </div>
                      {fb.comment && (
                        <div style={{ fontSize: '0.86rem', color: 'var(--fg, #1e293b)' }}>
                          {fb.comment}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--muted-fg, #6b7280)', fontSize: '0.88rem', marginBottom: '12px', fontStyle: 'italic' }}>
                  No private session feedback submitted yet.
                </p>
              )}

              {Array.isArray(mentorFeedbackData.abandonmentHistory) && mentorFeedbackData.abandonmentHistory.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '0.88rem', margin: '0 0 8px 0', color: '#b45309' }}>Abandonment Releases</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {mentorFeedbackData.abandonmentHistory.map((inc, idx) => (
                      <div key={inc.reviewId || idx} style={{ fontSize: '0.84rem', padding: '8px 10px', borderRadius: '6px', background: '#fffbeb', border: '1px solid #fde68a' }}>
                        <strong>{inc.projectTitle || inc.projectId}</strong> — Released {inc.releasedAt ? formatMemberSince(inc.releasedAt) : ''}
                        {inc.reason ? ` (${inc.reason})` : ''}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {modalAction && (
        <Modal
          isOpen={Boolean(modalAction)}
          title={
            modalAction === 'warn'
              ? 'Issue Warning'
              : modalAction === 'suspend'
              ? 'Suspend User Account'
              : 'Reactivate User Account'
          }
          onClose={closeModerationModal}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={closeModerationModal}
                disabled={isProcessing}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`btn ${modalAction === 'suspend' ? 'btn-danger' : 'btn-primary'}`}
                onClick={handleSubmitModeration}
                disabled={isProcessing || explanation.trim().length < 10}
              >
                {isProcessing
                  ? 'Processing...'
                  : modalAction === 'warn'
                  ? 'Confirm Warning'
                  : modalAction === 'suspend'
                  ? 'Confirm Suspension'
                  : 'Confirm Reactivation'}
              </button>
            </div>
          }
        >
          <div>
            <p style={{ marginBottom: '12px', fontSize: '0.9rem', color: 'var(--muted-fg, #64748b)' }}>
              {modalAction === 'warn' &&
                'A warning deducts 10 reputation and sends a notification (Warning N/4) and email to the user. The 4th active warning triggers automatic suspension.'}
              {modalAction === 'suspend' &&
                'Suspending this user restricts access immediately, closes owned projects, releases active tasks back to unassigned, and notifies collaborators and mentors via email.'}
              {modalAction === 'activate' &&
                'Reactivating this user restores access and resets active warnings to 0. A notification will be sent to the user.'}
            </p>
            <label htmlFor="moderation-explanation" style={{ display: 'block', fontWeight: 600, marginBottom: '6px' }}>
              Written Explanation <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              id="moderation-explanation"
              className="form-control"
              rows={4}
              value={explanation}
              onChange={(e) => {
                setExplanation(e.target.value);
                if (explanationError && e.target.value.trim().length >= 10) {
                  setExplanationError('');
                }
              }}
              placeholder="Enter written explanation for this moderation action (minimum 10 characters)..."
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: explanationError ? '1px solid #ef4444' : '1px solid var(--border, #cbd5e1)',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.8rem' }}>
              <span style={{ color: explanation.trim().length < 10 ? '#ef4444' : '#10b981' }}>
                {explanation.trim().length < 10
                  ? `Explanation must be at least 10 characters (${explanation.trim().length}/10)`
                  : `${explanation.trim().length} characters`}
              </span>
            </div>
            {explanationError && (
              <div style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '6px' }}>
                {explanationError}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AdminUserDetails;
