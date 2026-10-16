import { apiRequest, getCurrentUserRole } from './apiClient.js';

export function isProjectLocked(project) {
  if (!project) return false;
  if (project.isCompleted === true || project.is_completed === true) return true;
  if (typeof project.status === 'string' && project.status.toLowerCase() === 'completed') return true;
  return false;
}

export function isProjectActive(project) {
  if (!project) return false;
  if (isProjectLocked(project)) return false;
  const status = String(project.status || '').toLowerCase().trim();
  return status !== 'completed' && status !== 'cancelled' && status !== 'archived';
}

export const projectsApi = {
  isLocked: isProjectLocked,
  isActive: isProjectActive,
  list: (params, role) => {
    const queryParams = new URLSearchParams();
    if (params?.owner) queryParams.append("owner", params.owner);
    if (params?.status) queryParams.append("status", params.status);
    if (params?.skill) queryParams.append("skill", params.skill);
    const query = queryParams.toString();
    return apiRequest(`/projects${query ? `?${query}` : ""}`, "GET", null, {
      role: role || getCurrentUserRole(),
    });
  },
  get: (id, role) =>
    apiRequest(`/projects/${id}`, "GET", null, {
      role: role || getCurrentUserRole(),
    }),
  create: async (payload, role, userId) => {
    const res = await apiRequest("/projects", "POST", payload, {
      role: role || getCurrentUserRole(),
      userId:
        userId ||
        (typeof localStorage !== "undefined"
          ? localStorage.getItem("teamforge.backendUserId") || ""
          : ""),
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("teamforge:project_updated"));
    }
    return res;
  },
  update: async (id, payload, role) => {
    const res = await apiRequest(`/projects/${id}`, "PATCH", payload, {
      role: role || getCurrentUserRole(),
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("teamforge:project_updated"));
    }
    return res;
  },
  complete: async (id, payload, role) => {
    const res = await apiRequest(`/projects/${id}/complete`, "POST", payload, {
      role: role || getCurrentUserRole(),
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("teamforge:project_updated"));
      window.dispatchEvent(new CustomEvent("teamforge:task_updated"));
    }
    return res;
  },
  remove: async (id, role) => {
    const res = await apiRequest(`/projects/${id}`, "DELETE", null, {
      role: role || getCurrentUserRole(),
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("teamforge:project_updated"));
    }
    return res;
  },
  leave: async (id, role, userId) => {
    const res = await apiRequest(`/projects/${id}/leave`, "POST", null, {
      role: role || getCurrentUserRole(),
      userId:
        userId ||
        (typeof localStorage !== "undefined"
          ? localStorage.getItem("teamforge.backendUserId") || ""
          : ""),
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("teamforge:project_updated"));
    }
    return res;
  },
  removeMember: async (id, memberId, reason, role, userId) => {
    const res = await apiRequest(`/projects/${id}/members/${encodeURIComponent(memberId)}`, "DELETE", { reason }, {
      role: role || getCurrentUserRole(),
      userId:
        userId ||
        (typeof localStorage !== "undefined"
          ? localStorage.getItem("teamforge.backendUserId") || ""
          : ""),
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("teamforge:project_updated"));
    }
    return res;
  },
};

export default projectsApi;
