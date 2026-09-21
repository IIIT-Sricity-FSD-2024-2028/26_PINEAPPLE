import { apiRequest, getCurrentUserRole } from './apiClient.js';

export const mentorApplicationsApi = {
  list: (params, role) => {
    const queryParams = new URLSearchParams();
    if (params?.userId) queryParams.append("userId", params.userId);
    if (params?.status) queryParams.append("status", params.status);
    const query = queryParams.toString();
    return apiRequest(
      `/mentor-applications${query ? `?${query}` : ""}`,
      "GET",
      null,
      {
        role: role || getCurrentUserRole(),
      },
    );
  },
  get: (id, role) =>
    apiRequest(`/mentor-applications/${id}`, "GET", null, {
      role: role || getCurrentUserRole(),
    }),
  create: (payload, role) =>
    apiRequest("/mentor-applications", "POST", payload, {
      role: role || getCurrentUserRole(),
    }),
  update: (id, payload, role) =>
    apiRequest(`/mentor-applications/${id}`, "PUT", payload, {
      role: role || getCurrentUserRole(),
    }),
  approve: (id, role) =>
    apiRequest(`/mentor-applications/${id}/approve`, "PUT", null, {
      role: role || getCurrentUserRole(),
    }),
  reject: (id, role) =>
    apiRequest(`/mentor-applications/${id}/reject`, "PUT", null, {
      role: role || getCurrentUserRole(),
    }),
  remove: (id, role) =>
    apiRequest(`/mentor-applications/${id}`, "DELETE", null, {
      role: role || getCurrentUserRole(),
    }),
};

export default mentorApplicationsApi;
