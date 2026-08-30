// ══════════════════════════════════════════════════════════════
//  superuser.js — Super User portal logic
//
//  Super User (superuser@teamforge.io) has FULL system control:
//    • Everything the Admin can do (users, projects, mentor apps, audit)
//    • Manage Admins   — Create / Read / Edit / Delete admin accounts
//    • Platform Config — Edit all platform-level settings
//    • Hard-delete projects (Admin can only view)
//
//  Admin is restricted to operational activities:
//    • User moderation (warn, suspend, flag)
//    • Project viewing
//    • Mentor application review
//    • Audit log (read-only)
//    • Cannot access Admin Management or Platform Config pages
// ══════════════════════════════════════════════════════════════

// ─── Admin Management ────────────────────────────────────────

const SU_ADMIN_STATE = {
  editingId: null,   // id of admin being edited, or null for create
  modalOpen: false,
};

function syncPortalAccountRecord(admin, passwordOverride = "") {
  if (!admin) return;
  const existingAccount = PORTAL_ACCOUNTS.find((account) => account.email === admin.email);
  const nextPassword = passwordOverride || admin.password || existingAccount?.password || "";
  if (existingAccount) {
    existingAccount.email = admin.email;
    existingAccount.password = nextPassword;
    existingAccount.portalRole = "admin";
    existingAccount.displayName = admin.name;
  } else {
    PORTAL_ACCOUNTS.push({
      email: admin.email,
      password: nextPassword,
      portalRole: "admin",
      displayName: admin.name,
    });
  }
  admin.password = nextPassword;
}

function suOpenAdminModal(adminId) {
  SU_ADMIN_STATE.editingId = adminId || null;
  SU_ADMIN_STATE.modalOpen = true;
  renderSuAdminModal();
  document.getElementById("su-admin-modal").style.display = "flex";
}

function suCloseAdminModal() {
  SU_ADMIN_STATE.modalOpen = false;
  SU_ADMIN_STATE.editingId = null;
  document.getElementById("su-admin-modal").style.display = "none";
}

function renderSuAdminModal() {
  const modal = document.getElementById("su-admin-modal");
  if (!modal) return;

  const isEdit = !!SU_ADMIN_STATE.editingId;
  const existing = isEdit
    ? PORTAL_ADMINS.find((a) => a.id === SU_ADMIN_STATE.editingId)
    : null;

  const permOptions = [
    { key: "users", label: "User Control" },
    { key: "projects", label: "Projects" },
    { key: "mentor_apps", label: "Mentors" },
    { key: "audit", label: "Audit" },
  ];

  modal.innerHTML = `
    <div class="su-modal-backdrop" onclick="suCloseAdminModal()"></div>
    <div class="su-modal-card">
      <div class="su-modal-header">
        <h2 class="su-modal-title">${isEdit ? "Edit Admin Instance" : "Provision New Admin"}</h2>
        <button class="su-modal-close" onclick="suCloseAdminModal()">✕</button>
      </div>

      <div id="su-admin-form-error" class="su-form-error" style="display:none"></div>

      <div class="su-form-body" style="display:flex;flex-direction:column;gap:16px">
        <div class="input-group">
          <label class="label" style="font-weight:700">Display Identity <span class="su-required">*</span></label>
          <input class="input" id="su-admin-name" type="text" maxlength="60"
            placeholder="e.g. Operations Lead"
            style="height:48px;border-radius:14px;border:2px solid var(--border)"
            value="${escapeHtml(existing ? existing.name : "")}">
        </div>

        <div class="input-group">
          <label class="label" style="font-weight:700">Network Email <span class="su-required">*</span></label>
          <input class="input" id="su-admin-email" type="email" maxlength="254"
            placeholder="admin@teamforge.io"
            style="height:48px;border-radius:14px;border:2px solid var(--border)"
            value="${escapeHtml(existing ? existing.email : "")}">
        </div>

        <div class="input-group">
          <label class="label" style="font-weight:700">Secure Access Key ${isEdit ? "(optional)" : '<span class="su-required">*</span>'}</label>
          <input class="input" id="su-admin-password" type="password" maxlength="72"
            style="height:48px;border-radius:14px;border:2px solid var(--border)"
            placeholder="${isEdit ? "Enter to rotate key" : "Min 8 chars, 1 upper, 1 digit"}">
        </div>

        <div class="input-group">
          <label class="label" style="font-weight:700">Permission Protocol <span class="su-required">*</span></label>
          <div class="su-perm-grid">
            ${permOptions.map((p) => `
              <label class="su-perm-item">
                <input type="checkbox" class="su-perm-cb" value="${p.key}"
                  ${existing && existing.permissions.includes(p.key) ? "checked" : ""}>
                <span>${p.label}</span>
              </label>
            `).join("")}
          </div>
        </div>
      </div>

      <div class="su-modal-footer" style="display:flex;gap:12px;margin-top:8px">
        <button class="btn btn-outline" style="flex:1;height:48px;border-radius:14px" onclick="suCloseAdminModal()">Discard</button>
        <button class="btn btn-primary" style="flex:2;height:48px;border-radius:14px" onclick="suSaveAdmin()">
          ${isEdit ? "Save Protocol" : "Authorize Admin"}
        </button>
      </div>
    </div>
  `;
}

