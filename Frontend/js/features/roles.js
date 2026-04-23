// ══════════════════════════════════════════════
//   INITIALIZATION: Load mentor approval on init
// ══════════════════════════════════════════════
function initializeMentorStatus() {
  // Ensure applications are seeded
  ensureMentorApplicationsSeeded();

  // Check if user is a superuser - auto-unlock mentor pages
  if (typeof isSuperUser === "function" && isSuperUser()) {
    STATE.isSuperUser = true;
    STATE.mentorApproved = true;
    console.log(
      `✅ Superuser detected - Mentor pages auto-unlocked for ${STATE.currentUser.name}`,
    );
    return;
  }

  STATE.isSuperUser = false;

  const currentEmail =
    typeof getCurrentUserSessionEmail === "function"
      ? getCurrentUserSessionEmail()
      : "";
  const currentUsers =
    typeof getStateUsersStore === "function" ? getStateUsersStore() : {};
  const currentRecord = currentEmail ? currentUsers[currentEmail] : null;

  // Trusted mentors from data.js or if previously unlocked in the user store
  const isTrustedMentor =
    MENTORS_DATA.some((mentor) => mentor.name === STATE.currentUser.name) ||
    currentRecord?.profile?.mentorUnlocked === true;

  if (isTrustedMentor) {
    STATE.mentorApproved = true;
    if (currentEmail && currentUsers[currentEmail]) {
      currentUsers[currentEmail].profile = {
        ...(currentUsers[currentEmail].profile || {}),
        mentorUnlocked: true,
      };
      currentUsers[currentEmail].role = "mentor";
      saveStateUsersStore(currentUsers);
    }
    STATE.role = "mentor";
  }

  // Check if current user has an approved mentor application
  const userApp = STATE.mentorApplications.find((app) => {
    const appEmail = String(app?.email || "").trim().toLowerCase();
    const appName = String(app?.name || "").trim().toLowerCase();
    return (
      (currentEmail && appEmail === currentEmail) ||
      appName === String(STATE.currentUser?.name || "").trim().toLowerCase()
    );
  });

  if (userApp) {
    STATE.mentorApplicationId = userApp.id;
    // User is approved if their application status is "approved"
    if (userApp.status === "approved") {
      STATE.mentorApproved = true;
      STATE.role = "mentor";
      if (currentEmail && currentUsers[currentEmail]) {
        currentUsers[currentEmail].profile = {
          ...(currentUsers[currentEmail].profile || {}),
          mentorUnlocked: true,
        };
        currentUsers[currentEmail].role = "mentor";
        saveStateUsersStore(currentUsers);
      }
      console.log(
        `✅ Mentor application approved for ${STATE.currentUser.name}`,
      );
    } else if (userApp.status === "rejected") {
      STATE.mentorApproved = false;
      if (STATE.role === "mentor") {
        STATE.role = "collaborator";
      }
      if (currentEmail && currentUsers[currentEmail]) {
        currentUsers[currentEmail].profile = {
          ...(currentUsers[currentEmail].profile || {}),
          mentorUnlocked: false,
        };
        if (currentUsers[currentEmail].role === "mentor") {
          currentUsers[currentEmail].role = "collaborator";
        }
        saveStateUsersStore(currentUsers);
      }
      console.log(
        `❌ Mentor application rejected for ${STATE.currentUser.name}`,
      );
    } else {
      // "pending"
      STATE.mentorApproved = false;
      console.log(
        `⏳ Mentor application pending for ${STATE.currentUser.name}`,
      );
    }
  } else if (!isTrustedMentor) {
    STATE.mentorApproved = false;
    STATE.mentorApplicationId = null;
    console.log(`ℹ️ No mentor application found for ${STATE.currentUser.name}`);
  }
}

// ══════════════════════════════════════════════
//   ROLE
// ══════════════════════════════════════════════
function setRole(role) {
  STATE.role = role;
  closeDropdowns();
  updateRoleUI();
  if (typeof saveViewState === "function") saveViewState();
  navigate("dashboard");
}

function tryMentor() {
  closeDropdowns();
  if (STATE.mentorApproved) {
    setRole("mentor");
  } else if (STATE.mentorApplicationId) {
    // User has a pending/rejected application
    const app = STATE.mentorApplications.find(
      (a) => a.id === STATE.mentorApplicationId,
    );
    if (app?.status === "rejected") {
      showToast(
        "Your mentor application was rejected. You may reapply after 3 months.",
        "error",
      );
    } else {
      showToast(
        "Your mentor application is still under review. Please wait for admin approval.",
        "info",
      );
    }
    navigate("mentor-application");
  } else {
    // No application found - allow new submission
    navigate("mentor-application");
  }
}

function updateRoleUI() {
  const r = STATE.role;
  const btn = document.getElementById("role-btn");
  btn.className = "role-btn " + r;
  document.getElementById("role-label").textContent =
    r === "collaborator"
      ? "Collaborator"
      : r === "project-owner"
        ? "Project Owner"
        : "Mentor";
  document.getElementById("user-role-label").textContent =
    r === "collaborator"
      ? "Collaborator"
      : r === "project-owner"
        ? "Project Owner"
        : "Mentor";
  ["collab", "owner", "mentor"].forEach((k) => {
    document.getElementById("active-" + k).style.display = "none";
  });
  const map = {
    collaborator: "collab",
    "project-owner": "owner",
    mentor: "mentor",
  };
  document.getElementById("active-" + map[r]).style.display = "";

  const av = document.getElementById("header-avatar");
  av.className = r === "mentor" ? "avatar mentor-av" : "avatar";

  if (STATE.mentorApproved) {
    document.getElementById("mentor-icon").textContent = "⭐";
    document.getElementById("mentor-status").textContent =
      r !== "mentor" ? "Unlocked" : "Active";
    document.getElementById("mentor-status").className = "ml-auto unlocked";
  }

  renderRoleNav();
  renderSuperuserAdminButton();
}

function renderRoleNav() {
  const r = STATE.role;
  const items =
    r === "collaborator"
      ? [
          { page: "projects", icon: "📁", label: "Projects" },
          { page: "applied-projects", icon: "✅", label: "Applied Projects" },
          { page: "my-work", icon: "💼", label: "My Work" },
        ]
      : r === "project-owner"
        ? [
            { page: "create-project", icon: "➕", label: "Create Project" },
            { page: "my-projects", icon: "📂", label: "My Projects" },
            { page: "mentors", icon: "👥", label: "Mentors" },
          ]
        : [
            { page: "mentor-requests", icon: "📚", label: "Mentor Requests" },
            {
              page: "mentored-projects",
              icon: "⭐",
              label: "Mentored Projects",
            },
          ];

  const label =
    r === "collaborator"
      ? "Collaborator"
      : r === "project-owner"
        ? "Project Owner"
        : "Mentor";
  document.getElementById("role-nav").innerHTML = `
    <div class="sidebar-group-label">${label}</div>
    ${items
      .map(
        (i) => `
      <button class="sidebar-nav-item" data-page="${i.page}" onclick="navigate('${i.page}')">
        <span>${i.icon}</span>
        <span class="sidebar-nav-label">${i.label}</span>
      </button>
    `,
      )
      .join("")}
  `;
}

const BASIC_EMAIL_RE =
  /^[a-zA-Z0-9._%+-]{1,64}@[a-zA-Z0-9.-]{1,255}\.[a-zA-Z]{2,}$/;

