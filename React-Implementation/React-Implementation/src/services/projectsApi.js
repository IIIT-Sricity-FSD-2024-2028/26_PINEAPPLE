import { apiRequest, getCurrentUserRole } from './apiClient.js';

export const projectsApi = {
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
  create: (payload, role, userId) =>
    apiRequest("/projects", "POST", payload, {
      role: role || getCurrentUserRole(),
      userId:
        userId ||
        (typeof localStorage !== "undefined"
          ? localStorage.getItem("teamforge.backendUserId") || ""
          : ""),
    }),
  update: (id, payload, role) =>
    apiRequest(`/projects/${id}`, "PATCH", payload, {
      role: role || getCurrentUserRole(),
    }),
  remove: (id, role) =>
    apiRequest(`/projects/${id}`, "DELETE", null, {
      role: role || getCurrentUserRole(),
    }),
};

export default projectsApi;
