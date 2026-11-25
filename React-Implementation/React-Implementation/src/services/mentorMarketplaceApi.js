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
  myProfile: (role, userId) =>
    apiRequest("/mentor-marketplace/mentors/me", "GET", null, {
      role: role || getCurrentUserRole(),
      userId: userId || getCurrentUserId(),
    }),
  confirmMentorRole: (role, userId) =>
    apiRequest(
      "/mentor-marketplace/mentors/confirm-role",
      "PATCH",
      {},
      { role: role || getCurrentUserRole(), userId: userId || getCurrentUserId() },
    ),
  createProfile: (payload, role, userId) =>
    apiRequest("/mentor-marketplace/mentors/profile", "POST", payload, {
      role: role || getCurrentUserRole(),
      userId: userId || getCurrentUserId(),
    }),
  updateProfile: (payload, role, userId) =>
    apiRequest("/mentor-marketplace/mentors/profile", "PATCH", payload, {
      role: role || getCurrentUserRole(),
      userId: userId || getCurrentUserId(),
    }),
  updateAvailability: (isAvailable, role, userId) =>
    apiRequest(
      "/mentor-marketplace/mentors/availability",
      "PATCH",
      { isAvailable },
      { role: role || getCurrentUserRole(), userId: userId || getCurrentUserId() },
    ),

  // Sessions
  bookSession: (payload, role) =>
    apiRequest("/mentor-marketplace/sessions/book", "POST", payload, {
      role: role || getCurrentUserRole(),
      userId: getCurrentUserId(),
    }),
  confirmPayment: (id, role, headers = {}) =>
    apiRequest(`/mentor-marketplace/sessions/${id}/confirm-payment`, "POST", {}, {
      role: role || getCurrentUserRole(),
      userId: getCurrentUserId(),
      headers,
    }),
  paySession: (id, role, headers = {}) =>
    apiRequest(`/mentor-marketplace/sessions/${id}/pay`, "POST", {}, {
      role: role || getCurrentUserRole(),
      userId: getCurrentUserId(),
      headers,
    }),
  reconcileEscrow: (role) =>
    apiRequest("/admin/escrow/reconcile", "GET", null, {
      role: role || getCurrentUserRole(),
      userId: getCurrentUserId(),
    }),
  cancelPayment: (id, role) =>
    apiRequest(`/mentor-marketplace/sessions/${id}/cancel-payment`, "POST", {}, {
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
  getMentoredProjects: (role) =>
    apiRequest("/mentor-marketplace/mentored-projects", "GET", null, {
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
  declineSession: (id, payloadOrReason, role) => {
    let body = {};
    if (typeof payloadOrReason === 'string') {
      body = { reason: payloadOrReason };
    } else if (payloadOrReason && typeof payloadOrReason === 'object') {
      body = payloadOrReason;
    }
    return apiRequest(
      `/mentor-marketplace/sessions/${id}/decline`,
      "POST",
      body,
      { role: role || getCurrentUserRole(), userId: getCurrentUserId() },
    );
  },
  completeSession: (id, role) =>
    apiRequest(
      `/mentor-marketplace/sessions/${id}/complete`,
      "POST",
      {},
      { role: role || getCurrentUserRole(), userId: getCurrentUserId() },
    ),
  cancelSession: (id, payloadOrRole, role) => {
    let body = {};
    if (typeof payloadOrRole === 'string') {
      body = { reason: payloadOrRole };
    } else if (payloadOrRole && typeof payloadOrRole === 'object') {
      body = payloadOrRole;
    }
    const effRole = typeof payloadOrRole === 'string' && role === undefined ? undefined : (role || (typeof payloadOrRole === 'string' ? payloadOrRole : undefined));
    return apiRequest(
      `/mentor-marketplace/sessions/${id}/cancel`,
      "POST",
      body,
      { role: effRole || getCurrentUserRole(), userId: getCurrentUserId() },
    );
  },
  retryPayout: (id, role) =>
    apiRequest(
      `/mentor-marketplace/sessions/${id}/retry-payout`,
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
  submitSessionFeedback: (sessionId, payload, role) =>
    apiRequest(
      `/mentor-sessions/${sessionId}/feedback`,
      "POST",
      payload,
      { role: role || getCurrentUserRole(), userId: getCurrentUserId() },
    ),
  addSessionNote: (sessionId, note, role) =>
    apiRequest(
      `/mentor-sessions/${sessionId}/notes`,
      "POST",
      { note },
      { role: role || getCurrentUserRole(), userId: getCurrentUserId() },
    ),
  myStats: (role, userId) =>
    apiRequest(
      "/mentor-marketplace/mentors/me/stats",
      "GET",
      null,
      { role: role || getCurrentUserRole() || "mentor", userId: userId || getCurrentUserId() },
    ),
  getProjectAbandonmentReview: (projectId, role, userId) =>
    apiRequest(
      `/projects/${projectId}/mentor/abandonment-review`,
      "GET",
      null,
      { role: role || getCurrentUserRole(), userId: userId || getCurrentUserId() },
    ),
  openAbandonmentReview: (projectId, reason, role, userId) =>
    apiRequest(
      `/projects/${projectId}/mentor/abandonment-review`,
      "POST",
      { reason },
      { role: role || getCurrentUserRole() || "project-owner", userId: userId || getCurrentUserId() },
    ),
  confirmAbandonmentReview: (reviewId, role, userId) =>
    apiRequest(
      `/mentor/abandonment-reviews/${reviewId}/confirm`,
      "POST",
      {},
      { role: role || getCurrentUserRole() || "mentor", userId: userId || getCurrentUserId() },
    ),
  getMyAbandonmentReviews: (role, userId) =>
    apiRequest(
      "/mentor/abandonment-reviews/mine",
      "GET",
      null,
      { role: role || getCurrentUserRole() || "mentor", userId: userId || getCurrentUserId() },
    ),
  cancelAbandonmentReview: (reviewId, reason, role) =>
    apiRequest(
      `/admin/abandonment-reviews/${reviewId}/cancel`,
      "POST",
      { reason },
      { role: role || getCurrentUserRole() || "admin", userId: getCurrentUserId() },
    ),
  getAdminMentorFeedback: (mentorIdOrUserId, role) =>
    apiRequest(
      `/admin/mentors/${mentorIdOrUserId}/feedback`,
      "GET",
      null,
      { role: role || getCurrentUserRole() || "admin", userId: getCurrentUserId() },
    ),
  openDispute: (sessionId, reason, role, userId) =>
    apiRequest(
      `/mentor-sessions/${sessionId}/dispute`,
      "POST",
      { reason },
      { role: role || getCurrentUserRole(), userId: userId || getCurrentUserId() },
    ),
  listDisputes: (status = "", role) => {
    const qs = status && status !== "all" ? `?status=${encodeURIComponent(status)}` : "";
    return apiRequest(
      `/admin/disputes${qs}`,
      "GET",
      null,
      { role: role || getCurrentUserRole() || "admin", userId: getCurrentUserId() },
    );
  },
  decideDispute: (disputeId, payload, role) =>
    apiRequest(
      `/admin/disputes/${disputeId}/decide`,
      "POST",
      payload,
      { role: role || getCurrentUserRole() || "admin", userId: getCurrentUserId() },
    ),
  getProjectEscrow: (projectId, role) =>
    apiRequest(
      `/admin/projects/${projectId}/escrow`,
      "GET",
      null,
      { role: role || getCurrentUserRole() || "admin", userId: getCurrentUserId() },
    ),
};

export const mentorMarketApi = mentorMarketplaceApi;

export function calculateEscrowBreakdown(sessionPrice) {
  const price = Math.round(Number(sessionPrice) || 0);
  const platformFee = Math.round(price * 0.15);
  const gatewayFee = Math.round(price * 0.02);
  const totalAmount = price + platformFee + gatewayFee;
  const mentorPayout = price;
  return {
    price,
    platformFee,
    gatewayFee,
    totalFees: platformFee + gatewayFee,
    totalAmount,
    mentorPayout,
  };
}

export default mentorMarketplaceApi;
