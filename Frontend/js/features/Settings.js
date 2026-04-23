
function renderSettings() {
  hydrateProfileData();
  applyProfileDataToSettingsForm();
  applyProfileIdentityToUI();

  renderSkills();
  const savedTheme = localStorage.getItem("teamforge.theme") || "light";
  const themeSelect = document.getElementById("theme-select");
  if (themeSelect) themeSelect.value = savedTheme;
  applyTheme(savedTheme);

  const notifToggles = [
    {
      key: "taskAssigned",
      label: "Task Assigned",
      sub: "When a task is assigned to you",
      on: true,
    },
    {
      key: "taskApproved",
      label: "Task Approved",
      sub: "When your task gets approved",
      on: true,
    },
    {
      key: "projectInvite",
      label: "Project Invite",
      sub: "When invited to a project",
      on: true,
    },
    {
      key: "mentorRequest",
      label: "Mentor Request",
      sub: "When someone requests mentorship",
      on: false,
    },
    {
      key: "weeklyDigest",
      label: "Weekly Digest",
      sub: "Summary of your activity",
      on: true,
    },
  ];
  document.getElementById("notif-toggles").innerHTML = notifToggles
    .map((t) => makeToggle(t))
    .join("");

  const privacyToggles = [
    {
      key: "publicProfile",
      label: "Public Profile",
      sub: "Others can view your profile",
      on: true,
    },
    {
      key: "showXP",
      label: "Show XP on Profile",
      sub: "Display your XP publicly",
      on: true,
    },
    {
      key: "showOnLeaderboard",
      label: "Appear on Leaderboard",
      sub: "Show in public rankings",
      on: true,
    },
  ];
  document.getElementById("privacy-toggles").innerHTML = privacyToggles
    .map((t) => makeToggle(t))
    .join("");
}

const USER_PROFILE_STORAGE_KEY = "teamforge.userProfile";
const INDIAN_PHONE_RE = /^[6-9]\d{9}$/;

function clearPhoneValidationError() {
  const errorEl = document.getElementById("settings-phone-error");
  const input = document.getElementById("settings-phone");
  if (errorEl) {
    errorEl.textContent = "";
    errorEl.style.display = "none";
  }
  if (input) {
    input.removeAttribute("aria-invalid");
  }
}

function showPhoneValidationError(message) {
  const errorEl = document.getElementById("settings-phone-error");
  const input = document.getElementById("settings-phone");
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = "block";
  }
  if (input) {
    input.setAttribute("aria-invalid", "true");
  }
}

function getCurrentSettingsUserRecord() {
  const currentUser = typeof getCurrentUserSessionEmail === "function"
    ? getCurrentUserSessionEmail()
    : "";
  const users = typeof getStateUsersStore === "function" ? getStateUsersStore() : {};
  return currentUser && users[currentUser] ? users[currentUser] : null;
}

function hydrateProfileData() {
  const userRecord = getCurrentSettingsUserRecord();
  const stored = userRecord?.profile || null;
  const base = STATE.userProfile || {};
  const currentName = STATE.currentUser?.name || userRecord?.name || "Arjun Sharma";
  const merged = {
    fullName: String(stored?.fullName || base.fullName || currentName).trim() || currentName,
    username:
      String(
        stored?.username ||
          base.username ||
          currentName.toLowerCase().replace(/[^a-z0-9]+/g, ""),
      ).trim() || "teamforgeuser",
    bio:
      String(
        stored?.bio ||
          base.bio ||
          "",
      ).trim(),
    linkedin: String(stored?.linkedin || base.linkedin || "").trim(),
    phone: String(stored?.phone || userRecord?.phone || base.phone || "").trim(),
  };

  STATE.userProfile = merged;
  STATE.currentUser.name = merged.fullName;
  if (typeof syncRuntimeProfileToAuthStore === "function") {
    syncRuntimeProfileToAuthStore();
  }
  if (typeof saveUserRuntime === "function") {
    saveUserRuntime();
  }

  return merged;
}

