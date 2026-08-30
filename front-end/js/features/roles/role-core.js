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
      saveStateUsersStore(currentUsers);
    }
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
  STATE.role = normalizeRoleName(role);
  const currentEmail =
    typeof getCurrentUserSessionEmail === "function"
      ? getCurrentUserSessionEmail()
      : "";
  const users =
    typeof getStateUsersStore === "function" ? getStateUsersStore() : {};
  if (currentEmail && users[currentEmail]) {
    users[currentEmail].role = STATE.role;
    saveStateUsersStore(users);
  }
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

function normalizeRoleName(role) {
  const normalized = String(role || "collaborator").trim().toLowerCase();
  if (normalized === "project owner" || normalized === "project-owner") {
    return "project-owner";
  }
  if (normalized === "mentor") {
    return "mentor";
  }
  return "collaborator";
}

function getRoleDisplayLabel(role) {
  const normalized = normalizeRoleName(role);
  if (normalized === "project-owner") return "Project Owner";
  if (normalized === "mentor") return "Mentor";
  return "Collaborator";
}

function updateRoleUI() {
  const r = normalizeRoleName(STATE.role);
  STATE.role = r;
  const btn = document.getElementById("role-btn");
  if (btn) btn.className = "role-btn " + r;
  
  const roleLabel = document.getElementById("role-label");
  if (roleLabel) roleLabel.textContent = getRoleDisplayLabel(r);

  const userRoleLabel = document.getElementById("user-role-label");
  if (userRoleLabel) userRoleLabel.textContent = getRoleDisplayLabel(r);

  ["collab", "owner", "mentor"].forEach((k) => {
    const el = document.getElementById("active-" + k);
    if (el) el.style.display = "none";
  });

  const map = {
    collaborator: "collab",
    "project-owner": "owner",
    "project owner": "owner",
    mentor: "mentor",
  };
  const activeKey = map[r] || "collab";
  const activeEl = document.getElementById("active-" + activeKey);
  if (activeEl) activeEl.style.display = "";

  [
    { id: "role-collab", active: r === "collaborator" },
    { id: "role-owner", active: r === "project-owner" },
    { id: "role-mentor", active: r === "mentor" },
  ].forEach(({ id, active }) => {
    const item = document.getElementById(id);
    if (item) item.classList.toggle("active", active);
  });

  const av = document.getElementById("header-avatar");
  if (av) av.className = r === "mentor" ? "avatar mentor-av" : "avatar";

  if (STATE.mentorApproved) {
    const mentorIcon = document.getElementById("mentor-icon");
    if (mentorIcon) mentorIcon.textContent = "⭐";
    const mentorStatus = document.getElementById("mentor-status");
    if (mentorStatus) {
      mentorStatus.textContent = r !== "mentor" ? "Unlocked" : "Active";
      mentorStatus.className = "ml-auto unlocked";
    }
  } else {
    const mentorIcon = document.getElementById("mentor-icon");
    if (mentorIcon) mentorIcon.textContent = "🔒";
    const mentorStatus = document.getElementById("mentor-status");
    if (mentorStatus) {
      mentorStatus.textContent = "Apply →";
      mentorStatus.className = "ml-auto";
    }
  }

  if (typeof renderRoleNav === "function") renderRoleNav();
  if (typeof renderSuperuserAdminButton === "function") renderSuperuserAdminButton();
}

function renderRoleNav() {
  const nav = document.getElementById("role-nav");
  if (!nav) return;

  const r = normalizeRoleName(STATE.role);
  STATE.role = r;
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

  const label = getRoleDisplayLabel(r);
  nav.innerHTML = `
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
