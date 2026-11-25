import { apiRequest, getCurrentUserRole } from './apiClient.js';

export const trustApi = {
  getMyTrust: (role) =>
    apiRequest('/users/me/trust', 'GET', null, {
      role: role || getCurrentUserRole(),
    }),

  getUserTrust: (userId, role) =>
    apiRequest(`/users/${encodeURIComponent(userId)}/trust`, 'GET', null, {
      role: role || getCurrentUserRole(),
    }),

  getTrustSummaries: (ids, role) =>
    apiRequest('/users/trust-summaries', 'POST', { ids }, {
      role: role || getCurrentUserRole(),
    }),
};

export default trustApi;
