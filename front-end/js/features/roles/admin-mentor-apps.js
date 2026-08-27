// ══════════════════════════════════════════════
//   ADMIN — MENTOR APPLICATIONS
// ══════════════════════════════════════════════

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
        <span class="admin-mentor-criteria-tag"><span class="admin-mentor-icon">${iconCheckSvg()}</span>Complete &amp; authentic LinkedIn profile</span>
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
