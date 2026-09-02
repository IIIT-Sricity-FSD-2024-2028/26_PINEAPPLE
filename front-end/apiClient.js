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
  "x-user-role": role,
  ...(userId ? { "x-user-id": userId } : {}),
  ...(userEmail ? { "x-user-email": userEmail } : {}),
});

async function apiRequest(path, method, body = null, options = {}) {
  const url = `${API_BASE_URL}${path}`;
  const config = {
    method,
    headers: defaultHeaders(options.role, options.userId, options.userEmail),
  };

  if (body && ["POST", "PUT", "PATCH"].includes(method)) {
    config.body = JSON.stringify(body);
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

    // For DELETE requests, return success message if no content
    if (method === "DELETE" && response.status === 200) {
      try {
        return await response.json();
      } catch {
        return { message: "Deleted successfully" };
      }
    }

    return await response.json();
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
    if (typeof STATE !== "undefined") {
      return STATE.portalRole || STATE.role || "Collaborator";
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
    return (typeof localStorage !== "undefined" && localStorage.getItem("teamforge.backendUserId")) || "1";
  } catch {
    return "1";
  }
}

const usersApi = {
  list: (role) =>
    apiRequest("/users", "GET", null, { role: role || getCurrentUserRole() }),
  get: (id, role) =>
    apiRequest(`/users/${id}`, "GET", null, {
      role: role || getCurrentUserRole(),
    }),
  create: (payload, role) =>
    apiRequest("/users", "POST", payload, {
      role: role || getCurrentUserRole(),
    }),
  update: (id, payload, role) =>
    apiRequest(`/users/${id}`, "PATCH", payload, {
      role: role || getCurrentUserRole(),
    }),
  remove: (id, role) =>
    apiRequest(`/users/${id}`, "DELETE", null, {
      role: role || getCurrentUserRole(),
    }),
};

const projectsApi = {
  list: (params, role) => {
    const queryParams = new URLSearchParams();
    if (params?.owner) queryParams.append("owner", params.owner);
    if (params?.status) queryParams.append("status", params.status);
    if (params?.skill) queryParams.append("skill", params.skill);
    const query = queryParams.toString();
    return apiRequest(`/projects${query ? `?${query}` : ""}`, "GET", null, {
      role: role || getCurrentUserRole(),
    });
  },
  get: (id, role) =>
    apiRequest(`/projects/${id}`, "GET", null, {
      role: role || getCurrentUserRole(),
    }),
  create: (payload, role, userId) =>
    apiRequest("/projects", "POST", payload, {
      role: role || getCurrentUserRole(),
      userId:
        userId ||
        (typeof localStorage !== "undefined"
          ? localStorage.getItem("teamforge.backendUserId") || ""
          : ""),
    }),
  update: (id, payload, role) =>
    apiRequest(`/projects/${id}`, "PATCH", payload, {
      role: role || getCurrentUserRole(),
    }),
  remove: (id, role) =>
    apiRequest(`/projects/${id}`, "DELETE", null, {
      role: role || getCurrentUserRole(),
    }),
};

const tasksApi = {
  list: (params, role) => {
    if (!params?.projectId) {
      throw new Error("projectId is required to list tasks.");
    }
    return apiRequest(`/tasks/project/${params.projectId}`, "GET", null, {
      role: role || getCurrentUserRole(),
    });
  },
  get: (id, role) =>
    apiRequest(`/tasks/${id}`, "GET", null, {
      role: role || getCurrentUserRole(),
    }),
  create: (payload, role) =>
    apiRequest("/tasks", "POST", payload, {
      role: role || getCurrentUserRole(),
    }),
  update: (id, payload, role) =>
    apiRequest(`/tasks/${id}`, "PATCH", payload, {
      role: role || getCurrentUserRole(),
    }),
  // Kanban-friendly status transition. Accepts { status } or { column }.
  // Falls back gracefully if the backend is unreachable (frontend catches).
  updateStatus: (id, payload, role) =>
    apiRequest(`/tasks/${id}/status`, "PATCH", payload, {
      role: role || getCurrentUserRole(),
    }),
  remove: (id, role) =>
    apiRequest(`/tasks/${id}`, "DELETE", null, {
      role: role || getCurrentUserRole(),
    }),
};

const joinRequestsApi = {
  list: (params, role) => {
    const queryParams = new URLSearchParams();
    if (params?.projectId) queryParams.append("projectId", params.projectId);
    if (params?.userId) queryParams.append("userId", params.userId);
    if (params?.status) queryParams.append("status", params.status);
    const query = queryParams.toString();
    return apiRequest(
      `/join-requests${query ? `?${query}` : ""}`,
      "GET",
      null,
      { role: role || getCurrentUserRole() },
    );
  },
  get: (id, role) =>
    apiRequest(`/join-requests/${id}`, "GET", null, {
      role: role || getCurrentUserRole(),
    }),
  create: (payload, role) =>
    apiRequest("/join-requests", "POST", payload, {
      role: role || getCurrentUserRole(),
    }),
  update: (id, payload, role) =>
    apiRequest(`/join-requests/${id}`, "PUT", payload, {
      role: role || getCurrentUserRole(),
    }),
  remove: (id, role) =>
    apiRequest(`/join-requests/${id}`, "DELETE", null, {
      role: role || getCurrentUserRole(),
    }),
};

const mentorApplicationsApi = {
  list: (params, role) => {
    const queryParams = new URLSearchParams();
    if (params?.userId) queryParams.append("userId", params.userId);
    if (params?.status) queryParams.append("status", params.status);
    const query = queryParams.toString();
    return apiRequest(
      `/mentor-applications${query ? `?${query}` : ""}`,
      "GET",
      null,
      {
        role: role || getCurrentUserRole(),
      },
    );
  },
  get: (id, role) =>
    apiRequest(`/mentor-applications/${id}`, "GET", null, {
      role: role || getCurrentUserRole(),
    }),
  create: (payload, role) =>
    apiRequest("/mentor-applications", "POST", payload, {
      role: role || getCurrentUserRole(),
    }),
  update: (id, payload, role) =>
    apiRequest(`/mentor-applications/${id}`, "PUT", payload, {
      role: role || getCurrentUserRole(),
    }),
  approve: (id, role) =>
    apiRequest(`/mentor-applications/${id}/approve`, "PUT", null, {
      role: role || getCurrentUserRole(),
    }),
  reject: (id, role) =>
    apiRequest(`/mentor-applications/${id}/reject`, "PUT", null, {
      role: role || getCurrentUserRole(),
    }),
  remove: (id, role) =>
    apiRequest(`/mentor-applications/${id}`, "DELETE", null, {
      role: role || getCurrentUserRole(),
    }),
};

const mentorRequestsApi = {
  list: (params, role) => {
    const queryParams = new URLSearchParams();
    if (params?.projectId) queryParams.append("projectId", params.projectId);
    if (params?.mentorId) queryParams.append("mentorId", params.mentorId);
    if (params?.status) queryParams.append("status", params.status);
    const query = queryParams.toString();
    return apiRequest(
      `/mentor-requests${query ? `?${query}` : ""}`,
      "GET",
      null,
      {
        role: role || getCurrentUserRole(),
      },
    );
  },
  get: (id, role) =>
    apiRequest(`/mentor-requests/${id}`, "GET", null, {
      role: role || getCurrentUserRole(),
    }),
  create: (payload, role) =>
    apiRequest("/mentor-requests", "POST", payload, {
      role: role || getCurrentUserRole(),
    }),
  update: (id, payload, role) =>
    apiRequest(`/mentor-requests/${id}`, "PUT", payload, {
      role: role || getCurrentUserRole(),
    }),
  accept: (id, role) =>
    apiRequest(`/mentor-requests/${id}/accept`, "PUT", null, {
      role: role || getCurrentUserRole(),
    }),
  decline: (id, role) =>
    apiRequest(`/mentor-requests/${id}/decline`, "PUT", null, {
      role: role || getCurrentUserRole(),
    }),
  remove: (id, role) =>
    apiRequest(`/mentor-requests/${id}`, "DELETE", null, {
      role: role || getCurrentUserRole(),
    }),
};

const supportApi = {
  list: (params, role, userId) => {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append("status", params.status);
    if (params?.userId) queryParams.append("userId", params.userId);
    const query = queryParams.toString();
    return apiRequest(`/support${query ? `?${query}` : ""}`, "GET", null, {
      role: role || getCurrentUserRole(),
      userId,
    });
  },
  get: (id, role, userId) =>
    apiRequest(`/support/${id}`, "GET", null, {
      role: role || getCurrentUserRole(),
      userId,
    }),
  create: (payload, role, userId, userEmail) =>
    apiRequest("/support", "POST", payload, {
      role: role || getCurrentUserRole(),
      userId,
      userEmail,
    }),
  updateStatus: (id, payload, role) =>
    apiRequest(`/support/${id}/status`, "PUT", payload, {
      role: role || getCurrentUserRole(),
    }),
  remove: (id, role) =>
    apiRequest(`/support/${id}`, "DELETE", null, {
      role: role || getCurrentUserRole(),
    }),
};

const adminApi = {
  listUsers: (role) =>
    apiRequest("/admin/users", "GET", null, {
      role: role || getCurrentUserRole(),
    }),
  updateUserStatus: (id, payload, role) =>
    apiRequest(`/admin/users/${id}/status`, "PATCH", payload, {
      role: role || getCurrentUserRole(),
    }),
  flagUser: (id, role) =>
    apiRequest(`/admin/users/${id}/flag`, "PUT", null, {
      role: role || getCurrentUserRole(),
    }),
  suspendUser: (id, role) =>
    apiRequest(`/admin/users/${id}/suspend`, "PUT", null, {
      role: role || getCurrentUserRole(),
    }),
  warnUser: (id, payload, role) =>
    apiRequest(`/admin/users/${id}/warn`, "PUT", payload, {
      role: role || getCurrentUserRole(),
    }),
  getStats: (role) =>
    apiRequest("/admin/stats", "GET", null, {
      role: role || getCurrentUserRole(),
    }),
  getAuditLog: (role) =>
    apiRequest("/admin/audit", "GET", null, {
      role: role || getCurrentUserRole(),
    }),
};

const portalAdminsApi = {
  list: (role) =>
    apiRequest("/portal-admins", "GET", null, {
      role: role || getCurrentUserRole(),
    }),
  create: (payload, role) =>
    apiRequest("/portal-admins", "POST", payload, {
      role: role || getCurrentUserRole(),
    }),
  update: (id, payload, role) =>
    apiRequest(`/portal-admins/${id}`, "PUT", payload, {
      role: role || getCurrentUserRole(),
    }),
  remove: (id, role) =>
    apiRequest(`/portal-admins/${id}`, "DELETE", null, {
      role: role || getCurrentUserRole(),
    }),
};

const notificationsApi = {
  list: (params, role) => {
    const queryParams = new URLSearchParams();
    if (params?.userId) queryParams.append("userId", params.userId);
    if (params?.isRead !== undefined)
      queryParams.append("isRead", params.isRead);
    const query = queryParams.toString();
    return apiRequest(
      `/notifications${query ? `?${query}` : ""}`,
      "GET",
      null,
      {
        role: role || getCurrentUserRole(),
      },
    );
  },
  get: (id, role) =>
    apiRequest(`/notifications/${id}`, "GET", null, {
      role: role || getCurrentUserRole(),
    }),
  create: (payload, role) =>
    apiRequest("/notifications", "POST", payload, {
      role: role || getCurrentUserRole(),
    }),
  markAsRead: (id, role) =>
    apiRequest(`/notifications/${id}/read`, "PUT", null, {
      role: role || getCurrentUserRole(),
    }),
  markAllAsRead: (role) =>
    apiRequest("/notifications/read-all", "PUT", null, {
      role: role || getCurrentUserRole(),
    }),
  remove: (id, role) =>
    apiRequest(`/notifications/${id}`, "DELETE", null, {
      role: role || getCurrentUserRole(),
    }),
};

const leaderboardApi = {
  getLeaderboard: (params, role) => {
    const queryParams = new URLSearchParams();
    if (params?.period) queryParams.append("period", params.period);
    if (params?.limit) queryParams.append("limit", params.limit);
    const query = queryParams.toString();
    return apiRequest(`/leaderboard${query ? `?${query}` : ""}`, "GET", null, {
      role: role || getCurrentUserRole(),
    });
  },
  getUserRank: (userId, params, role) => {
    const queryParams = new URLSearchParams();
    if (params?.period) queryParams.append("period", params.period);
    const query = queryParams.toString();
    return apiRequest(
      `/leaderboard/${userId}${query ? `?${query}` : ""}`,
      "GET",
      null,
      {
        role: role || getCurrentUserRole(),
      },
    );
  },
};

// ── Mentor Marketplace API ────────────────────────────────────────────────────
const mentorMarketApi = {
  // Browse / profile
  listMentors: (params = {}, role) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== "" && v !== null) qs.set(k, v); });
    const q = qs.toString();
    return apiRequest(`/mentor-marketplace/mentors${q ? "?" + q : ""}`, "GET", null, { role: role || getCurrentUserRole(), userId: getCurrentUserId() });
  },
  getMentor: (id, role) => apiRequest(`/mentor-marketplace/mentors/${id}`, "GET", null, { role: role || getCurrentUserRole(), userId: getCurrentUserId() }),
  myProfile: (role) => apiRequest("/mentor-marketplace/mentors/me", "GET", null, { role: role || getCurrentUserRole(), userId: getCurrentUserId() }),
  confirmMentorRole: (role) => apiRequest("/mentor-marketplace/mentors/confirm-role", "PATCH", {}, { role: role || getCurrentUserRole(), userId: getCurrentUserId() }),
  createProfile: (payload, role) => apiRequest("/mentor-marketplace/mentors/profile", "POST", payload, { role: role || getCurrentUserRole(), userId: getCurrentUserId() }),
  updateProfile: (payload, role) => apiRequest("/mentor-marketplace/mentors/profile", "PATCH", payload, { role: role || getCurrentUserRole(), userId: getCurrentUserId() }),
  updateAvailability: (isAvailable, role) => apiRequest("/mentor-marketplace/mentors/availability", "PATCH", { isAvailable }, { role: role || getCurrentUserRole(), userId: getCurrentUserId() }),

  // Sessions
  bookSession: (payload, role) => apiRequest("/mentor-marketplace/sessions/book", "POST", payload, { role: role || getCurrentUserRole(), userId: getCurrentUserId() }),
  mySessions: (role) => apiRequest("/mentor-marketplace/sessions/mine", "GET", null, { role: role || getCurrentUserRole(), userId: getCurrentUserId() }),
  mentorSessions: (role) => apiRequest("/mentor-marketplace/sessions/mentor-view", "GET", null, { role: role || getCurrentUserRole(), userId: getCurrentUserId() }),
  allSessions: (role) => apiRequest("/mentor-marketplace/sessions", "GET", null, { role: role || getCurrentUserRole(), userId: getCurrentUserId() }),
  adminStats: (role) => apiRequest("/mentor-marketplace/sessions/admin-stats", "GET", null, { role: role || getCurrentUserRole(), userId: getCurrentUserId() }),
  startSession: (id, role) => apiRequest(`/mentor-marketplace/sessions/${id}/start`, "POST", {}, { role: role || getCurrentUserRole(), userId: getCurrentUserId() }),
  acceptSession: (id, role) => apiRequest(`/mentor-marketplace/sessions/${id}/accept`, "POST", {}, { role: role || getCurrentUserRole(), userId: getCurrentUserId() }),
  declineSession: (id, role) => apiRequest(`/mentor-marketplace/sessions/${id}/decline`, "POST", {}, { role: role || getCurrentUserRole(), userId: getCurrentUserId() }),
  completeSession: (id, role) => apiRequest(`/mentor-marketplace/sessions/${id}/complete`, "POST", {}, { role: role || getCurrentUserRole(), userId: getCurrentUserId() }),
  cancelSession: (id, role) => apiRequest(`/mentor-marketplace/sessions/${id}/cancel`, "POST", {}, { role: role || getCurrentUserRole(), userId: getCurrentUserId() }),
  submitReview: (sessionId, payload, role) => apiRequest(`/mentor-marketplace/sessions/${sessionId}/review`, "POST", payload, { role: role || getCurrentUserRole(), userId: getCurrentUserId() }),
};

// Expose APIs globally for frontend use
window.usersApi = usersApi;
window.projectsApi = projectsApi;
window.tasksApi = tasksApi;
window.joinRequestsApi = joinRequestsApi;
window.mentorApplicationsApi = mentorApplicationsApi;
window.mentorRequestsApi = mentorRequestsApi;
window.supportApi = supportApi;
window.adminApi = adminApi;
window.portalAdminsApi = portalAdminsApi;
window.notificationsApi = notificationsApi;
window.leaderboardApi = leaderboardApi;
window.getCurrentUserRole = getCurrentUserRole;
window.getCurrentUserId = getCurrentUserId;
window.mentorMarketApi = mentorMarketApi;
