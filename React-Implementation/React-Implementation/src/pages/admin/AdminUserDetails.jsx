import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchAdminUserDetails,
  fetchAdminUserReputation,
  flagAdminUser,
  updateAdminUserStatus,
} from '../../store/thunks/adminUsersThunks';
import {
  setRepPage as setRepPageAction,
  setRepTypeFilter as setRepTypeFilterAction,
} from '../../store/slices/adminUsersSlice';
import {
  selectAdminUsersWorking,
  selectUserDetailsView,
} from '../../store/selectors/adminUsersSelectors';
import { fetchAdminMentorFeedback } from '../../store/thunks/sessionFeedbackThunks';
import {
  fetchUserWarningsAdmin,
  issueUserWarning,
} from '../../store/thunks/warningsThunks';
import {
  reactivateUserModeration,
  suspendUserModeration,
} from '../../store/thunks/pendingModerationActionsThunks';
import StatCard from '../../components/common/StatCard';
import Badge from '../../components/common/Badge';
import Avatar from '../../components/common/Avatar';
import DataTable from '../../components/common/DataTable';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import './AdminUserDetails.css';

const AdminUserDetailsContent = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const view = useSelector(selectUserDetailsView(id));
  const usersWorking = useSelector(selectAdminUsersWorking);

  const loading = Boolean(usersWorking.detailLoading && !view);
  const error = !view ? usersWorking.detailError : null;
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const [isProcessing, setIsProcessing] = useState(false);
  const toastTimeoutRef = useRef(null);

  // Reputation history pagination state (backed by adminUsersSlice)
  const repTypeFilter = view?.reputation?.typeFilter || usersWorking.repTypeFilter || 'all';
  const repPage = view?.reputation?.page || usersWorking.repPage || 1;
  const setRepTypeFilter = (val) => dispatch(setRepTypeFilterAction(val));
  const setRepPage = (valOrFn) =>
    dispatch(
      setRepPageAction(typeof valOrFn === 'function' ? valOrFn(repPage) : valOrFn),
    );
  const repTotal = view?.reputation?.total || 0;
  const reputationEntries = view?.reputation?.items || [];
  const mentorFeedbackData = view?.mentorFeedback || null;

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
        await dispatch(issueUserWarning({ userId: id, reason: trimmed })).unwrap();
        successMsg = 'Warning recorded successfully.';
      } else if (modalAction === 'suspend') {
        const out = await dispatch(
          suspendUserModeration({
            userId: id,
            targetUserName: view?.name,
            reason: trimmed,
          }),
        ).unwrap();
        const res = out?.result || out;
        if (res?.status === 'pending_second_approval') {
          successMsg = 'Pending second approval — waiting for another admin or Super User within 72 hours.';
        } else {
          successMsg = 'User suspended. Account access restricted.';
        }
      } else if (modalAction === 'activate') {
        await dispatch(
          reactivateUserModeration({ userId: id, reason: trimmed }),
        ).unwrap();
        successMsg = 'User account reactivated and restored.';
      }

      closeModerationModal();

      await dispatch(fetchAdminUserDetails(id));
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
        await dispatch(flagAdminUser(id)).unwrap();
        showToast('User account flagged for administrative monitoring.', 'success');
      } else {
        await dispatch(updateAdminUserStatus({ userId: id, status: 'Active' })).unwrap();
        showToast('Account flag removed.', 'success');
      }
      await dispatch(fetchAdminUserDetails(id));
    } catch (err) {
      showToast(`Action failed: ${err?.serverMessage || err?.message || 'Unknown error'}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    dispatch(fetchAdminUserDetails(id));
    dispatch(fetchUserWarningsAdmin({ userId: id }));
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, [id, dispatch]);

  useEffect(() => {
    if (!id) return;
    dispatch(
      fetchAdminUserReputation({
        userId: id,
        page: repPage,
        limit: 20,
        type: repTypeFilter,
      }),
    );
  }, [dispatch, id, repPage, repTypeFilter]);

  const isMentorRole = Boolean(view?.isMentorRole);
  useEffect(() => {
    if (!id || !isMentorRole) {
      return undefined;
    }
    dispatch(fetchAdminMentorFeedback({ mentorId: id }));
    return undefined;
  }, [dispatch, id, isMentorRole]);



  if (loading) {
    return (
      <div className="admin-page">
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted-fg)' }}>
          Loading user profile...
        </div>
      </div>
    );
  }

  if (error || !view) {
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

  const {
    isSuspended,
    isFlagged,
    isDeleted,
    hasDuplicateFlag,
    hasPendingSecondApproval,
    pendingModerationActions,
    suspension,
    reactivation,
    activeWarningsCount: activeWarnings,
    actions,
  } = view;

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
      render: (p) => p.difficulty,
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (p) => (
        <Badge variant={p.badgeVariant}>
          {p.status}
        </Badge>
      ),
    },
    {
      header: 'Progress',
      accessor: 'progress',
      render: (p) => `${p.progress}%`,
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
      render: (t) => t.projectName,
    },
    {
      header: 'Priority',
      accessor: 'priority',
      render: (t) => <Badge variant={t.priority}>{t.priority}</Badge>,
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (t) => (
        <Badge variant={t.badgeVariant}>
          {t.status}
        </Badge>
      ),
    },
    {
      header: 'XP',
      accessor: 'awardedXp',
      align: 'right',
      render: (t) => (
        <span style={{ fontWeight: 600, color: 'var(--primary, #6366f1)' }}>
          +{t.awardedXp} XP
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
          {actions.canWarn && (
            <button
              className="admin-user-action-btn admin-action-warn"
              onClick={() => openModerationModal('warn')}
              disabled={isProcessing}
            >
              Issue Warning
            </button>
          )}
          {actions.canSuspend && (
            <button
              className="admin-user-action-btn admin-action-suspend"
              onClick={() => openModerationModal('suspend')}
              disabled={isProcessing}
            >
              Suspend User
            </button>
          )}
          {hasPendingSecondApproval && !isSuspended && !isDeleted && (
            <span
              data-testid="toolbar-pending-second-approval"
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                background: '#fef3c7',
                border: '1px solid #fde68a',
                color: '#92400e',
                fontSize: '0.84rem',
                fontWeight: 600,
              }}
            >
              Pending Second Approval
            </span>
          )}
          {actions.canReactivate && (
            <button
              className="admin-user-action-btn admin-action-activate"
              onClick={() => openModerationModal('activate')}
              disabled={isProcessing}
            >
              Reactivate User
            </button>
          )}
          {actions.canToggleFlag && (
            isFlagged ? (
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
            )
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
        <Avatar name={view.name} src={view.avatarUrl} version={view.updatedAt} size="lg" />
        <div className="admin-user-hero-info">
          <div className="admin-user-hero-title">
            <h2>{view.name}</h2>
            {isFlagged && <span style={{ fontSize: '1.25rem' }} title="Flagged account">🏳</span>}
          </div>
          <div className="admin-user-hero-meta">
            <span
              title={view.email}
              style={{
                maxWidth: '280px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'inline-block',
                verticalAlign: 'bottom',
              }}
            >
              {view.email}
            </span> &bull; <span>@{view.username}</span> &bull; <span>{view.university}</span>
            {view.phone ? (
              <>
                {' '}&bull;{' '}
                <span>
                  📞 {view.phone}{' '}
                  <Badge variant={view.phoneVerified ? 'success' : 'secondary'} size="sm">
                    {view.phoneVerified ? 'Verified' : 'Not verified'}
                  </Badge>
                </span>
              </>
            ) : null}
          </div>
          <div className="admin-user-hero-tags">
            <Badge variant={view.role === 'Mentor' ? 'warning' : 'info'}>
              {view.role}
            </Badge>
            <Badge variant={view.statusBadgeVariant}>
              {view.status}
            </Badge>
            {activeWarnings > 0 && (
              <Badge variant="warning">{activeWarnings}/4 Warnings</Badge>
            )}
            {hasDuplicateFlag && (
              <Badge variant="warning">Possible Duplicate</Badge>
            )}
            <span style={{ fontSize: '0.8rem', color: 'var(--muted-fg, #6b7280)', marginLeft: '4px' }}>
              Member since {view.joinedDateFormatted}
            </span>
          </div>
        </div>
      </div>

      {/* Suspension Panel (shown for suspended accounts) */}
      {isSuspended && suspension && (
        <div
          className="admin-user-section-card"
          data-testid="user-suspension-panel"
          style={{
            marginBottom: '20px',
            borderColor: '#fecaca',
            backgroundColor: '#fef2f2',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
            <h3 className="admin-user-section-title" style={{ margin: 0, color: '#991b1b' }}>
              <span>⛔</span> Account Suspension Details
            </h3>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <Badge variant="danger">{suspension.typeLabel}</Badge>
              {suspension.appealStatusLabel && (
                <Badge variant="warning" data-testid="suspension-appeal-status">
                  Appeal: {suspension.appealStatusLabel}
                </Badge>
              )}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', fontSize: '0.88rem', color: '#1e293b' }}>
            <div>
              <div style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 600 }}>Reason</div>
              <div data-testid="suspension-reason" style={{ marginTop: '2px', fontWeight: 500 }}>{suspension.reason}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 600 }}>Suspension Type</div>
              <div data-testid="suspension-type" style={{ marginTop: '2px', fontWeight: 500 }}>{suspension.typeLabel}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 600 }}>Suspended At</div>
              <div data-testid="suspension-date" style={{ marginTop: '2px', fontWeight: 500 }}>{suspension.suspendedAtFormatted}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 600 }}>Suspended By</div>
              <div data-testid="suspension-by" style={{ marginTop: '2px', fontWeight: 500 }}>{suspension.suspendedByName}</div>
            </div>
            {suspension.appealStatusLabel && (
              <div>
                <div style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 600 }}>Appeal Status</div>
                <div style={{ marginTop: '2px', fontWeight: 500 }}>{suspension.appealStatusLabel}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {!isSuspended && reactivation && (
        <div
          className="admin-user-section-card"
          data-testid="user-reactivation-banner"
          style={{
            marginBottom: '20px',
            borderColor: '#bbf7d0',
            backgroundColor: '#f0fdf4',
            fontSize: '0.88rem',
            color: '#166534',
          }}
        >
          <strong>Account Reactivated</strong>
          {reactivation.reactivatedAtFormatted ? ` on ${reactivation.reactivatedAtFormatted}` : ''}
          {reactivation.reason ? ` — Reason: ${reactivation.reason}` : ''}
        </div>
      )}

      {/* KPI StatCards */}
      <div className="admin-user-stats-grid">
        <StatCard label="Total Experience" value={view.xpFormatted} />
        <StatCard label="Reputation Score" value={view.repFormatted} />
        <StatCard label="Associated Projects" value={view.projectsCount} />
        <StatCard label="Tasks Completed" value={view.completedTasksCount} />
        <StatCard label="Active Warnings" value={`${activeWarnings}/4`} />
        <StatCard label="Mentor Authorization" value={view.mentorStatus} />
      </div>

      <div className="admin-user-details-grid">
        {/* Left Column: Projects & Contributions */}
        <div className="admin-user-left-col">
          <div className="admin-user-section-card">
            <h3 className="admin-user-section-title">
              <span>📁</span> Associated Projects ({view.projects.length})
            </h3>
            {view.projects.length > 0 ? (
              <DataTable
                columns={projectColumns}
                data={view.projects}
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
              <span>📋</span> Task Contribution History ({view.contributions.length})
            </h3>
            {view.contributions.length > 0 ? (
              <DataTable
                columns={taskColumns}
                data={view.contributions}
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
            {view.skills.length > 0 ? (
              <div className="admin-user-skills-wrap">
                {view.skills.map((s, idx) => (
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
              <span>🏅</span> Mentor Recommendations ({view.mentorRecommendations.length})
            </h3>
            {view.mentorRecommendations.length > 0 ? (
              <div className="admin-user-recommendations-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {view.mentorRecommendations.map((rec) => (
                  <div
                    key={rec.id}
                    style={{
                      padding: '12px 16px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--surface-alt, #f8fafc)',
                      border: '1px solid var(--border, #e2e8f0)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <Badge variant="warning">
                        {rec.badgeName}
                      </Badge>
                      {rec.awardedAtFormatted && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--muted-fg, #6b7280)' }}>
                          {rec.awardedAtFormatted}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.88rem', color: 'var(--fg, #1e293b)' }}>
                      Given by <strong>{rec.mentorName}</strong> on{' '}
                      <em>{rec.projectTitle}</em>
                    </div>
                    {rec.comment && (
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
                        &ldquo;{rec.comment}&rdquo;
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
              <span>⚠️</span> Warning History ({view.warnings.length})
            </h3>
            {hasPendingSecondApproval && (
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
                <div>
                  <strong>Pending Second Approval</strong> — Waiting for another admin or Super User to approve or reject suspension request.
                </div>
                {pendingModerationActions
                  .filter((a) => a.status === 'pending')
                  .map((act) => (
                    <div key={act.id} style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                      Requested by {act.requestedByName}: &ldquo;{act.reason}&rdquo; (Expires {act.expiresAtFormatted})
                    </div>
                  ))}
              </div>
            )}
            {view.warnings.length === 0 ? (
              <p style={{ color: 'var(--muted-fg, #6b7280)', fontSize: '0.88rem', margin: 0, fontStyle: 'italic' }}>
                No warnings recorded for this user.
              </p>
            ) : (
              <div className="admin-user-warnings-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {view.warnings.map((w) => (
                  <div
                    key={w.id}
                    className="admin-user-warning-item"
                    style={{
                      padding: '12px 16px',
                      borderRadius: '8px',
                      backgroundColor: w.isActive ? '#fffbeb' : 'var(--surface-alt, #f8fafc)',
                      border: `1px solid ${w.isActive ? '#fde68a' : 'var(--border, #e2e8f0)'}`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem', color: w.isActive ? '#92400e' : '#64748b' }}>
                        {w.indexLabel}
                      </span>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <Badge variant={w.badgeVariant} data-testid={`warning-status-${w.id}`}>
                          {w.badgeLabel}
                        </Badge>
                        <span style={{ fontSize: '0.8rem', color: 'var(--muted-fg, #6b7280)' }}>
                          {w.issuedAtFormatted}
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.88rem', color: 'var(--fg, #1e293b)' }}>
                      <strong>Reason:</strong> {w.reason}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted-fg, #64748b)', marginTop: '4px' }}>
                      Issued by: {w.issuedByName}
                      {w.isExpired && w.expiredAtFormatted ? ` · Expired: ${w.expiredAtFormatted}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="admin-user-section-card">
            <h3 className="admin-user-section-title">
              <span>📜</span> Recent Activity
            </h3>
            {view.recentActivity.length > 0 ? (
              <div className="admin-user-activity-list">
                {view.recentActivity.map((item) => (
                  <div key={item.id} className="admin-user-activity-item">
                    <div className="admin-user-activity-event">{item.eventText}</div>
                    <div className="admin-user-activity-meta">
                      <span>{item.actionText}</span>
                      <span>{item.timestampFormatted}</span>
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
                  {reputationEntries.map((entry) => (
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
                          <span style={{ fontWeight: 500, color: 'var(--fg, #1e293b)' }}>{entry.label}</span>
                          {entry.type && (
                            <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '1px 7px', borderRadius: '999px', backgroundColor: '#e2e8f0', color: '#334155' }}>
                              {entry.type}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted-fg, #64748b)', marginTop: '2px' }}>
                          {entry.createdAtFormatted}
                        </div>
                      </div>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: '0.88rem',
                          color: entry.deltaVal > 0 ? '#16a34a' : entry.deltaVal < 0 ? '#dc2626' : '#64748b',
                        }}
                      >
                        {entry.deltaText} Rep
                      </span>
                    </div>
                  ))}
                </div>

                {repTotal > 20 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', fontSize: '0.82rem' }}>
                    <span style={{ color: 'var(--muted-fg, #6b7280)' }}>
                      Page {repPage} of {view.reputation.totalPages} ({repTotal} total)
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
                        disabled={repPage >= view.reputation.totalPages}
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
                    Avg Rating: {mentorFeedbackData.averageRating} ({mentorFeedbackData.totalFeedbackCount})
                  </Badge>
                  <Badge variant={mentorFeedbackData.abandonmentCount > 0 ? 'warning' : 'secondary'}>
                    Abandonment Incidents: {mentorFeedbackData.abandonmentCount}
                  </Badge>
                </div>
              </div>

              {mentorFeedbackData.feedback.length > 0 ? (
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
                        <strong>{fb.ownerName}</strong>
                        <span>★ {fb.rating} / 5{fb.createdAtFormatted ? ` · ${fb.createdAtFormatted}` : ''}</span>
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

              {mentorFeedbackData.abandonmentHistory.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '0.88rem', margin: '0 0 8px 0', color: '#b45309' }}>Abandonment Releases</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {mentorFeedbackData.abandonmentHistory.map((inc) => (
                      <div key={inc.id} style={{ fontSize: '0.84rem', padding: '8px 10px', borderRadius: '6px', background: '#fffbeb', border: '1px solid #fde68a' }}>
                        <strong>{inc.projectTitle}</strong> — Released {inc.releasedAtFormatted}
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

const AdminUserDetails = AdminUserDetailsContent;
export default AdminUserDetails;
