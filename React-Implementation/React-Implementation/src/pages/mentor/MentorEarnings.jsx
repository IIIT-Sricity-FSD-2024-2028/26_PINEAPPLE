import { useMemo, useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchMentorSessions } from '../../store/thunks/mentorSessionsThunks';
import {
  selectMentorViewSessions,
  selectMentorViewSessionsStatus,
} from '../../store/selectors/mentorSessionsSelectors';
import { retryPayoutAndRefresh } from '../../store/thunks/paymentsThunks';
import { selectMentorEarningsTotals } from '../../store/selectors/paymentsSelectors';
import { openSessionDispute } from '../../store/thunks/sessionDisputesThunks';
import {
  closeDisputeModal,
  openDisputeModal,
} from '../../store/slices/sessionDisputesSlice';
import { selectSessionDisputesWorking } from '../../store/selectors/sessionDisputesSelectors';
import StatCard from '../../components/common/StatCard';
import DataTable from '../../components/common/DataTable';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import './mentorEarnings.css';

const MentorEarningsContent = () => {
  const dispatch = useDispatch();
  const sessions = useSelector(selectMentorViewSessions);
  const sessionsStatus = useSelector(selectMentorViewSessionsStatus);
  const earningsTotals = useSelector(selectMentorEarningsTotals);
  const disputesWorking = useSelector(selectSessionDisputesWorking);
  const loading = sessionsStatus === 'idle' || sessionsStatus === 'loading';

  const disputeSession = useMemo(
    () =>
      sessions.find(
        (s) => String(s.id) === String(disputesWorking.targetSessionId),
      ) || null,
    [sessions, disputesWorking.targetSessionId],
  );
  const [disputeReason, setDisputeReason] = useState('');
  const disputeError = disputesWorking.modalError || '';
  const disputeSubmitting = Boolean(disputesWorking.submitting);

  useEffect(() => {
    dispatch(fetchMentorSessions({ force: true }));
  }, [dispatch]);

  const handleRetryPayout = async (sessionId) => {
    try {
      await dispatch(retryPayoutAndRefresh({ sessionId, scope: 'mentor' })).unwrap();
    } catch (err) {
      alert(err?.message || 'Failed to retry payout');
    }
  };

  // Non-money session counts + server-returned earnings totals from paymentsSlice (no FE money arithmetic)
  const completedSessions = sessions.filter((s) => s.status === 'completed');
  const pendingRequests = sessions.filter((s) => s.status === 'escrow_funded');

  const totalEarned = Number(earningsTotals?.totalEarned || 0);
  const pendingInEscrow = Number(earningsTotals?.pendingInEscrow || 0);

  const renderStatusBadge = (status, sessionId, sess = {}) => {
    const map = {
      escrow_funded: ['Awaiting Response', 'warning'],
      active: ['Active', 'success'],
      completed: ['Completed', 'completed'],
      refunded: ['Refunded', 'danger'],
      cancelled: ['Cancelled', 'danger'],
      payout_pending: ['Payout Pending', 'warning'],
      disputed: ['Disputed (Frozen)', 'danger'],
      split: ['Split Settled', 'info'],
    };
    const [label, variant] = map[status] || [status, 'info'];

    return (
      <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '2px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <Badge variant={variant}>{label}</Badge>
          {status === 'payout_pending' && !sess.disputed && (
            <button
              className="btn btn-xs btn-outline"
              style={{ padding: '2px 6px', fontSize: '11px' }}
              onClick={(e) => {
                e.stopPropagation();
                handleRetryPayout(sessionId);
              }}
            >
              Retry
            </button>
          )}
        </div>
        {(status === 'disputed' || sess.disputed) && (
          <div style={{ fontSize: '11px', color: '#b91c1c', fontWeight: 600 }}>
            Payout frozen pending admin dispute ruling
          </div>
        )}
        {sess.dispute?.status === 'decided' && (
          <div style={{ fontSize: '11px', color: '#334155' }}>
            {sess.dispute.decision}: {sess.dispute.decisionReason}
          </div>
        )}
        {(status === 'refunded' || status === 'cancelled') && sess.declineReason && (
          <div style={{ fontSize: '11px', color: '#b91c1c' }}>
            &ldquo;{sess.declineReason}&rdquo;
          </div>
        )}
      </div>
    );
  };

  const columns = [
    {
      key: 'project',
      header: 'Project',
      render: (s) => <strong>{s.projectName || (s.projectId ? `Project #${String(s.projectId).slice(-6)}` : '—')}</strong>,
    },
    {
      key: 'owner',
      header: 'Owner',
      render: (s) => s.ownerName || s.studentId || 'Owner',
    },
    {
      key: 'price',
      header: 'Price',
      render: (s) => <span>₹{(s.agreedPrice || 0).toLocaleString()}</span>,
    },
    {
      key: 'platformFee',
      header: 'Platform Fee (15%)',
      render: (s) => <span className="text-muted">₹{(s.platformFee || 0).toLocaleString()}</span>,
    },
    {
      key: 'gatewayFee',
      header: 'Gateway Fee (2%)',
      render: (s) => <span className="text-muted">₹{(s.gatewayFee || 0).toLocaleString()}</span>,
    },
    {
      key: 'totalPaid',
      header: 'Total Paid',
      render: (s) => <span className="font-bold">₹{(s.totalAmount || 0).toLocaleString()}</span>,
    },
    {
      key: 'payout',
      header: 'Mentor Payout',
      render: (s) => (
        <span className="font-semibold text-success">
          {s.status === 'completed'
            ? `₹${(s.payout || s.agreedPrice || 0).toLocaleString()}`
            : s.status === 'refunded' || s.status === 'cancelled'
            ? '—'
            : `₹${(s.payout || s.agreedPrice || 0).toLocaleString()} (held)`}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (s) => renderStatusBadge(s.status, s.id, s),
    },
    {
      key: 'date',
      header: 'Date',
      render: (s) => (s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '—'),
    },
    {
      key: 'disputeAction',
      header: 'Actions',
      render: (s) =>
        ['escrow_funded', 'active', 'payout_pending'].includes(s.status) && !s.disputed ? (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            style={{ color: '#b91c1c', borderColor: '#fecaca', padding: '4px 10px', fontSize: '0.78rem' }}
            onClick={() => {
              dispatch(openDisputeModal(s.id));
              setDisputeReason('');
            }}
          >
            Open Dispute
          </button>
        ) : (
          null
        ),
    },
  ];

  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  );

  return (
    <div className="mentor-earnings-page">
      <div className="mentor-earnings-header">
        <div>
          <h1>Mentor Earnings & Escrow</h1>
          <p className="subtitle">Track your completed sessions, released payouts, and funds pending in escrow.</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => dispatch(fetchMentorSessions({ force: true }))}>
          🔄 Refresh
        </button>
      </div>

      <div className="mentor-earnings-stats-grid mt-4">
        <StatCard
          icon="💰"
          label="Total Earned"
          value={`₹${totalEarned.toLocaleString()}`}
          subtext="Released to your account"
        />
        <StatCard
          icon="🔒"
          label="Pending in Escrow"
          value={`₹${pendingInEscrow.toLocaleString()}`}
          subtext="Active session funds"
        />
        <StatCard
          icon="🟡"
          label="Awaiting Your Response"
          value={earningsTotals?.awaitingResponseCount ?? pendingRequests.length}
          subtext="New booking requests"
        />
        <StatCard
          icon="✅"
          label="Sessions Completed"
          value={earningsTotals?.completedCount ?? completedSessions.length}
          subtext="Successfully finished"
        />
      </div>

      <div className="card glass-card mt-5 mentor-earnings-table-card">
        <h2>My Mentoring Sessions</h2>
        <div className="mt-3">
          <DataTable
            columns={columns}
            data={sortedSessions}
            loading={loading}
            loadingMessage="Loading mentor sessions..."
            emptyTitle="No mentoring sessions yet"
            emptyMessage="When project owners book you as a mentor, your sessions and earnings will appear here."
          />
        </div>
      </div>

      <Modal
        isOpen={Boolean(disputeSession)}
        title="Open Escrow Dispute"
        onClose={() => !disputeSubmitting && dispatch(closeDisputeModal())}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-outline"
              disabled={disputeSubmitting}
              onClick={() => dispatch(closeDisputeModal())}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={disputeSubmitting || disputeReason.trim().length < 10}
              onClick={async () => {
                if (!disputeSession || disputeSubmitting) return;
                try {
                  await dispatch(
                    openSessionDispute({
                      sessionId: disputeSession.id,
                      reason: disputeReason.trim(),
                    }),
                  ).unwrap();
                  dispatch(fetchMentorSessions({ force: true }));
                } catch {
                  // Error stored in sessionDisputes.working.modalError
                }
              }}
            >
              {disputeSubmitting ? 'Submitting...' : 'Freeze Payout & Open Dispute'}
            </button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <p style={{ margin: 0, fontSize: '0.88rem', color: '#475569' }}>
            Provide a reason (10 to 1000 characters). Payout and refund will remain frozen until an administrator reviews the session.
          </p>
          <textarea
            rows={4}
            maxLength={1000}
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
            placeholder="Describe the dispute reason..."
            style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
          />
          {disputeError && <div style={{ color: '#dc2626', fontSize: '0.85rem' }}>⚠️ {disputeError}</div>}
        </div>
      </Modal>
    </div>
  );
};

const MentorEarnings = MentorEarningsContent;
export default MentorEarnings;
