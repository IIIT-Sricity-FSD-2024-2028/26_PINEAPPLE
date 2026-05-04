const VIEW_STATE_KEY = "teamforge.viewState";
const USER_RUNTIME_PREFIX = "teamforge.userRuntime.";

function cloneStateValue(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function normalizeStateEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function getStateUsersStore() {
  try {
    const raw = localStorage.getItem("users");
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveStateUsersStore(users) {
  localStorage.setItem("users", JSON.stringify(users));
}

function ensureStateNotificationShape(notification) {
  const safeNotification =
    notification && typeof notification === "object" ? notification : {};
  return {
    type: String(
      safeNotification.type ||
        safeNotification.title ||
        safeNotification.icon ||
        "INFO",
    ).trim(),
    message: String(
      safeNotification.message ||
        safeNotification.desc ||
        safeNotification.title ||
        "",
    ).trim(),
    projectId: String(safeNotification.projectId || "").trim(),
    from: String(safeNotification.from || "").trim(),
    status: String(safeNotification.status || "").trim() || "info",
    timestamp: String(
      safeNotification.timestamp || safeNotification.time || "Just now",
    ).trim(),
    unread:
      safeNotification.unread === undefined ? true : Boolean(safeNotification.unread),
    icon: String(safeNotification.icon || "").trim(),
    title: String(
      safeNotification.title || safeNotification.type || "Notification",
    ).trim(),
    desc: String(
      safeNotification.desc || safeNotification.message || "",
    ).trim(),
    time: String(
      safeNotification.time || safeNotification.timestamp || "Just now",
    ).trim(),
  };
}

function ensureStateTaskShape(task) {
  const safeTask = task && typeof task === "object" ? task : {};
  const assignedTo = String(
    safeTask.assignedTo || safeTask.assignee || "Unassigned",
  ).trim() || "Unassigned";
  const rawStatus = String(safeTask.status || "pending").trim().toLowerCase();
  const status =
    rawStatus === "open"
      ? "pending"
      : rawStatus === "in progress"
        ? "in-progress"
        : rawStatus === "in review"
          ? "submitted"
          : rawStatus === "completed"
            ? "approved"
            : rawStatus || "pending";
  return {
    id: String(safeTask.id || `task-${Date.now()}`).trim(),
    title: String(safeTask.title || "Untitled Task").trim(),
    description: String(safeTask.description || "").trim(),
    assignedTo,
    assignee: assignedTo,
    status,
    proofLink: String(safeTask.proofLink || "").trim(),
    due: String(safeTask.due || "").trim(),
    priority: String(safeTask.priority || "Medium").trim(),
  };
}

function ensureStateProjectShape(project) {
  const safeProject = project && typeof project === "object" ? project : {};
  const members = Array.isArray(safeProject.members)
    ? safeProject.members.map((member) =>
        typeof member === "string"
          ? member.trim().toLowerCase()
          : String(member?.email || member?.name || "").trim().toLowerCase(),
      )
    : [];
  const mentors = Array.isArray(safeProject.mentors)
    ? safeProject.mentors.map((mentor) =>
        typeof mentor === "string"
          ? mentor.trim().toLowerCase()
          : String(mentor?.email || mentor?.name || "").trim().toLowerCase(),
      )
    : [];
  return {
    ...safeProject,
    id: String(safeProject.id || "").trim(),
    name: String(safeProject.name || safeProject.projectName || "").trim(),
    owner: String(safeProject.owner || safeProject.ownerEmail || "").trim(),
    ownerName: String(safeProject.ownerName || safeProject.owner || "").trim(),
    members: members.filter(Boolean),
    mentors: mentors.filter(Boolean),
    tasks: Array.isArray(safeProject.tasks)
      ? safeProject.tasks.map(ensureStateTaskShape)
      : [],
    requests: Array.isArray(safeProject.requests) ? cloneStateValue(safeProject.requests) : [],
    invites: Array.isArray(safeProject.invites) ? cloneStateValue(safeProject.invites) : [],
    status: String(safeProject.status || "").trim(),
    finalLink: String(safeProject.finalLink || safeProject.finishedLink || "").trim(),
    completedAt: String(safeProject.completedAt || safeProject.finishedPublishedAt || "").trim(),
    isCompleted:
      Boolean(safeProject.isCompleted) ||
      String(safeProject.status || "").trim().toLowerCase() === "completed",
  };
}

function ensureStateUserDataShape(data) {
  const safeData = data && typeof data === "object" ? data : {};
  return {
    projects: Array.isArray(safeData.projects)
      ? safeData.projects.map((project) =>
          typeof project === "string"
            ? ensureStateProjectShape({ id: project })
            : ensureStateProjectShape(project),
        )
      : [],
    requests: Array.isArray(safeData.requests) ? safeData.requests : [],
    notifications: Array.isArray(safeData.notifications)
      ? safeData.notifications.map(ensureStateNotificationShape)
      : [],
  };
}

function userProjectIdList(userData) {
  return Array.isArray(userData?.projects)
    ? userData.projects
        .map((project) =>
          typeof project === "string" ? project : String(project?.id || "").trim(),
        )
        .filter(Boolean)
    : [];
}

function userHasProjectAccess(userData, projectId) {
  return userProjectIdList(userData).includes(String(projectId || "").trim());
}

function upsertUserProject(userRecord, projectInput) {
  if (!userRecord) return;
  userRecord.data = ensureStateUserDataShape(userRecord.data);
  const nextProject = ensureStateProjectShape(projectInput);
  if (!nextProject.id) return;
  const existingIndex = userRecord.data.projects.findIndex(
    (project) => project.id === nextProject.id,
  );
  if (existingIndex >= 0) {
    userRecord.data.projects[existingIndex] = {
      ...userRecord.data.projects[existingIndex],
      ...nextProject,
    };
    return;
  }
  userRecord.data.projects.push(nextProject);
}

function removeUserProject(userRecord, projectId) {
  if (!userRecord) return;
  userRecord.data = ensureStateUserDataShape(userRecord.data);
  userRecord.data.projects = userRecord.data.projects.filter(
    (project) => project.id !== String(projectId || "").trim(),
  );
}

function pushUserNotification(userRecord, notificationInput) {
  if (!userRecord) return;
  userRecord.data = ensureStateUserDataShape(userRecord.data);
  userRecord.data.notifications.unshift(
    ensureStateNotificationShape(notificationInput),
  );
}

function defaultUserRuntime(userRecord = {}, email = "") {
  const name = String(userRecord.name || email.split("@")[0] || "TeamForge User").trim();
  const usernameBase = String(
    userRecord.profile?.username || name.toLowerCase().replace(/[^a-z0-9]+/g, ""),
  ).trim();
  return {
    role: String(userRecord.role || "collaborator").trim().toLowerCase(),
    mentorApproved: false,
    mentorApplicationId: null,
    userProfile: {
      fullName: name,
      username: usernameBase || "teamforgeuser",
      bio: String(userRecord.profile?.bio || "").trim(),
      linkedin: String(userRecord.profile?.linkedin || "").trim(),
      phone: String(userRecord.phone || "").trim(),
    },
    userSkills: Array.isArray(userRecord.profile?.skills)
      ? cloneStateValue(userRecord.profile.skills)
      : [],
    auditLog: [],
    mentorApplications: [],
    ownedProjectData: {},
    collaboratorWorkspaceData: {},
    workspaceBackPage: "my-work",
    collaboratorWorkspaceTab: "overview",
    portalRole: null,
    review2: {},
  };
}

function getCurrentUserSessionEmail() {
  return normalizeStateEmail(localStorage.getItem("currentUser"));
}

function getCurrentUserRecord() {
  const currentUser = getCurrentUserSessionEmail();
  const users = getStateUsersStore();
  return users[currentUser] || null;
}

function getUserRecordForEmail(email) {
  const normalizedEmail = normalizeStateEmail(email);
  if (!normalizedEmail) return null;
  const users = getStateUsersStore();
  return users[normalizedEmail] || null;
}

function getCurrentUserData() {
  const currentUser = getCurrentUserSessionEmail();
  const users = getStateUsersStore();
  const userRecord = users[currentUser];
  if (!userRecord) return null;
  userRecord.data = ensureStateUserDataShape(userRecord.data);
  users[currentUser] = userRecord;
  saveStateUsersStore(users);
  return userRecord.data;
}

function saveCurrentUserData(userData) {
  const currentUser = getCurrentUserSessionEmail();
  if (!currentUser) return null;
  const users = getStateUsersStore();
  if (!users[currentUser]) return null;
  users[currentUser].data = ensureStateUserDataShape(userData);
  saveStateUsersStore(users);
  return users[currentUser].data;
}

function getUserRuntimeKey(email = getCurrentUserSessionEmail()) {
  return `${USER_RUNTIME_PREFIX}${normalizeStateEmail(email)}`;
}

function loadUserRuntime(email = getCurrentUserSessionEmail()) {
  const userRecord = getUserRecordForEmail(email);
  const defaults = defaultUserRuntime(userRecord || {}, email);
  try {
    const raw = localStorage.getItem(getUserRuntimeKey(email));
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const parsedProfile =
        parsed.userProfile && typeof parsed.userProfile === "object"
          ? parsed.userProfile
          : {};
      const authoritativeFullName = String(
        userRecord?.profile?.fullName || userRecord?.name || "",
      ).trim();
      const authoritativeUsername = String(userRecord?.profile?.username || "").trim();
      return {
          ...defaults,
          ...parsed,
          userProfile: {
            ...defaults.userProfile,
            ...parsedProfile,
            fullName:
              authoritativeFullName ||
              String(parsedProfile.fullName || defaults.userProfile.fullName || "").trim() ||
              "TeamForge User",
            username:
              authoritativeUsername ||
              String(parsedProfile.username || defaults.userProfile.username || "").trim() ||
              "teamforgeuser",
          },
          userSkills: Array.isArray(parsed.userSkills)
            ? parsed.userSkills
            : defaults.userSkills,
          auditLog: Array.isArray(parsed.auditLog) ? parsed.auditLog : [],
          mentorApplications: Array.isArray(parsed.mentorApplications)
            ? parsed.mentorApplications
            : [],
          ownedProjectData:
            parsed.ownedProjectData && typeof parsed.ownedProjectData === "object"
              ? parsed.ownedProjectData
              : {},
          collaboratorWorkspaceData:
            parsed.collaboratorWorkspaceData &&
            typeof parsed.collaboratorWorkspaceData === "object"
              ? parsed.collaboratorWorkspaceData
              : {},
          review2:
            parsed.review2 && typeof parsed.review2 === "object"
              ? parsed.review2
              : {},
        };
    }
    return defaults;
  } catch {
    return defaults;
  }
}

function saveUserRuntime() {
  const email = getCurrentUserSessionEmail();
  if (!email) return;
  const runtimeState = {
    role: STATE.role,
    mentorApproved: STATE.mentorApproved,
    mentorApplicationId: STATE.mentorApplicationId,
    userProfile: STATE.userProfile,
    userSkills: STATE.userSkills,
    auditLog: STATE.auditLog,
    mentorApplications: STATE.mentorApplications,
    ownedProjectData: STATE.ownedProjectData,
    collaboratorWorkspaceData: STATE.collaboratorWorkspaceData,
    workspaceBackPage: STATE.workspaceBackPage,
    collaboratorWorkspaceTab: STATE.collaboratorWorkspaceTab,
    portalRole: STATE.portalRole,
    review2: STATE.review2,
  };
  localStorage.setItem(getUserRuntimeKey(email), JSON.stringify(runtimeState));
}

function syncRuntimeProfileToAuthStore() {
  const currentUser = getCurrentUserSessionEmail();
  if (!currentUser) return;
  const users = getStateUsersStore();
  if (!users[currentUser]) return;
  const fullName = String(
    STATE.userProfile?.fullName || users[currentUser].name || "",
  ).trim();
  users[currentUser].name = fullName || users[currentUser].name;
  users[currentUser].phone = STATE.userProfile?.phone || users[currentUser].phone || "";
  users[currentUser].profile = {
    ...(users[currentUser].profile || {}),
    fullName: fullName || users[currentUser].profile?.fullName || "",
    username: STATE.userProfile?.username || "",
    bio: STATE.userProfile?.bio || "",
    linkedin: STATE.userProfile?.linkedin || "",
    phone: STATE.userProfile?.phone || "",
    skills: cloneStateValue(STATE.userSkills || []),
  };
  saveStateUsersStore(users);
}

function setCurrentUserSession(email) {
  const normalizedEmail = normalizeStateEmail(email);
  if (!normalizedEmail) return false;
  localStorage.setItem("currentUser", normalizedEmail);
  return true;
}

const currentUser = getCurrentUserSessionEmail();
const users = getStateUsersStore();
const currentUserRecord =
  currentUser && users[currentUser] ? users[currentUser] : null;
const currentRuntime = loadUserRuntime(currentUser);
const currentName =
  currentUserRecord?.profile?.fullName ||
  currentUserRecord?.name ||
  currentRuntime.userProfile?.fullName ||
  "TeamForge User";

const STATE = {
  currentUser: {
    name: currentName,
    email: currentUser || "",
    initials:
      currentName
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join("") || "TF",
  },
  role: String(currentUserRecord?.role || currentRuntime.role || "collaborator").trim().toLowerCase(),
  mentorApproved: Boolean(currentRuntime.mentorApproved),
  mentorApplicationId: currentRuntime.mentorApplicationId || null,
  isSuperUser: false,
  userProfile: currentRuntime.userProfile,
  userSkills: currentRuntime.userSkills,
  auditLog: currentRuntime.auditLog,
  mentorApplications: currentRuntime.mentorApplications,
  sidebarCollapsed: false,
  ownedProjectData: currentRuntime.ownedProjectData,
  ownedTaskModalOpen: false,
  collaboratorWorkspaceTab: currentRuntime.collaboratorWorkspaceTab || "overview",
  collaboratorWorkspaceData: currentRuntime.collaboratorWorkspaceData,
  workspaceBackPage: currentRuntime.workspaceBackPage || "my-work",
  collaboratorProofModalOpen: false,
  collaboratorProofTaskIndex: null,
  collaboratorProofLink: "",
  portalRole: currentRuntime.portalRole || null,
  review2: currentRuntime.review2 || {},
};

window.addEventListener("beforeunload", () => {
  saveUserRuntime();
  syncRuntimeProfileToAuthStore();
  const latestUserData = getCurrentUserData();
  if (latestUserData) {
    saveCurrentUserData(latestUserData);
  }
});

function loadViewState() {
  try {
    const raw = sessionStorage.getItem(VIEW_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function saveViewState() {
  saveUserRuntime();
  syncRuntimeProfileToAuthStore();
  const latestUserData = getCurrentUserData();
  if (latestUserData) {
    saveCurrentUserData(latestUserData);
  }

  try {
    const review2State =
      STATE.review2 && typeof STATE.review2 === "object"
        ? {
            myWorkFilter: STATE.review2.myWorkFilter || "ongoing",
            ownerProjectsFilter: STATE.review2.ownerProjectsFilter || "ongoing",
            ownerMentorProjectId: STATE.review2.ownerMentorProjectId || "",
          }
        : {};

    sessionStorage.setItem(
      VIEW_STATE_KEY,
      JSON.stringify({
        currentUserEmail: getCurrentUserSessionEmail(),
        role: STATE.role,
        selectedProject: STATE.selectedProject || "",
        workspaceMode: STATE.workspaceMode || "",
        workspaceBackPage: STATE.workspaceBackPage || "",
        collaboratorWorkspaceTab: STATE.collaboratorWorkspaceTab || "overview",
        ownedWorkspaceTab: STATE.ownedWorkspaceTab || "overview",
        ownedProjectsView: STATE.ownedProjectsView || "my-projects",
        portalRole: STATE.portalRole || null,
        review2: review2State,
      }),
    );
  } catch {
    // Ignore session storage failures.
  }
}

function reinitializeStateForUser(email) {
  const normalizedEmail = normalizeStateEmail(email);
  if (!normalizedEmail) return;
  localStorage.setItem("currentUser", normalizedEmail);
  const users = getStateUsersStore();
  const userRecord = users[normalizedEmail] || null;
  const runtime = loadUserRuntime(normalizedEmail);
  const name =
    userRecord?.profile?.fullName ||
    userRecord?.name ||
    runtime.userProfile?.fullName ||
    normalizedEmail.split("@")[0] ||
    "TeamForge User";

  STATE.currentUser = {
    name: name,
    email: normalizedEmail,
    initials: name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("") || "TF",
  };
  STATE.role = String(userRecord?.role || runtime.role || "collaborator").trim().toLowerCase();
  STATE.mentorApproved = Boolean(runtime.mentorApproved);
  STATE.mentorApplicationId = runtime.mentorApplicationId || null;
  STATE.isSuperUser = false;
  STATE.userProfile = runtime.userProfile;
  STATE.userSkills = runtime.userSkills;
  STATE.auditLog = runtime.auditLog;
  STATE.mentorApplications = runtime.mentorApplications;
  STATE.ownedProjectData = runtime.ownedProjectData;
  STATE.ownedTaskModalOpen = false;
  STATE.collaboratorWorkspaceTab = runtime.collaboratorWorkspaceTab || "overview";
  STATE.collaboratorWorkspaceData = runtime.collaboratorWorkspaceData;
  STATE.workspaceBackPage = runtime.workspaceBackPage || "my-work";
  STATE.collaboratorProofModalOpen = false;
  STATE.collaboratorProofTaskIndex = null;
  STATE.collaboratorProofLink = "";
  STATE.portalRole = runtime.portalRole || null;
  STATE.review2 = runtime.review2 || {};
  STATE.selectedProject = "";
  STATE.workspaceMode = "";

  // Clear stale session view state so the new user doesn't inherit the old user's view
  try { sessionStorage.removeItem(VIEW_STATE_KEY); } catch { /* ignore */ }
}

function cleanSessionForNewLogin() {
  // Remove stale review2 runtime so new user doesn't inherit old project state
  try { localStorage.removeItem("teamforge.review2SharedRuntime"); } catch { /* ignore */ }
  try { localStorage.removeItem("teamforge.backendUserId"); } catch { /* ignore */ }
  try { sessionStorage.removeItem(VIEW_STATE_KEY); } catch { /* ignore */ }
}

(function hydrateViewState() {
  const persisted = loadViewState();
  if (!persisted) return;
  const sessionUserEmail = getCurrentUserSessionEmail();
  if (
    String(persisted.currentUserEmail || "").trim().toLowerCase() !==
    String(sessionUserEmail || "").trim().toLowerCase()
  ) {
    try {
      sessionStorage.removeItem(VIEW_STATE_KEY);
    } catch {
      // Ignore session storage failures.
    }
    return;
  }

  if (currentUserRecord && currentUserRecord.role) {
    STATE.role = String(currentUserRecord.role).trim().toLowerCase();
  } else if (
    persisted.role === "collaborator" ||
    persisted.role === "project-owner" ||
    persisted.role === "mentor"
  ) {
    STATE.role = persisted.role;
  }
  if (typeof persisted.selectedProject === "string") {
    STATE.selectedProject = persisted.selectedProject;
  }
  if (typeof persisted.workspaceMode === "string") {
    STATE.workspaceMode = persisted.workspaceMode;
  }
  if (typeof persisted.workspaceBackPage === "string") {
    STATE.workspaceBackPage = persisted.workspaceBackPage;
  }
  if (typeof persisted.collaboratorWorkspaceTab === "string") {
    STATE.collaboratorWorkspaceTab = persisted.collaboratorWorkspaceTab;
  }
  if (typeof persisted.ownedWorkspaceTab === "string") {
    STATE.ownedWorkspaceTab = persisted.ownedWorkspaceTab;
  }
  if (typeof persisted.ownedProjectsView === "string") {
    STATE.ownedProjectsView = persisted.ownedProjectsView;
  }
  if (
    persisted.portalRole === null ||
    persisted.portalRole === "admin" ||
    persisted.portalRole === "superuser"
  ) {
    STATE.portalRole = persisted.portalRole;
  }
  if (persisted.review2 && typeof persisted.review2 === "object") {
    STATE.review2 = {
      ...(STATE.review2 || {}),
      myWorkFilter: persisted.review2.myWorkFilter || "ongoing",
      ownerProjectsFilter: persisted.review2.ownerProjectsFilter || "ongoing",
      ownerMentorProjectId: persisted.review2.ownerMentorProjectId || "",
    };
  }
})();