function suSaveAdmin() {
  const nameInput = document.getElementById("su-admin-name");
  const emailInput = document.getElementById("su-admin-email");
  const passInput = document.getElementById("su-admin-password");
  const errorEl = document.getElementById("su-admin-form-error");
  const isEdit = !!SU_ADMIN_STATE.editingId;

  const name = nameInput ? nameInput.value.trim() : "";
  const email = emailInput ? emailInput.value.trim().toLowerCase() : "";
  const pass = passInput ? passInput.value : "";

  const checkedBoxes = document.querySelectorAll(".su-perm-cb:checked");
  const permissions = Array.from(checkedBoxes).map((cb) => cb.value);

  const BASIC_EMAIL_RE = /^[a-zA-Z0-9._%+-]{1,64}@[a-zA-Z0-9.-]{1,255}\.[a-zA-Z]{2,}$/;
  const STRONG_PASS_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,72}$/;

  function showErr(msg) {
    if (!errorEl) return;
    errorEl.textContent = msg;
    errorEl.style.display = "";
  }

  if (!name) { showErr("Display name is required."); return; }
  if (name.length > 60) { showErr("Display name must be 60 characters or fewer."); return; }
  if (!email) { showErr("Email address is required."); return; }
  if (!BASIC_EMAIL_RE.test(email)) { showErr("Enter a valid email address."); return; }

  const duplicate = PORTAL_ADMINS.find(
    (admin) => admin.email === email && admin.id !== SU_ADMIN_STATE.editingId,
  );
  if (duplicate) { showErr("An admin with this email already exists."); return; }

  if (!isEdit && !pass) {
    showErr("Password is required for new admins.");
    return;
  }
  if (pass && !STRONG_PASS_RE.test(pass)) {
    showErr("Password must be 8+ chars with uppercase, lowercase, number, and special character.");
    return;
  }
  if (permissions.length === 0) {
    showErr("Select at least one permission.");
    return;
  }

  if (isEdit) {
    const idx = PORTAL_ADMINS.findIndex((admin) => admin.id === SU_ADMIN_STATE.editingId);
    if (idx === -1) { showToast("Admin record not found", "error"); return; }
    const previousEmail = PORTAL_ADMINS[idx].email;
    PORTAL_ADMINS[idx].name = name;
    PORTAL_ADMINS[idx].email = email;
    PORTAL_ADMINS[idx].permissions = permissions;
    if (pass) PORTAL_ADMINS[idx].password = pass;

    const oldAccountIdx = PORTAL_ACCOUNTS.findIndex((account) => account.email === previousEmail);
    if (oldAccountIdx !== -1 && previousEmail !== email) {
      PORTAL_ACCOUNTS.splice(oldAccountIdx, 1);
    }
    syncPortalAccountRecord(PORTAL_ADMINS[idx], pass);

    recordPortalAuditEntry({
      action: `Admin account updated | ${name}`,
      user: "Super User",
      time: formatCurrentTime(),
    });
    showToast(`Admin "${name}" updated`);
  } else {
    PORTAL_ADMINS.push({
      id: "adm-" + Date.now(),
      name,
      email,
      password: pass,
      status: "active",
      createdAt: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      permissions,
    });
    syncPortalAccountRecord(PORTAL_ADMINS[PORTAL_ADMINS.length - 1], pass);

    recordPortalAuditEntry({
      action: `Admin account created | ${name}`,
      user: "Super User",
      time: formatCurrentTime(),
    });
    showToast(`Admin "${name}" created`);
  }

  if (typeof savePortalAdmins === "function") savePortalAdmins();
  if (typeof savePortalAccounts === "function") savePortalAccounts();

  suCloseAdminModal();
  renderSuAdmins();
  renderAuditLog();
}