function applyProfileDataToSettingsForm() {
  const profile = STATE.userProfile || hydrateProfileData();

  const fullNameInput = document.getElementById("settings-full-name");
  const usernameInput = document.getElementById("settings-username");
  const bioInput = document.getElementById("settings-bio");
  const phoneInput = document.getElementById("settings-phone");
  const linkedinInput = document.getElementById("settings-linkedin");

  if (fullNameInput) fullNameInput.value = profile.fullName || "";
  if (usernameInput) usernameInput.value = profile.username || "";
  if (bioInput) bioInput.value = profile.bio || "";
  if (phoneInput) phoneInput.value = profile.phone || "";
  if (linkedinInput) linkedinInput.value = profile.linkedin || "";
  clearPhoneValidationError();
}

function applyProfileIdentityToUI() {
  const profile = STATE.userProfile || hydrateProfileData();
  const fullName = profile.fullName || "Arjun Sharma";

  const avatarName = document.querySelector(".avatar-name");
  if (avatarName) avatarName.textContent = fullName;

  const userHeader = document.querySelector("#user-dd .dropdown-header p");
  if (userHeader) userHeader.textContent = fullName;

  const userEmail = document.querySelector("#user-dd .dropdown-header .text-xs");
  if (userEmail) userEmail.textContent = STATE.currentUser?.email || "";

  const avatar = document.getElementById("header-avatar");
  if (avatar) {
    avatar.textContent = fullName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("") || "TF";
  }

  const dashboardSubtitle = document.querySelector("#page-dashboard .page-subtitle");
  if (dashboardSubtitle) {
    const mentorBadge = document.getElementById("mentor-badge-header");
    const mentorBadgeHtml = mentorBadge ? ` ${mentorBadge.outerHTML}` : "";
    dashboardSubtitle.innerHTML = `Welcome back, ${fullName}!${mentorBadgeHtml}`;
  }
}

const THEME_TOKENS = {
  light: {
    "--bg": "hsl(140, 9%, 96%)",
    "--fg": "hsl(30, 3%, 3%)",
    "--card": "hsl(0, 0%, 100%)",
    "--card-fg": "hsl(30, 3%, 3%)",
    "--primary": "hsl(33, 20%, 31%)",
    "--primary-fg": "hsl(140, 9%, 96%)",
    "--secondary": "hsl(140, 6%, 91%)",
    "--secondary-fg": "hsl(33, 20%, 31%)",
    "--muted": "hsl(140, 6%, 93%)",
    "--muted-fg": "hsl(30, 5%, 45%)",
    "--accent": "hsl(28, 20%, 58%)",
    "--accent-fg": "#fff",
    "--border": "hsl(30, 8%, 88%)",
    "--sidebar-bg": "#fff",
    "--sidebar-border": "hsl(30, 8%, 90%)",
    "--shadow-card":
      "0 1px 3px 0 rgba(10, 9, 8, 0.04), 0 1px 2px -1px rgba(10, 9, 8, 0.04)",
    "--shadow-hover":
      "0 4px 12px -2px rgba(10, 9, 8, 0.08), 0 2px 6px -2px rgba(10, 9, 8, 0.04)",

    /* Secondary token system in style.css (legacy/marketing section) */
    "--color-brand": "#5f513f",
    "--color-gray-900": "#111827",
    "--color-gray-800": "#1f2937",
    "--color-gray-600": "#4b5563",
    "--color-gray-500": "#6b7280",
    "--color-gray-400": "#9ca3af",
    "--color-gray-300": "#d1d5db",
    "--color-gray-200": "#e5e7eb",
    "--color-gray-100": "#f3f4f6",
    "--color-gray-50": "#f9fafb",
    "--color-white": "#ffffff",
    "--color-black": "#000000",
    "--bg-surface": "#fafafa",
    "--bg-muted": "#eaeaea66",
  },
  dark: {
    "--bg": "hsl(220, 24%, 10%)",
    "--fg": "hsl(210, 25%, 92%)",
    "--card": "hsl(220, 20%, 14%)",
    "--card-fg": "hsl(210, 25%, 92%)",
    "--primary": "hsl(33, 30%, 54%)",
    "--primary-fg": "hsl(220, 24%, 10%)",
    "--secondary": "hsl(220, 18%, 20%)",
    "--secondary-fg": "hsl(210, 24%, 90%)",
    "--muted": "hsl(220, 18%, 18%)",
    "--muted-fg": "hsl(215, 14%, 68%)",
    "--accent": "hsl(28, 36%, 60%)",
    "--accent-fg": "hsl(220, 24%, 10%)",
    "--border": "hsl(220, 16%, 24%)",
    "--sidebar-bg": "hsl(220, 22%, 12%)",
    "--sidebar-border": "hsl(220, 14%, 22%)",
    "--shadow-card":
      "0 1px 3px 0 rgba(0, 0, 0, 0.45), 0 1px 2px -1px rgba(0, 0, 0, 0.35)",
    "--shadow-hover":
      "0 10px 20px -8px rgba(0, 0, 0, 0.55), 0 4px 10px -6px rgba(0, 0, 0, 0.35)",

    /* Secondary token system in style.css (legacy/marketing section) */
    "--color-brand": "#b88f63",
    "--color-gray-900": "#e5e7eb",
    "--color-gray-800": "#d1d5db",
    "--color-gray-600": "#aab2bf",
    "--color-gray-500": "#8f98a6",
    "--color-gray-400": "#7b8494",
    "--color-gray-300": "#3a4251",
    "--color-gray-200": "#2f3744",
    "--color-gray-100": "#252c39",
    "--color-gray-50": "#1c2431",
    "--color-white": "#141a24",
    "--color-black": "#f3f4f6",
    "--bg-surface": "#151c27",
    "--bg-muted": "rgba(148, 163, 184, 0.14)",
  },
};

