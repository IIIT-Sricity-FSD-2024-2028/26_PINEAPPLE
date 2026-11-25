import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import adminApi from '../../services/adminApi';
import SearchBar from '../../components/common/SearchBar';
import Badge from '../../components/common/Badge';
import Avatar from '../../components/common/Avatar';
import FilterTabs from '../../components/common/FilterTabs';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import UserTrustCard from '../../components/features/UserTrustCard';
import trustApi from '../../services/trustApi';
import storage from '../../utils/storage';
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

const AdminUsers = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [users, setUsers] = useState([]);
  const [duplicateGroups, setDuplicateGroups] = useState([]);
  const [duplicatesLoading, setDuplicatesLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  
  const rawParam = searchParams.get('filter') || searchParams.get('status') || searchParams.get('tab');
  const [filter, setFilter] = useState(() => resolveFilterParam(rawParam));

  useEffect(() => {
    const raw = searchParams.get('filter') || searchParams.get('status') || searchParams.get('tab');
    setFilter(resolveFilterParam(raw));
  }, [searchParams]);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [trustSummaries, setTrustSummaries] = useState({});

  // Moderation modal state
  const [activeModal, setActiveModal] = useState(null); // { user, action: 'warn'|'suspend'|'activate' }
  const [explanation, setExplanation] = useState('');
  const [explanationError, setExplanationError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionBanner, setActionBanner] = useState(null);
  const [moderationActions, setModerationActions] = useState([]);
  const [approvalDecisionModal, setApprovalDecisionModal] = useState(null); // { action, decision: 'approve'|'reject' }
  const [approvalReason, setApprovalReason] = useState('');
  const [approvalError, setApprovalError] = useState('');
  const [approvalSubmitting, setApprovalSubmitting] = useState(false);

  const currentAdminId = storage.getAdminSession().uid || '';
  
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
    let isMounted = true;
    const loadUsers = async () => {
      try {
        const [data, dupRes, actionsRes] = await Promise.all([
          adminApi.listUsers(),
          adminApi.getDuplicateUsers().catch(() => ({ groups: [] })),
          typeof adminApi.getModerationActions === 'function'
            ? adminApi.getModerationActions().catch(() => [])
            : Promise.resolve([]),
        ]);
        if (isMounted) {
          const userList = Array.isArray(data) ? data : [];
          setUsers(userList);
          setDuplicateGroups(Array.isArray(dupRes?.groups) ? dupRes.groups : []);
          setModerationActions(Array.isArray(actionsRes) ? actionsRes : []);
          setError(null);

          if (userList.length > 0) {
            const userIds = userList.map((u) => String(u.id || '')).filter(Boolean);
            trustApi.getTrustSummaries(userIds.slice(0, 50)).then((summaries) => {
              if (isMounted && Array.isArray(summaries)) {
                const map = {};
                summaries.forEach((s) => {
                  if (s?.userId) map[s.userId] = s;
                });
                setTrustSummaries(map);
              }
            }).catch(() => {});
          }
        }
      } catch (err) {
        console.error('Failed to fetch admin users:', err);
        if (isMounted) {
          setError('Failed to load users. Please try again later.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
          setDuplicatesLoading(false);
        }
      }
    };

    loadUsers();

    return () => {
      isMounted = false;
    };
  }, []);

  const toggleMenu = (id, e) => {
    e.stopPropagation();
    setOpenMenuId(openMenuId === id ? null : id);
  };

  const openModerationModal = (targetUser, action) => {
    setOpenMenuId(null);
    setActiveModal({ user: targetUser, action });
    setExplanation('');
    setExplanationError('');
  };

  const closeModerationModal = () => {
    setActiveModal(null);
    setExplanation('');
    setExplanationError('');
  };

  const handleSubmitModeration = async () => {
    if (!activeModal?.user) return;
    const trimmed = explanation.trim();
    if (trimmed.length < 10) {
      setExplanationError('Written explanation must be at least 10 characters.');
      return;
    }

    setIsProcessing(true);
    setActionBanner(null);
    try {
      const targetId = activeModal.user.id;
      let res = null;
      if (activeModal.action === 'warn') {
        res = await adminApi.warnUser(targetId, { reason: trimmed });
      } else if (activeModal.action === 'suspend') {
        res = await adminApi.suspendUser(targetId, { reason: trimmed });
      } else if (activeModal.action === 'activate') {
        res = await adminApi.reactivateUser(targetId, { reason: trimmed });
      }

      closeModerationModal();
      if (res?.status === 'pending_second_approval') {
        setActionBanner({
          type: 'info',
          message: `Pending second approval for ${activeModal.user?.name || 'user'} — waiting for another admin or Super User within 72 hours.`,
        });
      }
      // Reload fresh user list & approvals
      const [freshData, freshActions] = await Promise.all([
        adminApi.listUsers(),
        typeof adminApi.getModerationActions === 'function'
          ? adminApi.getModerationActions().catch(() => [])
          : Promise.resolve([]),
      ]);
      if (Array.isArray(freshData)) {
        setUsers(freshData);
      }
      if (Array.isArray(freshActions)) {
        setModerationActions(freshActions);
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Action failed.';
      setExplanationError(errMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAction = async (id, actionType) => {
    setOpenMenuId(null);
    try {
      if (actionType === 'flag') {
        await adminApi.flagUser(id);
        setUsers((prev) => prev.map((u) => u.id === id ? { ...u, status: 'Flagged', flags: true, flagged: true } : u));
      } else if (actionType === 'unflag') {
        await adminApi.updateUserStatus(id, { status: 'Active' });
        setUsers((prev) => prev.map((u) => u.id === id ? { ...u, status: 'Active', flags: false, flagged: false } : u));
      }
    } catch (err) {
      console.error(`Failed to perform action ${actionType} on user ${id}`, err);
      alert(`Action failed: ${err.message || 'Unknown error'}`);
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

  const getFilterCount = (filterId) => {
    return users.filter(u => matchesStatusFilter(u, filterId)).length;
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

  const pendingApprovalsCount = moderationActions.filter((a) => a.status === 'pending').length;

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
    if (filterId === 'duplicates') return duplicateGroups.length;
    if (filterId === 'approvals') return pendingApprovalsCount;
    return getFilterCount(filterId);
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
            onClick={() => setActionBanner(null)}
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
                        <strong>Suspend: {act.targetUserName || `User #${act.targetUserId}`}</strong>
                        <Badge variant={act.status === 'pending' ? 'warning' : act.status === 'approved' ? 'success' : 'secondary'}>
                          {act.status === 'pending' && isSelf ? 'Waiting for another admin' : act.status}
                        </Badge>
                      </div>
                      <div style={{ fontSize: '0.84rem', color: '#475569', marginTop: '4px' }}>
                        Requested by: <strong>{act.requestedByName || act.requestedBy}</strong> · Triggers:{' '}
                        {(act.thresholdReasons || []).join(', ') || 'Threshold met'} · Expires:{' '}
                        {act.expiresAt ? new Date(act.expiresAt).toLocaleString() : '—'}
                      </div>
                      <div style={{ fontSize: '0.86rem', marginTop: '4px' }}>
                        <strong>Reason:</strong> {act.reason}
                      </div>
                      {act.decisionReason && (
                        <div style={{ fontSize: '0.82rem', color: '#334155', marginTop: '4px' }}>
                          <strong>Decision Note ({act.decidedByName || act.decidedBy}):</strong> {act.decisionReason}
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
                                setApprovalDecisionModal({ action: act, decision: 'approve' });
                                setApprovalReason('');
                                setApprovalError('');
                              }}
                            >
                              Approve Suspension
                            </button>
                            <button
                              type="button"
                              data-testid={`reject-mod-action-${act.id}`}
                              className="btn btn-outline btn-sm"
                              onClick={() => {
                                setApprovalDecisionModal({ action: act, decision: 'reject' });
                                setApprovalReason('');
                                setApprovalError('');
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
                  <Avatar name={cleanName} initials={initials} size="md" />
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

                  <Badge variant={user.status} className={getStatusBadgeClass(user.status)}>
                    {user.pendingModerationAction
                      ? 'Pending 2nd Approval'
                      : activeWarnings > 0 && !isSuspended
                      ? `Warned (${activeWarnings}/4)`
                      : toTitleCase(user.status || 'active')}
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

      {approvalDecisionModal && (
        <Modal
          isOpen={true}
          title={
            approvalDecisionModal.decision === 'approve'
              ? 'Approve Suspension Request'
              : 'Reject Suspension Request'
          }
          onClose={() => !approvalSubmitting && setApprovalDecisionModal(null)}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-outline"
                disabled={approvalSubmitting}
                onClick={() => setApprovalDecisionModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="confirm-approval-decision-btn"
                className={`btn ${approvalDecisionModal.decision === 'approve' ? 'btn-danger' : 'btn-primary'}`}
                disabled={approvalSubmitting || approvalReason.trim().length < 10}
                onClick={async () => {
                  setApprovalSubmitting(true);
                  setApprovalError('');
                  try {
                    const targetAction = approvalDecisionModal.action;
                    if (approvalDecisionModal.decision === 'approve') {
                      await adminApi.approveModerationAction(targetAction.id, approvalReason.trim());
                    } else {
                      await adminApi.rejectModerationAction(targetAction.id, approvalReason.trim());
                    }
                    setApprovalDecisionModal(null);
                    const [freshUsers, freshActions] = await Promise.all([
                      adminApi.listUsers(),
                      adminApi.getModerationActions(),
                    ]);
                    if (Array.isArray(freshUsers)) setUsers(freshUsers);
                    if (Array.isArray(freshActions)) setModerationActions(freshActions);
                  } catch (err) {
                    setApprovalError(err?.serverMessage || err?.message || 'Decision failed.');
                  } finally {
                    setApprovalSubmitting(false);
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

export default AdminUsers;
