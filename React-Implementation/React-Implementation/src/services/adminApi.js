import { apiRequest, getCurrentUserRole } from './apiClient.js';

export const adminApi = {
  login: (credentials) =>
    apiRequest("/admin/login", "POST", credentials),
  listUsers: (role) =>
    apiRequest("/admin/users", "GET", null, {
      role: role || getCurrentUserRole(),
    }),
  updateUserStatus: (id, payload, role) =>
    apiRequest(`/admin/users/${id}/status`, "PATCH", payload, {
      role: role || getCurrentUserRole(),
    }),
  flagUser: (id, role) =>
    apiRequest(`/admin/users/${id}/flag`, "PUT", null, {
      role: role || getCurrentUserRole(),
    }),
  suspendUser: (id, role) =>
    apiRequest(`/admin/users/${id}/suspend`, "PUT", null, {
      role: role || getCurrentUserRole(),
    }),
  warnUser: (id, payload, role) =>
    apiRequest(`/admin/users/${id}/warn`, "PUT", payload, {
      role: role || getCurrentUserRole(),
    }),
  getStats: (role) =>
    apiRequest("/admin/stats", "GET", null, {
      role: role || getCurrentUserRole(),
    }),
  getAuditLog: (role) =>
    apiRequest("/admin/audit", "GET", null, {
      role: role || getCurrentUserRole(),
    }),
};

export default adminApi;
