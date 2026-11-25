import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import supportApi from '../../services/supportApi';
import SearchBar from '../../components/common/SearchBar';
import Modal from '../../components/common/Modal';
import EmptyState from '../../components/common/EmptyState';
import { formatDateTime } from '../../utils/dateFormatter';
import storage from '../../utils/storage';
import './AdminSupport.css';

function formatRelativeAge(iso) {
  if (!iso) return '-';
  const diffMs = Date.now() - new Date(iso).getTime();
  if (isNaN(diffMs) || diffMs < 0) return 'Just now';
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatStatusLabel(status) {
  const s = String(status || 'open').replace('in-progress', 'in_progress');
  if (s === 'in_progress') return 'In Progress';
  if (s === 'waiting_user') return 'Waiting User';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const AdminSupport = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const adminSession = storage.getAdminSession();
  const portalRole = adminSession.portalRole;
  const role = adminSession.role || adminSession.portalRole;
  const isSuperUser =
    adminSession.isSuperUser ||
    portalRole?.toLowerCase() === 'superuser' ||
    portalRole?.toLowerCase() === 'super user' ||
    role?.toLowerCase() === 'superuser' ||
    role?.toLowerCase() === 'super user';

  const permissions = Array.isArray(adminSession.permissions) ? adminSession.permissions : null;

  const hasSupportPermission =
    isSuperUser ||
    !permissions ||
    (Array.isArray(permissions) && (permissions.includes('*') || permissions.includes('support')));

  // List & filter state
  const [tickets, setTickets] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [assignees, setAssignees] = useState([]);

  // Drawer / detail state
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [drawerError, setDrawerError] = useState('');
  const [drawerSuccess, setDrawerSuccess] = useState('');
  const [updatingMeta, setUpdatingMeta] = useState(false);

  // Pending terminal status transition note
  const [pendingTerminalStatus, setPendingTerminalStatus] = useState('');
  const [terminalNote, setTerminalNote] = useState('');

  // Reply state
  const [replyBody, setReplyBody] = useState('');
  const [replyInternal, setReplyInternal] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);

  // Close project dialog state (for project_closure tickets)
  const [closeProjectModalOpen, setCloseProjectModalOpen] = useState(false);
  const [closeReason, setCloseReason] = useState('');
  const [closingProject, setClosingProject] = useState(false);
  const [closeError, setCloseError] = useState('');

  const loadAssignees = useCallback(async () => {
    if (!hasSupportPermission) return;
    await Promise.resolve();
    try {
      const list = await supportApi.listAssignees();
      setAssignees(Array.isArray(list) ? list : []);
    } catch {
      setAssignees([]);
    }
  }, [hasSupportPermission]);

  const loadTickets = useCallback(async () => {
    if (!hasSupportPermission) {
      await Promise.resolve();
      setLoading(false);
      return;
    }
    await Promise.resolve();
    setLoading(true);
    setError('');
    try {
      const res = await supportApi.listAdminTickets({
        status: statusFilter,
        type: typeFilter,
        assignee: assigneeFilter,
        q: searchQuery,
        page,
        limit: 10,
      });
      setTickets(Array.isArray(res?.items) ? res.items : []);
      setTotal(Number(res?.total || 0));
      setTotalPages(Math.max(1, Number(res?.totalPages || 1)));
    } catch (err) {
      setError(err?.serverMessage || err?.message || 'Failed to load support tickets.');
    } finally {
      setLoading(false);
    }
  }, [hasSupportPermission, statusFilter, typeFilter, assigneeFilter, searchQuery, page]);

  useEffect(() => {
    let active = true;
    if (!hasSupportPermission) return undefined;
    supportApi.listAssignees()
      .then((list) => {
        if (active) setAssignees(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (active) setAssignees([]);
      });
    return () => {
      active = false;
    };
  }, [hasSupportPermission]);

  useEffect(() => {
    let active = true;
    if (!hasSupportPermission) {
      Promise.resolve().then(() => {
        if (active) setLoading(false);
      });
      return () => {
        active = false;
      };
    }
    supportApi.listAdminTickets({
      status: statusFilter,
      type: typeFilter,
      assignee: assigneeFilter,
      q: searchQuery,
      page,
      limit: 10,
    })
      .then((res) => {
        if (!active) return;
        setError('');
        setTickets(Array.isArray(res?.items) ? res.items : []);
        setTotal(Number(res?.total || 0));
        setTotalPages(Math.max(1, Number(res?.totalPages || 1)));
      })
      .catch((err) => {
        if (active) {
          setError(err?.serverMessage || err?.message || 'Failed to load support tickets.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [hasSupportPermission, statusFilter, typeFilter, assigneeFilter, searchQuery, page]);

  const openTicketDetail = useCallback(async (ticketId) => {
    setDetailLoading(true);
    setDrawerError('');
    setDrawerSuccess('');
    setPendingTerminalStatus('');
    setTerminalNote('');
    setReplyBody('');
    setReplyInternal(false);
    try {
      const detail = await supportApi.getAdminTicket(ticketId);
      setSelectedTicket(detail);
    } catch (err) {
      setError(err?.serverMessage || err?.message || 'Could not load ticket details.');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // Support deep linking via ?ticket=id
  const deepLinkedTicketId = searchParams.get('ticket');
  useEffect(() => {
    if (!deepLinkedTicketId || !hasSupportPermission) return undefined;
    let active = true;
    supportApi.getAdminTicket(deepLinkedTicketId)
      .then((detail) => {
        if (!active) return;
        setDrawerError('');
        setDrawerSuccess('');
        setSelectedTicket(detail);
      })
      .catch((err) => {
        if (active) {
          setError(err?.serverMessage || err?.message || 'Could not load ticket details.');
        }
      });
    return () => {
      active = false;
    };
  }, [deepLinkedTicketId, hasSupportPermission]);

  const handleCloseDrawer = () => {
    if (updatingMeta || sendingReply) return;
    setSelectedTicket(null);
    if (searchParams.has('ticket')) {
      searchParams.delete('ticket');
      setSearchParams(searchParams, { replace: true });
    }
  };

  const applyTicketUpdate = async (patchPayload, successMsg = 'Ticket updated.') => {
    void loadAssignees;
    if (!selectedTicket) return;
    setUpdatingMeta(true);
    setDrawerError('');
    setDrawerSuccess('');
    try {
      const updated = await supportApi.updateAdminTicket(selectedTicket.id, patchPayload);
      setSelectedTicket(updated);
      setPendingTerminalStatus('');
      setTerminalNote('');
      setDrawerSuccess(successMsg);
      loadTickets();
    } catch (err) {
      if (err?.code === 'TICKET_CLOSED' || /read-only|ticket_closed/i.test(err?.serverMessage || err?.message || '')) {
        try {
          const fresh = await supportApi.getAdminTicket(selectedTicket.id);
          setSelectedTicket(fresh);
        } catch {}
        setPendingTerminalStatus('');
        setTerminalNote('');
        setDrawerError('This ticket is closed and read-only.');
        loadTickets();
      } else {
        setDrawerError(err?.serverMessage || err?.message || 'Failed to update ticket.');
      }
    } finally {
      setUpdatingMeta(false);
    }
  };

  const handleStatusChange = (nextStatus) => {
    if (!selectedTicket || nextStatus === selectedTicket.status) return;
    if (nextStatus === 'resolved' || nextStatus === 'rejected') {
      setPendingTerminalStatus(nextStatus);
      setTerminalNote('');
      setDrawerError('');
      return;
    }
    setPendingTerminalStatus('');
    applyTicketUpdate({ status: nextStatus }, `Status updated to ${formatStatusLabel(nextStatus)}.`);
  };

  const handleConfirmTerminalStatus = (e) => {
    e.preventDefault();
    const trimmed = terminalNote.trim();
    if (trimmed.length < 10 || trimmed.length > 500) {
      setDrawerError('A resolution/rejection note between 10 and 500 characters is required.');
      return;
    }
    applyTicketUpdate(
      { status: pendingTerminalStatus, note: trimmed },
      `Ticket marked ${pendingTerminalStatus}.`,
    );
  };

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!selectedTicket) return;
    const trimmed = replyBody.trim();
    if (!trimmed) return;

    setSendingReply(true);
    setDrawerError('');
    setDrawerSuccess('');
    try {
      const updated = await supportApi.replyAdminTicket(selectedTicket.id, {
        body: trimmed,
        internal: replyInternal,
      });
      setSelectedTicket(updated);
      setReplyBody('');
      setReplyInternal(false);
      setDrawerSuccess(replyInternal ? 'Internal note added.' : 'Public reply sent to user.');
      loadTickets();
    } catch (err) {
      if (err?.code === 'TICKET_CLOSED' || /read-only|ticket_closed/i.test(err?.serverMessage || err?.message || '')) {
        try {
          const fresh = await supportApi.getAdminTicket(selectedTicket.id);
          setSelectedTicket(fresh);
        } catch {}
        setDrawerError('This ticket is closed and read-only.');
        loadTickets();
      } else {
        setDrawerError(err?.serverMessage || err?.message || 'Failed to post reply.');
      }
    } finally {
      setSendingReply(false);
    }
  };

  const handleCloseProjectSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTicket) return;
    const trimmed = closeReason.trim();
    if (trimmed.length < 10 || trimmed.length > 500) {
      setCloseError('Reason must be between 10 and 500 characters.');
      return;
    }

    setClosingProject(true);
    setCloseError('');
    try {
      const res = await supportApi.closeProjectFromTicket(selectedTicket.id, trimmed);
      setSelectedTicket(res.ticket || selectedTicket);
      setCloseProjectModalOpen(false);
      setCloseReason('');
      setDrawerSuccess('Project closed ("Owner inactive"), Phase 9 refunds processed, and ticket resolved.');
      loadTickets();
    } catch (err) {
      if (err?.code === 'TICKET_CLOSED' || /read-only|ticket_closed/i.test(err?.serverMessage || err?.message || '')) {
        try {
          const fresh = await supportApi.getAdminTicket(selectedTicket.id);
          setSelectedTicket(fresh);
        } catch {}
        setCloseProjectModalOpen(false);
        setDrawerError('This ticket is closed and read-only.');
        loadTickets();
      } else {
        setCloseError(err?.serverMessage || err?.message || 'Failed to close project from ticket.');
      }
    } finally {
      setClosingProject(false);
    }
  };

  if (!hasSupportPermission) {
    return (
      <div className="admin-support-page" data-testid="admin-support-denied">
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '12px',
            padding: '24px',
            color: '#991b1b',
          }}
        >
          <h2 style={{ margin: '0 0 8px 0' }}>Access Denied</h2>
          <p style={{ margin: 0 }}>
            You do not have the required &quot;support&quot; permission to access the Admin Support Inbox.
          </p>
        </div>
      </div>
    );
  }

  const isTerminal =
    selectedTicket &&
    (selectedTicket.status === 'resolved' || selectedTicket.status === 'rejected');

  const facts = selectedTicket?.projectFacts;
  const projectClosable =
    selectedTicket?.type === 'project_closure' &&
    facts &&
    !facts.isDeleted &&
    !['closed', 'completed', 'cancelled'].includes(String(facts.projectStatus || '').toLowerCase());

  return (
    <div className="admin-support-page" data-testid="admin-support-page">
      <div className="admin-support-header">
        <div>
          <h1 className="admin-support-title">Support Inbox</h1>
          <p className="admin-support-subtitle">
            Manage help inquiries and abandoned-owner project closure requests in one queue.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-outline"
          onClick={loadTickets}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="admin-support-filters">
        <div style={{ flex: '1 1 220px' }}>
          <SearchBar
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            onClear={() => {
              setSearchQuery('');
              setPage(1);
            }}
            placeholder="Search subject, email, or message..."
          />
        </div>

        <select
          aria-label="Filter by status"
          data-testid="filter-status"
          className="admin-support-select"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="waiting_user">Waiting User</option>
          <option value="resolved">Resolved</option>
          <option value="rejected">Rejected</option>
        </select>

        <select
          aria-label="Filter by type"
          data-testid="filter-type"
          className="admin-support-select"
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">All Types</option>
          <option value="help">Help Inquiries</option>
          <option value="project_closure">Closure Requests</option>
        </select>

        <select
          aria-label="Filter by assignee"
          data-testid="filter-assignee"
          className="admin-support-select"
          value={assigneeFilter}
          onChange={(e) => {
            setAssigneeFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">All Assignees</option>
          <option value="unassigned">Unassigned</option>
          {assignees.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div
          role="alert"
          data-testid="admin-support-error"
          style={{
            marginBottom: '16px',
            padding: '12px 16px',
            borderRadius: '10px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div
          data-testid="admin-support-loading"
          style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}
        >
          Loading support tickets...
        </div>
      ) : tickets.length === 0 ? (
        <EmptyState
          icon="🛟"
          title="No support tickets found"
          message="No tickets match the current filters."
        />
      ) : (
        <>
          <div className="admin-support-table-wrap">
            <table className="admin-support-table" data-testid="admin-support-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Type</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Assignee</th>
                  <th>Age</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id} className="admin-support-row" data-testid={`ticket-row-${t.id}`}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{t.subject}</div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        {t.userName ? `${t.userName} · ` : ''}{t.from}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`support-pill ${
                          t.type === 'project_closure' ? 'support-type-closure' : 'support-type-help'
                        }`}
                      >
                        {t.type === 'project_closure' ? 'Closure Request' : 'Help'}
                      </span>
                    </td>
                    <td>
                      <span className={`support-pill support-priority-${t.priority || 'normal'}`}>
                        {t.priority || 'normal'}
                      </span>
                    </td>
                    <td>
                      <span className={`support-pill support-status-${t.status}`}>
                        {formatStatusLabel(t.status)}
                      </span>
                    </td>
                    <td>{t.assigneeName || <span style={{ color: '#94a3b8' }}>Unassigned</span>}</td>
                    <td style={{ color: '#64748b' }}>{formatRelativeAge(t.createdAt)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-outline"
                        data-testid={`open-ticket-${t.id}`}
                        onClick={() => openTicketDetail(t.id)}
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="admin-support-pagination" data-testid="admin-support-pagination">
            <span>
              Showing {tickets.length} of {total} tickets (Page {page} of {totalPages})
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn btn-outline"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {/* Detail Drawer Modal */}
      <Modal
        isOpen={Boolean(selectedTicket) || detailLoading}
        title={selectedTicket ? `Ticket: ${selectedTicket.subject}` : 'Loading Ticket...'}
        onClose={handleCloseDrawer}
        closeDisabled={updatingMeta || sendingReply}
        size="lg"
        testId="support-detail-drawer"
      >
        {detailLoading && !selectedTicket ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
            Loading ticket detail...
          </div>
        ) : selectedTicket ? (
          <div>
            {drawerError && (
              <div
                role="alert"
                data-testid="drawer-error"
                style={{
                  marginBottom: '12px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  fontSize: '0.88rem',
                }}
              >
                {drawerError}
              </div>
            )}

            {drawerSuccess && (
              <div
                role="status"
                data-testid="drawer-success"
                style={{
                  marginBottom: '12px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  color: '#065f46',
                  fontSize: '0.88rem',
                }}
              >
                {drawerSuccess}
              </div>
            )}

            <div style={{ fontSize: '0.84rem', color: '#64748b', marginBottom: '12px' }}>
              <strong>From:</strong> {selectedTicket.userName || selectedTicket.userId} ({selectedTicket.from}) ·{' '}
              <strong>Created:</strong> {formatDateTime(selectedTicket.createdAt)} ·{' '}
              <strong>Category:</strong> {selectedTicket.category}
              {selectedTicket.parentTicketId && (
                <> · <strong>Follow-up to:</strong> #{selectedTicket.parentTicketId}</>
              )}
            </div>

            {/* Read-Only Banner for Resolved or Rejected Tickets */}
            {isTerminal && (
              <div
                className="admin-support-readonly-banner"
                data-testid="ticket-readonly-banner"
                style={{
                  padding: '14px 16px',
                  borderRadius: '8px',
                  background: selectedTicket.status === 'rejected' ? '#fef2f2' : '#f0fdf4',
                  border: `1px solid ${selectedTicket.status === 'rejected' ? '#fecaca' : '#bbf7d0'}`,
                  color: selectedTicket.status === 'rejected' ? '#991b1b' : '#166534',
                  marginBottom: '14px',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.92rem', marginBottom: '6px' }}>
                  This ticket is {selectedTicket.status}. It can no longer be changed. If the user needs more help they can open a new ticket.
                </div>
                {selectedTicket.resolutionNote && (
                  <div data-testid="ticket-resolution-note" style={{ fontSize: '0.88rem', marginTop: '4px' }}>
                    <strong>Resolution Note:</strong> {selectedTicket.resolutionNote}
                  </div>
                )}
                {selectedTicket.resolvedAt && (
                  <div data-testid="ticket-closed-date" style={{ fontSize: '0.8rem', color: selectedTicket.status === 'rejected' ? '#7f1d1d' : '#15803d', marginTop: '4px' }}>
                    Closed on {formatDateTime(selectedTicket.resolvedAt)}
                  </div>
                )}
              </div>
            )}

            {/* Metadata Controls */}
            {isTerminal ? (
              <div className="admin-support-drawer-grid" data-testid="readonly-metadata-grid">
                <div className="admin-support-control-box" data-testid="read-only-status">
                  <label>Status</label>
                  <div style={{ fontWeight: 600, padding: '8px 0', color: '#0f172a' }}>
                    <span className={`support-pill support-status-${selectedTicket.status}`}>
                      {formatStatusLabel(selectedTicket.status)}
                    </span>
                  </div>
                </div>

                <div className="admin-support-control-box" data-testid="read-only-priority">
                  <label>Priority</label>
                  <div style={{ fontWeight: 600, padding: '8px 0', color: '#0f172a' }}>
                    <span className={`support-pill support-priority-${selectedTicket.priority || 'normal'}`}>
                      {selectedTicket.priority || 'normal'}
                    </span>
                  </div>
                </div>

                <div className="admin-support-control-box" data-testid="read-only-assignee">
                  <label>Assignee</label>
                  <div style={{ fontWeight: 600, padding: '8px 0', color: '#0f172a' }}>
                    {selectedTicket.assigneeName || 'Unassigned'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="admin-support-drawer-grid">
                <div className="admin-support-control-box">
                  <label htmlFor="ticket-status-select">Status</label>
                  <select
                    id="ticket-status-select"
                    data-testid="ticket-status-select"
                    className="admin-support-select"
                    style={{ width: '100%' }}
                    value={pendingTerminalStatus || selectedTicket.status}
                    disabled={updatingMeta}
                    onChange={(e) => handleStatusChange(e.target.value)}
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="waiting_user">Waiting User</option>
                    <option value="resolved">Resolved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                <div className="admin-support-control-box">
                  <label htmlFor="ticket-priority-select">Priority</label>
                  <select
                    id="ticket-priority-select"
                    data-testid="ticket-priority-select"
                    className="admin-support-select"
                    style={{ width: '100%' }}
                    value={selectedTicket.priority || 'normal'}
                    disabled={updatingMeta}
                    onChange={(e) =>
                      applyTicketUpdate({ priority: e.target.value }, `Priority updated to ${e.target.value}.`)
                    }
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div className="admin-support-control-box">
                  <label htmlFor="ticket-assignee-select">Assignee</label>
                  <select
                    id="ticket-assignee-select"
                    data-testid="ticket-assignee-select"
                    className="admin-support-select"
                    style={{ width: '100%' }}
                    value={selectedTicket.assigneeId || ''}
                    disabled={updatingMeta}
                    onChange={(e) =>
                      applyTicketUpdate(
                        { assigneeId: e.target.value || null },
                        e.target.value ? 'Assignee updated.' : 'Ticket unassigned.',
                      )
                    }
                  >
                    <option value="">Unassigned</option>
                    {assignees.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {pendingTerminalStatus && (
              <form
                onSubmit={handleConfirmTerminalStatus}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  marginBottom: '14px',
                }}
              >
                <label
                  htmlFor="terminal-note-input"
                  style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}
                >
                  User-visible note for marking {pendingTerminalStatus} (10–500 chars) *
                </label>
                <textarea
                  id="terminal-note-input"
                  data-testid="terminal-note-input"
                  rows={2}
                  value={terminalNote}
                  onChange={(e) => setTerminalNote(e.target.value)}
                  maxLength={500}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    {terminalNote.trim().length} / 500 characters
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => setPendingTerminalStatus('')}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      data-testid="confirm-status-note-btn"
                      disabled={updatingMeta}
                    >
                      Confirm {formatStatusLabel(pendingTerminalStatus)}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Original Ticket Message */}
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                marginBottom: '14px',
                whiteSpace: 'pre-wrap',
                fontSize: '0.92rem',
              }}
            >
              {selectedTicket.message}
            </div>

            {!isTerminal && selectedTicket.resolutionNote && (
              <div
                data-testid="ticket-resolution-note"
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: selectedTicket.status === 'rejected' ? '#fef2f2' : '#ecfdf5',
                  border: `1px solid ${selectedTicket.status === 'rejected' ? '#fecaca' : '#a7f3d0'}`,
                  marginBottom: '14px',
                  fontSize: '0.88rem',
                }}
              >
                <strong>Resolution Note:</strong> {selectedTicket.resolutionNote}
              </div>
            )}

            {/* Closure Facts Panel */}
            {selectedTicket.type === 'project_closure' && facts && (
              <div className="admin-support-facts-panel" data-testid="closure-facts-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <strong style={{ color: '#92400e', fontSize: '0.95rem' }}>
                    Project Closure Facts — {facts.projectTitle}
                  </strong>
                  <span className="support-pill support-type-closure">
                    Status: {facts.isDeleted ? 'Deleted' : facts.projectStatus}
                  </span>
                </div>

                <div className="admin-support-facts-grid">
                  <div>
                    <div style={{ color: '#78350f', fontWeight: 600 }}>Owner Last Active</div>
                    <div>{facts.ownerLastActiveAt ? formatDateTime(facts.ownerLastActiveAt) : 'Unknown'}</div>
                  </div>
                  <div>
                    <div style={{ color: '#78350f', fontWeight: 600 }}>Members Last Activity</div>
                    <div>{facts.membersLastActiveAt ? formatDateTime(facts.membersLastActiveAt) : 'None recorded'}</div>
                  </div>
                  <div>
                    <div style={{ color: '#78350f', fontWeight: 600 }}>Open Tasks</div>
                    <div>{facts.openTasksCount} (of {facts.totalTasksCount})</div>
                  </div>
                  <div>
                    <div style={{ color: '#78350f', fontWeight: 600 }}>Escrow Held</div>
                    <div>₹{facts.escrowHeldAmount}</div>
                  </div>
                  <div>
                    <div style={{ color: '#78350f', fontWeight: 600 }}>Pending Requests</div>
                    <div>{facts.pendingRequestsCount}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  {!isTerminal && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      data-testid="close-project-from-ticket-btn"
                      style={{ backgroundColor: '#dc2626', borderColor: '#dc2626' }}
                      disabled={!projectClosable}
                      onClick={() => {
                        setCloseReason('');
                        setCloseError('');
                        setCloseProjectModalOpen(true);
                      }}
                    >
                      Close project
                    </button>
                  )}
                  {(!projectClosable || isTerminal) && (
                    <span style={{ fontSize: '0.82rem', color: '#78350f' }}>
                      {isTerminal ? 'Ticket is closed.' : `Project is already ${facts.isDeleted ? 'deleted' : facts.projectStatus.toLowerCase()}.`}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Conversation Thread */}
            <h4 style={{ margin: '12px 0 6px 0', fontSize: '0.9rem', color: '#334155' }}>
              Conversation Thread ({(selectedTicket.replies || []).length})
            </h4>
            <div className="admin-support-thread" data-testid="support-reply-thread">
              {(selectedTicket.replies || []).length === 0 ? (
                <div style={{ color: '#94a3b8', fontSize: '0.85rem', fontStyle: 'italic' }}>
                  No replies yet.
                </div>
              ) : (
                (selectedTicket.replies || []).map((r) => (
                  <div
                    key={r.id}
                    data-testid={r.internal ? `internal-note-${r.id}` : `public-reply-${r.id}`}
                    className={`admin-support-reply-card ${
                      r.internal ? 'internal-note' : r.authorRole === 'admin' ? 'admin-reply' : ''
                    }`}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.8rem' }}>
                      <span>
                        <strong>{r.authorName}</strong>{' '}
                        {r.internal && (
                          <span
                            style={{
                              marginLeft: '6px',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              background: '#fef3c7',
                              color: '#92400e',
                              fontWeight: 700,
                              fontSize: '0.72rem',
                            }}
                          >
                            Internal note (admins only)
                          </span>
                        )}
                      </span>
                      <span style={{ color: '#64748b' }}>{formatDateTime(r.createdAt)}</span>
                    </div>
                    <div style={{ fontSize: '0.88rem', whiteSpace: 'pre-wrap' }}>{r.body}</div>
                  </div>
                ))
              )}
            </div>

            {/* Admin Reply Composer */}
            {!isTerminal && (
              <form onSubmit={handleSendReply}>
                <label
                  htmlFor="admin-reply-input"
                  style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '6px' }}
                >
                  Add Reply
                </label>
                <textarea
                  id="admin-reply-input"
                  data-testid="admin-reply-input"
                  rows={3}
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  maxLength={2000}
                  placeholder="Write a public reply or internal note (1–2000 chars)..."
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      data-testid="admin-reply-internal-toggle"
                      checked={replyInternal}
                      onChange={(e) => setReplyInternal(e.target.checked)}
                    />
                    Internal note (admins only)
                  </label>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    data-testid="send-admin-reply-btn"
                    disabled={sendingReply || !replyBody.trim()}
                  >
                    {sendingReply
                      ? 'Sending...'
                      : replyInternal
                        ? 'Add Internal Note'
                        : 'Send Reply'}
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : null}
      </Modal>

      {/* Close Project Reason Modal */}
      <Modal
        isOpen={closeProjectModalOpen}
        title="Close Project (Owner Inactive)"
        onClose={() => { if (!closingProject) setCloseProjectModalOpen(false); }}
        closeDisabled={closingProject}
        size="sm"
        testId="close-project-modal"
      >
        <form onSubmit={handleCloseProjectSubmit}>
          <p style={{ margin: '0 0 12px 0', fontSize: '0.88rem', color: '#475569' }}>
            Closing this project sets its closure reason to <strong>Owner inactive</strong>, processes Phase 9 escrow refunds, notifies the owner, collaborators, and mentor, and resolves this ticket.
          </p>

          {closeError && (
            <div
              role="alert"
              style={{
                marginBottom: '12px',
                padding: '8px 10px',
                borderRadius: '6px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                fontSize: '0.84rem',
              }}
            >
              {closeError}
            </div>
          )}

          <label
            htmlFor="close-project-reason-input"
            style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '6px' }}
          >
            Resolution / Closure Reason (10–500 chars) *
          </label>
          <textarea
            id="close-project-reason-input"
            data-testid="close-project-reason-input"
            rows={3}
            value={closeReason}
            onChange={(e) => setCloseReason(e.target.value)}
            maxLength={500}
            placeholder="Explain closure confirmation (10–500 chars)..."
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
            {closeReason.trim().length} / 500 characters
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
            <button
              type="button"
              className="btn btn-outline"
              disabled={closingProject}
              onClick={() => setCloseProjectModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              data-testid="confirm-close-project-btn"
              style={{ backgroundColor: '#dc2626', borderColor: '#dc2626' }}
              disabled={closingProject || closeReason.trim().length < 10}
            >
              {closingProject ? 'Closing Project...' : 'Confirm Close Project'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AdminSupport;
