import { apiRequest, getCurrentUserRole } from './apiClient.js';

export const mentorApplicationsApi = {
  getMyStatus: (params, role) => {
    const queryParams = new URLSearchParams();
    if (params?.userId) queryParams.append("userId", params.userId);
    const query = queryParams.toString();
    return apiRequest(
      `/mentor-applications/me${query ? `?${query}` : ""}`,
      "GET",
      null,
      {
        role: role || getCurrentUserRole(),
        userId: params?.userId,
      },
    );
  },
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
        userId: params?.userId,
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
  approve: (id, payload, role) => {
    const body = (payload && typeof payload === 'object' && !Array.isArray(payload)) ? payload : {};
    const effectiveRole = typeof payload === 'string' ? payload : (role || getCurrentUserRole());
    return apiRequest(`/mentor-applications/${id}/approve`, "PUT", body, {
      role: effectiveRole,
    });
  },
  reject: (id, payload, role) => {
    const body = (payload && typeof payload === 'object' && !Array.isArray(payload)) ? payload : {};
    const effectiveRole = typeof payload === 'string' ? payload : (role || getCurrentUserRole());
    return apiRequest(`/mentor-applications/${id}/reject`, "PUT", body, {
      role: effectiveRole,
    });
  },
  getDigiLockerStatus: (role) =>
    apiRequest("/mentor-applications/digilocker/status", "GET", null, {
      role: role || getCurrentUserRole(),
    }),
  pullDigiLockerDocuments: (applicantName, role) =>
    apiRequest("/mentor-applications/digilocker/pull-documents", "POST", { applicantName }, {
      role: role || getCurrentUserRole(),
    }),
  remove: (id, role) =>
    apiRequest(`/mentor-applications/${id}`, "DELETE", null, {
      role: role || getCurrentUserRole(),
    }),
};

export default mentorApplicationsApi;