function isValidWebUrl(urlText) {
  if (!urlText || typeof urlText !== "string") return false;
  if (urlText.length > 2048) return false;
  try {
    const url = new URL(urlText);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      Boolean(url.hostname)
    );
  } catch {
    return false;
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatCurrentTime() {
  const now = new Date();
  const hh = String(now.getHours() % 12 || 12).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ampm = now.getHours() >= 12 ? "PM" : "AM";
  return `${hh}:${mm} ${ampm}`;
}

function getOwnedWorkspaceChat(project, data) {
  const runtime = getOwnedProjectRuntimeState(
    project,
    data.members,
    data.tasks,
  );
  if (!Array.isArray(runtime.chat) || runtime.chat.length === 0) {
    runtime.chat = [
      {
        sender: project.owner || "Owner",
        text: "Let’s close API integration by Friday.",
        time: "10:12 AM",
      },
      {
        sender: "TeamForge Bot",
        text: "UI task moved to In Review.",
        time: "10:20 AM",
      },
    ];
  }
  return runtime.chat;
}
// ══════════════════════════════════════════════
//   ADMIN
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
    "admin-users": "users",
    "admin-projects": "projects",
    "admin-mentor-apps": "mentor_apps",
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
  if (id === "admin-projects") {
    renderAdminProjects();
  }
  if (id === "admin-users") {
    renderAdminUsers();
  }
  if (id === "admin-mentor-apps") {
    renderAdminMentorApps();
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

function getAdminUserByName(name) {
  return ADMIN_USERS.find((user) => user.name === name) || null;
}

function renderAdminUserProfile(user) {
  const container = document.getElementById("admin-user-profile-content");
  if (!container) return;

  if (!user) {
    container.innerHTML =
      '<div class="admin-users-empty">User profile is unavailable.</div>';
    return;
  }

  const statusText = toTitleCase(user.status);
  const statusClass = getAdminStatusBadgeClass(user.status);
  const encodedName = encodeURIComponent(String(user.name || ""));
  const flaggedText = user.flagged ? "Flagged" : "Not flagged";

  container.innerHTML = `
    <div class="card admin-profile-card">
      <div class="admin-profile-head">
        <div class="admin-profile-avatar">${escapeHtml(user.initials || "US")}</div>
        <div>
          <h1 class="admin-profile-name">${escapeHtml(user.name)}</h1>
          <p class="page-subtitle">${escapeHtml(user.university || "Unknown University")} · ${escapeHtml(user.role || "User")}</p>
        </div>
        <span class="status-badge ${statusClass}">${statusText}</span>
      </div>

      <div class="admin-profile-stats mt-3">
        <div class="admin-profile-stat">
          <div class="admin-profile-stat-value">${Number(user.xp || 0).toLocaleString()}</div>
          <div class="admin-profile-stat-label">XP</div>
        </div>
        <div class="admin-profile-stat">
          <div class="admin-profile-stat-value">${Number(user.rep || 0).toLocaleString()}</div>
          <div class="admin-profile-stat-label">Reputation</div>
        </div>
        <div class="admin-profile-stat">
          <div class="admin-profile-stat-value">${Number(user.projects || 0).toLocaleString()}</div>
          <div class="admin-profile-stat-label">Projects</div>
        </div>
        <div class="admin-profile-stat">
          <div class="admin-profile-stat-value">${flaggedText}</div>
          <div class="admin-profile-stat-label">Flag Status</div>
        </div>
      </div>

      <div class="admin-profile-actions mt-3">
        <button class="btn btn-outline btn-sm" onclick="adminModerateUser('${encodedName}', 'warn')">Warn</button>
        <button class="btn btn-outline btn-sm" onclick="adminModerateUser('${encodedName}', 'suspend')">Suspend</button>
        <button class="btn btn-primary btn-sm" onclick="adminModerateUser('${encodedName}', 'activate')">Reactivate</button>
        <button class="btn btn-outline btn-sm" onclick="adminModerateUser('${encodedName}', '${user.flagged ? "unflag" : "flag"}')">${user.flagged ? "Remove flag" : "Flag account"}</button>
      </div>
    </div>
  `;
}

const ADMIN_USER_FILTER_STATE = {
  query: "",
  filter: "all",
  openMenuName: "",
  selectedUserName: "",
};

function ensureAdminUserMenuCloseHandler() {
  if (window.__adminUserMenuCloseBound) return;
  document.addEventListener("click", () => {
    if (!ADMIN_USER_FILTER_STATE.openMenuName) return;
    ADMIN_USER_FILTER_STATE.openMenuName = "";
    renderAdminUsers();
  });
  window.__adminUserMenuCloseBound = true;
}

function toggleAdminUserMenu(encodedName, event) {
  if (event) event.stopPropagation();
  const userName = decodeURIComponent(String(encodedName || ""));
  if (!userName) return;

  ADMIN_USER_FILTER_STATE.openMenuName =
    ADMIN_USER_FILTER_STATE.openMenuName === userName ? "" : userName;
  renderAdminUsers();
}

function adminModerateUser(encodedName, action, event) {
  if (event) event.stopPropagation();

  const userName = decodeURIComponent(String(encodedName || ""));
  const user = ADMIN_USERS.find((item) => item.name === userName);
  if (!user) {
    showToast("User record unavailable");
    return;
  }

  if (action === "view") {
    ADMIN_USER_FILTER_STATE.openMenuName = "";
    closeDropdowns();
    adminViewUser(user.name, user.initials || "US");
    return;
  }

  let actionLabel = "updated";
  if (action === "warn") {
    user.status = "warned";
    user.flagged = true;
    actionLabel = "warned";
  } else if (action === "suspend") {
    user.status = "suspended";
    user.flagged = true;
    actionLabel = "suspended";
  } else if (action === "activate") {
    user.status = "active";
    user.flagged = false;
    actionLabel = "reactivated";
  } else if (action === "flag") {
    user.flagged = true;
    actionLabel = "flagged";
  } else if (action === "unflag") {
    user.flagged = false;
    actionLabel = "unflagged";
  }

  recordPortalAuditEntry({
    action: `User ${user.name} ${actionLabel}`,
    user: "Admin",
    time: formatCurrentTime(),
  });

  ADMIN_USER_FILTER_STATE.openMenuName = "";
  closeDropdowns();
  renderAdminUsers();
  if (ADMIN_USER_FILTER_STATE.selectedUserName === user.name) {
    renderAdminUserProfile(user);
  }
  renderAuditLog();
  showToast(`${user.name} ${actionLabel}`);
}

function getAdminUserFilterCount(filterId) {
  if (!Array.isArray(ADMIN_USERS)) return 0;
  if (filterId === "all") return ADMIN_USERS.length;
  if (filterId === "flagged") {
    return ADMIN_USERS.filter((user) => user.flagged === true).length;
  }
  return ADMIN_USERS.filter((user) => user.status === filterId).length;
}

function getAdminUsersByFilter() {
  if (!Array.isArray(ADMIN_USERS)) return [];

  const query = ADMIN_USER_FILTER_STATE.query.trim().toLowerCase();
  const filtered = ADMIN_USERS.filter((user) => {
    const matchesQuery =
      query.length === 0 ||
      user.name.toLowerCase().includes(query) ||
      String(user.university || "")
        .toLowerCase()
        .includes(query);

    if (!matchesQuery) return false;

    if (ADMIN_USER_FILTER_STATE.filter === "all") return true;
    if (ADMIN_USER_FILTER_STATE.filter === "flagged") {
      return user.flagged === true;
    }
    return user.status === ADMIN_USER_FILTER_STATE.filter;
  });

  return filtered;
}

function getAdminStatusBadgeClass(status) {
  if (status === "warned") return "status-pending";
  if (status === "suspended") return "status-rejected";
  return "status-active";
}

function toTitleCase(value) {
  const text = String(value || "").toLowerCase();
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function setAdminUsersSearch(query) {
  ADMIN_USER_FILTER_STATE.query = String(query || "");
  renderAdminUsers();
}

function setAdminUsersFilter(filterId) {
  ADMIN_USER_FILTER_STATE.filter = filterId;
  renderAdminUsers();
}

function renderAdminUsers() {
  ensureAdminUserMenuCloseHandler();

  const filtersEl = document.getElementById("admin-users-filters");
  const listEl = document.getElementById("admin-users-list");
  const searchInput = document.getElementById("admin-users-search");
  if (!filtersEl || !listEl) return;

  if (searchInput && searchInput.value !== ADMIN_USER_FILTER_STATE.query) {
    searchInput.value = ADMIN_USER_FILTER_STATE.query;
  }

  const filters = [
    { id: "all", label: "All" },
    { id: "active", label: "Active" },
    { id: "warned", label: "Warned" },
    { id: "suspended", label: "Suspended" },
    { id: "flagged", label: "Flagged" },
  ];

  filtersEl.innerHTML = filters
    .map((filter) => {
      const isActive = ADMIN_USER_FILTER_STATE.filter === filter.id;
      const count = getAdminUserFilterCount(filter.id);
      return `
        <button
          class="admin-users-filter-chip${isActive ? " active" : ""}"
          onclick="setAdminUsersFilter('${filter.id}')"
        >
          ${filter.label} (${count})
        </button>
      `;
    })
    .join("");

  const users = getAdminUsersByFilter();
  if (users.length === 0) {
    listEl.innerHTML = `
      <div class="admin-users-empty">No users found for the selected filter.</div>
    `;
    return;
  }

  listEl.innerHTML = users
    .map((user) => {
      const statusText = toTitleCase(user.status);
      const flaggedBadge = user.flagged
        ? '<span class="admin-users-flag" title="Flagged account">🏳</span>'
        : "";
      const encodedName = encodeURIComponent(String(user.name || ""));
      const encodedInitials = encodeURIComponent(String(user.initials || "US"));
      const isMenuOpen = ADMIN_USER_FILTER_STATE.openMenuName === user.name;

      return `
        <div class="admin-user-row ${user.flagged ? "flagged" : ""}">
          <div class="admin-user-left">
            <div class="admin-user-avatar">${escapeHtml(user.initials)}</div>
            <div>
              <div class="admin-user-name">${escapeHtml(user.name)} ${flaggedBadge}</div>
              <div class="admin-user-meta">${escapeHtml(user.university)} · ${escapeHtml(user.role)}</div>
            </div>
          </div>

          <div class="admin-user-right">
            <div class="admin-user-metrics">
              <div>
                <div class="admin-user-metric-value">${Number(user.xp || 0).toLocaleString()}</div>
                <div class="admin-user-metric-label">XP</div>
              </div>
              <div>
                <div class="admin-user-metric-value">${Number(user.rep || 0).toLocaleString()}</div>
                <div class="admin-user-metric-label">Rep</div>
              </div>
              <div>
                <div class="admin-user-metric-value">${Number(user.projects || 0).toLocaleString()}</div>
                <div class="admin-user-metric-label">Projects</div>
              </div>
            </div>

            <span class="status-badge ${getAdminStatusBadgeClass(user.status)}">${statusText}</span>
            <div class="admin-user-actions dropdown" onclick="event.stopPropagation()">
              <button
                class="admin-user-open"
                onclick="toggleAdminUserMenu('${encodedName}', event)"
                aria-label="Open actions for ${escapeHtml(user.name)}"
                aria-expanded="${isMenuOpen ? "true" : "false"}"
              >
                &#9662;
              </button>
              <div class="dropdown-menu admin-user-menu${isMenuOpen ? " open" : ""}">
                <button class="dropdown-item" onclick="adminModerateUser('${encodedName}', 'view', event)">View profile</button>
                <button class="dropdown-item" onclick="adminModerateUser('${encodedName}', 'warn', event)">Warn user</button>
                <button class="dropdown-item danger" onclick="adminModerateUser('${encodedName}', 'suspend', event)">Suspend user</button>
                <button class="dropdown-item" onclick="adminModerateUser('${encodedName}', 'activate', event)">Reactivate user</button>
                <button class="dropdown-item" onclick="adminModerateUser('${encodedName}', '${user.flagged ? "unflag" : "flag"}', event)">${user.flagged ? "Remove flag" : "Flag account"}</button>
              </div>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

function adminViewUser(name, initials) {
  if (!name) {
    showToast("User details unavailable", "error");
    return;
  }

  const user = getAdminUserByName(name) || {
    name,
    initials: initials || "US",
    university: "Unknown University",
    role: "User",
    xp: 0,
    rep: 0,
    projects: 0,
    status: "active",
    flagged: false,
  };

  ADMIN_USER_FILTER_STATE.selectedUserName = user.name;
  ADMIN_USER_FILTER_STATE.openMenuName = "";
  closeDropdowns();
  renderAdminUserProfile(user);
  showAdminPage("admin-user-profile");
}

function renderAdminProjects() {
  const list = document.getElementById("admin-projects-list");
  if (!list) return;

  const isSuperUser = STATE.portalRole === "superuser";

  list.innerHTML = `
    <table style="margin:0">
      <thead>
        <tr style="background:var(--secondary)">
          <th style="padding:12px 16px">Project</th>
          <th style="padding:12px 16px">Owner</th>
          <th style="padding:12px 16px">Difficulty</th>
          <th style="padding:12px 16px">Collaborators</th>
          <th style="padding:12px 16px">Progress</th>
          ${isSuperUser ? '<th style="padding:12px 16px;text-align:right">Actions</th>' : ""}
        </tr>
      </thead>
      <tbody>
        ${PROJECTS.map(
          (p) => `
          <tr>
            <td style="padding:10px 16px">${escapeHtml(p.name)}</td>
            <td style="padding:10px 16px">${escapeHtml(p.owner || "Unassigned")}</td>
            <td style="padding:10px 16px">${escapeHtml(p.difficulty || "—")}</td>
            <td style="padding:10px 16px">${p.collaborators ?? 0}</td>
            <td style="padding:10px 16px">${p.progress ?? 0}%</td>
            ${
              isSuperUser
                ? `<td style="padding:10px 16px;text-align:right">
                   <button class="btn btn-xs su-btn-danger"
                     onclick="suDeleteProject('${escapeHtml(String(p.id))}')">Delete</button>
                 </td>`
                : ""
            }
          </tr>
        `,
        ).join("")}
      </tbody>
    </table>
  `;
}

function renderAdminMentorApps() {
  const list = document.getElementById("admin-mentor-list");
  if (!list) return;

  ensureMentorApplicationsSeeded();
  const apps = getMentorApplicationsForFilter();

  const pendingCount = STATE.mentorApplications.filter(
    (app) => app.status === "pending",
  ).length;
  const approvedCount = STATE.mentorApplications.filter(
    (app) => app.status === "approved",
  ).length;
  const rejectedCount = STATE.mentorApplications.filter(
    (app) => app.status === "rejected",
  ).length;

  list.innerHTML = `
    <div class="admin-mentor-criteria">
      <div class="admin-mentor-criteria-title">Eligibility Criteria</div>
      <div class="admin-mentor-criteria-tags">
        <span class="admin-mentor-criteria-tag"><span class="admin-mentor-icon">${iconCheckSvg()}</span>Min. 4-5 years professional experience</span>
        <span class="admin-mentor-criteria-tag"><span class="admin-mentor-icon">${iconCheckSvg()}</span>Complete & authentic LinkedIn profile</span>
        <span class="admin-mentor-criteria-tag"><span class="admin-mentor-icon">${iconCheckSvg()}</span>Consistent relevant career history</span>
        <span class="admin-mentor-criteria-tag"><span class="admin-mentor-icon">${iconCheckSvg()}</span>Professional conduct - no misconduct record</span>
      </div>
    </div>

    <div class="admin-mentor-filters mt-3">
      <button class="admin-users-filter-chip${ADMIN_MENTOR_UI_STATE.filter === "pending" ? " active" : ""}" onclick="setAdminMentorFilter('pending')">Pending (${pendingCount})</button>
      <button class="admin-users-filter-chip${ADMIN_MENTOR_UI_STATE.filter === "approved" ? " active" : ""}" onclick="setAdminMentorFilter('approved')">Approved (${approvedCount})</button>
      <button class="admin-users-filter-chip${ADMIN_MENTOR_UI_STATE.filter === "rejected" ? " active" : ""}" onclick="setAdminMentorFilter('rejected')">Rejected (${rejectedCount})</button>
      <button class="admin-users-filter-chip${ADMIN_MENTOR_UI_STATE.filter === "all" ? " active" : ""}" onclick="setAdminMentorFilter('all')">All (${STATE.mentorApplications.length})</button>
    </div>

    <div class="admin-mentor-list-wrap mt-3">
      ${
        apps.length
          ? apps.map((app) => renderMentorApplicationCard(app)).join("")
          : '<div class="admin-users-empty">No mentor applications in this status.</div>'
      }
    </div>
  `;
}

function persistMentorApplicationsState() {
  if (typeof savePersistedMentorApplications === "function") {
    savePersistedMentorApplications(STATE.mentorApplications || []);
  }
  if (typeof saveUserRuntime === "function") {
    saveUserRuntime();
  }
}

function findUserEntryForMentorApplication(app, users = getStateUsersStore()) {
  const safeUsers = users && typeof users === "object" ? users : {};
  const appEmail = String(app?.email || "").trim().toLowerCase();
  if (appEmail && safeUsers[appEmail]) {
    return [appEmail, safeUsers[appEmail]];
  }

  const appName = String(app?.name || "").trim().toLowerCase();
  if (!appName) return null;

  return (
    Object.entries(safeUsers).find(([, user]) => {
      return (
        String(user?.name || "").trim().toLowerCase() === appName
      );
    }) || null
  );
}

function syncMentorApprovalToUserRecord(app, status) {
  if (!app || typeof getStateUsersStore !== "function") return;
  const users = getStateUsersStore();
  const entry = findUserEntryForMentorApplication(app, users);
  if (!entry) return;

  const [email, userRecord] = entry;
  userRecord.profile = {
    ...(userRecord.profile || {}),
    mentorUnlocked: status === "approved",
  };
  if (status === "approved") {
    userRecord.role = "mentor";
  } else if (status === "rejected" && userRecord.role === "mentor") {
    userRecord.role = "collaborator";
  }
  userRecord.data = userRecord.data && typeof userRecord.data === "object"
    ? userRecord.data
    : { projects: [], requests: [], notifications: [] };
  userRecord.data.notifications = Array.isArray(userRecord.data.notifications)
    ? userRecord.data.notifications
    : [];
  userRecord.data.notifications.unshift({
    type: "MENTOR_APPLICATION",
    message:
      status === "approved"
        ? "Your mentor application was approved."
        : "Your mentor application was rejected.",
    status,
    timestamp: new Date().toISOString(),
    icon: status === "approved" ? "STAR" : "INFO",
    title: status === "approved" ? "Mentor Application Approved" : "Mentor Application Rejected",
    desc:
      status === "approved"
        ? "Your mentor application was approved."
        : "Your mentor application was rejected.",
    time: formatCurrentTime(),
  });
  users[email] = userRecord;
  saveStateUsersStore(users);
}

function approveApp(appId) {
  const app = STATE.mentorApplications.find((item) => item.id === appId);
  if (!app) return;

  // Validate eligibility
  if (app.years < 4) {
    showToast(
      "❌ Cannot approve: Applicant has less than 4 years of experience",
      "error",
    );
    return;
  }

  app.status = "approved";
  syncMentorApprovalToUserRecord(app, "approved");
  persistMentorApplicationsState();

  // If the approved person is the current user, unlock mentor role for them
  const currentEmail =
    typeof getCurrentUserSessionEmail === "function"
      ? getCurrentUserSessionEmail()
      : "";
  if (
    String(app.name || "").trim().toLowerCase() ===
    String(STATE.currentUser?.name || "").trim().toLowerCase()
  ) {
    STATE.mentorApproved = true;
    STATE.role = "mentor";
    const mentorIcon = document.getElementById("mentor-icon");
    const mentorStatus = document.getElementById("mentor-status");
    if (mentorIcon) mentorIcon.textContent = "⭐";
    if (mentorStatus) {
      mentorStatus.textContent = "Unlocked";
      mentorStatus.className = "ml-auto unlocked";
    }
    updateRoleUI();
  }

  // Create audit log entry
  const audit = {
    action: `Approved mentor application: ${app.name}`,
    actor: STATE.portalRole === "superuser" ? "Super User" : "Admin",
    target: app.id,
    type: "mentor",
    details: `${app.name} (${app.years} years) - ${app.expertise}`,
    timestamp: new Date().toISOString(),
    time: formatCurrentTime(),
  };

  recordPortalAuditEntry(audit);

  renderAdminMentorApps();
  if (typeof renderAuditLog === "function") renderAuditLog();
  showToast(`✅ ${app.name} approved as mentor`);
}

function rejectApp(appId) {
  const app = STATE.mentorApplications.find((item) => item.id === appId);
  if (!app) return;

  app.status = "rejected";
  syncMentorApprovalToUserRecord(app, "rejected");
  persistMentorApplicationsState();

  // If the rejected person is the current user, disable mentor role
  if (
    String(app.name || "").trim().toLowerCase() ===
    String(STATE.currentUser?.name || "").trim().toLowerCase()
  ) {
    STATE.mentorApproved = false;
    if (STATE.role === "mentor") {
      STATE.role = "collaborator";
      updateRoleUI();
    }
    const mentorIcon = document.getElementById("mentor-icon");
    const mentorStatus = document.getElementById("mentor-status");
    if (mentorIcon) mentorIcon.textContent = "🔒";
    if (mentorStatus) {
      mentorStatus.textContent = "Rejected";
      mentorStatus.className = "ml-auto ";
    }
  }

  // Create audit log entry
  const audit = {
    action: `Rejected mentor application: ${app.name}`,
    actor: STATE.portalRole === "superuser" ? "Super User" : "Admin",
    target: app.id,
    type: "mentor",
    details: `${app.name} does not meet eligibility criteria`,
    timestamp: new Date().toISOString(),
    time: formatCurrentTime(),
  };

  recordPortalAuditEntry(audit);

  renderAdminMentorApps();
  if (typeof renderAuditLog === "function") renderAuditLog();
  showToast(`❌ ${app.name} rejected`);
}

const ADMIN_MENTOR_UI_STATE = {
  filter: "pending",
  expandedId: "",
};

// ══════════════════════════════════════════════
//   MENTOR APPLICATION SUBMISSION
// ══════════════════════════════════════════════
function submitMentorApp() {
  // Ensure mentor applications are seeded from data
  ensureMentorApplicationsSeeded();

  const nameEl = document.getElementById("mentor-app-name");
  const linkedinEl = document.getElementById("mentor-app-linkedin");
  const expertiseEl = document.getElementById("mentor-app-expertise");
  const yearsEl = document.getElementById("mentor-app-years");
  const motivationEl = document.getElementById("mentor-app-motivation");
  const errorEl = document.getElementById("mentor-app-error");

  if (!nameEl || !linkedinEl || !expertiseEl || !yearsEl || !motivationEl) {
    showToast("Mentor application form is unavailable", "error");
    return;
  }

  const name = nameEl.value?.trim() || "";
  const linkedin = linkedinEl.value?.trim() || "";
  const expertise = expertiseEl.value?.trim() || "";
  const years = parseInt(yearsEl.value) || 0;
  const motivation = motivationEl.value?.trim() || "";

  // ── Validation ────────────────────────────────────────────
  function showErr(msg) {
    if (errorEl) {
      errorEl.textContent = msg;
      errorEl.style.display = "";
    }
    showToast(msg, "error");
  }

  if (!name) {
    showErr("Full name is required.");
    return;
  }
  if (!linkedin) {
    showErr("LinkedIn profile URL is required.");
    return;
  }
  if (!expertise) {
    showErr("Area of expertise is required.");
    return;
  }
  if (years < 1 || years > 100) {
    showErr("Years of experience must be between 1 and 100.");
    return;
  }
  if (!motivation) {
    showErr("Motivation statement is required.");
    return;
  }

  // LinkedIn URL validation
  const linkedinRegex = /^https?:\/\/(www\.)?linkedin\.com\//i;
  if (!linkedinRegex.test(linkedin)) {
    showErr(
      "Please enter a valid LinkedIn URL (e.g., https://linkedin.com/in/yourprofile)",
    );
    return;
  }

  // Check for duplicate application (same name)
  const existingApp = STATE.mentorApplications.find(
    (app) => app.name.toLowerCase() === name.toLowerCase(),
  );

  if (existingApp) {
    const status = existingApp.status;
    if (status === "approved") {
      showErr("You are already an approved mentor!");
    } else if (status === "rejected") {
      showErr(
        "Your previous application was rejected. You can reapply after 3 months.",
      );
    } else {
      showErr(
        "You have already applied. Wait for admin review (typically 3-5 days).",
      );
    }
    return;
  }

  // ── Create New Application ────────────────────────────────
  const newApp = {
    id: "mentor-app-" + Date.now(),
    name,
    initials: name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase(),
    university: "Unknown University", // Can be extended to ask for this
    submittedAt: new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    expertise,
    specialization: expertise.split(",")[0].trim(), // First expertise as specialization
    linkedin,
    years,
    motivation,
    status: "pending",
  };

  // Add to applications
  STATE.mentorApplications.push(newApp);
  STATE.mentorApplicationId = newApp.id;
  if (typeof savePersistedMentorApplications === "function") {
    savePersistedMentorApplications(STATE.mentorApplications);
  }

  // Log action
  recordPortalAuditEntry({
    action: `New mentor application submitted: ${name}`,
    actor: "System",
    target: newApp.id,
    type: "mentor",
    details: `${name} (${years} years) - ${expertise}`,
    timestamp: new Date().toISOString(),
  });

  // Clear form
  if (nameEl) nameEl.value = "";
  if (linkedinEl) linkedinEl.value = "";
  if (expertiseEl) expertiseEl.value = "";
  if (yearsEl) yearsEl.value = "";
  if (motivationEl) motivationEl.value = "";
  if (errorEl) errorEl.style.display = "none";

  showToast(
    "✅ Application submitted! Admins will review within 3-5 business days. Check back for updates.",
    "success",
  );

  // Redirect to dashboard after 2 seconds
  setTimeout(() => navigate("dashboard"), 2000);
}

// Ensure mentor applications are seeded from ADMIN_MENTOR_APPLICATIONS
function ensureMentorApplicationsSeeded() {
  const persistedApps =
    typeof loadPersistedMentorApplications === "function"
      ? loadPersistedMentorApplications()
      : Array.isArray(ADMIN_MENTOR_APPLICATIONS)
        ? ADMIN_MENTOR_APPLICATIONS
        : [];
  STATE.mentorApplications = Array.isArray(persistedApps)
    ? persistedApps.map((app) => ({ ...app }))
    : [];
  if (typeof savePersistedMentorApplications === "function") {
    savePersistedMentorApplications(STATE.mentorApplications);
  }
}

// Admin mentor filter management
function setAdminMentorFilter(filter) {
  ADMIN_MENTOR_UI_STATE.filter = filter;
  renderAdminMentorApps();
}

function toggleAdminMentorAppDetails(appId) {
  ADMIN_MENTOR_UI_STATE.expandedId =
    ADMIN_MENTOR_UI_STATE.expandedId === appId ? "" : appId;
  renderAdminMentorApps();
}

function getMentorApplicationsForFilter() {
  const source = Array.isArray(STATE.mentorApplications)
    ? STATE.mentorApplications
    : [];

  if (ADMIN_MENTOR_UI_STATE.filter === "all") return source;
  return source.filter((app) => app.status === ADMIN_MENTOR_UI_STATE.filter);
}

function getMentorStatusBadgeClass(status) {
  if (status === "approved") return "status-active";
  if (status === "rejected") return "status-rejected";
  return "status-pending";
}

function normalizeMentorApp(app, index) {
  const source = app || {};
  const name = String(source.name || "Unknown Applicant");
  const initials = String(source.initials || "")
    .trim()
    .toUpperCase();

  return {
    id: String(source.id || `mentor-app-${index + 1}`),
    name,
    initials:
      initials ||
      name
        .split(" ")
        .filter(Boolean)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    university: String(source.university || "Unknown University"),
    submittedAt: String(source.submittedAt || "Recently"),
    expertise: String(source.expertise || "General Mentorship"),
    specialization: String(
      source.specialization || source.expertise || "General",
    ),
    linkedin: String(source.linkedin || "#"),
    years: Number(source.years || 0),
    motivation: String(source.motivation || "No motivation provided."),
    status: String(source.status || "pending").toLowerCase(),
  };
}

function renderMentorApplicationCard(app) {
  const normalized = normalizeMentorApp(app, 0);
  const isExpanded =
    ADMIN_MENTOR_UI_STATE.expandedId === normalized.id ||
    (!ADMIN_MENTOR_UI_STATE.expandedId && normalized.status === "pending");
  const statusText = toTitleCase(normalized.status);
  const statusClass = getMentorStatusBadgeClass(normalized.status);
  const meetsCriteria = normalized.years >= 4;

  return `
    <div class="admin-mentor-card ${normalized.status === "pending" ? "pending" : ""}">
      <button class="admin-mentor-head" onclick="toggleAdminMentorAppDetails('${normalized.id}')">
        <div class="admin-mentor-left">
          <div class="admin-mentor-avatar">${escapeHtml(normalized.initials)}</div>
          <div>
            <div class="admin-mentor-name">${escapeHtml(normalized.name)}</div>
            <div class="admin-mentor-sub">${escapeHtml(normalized.university)} · Submitted ${escapeHtml(normalized.submittedAt)}</div>
          </div>
        </div>
        <div class="admin-mentor-right">
          <div class="admin-mentor-spec">${escapeHtml(normalized.specialization)}</div>
          <span class="status-badge ${statusClass}">${statusText}</span>
          <span class="admin-mentor-chevron">${isExpanded ? iconChevronUpSvg() : iconChevronDownSvg()}</span>
        </div>
      </button>

      <div class="admin-mentor-details${isExpanded ? " open" : ""}">
        <div class="admin-mentor-grid">
          <div>
            <div class="admin-mentor-label">Expertise</div>
            <div class="admin-mentor-value">${escapeHtml(normalized.expertise)}</div>
          </div>
          <div>
            <div class="admin-mentor-label">Experience</div>
            <div class="admin-mentor-value">
              ${normalized.years} years
              <span class="admin-mentor-criteria-pill ${meetsCriteria ? "pass" : "fail"}">
                <span class="admin-mentor-icon">${meetsCriteria ? iconCheckSvg() : iconXSvg()}</span>
                ${meetsCriteria ? "Meets criteria" : "Below criteria"}
              </span>
            </div>
          </div>
          <div>
            <div class="admin-mentor-label">LinkedIn</div>
            <a class="admin-mentor-link" href="${escapeHtml(normalized.linkedin)}" target="_blank" rel="noopener noreferrer">View Profile ↗</a>
          </div>
          <div>
            <div class="admin-mentor-label">University</div>
            <div class="admin-mentor-value">${escapeHtml(normalized.university)}</div>
          </div>
        </div>

        <div class="admin-mentor-label mt-3">Motivation</div>
        <blockquote class="admin-mentor-quote">"${escapeHtml(normalized.motivation)}"</blockquote>

        ${
          normalized.status === "pending"
            ? `
          <div class="admin-mentor-actions mt-3">
            <button class="btn btn-primary" onclick="approveApp('${normalized.id}')">Approve Application</button>
            <button class="btn btn-outline" onclick="rejectApp('${normalized.id}')">Reject</button>
          </div>
        `
            : ""
        }
      </div>
    </div>
  `;
}

function iconCheckSvg() {
  return '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.1 7.1a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4l3.3 3.3 6.4-6.4a1 1 0 0 1 1.4 0z" fill="currentColor"></path></svg>';
}

function iconXSvg() {
  return '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5.7 4.3 10 8.6l4.3-4.3a1 1 0 1 1 1.4 1.4L11.4 10l4.3 4.3a1 1 0 0 1-1.4 1.4L10 11.4l-4.3 4.3a1 1 0 0 1-1.4-1.4L8.6 10 4.3 5.7a1 1 0 1 1 1.4-1.4z" fill="currentColor"></path></svg>';
}

function iconChevronDownSvg() {
  return '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5.2 7.6a1 1 0 0 1 1.4 0L10 11l3.4-3.4a1 1 0 1 1 1.4 1.4l-4.1 4.1a1 1 0 0 1-1.4 0L5.2 9a1 1 0 0 1 0-1.4z" fill="currentColor"></path></svg>';
}

function iconChevronUpSvg() {
  return '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M14.8 12.4a1 1 0 0 1-1.4 0L10 9l-3.4 3.4a1 1 0 1 1-1.4-1.4l4.1-4.1a1 1 0 0 1 1.4 0l4.1 4.1a1 1 0 0 1 0 1.4z" fill="currentColor"></path></svg>';
}

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
// ══════════════════════════════════════════════
//   MENTORS
// ══════════════════════════════════════════════
const MENTOR_REQUESTS = [
  {
    project: "AI Study Planner",
    owner: "Arjun Sharma",
    skills: ["React", "ML"],
    members: 3,
    status: "Pending",
  },
  {
    project: "Code Review Hub",
    owner: "Vikram Nair",
    skills: ["Git API", "Node.js"],
    members: 2,
    status: "Pending",
  },
  {
    project: "EcoTracker",
    owner: "Ananya Reddy",
    skills: ["React", "API"],
    members: 5,
    status: "Accepted",
  },
];

function acceptMentorRequest(index) {
  const request = MENTOR_REQUESTS[index];
  if (!request) return;
  request.status = "Accepted";
  showToast(`Mentorship request accepted for ${request.project}`);
  renderMentorRequests();
  renderMentoredProjects();
}

function declineMentorRequest(index) {
  const request = MENTOR_REQUESTS[index];
  if (!request) return;
  request.status = "Declined";
  showToast(`Mentorship request declined for ${request.project}`);
  renderMentorRequests();
}

function renderMentors() {
  document.getElementById("mentors-grid").innerHTML = MENTORS_DATA.map(
    (m) => `
    <div class="card">
      <div class="flex items-center gap-3 mb-3">
        <div style="width:44px;height:44px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:.85rem">${m.initials}</div>
        <div>
          <div class="font-semibold text-sm">${m.name}</div>
          <div class="text-xs text-muted">${m.title} · ${m.uni}</div>
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px">
        ${m.skills.map((s) => `<span class="skill-tag">${s}</span>`).join("")}
      </div>
      <div class="flex gap-3 text-xs text-muted mb-3">
        <span>⚡ ${m.xp.toLocaleString()} XP</span>
        <span>⭐ ${m.rep} Rep</span>
      </div>
      <button class="btn btn-primary btn-sm btn-full" onclick="showToast('Mentor request sent to ${m.name}!')">Request Mentor</button>
    </div>
  `,
  ).join("");
}
// ══════════════════════════════════════════════
//   MENTOR REQUESTS (mentor role)
// ══════════════════════════════════════════════
function renderMentorRequests() {
  document.getElementById("mentor-requests-content").innerHTML = `
    <div class="space-y-3">
      ${MENTOR_REQUESTS.map(
        (r) => `
        <div class="pending-row">
          <div>
            <div class="font-semibold text-sm">${r.project}</div>
            <div class="text-xs text-muted">by ${r.owner} · 👥 ${r.members} members</div>
            <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:5px">
              ${r.skills.map((s) => `<span class="skill-tag">${s}</span>`).join("")}
            </div>
          </div>
          <div class="flex gap-2 items-center">
            ${
              r.status === "Pending"
                ? `
              <button class="btn btn-primary btn-sm" onclick="acceptMentorRequest(${MENTOR_REQUESTS.indexOf(r)})">Accept</button>
              <button class="btn btn-outline btn-sm" onclick="declineMentorRequest(${MENTOR_REQUESTS.indexOf(r)})">Decline</button>
            `
                : r.status === "Accepted"
                  ? `<span class="badge badge-success">Accepted</span>`
                  : `<span class="badge badge-danger">Declined</span>`
            }
          </div>
        </div>
      `,
      ).join("")}
    </div>
  `;
}

// ══════════════════════════════════════════════
//   MENTORED PROJECTS
// ══════════════════════════════════════════════
function renderMentoredProjects() {
  const mentored = PROJECTS.filter((_, i) => i === 2 || i === 4);
  document.getElementById("mentored-projects-grid").innerHTML = mentored
    .map((p) => projectCardHTML(p, "openWorkspace", "mentored-projects"))
    .join("");
  bindProjectCardClicks();
}
// ══════════════════════════════════════════════
//   PROJECTS
// ══════════════════════════════════════════════
function projectCardHTML(p, clickHandler = "openWorkspace", sourcePage = null) {
  const sourceArg = sourcePage ? `, '${sourcePage}'` : "";
  const dataSourceAttr = sourcePage ? ` data-source-page="${sourcePage}"` : "";
  const isOwnedByCurrentUser =
    typeof getCurrentUserName === "function" && p.owner === getCurrentUserName();
  return `<div class="project-card" data-project-id="${p.id}" data-open-handler="${clickHandler}"${dataSourceAttr} onclick="${clickHandler}('${p.id}'${sourceArg})">
    <h3 class="project-title">${p.name}</h3>
    <p class="project-desc">${p.desc}</p>
    ${
      isOwnedByCurrentUser
        ? '<div class="text-xs text-info" style="margin-top:8px;font-weight:600">You own this project</div>'
        : ""
    }
    <div class="project-skills">
      ${p.skills.map((skill) => `<span class="skill-badge">${skill}</span>`).join("")}
    </div>
    <div class="project-footer">
      <div class="progress-info">
        <span>${p.progress}% complete</span>
        <span class="collaborators">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          ${p.collaborators}
        </span>
      </div>
      <div class="progress-container">
        <div class="progress-fill" style="width: ${p.progress}%;"></div>
      </div>
    </div>
  </div>`;
}

function bindProjectCardClicks() {
  document
    .querySelectorAll(".project-card[data-project-id]")
    .forEach((card) => {
      const projectId = card.getAttribute("data-project-id");
      const sourcePage = card.getAttribute("data-source-page");
      const handlerName =
        card.getAttribute("data-open-handler") || "openWorkspace";
      const handler =
        typeof window[handlerName] === "function"
          ? window[handlerName]
          : openWorkspace;
      if (!projectId) return;
      card.onclick = () =>
        sourcePage ? handler(projectId, sourcePage) : handler(projectId);
    });
}

let projectCardDelegationBound = false;
function setupProjectCardDelegation() {
  if (projectCardDelegationBound) return;
  projectCardDelegationBound = true;

  document.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;

    const card = target.closest(".project-card[data-project-id]");
    if (!card) return;

    const projectId = card.getAttribute("data-project-id");
    const sourcePage = card.getAttribute("data-source-page");
    const handlerName =
      card.getAttribute("data-open-handler") || "openWorkspace";
    const handler =
      typeof window[handlerName] === "function"
        ? window[handlerName]
        : openWorkspace;
    if (!projectId) return;

    if (sourcePage) {
      handler(projectId, sourcePage);
    } else {
      handler(projectId);
    }
  });
}

function renderProjects() {
  setupProjectCardDelegation();
  const cardHandler =
    STATE.role === "collaborator"
      ? "openCollaboratorProjectPreview"
      : "openWorkspace";

  document.getElementById("proj-recommended-cards").innerHTML = PROJECTS.slice(
    0,
    2,
  )
    .map((p) => projectCardHTML(p, cardHandler, "projects"))
    .join("");
  document.getElementById("proj-all-cards").innerHTML = PROJECTS.slice(2)
    .map((p) => projectCardHTML(p, cardHandler, "projects"))
    .join("");
  bindProjectCardClicks();
}

function filterProjects() {
  setupProjectCardDelegation();
  const cardHandler =
    STATE.role === "collaborator"
      ? "openCollaboratorProjectPreview"
      : "openWorkspace";
  const projSearchInput = document.getElementById("proj-search");
  const q = String(projSearchInput?.value || "").toLowerCase().trim();
  const rec = document.getElementById("proj-recommended");
  const label = document.getElementById("proj-section-label");
  if (!q) {
    rec.style.display = "";
    label.textContent = "All Projects";
    document.getElementById("proj-all-cards").innerHTML = PROJECTS.slice(2)
      .map((p) => projectCardHTML(p, cardHandler))
      .join("");
    return;
  }
  rec.style.display = "none";
  const filtered = PROJECTS.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.desc.toLowerCase().includes(q) ||
      p.skills.some((s) => s.toLowerCase().includes(q)) ||
      p.owner.toLowerCase().includes(q),
  );
  label.textContent = `Results (${filtered.length})`;
  document.getElementById("proj-all-cards").innerHTML = filtered.length
    ? filtered.map((p) => projectCardHTML(p, cardHandler, "projects")).join("")
    : '<p class="text-sm text-muted italic">No projects match your search.</p>';
  bindProjectCardClicks();
}

// ══════════════════════════════════════════════
//   APPLIED PROJECTS
// ══════════════════════════════════════════════
function renderApplied() {
  document.getElementById("applied-list").innerHTML = APPLIED.map((a) => {
    const cls =
      a.status === "Approved"
        ? "badge-success"
        : a.status === "Pending"
          ? "badge-warning"
          : "badge-destructive";
    const badgeCls =
      a.status === "Rejected"
        ? "background:rgba(239,68,68,.1);color:var(--destructive)"
        : "";
    return `<div style="padding:12px 20px;border-bottom:1px solid var(--border);display:grid;grid-template-columns:2fr 1fr 1fr 1fr;align-items:center;font-size:.83rem">
      <span class="font-semibold">${a.project}</span>
      <span class="text-muted">${a.owner}</span>
      <span class="text-muted">${a.applied}</span>
      <span style="justify-self:start;display:inline-flex;">
        <span class="badge ${cls}" style="${badgeCls};width:auto;max-width:fit-content;">${a.status}</span>
      </span>
    </div>`;
  }).join("");
}

// ══════════════════════════════════════════════
//   MY PROJECTS (owner)
// ══════════════════════════════════════════════
function renderMyProjects() {
  STATE.ownedProjectsView = "my-projects";
  renderOwnedProjectsPanel("page-my-projects", false);
}

function renderOwnedProjectsPanel(targetPageId, showBackLink) {
  const root = document.getElementById(targetPageId);
  if (!root) return;

  const currentOwner = getCurrentUserName();
  const ownedProjects = PROJECTS.filter((p) => p.owner === currentOwner).map(
    (p) => {
      const progress = Number.isFinite(Number(p.progress))
        ? Number(p.progress)
        : 0;
      const totalTasks = Number.isFinite(Number(p.tasks)) ? Number(p.tasks) : 5;
      const completedTasks = Number.isFinite(Number(p.completedTasks))
        ? Number(p.completedTasks)
        : Math.round((progress / 100) * totalTasks);
      const isCompleted = Boolean(p.isCompleted) || progress >= 100;
      const members = Number.isFinite(Number(p.collaborators))
        ? Number(p.collaborators)
        : Array.isArray(p.members)
          ? p.members.length
          : 0;
      const totalXp = Number.isFinite(Number(p.totalXp))
        ? Number(p.totalXp)
        : completedTasks * 20;
      const repGained = Number.isFinite(Number(p.repGained))
        ? Number(p.repGained)
        : Math.round(totalXp / 25);

      return {
        ...p,
        progress,
        totalTasks,
        completedTasks,
        isCompleted,
        members,
        totalXp,
        repGained,
        duration: p.duration || "Ongoing",
        highlights:
          Array.isArray(p.highlights) && p.highlights.length
            ? p.highlights
            : isCompleted
              ? [
                  `All ${completedTasks}/${totalTasks} tasks completed`,
                  `${members} members collaborated successfully`,
                  "Project archived after successful completion",
                ]
              : [],
      };
    },
  );

  const activeProjects = ownedProjects.filter((p) => !p.isCompleted);
  const completedProjects = ownedProjects.filter((p) => p.isCompleted);
  const summaryProject = ownedProjects.find(
    (p) => p.id === STATE.summaryProjectId,
  );

  root.innerHTML = `
    <div style="max-width:980px;margin:0 auto;display:flex;flex-direction:column;gap:16px">
      ${
        showBackLink
          ? `
      <div class="component" onclick="navigate('my-projects')">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8.00065 12.6668L3.33398 8.00016L8.00065 3.3335" stroke="#78736D" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M12.6673 8H3.33398" stroke="#78736D" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <div class="text">Back to My Projects</div>
      </div>
      `
          : ""
      }

      <div>
        <h1>My Projects</h1>
        <p class="page-subtitle">Projects you own and manage.</p>
      </div>

      <div class="card">
        <div class="card-title">📂 Active (${activeProjects.length})</div>
        ${
          activeProjects.length
            ? activeProjects
                .map(
                  (p) => `
              <div class="project-card" style="margin-bottom:12px" onclick="openOwnedProject('${p.id}')">
                <h3 class="project-title">${p.name}</h3>
                <p class="project-desc">${p.completedTasks}/${p.totalTasks} tasks completed · ${p.members} members · ${p.duration}</p>
                <div class="progress-info"><span class="text-sm">Progress</span><span>${p.progress}%</span></div>
                <div class="progress-container"><div class="progress-fill" style="width:${p.progress}%"></div></div>
                <div class="project-skills" style="margin-top:10px">
                  ${(Array.isArray(p.skills) ? p.skills : []).map((s) => `<span class="skill-tag">${s}</span>`).join("")}
                </div>
              </div>
            `,
                )
                .join("")
            : '<p class="text-sm text-muted italic">No active owned projects yet.</p>'
        }
      </div>

      <div class="card">
        <div class="card-title">📦 Completed (${completedProjects.length})</div>
        ${
          completedProjects.length
            ? completedProjects
                .map(
                  (p) => `
              <div class="project-card" style="margin-bottom:12px;opacity:.95;cursor:default">
                <div class="flex items-center justify-between" style="margin-bottom:8px">
                  <div>
                    <h3 class="project-title">${p.name}</h3>
                    <p class="project-desc">${p.completedTasks}/${p.totalTasks} tasks · ${p.members} members · ${p.duration}</p>
                  </div>
                  <span class="badge badge-success">✅ Completed</span>
                </div>
                <div class="progress-container"><div class="progress-fill" style="width:100%"></div></div>
                <div class="project-skills" style="margin-top:10px">
                  ${(Array.isArray(p.skills) ? p.skills : []).map((s) => `<span class="skill-tag">${s}</span>`).join("")}
                </div>
                <div class="flex gap-2 mt-2">
                  <button class="btn btn-outline btn-sm" onclick="openOwnedSummary('${p.id}')">🏆 View Summary</button>
                  <button class="btn btn-ghost btn-sm" onclick="openOwnedProject('${p.id}')">↗ Workspace</button>
                </div>
                <div class="text-xs text-muted mt-2">🔒 Archived — workspace is read-only</div>
              </div>
            `,
                )
                .join("")
            : '<p class="text-sm text-muted italic">No completed projects yet.</p>'
        }
      </div>

      <div id="owned-summary-modal" class="modal-overlay ${summaryProject ? "open" : ""}" onclick="closeOwnedSummary(event)">
        <div class="modal" style="max-width:620px" onclick="event.stopPropagation()">
          ${
            summaryProject
              ? `
            <div class="modal-title" style="display:flex;align-items:center;justify-content:space-between">
              <span>🏆 Project Completed</span>
              <button class="btn btn-ghost btn-sm" onclick="closeOwnedSummary()">✕</button>
            </div>
            <p class="page-subtitle" style="margin-bottom:12px">Final summary for ${summaryProject.name}</p>

            <div class="stat-grid" style="margin:0 0 12px 0">
              <div class="stat-card"><div class="stat-label">XP Earned</div><div class="stat-value">+${summaryProject.totalXp}</div></div>
              <div class="stat-card"><div class="stat-label">Rep Gained</div><div class="stat-value">+${summaryProject.repGained}</div></div>
              <div class="stat-card"><div class="stat-label">Tasks Done</div><div class="stat-value">${summaryProject.completedTasks}/${summaryProject.totalTasks}</div></div>
            </div>

            <div class="card" style="padding:12px;margin-bottom:12px">
              <div class="progress-info"><span class="font-semibold">Task Completion</span><span class="text-success">100%</span></div>
              <div class="progress-container"><div class="progress-fill" style="width:100%"></div></div>
            </div>

            <div class="text-sm text-muted" style="margin-bottom:10px">⏱ ${summaryProject.duration} · 👥 ${summaryProject.members} members</div>

            <div class="card" style="padding:12px;margin-bottom:10px">
              <div class="font-semibold text-sm" style="margin-bottom:8px">Highlights</div>
              <ul>
                ${summaryProject.highlights.map((h) => `<li class="text-sm text-muted" style="margin-bottom:4px">✓ ${h}</li>`).join("")}
              </ul>
            </div>

            <div class="project-skills" style="margin-bottom:10px">
              ${(Array.isArray(summaryProject.skills) ? summaryProject.skills : []).map((s) => `<span class="skill-tag">${s}</span>`).join("")}
            </div>

            <div class="text-xs text-muted">🔒 This project is archived. The workspace is read-only.</div>
          `
              : ""
          }
        </div>
      </div>
    </div>
  `;
}

function getCurrentUserName() {
  const avatarName = document.querySelector(".avatar-name");
  const name = avatarName?.textContent?.trim();
  return name || "Project Owner";
}

function createProject() {
  if (STATE.role !== "project-owner") {
    showToast("Switch to Project Owner role to create projects", "error");
    return;
  }

  const titleInput = document.getElementById("create-project-title");
  const descInput = document.getElementById("create-project-desc");
  const objectivesInput = document.getElementById("create-project-objectives");
  const skillsInput = document.getElementById("create-project-skills");
  const durationInput = document.getElementById("create-project-duration");
  const maxCollaboratorsInput = document.getElementById(
    "create-project-collaborators",
  );
  const difficultyInput = document.getElementById("create-project-difficulty");

  if (
    !titleInput ||
    !descInput ||
    !objectivesInput ||
    !skillsInput ||
    !durationInput ||
    !maxCollaboratorsInput ||
    !difficultyInput
  ) {
    showToast("Create Project form is unavailable", "error");
    return;
  }

  const title = titleInput.value.trim();
  const desc = descInput.value.trim();
  const objectives = objectivesInput.value.trim();
  const skillCandidates = skillsInput.value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const skills = [
    ...new Set(skillCandidates.map((s) => s.replace(/\s+/g, " "))),
  ];
  const duration = durationInput.value.trim();
  const difficulty = difficultyInput.value.trim();
  const collaborators = Number.parseInt(maxCollaboratorsInput.value, 10);

  if (!title) {
    showToast("Project title is required");
    return;
  }
  if (title.length < 3 || title.length > 80) {
    showToast("Project title must be 3 to 80 characters");
    return;
  }
  if (!/[a-zA-Z0-9]/.test(title)) {
    showToast("Project title must include letters or numbers");
    return;
  }

  if (!desc) {
    showToast("Project description is required");
    return;
  }
  if (desc.length < 20 || desc.length > 800) {
    showToast("Description must be 20 to 800 characters");
    return;
  }

  if (!objectives) {
    showToast("Project objectives are required");
    return;
  }
  if (objectives.length < 10 || objectives.length > 500) {
    showToast("Objectives must be 10 to 500 characters");
    return;
  }

  if (skills.length === 0) {
    showToast("Add at least one required skill");
    return;
  }
  if (skills.length > 12) {
    showToast("Use up to 12 skills only");
    return;
  }
  if (skills.some((skill) => skill.length < 2 || skill.length > 40)) {
    showToast("Each skill must be 2 to 40 characters");
    return;
  }

  const allowedDurations = new Set([
    "1 month",
    "2 months",
    "3 months",
    "6 months",
  ]);
  if (!allowedDurations.has(duration)) {
    showToast("Select a valid project duration");
    return;
  }

  const allowedDifficulties = new Set(["Beginner", "Intermediate", "Advanced"]);
  if (!allowedDifficulties.has(difficulty)) {
    showToast("Select a valid project difficulty");
    return;
  }

  if (
    !Number.isFinite(collaborators) ||
    collaborators < 1 ||
    collaborators > 20
  ) {
    showToast("Max collaborators must be between 1 and 20");
    return;
  }

  const owner = getCurrentUserName();
  const createdProject = addProjectToData({
    name: title,
    desc,
    objectives,
    skills,
    duration,
    difficulty,
    collaborators,
    owner,
    members: [{ name: owner, role: "Owner" }],
  });

  titleInput.value = "";
  descInput.value = "";
  objectivesInput.value = "";
  skillsInput.value = "";
  durationInput.selectedIndex = 0;
  maxCollaboratorsInput.value = "5";
  difficultyInput.selectedIndex = 0;

  renderProjects();
  renderMyProjects();
  showToast(`Project \"${createdProject.name}\" created successfully!`);
  navigate("my-projects");
}

function openOwnedProject(projectId) {
  const project = PROJECTS.find((p) => p.id === projectId);
  if (!project) {
    showToast("Project not found", "error");
    return;
  }
  STATE.selectedProject = projectId;
  STATE.workspaceMode = "owned";
  STATE.ownedWorkspaceTab = "overview";
  STATE.summaryProjectId = null;
  STATE.workspaceBackPage = STATE.ownedProjectsView || "my-projects";
  navigate("project-workspace");
}

function renderOwnedProjectWorkspace() {
  const project = PROJECTS.find((p) => p.id === STATE.selectedProject);
  const root = document.getElementById("page-project-workspace");
  if (!root) return;

  if (!project) {
    root.innerHTML = '<div class="card">Project not found.</div>';
    return;
  }

  STATE.ownedProjectsView = "project-workspace";
  const tab = STATE.ownedWorkspaceTab || "overview";
  const data = getOwnedWorkspaceDataset(project);

  root.innerHTML = `
    <div style="max-width:980px;margin:0 auto;display:flex;flex-direction:column;gap:12px">
      <div class="component" onclick="navigate('my-projects')">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8.00065 12.6668L3.33398 8.00016L8.00065 3.3335" stroke="#78736D" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M12.6673 8H3.33398" stroke="#78736D" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <div class="text">Back</div>
      </div>

      <div class="card">
        <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap">
          <div style="flex:1;min-width:320px">
            <div class="flex items-center gap-2 mb-2">
              <h1>${project.name}</h1>
              <span class="badge badge-secondary">Owner</span>
            </div>
            <p class="text-muted" style="max-width:840px;line-height:1.45">${project.desc}</p>
            <div class="project-skills" style="margin-top:12px">
              ${(Array.isArray(project.skills) ? project.skills : []).map((s) => `<span class="skill-tag">${s}</span>`).join("")}
            </div>
            <p class="text-muted" style="margin-top:10px;font-size:.95rem">
              Owned by <span class="font-semibold" style="color:var(--fg)">${project.owner || "Unknown"}</span> · ${data.members.length} members
            </p>
          </div>
          <div style="min-width:260px">
            <div class="progress-info" style="margin-bottom:6px"><span>Progress</span><span class="font-bold" style="font-size:20 px;color:var(--fg)">${data.progress}%</span></div>
            <div class="progress-container" style="height:10px"><div class="progress-fill" style="width:${data.progress}%"></div></div>
            
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between" style="gap:10px;flex-wrap:wrap">
        <div class="tabs" style="margin-bottom:0">
          <button class="tab ${tab === "overview" ? "active" : ""}" onclick="setOwnedWorkspaceTab('overview')">Overview</button>
          <button class="tab ${tab === "tasks" ? "active" : ""}" onclick="setOwnedWorkspaceTab('tasks')">Tasks</button>
          <button class="tab ${tab === "members" ? "active" : ""}" onclick="setOwnedWorkspaceTab('members')">Members</button>
          <button class="tab ${tab === "mentors" ? "active" : ""}" onclick="setOwnedWorkspaceTab('mentors')">Mentors</button>
          <button class="tab ${tab === "chat" ? "active" : ""}" onclick="setOwnedWorkspaceTab('chat')">Chat</button>
        </div>
        <button class="btn btn-outline" onclick="requestOwnedMentor('${project.name}')">🛡️ Request Mentor</button>
      </div>

      ${renderOwnedWorkspaceTabContent(project, data, tab)}
    </div>
  `;
}

function setOwnedWorkspaceTab(tab) {
  STATE.ownedWorkspaceTab = tab;
  renderOwnedProjectWorkspace();
}

function requestOwnedMentor(projectName) {
  showToast(`Mentor request sent for ${projectName}`);
}

function sendOwnedChatMessage(projectName) {
  const input = document.getElementById("owned-chat-input");
  if (!input) return;
  const msg = input.value.trim();
  if (!msg) {
    showToast("Type a message first", "error");
    return;
  }
  if (msg.length > 500) {
    showToast("Message must be 500 characters or fewer", "error");
    return;
  }

  const project =
    PROJECTS.find((p) => p.id === STATE.selectedProject) ||
    PROJECTS.find((p) => p.name === projectName);
  if (!project) {
    showToast("Project not found", "error");
    return;
  }

  const data = getOwnedWorkspaceDataset(project);
  const chat = getOwnedWorkspaceChat(project, data);
  chat.push({
    sender: getCurrentUserName(),
    text: msg,
    time: formatCurrentTime(),
  });

  showToast(`Message sent in ${projectName}`);
  input.value = "";
  renderOwnedProjectWorkspace();
}

function openOwnedTaskModal() {
  STATE.ownedTaskModalOpen = true;
  renderOwnedProjectWorkspace();
}

function closeOwnedTaskModal(event) {
  if (event && event.target && event.target !== event.currentTarget) return;
  STATE.ownedTaskModalOpen = false;
  renderOwnedProjectWorkspace();
}

function getOwnedProjectRuntimeState(project, seedMembers, seedTasks) {
  if (!STATE.ownedProjectData || typeof STATE.ownedProjectData !== "object") {
    STATE.ownedProjectData = {};
  }

  const projectId = project.id;
  if (!STATE.ownedProjectData[projectId]) {
    STATE.ownedProjectData[projectId] = {
      members: seedMembers.map((m) => ({ ...m })),
      tasks: seedTasks.map((t) => ({ ...t })),
    };
  }

  const entry = STATE.ownedProjectData[projectId];
  if (!Array.isArray(entry.members) || !entry.members.length) {
    entry.members = seedMembers.map((m) => ({ ...m }));
  }
  if (!Array.isArray(entry.tasks) || !entry.tasks.length) {
    entry.tasks = seedTasks.map((t) => ({ ...t }));
  }

  return entry;
}

function inviteOwnedTaskMember() {
  const project = PROJECTS.find((p) => p.id === STATE.selectedProject);
  if (!project) {
    showToast("Project not found", "error");
    return;
  }

  const emailInput = document.getElementById("owned-task-invite-email");
  const assigneeSelect = document.getElementById("owned-task-assignee");
  if (!emailInput || !assigneeSelect) return;

  const email = emailInput.value.trim().toLowerCase();
  if (!email) {
    showToast("Email is required", "error");
    return;
  }
  if (email.length > 320 || !BASIC_EMAIL_RE.test(email)) {
    showToast("Enter a valid email address", "error");
    return;
  }

  const displayName = email
    .split("@")[0]
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .replace(/[._-]+/g, " ")
    .trim();
  const initials =
    displayName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "NM";

  const data = getOwnedWorkspaceDataset(project);
  const runtime = getOwnedProjectRuntimeState(
    project,
    data.members,
    data.tasks,
  );

  const duplicate = runtime.members.some(
    (m) => (m.email || "").toLowerCase() === email.toLowerCase(),
  );
  if (duplicate) {
    showToast("Member already invited", "error");
    return;
  }

  runtime.members.push({
    name: displayName || "New Member",
    role: "Collaborator",
    initials,
    email,
  });

  const option = document.createElement("option");
  option.value = displayName || email;
  option.textContent = `${displayName || email} (Invited)`;
  assigneeSelect.appendChild(option);
  assigneeSelect.value = option.value;

  emailInput.value = "";
  showToast(`Invite sent to ${email}`);
}

function createOwnedTask() {
  const project = PROJECTS.find((p) => p.id === STATE.selectedProject);
  if (!project) {
    showToast("Project not found", "error");
    return;
  }

  const taskNameInput = document.getElementById("owned-task-name");
  const taskDescInput = document.getElementById("owned-task-desc");
  const taskPriorityInput = document.getElementById("owned-task-priority");
  const taskDeadlineInput = document.getElementById("owned-task-deadline");
  const taskAssigneeInput = document.getElementById("owned-task-assignee");

  if (
    !taskNameInput ||
    !taskDescInput ||
    !taskPriorityInput ||
    !taskDeadlineInput ||
    !taskAssigneeInput
  ) {
    showToast("Task form is not available", "error");
    return;
  }

  const taskName = taskNameInput.value.trim();
  if (!taskName) {
    showToast("Task name is required", "error");
    return;
  }
  if (taskName.length < 3 || taskName.length > 100) {
    showToast("Task name must be 3 to 100 characters", "error");
    return;
  }
  if (!/[a-zA-Z0-9]/.test(taskName)) {
    showToast("Task name must include letters or numbers", "error");
    return;
  }

  const description = taskDescInput.value.trim();
  if (description.length > 500) {
    showToast("Task description must be 500 characters or fewer", "error");
    return;
  }

  const priority = taskPriorityInput.value || "Medium";
  const allowedPriorities = new Set(["Low", "Medium", "High"]);
  if (!allowedPriorities.has(priority)) {
    showToast("Choose a valid task priority", "error");
    return;
  }

  const dueInput = taskDeadlineInput.value.trim();
  if (dueInput.length > 60) {
    showToast("Deadline is too long", "error");
    return;
  }
  const due = dueInput || "No deadline";
  if (dueInput && Number.isNaN(Date.parse(dueInput))) {
    showToast("Enter a valid deadline date", "error");
    return;
  }

  const assignee = taskAssigneeInput.value.trim() || "Unassigned";
  const data = getOwnedWorkspaceDataset(project);
  const runtime = getOwnedProjectRuntimeState(
    project,
    data.members,
    data.tasks,
  );
  if (
    assignee !== "Unassigned" &&
    !runtime.members.some((member) => member.name === assignee)
  ) {
    showToast("Selected assignee is not in project members", "error");
    return;
  }

  runtime.tasks.unshift({
    title: taskName,
    status: "Open",
    assignee,
    due,
    priority,
    description,
  });

  STATE.ownedTaskModalOpen = false;
  showToast(`Task \"${taskName}\" created`);
  renderOwnedProjectWorkspace();
}

function getOwnedWorkspaceDataset(project) {
  const progress = Number.isFinite(Number(project.progress))
    ? Number(project.progress)
    : 0;
  const targetTasks = Number.isFinite(Number(project.tasks))
    ? Number(project.tasks)
    : 5;
  const fallbackCompleted = Number.isFinite(Number(project.completedTasks))
    ? Number(project.completedTasks)
    : Math.max(1, Math.round((progress / 100) * targetTasks));
  const fallbackInProgress = Math.max(
    0,
    Math.min(2, targetTasks - fallbackCompleted),
  );
  const fallbackInReview = Math.max(
    0,
    targetTasks - fallbackCompleted - fallbackInProgress > 0 ? 1 : 0,
  );

  const members =
    Array.isArray(project.members) && project.members.length
      ? project.members
      : [
          {
            name: project.owner || "Project Owner",
            role: "Owner",
            initials: "PO",
          },
        ];

  const mentors = (MENTORS_DATA || []).slice(0, 3).map((m) => ({
    name: m.name,
    title: m.title,
    expertise: (m.skills || []).slice(0, 2).join(", "),
  }));

  const tasks = [
    {
      title: "Design system setup",
      status: fallbackCompleted > 0 ? "Approved" : "Open",
      assignee: members[0]?.name || "Unassigned",
      due: "Mar 28",
    },
    {
      title: "API integration",
      status: fallbackInReview > 0 ? "In Review" : "Open",
      assignee: members[1]?.name || members[0]?.name || "Unassigned",
      due: "Apr 02",
    },
    {
      title: "Task board automation",
      status: fallbackInProgress > 0 ? "In Progress" : "Open",
      assignee: members[2]?.name || members[0]?.name || "Unassigned",
      due: "Apr 05",
    },
    {
      title: "QA and deployment",
      status: "Open",
      assignee: "Unassigned",
      due: "Apr 10",
    },
    {
      title: "Documentation",
      status: fallbackCompleted > 1 ? "Approved" : "Open",
      assignee: members[0]?.name || "Unassigned",
      due: "Apr 12",
    },
  ].slice(0, targetTasks);

  const runtime = getOwnedProjectRuntimeState(project, members, tasks);
  const runtimeTasks = runtime.tasks;
  const runtimeMembers = runtime.members;

  const totalTasks = runtimeTasks.length;
  const completed = runtimeTasks.filter((t) => t.status === "Approved").length;
  const inProgress = runtimeTasks.filter(
    (t) => t.status === "In Progress",
  ).length;
  const inReview = runtimeTasks.filter((t) => t.status === "In Review").length;
  const open = Math.max(0, totalTasks - completed - inProgress - inReview);

  return {
    progress,
    totalTasks,
    completed,
    inProgress,
    inReview,
    open,
    members: runtimeMembers,
    mentors,
    tasks: runtimeTasks,
  };
}

function renderOwnedWorkspaceTabContent(project, data, tab) {
  if (tab === "tasks") {
    return `
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;flex-wrap:wrap">
          <div class="card-title" style="margin:0">Task Management</div>
          <button class="btn btn-primary" onclick="openOwnedTaskModal()">＋ Create Task</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Task</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Assignee</th>
              <th>Due</th>
            </tr>
          </thead>
          <tbody>
            ${data.tasks
              .map(
                (t) => `
              <tr>
                <td>${t.title}</td>
                <td>
                  <span class="badge ${
                    t.status === "Approved"
                      ? "badge-success"
                      : t.status === "In Review"
                        ? "badge-warning"
                        : t.status === "In Progress"
                          ? "badge-info"
                          : "badge-secondary"
                  }">${t.status}</span>
                </td>
                <td>${t.priority || "Medium"}</td>
                <td>${t.assignee}</td>
                <td>${t.due}</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      </div>

      <div id="owned-task-modal" class="modal-overlay ${STATE.ownedTaskModalOpen ? "open" : ""}" onclick="closeOwnedTaskModal(event)">
        <div class="modal" style="max-width:620px" onclick="event.stopPropagation()">
          <div class="modal-title" style="display:flex;align-items:center;justify-content:space-between">
            <span>Create New Task</span>
            <button class="btn btn-ghost btn-sm" onclick="closeOwnedTaskModal()">✕</button>
          </div>
          <p class="page-subtitle" style="margin-bottom:12px">Add a new task to the project.</p>

          <div class="space-y-3">
            <input id="owned-task-name" class="input" placeholder="Task name">
            <textarea id="owned-task-desc" class="input" placeholder="Description (optional)" rows="4" style="resize:vertical"></textarea>

            <div class="flex gap-2" style="flex-wrap:wrap">
              <select id="owned-task-priority" class="input" style="flex:1;min-width:170px">
                <option>Low</option>
                <option selected>Medium</option>
                <option>High</option>
              </select>
              <input id="owned-task-deadline" class="input" placeholder="Deadline (e.g. Mar 30)" style="flex:1;min-width:220px">
            </div>

            <div style="padding-top:4px;border-top:1px solid var(--border)">
              <div class="font-semibold text-sm" style="margin:8px 0">Assign to Member</div>
              <select id="owned-task-assignee" class="input">
                <option value="">Assign to (optional)</option>
                ${data.members
                  .map(
                    (m) =>
                      `<option value="${m.name}">${m.name}${m.role ? ` (${m.role})` : ""}</option>`,
                  )
                  .join("")}
              </select>
            </div>

            <div>
              <div class="font-semibold text-sm" style="margin:8px 0">Or Invite New Member via Email</div>
              <div class="flex gap-2">
                <input id="owned-task-invite-email" class="input" placeholder="colleague@example.com" style="flex:1">
                <button class="btn btn-outline" onclick="inviteOwnedTaskMember()">Invite</button>
              </div>
            </div>
          </div>

          <button class="btn btn-primary btn-full" style="margin-top:14px" onclick="createOwnedTask()">Create Task</button>
        </div>
      </div>
    `;
  }

  if (tab === "members") {
    return `
      <div class="card">
        <div class="card-title">Members</div>
        <div class="space-y-3">
          ${data.members
            .map(
              (m) => `
            <div class="pending-row">
              <div class="flex items-center gap-3">
                <div class="div-h"><div class="text-wrapper-5">${m.initials || "??"}</div></div>
                <div>
                  <div class="font-semibold text-sm">${m.name}</div>
                  <div class="text-xs text-muted">${m.role || "Collaborator"}</div>
                </div>
              </div>
              <button class="btn btn-outline btn-sm" onclick="showToast('Viewing ${m.name}')">View</button>
            </div>
          `,
            )
            .join("")}
        </div>
      </div>
    `;
  }

  if (tab === "mentors") {
    return `
      <div class="card">
        <div class="card-title">Mentors</div>
        ${
          data.mentors.length
            ? `
          <div class="space-y-3">
            ${data.mentors
              .map(
                (m) => `
              <div class="pending-row">
                <div>
                  <div class="font-semibold text-sm">${m.name}</div>
                  <div class="text-xs text-muted">${m.title} · ${m.expertise}</div>
                </div>
                <button class="btn btn-outline btn-sm" onclick="showToast('Mentor ${m.name} assigned')">Assign</button>
              </div>
            `,
              )
              .join("")}
          </div>
        `
            : '<p class="text-sm text-muted italic">No mentors connected yet.</p>'
        }
      </div>
    `;
  }

  if (tab === "chat") {
    const chatMessages = getOwnedWorkspaceChat(project, data);
    return `
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:10px">
          <div class="card-title" style="margin:0">Team Chat</div>
          <div style="display:flex;align-items:center;gap:8px;color:var(--muted-fg);font-size:.82rem">
            <span style="display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:999px;background:var(--secondary);border:1px solid var(--border)">● Live</span>
            <span>${chatMessages.length} message${chatMessages.length === 1 ? "" : "s"}</span>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;max-height:280px;overflow:auto;padding-right:4px">
          ${chatMessages
            .map((msg) => {
              const mine = msg.sender === getCurrentUserName();
              return `
              <div style="align-self:${mine ? "flex-end" : "flex-start"};max-width:74%;padding:10px 12px;border-radius:12px;background:${mine ? "var(--secondary)" : "var(--card-bg)"};border:1px solid var(--border)">
                <div style="font-size:0.75rem;color:var(--muted-fg);margin-bottom:4px">${escapeHtml(msg.sender)} · ${escapeHtml(msg.time || "")}</div>
                <div style="font-size:0.92rem;line-height:1.4">${escapeHtml(msg.text)}</div>
              </div>
            `;
            })
            .join("")}
        </div>
        <div class="flex gap-2">
          <input id="owned-chat-input" class="input" placeholder="Type a message..." style="flex:1" onkeydown="if(event.key==='Enter'){event.preventDefault();sendOwnedChatMessage('${project.name.replace(/'/g, "\\'")}')}" />
          <button class="btn btn-primary" onclick="sendOwnedChatMessage('${project.name.replace(/'/g, "\\'")}')">Send</button>
        </div>
        <div style="margin-top:8px;font-size:.78rem;color:var(--muted-fg)">Press Enter to send quickly.</div>
      </div>
    `;
  }

  return `
    <div class="stat-grid" style="margin-top:0">
      <div class="stat-card"><div class="stat-value">${data.totalTasks}</div><div class="stat-label">Total Tasks</div></div>
      <div class="stat-card"><div class="stat-value text-success">${data.completed}</div><div class="stat-label">Completed</div></div>
      <div class="stat-card"><div class="stat-value text-info">${data.inProgress}</div><div class="stat-label">In Progress</div></div>
      <div class="stat-card"><div class="stat-value text-accent">${Math.max(0, data.members.length - 1)}</div><div class="stat-label">Active Collaborators</div></div>
    </div>
    <div class="card" style="padding:16px">
      <div class="card-title" style="margin-bottom:10px">Task Completion Statistics</div>
      <div class="space-y-3">
        <div class="checkin-row"><span class="badge badge-success">Approved</span><div style="flex:1;margin:0 10px" class="progress-container"><div class="progress-fill" style="width:${Math.min(100, (data.completed / Math.max(1, data.totalTasks)) * 100)}%"></div></div><span>${data.completed}</span></div>
        <div class="checkin-row"><span class="badge badge-warning">In Review</span><div style="flex:1;margin:0 10px" class="progress-container"><div class="progress-fill" style="width:${Math.min(100, (data.inReview / Math.max(1, data.totalTasks)) * 100)}%"></div></div><span>${data.inReview}</span></div>
        <div class="checkin-row"><span class="badge badge-info">In Progress</span><div style="flex:1;margin:0 10px" class="progress-container"><div class="progress-fill" style="width:${Math.min(100, (data.inProgress / Math.max(1, data.totalTasks)) * 100)}%"></div></div><span>${data.inProgress}</span></div>
        <div class="checkin-row"><span class="badge badge-secondary">Open</span><div style="flex:1;margin:0 10px" class="progress-container"><div class="progress-fill" style="width:${Math.min(100, (data.open / Math.max(1, data.totalTasks)) * 100)}%"></div></div><span>${data.open}</span></div>
      </div>
    </div>
  `;
}

function openOwnedSummary(projectId) {
  STATE.summaryProjectId = projectId;
  if (STATE.ownedProjectsView === "my-projects") {
    renderMyProjects();
    return;
  }
  renderOwnedProjectWorkspace();
}

function closeOwnedSummary(event) {
  if (event && event.target && event.target !== event.currentTarget) return;
  STATE.summaryProjectId = null;
  if (STATE.ownedProjectsView === "my-projects") {
    renderMyProjects();
    return;
  }
  renderOwnedProjectWorkspace();
}

function openWorkspace(projectId, sourcePage) {
  const project = PROJECTS.find((p) => p.id === projectId);
  if (!project) {
    showToast("Project not found", "error");
    return;
  }

  const activePage =
    sourcePage ||
    document.querySelector(".page.active")?.id?.replace("page-", "") ||
    "projects";

  STATE.selectedProject = projectId;
  STATE.workspaceMode = "collaborator";
  STATE.collaboratorWorkspaceTab = "overview";
  STATE.workspaceBackPage =
    activePage === "project-workspace" ? "my-work" : activePage;
  navigate("project-workspace");
}

function openCollaboratorProjectPreview(projectId) {
  const project = PROJECTS.find((p) => p.id === projectId);
  if (!project) {
    showToast("Project not found", "error");
    return;
  }

  STATE.selectedProject = projectId;
  STATE.workspaceMode = "collaborator-project-preview";
  STATE.workspaceBackPage = "projects";
  navigate("project-workspace");
}

function applyToPreviewProject(projectId) {
  const project = PROJECTS.find((p) => p.id === projectId);
  if (!project) {
    showToast("Project not found", "error");
    return;
  }

  const currentUser = getCurrentUserName();
  if (project.owner === currentUser) {
    showToast("You already own this project", "error");
    return;
  }

  const alreadyApplied = APPLIED.some((a) => a.project === project.name);
  if (alreadyApplied) {
    showToast("You already applied to this project", "error");
    return;
  }

  APPLIED.unshift({
    project: project.name,
    owner: project.owner,
    applied: new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    status: "Pending",
  });

  renderApplied();
  showToast(`Application sent for ${project.name}`);
}

function renderCollaboratorProjectPreview() {
  const project = PROJECTS.find((p) => p.id === STATE.selectedProject);
  const root = document.getElementById("page-project-workspace");
  if (!root) return;

  if (!project) {
    root.innerHTML = '<div class="card">Project not found.</div>';
    return;
  }

  const members = Array.isArray(project.members) ? project.members : [];
  const progress = Number.isFinite(Number(project.progress))
    ? Number(project.progress)
    : 0;
  const alreadyApplied = APPLIED.some((a) => a.project === project.name);
  const isOwner = project.owner === getCurrentUserName();

  const applyLabel = isOwner
    ? "You Own This Project"
    : alreadyApplied
      ? "Applied"
      : "Apply to Join Project";

  root.innerHTML = `
    <div style="max-width:1120px;margin:0 auto;display:flex;flex-direction:column;gap:16px">
      <div class="component" onclick="navigate('projects')">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8.00065 12.6668L3.33398 8.00016L8.00065 3.3335" stroke="#78736D" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M12.6673 8H3.33398" stroke="#78736D" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <div class="text">Back to Projects</div>
      </div>

      <div class="card" style="padding:18px;border:1px solid var(--border)">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
          <div style="flex:1;min-width:320px">
            <h1 style="margin:0 0 6px 0;font-size:2.6rem;line-height:1.2">${project.name}</h1>
            <p class="text-muted" style="font-size:0.95rem;margin-bottom:10px">Owned by <span class="font-semibold" style="color:var(--fg)">${project.owner}</span></p>
            <p class="text-muted" style="font-size:0.95rem;line-height:1.45;margin-bottom:12px;max-width:700px">${project.desc}</p>
            <div class="project-skills" style="margin-bottom:10px">
              ${(Array.isArray(project.skills) ? project.skills : []).map((s) => `<span class="skill-tag">${s}</span>`).join("")}
            </div>
          </div>
        </div>

        <div style="margin:4px 0 12px 0;height:1px;background:var(--border)"></div>

        <div style="display:grid;grid-template-columns:minmax(240px,1fr) minmax(300px,1fr);gap:18px;align-items:flex-start">
          <div>
            <div style="font-size:1.1rem;font-weight:700;margin-bottom:8px">Project Progress</div>
            <div style="display:flex;align-items:center;gap:14px">
              <span style="font-size:1.8rem;font-weight:700">${progress}%</span>
              <div class="progress-container" style="height:8px;max-width:280px;width:100%">
                <div class="progress-fill" style="width:${progress}%"></div>
              </div>
            </div>
          </div>

          <div>
            <div style="font-size:1.1rem;font-weight:700;margin-bottom:8px">Team Members (${members.length})</div>
            <div style="display:flex;flex-direction:column;gap:0">
              ${members
                .map(
                  (m) => `
                <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
                  <div style="width:34px;height:34px;border-radius:50%;background:#8b5e34;color:#fff;font-size:0.9rem;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">${m.initials}</div>
                  <div style="font-size:1.05rem;font-weight:600">${m.name}</div>
                  <div style="font-size:0.95rem;color:var(--muted-fg)">· ${m.role}</div>
                </div>
              `,
                )
                .join("")}
            </div>
          </div>
        </div>

        <button
          class="btn btn-primary"
          ${isOwner || alreadyApplied ? "disabled" : ""}
          onclick="applyToPreviewProject('${project.id}')"
          style="margin-top:14px;width:100%;height:44px;border-radius:10px;background:#6a5a47;border-color:#6a5a47;font-size:1rem"
        >
          ${applyLabel}
        </button>
      </div>
    </div>
  `;
}

function setCollaboratorWorkspaceTab(tab) {
  STATE.collaboratorWorkspaceTab = tab;
  renderProjectWorkspace();
}

function getCollaboratorWorkspaceData(project) {
  const currentUser = getCurrentUserName();
  const projectKey = String(project.id);

  if (!STATE.collaboratorWorkspaceData) {
    STATE.collaboratorWorkspaceData = {};
  }

  if (STATE.collaboratorWorkspaceData[projectKey]) {
    return STATE.collaboratorWorkspaceData[projectKey];
  }

  const primaryMember =
    (Array.isArray(project.members) ? project.members : []).find(
      (m) => m.name !== currentUser,
    )?.name || "Team Member";
  const secondaryMember =
    (Array.isArray(project.members) ? project.members : []).find(
      (m) => m.name !== currentUser && m.name !== primaryMember,
    )?.name || "Unassigned";

  const seededTasks = [
    {
      title: "Set up project structure",
      difficulty: "Easy",
      assigned: `${currentUser} (owner) (you)`,
      deadline: "Mar 10",
      status: "Approved",
      action: "Approved",
    },
    {
      title: "Build authentication module",
      difficulty: "Medium",
      assigned: primaryMember,
      deadline: "Mar 15",
      status: "In Progress",
      action: "In Progress",
    },
    {
      title: "Design dashboard UI",
      difficulty: "Medium",
      assigned: secondaryMember,
      deadline: "Mar 18",
      status: "In Review",
      action: "In Review",
    },
    {
      title: "Implement API integration",
      difficulty: "Hard",
      assigned: `${currentUser} (owner) (you)`,
      deadline: "Mar 22",
      status: "Open",
      action: "Start Work",
    },
    {
      title: "Write unit tests",
      difficulty: "Easy",
      assigned: "Unassigned",
      deadline: "Mar 25",
      status: "Open",
      action: "Open",
    },
  ];

  const seededMessages = [
    {
      sender: project.owner,
      text: `Let's keep momentum on ${project.name}.`,
      time: "10:10 AM",
    },
    {
      sender: currentUser,
      text: "I will pick up API integration next.",
      time: "10:14 AM",
    },
  ];

  STATE.collaboratorWorkspaceData[projectKey] = {
    tasks: seededTasks,
    messages: seededMessages,
  };

  return STATE.collaboratorWorkspaceData[projectKey];
}

