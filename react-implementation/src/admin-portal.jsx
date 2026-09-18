// ══════════════════════════════════════════════
//   ADMIN PORTAL (rendered with React/JSX)
// ══════════════════════════════════════════════

// Structural markup (login screen, sidebar, dashboard KPI page) is mounted
// once via React. All other admin pages still push updates through
// getElementById the same way they did before this file was converted —
// only the DOM creation moved to React, not the state/update model.
let adminLoginRoot = null;
let adminDashRoot = null;
let adminSidebarRoot = null;
let adminSidebarActivePage = "admin-dash";

const ADMIN_NAV_ITEMS = [
  { id: "admin-dash", label: "📊 Dashboard", permission: null },
  { id: "admin-users", label: "👥 Users", permission: "users" },
  { id: "admin-projects", label: "📁 Projects", permission: "projects" },
  { id: "admin-mentor-apps", label: "📋 Mentor Applications", permission: "mentor_apps" },
  {
    id: "admin-mentor-revenue",
    label: "💰 Revenue & Escrow",
    permission: null,
    onExtraClick: () => {
      if (typeof renderAdminMentorRevenue === "function") renderAdminMentorRevenue();
    },
  },
  { id: "admin-audit", label: "📜 Audit Log", permission: "audit" },
];

const ADMIN_SU_NAV_ITEMS = [
  { id: "su-admins", label: "🔐 Manage Admins", extraClass: "su-nav-item" },
  { id: "su-config", label: "⚙️ Platform Config", extraClass: "su-nav-item" },
];

function AdminNavButton({ item, active, onNavigate }) {
  const className =
    "admin-nav-item" +
    (item.extraClass ? " " + item.extraClass : "") +
    (active ? " active" : "");
  return (
    <button
      className={className}
      onClick={() => {
        onNavigate(item.id);
        if (typeof item.onExtraClick === "function") item.onExtraClick();
      }}
    >
      {item.label}
    </button>
  );
}

function AdminSidebar({ isSU, permissions, activePage }) {
  const onNavigate = (id) => showAdminPage(id);

  return (
    <>
      <div className="admin-logo">
        <div
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "6px",
            background: "var(--primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--primary-fg)",
            fontSize: ".7rem",
            fontWeight: 700,
          }}
        >
          TF
        </div>
        <span>Portal</span>
        <span className={"admin-role-badge " + (isSU ? "su-badge" : "admin-badge")}>
          {isSU ? "Super User" : "Admin"}
        </span>
      </div>
      {ADMIN_NAV_ITEMS.map((item) => {
        const isAllowed = !item.permission || isSU || permissions.includes(item.permission);
        if (!isAllowed) return null;
        return (
          <AdminNavButton
            key={item.id}
            item={item}
            active={activePage === item.id}
            onNavigate={onNavigate}
          />
        );
      })}
      {isSU ? (
        <div className="su-only-nav">
          <div className="admin-nav-divider">Super User</div>
          {ADMIN_SU_NAV_ITEMS.map((item) => (
            <AdminNavButton
              key={item.id}
              item={item}
              active={activePage === item.id}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ) : null}
      <div style={{ flex: 1 }} />
      <button
        className="admin-nav-item"
        style={{ color: "var(--destructive)" }}
        onClick={() => exitAdmin()}
      >
        ← Exit Portal
      </button>
    </>
  );
}

function AdminLoginScreen() {
  return (
    <div className="login-card">
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "10px",
            background: "var(--primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--primary-fg)",
            fontWeight: 700,
            fontSize: "1.1rem",
            margin: "0 auto 10px",
          }}
        >
          TF
        </div>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Portal Sign In</h2>
        <p className="text-sm text-muted">Admin or Super User access</p>
      </div>
      <div
        id="admin-login-hint"
        style={{
          display: "none",
          fontSize: "11px",
          color: "var(--muted-fg)",
          background: "var(--secondary)",
          borderRadius: "6px",
          padding: "8px 10px",
          marginBottom: "10px",
          lineHeight: 1.5,
        }}
      />
      <div className="input-group">
        <label className="label">Email</label>
        <input className="input" id="admin-email" placeholder="your@email.io" />
      </div>
      <div className="input-group">
        <label className="label">Password</label>
        <input className="input" type="password" id="admin-pass" placeholder="••••••••" />
      </div>
      <button className="btn btn-primary btn-full mt-2" onClick={() => adminLogin()}>
        Sign In
      </button>
      <button className="btn btn-outline btn-full mt-2" onClick={() => hideAdmin()}>
        ← Back to App
      </button>
    </div>
  );
}

