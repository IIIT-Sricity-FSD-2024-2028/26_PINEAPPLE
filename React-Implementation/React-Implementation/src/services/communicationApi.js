import { apiRequest, getCurrentUserRole, getCurrentUserId } from './apiClient.js';

export const communicationApi = {
  getMessages: (projectId, role) =>
    apiRequest(`/communication/messages/project/${projectId}`, "GET", null, {
      role: role || getCurrentUserRole(),
      userId: getCurrentUserId(),
    }),

  sendMessage: (payload, role, userId) => {
    const activeUserId = userId || getCurrentUserId();
    const content = payload?.content || payload?.text || "";
    const normalizedPayload = {
      ...payload,
      content,
      text: content,
    };
    return apiRequest("/communication/messages", "POST", normalizedPayload, {
      role: role || getCurrentUserRole(),
      userId: activeUserId,
    });
  },

  getNotifications: (role, userId) => {
    const activeUserId =
      userId ||
      (typeof localStorage !== "undefined"
        ? localStorage.getItem("teamforge.backendUserId") || ""
        : "");
    return apiRequest("/communication/notifications", "GET", null, {
      role: role || getCurrentUserRole(),
      userId: activeUserId,
    });
  },

  markNotificationRead: (id, role) =>
    apiRequest(`/communication/notifications/${id}/read`, "PATCH", null, {
      role: role || getCurrentUserRole(),
    }),
};

export default communicationApi;