function collaboratorDifficultyPill(level) {
  if (level === "Hard") {
    return '<span class="badge badge-destructive" style="background:rgba(239,68,68,.1);color:var(--destructive)">Hard</span>';
  }
  if (level === "Medium") {
    return '<span class="badge badge-warning" style="background:rgba(245,158,11,.12);color:#e8a414">Medium</span>';
  }
  return '<span class="badge badge-success" style="background:rgba(34,197,94,.12);color:var(--success)">Easy</span>';
}

function collaboratorStatusPill(status) {
  if (status === "Approved") {
    return '<span class="badge badge-success" style="background:rgba(34,197,94,.12);color:var(--success)">Approved</span>';
  }
  if (status === "In Progress") {
    return '<span class="badge badge-info" style="background:rgba(59,130,246,.12);color:#3569c6">In Progress</span>';
  }
  if (status === "In Review") {
    return '<span class="badge badge-warning" style="background:rgba(245,158,11,.12);color:#e8a414">In Review</span>';
  }
  return '<span class="badge badge-secondary">Open</span>';
}

function startCollaboratorTask(taskIndex) {
  const project = PROJECTS.find((p) => p.id === STATE.selectedProject);
  if (!project) return;

  const data = getCollaboratorWorkspaceData(project);
  const idx = Number(taskIndex);
  if (!Number.isInteger(idx) || idx < 0 || idx >= data.tasks.length) return;

  data.tasks[idx].status = "In Progress";
  data.tasks[idx].action = "Submit";
  showToast(`Started: ${data.tasks[idx].title}`);
  STATE.collaboratorWorkspaceTab = "tasks";
  renderProjectWorkspace();
}

