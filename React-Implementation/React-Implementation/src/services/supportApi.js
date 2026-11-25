import { apiRequest, getCurrentUserRole } from './apiClient.js';

export const supportApi = {
  // Legacy / backwards-compatible helpers
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

  // Phase 27 User Support Ticket API
  listMyTickets: () => apiRequest("/support/tickets", "GET"),
  getMyTicket: (id) => apiRequest(`/support/tickets/${encodeURIComponent(id)}`, "GET"),
  createTicket: (payload) => apiRequest("/support/tickets", "POST", payload),
  replyToMyTicket: (id, body) =>
    apiRequest(`/support/tickets/${encodeURIComponent(id)}/replies`, "POST", { body }),

  // Phase 27 Admin Support Inbox API ("support" permission required)
  listAdminTickets: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.status && params.status !== "all") qs.append("status", params.status);
    if (params.type && params.type !== "all") qs.append("type", params.type);
    if (params.assignee && params.assignee !== "all") qs.append("assignee", params.assignee);
    if (params.q) qs.append("q", params.q);
    if (params.page) qs.append("page", String(params.page));
    if (params.limit) qs.append("limit", String(params.limit));
    const query = qs.toString();
    return apiRequest(`/admin/support/tickets${query ? `?${query}` : ""}`, "GET");
  },
  listAssignees: () => apiRequest("/admin/support/assignees", "GET"),
  getAdminTicket: (id) =>
    apiRequest(`/admin/support/tickets/${encodeURIComponent(id)}`, "GET"),
  updateAdminTicket: (id, payload) =>
    apiRequest(`/admin/support/tickets/${encodeURIComponent(id)}`, "PATCH", payload),
  replyAdminTicket: (id, payload) =>
    apiRequest(`/admin/support/tickets/${encodeURIComponent(id)}/replies`, "POST", payload),
  closeProjectFromTicket: (id, reason) =>
    apiRequest(`/admin/support/tickets/${encodeURIComponent(id)}/close-project`, "POST", {
      reason,
    }),
};

export default supportApi;
