const AUTH_KEYS = {
  USERS: "users",
  CURRENT_USER: "currentUser",
  IS_SUPERUSER: "teamforge.isSuperUser",
};

function cloneAuthValue(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function getInitialsFromAuthName(name) {
  return String(name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("") || "TF";
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeUsername(username) {
  return String(username || "").trim().toLowerCase();
}

function ensureAuthNotificationShape(notification) {
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

function ensureAuthProjectShape(project) {
  const safeProject = project && typeof project === "object" ? project : {};
  return {
    id: String(safeProject.id || "").trim(),
    name: String(safeProject.name || safeProject.projectName || "").trim(),
    owner: String(safeProject.owner || safeProject.ownerEmail || "").trim(),
    ownerName: String(safeProject.ownerName || safeProject.owner || "").trim(),
    members: Array.isArray(safeProject.members) ? cloneAuthValue(safeProject.members) : [],
    mentors: Array.isArray(safeProject.mentors) ? cloneAuthValue(safeProject.mentors) : [],
    tasks: Array.isArray(safeProject.tasks) ? cloneAuthValue(safeProject.tasks) : [],
    requests: Array.isArray(safeProject.requests) ? cloneAuthValue(safeProject.requests) : [],
    invites: Array.isArray(safeProject.invites) ? cloneAuthValue(safeProject.invites) : [],
    status: String(safeProject.status || "").trim(),
    finalLink: String(safeProject.finalLink || safeProject.finishedLink || "").trim(),
    completedAt: String(safeProject.completedAt || safeProject.finishedPublishedAt || "").trim(),
    isCompleted:
      Boolean(safeProject.isCompleted) ||
      String(safeProject.status || "").trim().toLowerCase() === "completed",
  };
}

function ensureUserDataShape(data) {
  const safeData = data && typeof data === "object" ? data : {};
  return {
    projects: Array.isArray(safeData.projects)
      ? safeData.projects.map((project) =>
          typeof project === "string"
            ? ensureAuthProjectShape({ id: project })
            : ensureAuthProjectShape(project),
        )
      : [],
    requests: Array.isArray(safeData.requests) ? safeData.requests : [],
    notifications: Array.isArray(safeData.notifications)
      ? safeData.notifications.map(ensureAuthNotificationShape)
      : [],
  };
}

function getStoredUsers() {
  try {
    const raw = localStorage.getItem(AUTH_KEYS.USERS);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveStoredUsers(users) {
  localStorage.setItem(AUTH_KEYS.USERS, JSON.stringify(users));
}

function migrateLegacyStoredUsers(users) {
  const nextUsers = {};
  Object.entries(users || {}).forEach(([key, value]) => {
    if (!value || typeof value !== "object") return;
    const normalizedKey = normalizeEmail(key || value.email);
    if (!normalizedKey) return;
    nextUsers[normalizedKey] = {
      ...value,
      email: normalizedKey,
      name: String(value.name || normalizedKey.split("@")[0]).trim(),
      password: String(value.password || ""),
      profile:
        value.profile && typeof value.profile === "object"
          ? value.profile
          : {},
      data: ensureUserDataShape(value.data),
    };
  });
  return nextUsers;
}

function findUserByIdentifier(identifier, users = getStoredUsers()) {
  const rawIdentifier = String(identifier || "").trim();
  if (!rawIdentifier) return null;

  const email = normalizeEmail(rawIdentifier);
  if (users[email]) {
    return { email, user: users[email] };
  }

  const username = normalizeUsername(rawIdentifier);
  const match = Object.entries(users).find(([, user]) => {
    const storedUsername = normalizeUsername(user?.profile?.username);
    return storedUsername && storedUsername === username;
  });

  return match ? { email: match[0], user: match[1] } : null;
}

function initializeAuthUsersFromSeed(seedUsers = window.SEED_USERS) {
  const existingUsers = migrateLegacyStoredUsers(getStoredUsers());
  const nextUsers = { ...existingUsers };

  if (Array.isArray(seedUsers)) {
    seedUsers.forEach((seed) => {
      const email = normalizeEmail(seed?.email);
      if (!email) return;
      const existing = nextUsers[email];
      nextUsers[email] = {
        email,
        name: String(seed?.name || existing?.name || email.split("@")[0]).trim(),
        password: String(seed?.password || existing?.password || ""),
        phone: String(seed?.phone || existing?.phone || "").trim(),
        status: String(existing?.status || "active").trim().toLowerCase() || "active",
        flagged: Boolean(existing?.flagged),
        profile:
          seed?.profile && typeof seed.profile === "object"
            ? { ...(existing?.profile || {}), ...cloneAuthValue(seed.profile) }
            : cloneAuthValue(existing?.profile || {}),
        data: ensureUserDataShape(existing?.data),
      };
    });
  }

  saveStoredUsers(nextUsers);
  return nextUsers;
}

function getCurrentUserEmail() {
  return normalizeEmail(localStorage.getItem(AUTH_KEYS.CURRENT_USER));
}

function isUserLoggedIn() {
  return Boolean(getCurrentUserEmail());
}

function isSuperUser() {
  return sessionStorage.getItem(AUTH_KEYS.IS_SUPERUSER) === "true";
}

function loginUser(email, isSuperUserFlag = false) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return false;
  localStorage.setItem(AUTH_KEYS.CURRENT_USER, normalizedEmail);
  if (isSuperUserFlag) {
    sessionStorage.setItem(AUTH_KEYS.IS_SUPERUSER, "true");
  } else {
    sessionStorage.removeItem(AUTH_KEYS.IS_SUPERUSER);
  }
  return true;
}

function logoutUser() {
  localStorage.removeItem(AUTH_KEYS.CURRENT_USER);
  sessionStorage.removeItem(AUTH_KEYS.IS_SUPERUSER);
}

function getCurrentUser() {
  const email = getCurrentUserEmail();
  if (!email) return null;
  const users = getStoredUsers();
  const user = users[email];
  if (!user) return null;
  return {
    email,
    name: user.name || email.split("@")[0],
    initials: getInitialsFromAuthName(user.name || email),
  };
}

function validateUserLogin(email, password) {
  const users = initializeAuthUsersFromSeed();
  const match = findUserByIdentifier(email, users);
  if (!match) return { ok: false, reason: "Username or email not found." };
  const { email: normalizedEmail, user } = match;
  if (String(user?.status || "").trim().toLowerCase() === "suspended") {
    return { ok: false, reason: "This account is suspended. Contact support." };
  }
  if (user.password !== password) {
    return { ok: false, reason: "Incorrect password." };
  }
  return { ok: true, email: normalizedEmail, user };
}

function createUserAccount({ email, username = "", password, name = "", phone = "" }) {
  const users = initializeAuthUsersFromSeed();
  const normalizedEmail = normalizeEmail(email);
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedEmail) {
    return { ok: false, reason: "Email is required." };
  }
  if (!normalizedUsername) {
    return { ok: false, reason: "Username is required." };
  }
  if (users[normalizedEmail]) {
    return { ok: false, reason: "An account with this email already exists." };
  }
  const existingUsername = findUserByIdentifier(normalizedUsername, users);
  if (existingUsername) {
    return { ok: false, reason: "This username is already taken." };
  }

  users[normalizedEmail] = {
    email: normalizedEmail,
    name: String(name || normalizedEmail.split("@")[0]).trim(),
    password: String(password || ""),
    phone: String(phone || "").trim(),
    status: "active",
    flagged: false,
    profile: {
      username: normalizedUsername,
      bio: "",
      linkedin: "",
      phone: String(phone || "").trim(),
      skills: [],
      university: "",
      xp: 0,
      rep: 0,
      createdAt: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    },
    data: {
      projects: [],
      requests: [],
      notifications: [],
    },
  };

  saveStoredUsers(users);
  return { ok: true, email: normalizedEmail, user: users[normalizedEmail] };
}
