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
  create: async (payload, role) => {
    const res = await apiRequest("/notifications", "POST", payload, {
      role: role || getCurrentUserRole(),
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("teamforge:notification_updated"));
    }
    return res;
  },
  markAsRead: async (id, role) => {
    const res = await apiRequest(`/notifications/${id}/read`, "PUT", null, {
      role: role || getCurrentUserRole(),
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("teamforge:notification_updated"));
    }
    return res;
  },
  markAllAsRead: async (role, userId) => {
    const currentId =
      userId ||
      (typeof localStorage !== "undefined"
        ? localStorage.getItem("teamforge.backendUserId")
        : "");
    const query = currentId ? `?userId=${encodeURIComponent(currentId)}` : "";
    const res = await apiRequest(`/notifications/read-all${query}`, "PUT", null, {
      role: role || getCurrentUserRole(),
      userId: currentId,
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("teamforge:notification_updated"));
    }
    return res;
  },
  remove: async (id, role) => {
    const res = await apiRequest(`/notifications/${id}`, "DELETE", null, {
      role: role || getCurrentUserRole(),
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("teamforge:notification_updated"));
    }
    return res;
  },
};

export default notificationsApi;
