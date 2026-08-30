// ══════════════════════════════════════════════
//   ADMIN PORTAL
// ══════════════════════════════════════════════
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
    return ["users", "projects", "mentor_apps", "audit", "admins", "config", "finance", "organizations"];
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

  const canSeeFinance = permissions.includes("finance") || permissions.includes("organizations");
  sidebar.querySelectorAll(".finance-only-nav").forEach((el) => {
    el.style.display = canSeeFinance ? "" : "none";
  });
  const permissionMap = {
    "admin-users": "users",
    "admin-projects": "projects",
    "admin-mentor-apps": "mentor_apps",
    "admin-audit": "audit",
    "admin-finance": "finance",
    "admin-organizations": "organizations",
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
    "admin-finance": "finance",
    "admin-organizations": "organizations",
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
  if (id === "admin-projects") {
    renderAdminProjects();
  }
  if (id === "admin-users") {
    renderAdminUsers();
  }
  if (id === "admin-mentor-apps") {
    renderAdminMentorApps();
  }
  if (id === "admin-finance") {
    renderAdminFinance();
  }
  if (id === "admin-organizations") {
    renderAdminOrganizations();
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
