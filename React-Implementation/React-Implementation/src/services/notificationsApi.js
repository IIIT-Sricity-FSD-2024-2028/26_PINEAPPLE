import { apiRequest, getCurrentUserRole } from './apiClient.js';

export const notificationsApi = {
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

export default notificationsApi;
