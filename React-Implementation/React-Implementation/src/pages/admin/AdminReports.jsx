import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toText } from '../../utils/toText';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  actionAdminReport,
  fetchAdminReportDetails,
  fetchAdminReports,
  fetchOwnerPatterns,
  updateAdminReportStatus,
} from '../../store/thunks/reportsThunks';
import {
  closeReportDetail,
  setReportFilter as setReportFilterAction,
  setReportSearch as setReportSearchAction,
} from '../../store/slices/reportsSlice';
import {
  selectAdminReports,
  selectAdminReportsStatus,
  selectOwnerPatterns,
  selectOwnerPatternsStatus,
  selectReportsWorking,
} from '../../store/selectors/reportsSelectors';
import {
  decideAdminAppeal,
  fetchAdminAppeals,
} from '../../store/thunks/appealsThunks';
import {
  closeAppealDecisionModal,
  openAppealDecisionModal,
  setAppealFilter as setAppealFilterAction,
  setAppealSearch as setAppealSearchAction,
} from '../../store/slices/appealsSlice';
import {
  selectAdminAppeals,
  selectAdminAppealsStatus,
  selectAppealsWorking,
} from '../../store/selectors/appealsSelectors';
import {
  canAccess,
  selectSession,
} from '../../store/selectors/sessionSelectors';
import {
  clearNeedsReviewSession,
  decideSessionDispute,
  fetchAdminDisputes,
  fetchNeedsReviewSessions,
} from '../../store/thunks/sessionDisputesThunks';
import {
  selectDisputeForDecision,
  setDisputeFilter as setDisputeFilterAction,
} from '../../store/slices/sessionDisputesSlice';
import {
  selectAllSessionDisputes,
  selectSessionDisputesStatus,
  selectSessionDisputesWorking,
} from '../../store/selectors/sessionDisputesSelectors';
import SearchBar from '../../components/common/SearchBar';
import DataTable from '../../components/common/DataTable';
import FilterTabs from '../../components/common/FilterTabs';
import Modal from '../../components/common/Modal';
import ModerationModal from '../../components/common/ModerationModal';
import './AdminReports.css';