function suDeleteAdmin(adminId) {
  const idx = PORTAL_ADMINS.findIndex((a) => a.id === adminId);
  if (idx === -1) { showToast("Admin not found", "error"); return; }

  const admin = PORTAL_ADMINS[idx];
  // Prevent deleting the default admin@teamforge.io as a safeguard
  if (admin.email === "admin@teamforge.io") {
    showToast("Default admin account cannot be deleted");
    return;
  }

  PORTAL_ADMINS.splice(idx, 1);
  // Remove from PORTAL_ACCOUNTS too
  const accIdx = PORTAL_ACCOUNTS.findIndex((a) => a.email === admin.email);
  if (accIdx !== -1) PORTAL_ACCOUNTS.splice(accIdx, 1);
  if (typeof savePortalAdmins === "function") savePortalAdmins();
  if (typeof savePortalAccounts === "function") savePortalAccounts();

  recordPortalAuditEntry({
    action: `Admin account deleted · ${admin.name}`,
    user: "Super User",
    time: formatCurrentTime(),
  });
  showToast(`Admin "${admin.name}" deleted`);
  renderSuAdmins();
  renderAuditLog();
}

function suToggleAdminStatus(adminId) {
  const admin = PORTAL_ADMINS.find((a) => a.id === adminId);
  if (!admin) return;
  if (admin.email === "admin@teamforge.io") {
    showToast("Default admin status cannot be changed");
    return;
  }
  admin.status = admin.status === "active" ? "suspended" : "active";
  if (typeof savePortalAdmins === "function") savePortalAdmins();
  recordPortalAuditEntry({
    action: `Admin account ${admin.status} · ${admin.name}`,
    user: "Super User",
    time: formatCurrentTime(),
  });
  showToast(`Admin "${admin.name}" ${admin.status}`);
  renderSuAdmins();
  renderAuditLog();
}

