function resolveApiBaseUrl() {
  const configuredBase =
    typeof window !== "undefined" && typeof window.TEAMFORGE_API_BASE_URL === "string"
      ? window.TEAMFORGE_API_BASE_URL
      : "";
  const storedBase =
    typeof localStorage !== "undefined"
      ? localStorage.getItem("teamforge.apiBaseUrl") || ""
      : "";
  const rawBase = configuredBase || storedBase || "http://localhost:3000";
  return String(rawBase).replace(/\/+$/, "");
}

const API_BASE_URL = resolveApiBaseUrl();

const defaultHeaders = (role, userId, userEmail) => ({
  "Content-Type": "application/json",
  "x-user-role": role || getCurrentUserRole(),
  "x-user-id": userId || getCurrentUserId(),
  ...(userEmail ? { "x-user-email": userEmail } : {}),
});

async function apiRequest(path, method, body = null, options = {}) {
  const url = `${API_BASE_URL}${path}`;
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const headers = defaultHeaders(options.role, options.userId, options.userEmail);
  if (isFormData) {
    delete headers["Content-Type"];
  }

  const config = {
    method,
    headers,
  };

  if (body && ["POST", "PUT", "PATCH"].includes(method)) {
    config.body = isFormData ? body : JSON.stringify(body);
  }

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch {
        // If response is not JSON, use default error message
      }

      // Handle specific HTTP status codes
      switch (response.status) {
        case 400:
          throw new Error(`Validation Error: ${errorMessage}`);
        case 401:
          throw new Error("Authentication required. Please log in again.");
        case 403:
          throw new Error(`Access Forbidden: ${errorMessage}`);
        case 404:
          throw new Error(`Resource not found: ${errorMessage}`);
        case 409:
          throw new Error(`Conflict: ${errorMessage}`);
        case 422:
          throw new Error(`Validation failed: ${errorMessage}`);
        case 500:
          throw new Error("Server error. Please try again later.");
        default:
          throw new Error(errorMessage);
      }
    }

    // For DELETE requests or 204 No Content, safely parse response
    if (method === "DELETE" || response.status === 204) {
      try {
        const text = await response.text();
        return text ? JSON.parse(text) : { message: "Deleted successfully" };
      } catch {
        return { message: "Deleted successfully" };
      }
    }

    const text = await response.text();
    return text ? JSON.parse(text) : {};
  } catch (error) {
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new Error(
        "Network error. Please check your connection and try again.",
      );
    }
    throw error;
  }
}

// Get current user role in backend-compatible format
function getCurrentUserRole() {
  try {
    if (sessionStorage.getItem("teamforge.isSuperUser") === "true") {
      return "Super User";
    }
    const portalRole = sessionStorage.getItem("teamforge.portalRole");
    if (portalRole) {
      return portalRole;
    }
    const storedRole = sessionStorage.getItem("teamforge.role");
    if (storedRole) {
      return storedRole;
    }
    if (typeof window !== "undefined" && window.STATE) {
      return window.STATE.portalRole || window.STATE.role || "Collaborator";
    }
    return "Collaborator";
  } catch {
    return "Collaborator";
  }
}

// Get current backend numeric user ID (distinct from the email-keyed local
// session — see teamforge.backendUserId, set at login/registration).
function getCurrentUserId() {
  try {
    return (
      (typeof localStorage !== "undefined" &&
        localStorage.getItem("teamforge.backendUserId")) ||
      "1"
    );
  } catch {
    return "1";
  }
}

// Export core HTTP client & auth helpers
export {
  resolveApiBaseUrl,
  API_BASE_URL,
  defaultHeaders,
  apiRequest,
  getCurrentUserRole,
  getCurrentUserId,
};

// Re-export domain-specific APIs for convenience and backward-compatibility
export * from "./usersApi.js";
export * from "./projectsApi.js";
export * from "./tasksApi.js";
export * from "./joinRequestsApi.js";
export * from "./mentorApplicationsApi.js";
export * from "./mentorRequestsApi.js";
export * from "./supportApi.js";
export * from "./adminApi.js";
export * from "./portalAdminsApi.js";
export * from "./notificationsApi.js";
export * from "./leaderboardApi.js";
export * from "./mentorMarketplaceApi.js";
export * from "./mentorshipApi.js";

export default apiRequest;
