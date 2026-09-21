import { apiRequest, getCurrentUserRole, getCurrentUserId } from './apiClient.js';

export const mentorMarketplaceApi = {
  // Browse / profile
  listMentors: (params = {}, role) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== "" && v !== null) qs.set(k, v);
    });
    const q = qs.toString();
    return apiRequest(
      `/mentor-marketplace/mentors${q ? "?" + q : ""}`,
      "GET",
      null,
      { role: role || getCurrentUserRole(), userId: getCurrentUserId() },
    );
  },
  getMentor: (id, role) =>
    apiRequest(`/mentor-marketplace/mentors/${id}`, "GET", null, {
      role: role || getCurrentUserRole(),
      userId: getCurrentUserId(),
    }),
  myProfile: (role) =>
    apiRequest("/mentor-marketplace/mentors/me", "GET", null, {
      role: role || getCurrentUserRole(),
      userId: getCurrentUserId(),
    }),
  confirmMentorRole: (role) =>
    apiRequest(
      "/mentor-marketplace/mentors/confirm-role",
      "PATCH",
      {},
      { role: role || getCurrentUserRole(), userId: getCurrentUserId() },
    ),
  createProfile: (payload, role) =>
    apiRequest("/mentor-marketplace/mentors/profile", "POST", payload, {
      role: role || getCurrentUserRole(),
      userId: getCurrentUserId(),
    }),
  updateProfile: (payload, role) =>
    apiRequest("/mentor-marketplace/mentors/profile", "PATCH", payload, {
      role: role || getCurrentUserRole(),
      userId: getCurrentUserId(),
    }),
  updateAvailability: (isAvailable, role) =>
    apiRequest(
      "/mentor-marketplace/mentors/availability",
      "PATCH",
      { isAvailable },
      { role: role || getCurrentUserRole(), userId: getCurrentUserId() },
    ),

  // Sessionsx
  bookSession: (payload, role) =>
    apiRequest("/mentor-marketplace/sessions/book", "POST", payload, {
      role: role || getCurrentUserRole(),
      userId: getCurrentUserId(),
    }),
  mySessions: (role) =>
    apiRequest("/mentor-marketplace/sessions/mine", "GET", null, {
      role: role || getCurrentUserRole(),
      userId: getCurrentUserId(),
    }),
  mentorSessions: (role) =>
    apiRequest("/mentor-marketplace/sessions/mentor-view", "GET", null, {
      role: role || getCurrentUserRole(),
      userId: getCurrentUserId(),
    }),
  allSessions: (role) =>
    apiRequest("/mentor-marketplace/sessions", "GET", null, {
      role: role || getCurrentUserRole(),
      userId: getCurrentUserId(),
    }),
  adminStats: (role) =>
    apiRequest("/mentor-marketplace/sessions/admin-stats", "GET", null, {
      role: role || getCurrentUserRole(),
      userId: getCurrentUserId(),
    }),
  startSession: (id, role) =>
    apiRequest(
      `/mentor-marketplace/sessions/${id}/start`,
      "POST",
      {},
      { role: role || getCurrentUserRole(), userId: getCurrentUserId() },
    ),
  acceptSession: (id, role) =>
    apiRequest(
      `/mentor-marketplace/sessions/${id}/accept`,
      "POST",
      {},
      { role: role || getCurrentUserRole(), userId: getCurrentUserId() },
    ),
  declineSession: (id, role) =>
    apiRequest(
      `/mentor-marketplace/sessions/${id}/decline`,
      "POST",
      {},
      { role: role || getCurrentUserRole(), userId: getCurrentUserId() },
    ),
  completeSession: (id, role) =>
    apiRequest(
      `/mentor-marketplace/sessions/${id}/complete`,
      "POST",
      {},
      { role: role || getCurrentUserRole(), userId: getCurrentUserId() },
    ),
  cancelSession: (id, role) =>
    apiRequest(
      `/mentor-marketplace/sessions/${id}/cancel`,
      "POST",
      {},
      { role: role || getCurrentUserRole(), userId: getCurrentUserId() },
    ),
  submitReview: (sessionId, payload, role) =>
    apiRequest(
      `/mentor-marketplace/sessions/${sessionId}/review`,
      "POST",
      payload,
      { role: role || getCurrentUserRole(), userId: getCurrentUserId() },
    ),
};

export const mentorMarketApi = mentorMarketplaceApi;
export default mentorMarketplaceApi;
