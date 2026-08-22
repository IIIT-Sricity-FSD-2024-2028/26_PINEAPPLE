// ══════════════════════════════════════════════
//   UTILS — shared across all roles feature files
// ══════════════════════════════════════════════

const backendBaseUrl =
  typeof window.getTeamforgeApiBaseUrl === "function"
    ? window.getTeamforgeApiBaseUrl()
    : "http://localhost:3000";

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
        text: "Let's close API integration by Friday.",
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
