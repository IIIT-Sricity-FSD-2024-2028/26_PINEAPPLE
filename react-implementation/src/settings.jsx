import React from "react";
import "./SettingsPage.css";

const DEFAULT_NOTIFICATION_SETTINGS = [
  {
    key: "taskAssigned",
    label: "Task Assigned",
    sub: "When a task is assigned to you",
    enabled: true,
  },
  {
    key: "taskApproved",
    label: "Task Approved",
    sub: "When your task gets approved",
    enabled: true,
  },
  {
    key: "projectInvite",
    label: "Project Invite",
    sub: "When invited to a project",
    enabled: true,
  },
  {
    key: "mentorRequest",
    label: "Mentor Request",
    sub: "When someone requests mentorship",
    enabled: false,
  },
  {
    key: "weeklyDigest",
    label: "Weekly Digest",
    sub: "Summary of your activity",
    enabled: true,
  },
];

const DEFAULT_PRIVACY_SETTINGS = [
  {
    key: "publicProfile",
    label: "Public Profile",
    sub: "Others can view your profile",
    enabled: true,
  },
  {
    key: "showXP",
    label: "Show XP on Profile",
    sub: "Display your XP publicly",
    enabled: true,
  },
  {
    key: "showOnLeaderboard",
    label: "Appear on Leaderboard",
    sub: "Show in public rankings",
    enabled: true,
  },
];

const INDIAN_PHONE_RE = /^[6-9]\d{9}$/;

function normalizeProfile(profile = {}) {
  return {
    fullName: profile.fullName || "TeamForge User",
    username: profile.username || "teamforgeuser",
    bio: profile.bio || "",
    phone: profile.phone || "",
    linkedin: profile.linkedin || "",
  };
}

function buildInitialNotifications(items = DEFAULT_NOTIFICATION_SETTINGS) {
  return items.map((item) => ({
    ...item,
    enabled: Boolean(item.enabled),
  }));
}

function buildInitialPrivacy(items = DEFAULT_PRIVACY_SETTINGS) {
  return items.map((item) => ({
    ...item,
    enabled: Boolean(item.enabled),
  }));
}

function ToggleRow({ item, onToggle }) {
  return React.createElement(
    "div",
    { className: "tf-toggle-row" },
    React.createElement(
      "div",
      { className: "tf-toggle-copy" },
      React.createElement("div", { className: "tf-toggle-label" }, item.label),
      React.createElement("div", { className: "tf-toggle-sub" }, item.sub),
    ),
    React.createElement(
      "label",
      { className: "tf-toggle" },
      React.createElement("input", {
        type: "checkbox",
        checked: Boolean(item.enabled),
        onChange: () => onToggle(item.key),
      }),
      React.createElement("span", { className: "tf-toggle-track" }),
      React.createElement("span", { className: "tf-toggle-thumb" }),
    ),
  );
}