function openCollaboratorSubmitModal(taskIndex) {
  const project = PROJECTS.find((p) => p.id === STATE.selectedProject);
  if (!project) return;

  const data = getCollaboratorWorkspaceData(project);
  const idx = Number(taskIndex);
  if (!Number.isInteger(idx) || idx < 0 || idx >= data.tasks.length) return;

  STATE.collaboratorProofModalOpen = true;
  STATE.collaboratorProofTaskIndex = idx;
  STATE.collaboratorProofLink = "";
  renderProjectWorkspace();
}

function closeCollaboratorSubmitModal(e) {
  if (e && e.target && e.currentTarget && e.target !== e.currentTarget) return;
  STATE.collaboratorProofModalOpen = false;
  STATE.collaboratorProofTaskIndex = null;
  STATE.collaboratorProofLink = "";
  renderProjectWorkspace();
}

function updateCollaboratorProofLink(value) {
  STATE.collaboratorProofLink = value;
}

function submitCollaboratorProof() {
  const project = PROJECTS.find((p) => p.id === STATE.selectedProject);
  if (!project) return;

  const data = getCollaboratorWorkspaceData(project);
  const idx = Number(STATE.collaboratorProofTaskIndex);
  if (!Number.isInteger(idx) || idx < 0 || idx >= data.tasks.length) {
    showToast("Task not found", "error");
    return;
  }

  const input = document.getElementById("collab-proof-link");
  const proofLink = (input?.value || STATE.collaboratorProofLink || "").trim();
  if (!proofLink) {
    showToast("Proof link is required", "error");
    return;
  }
  if (!isValidWebUrl(proofLink)) {
    showToast("Please enter a valid proof link", "error");
    return;
  }

  data.tasks[idx].proofLink = proofLink;
  data.tasks[idx].status = "In Review";
  data.tasks[idx].action = "In Review";

  STATE.collaboratorProofModalOpen = false;
  STATE.collaboratorProofTaskIndex = null;
  STATE.collaboratorProofLink = "";

  showToast(`Submitted for review: ${data.tasks[idx].title}`);
  renderProjectWorkspace();
}

