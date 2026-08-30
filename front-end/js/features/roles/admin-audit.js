// ══════════════════════════════════════════════
//   ADMIN — AUDIT LOG
// ══════════════════════════════════════════════

const ADMIN_AUDIT_UI_STATE = {
  query: "",
  filter: "all",
};

function setAdminAuditSearch(value) {
  ADMIN_AUDIT_UI_STATE.query = String(value || "");
  renderAuditLog();
}

function setAdminAuditFilter(filter) {
  ADMIN_AUDIT_UI_STATE.filter = filter;
  renderAuditLog();
}

function normalizeAuditEntry(entry, index) {
  const source = entry || {};
  return {
    id: String(source.id || `audit-runtime-${index + 1}`),
    type: String(source.type || "system").toLowerCase(),
    event: String(source.event || source.action || "Event"),
    actor: String(source.actor || source.user || "System"),
    target: String(source.target || "-"),
    details: String(source.details || source.action || "-"),
    timestamp: String(source.timestamp || source.time || "-"),
  };
}

function mapRuntimeActionToAuditType(actionText) {
  const action = String(actionText || "").toLowerCase();
  if (action.includes("mentor")) return "mentor";
  if (action.includes("suspend")) return "suspension";
  if (action.includes("warn")) return "warning";
  if (action.includes("reputation") || action.includes("rep"))
    return "reputation";
  if (action.includes("xp") || action.includes("task approved")) return "xp";
  if (action.includes("task")) return "task";
  return "system";
}

function buildAuditLogEntries() {
  const seeded = Array.isArray(ADMIN_AUDIT_LOG) ? ADMIN_AUDIT_LOG : [];
  const persisted =
    typeof loadPersistedPortalAuditLog === "function"
      ? loadPersistedPortalAuditLog()
      : [];

  return [...persisted, ...seeded].map((entry, index) =>
    normalizeAuditEntry(entry, index),
  );
}

function getAuditTypeLabel(type) {
  const labels = {
    all: "All",
    task: "Task",
    xp: "XP",
    reputation: "Reputation",
    warning: "Warning",
    suspension: "Suspension",
    mentor: "Mentor",
    system: "System",
  };
  return labels[type] || "System";
}

function getAuditTypeClass(type) {
  if (type === "task") return "task";
  if (type === "xp") return "xp";
  if (type === "reputation") return "reputation";
  if (type === "warning") return "warning";
  if (type === "suspension") return "suspension";
  if (type === "mentor") return "mentor";
  return "system";
}

let ADMIN_SERVER_LOGS = [];

async function fetchServerLogs() {
  try {
    const headers = { "x-user-role": "Administrator" };
    const [reqRes, errRes] = await Promise.all([
      fetch("http://localhost:3000/logs/requests", { headers }),
      fetch("http://localhost:3000/logs/errors", { headers })
    ]);
    
    let reqLogs = [], errLogs = [];
    if (reqRes.ok) reqLogs = await reqRes.json();
    if (errRes.ok) errLogs = await errRes.json();
    if (reqRes.ok) {
      const reqData = await reqRes.json();
      // Backend returns { count, logs } envelope — unwrap the array
      reqLogs = Array.isArray(reqData) ? reqData : (Array.isArray(reqData.logs) ? reqData.logs : []);
    }
    if (errRes.ok) {
      const errData = await errRes.json();
      // Backend returns { count, logs } envelope — unwrap the array
      errLogs = Array.isArray(errData) ? errData : (Array.isArray(errData.logs) ? errData.logs : []);
    }
    
    const combined = [];
    
    reqLogs.forEach(log => {
      combined.push({
        id: log.correlationId || Math.random().toString(),
        type: "request",
        event: `${log.method} ${log.url}`,
        actor: log.ip || "Client",
        target: `Status ${log.statusCode}`,
        details: `Time: ${log.responseTime}ms`,
        timestamp: log.timestamp
      });
    });
    
    errLogs.forEach(log => {
      combined.push({
        id: log.correlationId || Math.random().toString(),
        type: "error",
        event: `ERROR ${log.method || ""} ${log.url || ""}`,
        actor: "System",
        target: log.error || "Unknown Error",
        details: log.stack ? log.stack.split("\\n")[0] : "-",
        timestamp: log.timestamp
      });
    });
    
    // Sort descending by timestamp
    combined.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    ADMIN_SERVER_LOGS = combined;
  } catch (e) {
    console.warn("Could not fetch server logs", e);
  }
}

