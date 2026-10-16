import { apiRequest, getCurrentUserRole } from './apiClient.js';

export const adminApi = {
  login: (credentials) =>
    apiRequest("/admin/login", "POST", credentials),
  listUsers: (role) =>
    apiRequest("/admin/users", "GET", null, {
      role: role || getCurrentUserRole(),
    }),
  getUserDetails: (id, role) =>
    apiRequest(`/admin/users/${id}`, "GET", null, {
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
  recordAuditEntry: (entry, role) =>
    apiRequest("/admin/audit", "POST", entry, {
      role: role || getCurrentUserRole(),
    }),
  getConfig: (role) =>
    apiRequest("/admin/config", "GET", null, {
      role: role || getCurrentUserRole(),
    }),
  getPublicConfig: () =>
    apiRequest("/admin/config/public", "GET"),
  updateConfig: (payload, role) =>
    apiRequest("/admin/config", "PUT", payload, {
      role: role || getCurrentUserRole(),
    }),
};

export const recordPortalAuditEntry = (entry) => {
  return adminApi.recordAuditEntry(entry).catch((err) => {
    console.warn("Could not record portal audit entry:", err);
  });
};

export default adminApi;

