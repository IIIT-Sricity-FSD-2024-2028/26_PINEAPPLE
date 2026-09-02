// ══════════════════════════════════════════════
//   ADMIN — USER MANAGEMENT
// ══════════════════════════════════════════════

function getAdminUserByName(name) {
  const targetName = String(name || "").trim().toLowerCase();
  if (!targetName) return null;
  return (
    getAllAdminUsers().find(
      (user) => String(user.name || "").trim().toLowerCase() === targetName,
    ) || null
  );
}

function normalizeAdminUserStatus(status, fallback = "active") {
  const value = String(status || fallback || "active").trim().toLowerCase();
  if (value === "warned" || value === "suspended" || value === "active") {
    return value;
  }
  return "active";
}

function getInitialsFromAdminName(name) {
  return (
    String(name || "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("") || "US"
  );
}

function getAdminProjectCount(userRecord, seed = {}) {
  const projects = Array.isArray(userRecord?.data?.projects)
    ? userRecord.data.projects
    : null;

  // If user has no stored projects data, return 0 — do NOT fall back to seed counts
  if (!projects) {
    return 0;
  }

  return projects.filter((project) => {
    if (typeof project === "string") {
      return project.trim().length > 0;
    }
    if (!project || typeof project !== "object") return false;
    const projectId = String(project.id || "").trim();
    const projectName = String(project.name || project.projectName || "").trim();
    return projectId.length > 0 || projectName.length > 0;
  }).length;
}

function getAllAdminUsers() {
  const usersStore =
    typeof getStateUsersStore === "function" ? getStateUsersStore() : {};
  const seedUsers = Array.isArray(ADMIN_USERS) ? ADMIN_USERS : [];
  const seedByName = new Map();

  seedUsers.forEach((seedUser) => {
    const key = String(seedUser?.name || "").trim().toLowerCase();
    if (!key) return;
    seedByName.set(key, seedUser);
  });

  const result = Object.entries(usersStore || {}).map(([email, userRecord]) => {
    const name = String(
      userRecord?.name || email.split("@")[0] || "TeamForge User",
    ).trim();
    const profile =
      userRecord?.profile && typeof userRecord.profile === "object"
        ? userRecord.profile
        : {};
    const seed = seedByName.get(name.toLowerCase()) || {};
    const projects = getAdminProjectCount(userRecord);

    return {
      name,
      email,
      initials: String(profile.initials || seed.initials || getInitialsFromAdminName(name)),
      university: String(profile.university || seed.university || "Unknown University"),
      role: String(userRecord?.role || seed.role || "Collaborator"),
      // For users in the store, use their actual stored XP/rep (defaults to 0)
      xp: Number(profile.xp || 0),
      rep: Number(profile.rep || 0),
      projects,
      status: normalizeAdminUserStatus(userRecord?.status, seed.status),
      flagged:
        userRecord?.flagged !== undefined
          ? Boolean(userRecord.flagged)
          : Boolean(seed.flagged),
    };
  });

  seedUsers.forEach((seedUser) => {
    const name = String(seedUser?.name || "").trim();
    if (!name) return;
    const exists = result.some(
      (user) => String(user.name || "").trim().toLowerCase() === name.toLowerCase(),
    );
    if (exists) return;
    result.push({
      ...seedUser,
      status: normalizeAdminUserStatus(seedUser.status),
      flagged: Boolean(seedUser.flagged),
      initials: String(seedUser.initials || getInitialsFromAdminName(name)),
      projects: Number(seedUser.projects || 0),
      xp: Number(seedUser.xp || 0),
      rep: Number(seedUser.rep || 0),
    });
  });

  return result;
}

function persistAdminUserModeration(user, status, flagged) {
  const normalizedStatus = normalizeAdminUserStatus(status, user?.status);
  const normalizedFlagged = Boolean(flagged);
  const userName = String(user?.name || "").trim().toLowerCase();

  if (typeof getStateUsersStore === "function" && typeof saveStateUsersStore === "function") {
    const usersStore = getStateUsersStore();
    const entry = Object.entries(usersStore).find(([, record]) => {
      return String(record?.name || "").trim().toLowerCase() === userName;
    });
    if (entry) {
      const [email, record] = entry;
      usersStore[email] = {
        ...record,
        status: normalizedStatus,
        flagged: normalizedFlagged,
      };
      saveStateUsersStore(usersStore);
    }
  }

  if (Array.isArray(ADMIN_USERS)) {
    const seedUser = ADMIN_USERS.find(
      (item) => String(item?.name || "").trim().toLowerCase() === userName,
    );
    if (seedUser) {
      seedUser.status = normalizedStatus;
      seedUser.flagged = normalizedFlagged;
    }
  }
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
  const user = getAdminUserByName(userName);
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
    persistAdminUserModeration(user, "warned", true);
    actionLabel = "warned";
  } else if (action === "suspend") {
    user.status = "suspended";
    user.flagged = true;
    persistAdminUserModeration(user, "suspended", true);
    actionLabel = "suspended";
  } else if (action === "activate") {
    user.status = "active";
    user.flagged = false;
    persistAdminUserModeration(user, "active", false);
    actionLabel = "reactivated";
  } else if (action === "flag") {
    user.flagged = true;
    persistAdminUserModeration(user, user.status, true);
    actionLabel = "flagged";
  } else if (action === "unflag") {
    user.flagged = false;
    persistAdminUserModeration(user, user.status, false);
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
  if (typeof renderAdminDash === "function") renderAdminDash();
  showToast(`${user.name} ${actionLabel}`);
}

function getAdminUserFilterCount(filterId) {
  const adminUsers = getAllAdminUsers();
  if (filterId === "all") return adminUsers.length;
  if (filterId === "flagged") {
    return adminUsers.filter((user) => user.flagged === true).length;
  }
  return adminUsers.filter((user) => user.status === filterId).length;
}

function getAdminUsersByFilter() {
  const adminUsers = getAllAdminUsers();

  const query = ADMIN_USER_FILTER_STATE.query.trim().toLowerCase();
  const filtered = adminUsers.filter((user) => {
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