function getFilteredAuditEntries() {
  const allEntries = ADMIN_SERVER_LOGS;
  const query = ADMIN_AUDIT_UI_STATE.query.trim().toLowerCase();

  return allEntries.filter((entry) => {
    const matchesType =
      ADMIN_AUDIT_UI_STATE.filter === "all" ||
      entry.type === ADMIN_AUDIT_UI_STATE.filter;
    if (!matchesType) return false;

    if (!query) return true;
    return (
      entry.event.toLowerCase().includes(query) ||
      entry.actor.toLowerCase().includes(query) ||
      entry.target.toLowerCase().includes(query) ||
      entry.details.toLowerCase().includes(query)
    );
  });
}

async function renderAuditLog() {
  const listEl = document.getElementById("audit-log-list");
  const filtersEl = document.getElementById("admin-audit-filters");
  const countEl = document.getElementById("admin-audit-count");
  const searchEl = document.getElementById("admin-audit-search");
  
  if (!listEl || !filtersEl || !countEl) return;

  if (searchEl && searchEl.value !== ADMIN_AUDIT_UI_STATE.query) {
    searchEl.value = ADMIN_AUDIT_UI_STATE.query;
  }
  
  if (ADMIN_SERVER_LOGS.length === 0) {
    listEl.innerHTML = '<div class="admin-users-empty">Loading server logs...</div>';
    await fetchServerLogs();
  }

  const entries = getFilteredAuditEntries();
  const allEntries = ADMIN_SERVER_LOGS;
  const filters = ["all", "request", "error"];

  filtersEl.innerHTML = filters
    .map((filter) => {
      const count =
        filter === "all"
          ? allEntries.length
          : allEntries.filter((entry) => entry.type === filter).length;
      return `
        <button class="admin-audit-filter-chip${ADMIN_AUDIT_UI_STATE.filter === filter ? " active" : ""}" onclick="setAdminAuditFilter('${filter}')">
          ${filter.toUpperCase()}${filter === "all" ? ` (${count})` : ""}
        </button>
      `;
    })
    .join("");

  countEl.innerHTML = `${entries.length} event${entries.length === 1 ? "" : "s"} shown &nbsp; <button onclick="refreshAuditLogs()" style="cursor:pointer;background:none;border:none;color:var(--primary);text-decoration:underline;">Refresh</button>`;

  if (!entries.length) {
    listEl.innerHTML =
      '<div class="admin-users-empty">No server logs found.</div>';
    return;
  }

  listEl.innerHTML = `
    <table class="admin-audit-table">
      <thead>
        <tr>
          <th>Type</th>
          <th>Event</th>
          <th>Actor</th>
          <th>Target</th>
          <th>Details</th>
        </tr>
      </thead>
      <tbody>
        ${entries
          .map(
            (entry) => `
          <tr>
            <td><span class="admin-audit-type ${entry.type === 'error' ? 'suspension' : 'system'}">${entry.type.toUpperCase()}</span></td>
            <td>
              <div class="admin-audit-event">${escapeHtml(entry.event)}</div>
              <div class="admin-audit-time">${escapeHtml(entry.timestamp)}</div>
            </td>
            <td>${escapeHtml(entry.actor)}</td>
            <td>${escapeHtml(entry.target)}</td>
            <td>${escapeHtml(entry.details)}</td>
          </tr>
        `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

async function refreshAuditLogs() {
  ADMIN_SERVER_LOGS = [];
  await renderAuditLog();
}
