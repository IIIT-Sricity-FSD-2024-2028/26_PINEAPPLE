import { useState, useEffect, useRef, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toText } from '../../utils/toText';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  fetchAdminUsers,
  flagAdminUser,
  updateAdminUserStatus,
} from '../../store/thunks/adminUsersThunks';
import {
  setAdminUsersFilter,
  setAdminUsersQuery,
} from '../../store/slices/adminUsersSlice';
import {
  selectAdminDuplicateGroups,
  selectAdminTrustSummaries,
  selectAdminUserCounts,
  selectAdminUsersError,
  selectAdminUsersStatus,
  selectAdminUsersWorking,
  selectAllAdminUsers,
} from '../../store/selectors/adminUsersSelectors';
import { issueUserWarning } from '../../store/thunks/warningsThunks';
import {
  approveModerationAction,
  fetchModerationActions,
  reactivateUserModeration,
  rejectModerationAction,
  suspendUserModeration,
} from '../../store/thunks/pendingModerationActionsThunks';
import {
  clearModerationError,
  closeApprovalDecisionModal,
  openApprovalDecisionModal,
  setModerationActionBanner,
} from '../../store/slices/pendingModerationActionsSlice';
import {
  selectAllModerationActions,
  selectModerationWorking,
} from '../../store/selectors/pendingModerationActionsSelectors';
import {
  selectCurrentAdminUid,
} from '../../store/selectors/sessionSelectors';
import SearchBar from '../../components/common/SearchBar';
import Badge from '../../components/common/Badge';
import Avatar from '../../components/common/Avatar';
import FilterTabs from '../../components/common/FilterTabs';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import UserTrustCard from '../../components/features/UserTrustCard';
import './AdminUsers.css';

const VALID_FILTERS = ['all', 'active', 'suspended', 'flagged', 'duplicates', 'approvals'];

const resolveFilterParam = (param) => {
  if (!param) return 'all';
  const lower = String(param).trim().toLowerCase();
  if (lower === 'warned' || !VALID_FILTERS.includes(lower)) {
    return 'all';
  }
  return lower;
};

const FlagIcon = () => (
  <span className="admin-users-flag" title="Flagged account">🏳</span>
);

