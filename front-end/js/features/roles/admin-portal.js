// ══════════════════════════════════════════════
//   ADMIN PORTAL
// ══════════════════════════════════════════════
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
    return ["dashboard", "users", "projects", "mentor_apps", "revenue", "audit", "admins", "config"];
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

// Rebuilds the admin sidebar nav to show/hide Super User-only items
function renderPortalSidebar() {
  const sidebar = document.querySelector(".admin-sidebar");
  if (!sidebar) return;

  const isSU = STATE.portalRole === "superuser";
  const permissions = getCurrentPortalPermissions();

  // Badge element next to logo
  const logoBadge = sidebar.querySelector(".admin-role-badge");
  if (logoBadge) {
    logoBadge.textContent = isSU ? "Super User" : "Admin";
    logoBadge.className =
      "admin-role-badge " + (isSU ? "su-badge" : "admin-badge");
  }

  // Show or hide Super User-only nav items
  sidebar.querySelectorAll(".su-only-nav").forEach((el) => {
    el.style.display = isSU ? "" : "none";
  });

  const permissionMap = {
    "admin-dash": "dashboard",
    "admin-users": "users",
    "admin-projects": "projects",
    "admin-mentor-apps": "mentor_apps",
    "admin-mentor-revenue": "revenue",
    "admin-audit": "audit",
    "admin-su-admins": "admins",
    "admin-su-config": "config",
  };

  sidebar.querySelectorAll(".admin-nav-item").forEach((el) => {
    const match = String(el.getAttribute("onclick") || "").match(
      /showAdminPage\('([^']+)'\)/,
    );
    const pageId = match ? match[1] : "";
    const requiredPermission = permissionMap[pageId];
    if (!requiredPermission) return;
    const isAllowed = isSU || permissions.includes(requiredPermission);
    el.style.display = isAllowed ? "" : "none";
  });
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
    "admin-dash": "dashboard",
    "admin-users": "users",
    "admin-user-profile": "users",
    "admin-projects": "projects",
    "admin-mentor-apps": "mentor_apps",
    "admin-mentor-revenue": "revenue",
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
  document
    .querySelectorAll(".admin-nav-item")
    .forEach((b) => b.classList.remove("active"));
  const navPageId = id === "admin-user-profile" ? "admin-users" : id;
  const activeBtn = document.querySelector(
    `.admin-nav-item[onclick*="showAdminPage('${navPageId}')"]`,
  );
  if (activeBtn) activeBtn.classList.add("active");
}