function AdminHealthBar({ label, labelId, fillId, fillClass }) {
  return (
    <div className="admin-health-item">
      <div className="admin-health-head">
        <span>{label}</span>
        <span id={labelId}>0 / 0</span>
      </div>
      <div className="admin-health-track">
        <div className={"admin-health-fill " + fillClass} id={fillId} style={{ width: "0%" }} />
      </div>
    </div>
  );
}

function AdminDashPage() {
  return (
    <>
      <div className="admin-dash-head">
        <h1>Platform Overview</h1>
        <p className="page-subtitle mt-1">Real-time snapshot of TeamForge activity.</p>
      </div>

      <div className="admin-dash-grid-top mt-3">
        <div className="admin-kpi-card">
          <div className="admin-kpi-row">
            <div className="admin-kpi-icon info">👥</div>
            <span className="admin-kpi-meta" id="admin-kpi-users-active">
              0 active
            </span>
          </div>
          <div className="admin-kpi-value" id="admin-kpi-users-total">
            0
          </div>
          <div className="admin-kpi-label">Total Users</div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-row">
            <div className="admin-kpi-icon">📖</div>
            <span className="admin-kpi-meta">Awaiting review</span>
          </div>
          <div className="admin-kpi-value" id="admin-kpi-mentor-pending">
            0
          </div>
          <div className="admin-kpi-label">Pending Mentor Apps</div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-row">
            <div className="admin-kpi-icon">⚠️</div>
            <span className="admin-kpi-meta" id="admin-kpi-suspended-meta">
              0 suspended
            </span>
          </div>
          <div className="admin-kpi-value" id="admin-kpi-flagged-warned">
            0
          </div>
          <div className="admin-kpi-label">Flagged / Warned</div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-row">
            <div className="admin-kpi-icon">📜</div>
          </div>
          <div className="admin-kpi-value" id="admin-kpi-audit-events">
            0
          </div>
          <div className="admin-kpi-label">Audit Events</div>
        </div>
      </div>

      <div className="admin-dash-grid-actions mt-3">
        <button className="admin-action-card" onClick={() => showAdminPage("admin-mentor-apps")}>
          <div className="admin-action-left">
            <div className="admin-action-icon">📖</div>
            <div>
              <div className="admin-action-title">Review Mentor Applications</div>
              <div className="admin-action-sub" id="admin-action-mentor-sub">
                0 pending
              </div>
            </div>
          </div>
          <div className="admin-action-count" id="admin-action-mentor-count">
            0
          </div>
        </button>

        <button className="admin-action-card" onClick={() => showAdminPage("admin-users")}>
          <div className="admin-action-left">
            <div className="admin-action-icon">🛡️</div>
            <div>
              <div className="admin-action-title">Manage Flagged Users</div>
              <div className="admin-action-sub" id="admin-action-flagged-sub">
                0 flagged
              </div>
            </div>
          </div>
          <div className="admin-action-count" id="admin-action-flagged-count">
            0
          </div>
        </button>

        <button className="admin-action-card" onClick={() => showAdminPage("admin-audit")}>
          <div className="admin-action-left">
            <div className="admin-action-icon">📜</div>
            <div>
              <div className="admin-action-title">View Full Audit Log</div>
              <div className="admin-action-sub" id="admin-action-audit-sub">
                0 entries
              </div>
            </div>
          </div>
          <div className="admin-action-count" id="admin-action-audit-count">
            0
          </div>
        </button>
      </div>

      <div className="admin-dash-grid-bottom mt-3">
        <div className="admin-panel">
          <div className="admin-panel-title">↗ User Health</div>
          <AdminHealthBar
            label="Active"
            labelId="admin-health-active-label"
            fillId="admin-health-active-fill"
            fillClass="success"
          />
          <AdminHealthBar
            label="Warned"
            labelId="admin-health-warned-label"
            fillId="admin-health-warned-fill"
            fillClass="warning"
          />
          <AdminHealthBar
            label="Suspended"
            labelId="admin-health-suspended-label"
            fillId="admin-health-suspended-fill"
            fillClass="danger"
          />
        </div>

        <div className="admin-panel">
          <div className="admin-panel-title">📜 Recent Events</div>
          <div className="admin-events-list" id="admin-dash-recent-events">
            <div className="admin-users-empty">No recent events.</div>
          </div>
          <button className="admin-events-link" onClick={() => showAdminPage("admin-audit")}>
            View full audit log →
          </button>
        </div>
      </div>
    </>
  );
}