const AdminReportsContent = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const sessionState = useSelector(selectSession);

  const hasReportsPermission = canAccess(sessionState, 'reports');
  const hasAuditPermission = canAccess(sessionState, 'audit');

  // Main UI state
  const [activeTab, setActiveTab] = useState('reports'); // 'reports' | 'appeals'

  // Reports state (backed by reportsSlice)
  const reports = useSelector(selectAdminReports);
  const adminReportsStatus = useSelector(selectAdminReportsStatus);
  const reportsWorking = useSelector(selectReportsWorking);
  const reportsLoading = adminReportsStatus === 'loading';
  const reportFilter = reportsWorking.reportFilter || 'all';
  const reportSearch = reportsWorking.reportSearch || '';
  const selectedReportId = reportsWorking.selectedReportId;
  const reportDetail = reportsWorking.selectedReportDetail;
  const detailLoading = Boolean(reportsWorking.detailLoading);
  const detailError = reportsWorking.detailError || '';
  const updatingStatus = Boolean(reportsWorking.updatingStatus);
  const setReportFilter = (val) => dispatch(setReportFilterAction(val));
  const setReportSearch = (val) => dispatch(setReportSearchAction(val));

  // Status update note (local keystrokes)
  const [statusUpdateNote, setStatusUpdateNote] = useState('');

  // Moderation action on report state (Warn / Suspend)
  const [modModalOpen, setModModalOpen] = useState(false);
  const [modActionType, setModActionType] = useState('warn');

  // Dismiss modal state
  const [dismissModalOpen, setDismissModalOpen] = useState(false);
  const [dismissReason, setDismissReason] = useState('');
  const dismissSubmitting = Boolean(reportsWorking.actionSubmitting);
  const dismissError = reportsWorking.actionError || '';

  // Appeals state (backed by appealsSlice)
  const appeals = useSelector(selectAdminAppeals);
  const adminAppealsStatus = useSelector(selectAdminAppealsStatus);
  const appealsWorking = useSelector(selectAppealsWorking);
  const appealsLoading = adminAppealsStatus === 'loading';
  const appealFilter = appealsWorking.appealFilter || 'all';
  const appealSearch = appealsWorking.appealSearch || '';
  const selectedAppeal = useMemo(
    () =>
      appealsWorking.selectedAppealId
        ? appeals.find(
            (a) => String(a.id) === String(appealsWorking.selectedAppealId),
          ) || null
        : null,
    [appeals, appealsWorking.selectedAppealId],
  );
  const setAppealFilter = (val) => dispatch(setAppealFilterAction(val));
  const setAppealSearch = (val) => dispatch(setAppealSearchAction(val));
  const [appealDecision, setAppealDecision] = useState('accept');
  const [appealDecisionNote, setAppealDecisionNote] = useState('');
  const submittingDecision = Boolean(appealsWorking.deciding);
  const decisionError = appealsWorking.decisionError || '';

  // Phase 17: Escrow disputes state (backed by sessionDisputesSlice)
  const allDisputes = useSelector(selectAllSessionDisputes);
  const disputesStatus = useSelector(selectSessionDisputesStatus);
  const disputesWorking = useSelector(selectSessionDisputesWorking);
  const disputesLoading = disputesStatus === 'loading';
  const disputeFilter = disputesWorking.filter || 'all';
  const disputes = useMemo(() => {
    if (disputeFilter === 'all') return allDisputes;
    return allDisputes.filter(
      (d) => String(d.status || '').toLowerCase() === disputeFilter,
    );
  }, [allDisputes, disputeFilter]);
  const selectedDispute = useMemo(
    () =>
      disputesWorking.selectedDisputeId
        ? allDisputes.find(
            (d) => String(d.id || d.disputeId) === String(disputesWorking.selectedDisputeId),
          ) || null
        : null,
    [allDisputes, disputesWorking.selectedDisputeId],
  );
  const setDisputeFilter = (val) => dispatch(setDisputeFilterAction(val));
  const [disputeDecision, setDisputeDecision] = useState('release_to_mentor');
  const [splitPercent, setSplitPercent] = useState(50);
  const [disputeDecisionReason, setDisputeDecisionReason] = useState('');
  const disputeSubmitting = Boolean(disputesWorking.decisionSubmitting);
  const [localDisputeError, setLocalDisputeError] = useState('');
  const disputeError = localDisputeError || disputesWorking.decisionError || '';

  // Phase 23: Sessions flagged needs_review by snapshot integrity check (unwired BE calls, D8)
  const [needsReviewSessions, setNeedsReviewSessions] = useState([]);
  const [selectedReviewSession, setSelectedReviewSession] = useState(null);
  const [clearReviewReason, setClearReviewReason] = useState('');
  const [clearReviewSubmitting, setClearReviewSubmitting] = useState(false);
  const [clearReviewError, setClearReviewError] = useState('');

  // Phase 17: Owner rejection patterns state (backed by reportsSlice)
  const ownerPatterns = useSelector(selectOwnerPatterns);
  const ownerPatternsStatus = useSelector(selectOwnerPatternsStatus);
  const patternsLoading = ownerPatternsStatus === 'loading';
  const [expandedOwnerId, setExpandedOwnerId] = useState(null);

  // 1. Fetch reports
  const fetchReports = useCallback(() => {
    return dispatch(
      fetchAdminReports({
        status: reportFilter === 'all' ? undefined : reportFilter,
        q: reportSearch.trim() || undefined,
      }),
    );
  }, [dispatch, reportFilter, reportSearch]);

  useEffect(() => {
    if (activeTab === 'reports' && hasReportsPermission) {
      fetchReports();
    }
  }, [activeTab, fetchReports, hasReportsPermission]);

  // 2. Fetch appeals
  const fetchAppeals = useCallback(() => {
    return dispatch(
      fetchAdminAppeals(appealFilter === 'all' ? undefined : appealFilter),
    );
  }, [dispatch, appealFilter]);

  useEffect(() => {
    if (activeTab === 'appeals' && hasReportsPermission) {
      fetchAppeals();
    }
  }, [activeTab, fetchAppeals, hasReportsPermission]);

  const reloadDisputes = useCallback(async () => {
    await dispatch(
      fetchAdminDisputes({
        status: disputeFilter === 'all' ? '' : disputeFilter,
        source: 'admin',
      }),
    );
    const reviewRes = await dispatch(fetchNeedsReviewSessions())
      .unwrap()
      .catch(() => []);
    setNeedsReviewSessions(Array.isArray(reviewRes) ? reviewRes : []);
  }, [dispatch, disputeFilter]);

  useEffect(() => {
    if (activeTab !== 'disputes' || !hasReportsPermission) return;
    let active = true;
    dispatch(
      fetchAdminDisputes({
        status: disputeFilter === 'all' ? '' : disputeFilter,
        source: 'admin',
      }),
    );
    dispatch(fetchNeedsReviewSessions())
      .unwrap()
      .then((reviewRes) => {
        if (active) {
          setNeedsReviewSessions(Array.isArray(reviewRes) ? reviewRes : []);
        }
      })
      .catch(() => {
        if (active) setNeedsReviewSessions([]);
      });
    return () => {
      active = false;
    };
  }, [dispatch, activeTab, disputeFilter, hasReportsPermission]);

  const handleClearSessionReview = async () => {
    if (!selectedReviewSession) return;
    const trimmed = clearReviewReason.trim();
    if (trimmed.length < 10 || trimmed.length > 500) {
      setClearReviewError('Clearance reason must be between 10 and 500 characters.');
      return;
    }
    setClearReviewSubmitting(true);
    setClearReviewError('');
    try {
      await dispatch(
        clearNeedsReviewSession({
          sessionId: selectedReviewSession.id,
          reason: trimmed,
        }),
      ).unwrap();
      setSelectedReviewSession(null);
      setClearReviewReason('');
      await reloadDisputes();
    } catch (err) {
      setClearReviewError(err?.serverMessage || err?.message || 'Failed to clear review flag.');
    } finally {
      setClearReviewSubmitting(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'owner-patterns' || !hasReportsPermission) return;
    dispatch(fetchOwnerPatterns(30));
  }, [activeTab, hasReportsPermission, dispatch]);

  // 3. Open report detail (and reopen via ?open=<reportId> when returning from Audit Log)
  const openReportParam = searchParams.get('open');
  useEffect(() => {
    if (!openReportParam || !hasReportsPermission) return;
    dispatch(fetchAdminReportDetails(openReportParam));
  }, [openReportParam, hasReportsPermission, dispatch]);

  const handleOpenReportDetail = (id) => {
    setStatusUpdateNote('');
    dispatch(fetchAdminReportDetails(id));
  };

  const handleCloseReportDetail = () => {
    dispatch(closeReportDetail());
    if (searchParams.has('open')) {
      const next = new URLSearchParams(searchParams);
      next.delete('open');
      setSearchParams(next, { replace: true });
    }
  };

  // 4. Update report status
  const handleUpdateStatus = async (newStatus) => {
    if (!reportDetail) return;
    try {
      await dispatch(
        updateAdminReportStatus({
          reportId: reportDetail.id,
          status: newStatus,
          note: statusUpdateNote.trim() || undefined,
          filters: {
            status: reportFilter === 'all' ? undefined : reportFilter,
            q: reportSearch.trim() || undefined,
          },
        }),
      ).unwrap();
      setStatusUpdateNote('');
    } catch {
      // Friendly error stored in reportsSlice working.detailError
    }
  };

  // 5. Open Dismiss Modal
  const handleOpenDismissModal = () => {
    setDismissReason('');
    setDismissModalOpen(true);
  };

  const handleSubmitDismiss = async (e) => {
    e.preventDefault();
    if (!reportDetail || dismissReason.trim().length < 10 || dismissReason.length > 500) {
      return;
    }

    try {
      await dispatch(
        actionAdminReport({
          reportId: reportDetail.id,
          action: 'dismiss',
          reason: dismissReason.trim(),
          filters: {
            status: reportFilter === 'all' ? undefined : reportFilter,
            q: reportSearch.trim() || undefined,
          },
        }),
      ).unwrap();
      setDismissModalOpen(false);
    } catch {
      // Friendly error stored in reportsSlice working.actionError & detailError
    }
  };

  // 6. Action: Warn or Suspend via ModerationModal
  const handleOpenModAction = (action) => {
    setModActionType(action);
    setModModalOpen(true);
  };

  const handleModSubmit = async (reason) => {
    if (!reportDetail) return null;
    const out = await dispatch(
      actionAdminReport({
        reportId: reportDetail.id,
        action: modActionType,
        reason,
        filters: {
          status: reportFilter === 'all' ? undefined : reportFilter,
          q: reportSearch.trim() || undefined,
        },
      }),
    ).unwrap();
    return out?.result || out;
  };

  const handleModSuccess = () => {
    setModModalOpen(false);
    handleCloseReportDetail();
  };

  // 7. Decide appeal
  const handleOpenAppealDecision = (appeal) => {
    dispatch(openAppealDecisionModal(appeal?.id));
    setAppealDecision('accept');
    setAppealDecisionNote('');
  };

  const handleCloseAppealDecision = () => {
    dispatch(closeAppealDecisionModal());
    setAppealDecisionNote('');
  };

  const handleSubmitAppealDecision = async (e) => {
    e.preventDefault();
    if (!selectedAppeal || appealDecisionNote.trim().length < 10) return;

    try {
      await dispatch(
        decideAdminAppeal({
          appealId: selectedAppeal.id,
          decision: appealDecision,
          note: appealDecisionNote.trim(),
          warningId: selectedAppeal.warningId,
          userId: selectedAppeal.userId,
          currentFilter: appealFilter === 'all' ? undefined : appealFilter,
        }),
      ).unwrap();
      setAppealDecisionNote('');
    } catch {
      // Friendly error stored in appealsSlice working.decisionError
    }
  };

  if (!hasReportsPermission) {
    return (
      <div className="admin-reports-page">
        <div style={{ padding: '2rem', background: '#fee2e2', borderRadius: '8px', color: '#991b1b' }}>
          <h2>Access Denied</h2>
          <p>You do not have the required "reports" permission to access Reports & Appeals.</p>
        </div>
      </div>
    );
  }

  // Filtered appeals by search
  const filteredAppeals = appeals.filter((a) => {
    if (!appealSearch.trim()) return true;
    const q = appealSearch.toLowerCase();
    return (
      (a.userName && a.userName.toLowerCase().includes(q)) ||
      (a.userUsername && a.userUsername.toLowerCase().includes(q)) ||
      (a.warningReason && a.warningReason.toLowerCase().includes(q)) ||
      (a.explanation && a.explanation.toLowerCase().includes(q))
    );
  });

  return (
    <div className="admin-reports-page">
      {/* Header */}
      <div className="admin-reports-header">
        <div>
          <h1 className="admin-reports-title">Reports & Appeals</h1>
          <p className="admin-reports-subtitle">
            Manage user conduct reports, moderation investigations, and warning appeals.
          </p>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="admin-reports-tabs">
        <button
          className={`admin-reports-tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
          onClick={() => setActiveTab('reports')}
          data-testid="tab-user-reports"
        >
          User Reports
        </button>
        <button
          className={`admin-reports-tab-btn ${activeTab === 'appeals' ? 'active' : ''}`}
          onClick={() => setActiveTab('appeals')}
          data-testid="tab-appeals"
        >
          Warning Appeals
        </button>
        <button
          className={`admin-reports-tab-btn ${activeTab === 'disputes' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('disputes');
          }}
          data-testid="tab-disputes"
        >
          Escrow Disputes
        </button>
        <button
          className={`admin-reports-tab-btn ${activeTab === 'owner-patterns' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('owner-patterns');
          }}
          data-testid="tab-owner-patterns"
        >
          Owner Patterns
        </button>
      </div>

      {/* Tab 1: User Reports */}
      {activeTab === 'reports' && (
        <div>
          <div className="admin-reports-toolbar">
            <SearchBar
              value={reportSearch}
              onChange={(e) => setReportSearch(e.target.value)}
              onClear={() => setReportSearch('')}
              placeholder="Search reports by reason, details, or users..."
            />
            <FilterTabs
              tabs={[
                { id: 'all', label: 'ALL' },
                { id: 'open', label: 'OPEN' },
                { id: 'under review', label: 'UNDER REVIEW' },
                { id: 'resolved', label: 'RESOLVED' },
                { id: 'dismissed', label: 'DISMISSED' },
              ]}
              activeTab={reportFilter}
              onChange={setReportFilter}
              ariaLabel="Report status filter"
            />
          </div>

          <div style={{ marginTop: '1rem' }}>
            <DataTable
              loading={reportsLoading}
              loadingMessage="Loading user reports..."
              emptyMessage="No reports found matching your criteria."
              data={reports}
              columns={[
                {
                  header: 'Reported User',
                  render: (r) => {
                    const name = r.reportedUserName || r.reportedUser?.name || 'User';
                    const uname = r.reportedUserUsername || r.reportedUser?.username || '';
                    const isChat = r.type === 'chat_message';
                    return (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <strong>{name}</strong>
                          {isChat && (
                            <span
                              data-testid={`chat-report-badge-${r.id}`}
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: '999px',
                                background: '#ede9fe',
                                color: '#5b21b6',
                              }}
                            >
                              Chat Message
                            </span>
                          )}
                        </div>
                        {uname && (
                          <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                            @{uname}
                          </div>
                        )}
                        {isChat && (r.projectName || r.projectId) && (
                          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                            Project: {r.projectName || r.projectId}
                          </div>
                        )}
                      </div>
                    );
                  },
                },
                {
                  header: 'Reporter',
                  render: (r) => {
                    const name = r.reporterName || r.reporter?.name || 'Reporter';
                    const uname = r.reporterUsername || r.reporter?.username || '';
                    const isChat = r.type === 'chat_message';
                    return (
                      <div>
                        <span>{name}</span>
                        {uname && (
                          <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                            @{uname}
                          </div>
                        )}
                        {isChat && (r.projectName || r.projectId) && (
                          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                            Project: {r.projectName || r.projectId}
                          </div>
                        )}
                      </div>
                    );
                  },
                },
                {
                  header: 'Reason',
                  accessor: 'reason',
                },
                {
                  header: 'Status',
                  render: (r) => {
                    const statusText = toText(r.status, 'Open');
                    const s = statusText.toLowerCase().replace(/\s+/g, '-');
                    return (
                      <span className={`admin-reports-badge badge-${s}`}>
                        {statusText}
                      </span>
                    );
                  },
                },
                {
                  header: 'Date',
                  render: (r) =>
                    r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—',
                },
                {
                  header: 'Actions',
                  render: (r) => (
                    <button
                      className="admin-reports-action-btn primary"
                      data-testid={`review-report-${r.id}`}
                      onClick={() => handleOpenReportDetail(r.id)}
                    >
                      Review
                    </button>
                  ),
                },
              ]}
            />
          </div>
        </div>
      )}

      {/* Tab 2: Appeals */}
      {activeTab === 'appeals' && (
        <div>
          <div className="admin-reports-toolbar">
            <SearchBar
              value={appealSearch}
              onChange={(e) => setAppealSearch(e.target.value)}
              onClear={() => setAppealSearch('')}
              placeholder="Search appeals by user, reason, or explanation..."
            />
            <FilterTabs
              tabs={[
                { id: 'all', label: 'ALL' },
                { id: 'pending', label: 'PENDING' },
                { id: 'accepted', label: 'ACCEPTED' },
                { id: 'rejected', label: 'REJECTED' },
              ]}
              activeTab={appealFilter}
              onChange={setAppealFilter}
              ariaLabel="Appeal status filter"
            />
          </div>

          <div style={{ marginTop: '1rem' }}>
            <DataTable
              loading={appealsLoading}
              loadingMessage="Loading appeals..."
              emptyMessage="No appeals found matching your criteria."
              data={filteredAppeals}
              columns={[
                {
                  header: 'User',
                  render: (a) => (
                    <div>
                      <strong>{a.userName || 'User'}</strong>
                      {a.userUsername && (
                        <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                          @{a.userUsername}
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  header: 'Warning Reason',
                  accessor: 'warningReason',
                },
                {
                  header: 'Explanation',
                  render: (a) => (
                    <div
                      style={{
                        maxWidth: '260px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={a.explanation}
                    >
                      {a.explanation}
                    </div>
                  ),
                },
                {
                  header: 'Status',
                  render: (a) => {
                    const s = (a.status || '').toLowerCase();
                    return (
                      <span className={`admin-reports-badge badge-${s}`}>
                        {a.status}
                      </span>
                    );
                  },
                },
                {
                  header: 'Date',
                  render: (a) =>
                    a.createdAt ? new Date(a.createdAt).toLocaleDateString() : '—',
                },
                {
                  header: 'Actions',
                  render: (a) => (
                    <button
                      className="admin-reports-action-btn primary"
                      data-testid={`review-appeal-${a.id}`}
                      onClick={() => handleOpenAppealDecision(a)}
                    >
                      {a.status === 'pending' ? 'Decide' : 'View'}
                    </button>
                  ),
                },
              ]}
            />
          </div>
        </div>
      )}

      {/* Tab 3: Escrow Disputes (Phase 17 & Phase 23 Needs Review) */}
      {activeTab === 'disputes' && (
        <div data-testid="admin-disputes-panel">
          {needsReviewSessions.length > 0 && (
            <div
              data-testid="needs-review-sessions-section"
              style={{
                marginBottom: '16px',
                padding: '14px 16px',
                borderRadius: '10px',
                border: '1px solid #f59e0b',
                background: '#fffbeb',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <strong style={{ color: '#92400e', fontSize: '0.95rem' }}>
                  ⚠️ Sessions Flagged Need Review ({needsReviewSessions.length})
                </strong>
                <span style={{ fontSize: '0.78rem', color: '#b45309' }}>
                  Escrow release, refund, and disputes are paused until cleared.
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {needsReviewSessions.map((sess) => (
                  <div
                    key={sess.id}
                    data-testid={`needs-review-row-${sess.id}`}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: '#ffffff',
                      border: '1px solid #fde68a',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                        {sess.projectName || sess.projectId} · Session #{String(sess.id).slice(-8)}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#92400e' }}>
                        {sess.needsReviewReason || 'Missing or mismatched escrow record'}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="admin-reports-action-btn primary"
                      data-testid={`clear-review-btn-${sess.id}`}
                      onClick={() => {
                        setSelectedReviewSession(sess);
                        setClearReviewReason('');
                        setClearReviewError('');
                      }}
                    >
                      Clear flag
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="admin-reports-toolbar">
            <FilterTabs
              tabs={[
                { id: 'all', label: 'ALL' },
                { id: 'open', label: 'OPEN' },
                { id: 'decided', label: 'DECIDED' },
              ]}
              activeTab={disputeFilter}
              onChange={setDisputeFilter}
              ariaLabel="Dispute status filter"
            />
          </div>
          <div className="admin-reports-table-wrap" style={{ marginTop: '12px' }}>
            <DataTable
              loading={disputesLoading}
              loadingMessage="Loading escrow disputes..."
              emptyTitle="No escrow disputes"
              emptyMessage="No disputed mentor sessions match this filter."
              data={disputes}
              columns={[
                {
                  header: 'Project & Session',
                  render: (d) => (
                    <div>
                      <strong>{d.projectTitle || d.projectId}</strong>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        Session #{String(d.sessionId).slice(-8)} · Opened by {d.openedByRole}
                      </div>
                    </div>
                  ),
                },
                {
                  header: 'Parties',
                  render: (d) => (
                    <div style={{ fontSize: '0.84rem' }}>
                      <div>Owner: {d.studentName || d.studentId}</div>
                      <div>Mentor: {d.mentorName || d.mentorUserId}</div>
                    </div>
                  ),
                },
                {
                  header: 'Reason',
                  render: (d) => (
                    <div style={{ maxWidth: '280px', fontSize: '0.84rem' }}>{d.reason}</div>
                  ),
                },
                {
                  header: 'Status / Ruling',
                  render: (d) => (
                    <div>
                      <span className={`admin-reports-badge badge-${d.status === 'open' ? 'open' : 'resolved'}`}>
                        {d.status === 'open' ? 'OPEN (FROZEN)' : `DECIDED: ${d.decision}`}
                      </span>
                      {d.status === 'decided' && (
                        <div style={{ fontSize: '0.76rem', color: '#475569', marginTop: '4px' }}>
                          Mentor ₹{d.mentorAmount || 0} · Fee ₹{d.platformFee || 0} · Refund ₹{d.ownerRefundAmount || 0}
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  header: 'Actions',
                  render: (d) => (
                    <button
                      type="button"
                      className="admin-reports-action-btn primary"
                      data-testid={`decide-dispute-btn-${d.id}`}
                      onClick={() => {
                        dispatch(selectDisputeForDecision(d.id || d.disputeId));
                        setDisputeDecision('release_to_mentor');
                        setSplitPercent(70);
                        setDisputeDecisionReason('');
                        setLocalDisputeError('');
                      }}
                    >
                      {d.status === 'open' ? 'Decide' : 'View'}
                    </button>
                  ),
                },
              ]}
            />
          </div>
        </div>
      )}

      {/* Tab 4: Owner Rejection Patterns (Phase 17) */}
      {activeTab === 'owner-patterns' && (
        <div data-testid="admin-owner-patterns-panel">
          <div className="admin-reports-table-wrap">
            <DataTable
              loading={patternsLoading}
              loadingMessage="Calculating 30-day rejection statistics..."
              emptyTitle="No owner review activity"
              emptyMessage="No join request or task review decisions recorded in the last 30 days."
              data={ownerPatterns}
              columns={[
                {
                  header: 'Project Owner',
                  render: (row) => (
                    <div>
                      <strong>{row.ownerName || row.ownerId}</strong>
                      {row.ownerEmail && <div style={{ fontSize: '0.76rem', color: '#64748b' }}>{row.ownerEmail}</div>}
                    </div>
                  ),
                },
                {
                  header: 'Join Req (Rej / App)',
                  render: (row) => `${row.rejectedJoinRequests} / ${row.approvedJoinRequests}`,
                },
                {
                  header: 'Task Reviews (Rej / App)',
                  render: (row) => `${row.rejectedTaskReviews} / ${row.approvedTaskReviews}`,
                },
                {
                  header: '30d Totals',
                  render: (row) => (
                    <span>
                      <strong>{row.totalRejections}</strong> rej · {row.totalApprovals} app ({row.rejectionRate}%)
                    </span>
                  ),
                },
                {
                  header: 'Pattern Flag',
                  render: (row) =>
                    row.reviewPatternFlag ? (
                      <span
                        data-testid={`review-pattern-badge-${row.ownerId}`}
                        style={{
                          padding: '3px 9px',
                          borderRadius: '999px',
                          background: '#fef3c7',
                          color: '#92400e',
                          fontWeight: 700,
                          fontSize: '0.76rem',
                          border: '1px solid #fde68a',
                        }}
                      >
                        Review Pattern
                      </span>
                    ) : (
                      <span style={{ color: '#64748b', fontSize: '0.82rem' }}>Normal</span>
                    ),
                },
                {
                  header: 'Reasons',
                  render: (row) => (
                    <div>
                      <button
                        type="button"
                        className="admin-reports-action-btn"
                        data-testid={`toggle-reasons-${row.ownerId}`}
                        onClick={() => setExpandedOwnerId(expandedOwnerId === row.ownerId ? null : row.ownerId)}
                      >
                        {expandedOwnerId === row.ownerId ? 'Hide' : `View (${row.reasons?.length || 0})`}
                      </button>
                      {expandedOwnerId === row.ownerId && Array.isArray(row.reasons) && row.reasons.length > 0 && (
                        <ul style={{ marginTop: '6px', paddingLeft: '16px', fontSize: '0.78rem', color: '#334155' }}>
                          {row.reasons.map((r, idx) => (
                            <li key={idx}>
                              <strong>{r.type === 'join_request' ? 'Join Req' : 'Task'}:</strong> {r.reason || '—'}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ),
                },
              ]}
            />
          </div>
        </div>
      )}

      {/* Report Detail Modal */}
      {selectedReportId && (
        <Modal
          isOpen={true}
          title={`Report Review: ${reportDetail?.reason || 'Details'}`}
          onClose={handleCloseReportDetail}
          size="lg"
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', width: '100%' }}>
              <button
                type="button"
                className="admin-reports-action-btn"
                onClick={handleCloseReportDetail}
              >
                Close
              </button>
            </div>
          }
        >
          {detailError && (
            <div
              style={{
                padding: '0.75rem',
                marginBottom: '1rem',
                background: '#fee2e2',
                color: '#991b1b',
                borderRadius: '6px',
                fontSize: '0.88rem',
                border: '1px solid #fecdd3',
              }}
              data-testid="report-error-banner"
            >
              {detailError}
            </div>
          )}
          {detailLoading ? (
            <p style={{ color: '#6b7280' }}>Loading report details...</p>
          ) : reportDetail ? (
            <div>
              {/* Header section with Reported User + Audit link */}
              <div className="admin-reports-detail-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <div className="admin-reports-detail-label">
                      Reported User
                      {reportDetail.type === 'chat_message' && (
                        <span
                          data-testid="detail-chat-report-badge"
                          style={{
                            marginLeft: '8px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '999px',
                            background: '#ede9fe',
                            color: '#5b21b6',
                          }}
                        >
                          Chat Message Report
                        </span>
                      )}
                    </div>
                    <div className="admin-reports-detail-value">
                      <strong>{toText(reportDetail.reportedUserName ?? reportDetail.reportedUser?.name, 'User')}</strong>
                      {(reportDetail.reportedUserUsername || reportDetail.reportedUser?.username) && (
                        <> (@{toText(reportDetail.reportedUserUsername ?? reportDetail.reportedUser?.username, '')})</>
                      )}
                    </div>
                    {(reportDetail.reportedUserUniversity || reportDetail.reportedUser?.university) && (
                      <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                        University: {toText(reportDetail.reportedUserUniversity ?? reportDetail.reportedUser?.university)}
                      </div>
                    )}
                  </div>
                  <div>
                    {hasAuditPermission ? (
                      <button
                        type="button"
                        data-testid="link-view-audit"
                        onClick={() => {
                          const targetUserId =
                            reportDetail.reportedUserId || reportDetail.reportedUser?.id || '';
                          const targetReportId = reportDetail.id || '';
                          const targetUrl = `/admin/audit-log?userId=${encodeURIComponent(
                            targetUserId,
                          )}&reportId=${encodeURIComponent(targetReportId)}&from=report`;
                          handleCloseReportDetail();
                          navigate(targetUrl);
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          background: '#eff6ff',
                          color: '#1d4ed8',
                          borderRadius: '6px',
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          border: '1px solid #bfdbfe',
                          cursor: 'pointer',
                        }}
                      >
                        🔍 View audit log
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled
                        title="You need the audit log permission"
                        data-testid="link-view-audit"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          background: '#f1f5f9',
                          color: '#94a3b8',
                          borderRadius: '6px',
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          border: '1px solid #cbd5e1',
                          cursor: 'not-allowed',
                          opacity: 0.6,
                        }}
                      >
                        🔍 View audit log
                      </button>
                    )}
                  </div>
                </div>

                {/* Prior History */}
                <div style={{ marginTop: '0.75rem', display: 'flex', gap: '1.5rem', fontSize: '0.85rem', color: '#475569' }}>
                  <div>
                    Prior Active Warnings: <strong>{(reportDetail.priorWarnings || reportDetail.earlierWarnings || []).length}</strong>
                  </div>
                  <div>
                    Prior Reports Received: <strong>{(reportDetail.priorReports || reportDetail.earlierReports || []).length}</strong>
                  </div>
                  <div>
                    Status: <strong style={{ textTransform: 'capitalize' }}>{toText(reportDetail.status)}</strong>
                  </div>
                </div>
              </div>

              {/* Reporter Section (Private to admin) */}
              <div className="admin-reports-detail-section">
                <div className="admin-reports-detail-label">Reporter (Confidential)</div>
                <div className="admin-reports-detail-value">
                  {reportDetail.reporterName || reportDetail.reporter?.name || 'Reporter'}
                  {(reportDetail.reporterUsername || reportDetail.reporter?.username) && (
                    <> (@{reportDetail.reporterUsername || reportDetail.reporter?.username})</>
                  )}
                </div>
              </div>

              {/* Chat Message Evidence & 20-Message Conversation Snapshot */}
              {reportDetail.type === 'chat_message' && (
                <div className="admin-reports-detail-section" data-testid="chat-report-evidence">
                  {reportDetail.reportedMessage && (
                    <div style={{ marginBottom: '0.85rem' }}>
                      <div className="admin-reports-detail-label">Reported Chat Message (Preserved Snapshot)</div>
                      <div
                        data-testid="reported-message-box"
                        style={{
                          background: '#fff1f2',
                          border: '1px solid #fecdd3',
                          borderRadius: '8px',
                          padding: '0.75rem',
                          fontSize: '0.88rem',
                        }}
                      >
                        <div style={{ fontWeight: 700, color: '#9f1239', marginBottom: '0.2rem' }}>
                          {reportDetail.reportedMessage.senderName}
                          {(reportDetail.projectName || reportDetail.projectId) ? ` · Project: ${reportDetail.projectName || reportDetail.projectId}` : ''}
                        </div>
                        <div style={{ color: '#1e293b' }}>{reportDetail.reportedMessage.content}</div>
                      </div>
                    </div>
                  )}

                  {Array.isArray(reportDetail.messageSnapshot) && reportDetail.messageSnapshot.length > 0 && (
                    <div>
                      <div className="admin-reports-detail-label">
                        Conversation Context Snapshot ({reportDetail.messageSnapshot.length} messages preserved)
                      </div>
                      <div
                        data-testid="chat-snapshot-list"
                        style={{
                          maxHeight: '220px',
                          overflowY: 'auto',
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          padding: '0.6rem 0.75rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.45rem',
                          fontSize: '0.82rem',
                        }}
                      >
                        {reportDetail.messageSnapshot.map((item) => {
                          const isReported = String(item.id) === String(reportDetail.messageId);
                          return (
                            <div
                              key={item.id}
                              style={{
                                padding: '0.35rem 0.5rem',
                                borderRadius: '6px',
                                background: isReported ? '#fee2e2' : '#ffffff',
                                border: isReported ? '1px solid #fca5a5' : '1px solid #e2e8f0',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', fontSize: '0.76rem' }}>
                                <strong>{item.senderName}</strong>
                                <span>{item.timestamp ? new Date(item.timestamp).toLocaleString() : ''}</span>
                              </div>
                              <div style={{ color: '#0f172a', marginTop: '2px' }}>{item.content}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Report Content */}
              <div className="admin-reports-detail-section">
                <div className="admin-reports-detail-label">Reason</div>
                <div className="admin-reports-detail-value" style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
                  {toText(reportDetail.reason)}
                </div>
                <div className="admin-reports-detail-label">Details / Description</div>
                <div
                  className="admin-reports-detail-value"
                  style={{
                    whiteSpace: 'pre-wrap',
                    background: '#ffffff',
                    padding: '0.75rem',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    lineHeight: 1.5,
                  }}
                >
                  {toText(reportDetail.details)}
                </div>
              </div>

              {/* Status Update / Investigation Note */}
              {(() => {
                const isReportDecided = reportDetail.status === 'Resolved' || reportDetail.status === 'Dismissed';
                return (
                  <>
                    <div className="admin-reports-detail-section">
                      <div className="admin-reports-detail-label">Investigation Note & Status</div>
                      <input
                        type="text"
                        placeholder="Optional note for status update..."
                        value={statusUpdateNote}
                        onChange={(e) => setStatusUpdateNote(e.target.value)}
                        disabled={isReportDecided}
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          borderRadius: '6px',
                          border: '1px solid #d1d5db',
                          fontSize: '0.88rem',
                          boxSizing: 'border-box',
                          marginBottom: '0.5rem',
                        }}
                      />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className="admin-reports-action-btn"
                          disabled={updatingStatus || isReportDecided || reportDetail.status === 'Under review'}
                          onClick={() => handleUpdateStatus('Under review')}
                        >
                          Mark Under Review
                        </button>
                        <button
                          className="admin-reports-action-btn"
                          disabled={updatingStatus || isReportDecided || reportDetail.status === 'Open'}
                          onClick={() => handleUpdateStatus('Open')}
                        >
                          Set to Open
                        </button>
                      </div>
                    </div>

                    {/* Decided Banner */}
                    {isReportDecided && (
                      <div
                        style={{
                          marginTop: '1.25rem',
                          padding: '1rem',
                          background: reportDetail.status === 'Resolved' ? '#f0fdf4' : '#f8fafc',
                          borderRadius: '8px',
                          border: `1px solid ${reportDetail.status === 'Resolved' ? '#bbf7d0' : '#e2e8f0'}`,
                        }}
                        data-testid="report-decided-banner"
                      >
                        <div style={{ fontWeight: 700, color: reportDetail.status === 'Resolved' ? '#166534' : '#334155', fontSize: '0.92rem' }}>
                          Report {reportDetail.status}
                        </div>
                        {reportDetail.updatedAt && (
                          <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.25rem' }}>
                            Decided at: {new Date(reportDetail.updatedAt).toLocaleString()}
                          </div>
                        )}
                        {reportDetail.adminNote && (
                          <div style={{ marginTop: '0.4rem', fontSize: '0.85rem', color: '#334155' }}>
                            <strong>Decision Note:</strong> {reportDetail.adminNote}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Resolution Actions */}
                    <div style={{ marginTop: '1.25rem', padding: '1rem', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fee2e2' }}>
                      <div style={{ fontWeight: 700, color: '#991b1b', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                        Resolve Report Actions
                      </div>
                      <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.82rem', color: '#7f1d1d' }}>
                        {isReportDecided
                          ? `This report was already ${reportDetail.status.toLowerCase()} and cannot be actioned further.`
                          : 'Resolving or dismissing will notify the reporter with an outcome summary.'}
                      </p>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="admin-reports-action-btn warning"
                          data-testid="action-warn-btn"
                          disabled={isReportDecided}
                          onClick={() => handleOpenModAction('warn')}
                        >
                          Issue Warning (-10 Rep)
                        </button>
                        <button
                          type="button"
                          className="admin-reports-action-btn danger"
                          data-testid="action-suspend-btn"
                          disabled={isReportDecided}
                          onClick={() => handleOpenModAction('suspend')}
                        >
                          Suspend User Account
                        </button>
                        <button
                          type="button"
                          className="admin-reports-action-btn"
                          data-testid="action-dismiss-btn"
                          disabled={isReportDecided}
                          style={{
                            background: '#f1f5f9',
                            color: '#334155',
                            borderColor: '#cbd5e1',
                            opacity: isReportDecided ? 0.6 : 1,
                            cursor: isReportDecided ? 'not-allowed' : 'pointer',
                          }}
                          onClick={handleOpenDismissModal}
                        >
                          Dismiss Report
                        </button>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          ) : null}
        </Modal>
      )}

      {/* Moderation Modal for Warn / Suspend from Report */}
      {modModalOpen && reportDetail && (
        <ModerationModal
          isOpen={true}
          actionType={modActionType}
          targetUser={{
            id: reportDetail.reportedUserId,
            name: reportDetail.reportedUserName,
            username: reportDetail.reportedUserUsername,
          }}
          onClose={() => setModModalOpen(false)}
          onSubmit={handleModSubmit}
          onSuccess={handleModSuccess}
        />
      )}

      {/* Dismiss Report Modal */}
      {dismissModalOpen && reportDetail && (
        <Modal
          isOpen={true}
          title="Dismiss Report"
          onClose={() => setDismissModalOpen(false)}
          size="md"
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', width: '100%' }}>
              <button
                type="button"
                className="admin-reports-action-btn"
                onClick={() => setDismissModalOpen(false)}
                disabled={dismissSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-reports-action-btn primary"
                data-testid="confirm-dismiss-btn"
                onClick={handleSubmitDismiss}
                disabled={
                  dismissSubmitting ||
                  dismissReason.trim().length < 10 ||
                  dismissReason.length > 500
                }
              >
                {dismissSubmitting ? 'Dismissing...' : 'Confirm Dismissal'}
              </button>
            </div>
          }
        >
          {dismissError && (
            <div style={{ color: '#dc2626', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
              {dismissError}
            </div>
          )}
          <p style={{ fontSize: '0.88rem', color: '#4b5563', margin: '0 0 0.75rem 0' }}>
            Provide a written explanation for dismissing this report (10 to 500 characters).
          </p>
          <textarea
            data-testid="dismiss-reason-input"
            rows={4}
            value={dismissReason}
            onChange={(e) => setDismissReason(e.target.value)}
            placeholder="Reason for dismissal (e.g., Insufficient evidence, not a platform violation)..."
            style={{
              width: '100%',
              padding: '0.6rem',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              fontSize: '0.9rem',
              boxSizing: 'border-box',
              resize: 'vertical',
            }}
          />
          <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '0.25rem' }}>
            {dismissReason.length} / 500 characters (min. 10)
          </div>
        </Modal>
      )}

      {/* Appeal Decision Modal */}
      {selectedAppeal && (
        <Modal
          isOpen={true}
          title={`Review Appeal: ${selectedAppeal.userName}`}
          onClose={handleCloseAppealDecision}
          size="md"
          footer={
            selectedAppeal.status === 'pending' ? (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', width: '100%' }}>
                <button
                  type="button"
                  className="admin-reports-action-btn"
                  onClick={handleCloseAppealDecision}
                  disabled={submittingDecision}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="admin-reports-action-btn primary"
                  data-testid="submit-appeal-decision-btn"
                  onClick={handleSubmitAppealDecision}
                  disabled={
                    submittingDecision ||
                    appealDecisionNote.trim().length < 10
                  }
                >
                  {submittingDecision ? 'Submitting...' : 'Submit Decision'}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
                <button
                  type="button"
                  className="admin-reports-action-btn"
                  onClick={handleCloseAppealDecision}
                >
                  Close
                </button>
              </div>
            )
          }
        >
          {decisionError && (
            <div style={{ color: '#dc2626', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
              {decisionError}
            </div>
          )}

          <div className="admin-reports-detail-section">
            <div className="admin-reports-detail-label">Original Warning</div>
            <div className="admin-reports-detail-value" style={{ fontWeight: 600 }}>
              {selectedAppeal.warningReason}
            </div>
            {selectedAppeal.warningCreatedAt && (
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
                Issued: {new Date(selectedAppeal.warningCreatedAt).toLocaleString()}
              </div>
            )}
          </div>

          <div className="admin-reports-detail-section">
            <div className="admin-reports-detail-label">User Explanation</div>
            <div
              className="admin-reports-detail-value"
              style={{
                background: '#ffffff',
                padding: '0.75rem',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.5,
              }}
            >
              {selectedAppeal.explanation}
            </div>
          </div>

          {selectedAppeal.status === 'pending' ? (
            <div>
              <div style={{ marginBottom: '1rem' }}>
                <div className="admin-reports-detail-label">Admin Decision *</div>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="appealDecision"
                      value="accept"
                      checked={appealDecision === 'accept'}
                      onChange={() => setAppealDecision('accept')}
                    />
                    <span style={{ color: '#166534', fontWeight: 600 }}>
                      Accept Appeal (+10 Rep, Warning removed)
                    </span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="appealDecision"
                      value="reject"
                      checked={appealDecision === 'reject'}
                      onChange={() => setAppealDecision('reject')}
                    />
                    <span style={{ color: '#991b1b', fontWeight: 600 }}>
                      Reject Appeal (Warning stays)
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <div className="admin-reports-detail-label">Decision Note * (min. 10 chars)</div>
                <textarea
                  data-testid="appeal-decision-note-input"
                  rows={3}
                  value={appealDecisionNote}
                  onChange={(e) => setAppealDecisionNote(e.target.value)}
                  placeholder="Explain why the appeal is accepted or rejected (sent to the user)..."
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                  }}
                />
                <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '0.25rem' }}>
                  {appealDecisionNote.length} characters (min. 10)
                </div>
              </div>
            </div>
          ) : (
            <div className="admin-reports-detail-section" data-testid="appeal-decided-banner">
              <div className="admin-reports-detail-label">Decision Outcome</div>
              <div style={{ fontWeight: 600, color: selectedAppeal.status === 'accepted' ? '#166534' : '#991b1b' }}>
                Status: {selectedAppeal.status === 'accepted' ? 'Accepted' : 'Rejected'}
              </div>
              {selectedAppeal.decidedAt && (
                <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.25rem' }}>
                  Decided at: {new Date(selectedAppeal.decidedAt).toLocaleString()}
                </div>
              )}
              {selectedAppeal.adminNote && (
                <div style={{ marginTop: '0.25rem', fontSize: '0.88rem', color: '#4b5563' }}>
                  <strong>Admin Note:</strong> {selectedAppeal.adminNote}
                </div>
              )}
            </div>
          )}
        </Modal>
      )}

      {/* Escrow Dispute Decision Modal (Phase 17) */}
      {selectedDispute && (
        <Modal
          isOpen={true}
          title={`Escrow Dispute: ${selectedDispute.projectTitle || selectedDispute.projectId}`}
          onClose={() => !disputeSubmitting && dispatch(selectDisputeForDecision(null))}
          closeDisabled={disputeSubmitting}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="admin-reports-action-btn"
                disabled={disputeSubmitting}
                onClick={() => dispatch(selectDisputeForDecision(null))}
              >
                Close
              </button>
              {selectedDispute.status === 'open' && (
                <button
                  type="button"
                  data-testid="confirm-dispute-decision-btn"
                  className="admin-reports-action-btn primary"
                  disabled={disputeSubmitting || disputeDecisionReason.trim().length < 10}
                  onClick={async () => {
                    setLocalDisputeError('');
                    try {
                      await dispatch(
                        decideSessionDispute({
                          disputeId: selectedDispute.id,
                          payload: {
                            decision: disputeDecision,
                            ...(disputeDecision === 'split' ? { mentorPercent: Number(splitPercent) } : {}),
                            reason: disputeDecisionReason.trim(),
                          },
                          source: 'admin',
                        }),
                      ).unwrap();
                      dispatch(selectDisputeForDecision(null));
                      await reloadDisputes();
                    } catch (err) {
                      setLocalDisputeError(err?.serverMessage || err?.message || 'Failed to decide dispute.');
                    }
                  }}
                >
                  {disputeSubmitting ? 'Executing Settlement...' : 'Finalize Decision'}
                </button>
              )}
            </div>
          }
        >
          {(() => {
            const agreedPrice = selectedDispute.session?.agreedPrice || 1000;
            const totalAmount = selectedDispute.session?.totalAmount || Math.round(agreedPrice * 1.17);
            const mentorShare = Math.round(agreedPrice * (Number(splitPercent) / 100));
            const feeOnMentor = Math.round(mentorShare * 0.15);
            const ownerRefundPreview = Math.max(0, totalAmount - mentorShare - feeOnMentor);

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }} data-testid="dispute-decision-modal">
                <div style={{ fontSize: '0.88rem', background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div><strong>Opened by ({selectedDispute.openedByRole}):</strong> {selectedDispute.reason}</div>
                  <div style={{ marginTop: '4px', color: '#475569' }}>
                    Price: ₹{agreedPrice} · Total Funded: ₹{totalAmount}
                  </div>
                </div>

                {selectedDispute.status === 'open' ? (
                  <>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '6px' }}>Select Outcome</div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {[
                          { id: 'release_to_mentor', label: 'Release to Mentor' },
                          { id: 'refund_to_owner', label: 'Refund to Owner' },
                          { id: 'split', label: 'Split Payout' },
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            data-testid={`dispute-opt-${opt.id}`}
                            className={`admin-reports-action-btn ${disputeDecision === opt.id ? 'primary' : ''}`}
                            onClick={() => setDisputeDecision(opt.id)}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {disputeDecision === 'split' && (
                      <div style={{ background: '#eff6ff', padding: '10px 12px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                        <label htmlFor="dispute-split-slider" style={{ display: 'block', fontWeight: 600, marginBottom: '6px' }}>
                          Mentor Percentage: {splitPercent}% (Owner gets remaining balance)
                        </label>
                        <input
                          id="dispute-split-slider"
                          data-testid="dispute-split-slider"
                          type="range"
                          min={0}
                          max={100}
                          value={splitPercent}
                          onChange={(e) => setSplitPercent(Number(e.target.value))}
                          style={{ width: '100%' }}
                        />
                        <div data-testid="split-preview-breakdown" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '6px', fontSize: '0.84rem', color: '#1e3a8a' }}>
                          <span>Mentor Payout: <strong>₹{mentorShare}</strong></span>
                          <span>Platform Fee (15% on mentor): <strong>₹{feeOnMentor}</strong></span>
                          <span>Owner Refund: <strong>₹{ownerRefundPreview}</strong></span>
                        </div>
                      </div>
                    )}

                    <div>
                      <label htmlFor="dispute-decision-reason" style={{ display: 'block', fontWeight: 600, marginBottom: '4px' }}>
                        Written Decision Reason (10 to 500 characters) *
                      </label>
                      <textarea
                        id="dispute-decision-reason"
                        data-testid="dispute-decision-reason-input"
                        rows={3}
                        maxLength={500}
                        value={disputeDecisionReason}
                        onChange={(e) => setDisputeDecisionReason(e.target.value)}
                        placeholder="Explain your binding decision..."
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                      />
                    </div>
                  </>
                ) : (
                  <div style={{ padding: '10px 12px', background: '#ecfdf5', borderRadius: '8px', color: '#065f46', fontSize: '0.88rem' }}>
                    <div><strong>Final Ruling:</strong> {selectedDispute.decision}</div>
                    <div><strong>Reason:</strong> {selectedDispute.decisionReason}</div>
                    <div style={{ marginTop: '4px' }}>
                      Mentor ₹{selectedDispute.mentorAmount || 0} · Platform Fee ₹{selectedDispute.platformFee || 0} · Owner Refund ₹{selectedDispute.ownerRefundAmount || 0}
                    </div>
                  </div>
                )}

                {disputeError && <div style={{ color: '#dc2626', fontSize: '0.85rem' }}>{disputeError}</div>}
              </div>
            );
          })()}
        </Modal>
      )}

      {/* Clear Needs-Review Integrity Flag Modal (Phase 23) */}
      {selectedReviewSession && (
        <Modal
          isOpen={Boolean(selectedReviewSession)}
          onClose={() => !clearReviewSubmitting && setSelectedReviewSession(null)}
          closeDisabled={clearReviewSubmitting}
          title="Clear Needs Review Integrity Flag"
          footer={
            <div className="admin-reports-modal-footer">
              <button
                type="button"
                className="admin-reports-action-btn"
                disabled={clearReviewSubmitting}
                onClick={() => setSelectedReviewSession(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-reports-action-btn primary"
                data-testid="confirm-clear-review-btn"
                disabled={clearReviewSubmitting}
                onClick={handleClearSessionReview}
              >
                {clearReviewSubmitting ? 'Clearing...' : 'Clear Flag & Restore'}
              </button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ padding: '10px 12px', background: '#fffbeb', borderRadius: '8px', fontSize: '0.88rem' }}>
              <div><strong>Session:</strong> {selectedReviewSession.id}</div>
              <div><strong>Project:</strong> {selectedReviewSession.projectName || selectedReviewSession.projectId}</div>
              <div><strong>Integrity Issue:</strong> {selectedReviewSession.needsReviewReason || 'Missing escrow record'}</div>
              <div><strong>Prior Status:</strong> {selectedReviewSession.preReviewStatus || 'escrow_funded'}</div>
            </div>
            <div>
              <label htmlFor="clear-review-reason" style={{ display: 'block', fontWeight: 600, marginBottom: '4px' }}>
                Clearance Reason (10 to 500 characters) *
              </label>
              <textarea
                id="clear-review-reason"
                data-testid="clear-review-reason-input"
                rows={3}
                maxLength={500}
                value={clearReviewReason}
                onChange={(e) => setClearReviewReason(e.target.value)}
                placeholder="Document your verification before unblocking escrow operations..."
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
              />
            </div>
            {clearReviewError && <div style={{ color: '#dc2626', fontSize: '0.85rem' }}>{clearReviewError}</div>}
          </div>
        </Modal>
      )}
    </div>
  );
};

const AdminReports = AdminReportsContent;
export default AdminReports;
