import { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import {
  closeProjectFromSupportTicket,
  fetchAdminSupportTicketById,
  fetchAdminSupportTickets,
  fetchSupportAssignees,
  replyAdminSupportTicket,
  updateAdminSupportTicket,
} from '../../store/thunks/supportTicketsThunks';
import {
  closeAdminTicketDrawer,
  dismissCloseProjectModal,
  openCloseProjectModal,
  setDrawerError as setDrawerErrorAction,
  setPendingTerminalStatus as setPendingTerminalStatusAction,
  setSupportAssigneeFilter,
  setSupportPage,
  setSupportSearchQuery,
  setSupportStatusFilter,
  setSupportTypeFilter,
} from '../../store/slices/supportTicketsSlice';
import {
  selectAdminSupportTickets,
  selectAdminTicketsStatus,
  selectSelectedAdminTicket,
  selectSupportAssignees,
  selectSupportTicketsWorking,
  selectSupportTotal,
  selectSupportTotalPages,
} from '../../store/selectors/supportTicketsSelectors';
import {
  canAccess,
  selectSession,
} from '../../store/selectors/sessionSelectors';
import SearchBar from '../../components/common/SearchBar';
import Modal from '../../components/common/Modal';
import EmptyState from '../../components/common/EmptyState';
import { formatDateTime } from '../../utils/dateFormatter';
import { toText } from '../../utils/toText';
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

const AdminSupportContent = () => {
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();

  const sessionState = useSelector(selectSession);
  const hasSupportPermission = canAccess(sessionState, 'support');

  // Store-backed list & working filters/drawer state (reset on routeChanged)
  const tickets = useSelector(selectAdminSupportTickets);
  const total = useSelector(selectSupportTotal);
  const totalPages = useSelector(selectSupportTotalPages);
  const ticketsStatus = useSelector(selectAdminTicketsStatus);
  const error = useSelector((s) => s?.supportTickets?.adminTicketsError || '');
  const assignees = useSelector(selectSupportAssignees);
  const selectedTicket = useSelector(selectSelectedAdminTicket);
  const working = useSelector(selectSupportTicketsWorking);

  const statusFilter = working.statusFilter || 'all';
  const typeFilter = working.typeFilter || 'all';
  const assigneeFilter = working.assigneeFilter || 'all';
  const searchQuery = working.searchQuery || '';
  const page = working.page || 1;
  const loading = ticketsStatus === 'idle' || ticketsStatus === 'loading';

  const detailLoading = Boolean(working.adminDetailLoading);
  const drawerError = working.drawerError || '';
  const drawerSuccess = working.drawerSuccess || '';
  const updatingMeta = Boolean(working.updatingMeta);
  const pendingTerminalStatus = working.pendingTerminalStatus || '';
  const sendingReply = Boolean(working.sendingReply);
  const closeProjectModalOpen = Boolean(working.closeProjectModalOpen);
  const closingProject = Boolean(working.closingProject);
  const closeError = working.closeError || '';

  const setStatusFilter = (val) => dispatch(setSupportStatusFilter(val));
  const setTypeFilter = (val) => dispatch(setSupportTypeFilter(val));
  const setAssigneeFilter = (val) => dispatch(setSupportAssigneeFilter(val));
  const setSearchQuery = (val) => dispatch(setSupportSearchQuery(val));
  const setPage = (valOrFn) =>
    dispatch(
      setSupportPage(typeof valOrFn === 'function' ? valOrFn(page) : valOrFn),
    );
  const setPendingTerminalStatus = (val) =>
    dispatch(setPendingTerminalStatusAction(val));
  const setCloseProjectModalOpen = (open) =>
    dispatch(open ? openCloseProjectModal() : dismissCloseProjectModal());

  // Local form keystroke states
  const [terminalNote, setTerminalNote] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [replyInternal, setReplyInternal] = useState(false);
  const [closeReason, setCloseReason] = useState('');

  const listParams = {
    status: statusFilter,
    type: typeFilter,
    assignee: assigneeFilter,
    q: searchQuery,
    page,
    limit: 10,
  };

  const loadAssignees = useCallback(() => {
    if (!hasSupportPermission) return Promise.resolve([]);
    return dispatch(fetchSupportAssignees());
  }, [dispatch, hasSupportPermission]);

  const loadTickets = useCallback(() => {
    if (!hasSupportPermission) return Promise.resolve([]);
    return dispatch(
      fetchAdminSupportTickets({
        status: statusFilter,
        type: typeFilter,
        assignee: assigneeFilter,
        q: searchQuery,
        page,
        limit: 10,
      }),
    );
  }, [dispatch, hasSupportPermission, statusFilter, typeFilter, assigneeFilter, searchQuery, page]);

  useEffect(() => {
    if (!hasSupportPermission) return;
    dispatch(fetchSupportAssignees());
  }, [dispatch, hasSupportPermission]);

  useEffect(() => {
    if (!hasSupportPermission) return;
    dispatch(
      fetchAdminSupportTickets({
        status: statusFilter,
        type: typeFilter,
        assignee: assigneeFilter,
        q: searchQuery,
        page,
        limit: 10,
      }),
    );
  }, [dispatch, hasSupportPermission, statusFilter, typeFilter, assigneeFilter, searchQuery, page]);

  const openTicketDetail = useCallback(
    (ticketId) => {
      setTerminalNote('');
      setReplyBody('');
      setReplyInternal(false);
      return dispatch(fetchAdminSupportTicketById(ticketId));
    },
    [dispatch],
  );

  // Support deep linking via ?ticket=id
  const deepLinkedTicketId = searchParams.get('ticket');
  useEffect(() => {
    if (!deepLinkedTicketId || !hasSupportPermission) return;
    dispatch(fetchAdminSupportTicketById(deepLinkedTicketId));
  }, [dispatch, deepLinkedTicketId, hasSupportPermission]);

  const handleCloseDrawer = () => {
    if (updatingMeta || sendingReply) return;
    dispatch(closeAdminTicketDrawer());
    if (searchParams.has('ticket')) {
      searchParams.delete('ticket');
      setSearchParams(searchParams, { replace: true });
    }
  };

  const applyTicketUpdate = async (patchPayload, successMsg = 'Ticket updated.') => {
    void loadAssignees;
    if (!selectedTicket) return;
    try {
      await dispatch(
        updateAdminSupportTicket({
          ticketId: selectedTicket.id,
          payload: patchPayload,
          successMessage: successMsg,
          listParams,
        }),
      ).unwrap();
      setTerminalNote('');
    } catch {
      // Friendly TICKET_CLOSED & error stored in supportTicketsSlice working.drawerError
    }
  };

  const handleStatusChange = (nextStatus) => {
    if (!selectedTicket || nextStatus === selectedTicket.status) return;
    if (nextStatus === 'resolved' || nextStatus === 'rejected') {
      dispatch(setPendingTerminalStatusAction(nextStatus));
      setTerminalNote('');
      return;
    }
    dispatch(setPendingTerminalStatusAction(''));
    applyTicketUpdate({ status: nextStatus }, `Status updated to ${formatStatusLabel(nextStatus)}.`);
  };

  const handleConfirmTerminalStatus = (e) => {
    e.preventDefault();
    const trimmed = terminalNote.trim();
    if (trimmed.length < 10 || trimmed.length > 500) {
      dispatch(
        setDrawerErrorAction(
          'A resolution/rejection note between 10 and 500 characters is required.',
        ),
      );
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

    try {
      await dispatch(
        replyAdminSupportTicket({
          ticketId: selectedTicket.id,
          body: trimmed,
          internal: replyInternal,
          listParams,
        }),
      ).unwrap();
      setReplyBody('');
      setReplyInternal(false);
    } catch {
      // Friendly TICKET_CLOSED or error stored in supportTicketsSlice
    }
  };

  const handleCloseProjectSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTicket) return;
    const trimmed = closeReason.trim();
    if (trimmed.length < 10 || trimmed.length > 500) {
      return;
    }

    try {
      await dispatch(
        closeProjectFromSupportTicket({
          ticketId: selectedTicket.id,
          reason: trimmed,
          listParams,
        }),
      ).unwrap();
      setCloseReason('');
    } catch {
      // Friendly error stored in supportTicketsSlice
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
                      <span className={`support-pill support-status-${toText(t.status, 'open')}`}>
                        {formatStatusLabel(toText(t.status, 'open'))}
                      </span>
                    </td>
                    <td>{t.assigneeName ? toText(t.assigneeName) : <span style={{ color: '#94a3b8' }}>Unassigned</span>}</td>
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
                  This ticket is {toText(selectedTicket.status)}. It can no longer be changed. If the user needs more help they can open a new ticket.
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
                    <span className={`support-pill support-status-${toText(selectedTicket.status, 'open')}`}>
                      {formatStatusLabel(toText(selectedTicket.status, 'open'))}
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

const AdminSupport = AdminSupportContent;
export default AdminSupport;