function mountAdminPortalReact() {
  const loginContainer = document.getElementById("admin-login-screen");
  if (loginContainer && !adminLoginRoot) {
    adminLoginRoot = ReactDOM.createRoot(loginContainer);
    adminLoginRoot.render(<AdminLoginScreen />);
  }

  const dashContainer = document.getElementById("admin-dash");
  if (dashContainer && !adminDashRoot) {
    adminDashRoot = ReactDOM.createRoot(dashContainer);
    adminDashRoot.render(<AdminDashPage />);
  }
}

mountAdminPortalReact();

function renderAdminDash() {
  const totalEl = document.getElementById("admin-kpi-users-total");
  if (!totalEl) return; // dashboard markup not present (e.g. not in admin portal yet)

  const users = typeof getAllAdminUsers === "function" ? getAllAdminUsers() : [];
  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.status === "active").length;
  const warnedUsers = users.filter((u) => u.status === "warned").length;
  const suspendedUsers = users.filter((u) => u.status === "suspended").length;
  const flaggedOrWarned = users.filter(
    (u) => u.flagged || u.status === "warned",
  ).length;

  const pendingMentorApps = Array.isArray(STATE.mentorApplications)
    ? STATE.mentorApplications.filter((app) => app.status === "pending").length
    : 0;

  const auditEntries =
    typeof buildAuditLogEntries === "function" ? buildAuditLogEntries() : [];
  const auditCount = auditEntries.length;

  document.getElementById("admin-kpi-users-total").textContent = totalUsers;
  document.getElementById("admin-kpi-users-active").textContent = `${activeUsers} active`;
  document.getElementById("admin-kpi-mentor-pending").textContent = pendingMentorApps;
  document.getElementById("admin-kpi-flagged-warned").textContent = flaggedOrWarned;
  document.getElementById("admin-kpi-suspended-meta").textContent = `${suspendedUsers} suspended`;
  document.getElementById("admin-kpi-audit-events").textContent = auditCount;

  document.getElementById("admin-action-mentor-sub").textContent = `${pendingMentorApps} pending`;
  document.getElementById("admin-action-mentor-count").textContent = pendingMentorApps;
  document.getElementById("admin-action-flagged-sub").textContent = `${flaggedOrWarned} flagged`;
  document.getElementById("admin-action-flagged-count").textContent = flaggedOrWarned;
  document.getElementById("admin-action-audit-sub").textContent = `${auditCount} entries`;
  document.getElementById("admin-action-audit-count").textContent = auditCount;

  const pct = (n) => (totalUsers ? Math.round((n / totalUsers) * 100) : 0);
  document.getElementById("admin-health-active-label").textContent = `${activeUsers} / ${totalUsers}`;
  document.getElementById("admin-health-active-fill").style.width = `${pct(activeUsers)}%`;
  document.getElementById("admin-health-warned-label").textContent = `${warnedUsers} / ${totalUsers}`;
  document.getElementById("admin-health-warned-fill").style.width = `${pct(warnedUsers)}%`;
  document.getElementById("admin-health-suspended-label").textContent = `${suspendedUsers} / ${totalUsers}`;
  document.getElementById("admin-health-suspended-fill").style.width = `${pct(suspendedUsers)}%`;

  const recentEl = document.getElementById("admin-dash-recent-events");
  if (recentEl) {
    const recent = auditEntries.slice(0, 5);
    recentEl.innerHTML = recent.length
      ? recent
          .map((entry) => {
            const type =
              typeof mapRuntimeActionToAuditType === "function"
                ? mapRuntimeActionToAuditType(entry.event || entry.details)
                : "system";
            const chipClass =
              typeof getAuditTypeClass === "function" ? getAuditTypeClass(type) : "system";
            const chipLabel =
              typeof getAuditTypeLabel === "function" ? getAuditTypeLabel(type) : "System";
            return `
              <div class="admin-event-row">
                <span class="admin-event-chip ${chipClass}">${chipLabel.toUpperCase()}</span>
                <div>
                  <div class="admin-event-text">${escapeHtml(entry.event)}</div>
                  <div class="admin-event-time">${escapeHtml(entry.timestamp)}</div>
                </div>
              </div>
            `;
          })
          .join("")
      : '<div class="admin-users-empty">No recent events.</div>';
  }
}

