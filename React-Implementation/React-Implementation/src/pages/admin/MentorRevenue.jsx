import { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchMentors } from "../../store/thunks/mentorProfilesThunks";
import { selectAllDirectoryMentors } from "../../store/selectors/mentorProfilesSelectors";
import {
  fetchAllSessionsAdmin,
  fetchSessionAdminStats,
} from "../../store/thunks/mentorSessionsThunks";
import {
  selectAllSessionsAdmin,
  selectAllSessionsAdminStatus,
} from "../../store/selectors/mentorSessionsSelectors";
import { retryPayoutAndRefresh } from "../../store/thunks/paymentsThunks";
import {
  selectAdminRevenueStats,
  selectAdminRevenueStatsStatus,
} from "../../store/selectors/paymentsSelectors";
import { reconcileEscrowLedger } from "../../store/thunks/escrowAccountsThunks";
import {
  selectEscrowReconcileStatus,
  selectEscrowReconciliation,
} from "../../store/selectors/escrowAccountsSelectors";
import StatCard from "../../components/common/StatCard";
import DataTable from "../../components/common/DataTable";
import "./MentorRevenue.css";

const MentorRevenueContent = () => {
  const dispatch = useDispatch();
  const sessions = useSelector(selectAllSessionsAdmin);
  const allSessionsStatus = useSelector(selectAllSessionsAdminStatus);
  const stats = useSelector(selectAdminRevenueStats);
  const statsStatus = useSelector(selectAdminRevenueStatsStatus);
  const mentors = useSelector(selectAllDirectoryMentors);
  const reconciliation = useSelector(selectEscrowReconciliation);
  const reconcileStatus = useSelector(selectEscrowReconcileStatus);

  const isLoading =
    allSessionsStatus === "idle" ||
    allSessionsStatus === "loading" ||
    statsStatus === "loading";
  const reconciling = reconcileStatus === "loading";

  const mentorMap = useMemo(() => {
    const mMap = {};
    (Array.isArray(mentors) ? mentors : []).forEach((m) => {
      if (m?.id) mMap[m.id] = m;
    });
    return mMap;
  }, [mentors]);

  const loadAll = () => {
    dispatch(fetchAllSessionsAdmin({ force: true }));
    dispatch(fetchSessionAdminStats({ force: true }));
    dispatch(fetchMentors({ force: true }));
  };

  useEffect(() => {
    dispatch(fetchAllSessionsAdmin({ force: true }));
    dispatch(fetchSessionAdminStats({ force: true }));
    dispatch(fetchMentors({ force: true }));
  }, [dispatch]);

  const handleReconcile = () => {
    dispatch(reconcileEscrowLedger());
  };

  // All KPI totals read directly from server response stored in paymentsSlice (zero FE arithmetic)
  const kpis = [
    { icon: "🔒", value: `₹${(stats.escrowHeld || 0).toLocaleString()}`, label: "Currently in Escrow" },
    { icon: "💰", value: `₹${(stats.platformRevenue || 0).toLocaleString()}`, label: "Platform Revenue" },
    { icon: "💸", value: `₹${(stats.totalPayouts || 0).toLocaleString()}`, label: "Paid Out to Mentors" },
    { icon: "🟡", value: stats.pendingSessions || 0, label: "Awaiting Mentor Response" },
    { icon: "🟢", value: stats.activeSessions || 0, label: "Active Sessions" },
    { icon: "🔴", value: stats.refundedSessions || 0, label: "Refunded" },
  ];

  const handleRetryPayout = async (sessionId) => {
    try {
      await dispatch(retryPayoutAndRefresh({ sessionId, scope: "admin" })).unwrap();
    } catch (err) {
      alert(err?.message || "Failed to retry payout");
    }
  };

  const renderStatusBadge = (status, sessionId, sess = {}) => {
    const map = {
      escrow_funded: ["🟡 Escrow Funded", "warning"],
      active: ["🟢 Active", "success"],
      completed: ["✅ Completed", "success"],
      refunded: ["🔴 Refunded", "error"],
      cancelled: ["⛔ Cancelled", "error"],
      payout_pending: ["⚠️ Payout Pending", "warning"],
    };
    const [label, cls] = map[status] || [status, "warning"];
    return (
      <div style={{ display: "inline-flex", flexDirection: "column", gap: "2px" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <span className={`admin-audit-type ${cls}`}>{label}</span>
          {status === "payout_pending" && (
            <button
              className="btn btn-xs btn-outline"
              style={{ padding: "2px 6px", fontSize: "11px" }}
              onClick={(e) => {
                e.stopPropagation();
                handleRetryPayout(sessionId);
              }}
            >
              Retry
            </button>
          )}
        </div>
        {status === "refunded" && (
          <div style={{ fontSize: "11px", color: "#b91c1c", marginTop: "2px" }}>
            <span>₹{(sess.totalAmount || 0).toLocaleString()} refunded</span>
            {sess.declineReason && <div style={{ fontSize: "10px", color: "#6b7280" }}>&ldquo;{sess.declineReason}&rdquo;</div>}
          </div>
        )}
        {status === "cancelled" && sess.declineReason && (
          <div style={{ fontSize: "10px", color: "#6b7280", marginTop: "2px" }}>
            {sess.declineReason}
          </div>
        )}
      </div>
    );
  };

  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  const columns = [
    {
      header: 'Session',
      accessor: 'id',
      sortable: true,
      render: (sess) => (
        <span className="text-xs text-muted font-mono">{String(sess.id).slice(-8)}</span>
      ),
    },
    {
      header: 'Mentor',
      accessor: 'mentorId',
      sortable: true,
      render: (sess) => {
        const mentor = mentorMap[sess.mentorId];
        return mentor ? mentor.name : <span className="text-xs text-muted">Mentor</span>;
      },
    },
    {
      header: 'Project',
      accessor: 'projectId',
      render: (sess) => (
        <span className="text-xs text-muted font-mono">{String(sess.projectName || sess.projectId || "—")}</span>
      ),
    },
    {
      header: 'Price',
      accessor: 'agreedPrice',
      sortable: true,
      render: (sess) => (
        <span className="font-semibold">₹{(sess.agreedPrice || 0).toLocaleString()}</span>
      ),
    },
    {
      header: 'Platform Fee (15%)',
      accessor: 'platformFee',
      sortable: true,
      render: (sess) => (
        <span className="text-muted">₹{(sess.platformFee || 0).toLocaleString()}</span>
      ),
    },
    {
      header: 'Gateway Fee (2%)',
      accessor: 'gatewayFee',
      sortable: true,
      render: (sess) => (
        <span className="text-muted">₹{(sess.gatewayFee || 0).toLocaleString()}</span>
      ),
    },
    {
      header: 'Total Paid',
      accessor: 'totalAmount',
      sortable: true,
      render: (sess) => (
        <span className="font-bold text-success">₹{(sess.totalAmount || 0).toLocaleString()}</span>
      ),
    },
    {
      header: 'Mentor Payout',
      accessor: 'payout',
      sortable: true,
      render: (sess) => (
        <span className="font-semibold text-primary">₹{(sess.payout || 0).toLocaleString()}</span>
      ),
    },
    {
      header: 'Status',
      accessor: 'status',
      sortable: true,
      render: (sess) => renderStatusBadge(sess.status, sess.id, sess),
    },
    {
      header: 'Booked',
      accessor: 'createdAt',
      sortable: true,
      render: (sess) => (
        <span className="text-xs text-muted">
          {sess.createdAt ? new Date(sess.createdAt).toLocaleDateString() : '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="admin-page">
      <div className="mentor-revenue-header">
        <div>
          <h1>Mentor Marketplace — Revenue & Escrow</h1>
          <p className="page-subtitle mt-1">
            Funded on booking, held while pending or active, released to the mentor on completion, refunded to the owner on decline.
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {reconciliation && (
            <span
              className={`admin-audit-type ${reconciliation.ok ? 'success' : 'error'}`}
              style={{ fontSize: "12px", padding: "4px 8px" }}
            >
              {reconciliation.ok ? '✓ Escrow Reconciled' : '⚠️ Escrow Mismatch'}
            </span>
          )}
          <button
            className="btn btn-outline btn-sm"
            onClick={handleReconcile}
            disabled={reconciling}
          >
            {reconciling ? 'Checking...' : '⚖️ Reconcile Escrow'}
          </button>
          <button className="btn btn-outline btn-sm" onClick={loadAll}>
            🔄 Refresh
          </button>
        </div>
      </div>

      <div className="admin-dash-grid-top mt-4">
        {kpis.map((kpi, idx) => (
          <StatCard
            key={idx}
            icon={kpi.icon}
            label={kpi.label}
            value={kpi.value}
          />
        ))}
      </div>

      <div className="mt-4">
        <DataTable
          columns={columns}
          data={sortedSessions}
          loading={isLoading}
          loadingMessage="Loading revenue & escrow data..."
          emptyMessage="No mentor bookings yet."
        />
      </div>
    </div>
  );
};

const MentorRevenue = MentorRevenueContent;
export default MentorRevenue;
