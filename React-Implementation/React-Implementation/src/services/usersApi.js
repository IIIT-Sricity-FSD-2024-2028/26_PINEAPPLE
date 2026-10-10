import { apiRequest, getCurrentUserRole } from './apiClient.js';

export const usersApi = {
  list: (role) =>
    apiRequest("/users", "GET", null, { role: role || getCurrentUserRole() }),
  get: (id, role) =>
    apiRequest(`/users/${id}`, "GET", null, {
      role: role || getCurrentUserRole(),
    }),
  create: (payload, role) =>
    apiRequest("/users", "POST", payload, {
      role: role || getCurrentUserRole(),
    }),
  update: (id, payload, role) =>
    apiRequest(`/users/${id}`, "PATCH", payload, {
      role: role || "Administrator",
    }),
  remove: (id, role) =>
    apiRequest(`/users/${id}`, "DELETE", null, {
      role: role || "Administrator",
    }),
};

export default usersApi;