function setThemeTokens(mode) {
  const tokens = THEME_TOKENS[mode] || THEME_TOKENS.light;
  const root = document.documentElement;
  Object.entries(tokens).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

function makeToggle(t) {
  return `<div class="toggle-row">
    <div>
      <div class="toggle-label">${t.label}</div>
      <div class="toggle-sub">${t.sub}</div>
    </div>
    <label class="toggle">
      <input type="checkbox" ${t.on ? "checked" : ""}>
      <div class="toggle-track"></div>
      <div class="toggle-thumb"></div>
    </label>
  </div>`;
}

function renderSkills() {
  const container = document.getElementById("skills-container");
  if (!container) return;
  container.innerHTML = STATE.userSkills
    .map(
      (s) => `
    <span class="badge badge-secondary" style="gap:5px;padding:4px 10px;font-size:.78rem">
      ${s}
      <button onclick="removeSkill('${s}')" style="background:none;border:none;cursor:pointer;color:var(--muted-fg);font-size:.9rem;line-height:1;padding:0">&times;</button>
    </span>
  `,
    )
    .join("");
}

function addSkill() {
  const input = document.getElementById("skill-input");
  if (!input) return;
  const val = input.value.trim().replace(/\s+/g, " ");
  if (!val) {
    showToast("Skill cannot be empty");
    return;
  }
  if (val.length < 2 || val.length > 40) {
    showToast("Skill must be 2 to 40 characters");
    return;
  }
  if (!/^[a-zA-Z0-9+#.\-\s]+$/.test(val)) {
    showToast("Skill contains invalid characters");
    return;
  }
  if (STATE.userSkills.some((skill) => skill.toLowerCase() === val.toLowerCase())) {
    showToast("Skill already added");
    return;
  }
  if (STATE.userSkills.length >= 20) {
    showToast("You can add up to 20 skills");
    return;
  }
  STATE.userSkills.push(val);
  if (typeof syncRuntimeProfileToAuthStore === "function") {
    syncRuntimeProfileToAuthStore();
  }
  if (typeof saveUserRuntime === "function") {
    saveUserRuntime();
  }
  input.value = "";
  renderSkills();
}

function removeSkill(skill) {
  STATE.userSkills = STATE.userSkills.filter((s) => s !== skill);
  if (typeof syncRuntimeProfileToAuthStore === "function") {
    syncRuntimeProfileToAuthStore();
  }
  if (typeof saveUserRuntime === "function") {
    saveUserRuntime();
  }
  renderSkills();
}

function applyTheme(val) {
  const mode = val === "dark" ? "dark" : "light";
  setThemeTokens(mode);
  document.documentElement.setAttribute("data-theme", mode);
  localStorage.setItem("teamforge.theme", mode);

  const themeSelect = document.getElementById("theme-select");
  if (themeSelect && themeSelect.value !== mode) {
    themeSelect.value = mode;
  }
}

function saveProfileSettings() {
  const fullNameInput = document.getElementById("settings-full-name");
  const usernameInput = document.getElementById("settings-username");
  const bioInput = document.getElementById("settings-bio");
  const phoneInput = document.getElementById("settings-phone");
  const linkedinInput = document.getElementById("settings-linkedin");

  if (!fullNameInput || !usernameInput || !bioInput || !phoneInput || !linkedinInput) {
    showToast("Profile settings form is unavailable");
    return;
  }

  const fullName = fullNameInput.value.trim().replace(/\s+/g, " ");
  const username = usernameInput.value.trim();
  const bio = bioInput.value.trim();
  const phone = phoneInput.value.trim();
  const linkedin = linkedinInput.value.trim();

  clearPhoneValidationError();

  if (!fullName) {
    showToast("Full name is required");
    return;
  }
  if (fullName.length < 2 || fullName.length > 60) {
    showToast("Full name must be 2 to 60 characters");
    return;
  }
  if (!/^[a-zA-Z][a-zA-Z\s.'-]*$/.test(fullName)) {
    showToast("Full name contains invalid characters");
    return;
  }

  if (!username) {
    showToast("Username is required");
    return;
  }
  if (!/^[a-zA-Z0-9._-]{3,30}$/.test(username)) {
    showToast("Username must be 3-30 chars using letters, numbers, . _ -");
    return;
  }

  if (!bio) {
    showToast("Bio is required");
    return;
  }
  if (bio.length < 10 || bio.length > 180) {
    showToast("Bio must be 10 to 180 characters");
    return;
  }

  if (!phone) {
    showPhoneValidationError("Phone number is required.");
    showToast("Phone number is required");
    return;
  }
  if (!INDIAN_PHONE_RE.test(phone)) {
    showPhoneValidationError("Enter a valid Indian phone number.");
    showToast("Phone number must match Indian format");
    return;
  }

  if (linkedin) {
    let parsed;
    try {
      parsed = new URL(linkedin);
    } catch {
      showToast("Enter a valid LinkedIn URL");
      return;
    }
    if (
      !(parsed.protocol === "https:" || parsed.protocol === "http:") ||
      !/linkedin\.com$/i.test(parsed.hostname.replace(/^www\./i, ""))
    ) {
      showToast("LinkedIn URL must be on linkedin.com");
      return;
    }
  }

  STATE.userProfile = {
    ...(STATE.userProfile || {}),
    fullName,
    username,
    bio,
    phone,
    linkedin,
  };
  STATE.currentUser.name = fullName;

  applyProfileIdentityToUI();
  if (typeof syncRuntimeProfileToAuthStore === "function") {
    syncRuntimeProfileToAuthStore();
  }
  if (typeof saveUserRuntime === "function") {
    saveUserRuntime();
  }

  if (typeof renderProfile === "function") {
    const activeProfilePage = document.getElementById("page-profile");
    if (activeProfilePage?.classList.contains("active")) {
      renderProfile(null);
    }
  }

  showToast("Profile settings saved");
}

function saveNotificationSettings() {
  const toggles = document.querySelectorAll("#notif-toggles input[type='checkbox']");
  if (!toggles.length) {
    showToast("Notification settings are unavailable");
    return;
  }
  showToast("Notification settings saved");
}

function savePrivacySettings() {
  const toggles = document.querySelectorAll("#privacy-toggles input[type='checkbox']");
  if (!toggles.length) {
    showToast("Privacy settings are unavailable");
    return;
  }
  showToast("Privacy settings saved");
}

function saveAppearanceSettings() {
  const themeSelect = document.getElementById("theme-select");
  if (!themeSelect) {
    showToast("Appearance settings are unavailable");
    return;
  }
  const mode = themeSelect.value;
  if (mode !== "light" && mode !== "dark") {
    showToast("Select a valid theme mode");
    return;
  }
  applyTheme(mode);
  showToast("Appearance saved");
}

// Apply saved theme on initial script load so the app does not flash wrong colors.
applyTheme(localStorage.getItem("teamforge.theme") || "light");