function showAdmin() {
  closeDropdowns();
  document.getElementById("admin-portal").style.display = "";

  const isSu = typeof isSuperUser === "function" && isSuperUser();
  if (isSu) {
    // Superuser can directly access the portal from the app without re-login.
    STATE.portalRole = "superuser";
    if (typeof setPortalSessionEmail === "function") {
      setPortalSessionEmail(getCurrentUser().toLowerCase() || "");
    }
    document.getElementById("admin-login-screen").style.display = "none";
    document.getElementById("admin-dashboard-screen").style.display = "flex";
    renderPortalSidebar();
    renderAdminUsers();
    renderAdminProjects();
    renderAdminMentorApps();
    renderAuditLog();
    renderAdminDash();
    renderSuAdmins();
    renderSuConfig();
    showAdminPage("admin-dash");
    showToast("Super User portal open");
    return;
  }

  document.getElementById("admin-login-screen").style.display = "flex";
  document.getElementById("admin-dashboard-screen").style.display = "none";
}

function hideAdmin() {
  document.getElementById("admin-portal").style.display = "none";
}

function exitAdmin() {
  STATE.portalRole = null;
  if (typeof setPortalSessionEmail === "function") {
    setPortalSessionEmail("");
  }

  hideAdmin();

  if (typeof isSuperUser === "function" && isSuperUser()) {
    showToast("Admin portal closed, returned to dashboard");
    navigate("dashboard");
    return;
  }

  window.location.href = "index.html";
}

function renderSuperuserAdminButton() {
  const btn = document.getElementById("admin-portal-btn");
  if (!btn) return;
  btn.style.display = typeof isSuperUser === "function" && isSuperUser() ? "" : "none";
}

function openSuperuserAdmin() {
  if (!(typeof isSuperUser === "function" && isSuperUser())) {
    showToast("Only superusers may access the portal", "error");
    return;
  }
  showAdmin();
}

function getCurrentPortalPermissions() {
  if (STATE.portalRole === "superuser") {
    return ["users", "projects", "mentor_apps", "audit", "admins", "config"];
  }
  if (STATE.portalRole !== "admin") {
    return [];
  }
  const sessionEmail =
    typeof getPortalSessionEmail === "function" ? getPortalSessionEmail() : "";
  return typeof getPortalPermissionsForEmail === "function"
    ? getPortalPermissionsForEmail(sessionEmail)
    : [];
}

function adminCanAccess(sectionKey) {
  return getCurrentPortalPermissions().includes(sectionKey);
}

function recordPortalAuditEntry(entry) {
  if (Array.isArray(STATE.auditLog)) {
    STATE.auditLog.unshift(entry);
  }
  if (typeof appendPortalAuditEntry === "function") {
    appendPortalAuditEntry(entry);
  }
}

