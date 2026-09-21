import { apiRequest, getCurrentUserRole } from './apiClient.js';

export const mentorRequestsApi = {
  list: (params, role) => {
    const queryParams = new URLSearchParams();
    if (params?.projectId) queryParams.append("projectId", params.projectId);
    if (params?.mentorId) queryParams.append("mentorId", params.mentorId);
    if (params?.status) queryParams.append("status", params.status);
    const query = queryParams.toString();
    return apiRequest(
      `/mentor-requests${query ? `?${query}` : ""}`,
      "GET",
      null,
      {
        role: role || getCurrentUserRole(),
      },
    );
  },
  get: (id, role) =>
    apiRequest(`/mentor-requests/${id}`, "GET", null, {
      role: role || getCurrentUserRole(),
    }),
  create: (payload, role) =>
    apiRequest("/mentor-requests", "POST", payload, {
      role: role || getCurrentUserRole(),
    }),
  update: (id, payload, role) =>
    apiRequest(`/mentor-requests/${id}`, "PUT", payload, {
      role: role || getCurrentUserRole(),
    }),
  accept: (id, role) =>
    apiRequest(`/mentor-requests/${id}/accept`, "PUT", null, {
      role: role || getCurrentUserRole(),
    }),
  decline: (id, role) =>
    apiRequest(`/mentor-requests/${id}/decline`, "PUT", null, {
      role: role || getCurrentUserRole(),
    }),
  remove: (id, role) =>
    apiRequest(`/mentor-requests/${id}`, "DELETE", null, {
      role: role || getCurrentUserRole(),
    }),
};

export default mentorRequestsApi;
