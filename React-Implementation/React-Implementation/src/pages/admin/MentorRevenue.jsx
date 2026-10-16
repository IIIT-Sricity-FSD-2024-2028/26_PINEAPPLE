import { useState, useEffect } from "react";
import { mentorMarketApi } from "../../services/mentorMarketplaceApi";
import StatCard from "../../components/common/StatCard";
import DataTable from "../../components/common/DataTable";
import "./MentorRevenue.css";

const MentorRevenue = () => {
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState(null);
  const [mentorMap, setMentorMap] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const loadRevenueData = async () => {
      try {
        const [fetchedSessions, fetchedStats, mentors] = await Promise.all([
          mentorMarketApi.allSessions().catch(() => []),
          mentorMarketApi.adminStats().catch(() => null),
          mentorMarketApi.listMentors({}).catch(() => []),
        ]);

        if (isMounted) {
          setSessions(Array.isArray(fetchedSessions) ? fetchedSessions : []);
          setStats(fetchedStats);

          const mMap = {};
          (Array.isArray(mentors) ? mentors : []).forEach((m) => {
            mMap[m.id] = m;
          });
          setMentorMap(mMap);
        }
      } catch (error) {
        console.warn("Could not load mentor revenue data", error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadRevenueData();

    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  const s = stats || {
    totalSessions: sessions.length,
    pendingSessions: 0,
    activeSessions: 0,
    completedSessions: 0,
    refundedSessions: 0,
    totalProcessed: 0,
    platformRevenue: 0,
    totalPayouts: 0,
    escrowHeld: 0,
  };

  const completedSessions = sessions.filter((sess) => sess.status === 'completed');
  const sumCompletedPlatformFee = completedSessions.reduce(
    (sum, sess) => sum + (Number(sess.platformFee) || 0),
    0
  );
  const platformRevenue = s.platformRevenue !== undefined && s.platformRevenue !== 0 ? s.platformRevenue : sumCompletedPlatformFee;

  const kpis = [
    { icon: "🔒", value: `₹${(s.escrowHeld || 0).toLocaleString()}`, label: "Currently in Escrow" },
    { icon: "💰", value: `₹${(platformRevenue || 0).toLocaleString()}`, label: "Platform Revenue" },
    { icon: "💸", value: `₹${(s.totalPayouts || 0).toLocaleString()}`, label: "Paid Out to Mentors" },
    { icon: "🟡", value: s.pendingSessions || 0, label: "Awaiting Mentor Response" },
    { icon: "🟢", value: s.activeSessions || 0, label: "Active Sessions" },
    { icon: "🔴", value: s.refundedSessions || 0, label: "Refunded" },
  ];

  const handleRetryPayout = async (sessionId) => {
    try {
      await mentorMarketApi.retryPayout(sessionId);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      alert(err.message || "Failed to retry payout");
    }
  };

  const renderStatusBadge = (status, sessionId) => {
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
      render: (sess) => renderStatusBadge(sess.status, sess.id),
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
        <button className="btn btn-outline btn-sm" onClick={() => setRefreshKey((k) => k + 1)}>
          🔄 Refresh
        </button>
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

export default MentorRevenue;
