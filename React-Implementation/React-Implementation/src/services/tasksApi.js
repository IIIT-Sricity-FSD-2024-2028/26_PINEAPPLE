import { apiRequest, getCurrentUserRole } from './apiClient.js';

export const tasksApi = {
  list: (params, role) => {
    if (!params?.projectId) {
      throw new Error("projectId is required to list tasks.");
    }
    return apiRequest(`/tasks/project/${params.projectId}`, "GET", null, {
      role: role || getCurrentUserRole(),
    });
  },
  get: (id, role) =>
    apiRequest(`/tasks/${id}`, "GET", null, {
      role: role || getCurrentUserRole(),
    }),
  create: (payload, role) =>
    apiRequest("/tasks", "POST", payload, {
      role: role || getCurrentUserRole(),
    }),
  update: (id, payload, role) =>
    apiRequest(`/tasks/${id}`, "PATCH", payload, {
      role: role || getCurrentUserRole(),
    }),
  // Kanban-friendly status transition. Accepts { status } or { column }.
  // Falls back gracefully if the backend is unreachable (frontend catches).
  updateStatus: (id, payload, role) =>
    apiRequest(`/tasks/${id}/status`, "PATCH", payload, {
      role: role || getCurrentUserRole(),
    }),
  remove: (id, role) =>
    apiRequest(`/tasks/${id}`, "DELETE", null, {
      role: role || getCurrentUserRole(),
    }),
};

export default tasksApi;
