import { apiRequest, getCurrentUserRole } from './apiClient.js';

export const portalAdminsApi = {
  list: (role) =>
    apiRequest("/portal-admins", "GET", null, {
      role: role || getCurrentUserRole(),
    }),
  create: (payload, role) =>
    apiRequest("/portal-admins", "POST", payload, {
      role: role || getCurrentUserRole(),
    }),
  update: (id, payload, role) =>
    apiRequest(`/portal-admins/${id}`, "PUT", payload, {
      role: role || getCurrentUserRole(),
    }),
  remove: (id, role) =>
    apiRequest(`/portal-admins/${id}`, "DELETE", null, {
      role: role || getCurrentUserRole(),
    }),
};

export default portalAdminsApi;