function renderSuAdmins() {
  const container = document.getElementById("su-admins-list");
  if (!container) return;

  if (!PORTAL_ADMINS.length) {
    container.innerHTML = '<div class="admin-users-empty">No administrator instances identified.</div>';
    return;
  }

  const permLabels = {
    users: "User Control", projects: "Projects",
    mentor_apps: "Mentors", audit: "Audit Log",
  };

  container.innerHTML = `
    <div class="su-table-container">
      <table class="su-table">
        <thead>
          <tr>
            <th style="border-radius:16px 0 0 0">Identity</th>
            <th>Network Endpoint</th>
            <th>Operational Scope</th>
            <th>Authorized Since</th>
            <th>State</th>
            <th style="text-align:right;border-radius:0 16px 0 0">Operations</th>
          </tr>
        </thead>
        <tbody>
          ${PORTAL_ADMINS.map((a) => {
            const isSuspended = a.status !== "active";
            const statusClass = !isSuspended ? "status-active" : "status-rejected";
            const permTags = a.permissions
              .map((p) => `<span class="su-perm-tag">${permLabels[p] || p}</span>`)
              .join("");
            const isProtected = a.email === "admin@teamforge.io";

            return `
              <tr style="${isSuspended ? "opacity:0.75" : ""}">
                <td>
                  <div style="display:flex;align-items:center;gap:12px">
                    <div style="width:36px;height:36px;border-radius:10px;background:var(--secondary);color:var(--primary);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.75rem">${(a.name || "A").charAt(0).toUpperCase()}</div>
                    <div style="font-weight:700;color:var(--fg)">${escapeHtml(a.name)}</div>
                  </div>
                </td>
                <td style="color:var(--muted-fg)">${escapeHtml(a.email)}</td>
                <td><div class="su-perm-tags">${permTags}</div></td>
                <td style="color:var(--muted-fg)">${escapeHtml(a.createdAt)}</td>
                <td><span class="status-badge ${statusClass}">${!isSuspended ? "Active" : "Suspended"}</span></td>
                <td>
                  <div class="su-row-actions">
                    <button class="btn btn-outline btn-xs" style="padding:6px 12px;border-radius:8px"
                      onclick="suOpenAdminModal('${a.id}')">Edit</button>
                    ${!isProtected ? `
                      <button class="btn btn-outline btn-xs" style="padding:6px 12px;border-radius:8px"
                        onclick="suToggleAdminStatus('${a.id}')">
                        ${!isSuspended ? "Suspend" : "Activate"}
                      </button>
                      <button class="btn btn-xs su-btn-danger" style="padding:6px 12px;border-radius:8px"
                        onclick="suDeleteAdmin('${a.id}')">Erase</button>
                    ` : '<span style="font-size:0.7rem;color:var(--muted-fg);font-style:italic">Protected</span>'}
                  </div>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

// ─── Platform Config ──────────────────────────────────────────

function renderSuConfig() {
  const container = document.getElementById("su-config-content");
  if (!container) return;

  const c = PLATFORM_CONFIG;
  container.innerHTML = `
    <div id="su-config-error" class="su-form-error" style="margin-bottom:24px;display:none"></div>

    <div class="su-config-grid">

      <div class="su-config-section">
        <h3 class="su-config-section-title">
          <span style="font-size:1.2rem">📊</span> Project Parameters
        </h3>
        <div class="input-group">
          <label class="label" style="font-weight:700">Project Quota / User</label>
          <input class="input" id="cfg-maxProjects" type="number" min="1" max="100"
            style="height:42px;border-radius:10px;border:1px solid var(--border);padding:0 12px"
            value="${c.maxProjectsPerUser}">
        </div>
        <div class="input-group mt-3">
          <label class="label" style="font-weight:700">Max Collaborator Capacity</label>
          <input class="input" id="cfg-maxCollabs" type="number" min="1" max="200"
            style="height:42px;border-radius:10px;border:1px solid var(--border);padding:0 12px"
            value="${c.maxCollaboratorsPerProject}">
        </div>
      </div>

      <div class="su-config-section">
        <h3 class="su-config-section-title">
          <span style="font-size:1.2rem">🎓</span> Mentor Authorization
        </h3>
        <div class="input-group">
          <label class="label" style="font-weight:700">Minimum Career Tenure (Years)</label>
          <input class="input" id="cfg-mentorYears" type="number" min="0" max="50"
            style="height:42px;border-radius:10px;border:1px solid var(--border);padding:0 12px"
            value="${c.mentorMinYearsExperience}">
        </div>
        <div class="input-group mt-3">
          <label class="label" style="font-weight:700">Standard XP Yield / Task</label>
          <input class="input" id="cfg-xpPerTask" type="number" min="0" max="10000"
            style="height:42px;border-radius:10px;border:1px solid var(--border);padding:0 12px"
            value="${c.xpPerTaskCompletion}">
        </div>
      </div>

      <div class="su-config-section">
        <h3 class="su-config-section-title">
          <span style="font-size:1.2rem">🛡️</span> System Controls
        </h3>
        <div class="su-toggle-row">
          <div>
            <div class="su-toggle-label">Maintenance Override</div>
            <div class="su-toggle-desc">Lock platform for internal utility</div>
          </div>
          <label class="su-switch">
            <input type="checkbox" id="cfg-maintenance" ${c.maintenanceMode ? "checked" : ""}>
            <span class="su-switch-track"></span>
          </label>
        </div>
        <div class="su-toggle-row mt-4">
          <div>
            <div class="su-toggle-label">Provision New Accounts</div>
            <div class="su-toggle-desc">Toggle user registration interface</div>
          </div>
          <label class="su-switch">
            <input type="checkbox" id="cfg-registrations" ${c.allowNewRegistrations ? "checked" : ""}>
            <span class="su-switch-track"></span>
          </label>
        </div>
      </div>

      <div class="su-config-section">
        <h3 class="su-config-section-title">
          <span style="font-size:1.2rem">⚙️</span> Network Telemetry
        </h3>
        <div class="su-info-row">
          <span class="su-info-label">Revision Protocol</span>
          <span class="su-info-value" style="color:var(--primary)">${escapeHtml(c.platformVersion)}</span>
        </div>
        <div class="su-info-row">
          <span class="su-info-label">Role Privilege</span>
          <span class="su-info-value" style="color:var(--success)">Super User Elevation</span>
        </div>
        <div class="su-info-row">
          <span class="su-info-label">Identified Admins</span>
          <span class="su-info-value">${PORTAL_ADMINS.length} active</span>
        </div>
        <div class="su-info-row">
          <span class="su-info-label">Active Users</span>
          <span class="su-info-value">${typeof getStateUsersStore === "function" ? Object.keys(getStateUsersStore()).length : ADMIN_USERS.length} authenticated</span>
        </div>
      </div>

    </div>

    <div class="su-config-actions mt-4" style="text-align:right">
      <button class="btn btn-primary" style="height:52px;padding:0 32px;border-radius:14px;font-weight:800;font-size:1rem" onclick="suSaveConfig()">Commit Changes</button>
    </div>
  `;
}

function suSaveConfig() {
  const errorEl = document.getElementById("su-config-error");

  function getNum(id) {
    const el = document.getElementById(id);
    return el ? Number(el.value) : NaN;
  }
  function getBool(id) {
    const el = document.getElementById(id);
    return el ? el.checked : false;
  }
  function showErr(msg) {
    if (!errorEl) return;
    errorEl.textContent = msg;
    errorEl.style.display = "";
  }

  const maxProjects  = getNum("cfg-maxProjects");
  const maxCollabs   = getNum("cfg-maxCollabs");
  const mentorYears  = getNum("cfg-mentorYears");
  const xpPerTask    = getNum("cfg-xpPerTask");

  if (!Number.isFinite(maxProjects) || maxProjects < 1 || maxProjects > 100) {
    showErr("Max Projects per User must be between 1 and 100."); return;
  }
  if (!Number.isFinite(maxCollabs) || maxCollabs < 1 || maxCollabs > 200) {
    showErr("Max Collaborators must be between 1 and 200."); return;
  }
  if (!Number.isFinite(mentorYears) || mentorYears < 0 || mentorYears > 50) {
    showErr("Mentor min years must be between 0 and 50."); return;
  }
  if (!Number.isFinite(xpPerTask) || xpPerTask < 0 || xpPerTask > 10000) {
    showErr("XP per task must be between 0 and 10,000."); return;
  }

  PLATFORM_CONFIG.maxProjectsPerUser        = maxProjects;
  PLATFORM_CONFIG.maxCollaboratorsPerProject = maxCollabs;
  PLATFORM_CONFIG.mentorMinYearsExperience   = mentorYears;
  PLATFORM_CONFIG.xpPerTaskCompletion        = xpPerTask;
  PLATFORM_CONFIG.maintenanceMode            = getBool("cfg-maintenance");
  PLATFORM_CONFIG.allowNewRegistrations      = getBool("cfg-registrations");
  if (typeof savePlatformConfig === "function") savePlatformConfig();

  recordPortalAuditEntry({
    action: "Platform configuration updated",
    user: "Super User",
    time: formatCurrentTime(),
  });
  renderAuditLog();
  showToast("Platform configuration saved");

  if (errorEl) errorEl.style.display = "none";
}

// ─── Super User: hard-delete a project ───────────────────────

function suDeleteProject(projectId) {
  const idx = PROJECTS.findIndex((p) => p.id === String(projectId));
  if (idx === -1) { showToast("Project not found", "error"); return; }
  const project = PROJECTS[idx];
  const name = project.name;
  PROJECTS.splice(idx, 1);

  for (let i = APPLIED.length - 1; i >= 0; i -= 1) {
    if (APPLIED[i].projectId === String(projectId) || APPLIED[i].project === name) {
      APPLIED.splice(i, 1);
    }
  }

  if (typeof getStateUsersStore === "function") {
    const users = getStateUsersStore();
    Object.values(users).forEach((userRecord) => {
      if (!userRecord || typeof userRecord !== "object") return;
      userRecord.data = userRecord.data && typeof userRecord.data === "object"
        ? userRecord.data
        : { projects: [], requests: [], notifications: [] };
      userRecord.data.projects = Array.isArray(userRecord.data.projects)
        ? userRecord.data.projects.filter((item) => String(item?.id || "") !== String(projectId))
        : [];
      userRecord.data.requests = Array.isArray(userRecord.data.requests)
        ? userRecord.data.requests.filter((item) => String(item?.projectId || "") !== String(projectId))
        : [];
      userRecord.data.notifications = Array.isArray(userRecord.data.notifications)
        ? userRecord.data.notifications.filter((item) => String(item?.projectId || "") !== String(projectId))
        : [];
    });
    saveStateUsersStore(users);
  }

  if (typeof saveSharedMentorRequests === "function" && typeof loadSharedMentorRequests === "function") {
    saveSharedMentorRequests(
      loadSharedMentorRequests().filter((item) => String(item?.projectId || "") !== String(projectId)),
    );
  }
  if (typeof saveCreatedProjects === "function") saveCreatedProjects();
  if (typeof persistReview2Runtime === "function") persistReview2Runtime();
  if (STATE.selectedProject === String(projectId)) {
    STATE.selectedProject = "";
    STATE.workspaceMode = "";
  }

  recordPortalAuditEntry({
    action: `Project deleted | ${name}`,
    user: "Super User",
    time: formatCurrentTime(),
  });
  showToast(`Project "${name}" deleted`);
  renderAdminProjects();
  if (typeof renderApplied === "function") renderApplied();
  if (typeof renderMyProjects === "function") renderMyProjects();
  renderAuditLog();
}