const AdminUsersContent = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const users = useSelector(selectAllAdminUsers);
  const duplicateGroups = useSelector(selectAdminDuplicateGroups);
  const userCounts = useSelector(selectAdminUserCounts);
  const trustSummaries = useSelector(selectAdminTrustSummaries);
  const usersStatus = useSelector(selectAdminUsersStatus);
  const error = useSelector(selectAdminUsersError);
  const usersWorking = useSelector(selectAdminUsersWorking);

  const loading = usersStatus === 'idle' || (usersStatus === 'loading' && users.length === 0);
  const duplicatesLoading = loading;
  const query = usersWorking.query || '';
  const setQuery = (val) => dispatch(setAdminUsersQuery(val));

  const rawParam = searchParams.get('filter') || searchParams.get('status') || searchParams.get('tab');
  const filter = usersWorking.filter || 'all';
  const setFilter = (val) => dispatch(setAdminUsersFilter(val));

  useEffect(() => {
    const raw = searchParams.get('filter') || searchParams.get('status') || searchParams.get('tab');
    dispatch(setAdminUsersFilter(resolveFilterParam(raw)));
  }, [searchParams, dispatch]);
  useEffect(() => {
    if (rawParam && rawParam !== 'all') {
      dispatch(setAdminUsersFilter(resolveFilterParam(rawParam)));
    }
  }, [rawParam, dispatch]);
  const [openMenuId, setOpenMenuId] = useState(null);

  // Moderation modal & second-approval queue (backed by pendingModerationActionsSlice + warningsSlice)
  const moderationActions = useSelector(selectAllModerationActions);
  const moderationWorking = useSelector(selectModerationWorking);
  const storeAdminUid = useSelector(selectCurrentAdminUid);

  const [activeModal, setActiveModal] = useState(null); // { user, action: 'warn'|'suspend'|'activate' }
  const [explanation, setExplanation] = useState('');
  const [localExplanationError, setLocalExplanationError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const actionBanner = moderationWorking.actionBanner;
  const explanationError = localExplanationError || moderationWorking.error || '';

  const approvalDecisionModal = useMemo(() => {
    if (!moderationWorking.approvalModalActionId) return null;
    const action = moderationActions.find(
      (a) => String(a.id) === String(moderationWorking.approvalModalActionId),
    );
    if (!action) return null;
    return { action, decision: moderationWorking.approvalModalDecision };
  }, [moderationActions, moderationWorking.approvalModalActionId, moderationWorking.approvalModalDecision]);

  const [approvalReason, setApprovalReason] = useState('');
  const approvalError = moderationWorking.approvalError || '';
  const approvalSubmitting = Boolean(moderationWorking.approvalSubmitting);

  const currentAdminId = storeAdminUid || '';
  
  const listRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (listRef.current && !listRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    dispatch(fetchModerationActions());
    dispatch(fetchAdminUsers());
  }, [dispatch]);

  const toggleMenu = (id, e) => {
    e.stopPropagation();
    setOpenMenuId(openMenuId === id ? null : id);
  };

  const openModerationModal = (targetUser, action) => {
    setOpenMenuId(null);
    setActiveModal({ user: targetUser, action });
    setExplanation('');
    setLocalExplanationError('');
    dispatch(clearModerationError());
  };

  const closeModerationModal = () => {
    setActiveModal(null);
    setExplanation('');
    setLocalExplanationError('');
    dispatch(clearModerationError());
  };

  const handleSubmitModeration = async () => {
    if (!activeModal?.user) return;
    const trimmed = explanation.trim();
    if (trimmed.length < 10) {
      setLocalExplanationError('Written explanation must be at least 10 characters.');
      return;
    }

    setIsProcessing(true);
    dispatch(setModerationActionBanner(null));
    try {
      const targetId = activeModal.user.id;
      if (activeModal.action === 'warn') {
        await dispatch(issueUserWarning({ userId: targetId, reason: trimmed })).unwrap();
      } else if (activeModal.action === 'suspend') {
        await dispatch(
          suspendUserModeration({
            userId: targetId,
            targetUserName: activeModal.user?.name,
            reason: trimmed,
          }),
        ).unwrap();
      } else if (activeModal.action === 'activate') {
        await dispatch(
          reactivateUserModeration({ userId: targetId, reason: trimmed }),
        ).unwrap();
      }

      closeModerationModal();
      dispatch(fetchModerationActions());
      dispatch(fetchAdminUsers());
    } catch (err) {
      const errMsg = err?.response?.data?.message || err?.message || 'Action failed.';
      setLocalExplanationError(errMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAction = async (id, actionType) => {
    setOpenMenuId(null);
    try {
      if (actionType === 'flag') {
        await dispatch(flagAdminUser(id)).unwrap();
        dispatch(fetchAdminUsers());
      } else if (actionType === 'unflag') {
        await dispatch(updateAdminUserStatus({ userId: id, status: 'Active' })).unwrap();
        dispatch(fetchAdminUsers());
      }
    } catch (err) {
      console.error(`Failed to perform action ${actionType} on user ${id}`, err);
      alert(`Action failed: ${err?.serverMessage || err?.message || 'Unknown error'}`);
    }
  };

  const matchesStatusFilter = (user, filterId) => {
    const s = (user.status || '').toLowerCase();
    const isFlagged = user.status === 'Flagged' || user.flags === true || user.flagged === true;
    const isWarned = s === 'warned' || (user.warnings && user.warnings > 0);
    const isSuspended = s === 'suspended';
    
    if (filterId === 'all' || filterId === 'warned') return true;
    if (filterId === 'flagged') return isFlagged;
    if (filterId === 'suspended') return isSuspended;
    if (filterId === 'active') return !isSuspended && !isFlagged && !isWarned;
    return s === filterId;
  };

  const getFilteredUsers = () => {
    return users.filter(user => {
      const q = query.trim().toLowerCase();
      const university = user.university || user.profile?.uni || user.profile?.university || '';
      const matchesQuery = !q || 
        (user.name && user.name.toLowerCase().includes(q)) || 
        (university && university.toLowerCase().includes(q));
      
      if (!matchesQuery) return false;
      return matchesStatusFilter(user, filter);
    });
  };

  const toTitleCase = (str) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  const getStatusBadgeClass = (status) => {
    const s = status?.toLowerCase();
    if (s === 'warned') return 'status-pending';
    if (s === 'suspended') return 'status-rejected';
    return 'status-active';
  };

  const filters = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'suspended', label: 'Suspended' },
    { id: 'flagged', label: 'Flagged' },
    { id: 'duplicates', label: 'Possible duplicates' },
    { id: 'approvals', label: 'Approvals' },
  ];

  const handleFilterChange = (newFilter) => {
    const resolved = resolveFilterParam(newFilter);
    setFilter(resolved);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (resolved === 'all') {
        next.delete('filter');
        next.delete('status');
        next.delete('tab');
      } else {
        next.set('filter', resolved);
      }
      return next;
    }, { replace: true });
  };

  const getTabCount = (filterId) => {
    switch (filterId) {
      case 'all':
        return userCounts.total ?? 0;
      case 'active':
        return userCounts.active ?? 0;
      case 'suspended':
        return userCounts.suspended ?? 0;
      case 'flagged':
        return userCounts.flagged ?? 0;
      case 'duplicates':
        return userCounts.possibleDuplicates ?? 0;
      case 'approvals':
        return userCounts.pendingApprovals ?? 0;
      default:
        return 0;
    }
  };

  const filteredUsers = getFilteredUsers();

  return (
    <div id="admin-users" className="admin-page">
      <h1>User Management</h1>
      <p className="page-subtitle mt-1">Monitor accounts, issue warnings, and manage suspensions.</p>

      {actionBanner && (
        <div
          role="alert"
          data-testid="admin-users-action-banner"
          style={{
            marginTop: '12px',
            padding: '10px 14px',
            borderRadius: '8px',
            background: actionBanner.type === 'error' ? '#fef2f2' : '#eff6ff',
            border: `1px solid ${actionBanner.type === 'error' ? '#fecaca' : '#bfdbfe'}`,
            color: actionBanner.type === 'error' ? '#991b1b' : '#1e40af',
            fontSize: '0.88rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{actionBanner.message}</span>
          <button
            type="button"
            onClick={() => dispatch(setModerationActionBanner(null))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      <div className="admin-users-toolbar mt-4">
        <SearchBar
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onClear={() => setQuery('')}
          placeholder="Search by name or university..."
        />
        <div id="admin-users-filters" className="admin-users-filters" style={{ overflowX: 'auto' }}>
          <FilterTabs
            tabs={filters.map(f => ({
              id: f.id,
              label: `${f.label} (${getTabCount(f.id)})`,
            }))}
            activeTab={filter}
            onChange={handleFilterChange}
            ariaLabel="User status filters"
          />
        </div>
      </div>

      <div className="admin-users-list mt-3" ref={listRef}>
        {filter === 'approvals' ? (
          moderationActions.length === 0 ? (
            <EmptyState
              title="No second-approval requests"
              message="No manual suspensions currently require second approval."
            />
          ) : (
            <div data-testid="moderation-approvals-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {moderationActions.map((act) => {
                const isSelf = currentAdminId && String(act.requestedBy) === String(currentAdminId);
                return (
                  <div
                    key={act.id}
                    data-testid={`moderation-action-card-${act.id}`}
                    style={{
                      border: '1px solid #cbd5e1',
                      borderRadius: '10px',
                      padding: '14px 16px',
                      background: act.status === 'pending' ? '#fffbeb' : '#f8fafc',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: '240px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <strong>Suspend: {toText(act.targetUserName, `User #${act.targetUserId}`)}</strong>
                        <Badge variant={toText(act.status) === 'pending' ? 'warning' : toText(act.status) === 'approved' ? 'success' : 'secondary'}>
                          {toText(act.status) === 'pending' && isSelf ? 'Waiting for another admin' : toText(act.status)}
                        </Badge>
                      </div>
                      <div style={{ fontSize: '0.84rem', color: '#475569', marginTop: '4px' }}>
                        Requested by: <strong>{toText(act.requestedByName ?? act.requestedBy, 'Administrator')}</strong> · Triggers:{' '}
                        {(act.thresholdReasons || []).map((r) => toText(r)).join(', ') || 'Threshold met'} · Expires:{' '}
                        {act.expiresAt ? new Date(act.expiresAt).toLocaleString() : '—'}
                      </div>
                      <div style={{ fontSize: '0.86rem', marginTop: '4px' }}>
                        <strong>Reason:</strong> {toText(act.reason)}
                      </div>
                      {act.decisionReason && (
                        <div style={{ fontSize: '0.82rem', color: '#334155', marginTop: '4px' }}>
                          <strong>Decision Note ({toText(act.decidedByName ?? act.decidedBy, 'Admin')}):</strong> {toText(act.decisionReason)}
                        </div>
                      )}
                    </div>
                    {act.status === 'pending' && (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {isSelf ? (
                          <span data-testid={`waiting-other-admin-${act.id}`} style={{ fontSize: '0.82rem', color: '#92400e', fontWeight: 600 }}>
                            Waiting for another admin
                          </span>
                        ) : (
                          <>
                            <button
                              type="button"
                              data-testid={`approve-mod-action-${act.id}`}
                              className="btn btn-danger btn-sm"
                              onClick={() => {
                                dispatch(
                                  openApprovalDecisionModal({
                                    actionId: act.id,
                                    decision: 'approve',
                                  }),
                                );
                                setApprovalReason('');
                              }}
                            >
                              Approve Suspension
                            </button>
                            <button
                              type="button"
                              data-testid={`reject-mod-action-${act.id}`}
                              className="btn btn-outline btn-sm"
                              onClick={() => {
                                dispatch(
                                  openApprovalDecisionModal({
                                    actionId: act.id,
                                    decision: 'reject',
                                  }),
                                );
                                setApprovalReason('');
                              }}
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        ) : filter === 'duplicates' ? (
          duplicatesLoading || loading ? (
            <div className="admin-users-empty">Loading possible duplicate groups...</div>
          ) : duplicateGroups.length === 0 ? (
            <EmptyState
              title="No possible duplicates found"
              message="No accounts currently share a normalized email address or verified phone number."
            />
          ) : (
            <div data-testid="duplicate-groups-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {duplicateGroups.map((group) => (
                <div
                  key={group.key}
                  data-testid={`duplicate-group-${group.type}`}
                  style={{
                    border: '1px solid #fed7aa',
                    backgroundColor: '#fff7ed',
                    borderRadius: '10px',
                    padding: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <span
                        style={{
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          padding: '2px 8px',
                          borderRadius: '999px',
                          background: group.type === 'phone' ? '#fee2e2' : '#fef3c7',
                          color: group.type === 'phone' ? '#991b1b' : '#92400e',
                          marginRight: '0.5rem',
                        }}
                      >
                        {group.reason}
                      </span>
                      <span style={{ fontSize: '0.85rem', color: '#475569', fontFamily: 'monospace' }}>
                        {group.normalizedValue}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
                      {group.users.length} accounts (review only — never auto-blocked)
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {group.users.map((u) => (
                      <div
                        key={u.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          padding: '0.55rem 0.8rem',
                          gap: '0.75rem',
                          flexWrap: 'wrap',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                            {u.name} <span style={{ color: '#64748b', fontWeight: 400 }}>@{u.username || u.id}</span>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                            <span
                              title={u.email}
                              style={{
                                maxWidth: '240px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                display: 'inline-block',
                                verticalAlign: 'bottom',
                              }}
                            >
                              {u.email}
                            </span>
                            {u.phoneVerified && u.phone ? ` · Phone: ${u.phone}` : ''}
                            {` · Status: ${u.status}`}
                          </div>
                        </div>
                        <Link
                          to={`/admin/users/${u.id}`}
                          className="btn btn-outline btn-sm"
                          style={{ fontSize: '0.8rem' }}
                        >
                          Inspect Account
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : loading ? (
          <div className="admin-users-empty">Loading users...</div>
        ) : error ? (
          <div className="admin-users-empty" style={{ color: 'var(--destructive)' }}>{error}</div>
        ) : filteredUsers.length === 0 ? (
          <EmptyState
            title="No users found"
            message={query.trim() ? `No users match "${query}". Try another search term.` : "No user accounts match the selected filter."}
          />
        ) : (
          filteredUsers.map((user, index) => {
            const isMenuOpen = openMenuId === user.id;
            const isLastRows = index >= filteredUsers.length - 2 && filteredUsers.length > 2;
            const cleanName = (user.name || 'User').replace(/\s*\([^)]*\)$/, '').trim();
            const initials = user.initials || (cleanName ? cleanName.substring(0, 2).toUpperCase() : 'US');
            const isFlagged = user.status === 'Flagged' || user.flags === true || user.flagged === true;
            const isSuspended = (user.status || '').toLowerCase() === 'suspended';
            const activeWarnings = user.activeWarningsCount ?? user.warningsCount ?? (
              Array.isArray(user.warnings)
                ? user.warnings.filter((w) => typeof w === 'object' ? w.active !== false : true).length
                : (typeof user.warnings === 'number' ? user.warnings : 0)
            );
            const xp = user.xp ?? user.profile?.xp ?? 0;
            const rep = user.rep ?? user.profile?.rep ?? 0;
            const projectsCount = user.projects ?? (Array.isArray(user.data?.projects) ? user.data.projects.length : 0);
            const university = user.university || user.profile?.uni || user.profile?.university || '';
            
            return (
              <div key={user.id} className={`admin-user-row ${isFlagged ? 'flagged' : ''}`}>
                <div className="admin-user-left">
                  <Avatar name={cleanName} src={user.avatarUrl || user.avatar || user.profile?.avatarUrl} version={user.updatedAt} initials={initials} size="md" />
                  <div>
                    <div className="admin-user-name">
                      {cleanName} {isFlagged && <FlagIcon />}
                    </div>
                    <div className="admin-user-meta">{university ? `${university} · ` : ''}{user.role || 'User'}</div>
                  </div>
                </div>

                <div className="admin-user-right">
                  {trustSummaries[user.id] ? (
                    <div style={{ marginRight: '8px' }}>
                      <UserTrustCard summary={trustSummaries[user.id]} variant="compact" isAdminViewer={true} />
                    </div>
                  ) : (
                    <div className="admin-user-metrics">
                      <div>
                        <div className="admin-user-metric-value">{Number(xp).toLocaleString()}</div>
                        <div className="admin-user-metric-label">XP</div>
                      </div>
                      <div>
                        <div className="admin-user-metric-value">{Number(rep).toLocaleString()}</div>
                        <div className="admin-user-metric-label">Rep</div>
                      </div>
                      <div>
                        <div className="admin-user-metric-value">{Number(projectsCount).toLocaleString()}</div>
                        <div className="admin-user-metric-label">Projects</div>
                      </div>
                    </div>
                  )}

                  <Badge variant={toText(user.status, 'Active')} className={getStatusBadgeClass(toText(user.status, 'Active'))}>
                    {user.pendingModerationAction
                      ? 'Pending 2nd Approval'
                      : activeWarnings > 0 && !isSuspended
                      ? `Warned (${activeWarnings}/4)`
                      : toTitleCase(toText(user.status, 'active'))}
                  </Badge>
                  
                  <div className="admin-user-actions dropdown">
                    <button
                      className="admin-user-open"
                      onClick={(e) => toggleMenu(user.id, e)}
                      aria-label={`Open actions for ${user.name}`}
                      aria-expanded={isMenuOpen}
                    >
                      &#9662;
                    </button>
                    <div className={`dropdown-menu admin-user-menu ${isMenuOpen ? 'open' : ''} ${isLastRows ? 'dropup' : ''}`}>
                      <button
                        className="dropdown-item"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(null);
                          navigate(`/admin/users/${user.id}`);
                        }}
                      >
                        View profile
                      </button>
                      <button
                        className="dropdown-item"
                        onClick={(e) => {
                          e.stopPropagation();
                          openModerationModal(user, 'warn');
                        }}
                      >
                        Warn user
                      </button>
                      {!isSuspended ? (
                        <button
                          className="dropdown-item danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            openModerationModal(user, 'suspend');
                          }}
                        >
                          Suspend user
                        </button>
                      ) : (
                        <button
                          className="dropdown-item"
                          onClick={(e) => {
                            e.stopPropagation();
                            openModerationModal(user, 'activate');
                          }}
                        >
                          Reactivate user
                        </button>
                      )}
                      <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); handleAction(user.id, isFlagged ? 'unflag' : 'flag'); }}>
                        {isFlagged ? 'Remove flag' : 'Flag account'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {activeModal && (
        <Modal
          isOpen={Boolean(activeModal)}
          title={
            activeModal.action === 'warn'
              ? `Issue Warning to ${activeModal.user?.name || 'User'}`
              : activeModal.action === 'suspend'
              ? `Suspend Account: ${activeModal.user?.name || 'User'}`
              : `Reactivate Account: ${activeModal.user?.name || 'User'}`
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
                className={`btn ${activeModal.action === 'suspend' ? 'btn-danger' : 'btn-primary'}`}
                onClick={handleSubmitModeration}
                disabled={isProcessing || explanation.trim().length < 10}
              >
                {isProcessing
                  ? 'Processing...'
                  : activeModal.action === 'warn'
                  ? 'Confirm Warning'
                  : activeModal.action === 'suspend'
                  ? 'Confirm Suspension'
                  : 'Confirm Reactivation'}
              </button>
            </div>
          }
        >
          <div>
            <p style={{ marginBottom: '12px', fontSize: '0.9rem', color: 'var(--muted-fg, #64748b)' }}>
              {activeModal.action === 'warn' &&
                'A warning deducts 10 reputation and sends a notification (Warning N/4) and email to the user. The 4th active warning triggers automatic suspension.'}
              {activeModal.action === 'suspend' &&
                'Suspending this user restricts access immediately, closes owned projects, releases active tasks back to unassigned, and notifies collaborators and mentors via email.'}
              {activeModal.action === 'activate' &&
                'Reactivating this user restores access and resets active warnings to 0. A notification will be sent to the user.'}
            </p>
            <label htmlFor="user-moderation-explanation" style={{ display: 'block', fontWeight: 600, marginBottom: '6px' }}>
              Written Explanation <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              id="user-moderation-explanation"
              className="form-control"
              rows={4}
              value={explanation}
              onChange={(e) => {
                setExplanation(e.target.value);
                if (localExplanationError && e.target.value.trim().length >= 10) {
                  setLocalExplanationError('');
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

      {approvalDecisionModal && (
        <Modal
          isOpen={true}
          title={
            approvalDecisionModal.decision === 'approve'
              ? 'Approve Suspension Request'
              : 'Reject Suspension Request'
          }
          onClose={() => !approvalSubmitting && dispatch(closeApprovalDecisionModal())}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-outline"
                disabled={approvalSubmitting}
                onClick={() => dispatch(closeApprovalDecisionModal())}
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="confirm-approval-decision-btn"
                className={`btn ${approvalDecisionModal.decision === 'approve' ? 'btn-danger' : 'btn-primary'}`}
                disabled={approvalSubmitting || approvalReason.trim().length < 10}
                onClick={async () => {
                  try {
                    const targetAction = approvalDecisionModal.action;
                    if (approvalDecisionModal.decision === 'approve') {
                      await dispatch(
                        approveModerationAction({
                          actionId: targetAction.id,
                          reason: approvalReason.trim(),
                        }),
                      ).unwrap();
                    } else {
                      await dispatch(
                        rejectModerationAction({
                          actionId: targetAction.id,
                          reason: approvalReason.trim(),
                        }),
                      ).unwrap();
                    }
                    dispatch(fetchAdminUsers());
                  } catch {
                    // Error stored in pendingModerationActionsSlice.working.approvalError
                  }
                }}
              >
                {approvalSubmitting ? 'Submitting...' : 'Confirm Decision'}
              </button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <p style={{ margin: 0, fontSize: '0.88rem', color: '#475569' }}>
              Provide a written reason (10 to 500 characters) for this second-approval decision.
            </p>
            <textarea
              rows={4}
              data-testid="approval-reason-input"
              value={approvalReason}
              onChange={(e) => setApprovalReason(e.target.value)}
              placeholder="Enter written review reason (min 10 chars)..."
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
            />
            {approvalError && <div style={{ color: '#dc2626', fontSize: '0.85rem' }}>{approvalError}</div>}
          </div>
        </Modal>
      )}
    </div>
  );
};

const AdminUsers = AdminUsersContent;
export default AdminUsers;
