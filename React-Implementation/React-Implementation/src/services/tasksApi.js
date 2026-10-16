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
  listForProjects: async (projectIds = [], role) => {
    if (!Array.isArray(projectIds) || !projectIds.length) return [];
    try {
      const results = await Promise.all(
        projectIds.map((pid) =>
          apiRequest(`/tasks/project/${pid}`, "GET", null, {
            role: role || getCurrentUserRole(),
          }).catch(() => [])
        )
      );
      return results.flat();
    } catch {
      return [];
    }
  },
  get: (id, role) =>
    apiRequest(`/tasks/${id}`, "GET", null, {
      role: role || getCurrentUserRole(),
    }),
  create: async (payload, role) => {
    const res = await apiRequest("/tasks", "POST", payload, {
      role: role || getCurrentUserRole(),
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("teamforge:task_updated"));
    }
    return res;
  },
  update: async (id, payload, role) => {
    const res = await apiRequest(`/tasks/${id}`, "PATCH", payload, {
      role: role || getCurrentUserRole(),
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("teamforge:task_updated"));
    }
    return res;
  },
  // Status transition. Accepts { status }.
  // Falls back gracefully if the backend is unreachable (frontend catches).
  updateStatus: async (id, payload, role) => {
    const res = await apiRequest(`/tasks/${id}/status`, "PATCH", payload, {
      role: role || getCurrentUserRole(),
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("teamforge:task_updated"));
    }
    return res;
  },
  remove: async (id, role) => {
    const res = await apiRequest(`/tasks/${id}`, "DELETE", null, {
      role: role || getCurrentUserRole(),
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("teamforge:task_updated"));
    }
    return res;
  },
};

export default tasksApi;
