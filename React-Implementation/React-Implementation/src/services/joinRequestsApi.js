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
    apiRequest(`/join-requests/${id}`, "PUT", payload, {
      role: role || getCurrentUserRole(),
    }),
  remove: (id, role) =>
    apiRequest(`/join-requests/${id}`, "DELETE", null, {
      role: role || getCurrentUserRole(),
    }),
  respond: (id, status, role) =>
    apiRequest(`/join-requests/${id}`, "PUT", { status }, {
      role: role || getCurrentUserRole(),
    }),
};

export default joinRequestsApi;