function sendCollaboratorChatMessage() {
  const project = PROJECTS.find((p) => p.id === STATE.selectedProject);
  if (!project) return;

  const input = document.getElementById("collab-chat-input");
  const text = input?.value?.trim();
  if (!text) {
    showToast("Type a message first", "error");
    return;
  }
  if (text.length > 500) {
    showToast("Message must be 500 characters or fewer", "error");
    return;
  }

  const data = getCollaboratorWorkspaceData(project);
  const now = new Date();
  const hh = String(now.getHours() % 12 || 12).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ampm = now.getHours() >= 12 ? "PM" : "AM";

  data.messages.push({
    sender: getCurrentUserName(),
    text,
    time: `${hh}:${mm} ${ampm}`,
  });

  input.value = "";
  renderProjectWorkspace();
}

function getMyWorkCompletedSummary(project) {
  const reportSource =
    typeof PROJECT_REPORTS !== "undefined" && PROJECT_REPORTS
      ? PROJECT_REPORTS[project.name]
      : null;

  const fallbackTotal = Number.isFinite(Number(project.totalTasks))
    ? Number(project.totalTasks)
    : 3;
  const totalTasks = Number.isFinite(Number(reportSource?.totalTasks))
    ? Number(reportSource.totalTasks)
    : fallbackTotal;

  const fallbackCompleted = Number.isFinite(Number(project.completedTasks))
    ? Number(project.completedTasks)
    : Math.min(
        totalTasks,
        Math.max(
          1,
          Math.round(((Number(project.progress) || 100) / 100) * totalTasks),
        ),
      );
  const tasksCompleted = Number.isFinite(Number(reportSource?.tasksCompleted))
    ? Number(reportSource.tasksCompleted)
    : fallbackCompleted;

  const xpEarned = Number.isFinite(Number(reportSource?.xpEarned))
    ? Number(reportSource.xpEarned)
    : Math.max(60, tasksCompleted * 40);
  const repGained = Number.isFinite(Number(reportSource?.repGained))
    ? Number(reportSource.repGained)
    : Math.max(4, Math.round(xpEarned / 15));

  const contribution =
    typeof reportSource?.contribution === "string" &&
    reportSource.contribution.trim()
      ? reportSource.contribution.trim()
      : `Contributed key features and delivery support for ${project.name}.`;

  const completedOn =
    typeof reportSource?.duration === "string" &&
    reportSource.duration.includes("–")
      ? `Completed ${reportSource.duration.split("–").pop().trim()}`
      : "Completed Feb 2026";

  return {
    xpEarned,
    repGained,
    totalTasks,
    tasksCompleted,
    contribution,
    completedOn,
  };
}

