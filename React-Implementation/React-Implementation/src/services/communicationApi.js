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

  getUnread: (role, userId) =>
    apiRequest("/communication/unread", "GET", null, {
      role: role || getCurrentUserRole(),
      userId: userId || getCurrentUserId(),
      skipCache: true,
    }),

  markProjectRead: (projectId, role, userId) =>
    apiRequest(`/communication/projects/${projectId}/read`, "POST", {}, {
      role: role || getCurrentUserRole(),
      userId: userId || getCurrentUserId(),
    }),

  reportMessage: (messageId, reason, role, userId) =>
    apiRequest(`/communication/messages/${messageId}/report`, "POST", { reason }, {
      role: role || getCurrentUserRole(),
      userId: userId || getCurrentUserId(),
    }),
};

export default communicationApi;
