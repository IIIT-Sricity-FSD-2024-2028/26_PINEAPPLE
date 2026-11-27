import { apiRequest, getCurrentUserRole } from './apiClient.js';

export const adminApi = {
  login: (credentials) =>
    apiRequest("/admin/login", "POST", credentials),
  listUsers: (role) =>
    apiRequest("/admin/users", "GET", null, {
      role: role || getCurrentUserRole(),
    }),
  getUserCounts: (role) =>
    apiRequest("/admin/users/counts", "GET", null, {
      role: role || getCurrentUserRole(),
    }),
  getUserDetails: (id, role) =>
    apiRequest(`/admin/users/${id}`, "GET", null, {
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
  suspendUser: (id, payload, role) =>
    apiRequest(`/admin/users/${id}/suspend`, "POST", typeof payload === 'string' ? { reason: payload } : (payload || { reason: 'Account suspended by administrator' }), {
      role: role || getCurrentUserRole(),
    }),
  reactivateUser: (id, payload, role) =>
    apiRequest(`/admin/users/${id}/reactivate`, "POST", typeof payload === 'string' ? { reason: payload } : (payload || { reason: 'Account reactivated by administrator' }), {
      role: role || getCurrentUserRole(),
    }),
  warnUser: (id, payload, role) =>
    apiRequest(`/admin/users/${id}/warn`, "POST", typeof payload === 'string' ? { reason: payload } : payload, {
      role: role || getCurrentUserRole(),
    }),
  getWarnings: (id, role) =>
    apiRequest(`/admin/users/${id}/warnings`, "GET", null, {
      role: role || getCurrentUserRole(),
    }),
  getMyWarnings: () =>
    apiRequest("/users/me/warnings", "GET"),
  getStats: (role) =>
    apiRequest("/admin/stats", "GET", null, {
      role: role || getCurrentUserRole(),
    }),
  getAuditLog: (params, role) => {
    let qs = '';
    let effectiveRole = role;
    if (typeof params === 'string') {
      effectiveRole = params;
    } else if (params && typeof params === 'object') {
      const sp = new URLSearchParams();
      if (params.userId) sp.append('userId', params.userId);
      if (params.reportId) sp.append('reportId', params.reportId);
      if (params.action) sp.append('action', params.action);
      if (params.actor) sp.append('actor', params.actor);
      if (params.limit) sp.append('limit', params.limit);
      if (params.offset) sp.append('offset', params.offset);
      const str = sp.toString();
      if (str) qs = `?${str}`;
    }
    return apiRequest(`/admin/audit${qs}`, "GET", null, {
      role: effectiveRole || getCurrentUserRole(),
    });
  },
  recordAuditEntry: (entry, role) =>
    apiRequest("/admin/audit", "POST", entry, {
      role: role || getCurrentUserRole(),
    }),
  getConfig: (role) =>
    apiRequest("/admin/config", "GET", null, {
      role: role || getCurrentUserRole(),
    }),
  getPublicConfig: () =>
    apiRequest("/admin/config/public", "GET"),
  updateConfig: (payload, role) =>
    apiRequest("/admin/config", "PUT", payload, {
      role: role || getCurrentUserRole(),
    }),
  triggerJobTick: (role) =>
    apiRequest("/admin/jobs/tick", "POST", {}, {
      role: role || getCurrentUserRole(),
    }),
  getJobRuns: (limit = 20, role) =>
    apiRequest(`/admin/jobs/runs?limit=${limit}`, "GET", null, {
      role: role || getCurrentUserRole(),
    }),
  getJobRun: (id, role) =>
    apiRequest(`/admin/jobs/runs/${id}`, "GET", null, {
      role: role || getCurrentUserRole(),
    }),
  getUserReputation: (userId, { page = 1, limit = 20, type = '' } = {}, role) => {
    const params = new URLSearchParams();
    if (page) params.append('page', String(page));
    if (limit) params.append('limit', String(limit));
    if (type && type.toLowerCase() !== 'all') params.append('type', String(type));
    return apiRequest(`/admin/users/${userId}/reputation?${params.toString()}`, "GET", null, {
      role: role || getCurrentUserRole(),
    });
  },
  getDuplicateUsers: (role) =>
    apiRequest("/admin/users/duplicates", "GET", null, {
      role: role || getCurrentUserRole(),
    }),
  exportAuditLog: ({ format = "csv", from = "", to = "", actor = "", action = "", userId = "", reportId = "" } = {}, role) => {
    const sp = new URLSearchParams();
    if (format) sp.append("format", format);
    if (from) sp.append("from", from);
    if (to) sp.append("to", to);
    if (actor) sp.append("actor", actor);
    if (action) sp.append("action", action);
    if (userId) sp.append("userId", userId);
    if (reportId) sp.append("reportId", reportId);
    return apiRequest(`/admin/audit/export?${sp.toString()}`, "GET", null, {
      role: role || getCurrentUserRole(),
    });
  },
  getModerationActions: (status = "", role) => {
    const qs = status && status !== "all" ? `?status=${encodeURIComponent(status)}` : "";
    return apiRequest(`/admin/moderation-actions${qs}`, "GET", null, {
      role: role || getCurrentUserRole(),
    });
  },
  approveModerationAction: (actionId, reason, role) =>
    apiRequest(`/admin/moderation-actions/${actionId}/approve`, "POST", { reason }, {
      role: role || getCurrentUserRole(),
    }),
  rejectModerationAction: (actionId, reason, role) =>
    apiRequest(`/admin/moderation-actions/${actionId}/reject`, "POST", { reason }, {
      role: role || getCurrentUserRole(),
    }),
  getDisputes: (status = "", role) => {
    const qs = status && status !== "all" ? `?status=${encodeURIComponent(status)}` : "";
    return apiRequest(`/admin/disputes${qs}`, "GET", null, {
      role: role || getCurrentUserRole(),
    });
  },
  decideDispute: (disputeId, payload, role) =>
    apiRequest(`/admin/disputes/${disputeId}/decide`, "POST", payload, {
      role: role || getCurrentUserRole(),
    }),
  getProjectEscrow: (projectId, role) =>
    apiRequest(`/admin/projects/${projectId}/escrow`, "GET", null, {
      role: role || getCurrentUserRole(),
    }),
  getNeedsReviewSessions: (role) =>
    apiRequest('/admin/mentor-sessions/needs-review', "GET", null, {
      role: role || getCurrentUserRole(),
    }),
  clearSessionReview: (sessionId, reason, role) =>
    apiRequest(`/admin/mentor-sessions/${sessionId}/clear-review`, "POST", { reason }, {
      role: role || getCurrentUserRole(),
    }),
  refresh: () => apiRequest("/admin/auth/refresh", "POST", {}),
  logout: () => apiRequest("/admin/auth/logout", "POST", {}),
};

export const recordPortalAuditEntry = (entry) => {
  return adminApi.recordAuditEntry(entry).catch((err) => {
    console.warn("Could not record portal audit entry:", err);
  });
};

export default adminApi;

