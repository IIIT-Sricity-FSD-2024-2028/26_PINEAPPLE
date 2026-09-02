// ══════════════════════════════════════════════════════════════
//   ADMIN — MENTOR MARKETPLACE REVENUE & ESCROW
//   Visible to both Admin and Super User. Reflects live booking state:
//   escrow funded on payment, held while pending/active, released to the
//   mentor on completion, refunded to the owner on decline/cancel.
// ══════════════════════════════════════════════════════════════

const MENTOR_REV_UI_STATE = {
  sessions: [],
  stats: null,
  mentorMap: {},
};

function mrevStatusBadge(status) {
  const map = {
    escrow_funded: ["🟡 Escrow Funded", "warning"],
    active: ["🟢 Active", "success"],
    completed: ["✅ Completed", "success"],
    refunded: ["🔴 Refunded", "error"],
    cancelled: ["⛔ Cancelled", "error"],
  };
  const [label, cls] = map[status] || [status, "warning"];
  return `<span class="admin-audit-type ${cls}">${label}</span>`;
}

async function renderAdminMentorRevenue() {
  const listEl = document.getElementById("admin-mentor-revenue-list");
  const kpiEl = document.getElementById("admin-mentor-revenue-kpis");
  if (!listEl || !kpiEl) return;

  kpiEl.innerHTML = "";
  listEl.innerHTML = '<div class="admin-users-empty">Loading revenue &amp; escrow data...</div>';

  let sessions = [], stats = null, mentors = [];
  try {
    [sessions, stats, mentors] = await Promise.all([
      window.mentorMarketApi ? window.mentorMarketApi.allSessions().catch(() => []) : Promise.resolve([]),
      window.mentorMarketApi ? window.mentorMarketApi.adminStats().catch(() => null) : Promise.resolve(null),
      window.mentorMarketApi ? window.mentorMarketApi.listMentors({}).catch(() => []) : Promise.resolve([]),
    ]);
  } catch (e) {
    console.warn("Could not load mentor revenue data", e);
  }
  if (!Array.isArray(sessions)) sessions = [];
  if (!Array.isArray(mentors)) mentors = [];

  MENTOR_REV_UI_STATE.sessions = sessions;
  MENTOR_REV_UI_STATE.stats = stats;
  MENTOR_REV_UI_STATE.mentorMap = {};
  mentors.forEach((m) => { MENTOR_REV_UI_STATE.mentorMap[m.id] = m; });

  const s = stats || {
    totalSessions: sessions.length, pendingSessions: 0, activeSessions: 0,
    completedSessions: 0, refundedSessions: 0, totalProcessed: 0,
    platformRevenue: 0, totalPayouts: 0, escrowHeld: 0,
  };

  const kpis = [
    ["🔒", `₹${(s.escrowHeld || 0).toLocaleString()}`, "Currently in Escrow"],
    ["💰", `₹${(s.platformRevenue || 0).toLocaleString()}`, "Platform Revenue"],
    ["💸", `₹${(s.totalPayouts || 0).toLocaleString()}`, "Paid Out to Mentors"],
    ["🟡", s.pendingSessions || 0, "Awaiting Mentor Response"],
    ["🟢", s.activeSessions || 0, "Active Sessions"],
    ["🔴", s.refundedSessions || 0, "Refunded"],
  ];

  kpiEl.innerHTML = kpis.map(([icon, value, label]) => `
    <div class="admin-kpi-card">
      <div class="admin-kpi-row"><div class="admin-kpi-icon info">${icon}</div></div>
      <div class="admin-kpi-value">${value}</div>
      <div class="admin-kpi-label">${label}</div>
    </div>
  `).join("");

  if (sessions.length === 0) {
    listEl.innerHTML = '<div class="admin-users-empty">No mentor bookings yet.</div>';
    return;
  }

  const sorted = [...sessions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  listEl.innerHTML = `
    <div style="overflow-x:auto">
      <table class="admin-audit-table">
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
          ${sorted.map((sess) => {
            const mentor = MENTOR_REV_UI_STATE.mentorMap[sess.mentorId];
            return `
              <tr>
                <td class="text-xs text-muted" style="font-family:monospace">${escapeHtml(String(sess.id).slice(-8))}</td>
                <td>${mentor ? escapeHtml(mentor.name) : `<span class="text-xs text-muted">Mentor</span>`}</td>
                <td class="text-xs text-muted" style="font-family:monospace">${escapeHtml(String(sess.projectId || "—").slice(-8))}</td>
                <td class="font-semibold">₹${(sess.agreedPrice || 0).toLocaleString()}</td>
                <td>${mrevStatusBadge(sess.status)}</td>
                <td class="text-xs text-muted">${new Date(sess.createdAt).toLocaleDateString()}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

window.renderAdminMentorRevenue = renderAdminMentorRevenue;
