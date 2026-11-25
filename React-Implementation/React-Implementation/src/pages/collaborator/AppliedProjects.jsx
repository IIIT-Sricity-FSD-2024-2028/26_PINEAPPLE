import { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import joinRequestsApi from '../../services/joinRequestsApi';
import projectsApi, { isProjectLocked } from '../../services/projectsApi';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import { formatMemberSince } from '../../utils/dateFormatter';
import storage from '../../utils/storage';
import './appliedProjects.css';

const AppliedProjects = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [withdrawTarget, setWithdrawTarget] = useState(null);
  const [withdrawOpenedAt, setWithdrawOpenedAt] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const feedbackTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  const effectiveUserId = user?.id || storage.getBackendUserId() || '';

  useEffect(() => {
    let isMounted = true;
    const loadApplications = async () => {
      try {
        const [requests, allProjects] = await Promise.all([
          joinRequestsApi.getMyRequests().catch(() => joinRequestsApi.list({ userId: effectiveUserId }).catch(() => [])),
          projectsApi.list().catch(() => []),
        ]);

        const projectsMap = new Map();
        if (Array.isArray(allProjects)) {
          allProjects.forEach((p) => projectsMap.set(p.id, p));
        }

        storage.clearLegacyInviteKeys();

        const enriched = (Array.isArray(requests) ? requests : [])
          .filter((req) => req.status !== 'Invited' && req.status !== 'Declined')
          .map((req) => {
            const matchedProject = projectsMap.get(req.projectId) || {};
            const removedRec = Array.isArray(matchedProject.removedUsers)
              ? matchedProject.removedUsers.find(
                  (r) =>
                    String(r.userId) === String(effectiveUserId) ||
                    (user?.name && r.userName && r.userName.toLowerCase() === user.name.toLowerCase())
                )
              : null;
            const status = req.status || (removedRec ? 'Removed' : 'Pending');
            const removalReason = req.removalReason || removedRec?.reason;
            const rejectionReason = req.rejectionReason || (status?.toLowerCase() === 'rejected' ? req.reason : '');
            return {
              id: req.id,
              projectId: req.projectId,
              project: matchedProject.title || matchedProject.name || req.projectName || req.projectTitle || 'Project',
              owner: matchedProject.owner || req.owner || 'Project Owner',
              applied: req.createdAt ? new Date(req.createdAt).toLocaleDateString() : 'Recent',
              dueDate: matchedProject.dueDate || req.projectDueDate,
              status,
              removalReason,
              rejectionReason,
              closureReason: req.closureReason,
              sentAt: req.sentAt || req.createdAt,
              viewedAt: req.viewedAt || null,
              earlyWithdrawEligible: req.earlyWithdrawEligible,
              requestsUsed: req.requestsUsed,
              requestsLeft: req.requestsLeft,
              suggestedProjects: Array.isArray(req.suggestedProjects) ? req.suggestedProjects : [],
              isLocked: isProjectLocked(matchedProject),
            };
          });

        if (Array.isArray(allProjects)) {
          allProjects.forEach((p) => {
            if (Array.isArray(p.removedUsers)) {
              const rec = p.removedUsers.find(
                (r) =>
                  String(r.userId) === String(effectiveUserId) ||
                  (user?.name && r.userName && r.userName.toLowerCase() === user.name.toLowerCase())
              );
              if (rec && !enriched.some((item) => item.projectId === p.id)) {
                enriched.push({
                  id: `removed-${p.id}`,
                  projectId: p.id,
                  project: p.title || p.name || 'Project',
                  owner: p.owner || 'Project Owner',
                  applied: rec.removedAt ? new Date(rec.removedAt).toLocaleDateString() : 'Recent',
                  status: 'Removed',
                  removalReason: rec.reason,
                  isLocked: isProjectLocked(p),
                });
              }
            }
          });
        }

        if (isMounted) {
          setApplications(enriched);
        }
      } catch (err) {
        console.error('Failed to load applied projects:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadApplications();

    return () => {
      isMounted = false;
    };
  }, [effectiveUserId, refreshKey, user?.name]);

  const handleOpenWithdrawDialog = (item) => {
    setWithdrawTarget(item);
    setWithdrawOpenedAt(Date.now());
  };

  const handleDeleteRequest = async (requestId) => {
    const target = applications.find((item) => item.id === requestId);
    if (target?.isLocked) {
      setFeedback({ type: 'error', message: 'Project is locked. Join requests cannot be withdrawn.' });
      setWithdrawTarget(null);
      return;
    }
    setDeletingId(requestId);
    setFeedback(null);
    try {
      const res = await joinRequestsApi.remove(requestId);
      setApplications((prev) => prev.filter((item) => item.id !== requestId));
      setWithdrawTarget(null);
      const slotMsg = res?.slotRestored
        ? ' Your request slot has been restored.'
        : '';
      setFeedback({ type: 'success', message: `Application request withdrawn successfully.${slotMsg}` });
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = setTimeout(() => setFeedback(null), 3500);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      if (err.message && (err.message.toLowerCase().includes('not found') || err.message.includes('404'))) {
        setApplications((prev) => prev.filter((item) => item.id !== requestId));
        setWithdrawTarget(null);
        setFeedback({ type: 'success', message: 'Application request was already removed.' });
        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = setTimeout(() => setFeedback(null), 3500);
      } else {
        console.error('Failed to cancel application request:', err);
        setFeedback({ type: 'error', message: err.message || 'Failed to cancel application request.' });
      }
    } finally {
      setDeletingId(null);
    }
  };

  const columns = [
    {
      header: 'Project',
      accessor: 'project',
      sortable: true,
      render: (item) => <span className="tf-applied-project-name">{item.project}</span>,
    },
    {
      header: 'Owner',
      accessor: 'owner',
      sortable: true,
      render: (item) => <span className="tf-applied-owner">{item.owner}</span>,
    },
    {
      header: 'Applied',
      accessor: 'applied',
      sortable: true,
      render: (item) => <span className="tf-applied-date">{item.applied}</span>,
    },
    {
      header: 'Project Due Date',
      accessor: 'dueDate',
      sortable: true,
      render: (item) => (
        <span className="tf-applied-duedate">
          {item.dueDate ? formatMemberSince(item.dueDate) : '—'}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: 'status',
      sortable: true,
      render: (item) => {
        const rawStatus = (item.status || '').toLowerCase();
        const isPending = rawStatus === 'pending';
        const isRejected = rawStatus === 'rejected';
        const isRemoved = rawStatus === 'removed';
        const isSystemClosed = rawStatus === 'system_closed';
        const isApproved = rawStatus === 'approved';
        const isCompleted = rawStatus === 'completed';
        const isWithdrawn = rawStatus === 'withdrawn';

        const requestsLeft = typeof item.requestsLeft === 'number' ? item.requestsLeft : null;
        const requestsUsed = typeof item.requestsUsed === 'number' ? item.requestsUsed : null;
        const isFinalRejected = isRejected && (requestsLeft === 0 || requestsUsed >= 2);

        return (
          <div className="tf-applied-status-wrap">
            {isPending ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Badge variant="warning">Request pending</Badge>
                {!item.isLocked && (
                  <button
                    type="button"
                    className="tf-applied-btn-sm tf-applied-btn-outline"
                    disabled={deletingId === item.id}
                    onClick={() => handleOpenWithdrawDialog(item)}
                  >
                    {deletingId === item.id ? 'Deleting...' : 'Delete Request'}
                  </button>
                )}
              </div>
            ) : isRejected ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                <Badge variant={isFinalRejected ? 'danger' : 'warning'}>
                  {isFinalRejected ? 'Request rejected' : 'Rejected (1 request left)'}
                </Badge>
                {item.rejectionReason && (
                  <span
                    className="tf-applied-rejection-reason"
                    style={{
                      fontSize: '0.75rem',
                      color: '#b91c1c',
                      fontStyle: 'italic',
                      maxWidth: '260px',
                      lineHeight: '1.25',
                    }}
                    title={item.rejectionReason}
                  >
                    Reason: {item.rejectionReason}
                  </span>
                )}
                {Array.isArray(item.suggestedProjects) && item.suggestedProjects.length > 0 && (
                  <div
                    data-testid={`rejection-suggestions-${item.id}`}
                    style={{
                      marginTop: '6px',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      fontSize: '0.78rem',
                      color: '#334155',
                      width: '100%',
                      maxWidth: '280px',
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: '4px', color: '#0f172a' }}>
                      Similar projects
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {item.suggestedProjects.slice(0, 3).map((sp) => (
                        <div key={sp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {sp.title}
                            {typeof sp.percent === 'number' ? ` (${sp.percent}%)` : ''}
                          </span>
                          <button
                            type="button"
                            data-testid={`suggestion-apply-${sp.id}`}
                            className="tf-applied-btn-sm tf-applied-btn-outline"
                            style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                            onClick={() => navigate(`/projects?apply=${encodeURIComponent(sp.id)}`)}
                          >
                            Apply
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : isRemoved ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                <Badge variant="danger">Removed</Badge>
                {item.removalReason && (
                  <span
                    className="tf-applied-removal-reason"
                    style={{
                      fontSize: '0.75rem',
                      color: '#be123c',
                      fontStyle: 'italic',
                      maxWidth: '240px',
                      lineHeight: '1.2',
                    }}
                    title={item.removalReason}
                  >
                    Reason: {item.removalReason}
                  </span>
                )}
              </div>
            ) : isSystemClosed ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                <Badge variant="secondary">System Closed</Badge>
                <span className="tf-applied-system-closed-reason" style={{ fontSize: '0.75rem', color: '#475569' }}>
                  {item.closureReason &&
                  !String(item.closureReason).toLowerCase().includes('no owner response') &&
                  !String(item.closureReason).toLowerCase().includes('14 days')
                    ? item.closureReason
                    : 'Closed because the owner did not respond'}
                </span>
                {typeof item.requestsLeft === 'number' && (
                  <span className="tf-applied-slot-counter" style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600 }}>
                    {item.requestsLeft}/2 requests left (slot restored)
                  </span>
                )}
              </div>
            ) : isWithdrawn ? (
              <Badge variant="secondary">Withdrawn</Badge>
            ) : isApproved || isCompleted ? (
              <Badge variant="success">{item.status}</Badge>
            ) : (
              <Badge variant={item.status}>{item.status}</Badge>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="tf-applied-container">
      <div className="tf-applied-header">
        <h1 className="tf-applied-title">Applied Projects</h1>
        <p className="tf-applied-subtitle">Track the status of your project applications.</p>
        {feedback && (
          <div className={`tf-applied-feedback ${feedback.type === 'error' ? 'tf-applied-feedback-error' : 'tf-applied-feedback-success'}`}>
            {feedback.message}
          </div>
        )}
      </div>

      <div style={{ marginTop: '20px' }}>
        <DataTable
          columns={columns}
          data={applications}
          loading={loading}
          loadingMessage="Loading application statuses..."
          emptyMessage={
            <EmptyState
              title="No applications found"
              message="Explore the Marketplace to discover and apply for projects!"
              actionLabel="Browse Marketplace"
              onAction={() => navigate('/projects')}
            />
          }
        />
      </div>

      {/* Withdraw Confirmation Dialog */}
      <Modal
        isOpen={Boolean(withdrawTarget)}
        title="Withdraw Join Request"
        onClose={() => {
          if (!deletingId) setWithdrawTarget(null);
        }}
        size="md"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', width: '100%' }}>
            <button
              type="button"
              className="tf-applied-btn-sm tf-applied-btn-outline"
              disabled={Boolean(deletingId)}
              onClick={() => setWithdrawTarget(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="tf-applied-btn-sm"
              data-testid="confirm-withdraw-btn"
              style={{ backgroundColor: '#dc2626', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', fontWeight: 600 }}
              disabled={Boolean(deletingId)}
              onClick={() => withdrawTarget && handleDeleteRequest(withdrawTarget.id)}
            >
              {deletingId ? 'Withdrawing...' : 'Confirm Withdraw'}
            </button>
          </div>
        }
      >
        {withdrawTarget && (() => {
          const sentMs = withdrawTarget.sentAt ? new Date(withdrawTarget.sentAt).getTime() : 0;
          const withinTwoHours = sentMs > 0 && (withdrawOpenedAt - sentMs) <= 2 * 60 * 60 * 1000;
          const notViewed = !withdrawTarget.viewedAt;
          const willRestoreSlot =
            withdrawTarget.earlyWithdrawEligible !== undefined
              ? Boolean(withdrawTarget.earlyWithdrawEligible)
              : withinTwoHours && notViewed;

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ margin: 0, fontSize: '0.92rem', color: '#334155' }}>
                Are you sure you want to withdraw your join request for{' '}
                <strong>{withdrawTarget.project}</strong>?
              </p>
              <div
                data-testid="withdraw-slot-notice"
                style={{
                  padding: '12px 14px',
                  borderRadius: '8px',
                  backgroundColor: willRestoreSlot ? '#ecfdf5' : '#fff7ed',
                  border: `1px solid ${willRestoreSlot ? '#a7f3d0' : '#fed7aa'}`,
                  color: willRestoreSlot ? '#065f46' : '#9a3412',
                  fontSize: '0.875rem',
                  lineHeight: 1.45,
                }}
              >
                {willRestoreSlot ? (
                  <span>
                    ✅ <strong>Your request slot will be returned</strong> (it will not count toward your 2-request limit) because you are withdrawing within 2 hours and the owner has not viewed your request yet.
                  </span>
                ) : (
                  <span>
                    ⚠️ <strong>Your request slot will NOT be returned</strong> — this withdrawal will count toward your 2-request limit because{' '}
                    {!notViewed
                      ? 'the project owner has already viewed your request.'
                      : 'more than 2 hours have elapsed since sending.'}
                  </span>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
};

export default AppliedProjects;
