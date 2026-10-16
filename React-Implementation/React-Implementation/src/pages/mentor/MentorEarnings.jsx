import { useState, useEffect } from 'react';
import { mentorMarketApi } from '../../services/mentorMarketplaceApi';
import StatCard from '../../components/common/StatCard';
import DataTable from '../../components/common/DataTable';
import Badge from '../../components/common/Badge';
import './mentorEarnings.css';

const MentorEarnings = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const fetchEarnings = async () => {
      try {
        const data = await mentorMarketApi.mentorSessions();
        if (isMounted) {
          setSessions(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.warn('Failed to load mentor earnings data:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchEarnings();
    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  const handleRetryPayout = async (sessionId) => {
    try {
      await mentorMarketApi.retryPayout(sessionId);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      alert(err.message || 'Failed to retry payout');
    }
  };

  // Calculate metrics
  const completedSessions = sessions.filter((s) => s.status === 'completed');
  const activeSessions = sessions.filter((s) => s.status === 'active' || s.status === 'payout_pending');
  const pendingRequests = sessions.filter((s) => s.status === 'escrow_funded');

  const totalEarned = completedSessions.reduce((sum, s) => sum + (s.payout || s.agreedPrice || 0), 0);
  const pendingInEscrow = activeSessions.reduce((sum, s) => sum + (s.payout || s.agreedPrice || 0), 0);

  const renderStatusBadge = (status, sessionId) => {
    const map = {
      escrow_funded: ['Awaiting Response', 'warning'],
      active: ['Active', 'success'],
      completed: ['Completed', 'completed'],
      refunded: ['Refunded', 'danger'],
      cancelled: ['Cancelled', 'danger'],
      payout_pending: ['Payout Pending', 'warning'],
    };
    const [label, variant] = map[status] || [status, 'info'];

    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <Badge variant={variant}>{label}</Badge>
        {status === 'payout_pending' && (
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
      render: (s) => renderStatusBadge(s.status, s.id),
    },
    {
      key: 'date',
      header: 'Date',
      render: (s) => (s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '—'),
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
        <button className="btn btn-outline btn-sm" onClick={() => setRefreshKey((k) => k + 1)}>
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
          value={pendingRequests.length}
          subtext="New booking requests"
        />
        <StatCard
          icon="✅"
          label="Sessions Completed"
          value={completedSessions.length}
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
    </div>
  );
};

export default MentorEarnings;