// ══════════════════════════════════════════
//   MY WORK (COLLABORATOR)
// ══════════════════════════════════════════
function syncApprovedAppliedToProjectMembers() {
  const currentUser = getCurrentUserName();

  APPLIED.filter(
    (a) => a.status === "Approved" && a.project && a.owner !== currentUser,
  ).forEach((app) => {
    const project = PROJECTS.find((p) => p.name === app.project);
    if (!project) return;

    const hasMember = Array.isArray(project.members)
      ? project.members.some((m) => m.name === currentUser)
      : false;
    if (project.owner === currentUser) return;

    if (!hasMember) {
      const initials = getInitialsFromName(currentUser);
      project.members = project.members || [];
      project.members.push({
        name: currentUser,
        initials,
        role: "Collaborator",
      });
      project.collaborators = project.members.length;
    }
  });
}

function renderMyWork() {
  const root = document.getElementById("my-work-content");
  if (!root) return;

  const currentUser = getCurrentUserName();

  syncApprovedAppliedToProjectMembers();

  // Only include projects that are
  // approved in the Applied list (model-level consistency).
  const approvedAppliedProjectNames = new Set(
    APPLIED.filter((a) => a.status === "Approved" && a.project).map(
      (a) => a.project,
    ),
  );

  const approvedAppliedProjects = PROJECTS.filter((p) =>
    approvedAppliedProjectNames.has(p.name),
  );

  const memberCollaborativeProjects = PROJECTS.filter(
    (p) =>
      p.owner !== currentUser &&
      Array.isArray(p.members) &&
      p.members.some((m) => m.name === currentUser),
  );

  const collaborativeProjects = [...approvedAppliedProjects];
  memberCollaborativeProjects.forEach((p) => {
    if (!collaborativeProjects.some((x) => x.id === p.id)) {
      collaborativeProjects.push(p);
    }
  });

  const activeProjects = collaborativeProjects.filter((p) => !p.isCompleted);
  const completedProjects = collaborativeProjects.filter((p) => p.isCompleted);

  const activeHTML = activeProjects
    .map((p) => {
      const userRole =
        p.members.find((m) => m.name === currentUser)?.role || "Collaborator";
      const assignedTasks = [
        {
          title: "Build event listing page",
          assigned: currentUser,
          difficulty: "Medium",
          due: "Mar 12",
          status: "In Review",
        },
        {
          title: "RSVP functionality",
          assigned: "Priya Patel",
          difficulty: "Hard",
          due: "Mar 20",
          status: "Open",
        },
        {
          title: "Push notification service",
          assigned: "Ananya Reddy",
          difficulty: "Hard",
          due: "Mar 25",
          status: "In Progress",
        },
        {
          title: "Map integration",
          assigned: "Unassigned",
          difficulty: "Medium",
          due: "Mar 28",
          status: "Open",
        },
      ];
      const userTasks = assignedTasks.filter((t) => t.assigned === currentUser);
      const progress = p.progress || 60;

      return `
        <div class="card mt-3" style="border:1px solid var(--border)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:10px">
            <div>
              <div style="font-size:1.2rem;font-weight:700;margin-bottom:2px">${p.name}</div>
              <div style="font-size:0.85rem;color:var(--muted-fg)">owned by ${p.owner}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:0.95rem;font-weight:600;margin-bottom:2px;color:var(--muted-fg)">${userTasks.length} task${userTasks.length !== 1 ? "s" : ""} assigned to you</div>
              <div style="font-size:0.85rem;color:var(--muted-fg)">${progress}%</div>
            </div>
            <button class="btn btn-outline" onclick="openWorkspace('${p.id}')">Open Workspace</button>
          </div>
          <div class="progress-container" style="height:8px;margin-bottom:16px;"><div class="progress-fill" style="width:${progress}%"></div></div>

          <div style="display:flex;gap:10px;margin-bottom:12px;border-bottom:1px solid var(--border);padding-bottom:10px">
            <span style="font-size:0.85rem;font-weight:600;color:var(--fg)">ALL TASKS</span>
            <span style="font-size:0.8rem;color:var(--muted-fg)">You can only act on tasks assigned to you</span>
          </div>

          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="border-bottom:1px solid var(--border)">
                <th style="text-align:left;padding:8px 0;font-size:0.8rem;font-weight:600;color:var(--muted-fg)">Task</th>
                <th style="text-align:left;padding:8px 0;font-size:0.8rem;font-weight:600;color:var(--muted-fg)">Assigned To</th>
                <th style="text-align:left;padding:8px 0;font-size:0.8rem;font-weight:600;color:var(--muted-fg)">Difficulty</th>
                <th style="text-align:left;padding:8px 0;font-size:0.8rem;font-weight:600;color:var(--muted-fg)">Deadline</th>
                <th style="text-align:left;padding:8px 0;font-size:0.8rem;font-weight:600;color:var(--muted-fg)">Status</th>
                <th style="text-align:left;padding:8px 0;font-size:0.8rem;font-weight:600;color:var(--muted-fg)">Action</th>
              </tr>
            </thead>
            <tbody>
              ${assignedTasks
                .map(
                  (t) => `
                <tr style="border-bottom:1px solid var(--border);">
                  <td style="padding:10px 0;font-size:0.9rem;font-weight:${t.assigned === currentUser ? "600" : "400"}">${t.title} ${t.assigned === currentUser ? '<span style="font-size:0.75rem;color:var(--muted-fg)">(you)</span>' : ""}</td>
                  <td style="padding:10px 0;font-size:0.9rem;color:var(--muted-fg)">${t.assigned}</td>
                  <td style="padding:10px 0">
                    <span class="badge ${t.difficulty === "Hard" ? "badge-destructive" : t.difficulty === "Medium" ? "badge-warning" : "badge-secondary"}" style="${t.difficulty === "Hard" ? "background:rgba(239,68,68,.1);color:var(--destructive);" : ""}">${t.difficulty}</span>
                  </td>
                  <td style="padding:10px 0;font-size:0.9rem;color:var(--muted-fg)">${t.due}</td>
                  <td style="padding:10px 0">
                    <span class="badge ${t.status === "In Review" ? "badge-warning" : t.status === "In Progress" ? "badge-info" : "badge-secondary"}">${t.status}</span>
                  </td>
                  <td style="padding:10px 0;font-size:0.9rem;color:var(--muted-fg)">${t.assigned === currentUser ? "Awaiting review" : "—"}</td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>
        </div>
      `;
    })
    .join("");

  const completedHTML = completedProjects
    .map((p) => {
      const summary = getMyWorkCompletedSummary(p);
      return `
        <div class="card mt-3" style="border:1px solid var(--border)">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
            <div>
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">
                <span style="font-size:1.2rem;font-weight:700">${p.name}</span>
                <span class="badge badge-success" style="background:rgba(34,197,94,.1);color:var(--success)">✓ Completed</span>
                <span style="font-size:0.85rem;color:var(--muted-fg)">owned by ${p.owner}</span>
              </div>
              <div style="font-size:0.85rem;color:var(--muted-fg);margin-top:2px">${summary.completedOn} · ${summary.tasksCompleted}/${summary.totalTasks} of your tasks done</div>
            </div>
            <button class="btn btn-outline" onclick="openContributionSummary('${p.id}')">🏆 My Summary</button>
          </div>
          <div class="progress-container" style="height:8px;margin:12px 0"><div class="progress-fill" style="width:100%"></div></div>
          <div style="display:flex;gap:12px;font-size:0.9rem;margin-bottom:8px">
            <span>⚡ <span style="font-weight:600;color:#f59e0b">+${summary.xpEarned} XP</span></span>
            <span>⭐ <span style="font-weight:600;color:#3b82f6">+${summary.repGained} Rep</span></span>
          </div>
          <div style="font-size:0.85rem;color:var(--muted-fg);display:flex;align-items:center;gap:4px">
            <span>🔒</span>
            <span>Archived — workspace is read-only</span>
          </div>
        </div>
      `;
    })
    .join("");

  root.innerHTML = `
    ${activeProjects.length ? `<div style="margin-bottom:20px"><div style="font-size:1.1rem;font-weight:700;color:var(--muted-fg);margin-bottom:10px">📁 ACTIVE (${activeProjects.length})</div>${activeHTML}</div>` : ""}
    ${completedProjects.length ? `<div><div style="font-size:1.1rem;font-weight:700;color:var(--muted-fg);margin-bottom:10px">✅ COMPLETED (${completedProjects.length})</div>${completedHTML}</div>` : ""}
    ${!activeProjects.length && !completedProjects.length ? '<div class="card"><p class="text-sm text-muted italic">No collaborative projects found. Join a project to get started!</p></div>' : ""}
  `;
}

function openContributionSummary(projectId) {
  const project = PROJECTS.find((p) => p.id === projectId);
  if (!project) {
    showToast("Project not found", "error");
    return;
  }

  const summary = getMyWorkCompletedSummary(project);
  const xpEarned = summary.xpEarned;
  const repGained = summary.repGained;
  const tasksCompleted = summary.tasksCompleted;
  const totalTasks = summary.totalTasks;
  const completionPercent = Math.max(
    0,
    Math.min(100, Math.round((tasksCompleted / Math.max(1, totalTasks)) * 100)),
  );

  const teamAvatars = (Array.isArray(project.members) ? project.members : [])
    .slice(0, 4)
    .map(
      (m) => `
      <div style="display:flex;align-items:center;gap:8px">
        <div style="width:32px;height:32px;border-radius:50%;background:var(--secondary);font-size:0.75rem;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0" title="${m.name}">
          ${m.initials}
        </div>
        <span style="font-size:0.95rem;color:var(--muted-fg)">${m.name.split(" ")[0]}</span>
      </div>
    `,
    )
    .join("");

  const content = document.getElementById("contribution-summary-content");
  const title = document.getElementById("contribution-summary-title");
  if (!content || !title) return;

  title.textContent = `Your Contribution Summary`;
  content.innerHTML = `
    <div style="font-size:0.9rem;color:var(--muted-fg);margin-bottom:20px">${project.name} · ${summary.completedOn}</div>

    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
      <div style="text-align:center;padding:12px;background:rgba(248,248,248,0.6);border:1px solid var(--border);border-radius:6px">
        <div style="font-size:1.8rem;margin-bottom:4px">⚡</div>
        <div style="font-size:1.6rem;font-weight:700;color:var(--foreground);margin-bottom:4px">+${xpEarned}</div>
        <div style="font-size:0.8rem;color:var(--muted-fg);font-weight:500">XP Earned</div>
      </div>
      <div style="text-align:center;padding:12px;background:rgba(248,248,248,0.6);border:1px solid var(--border);border-radius:6px">
        <div style="font-size:1.8rem;margin-bottom:4px">⭐</div>
        <div style="font-size:1.6rem;font-weight:700;color:var(--foreground);margin-bottom:4px">+${repGained}</div>
        <div style="font-size:0.8rem;color:var(--muted-fg);font-weight:500">Rep Gained</div>
      </div>
      <div style="text-align:center;padding:12px;background:rgba(248,248,248,0.6);border:1px solid var(--border);border-radius:6px">
        <div style="font-size:1.8rem;margin-bottom:4px">✓</div>
        <div style="font-size:1.6rem;font-weight:700;color:var(--foreground);margin-bottom:4px">${tasksCompleted}/${totalTasks}</div>
        <div style="font-size:0.8rem;color:var(--muted-fg);font-weight:500">My Tasks</div>
      </div>
    </div>

    <div style="padding:14px;margin-bottom:12px;background:rgba(248,248,248,0.6);border:1px solid var(--border);border-radius:6px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:6px;font-weight:600;font-size:0.95rem">
          <span>📊</span>
          <span>Task Completion</span>
        </div>
        <span style="color:#22b45a;font-weight:700;font-size:0.95rem">${completionPercent}%</span>
      </div>
      <div class="progress-container" style="height:8px;background:rgba(0,0,0,0.05);border-radius:4px">
        <div class="progress-fill" style="width:${completionPercent}%;background:#22b45a;border-radius:4px;height:8px"></div>
      </div>
    </div>

    <div style="padding:14px;margin-bottom:12px;background:rgba(248,248,248,0.6);border:1px solid var(--border);border-radius:6px">
      <div style="font-weight:600;font-size:0.75rem;text-transform:uppercase;color:var(--muted-fg);margin-bottom:8px;letter-spacing:0.5px">Your Contribution</div>
      <p style="font-size:0.9rem;color:var(--foreground);line-height:1.5;margin:0">${summary.contribution}</p>
    </div>

    <div style="padding:14px;background:rgba(248,248,248,0.6);border:1px solid var(--border);border-radius:6px;margin-bottom:12px">
      <div style="font-weight:600;font-size:0.75rem;text-transform:uppercase;color:var(--muted-fg);margin-bottom:10px;letter-spacing:0.5px">Team</div>
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        ${teamAvatars}
      </div>
    </div>

    <div style="display:flex;align-items:center;gap:8px;font-size:0.85rem;color:var(--muted-fg);padding-top:8px;border-top:1px solid var(--border)">
      <span style="font-size:1rem">🔒</span>
      <span>This project is archived. The workspace is read-only.</span>
    </div>
  `;

  const modal = document.getElementById("modal-contribution-summary");
  if (modal) modal.classList.add("open");
}

function closeContributionSummary(e) {
  const modal = document.getElementById("modal-contribution-summary");
  if (!modal) return;
  if (e && e.target !== modal) return;
  modal.classList.remove("open");
}

function renderProjectWorkspace() {
  if (STATE.workspaceMode === "owned") {
    renderOwnedProjectWorkspace();
    return;
  }

  if (STATE.workspaceMode === "collaborator-project-preview") {
    renderCollaboratorProjectPreview();
    return;
  }

  const project = PROJECTS.find((p) => p.id === STATE.selectedProject);
  if (!project) {
    document.getElementById("page-project-workspace").innerHTML =
      '<div class="card">Project not found.</div>';
    return;
  }

  const currentUser = getCurrentUserName();
  const tab = STATE.collaboratorWorkspaceTab || "overview";
  const members = Array.isArray(project.members) ? project.members : [];
  const workspaceData = getCollaboratorWorkspaceData(project);
  const tasks = Array.isArray(workspaceData.tasks) ? workspaceData.tasks : [];
  const isProofModalOpen = Boolean(STATE.collaboratorProofModalOpen);
  const proofTaskIndex = Number(STATE.collaboratorProofTaskIndex);
  const proofTask =
    Number.isInteger(proofTaskIndex) &&
    proofTaskIndex >= 0 &&
    proofTaskIndex < tasks.length
      ? tasks[proofTaskIndex]
      : null;

  const totalTasks = tasks.length;
  const completedCount = tasks.filter((t) => t.status === "Approved").length;
  const inProgressCount = tasks.filter(
    (t) => t.status === "In Progress",
  ).length;
  const userAssignedTasks = tasks
    .map((task, index) => ({ task, index }))
    .filter(({ task }) => String(task.assigned).includes(currentUser));

  const backPage =
    STATE.workspaceBackPage ||
    (STATE.role === "mentor" ? "mentored-projects" : "my-projects");

  let tabContent = "";

  if (tab === "overview") {
    tabContent = `
      <div style="display:grid;grid-template-columns:repeat(3,minmax(180px,1fr));gap:16px;margin-bottom:16px">
        <div class="card" style="padding:16px;text-align:center">
          <div style="font-size:2rem;font-weight:700;line-height:1.1">${totalTasks}</div>
          <div style="font-size:0.95rem;color:var(--muted-fg)">Total Tasks</div>
        </div>
        <div class="card" style="padding:16px;text-align:center">
          <div style="font-size:2rem;font-weight:700;color:var(--success);line-height:1.1">${completedCount}</div>
          <div style="font-size:0.95rem;color:var(--muted-fg)">Completed</div>
        </div>
        <div class="card" style="padding:16px;text-align:center">
          <div style="font-size:2rem;font-weight:700;color:#3569c6;line-height:1.1">${inProgressCount}</div>
          <div style="font-size:0.95rem;color:var(--muted-fg)">In Progress</div>
        </div>
      </div>

      <div class="card" style="padding:16px">
        <div style="font-size:1.55rem;font-weight:700;margin-bottom:12px">Your Assigned Tasks</div>
        ${
          userAssignedTasks.length
            ? userAssignedTasks
                .map(({ task, index }, idx) => {
                  const actionHtml =
                    task.action === "Start Work"
                      ? `<button class="btn btn-outline btn-sm" onclick="startCollaboratorTask(${index})">▷ Start Work</button>`
                      : task.action === "Submit"
                        ? `<button class="btn btn-outline btn-sm" onclick="openCollaboratorSubmitModal(${index})">✈ Submit</button>`
                        : task.action === "Approved"
                          ? '<span style="font-size:0.95rem;color:var(--success)">✓ Approved</span>'
                          : collaboratorStatusPill(task.action);

                  return `
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px;border:1px solid var(--border);border-radius:10px;background:var(--secondary);margin-bottom:${idx === userAssignedTasks.length - 1 ? 0 : 10}px">
                      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
                        <span style="font-size:1rem;font-weight:600">${task.title}</span>
                        ${collaboratorDifficultyPill(task.difficulty)}
                      </div>
                      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end">
                        ${collaboratorStatusPill(task.status)}
                        ${actionHtml}
                      </div>
                    </div>
                    `;
                })
                .join("")
            : '<p class="text-sm text-muted">No tasks assigned to you yet.</p>'
        }
      </div>
    `;
  } else if (tab === "tasks") {
    tabContent = `
      <div class="card" style="padding:0;overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;min-width:920px">
          <thead>
            <tr style="border-bottom:1px solid var(--border)">
              <th style="text-align:left;padding:14px 16px;font-size:0.95rem;color:var(--muted-fg)">Task</th>
              <th style="text-align:left;padding:14px 16px;font-size:0.95rem;color:var(--muted-fg)">Difficulty</th>
              <th style="text-align:left;padding:14px 16px;font-size:0.95rem;color:var(--muted-fg)">Assigned</th>
              <th style="text-align:left;padding:14px 16px;font-size:0.95rem;color:var(--muted-fg)">Deadline</th>
              <th style="text-align:left;padding:14px 16px;font-size:0.95rem;color:var(--muted-fg)">Status</th>
              <th style="text-align:left;padding:14px 16px;font-size:0.95rem;color:var(--muted-fg)">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${tasks
              .map((task, idx) => {
                const actionHtml =
                  task.action === "Start Work"
                    ? `<button class="btn btn-outline btn-sm" onclick="startCollaboratorTask(${idx})">▷ Start Work</button>`
                    : task.action === "Submit"
                      ? `<button class="btn btn-outline btn-sm" onclick="openCollaboratorSubmitModal(${idx})">✈ Submit</button>`
                      : task.action === "Approved"
                        ? '<span style="font-size:0.95rem;color:var(--success)">✓Approved</span>'
                        : collaboratorStatusPill(task.action);

                return `
                <tr style="border-bottom:1px solid var(--border)">
                  <td style="padding:14px 16px;font-size:1rem;font-weight:600">${task.title}</td>
                  <td style="padding:14px 16px">${collaboratorDifficultyPill(task.difficulty)}</td>
                  <td style="padding:14px 16px;font-size:0.95rem;color:var(--muted-fg)">${task.assigned}</td>
                  <td style="padding:14px 16px;font-size:0.95rem;color:var(--muted-fg)">${task.deadline}</td>
                  <td style="padding:14px 16px">${collaboratorStatusPill(task.status)}</td>
                  <td style="padding:14px 16px">${actionHtml}</td>
                </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  } else if (tab === "members") {
    tabContent = `
      <div class="card" style="padding:16px">
        <div style="font-size:1.1rem;font-weight:700;margin-bottom:12px">Team Members</div>
        ${members
          .map(
            (m) => `
          <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
            <div style="width:34px;height:34px;border-radius:50%;background:var(--secondary);display:flex;align-items:center;justify-content:center;font-size:0.8rem;font-weight:700">${m.initials}</div>
            <div style="font-size:0.95rem;font-weight:600">${m.name}</div>
            <div style="font-size:0.85rem;color:var(--muted-fg)">· ${m.role}</div>
          </div>
        `,
          )
          .join("")}
      </div>
    `;
  } else {
    const chatMessages = Array.isArray(workspaceData.messages)
      ? workspaceData.messages
      : [];
    tabContent = `
      <div class="card" style="padding:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:10px">
          <div style="font-size:1.1rem;font-weight:700">Project Chat</div>
          <div style="display:flex;align-items:center;gap:8px;color:var(--muted-fg);font-size:.82rem">
            <span style="display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:999px;background:var(--secondary);border:1px solid var(--border)">● Live</span>
            <span>${chatMessages.length} message${chatMessages.length === 1 ? "" : "s"}</span>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;max-height:280px;overflow:auto;padding-right:4px">
          ${
            chatMessages.length
              ? chatMessages
                  .map((msg) => {
                    const mine = msg.sender === currentUser;
                    return `
              <div style="align-self:${mine ? "flex-end" : "flex-start"};max-width:74%;padding:10px 12px;border-radius:12px;background:${mine ? "var(--secondary)" : "var(--card-bg)"};border:1px solid var(--border)">
                <div style="font-size:0.75rem;color:var(--muted-fg);margin-bottom:4px">${escapeHtml(msg.sender)} · ${escapeHtml(msg.time || "")}</div>
                <div style="font-size:0.92rem;line-height:1.4">${escapeHtml(msg.text)}</div>
              </div>
            `;
                  })
                  .join("")
              : '<div style="padding:14px;border:1px dashed var(--border);border-radius:10px;color:var(--muted-fg);font-size:0.9rem">No messages yet. Start the conversation with your team.</div>'
          }
        </div>
        <div style="display:flex;gap:10px">
          <input id="collab-chat-input" type="text" placeholder="Type a message..." style="flex:1;border:1px solid var(--border);border-radius:10px;padding:10px 12px;background:var(--card-bg)" onkeydown="if(event.key==='Enter'){event.preventDefault();sendCollaboratorChatMessage()}" />
          <button class="btn btn-primary" onclick="sendCollaboratorChatMessage()">Send</button>
        </div>
        <div style="margin-top:8px;font-size:.78rem;color:var(--muted-fg)">Press Enter to send quickly.</div>
      </div>
    `;
  }

  const ownedBackPage = STATE.workspaceBackPage || "my-projects";

  document.getElementById("page-project-workspace").innerHTML = `
    <div style="max-width:100%;margin:0 auto;display:flex;flex-direction:column;gap:16px">
      <div style="display:flex;align-items:center;gap:8px;cursor:pointer;color:var(--muted-fg)" onclick="navigate('${ownedBackPage}')">
        <span style="font-size:1rem">←</span>
        <span style="font-size:0.95rem">Back</span>
      </div>

      <div class="card" style="padding:20px;border:1px solid var(--border)">
        <div style="display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap">
          <div style="flex:1;min-width:320px">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px">
              <h2 style="font-size:2.5rem;font-weight:700;line-height:1.1;margin:0">${project.name}</h2>
              <span class="badge badge-secondary">Collaborator</span>
            </div>
            <p style="margin:0 0 10px;color:var(--muted-fg);font-size:0.95rem;line-height:1.45">${project.desc}</p>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
              ${(Array.isArray(project.skills) ? project.skills : [])
                .map((s) => `<span class="skill-tag">${s}</span>`)
                .join("")}
            </div>
            <div style="font-size:0.9rem;color:var(--muted-fg)">
              Owned by <span style="color:var(--fg);font-weight:600">${project.owner}</span>
              <span style="padding:0 8px">·</span>
              ${members.length} members
              <span style="padding:0 8px">·</span>
              You are <span style="color:var(--fg);font-weight:600">${currentUser}</span>
            </div>
          </div>

          <div style="min-width:220px;display:flex;flex-direction:column;align-items:flex-end;justify-content:flex-start">
            <div style="font-size:1rem;color:var(--muted-fg);margin-bottom:2px">Progress</div>
            <div style="font-size:2.2rem;font-weight:700;margin-bottom:8px">${Number(project.progress) || 0}%</div>
            <div class="progress-container" style="width:180px;height:8px">
              <div class="progress-fill" style="width:${Number(project.progress) || 0}%"></div>
            </div>
          </div>
        </div>
      </div>

      <div style="display:inline-flex;align-items:center;gap:4px;padding:6px;background:rgba(15,23,42,.06);border:1px solid rgba(15,23,42,.08);border-radius:12px;width:fit-content">
        <button
          onclick="setCollaboratorWorkspaceTab('overview')"
          style="height:36px;padding:0 16px;border-radius:9px;border:${tab === "overview" ? "1px solid rgba(15,23,42,.08)" : "1px solid transparent"};background:${tab === "overview" ? "#ffffff" : "transparent"};color:${tab === "overview" ? "#111827" : "#6b7280"};font-size:0.95rem;font-weight:${tab === "overview" ? "600" : "500"};cursor:pointer;box-shadow:${tab === "overview" ? "0 1px 2px rgba(0,0,0,.08)" : "none"}">
          Overview
        </button>
        <button
          onclick="setCollaboratorWorkspaceTab('tasks')"
          style="height:36px;padding:0 16px;border-radius:9px;border:${tab === "tasks" ? "1px solid rgba(15,23,42,.08)" : "1px solid transparent"};background:${tab === "tasks" ? "#ffffff" : "transparent"};color:${tab === "tasks" ? "#111827" : "#6b7280"};font-size:0.95rem;font-weight:${tab === "tasks" ? "600" : "500"};cursor:pointer;box-shadow:${tab === "tasks" ? "0 1px 2px rgba(0,0,0,.08)" : "none"}">
          Tasks
        </button>
        <button
          onclick="setCollaboratorWorkspaceTab('members')"
          style="height:36px;padding:0 16px;border-radius:9px;border:${tab === "members" ? "1px solid rgba(15,23,42,.08)" : "1px solid transparent"};background:${tab === "members" ? "#ffffff" : "transparent"};color:${tab === "members" ? "#111827" : "#6b7280"};font-size:0.95rem;font-weight:${tab === "members" ? "600" : "500"};cursor:pointer;box-shadow:${tab === "members" ? "0 1px 2px rgba(0,0,0,.08)" : "none"}">
          Members
        </button>
        <button
          onclick="setCollaboratorWorkspaceTab('chat')"
          style="height:36px;padding:0 16px;border-radius:9px;border:${tab === "chat" ? "1px solid rgba(15,23,42,.08)" : "1px solid transparent"};background:${tab === "chat" ? "#ffffff" : "transparent"};color:${tab === "chat" ? "#111827" : "#6b7280"};font-size:0.95rem;font-weight:${tab === "chat" ? "600" : "500"};cursor:pointer;box-shadow:${tab === "chat" ? "0 1px 2px rgba(0,0,0,.08)" : "none"}">
          Chat
        </button>
      </div>

      ${tabContent}

      <div id="collab-submit-modal" class="modal-overlay ${isProofModalOpen ? "open" : ""}" onclick="closeCollaboratorSubmitModal(event)">
        <div class="modal-box" onclick="event.stopPropagation()" style="max-width:560px">
          <div class="modal-header" style="align-items:flex-start">
            <div>
              <h3 class="modal-title" style="margin-bottom:2px">Submit Proof of Work</h3>
              <div style="font-size:0.95rem;color:var(--muted-fg)">
                Paste a link to your proof (GitHub PR, Figma, Google Doc, etc.) before submitting for review.
              </div>
            </div>
            <button class="modal-close" onclick="closeCollaboratorSubmitModal()">✕</button>
          </div>
          <div class="modal-body" style="padding-top:0">
            <div style="font-size:0.85rem;color:var(--muted-fg);margin-bottom:8px">${proofTask ? proofTask.title : "Selected task"}</div>
            <input
              id="collab-proof-link"
              type="url"
              placeholder="https://github.com/..."
              value="${STATE.collaboratorProofLink || ""}"
              oninput="updateCollaboratorProofLink(this.value)"
              style="width:100%;height:52px;border:2px solid #6a5a47;border-radius:14px;padding:0 14px;font-size:0.95rem;outline:none;background:var(--card-bg);margin-bottom:14px"
            />
            <button class="btn" onclick="submitCollaboratorProof()" style="width:100%;height:44px;border-radius:12px;background:#6a5a47;color:#fff;border:1px solid #6a5a47;font-weight:600">
              ✈ Submit for Review
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}
