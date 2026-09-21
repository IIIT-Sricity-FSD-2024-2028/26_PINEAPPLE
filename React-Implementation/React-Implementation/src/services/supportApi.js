import { apiRequest, getCurrentUserRole } from './apiClient.js';

export const supportApi = {
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

export default supportApi;