// Rebuilds the admin sidebar (via React) to show/hide Super User-only items
function renderPortalSidebar() {
  const sidebarContainer = document.getElementById("admin-sidebar-root");
  if (!sidebarContainer) return;

  const isSU = STATE.portalRole === "superuser";
  const permissions = getCurrentPortalPermissions();

  if (!adminSidebarRoot) {
    adminSidebarRoot = ReactDOM.createRoot(sidebarContainer);
  }
  adminSidebarRoot.render(
    <AdminSidebar isSU={isSU} permissions={permissions} activePage={adminSidebarActivePage} />,
  );
}

function adminLogin() {
  const emailInput = document.getElementById("admin-email");
  const passInput = document.getElementById("admin-pass");
  const hintEl = document.getElementById("admin-login-hint");
  if (!emailInput || !passInput) {
    showToast("Admin login form is unavailable");
    return;
  }

  const email = emailInput.value.trim().toLowerCase();
  const pass = passInput.value;

  if (!email) {
    showToast("Email is required");
    return;
  }
  if (!BASIC_EMAIL_RE.test(email)) {
    showToast("Enter a valid email address");
    return;
  }
  if (!pass || pass.length < 8) {
    showToast("Password must be at least 8 characters");
    return;
  }

  // Look up against PORTAL_ACCOUNTS (supports both admin and superuser)
  const account = PORTAL_ACCOUNTS.find(
    (a) => a.email === email && a.password === pass,
  );

  if (!account) {
    if (hintEl) {
      hintEl.style.display = "";
      hintEl.textContent =
        "Invalid credentials. Hint — Admin: admin@teamforge.io / admin123  |  Super User: superuser@teamforge.io / Super@123";
    } else {
      showToast("Invalid credentials");
    }
    return;
  }

  if (hintEl) hintEl.style.display = "none";

  if (account.portalRole === "admin") {
    const adminRecord =
      typeof getPortalAdminByEmail === "function"
        ? getPortalAdminByEmail(email)
        : null;
    if (!adminRecord) {
      showToast("Admin account configuration is missing", "error");
      return;
    }
    if (String(adminRecord.status || "").toLowerCase() === "suspended") {
      showToast("This admin account is suspended", "error");
      return;
    }
  }

  // Set the portal role in STATE so all downstream rendering knows who is logged in
  STATE.portalRole = account.portalRole;
  if (typeof setPortalSessionEmail === "function") {
    setPortalSessionEmail(email);
  }

  document.getElementById("admin-login-screen").style.display = "none";
  document.getElementById("admin-dashboard-screen").style.display = "flex";

  // Render the correct sidebar & dashboard for the role
  renderPortalSidebar();
  renderAdminUsers();
  renderAdminProjects();
  renderAdminMentorApps();
  renderAuditLog();
  renderAdminDash();

  if (account.portalRole === "superuser") {
    renderSuAdmins();
    renderSuConfig();
    showAdminPage("admin-dash");
    showToast("Signed in as Super User — full system access");
  } else {
    showAdminPage("admin-dash");
    showToast("Signed in as Admin");
  }
}

function showAdminPage(id) {
  const pagePermissionMap = {
    "admin-users": "users",
    "admin-user-profile": "users",
    "admin-projects": "projects",
    "admin-mentor-apps": "mentor_apps",
    "admin-audit": "audit",
    "admin-su-admins": "admins",
    "admin-su-config": "config",
  };
  const requiredPermission = pagePermissionMap[id];
  if (
    requiredPermission &&
    STATE.portalRole !== "superuser" &&
    !adminCanAccess(requiredPermission)
  ) {
    showToast("You do not have access to this admin section", "error");
    return;
  }
  document
    .querySelectorAll(".admin-page")
    .forEach((p) => (p.style.display = "none"));
  document.getElementById(id).style.display = "";
  if (id === "admin-dash") {
    renderAdminDash();
  }
  if (id === "admin-projects") {
    renderAdminProjects();
  }
  if (id === "admin-users") {
    renderAdminUsers();
  }
  if (id === "admin-mentor-apps") {
    renderAdminMentorApps();
  }
  if (id === "admin-audit") {
    renderAuditLog();
  }

  adminSidebarActivePage = id === "admin-user-profile" ? "admin-users" : id;
  renderPortalSidebar();
}
