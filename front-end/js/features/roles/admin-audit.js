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

function getFilteredAuditEntries() {
  const allEntries = buildAuditLogEntries();
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

function renderAuditLog() {
  const listEl = document.getElementById("audit-log-list");
  const filtersEl = document.getElementById("admin-audit-filters");
  const countEl = document.getElementById("admin-audit-count");
  const searchEl = document.getElementById("admin-audit-search");
  if (!listEl || !filtersEl || !countEl) return;

  if (searchEl && searchEl.value !== ADMIN_AUDIT_UI_STATE.query) {
    searchEl.value = ADMIN_AUDIT_UI_STATE.query;
  }

  const entries = getFilteredAuditEntries();
  const allEntries = buildAuditLogEntries();
  const filters = [
    "all",
    "task",
    "xp",
    "reputation",
    "warning",
    "suspension",
    "mentor",
    "system",
  ];

  filtersEl.innerHTML = filters
    .map((filter) => {
      const count =
        filter === "all"
          ? allEntries.length
          : allEntries.filter((entry) => entry.type === filter).length;
      return `
        <button class="admin-audit-filter-chip${ADMIN_AUDIT_UI_STATE.filter === filter ? " active" : ""}" onclick="setAdminAuditFilter('${filter}')">
          ${getAuditTypeLabel(filter)}${filter === "all" ? ` (${count})` : ""}
        </button>
      `;
    })
    .join("");

  countEl.textContent = `${entries.length} event${entries.length === 1 ? "" : "s"} shown`;

  if (!entries.length) {
    listEl.innerHTML =
      '<div class="admin-users-empty">No audit events found for this filter.</div>';
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
            <td><span class="admin-audit-type ${getAuditTypeClass(entry.type)}">${getAuditTypeLabel(entry.type).toUpperCase()}</span></td>
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
