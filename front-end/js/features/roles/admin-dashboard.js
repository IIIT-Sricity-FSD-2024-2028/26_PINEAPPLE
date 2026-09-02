// ══════════════════════════════════════════════════════════════
//  admin-dashboard.js — Dynamic Platform Overview dashboard
//
//  KPI counts and Recent Events now use the SAME source as the
//  Audit Log page: ADMIN_SERVER_LOGS (live backend HTTP logs).
//  If logs haven't been fetched yet, we trigger fetchServerLogs()
//  and re-render once the data arrives.
// ══════════════════════════════════════════════════════════════

async function renderAdminDashboard() {
  const dashEl = document.getElementById("admin-dash");
  if (!dashEl) return;

  // ── 1. Collect live user data ──────────────────────────────
  const allUsers       = (typeof getAllAdminUsers === "function") ? getAllAdminUsers() : [];
  const totalUsers     = allUsers.length;
  const activeUsers    = allUsers.filter(u => u.status === "active" && !u.flagged).length;
  const warnedUsers    = allUsers.filter(u => u.status === "warned" || u.flagged).length;
  const suspendedUsers = allUsers.filter(u => u.status === "suspended").length;
  const flaggedCount   = allUsers.filter(u => u.flagged || u.status === "warned").length;

  // ── 2. Mentor applications ────────────────────────────────
  const mentorApps        = Array.isArray(STATE && STATE.mentorApplications) ? STATE.mentorApplications : [];
  const pendingMentorApps = mentorApps.filter(a => a.status === "pending").length;

  // ── 3. Audit log — SAME source as the Audit Log page ──────
  //  ADMIN_SERVER_LOGS is defined in admin-audit.js.
  //  If it hasn't been loaded yet, fetch it first then re-render.
  if (typeof ADMIN_SERVER_LOGS === "undefined" || ADMIN_SERVER_LOGS.length === 0) {
    if (typeof fetchServerLogs === "function") {
      await fetchServerLogs();
    }
  }
  const serverLogs  = (typeof ADMIN_SERVER_LOGS !== "undefined") ? ADMIN_SERVER_LOGS : [];
  const auditCount  = serverLogs.length;
  const recentEvents = serverLogs.slice(0, 5);

  // ── 4. KPI cards ──────────────────────────────────────────
  const kpiGrid = dashEl.querySelector(".admin-dash-grid-top");
  if (kpiGrid) {
    kpiGrid.innerHTML = `
      <div class="admin-kpi-card">
        <div class="admin-kpi-row">
          <div class="admin-kpi-icon info">👥</div>
          <span class="admin-kpi-meta">${activeUsers} active</span>
        </div>
        <div class="admin-kpi-value">${totalUsers}</div>
        <div class="admin-kpi-label">Total Users</div>
      </div>

      <div class="admin-kpi-card">
        <div class="admin-kpi-row">
          <div class="admin-kpi-icon">📖</div>
          <span class="admin-kpi-meta">${pendingMentorApps > 0 ? "Awaiting review" : "None pending"}</span>
        </div>
        <div class="admin-kpi-value">${pendingMentorApps}</div>
        <div class="admin-kpi-label">Pending Mentor Apps</div>
      </div>

      <div class="admin-kpi-card">
        <div class="admin-kpi-row">
          <div class="admin-kpi-icon">⚠️</div>
          <span class="admin-kpi-meta">${suspendedUsers} suspended</span>
        </div>
        <div class="admin-kpi-value">${flaggedCount}</div>
        <div class="admin-kpi-label">Flagged / Warned</div>
      </div>

      <div class="admin-kpi-card">
        <div class="admin-kpi-row">
          <div class="admin-kpi-icon">📜</div>
        </div>
        <div class="admin-kpi-value">${auditCount}</div>
        <div class="admin-kpi-label">Audit Events</div>
      </div>
    `;
  }

  // ── 5. Action cards ───────────────────────────────────────
  const actionsGrid = dashEl.querySelector(".admin-dash-grid-actions");
  if (actionsGrid) {
    actionsGrid.innerHTML = `
      <button class="admin-action-card" onclick="showAdminPage('admin-mentor-apps')">
        <div class="admin-action-left">
          <div class="admin-action-icon">📖</div>
          <div>
            <div class="admin-action-title">Review Mentor Applications</div>
            <div class="admin-action-sub">${pendingMentorApps} pending</div>
          </div>
        </div>
        <div class="admin-action-count">${pendingMentorApps}</div>
      </button>

      <button class="admin-action-card" onclick="showAdminPage('admin-users')">
        <div class="admin-action-left">
          <div class="admin-action-icon">🛡️</div>
          <div>
            <div class="admin-action-title">Manage Flagged Users</div>
            <div class="admin-action-sub">${flaggedCount} flagged</div>
          </div>
        </div>
        <div class="admin-action-count">${flaggedCount}</div>
      </button>

      <button class="admin-action-card" onclick="showAdminPage('admin-audit')">
        <div class="admin-action-left">
          <div class="admin-action-icon">📜</div>
          <div>
            <div class="admin-action-title">View Full Audit Log</div>
            <div class="admin-action-sub">${auditCount} entries</div>
          </div>
        </div>
        <div class="admin-action-count">${auditCount}</div>
      </button>
    `;
  }

  // ── 6. User Health bars ───────────────────────────────────
  const healthPanel = dashEl.querySelector(".admin-panel:first-child");
  if (healthPanel) {
    const total        = totalUsers || 1;
    const activePct    = Math.round((activeUsers    / total) * 100);
    const warnedPct    = Math.round((warnedUsers    / total) * 100);
    const suspendedPct = Math.round((suspendedUsers / total) * 100);

    healthPanel.innerHTML = `
      <div class="admin-panel-title">↗ User Health</div>

      <div class="admin-health-item">
        <div class="admin-health-head"><span>Active</span><span>${activeUsers} / ${totalUsers}</span></div>
        <div class="admin-health-track"><div class="admin-health-fill success" style="width:${activePct}%"></div></div>
      </div>

      <div class="admin-health-item">
        <div class="admin-health-head"><span>Warned</span><span>${warnedUsers} / ${totalUsers}</span></div>
        <div class="admin-health-track"><div class="admin-health-fill warning" style="width:${warnedPct}%"></div></div>
      </div>

      <div class="admin-health-item">
        <div class="admin-health-head"><span>Suspended</span><span>${suspendedUsers} / ${totalUsers}</span></div>
        <div class="admin-health-track"><div class="admin-health-fill danger" style="width:${suspendedPct}%"></div></div>
      </div>
    `;
  }

  // ── 7. Recent Events feed (from server logs) ──────────────
  const eventsPanel = dashEl.querySelector(".admin-panel:last-child");
  if (eventsPanel) {
    const eventRows = recentEvents.length
      ? recentEvents.map(entry => {
          const eventText = String(entry.event || "");
          const timeText  = String(entry.timestamp || "");
          const isError   = entry.type === "error";
          const chip      = isError ? "suspension" : "system";
          const label     = isError ? "ERROR" : "REQUEST";
          return `
            <div class="admin-event-row">
              <span class="admin-event-chip ${chip}">${label}</span>
              <div>
                <div class="admin-event-text">${escapeHtml(eventText)}</div>
                <div class="admin-event-time">${escapeHtml(timeText)}</div>
              </div>
            </div>`;
        }).join("")
      : `<div class="admin-users-empty" style="font-size:0.9rem">No server logs yet.</div>`;

    eventsPanel.innerHTML = `
      <div class="admin-panel-title">📜 Recent Events</div>
      <div class="admin-events-list">${eventRows}</div>
      <button class="admin-events-link" onclick="showAdminPage('admin-audit')">View full audit log →</button>
    `;
  }
}