export default function SettingsPage({
  initialProfile = {},
  initialSkills = [],
  initialNotifications = DEFAULT_NOTIFICATION_SETTINGS,
  initialPrivacy = DEFAULT_PRIVACY_SETTINGS,
  theme = "light",
  onSave,
}) {
  const [profile, setProfile] = React.useState(() => normalizeProfile(initialProfile));
  const [skills, setSkills] = React.useState(Array.isArray(initialSkills) ? [...initialSkills] : []);
  const [notifications, setNotifications] = React.useState(() => buildInitialNotifications(initialNotifications));
  const [privacy, setPrivacy] = React.useState(() => buildInitialPrivacy(initialPrivacy));
  const [selectedTheme, setSelectedTheme] = React.useState(theme);
  const [skillInput, setSkillInput] = React.useState("");
  const [phoneError, setPhoneError] = React.useState("");
  const [statusMessage, setStatusMessage] = React.useState("");

  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", selectedTheme);
  }, [selectedTheme]);

  const updateProfileField = (field) => (event) => {
    const value = event.target.value;
    setProfile((current) => ({ ...current, [field]: value }));

    if (field === "phone") {
      setPhoneError("");
    }
  };

  const toggleNotification = (key) => {
    setNotifications((current) =>
      current.map((item) =>
        item.key === key ? { ...item, enabled: !item.enabled } : item,
      ),
    );
  };

  const togglePrivacy = (key) => {
    setPrivacy((current) =>
      current.map((item) =>
        item.key === key ? { ...item, enabled: !item.enabled } : item,
      ),
    );
  };

  const addSkill = () => {
    const cleaned = skillInput.trim().replace(/\s+/g, " ");

    if (!cleaned) {
      setStatusMessage("Skill cannot be empty");
      return;
    }

    if (cleaned.length < 2 || cleaned.length > 40) {
      setStatusMessage("Skill must be 2 to 40 characters");
      return;
    }

    if (!/^[a-zA-Z0-9+#.\-\s]+$/.test(cleaned)) {
      setStatusMessage("Skill contains invalid characters");
      return;
    }

    if (skills.some((skill) => skill.toLowerCase() === cleaned.toLowerCase())) {
      setStatusMessage("Skill already added");
      return;
    }

    setSkills((current) => [...current, cleaned]);
    setSkillInput("");
    setStatusMessage("Skill added");
  };

  const removeSkill = (targetSkill) => {
    setSkills((current) => current.filter((skill) => skill !== targetSkill));
  };

  const validateProfile = () => {
    const fullName = profile.fullName.trim();
    const username = profile.username.trim();
    const phone = profile.phone.trim();
    const bio = profile.bio.trim();

    if (!fullName) {
      setStatusMessage("Full name is required");
      return false;
    }

    if (fullName.length < 2 || fullName.length > 60) {
      setStatusMessage("Full name must be 2 to 60 characters");
      return false;
    }

    if (!/^[a-zA-Z][a-zA-Z\s.'-]*$/.test(fullName)) {
      setStatusMessage("Full name contains invalid characters");
      return false;
    }

    if (!username) {
      setStatusMessage("Username is required");
      return false;
    }

    if (!/^[a-zA-Z0-9._-]{3,30}$/.test(username)) {
      setStatusMessage("Username must be 3-30 chars using letters, numbers, . _ -");
      return false;
    }

    if (bio && (bio.length < 10 || bio.length > 180)) {
      setStatusMessage("Bio must be 10 to 180 characters when provided");
      return false;
    }

    if (phone && !INDIAN_PHONE_RE.test(phone)) {
      setPhoneError("Enter a valid Indian phone number.");
      setStatusMessage("Phone number must match Indian format");
      return false;
    }

    if (profile.linkedin) {
      try {
        const parsed = new URL(profile.linkedin);
        const host = parsed.hostname.replace(/^www\./i, "");
        const validProtocol = parsed.protocol === "https:" || parsed.protocol === "http:";
        const validHost = /linkedin\.com$/i.test(host);

        if (!validProtocol || !validHost) {
          setStatusMessage("LinkedIn URL must be on linkedin.com");
          return false;
        }
      } catch (error) {
        setStatusMessage("Enter a valid LinkedIn URL");
        return false;
      }
    }

    setPhoneError("");
    return true;
  };

  const handleSave = (event) => {
    event.preventDefault();

    if (!validateProfile()) {
      return;
    }

    const payload = {
      profile,
      skills,
      notifications,
      privacy,
      theme: selectedTheme,
    };

    if (typeof onSave === "function") {
      onSave(payload);
    }

    setStatusMessage("Profile settings saved");
  };

  return React.createElement(
    "div",
    { className: "tf-settings-page" },
    React.createElement(
      "div",
      { className: "tf-settings-shell" },
      React.createElement(
        "aside",
        { className: "tf-settings-sidebar" },
        React.createElement("div", { className: "tf-settings-brand" }, "TeamForge"),
        React.createElement(
          "nav",
          { className: "tf-settings-nav" },
          React.createElement("button", { type: "button", className: "tf-nav-item active" }, "Profile"),
          React.createElement("button", { type: "button", className: "tf-nav-item" }, "Notifications"),
          React.createElement("button", { type: "button", className: "tf-nav-item" }, "Privacy"),
          React.createElement("button", { type: "button", className: "tf-nav-item" }, "Appearance"),
        ),
      ),
      React.createElement(
        "main",
        { className: "tf-settings-main" },
        React.createElement(
          "form",
          { className: "tf-settings-form", onSubmit: handleSave },
          React.createElement(
            "section",
            { className: "tf-settings-card" },
            React.createElement("h2", null, "Profile"),
            React.createElement(
              "div",
              { className: "tf-field-grid" },
              React.createElement(
                "label",
                { className: "tf-field" },
                React.createElement("span", null, "Full name"),
                React.createElement("input", {
                  type: "text",
                  value: profile.fullName,
                  onChange: updateProfileField("fullName"),
                  placeholder: "Enter your full name",
                }),
              ),
              React.createElement(
                "label",
                { className: "tf-field" },
                React.createElement("span", null, "Username"),
                React.createElement("input", {
                  type: "text",
                  value: profile.username,
                  onChange: updateProfileField("username"),
                  placeholder: "yourusername",
                }),
              ),
              React.createElement(
                "label",
                { className: "tf-field tf-field-full" },
                React.createElement("span", null, "Bio"),
                React.createElement("textarea", {
                  rows: 4,
                  value: profile.bio,
                  onChange: updateProfileField("bio"),
                  placeholder: "Tell people about yourself",
                }),
              ),
              React.createElement(
                "label",
                { className: "tf-field" },
                React.createElement("span", null, "Phone"),
                React.createElement("input", {
                  type: "tel",
                  value: profile.phone,
                  onChange: updateProfileField("phone"),
                  placeholder: "9876543210",
                  "aria-invalid": Boolean(phoneError),
                }),
              ),
              React.createElement(
                "label",
                { className: "tf-field" },
                React.createElement("span", null, "LinkedIn"),
                React.createElement("input", {
                  type: "url",
                  value: profile.linkedin,
                  onChange: updateProfileField("linkedin"),
                  placeholder: "https://linkedin.com/in/yourname",
                }),
              ),
            ),
            phoneError
              ? React.createElement("div", { className: "tf-form-error" }, phoneError)
              : null,
          ),
          React.createElement(
            "section",
            { className: "tf-settings-card" },
            React.createElement("h2", null, "Skills"),
            React.createElement(
              "div",
              { className: "tf-skill-input-row" },
              React.createElement("input", {
                type: "text",
                value: skillInput,
                onChange: (event) => setSkillInput(event.target.value),
                placeholder: "Add a skill",
              }),
              React.createElement(
                "button",
                { type: "button", className: "tf-primary-btn", onClick: addSkill },
                "Add",
              ),
            ),
            React.createElement(
              "div",
              { className: "tf-skill-list" },
              skills.length
                ? skills.map((skill) =>
                    React.createElement(
                      "span",
                      { key: skill, className: "tf-skill-badge" },
                      skill,
                      React.createElement(
                        "button",
                        { type: "button", className: "tf-skill-remove", onClick: () => removeSkill(skill) },
                        "×",
                      ),
                    ),
                  )
                : React.createElement("span", { className: "tf-empty-text" }, "No skills added yet"),
            ),
          ),
          React.createElement(
            "section",
            { className: "tf-settings-card" },
            React.createElement("h2", null, "Appearance"),
            React.createElement(
              "label",
              { className: "tf-field" },
              React.createElement("span", null, "Theme"),
              React.createElement(
                "select",
                { value: selectedTheme, onChange: (event) => setSelectedTheme(event.target.value) },
                React.createElement("option", { value: "light" }, "Light"),
                React.createElement("option", { value: "dark" }, "Dark"),
              ),
            ),
          ),
          React.createElement(
            "section",
            { className: "tf-settings-card" },
            React.createElement("h2", null, "Notifications"),
            React.createElement(
              "div",
              { className: "tf-toggle-list" },
              notifications.map((item) =>
                React.createElement(ToggleRow, {
                  key: item.key,
                  item,
                  onToggle: toggleNotification,
                }),
              ),
            ),
          ),
          React.createElement(
            "section",
            { className: "tf-settings-card" },
            React.createElement("h2", null, "Privacy"),
            React.createElement(
              "div",
              { className: "tf-toggle-list" },
              privacy.map((item) =>
                React.createElement(ToggleRow, {
                  key: item.key,
                  item,
                  onToggle: togglePrivacy,
                }),
              ),
            ),
          ),
          React.createElement(
            "div",
            { className: "tf-settings-actions" },
            statusMessage
              ? React.createElement("div", { className: "tf-status-message" }, statusMessage)
              : null,
            React.createElement(
              "button",
              { type: "submit", className: "tf-primary-btn tf-primary-btn-lg" },
              "Save settings",
            ),
          ),
        ),
      ),
    ),
  );
}
