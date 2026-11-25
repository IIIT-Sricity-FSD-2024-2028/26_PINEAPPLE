import { apiRequest, getCurrentUserRole } from './apiClient.js';

export const joinRequestsApi = {
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
    apiRequest(`/join-requests/${id}`, "PATCH", payload, {
      role: role || getCurrentUserRole(),
    }),
  remove: (id, payloadOrRole, role) => {
    const payload = typeof payloadOrRole === 'object' && payloadOrRole !== null ? payloadOrRole : null;
    const effectiveRole = typeof payloadOrRole === 'string' ? payloadOrRole : role;
    return apiRequest(`/join-requests/${id}`, "DELETE", payload, {
      role: effectiveRole || getCurrentUserRole(),
    });
  },
  respond: (id, status, reasonOrRole, maybeRole) => {
    let payload = { status };
    let actualRole = maybeRole;
    if (typeof reasonOrRole === 'object' && reasonOrRole !== null) {
      payload = { status, ...reasonOrRole };
    } else if (typeof reasonOrRole === 'string') {
      if (status === 'rejected') {
        payload.reason = reasonOrRole;
      } else {
        actualRole = reasonOrRole;
      }
    }
    return apiRequest(`/join-requests/${id}`, "PATCH", payload, {
      role: actualRole || getCurrentUserRole(),
    });
  },
  getMyRequests: (role) =>
    apiRequest("/join-requests/mine", "GET", null, {
      role: role || getCurrentUserRole(),
    }),
};

export default joinRequestsApi;
