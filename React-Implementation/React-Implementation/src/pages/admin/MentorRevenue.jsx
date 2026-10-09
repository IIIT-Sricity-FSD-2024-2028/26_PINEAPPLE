import React, { useState, useEffect } from "react";
import { mentorMarketApi } from "../../services/mentorMarketplaceApi";
import "./MentorRevenue.css";

const MentorRevenue = () => {
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState(null);
  const [mentorMap, setMentorMap] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchRevenueData = async () => {
    setIsLoading(true);
    try {
      const [fetchedSessions, fetchedStats, mentors] = await Promise.all([
        mentorMarketApi.allSessions().catch(() => []),
        mentorMarketApi.adminStats().catch(() => null),
        mentorMarketApi.listMentors({}).catch(() => []),
      ]);

      setSessions(Array.isArray(fetchedSessions) ? fetchedSessions : []);
      setStats(fetchedStats);

      const mMap = {};
      (Array.isArray(mentors) ? mentors : []).forEach((m) => {
        mMap[m.id] = m;
      });
      setMentorMap(mMap);
    } catch (error) {
      console.warn("Could not load mentor revenue data", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRevenueData();
  }, []);

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

  const kpis = [
    { icon: "🔒", value: `₹${(s.escrowHeld || 0).toLocaleString()}`, label: "Currently in Escrow" },
    { icon: "💰", value: `₹${(s.platformRevenue || 0).toLocaleString()}`, label: "Platform Revenue" },
    { icon: "💸", value: `₹${(s.totalPayouts || 0).toLocaleString()}`, label: "Paid Out to Mentors" },
    { icon: "🟡", value: s.pendingSessions || 0, label: "Awaiting Mentor Response" },
    { icon: "🟢", value: s.activeSessions || 0, label: "Active Sessions" },
    { icon: "🔴", value: s.refundedSessions || 0, label: "Refunded" },
  ];

  const renderStatusBadge = (status) => {
    const map = {
      escrow_funded: ["🟡 Escrow Funded", "warning"],
      active: ["🟢 Active", "success"],
      completed: ["✅ Completed", "success"],
      refunded: ["🔴 Refunded", "error"],
      cancelled: ["⛔ Cancelled", "error"],
    };
    const [label, cls] = map[status] || [status, "warning"];
    return <span className={`admin-audit-type ${cls}`}>{label}</span>;
  };

  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  return (
    <div className="admin-page">
      <div className="mentor-revenue-header">
        <div>
          <h1>Mentor Marketplace — Revenue & Escrow</h1>
          <p className="page-subtitle mt-1">
            Funded on booking, held while pending or active, released to the mentor on completion, refunded to the owner on decline.
          </p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={fetchRevenueData}>
          🔄 Refresh
        </button>
      </div>

      <div className="admin-dash-grid-top mt-4">
        {kpis.map((kpi, idx) => (
          <div className="admin-kpi-card" key={idx}>
            <div className="admin-kpi-row">
              <div className="admin-kpi-icon info">{kpi.icon}</div>
            </div>
            <div className="admin-kpi-value">{kpi.value}</div>
            <div className="admin-kpi-label">{kpi.label}</div>
          </div>
        ))}
      </div>

      <div className="card mt-4 overflow-hidden p-0">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="admin-users-empty">Loading revenue & escrow data...</div>
          ) : sessions.length === 0 ? (
            <div className="admin-users-empty">No mentor bookings yet.</div>
          ) : (
            <table className="admin-audit-table">
              <thead>
                <tr>
                  <th>Session</th>
                  <th>Mentor</th>
                  <th>Project</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>Booked</th>
                </tr>
              </thead>
              <tbody>
                {sortedSessions.map((sess) => {
                  const mentor = mentorMap[sess.mentorId];
                  return (
                    <tr key={sess.id}>
                      <td className="text-xs text-muted font-mono">
                        {String(sess.id).slice(-8)}
                      </td>
                      <td>
                        {mentor ? (
                          mentor.name
                        ) : (
                          <span className="text-xs text-muted">Mentor</span>
                        )}
                      </td>
                      <td className="text-xs text-muted font-mono">
                        {String(sess.projectId || "—").slice(-8)}
                      </td>
                      <td className="font-semibold">
                        ₹{(sess.agreedPrice || 0).toLocaleString()}
                      </td>
                      <td>{renderStatusBadge(sess.status)}</td>
                      <td className="text-xs text-muted">
                        {new Date(sess.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default MentorRevenue;
