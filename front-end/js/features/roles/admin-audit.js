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
let adminServerLogsFetched = false;

async function fetchServerLogs() {
  try {
    const headers = { "x-user-role": "Administrator" };
    const apiBase = typeof resolveApiBaseUrl === "function" ? resolveApiBaseUrl() : "http://localhost:3000";
    const [reqRes, errRes] = await Promise.all([
      fetch(`${apiBase}/logs/requests`, { headers }),
      fetch(`${apiBase}/logs/errors`, { headers })
    ]);
    
    let reqLogs = [], errLogs = [];
    // Backend returns { count, logs: [...] } — extract the .logs array
    if (reqRes.ok) {
      const data = await reqRes.json();
      reqLogs = Array.isArray(data) ? data : (data.logs || []);
    }
    if (errRes.ok) {
      const data = await errRes.json();
      errLogs = Array.isArray(data) ? data : (data.logs || []);
    }
    
    const combined = [];
    
    reqLogs.forEach(log => {
      combined.push({
        id: log.correlationId || Math.random().toString(),
        type: "request",
        event: `${log.method} ${log.url}`,
        actor: log.ip || "Client",
        target: `Status ${log.statusCode}`,
        details: `Time: ${log.responseTime}ms | User: ${log.userId || "anon"}`,
        timestamp: log.timestamp
      });
    });
    
    errLogs.forEach(log => {
      combined.push({
        id: log.correlationId || Math.random().toString(),
        type: "error",
        event: `ERROR ${log.method || ""} ${log.url || ""}`,
        actor: "System",
        target: `Status ${log.statusCode || "500"}`,
        details: log.message || "-",
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

function getAllAuditEntries() {
  const portalEntries =
    typeof buildAuditLogEntries === "function" ? buildAuditLogEntries() : [];
  const combined = [...portalEntries, ...ADMIN_SERVER_LOGS];
  combined.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return combined;
}

function getFilteredAuditEntries() {
  const allEntries = getAllAuditEntries();
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

  // Fetch backend request/error logs once in the background — never block
  // rendering the locally-recorded portal audit trail (user moderation,
  // mentor approvals, etc.) on a possibly slow/unreachable backend.
  if (!adminServerLogsFetched) {
    adminServerLogsFetched = true;
    fetchServerLogs().then(() => renderAuditLog());
  }

  const entries = getFilteredAuditEntries();
  const allEntries = getAllAuditEntries();
  const presentTypes = Array.from(new Set(allEntries.map((entry) => entry.type)));
  const filters = ["all", ...presentTypes];

  filtersEl.innerHTML = filters
    .map((filter) => {
      const count =
        filter === "all"
          ? allEntries.length
          : allEntries.filter((entry) => entry.type === filter).length;
      const label =
        filter === "all"
          ? "All"
          : filter === "request" || filter === "error"
            ? filter.toUpperCase()
            : typeof getAuditTypeLabel === "function"
              ? getAuditTypeLabel(filter)
              : filter;
      return `
        <button class="admin-audit-filter-chip${ADMIN_AUDIT_UI_STATE.filter === filter ? " active" : ""}" onclick="setAdminAuditFilter('${filter}')">
          ${label.toUpperCase()} (${count})
        </button>
      `;
    })
    .join("");

  countEl.innerHTML = `${entries.length} event${entries.length === 1 ? "" : "s"} shown &nbsp; <button onclick="refreshAuditLogs()" style="cursor:pointer;background:none;border:none;color:var(--primary);text-decoration:underline;">Refresh</button>`;

  if (!entries.length) {
    listEl.innerHTML =
      '<div class="admin-users-empty">No audit events found.</div>';
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
          .map((entry) => {
            const badgeClass =
              entry.type === "request" || entry.type === "error"
                ? entry.type === "error"
                  ? "suspension"
                  : "system"
                : typeof getAuditTypeClass === "function"
                  ? getAuditTypeClass(entry.type)
                  : "system";
            return `
          <tr>
            <td><span class="admin-audit-type ${badgeClass}">${entry.type.toUpperCase()}</span></td>
            <td>
              <div class="admin-audit-event">${escapeHtml(entry.event)}</div>
              <div class="admin-audit-time">${escapeHtml(entry.timestamp)}</div>
            </td>
            <td>${escapeHtml(entry.actor)}</td>
            <td>${escapeHtml(entry.target)}</td>
            <td>${escapeHtml(entry.details)}</td>
          </tr>
        `;
          })
          .join("")}
      </tbody>
    </table>
  `;
}

async function refreshAuditLogs() {
  ADMIN_SERVER_LOGS = [];
  adminServerLogsFetched = false;
  await renderAuditLog();
}
