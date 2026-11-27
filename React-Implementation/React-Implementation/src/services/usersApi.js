import { apiRequest, apiDownloadText, getCurrentUserRole } from './apiClient.js';

export const usersApi = {
  getPublicProfile: (id, role) =>
    apiRequest(`/users/${id}/public-profile`, "GET", null, {
      role: role || getCurrentUserRole(),
    }),
  update: (id, payload, role) =>
    apiRequest(`/users/${id}`, "PATCH", payload, {
      role: role || getCurrentUserRole(),
    }),
  checkUsernameAvailable: (username, excludeUserId) => {
    const params = new URLSearchParams({ username: username || '' });
    if (excludeUserId) {
      params.append('excludeUserId', excludeUserId);
    }
    return apiRequest(`/users/username-available?${params.toString()}`, 'GET');
  },
  verifyPhone: (idToken, role) =>
    apiRequest('/users/me/phone/verify', 'POST', { idToken }, { role: role || getCurrentUserRole() }),
  getPhoneOtpStatus: (role) =>
    apiRequest('/users/me/phone/otp-status', 'GET', null, { role: role || getCurrentUserRole() }),
  recordFailedOtpAttempt: (role) =>
    apiRequest('/users/me/phone/failed-attempt', 'POST', {}, { role: role || getCurrentUserRole() }),
  deletePhone: (role) =>
    apiRequest('/users/me/phone', 'DELETE', null, { role: role || getCurrentUserRole() }),
  searchUsers: (q) =>
    apiRequest(`/users/search?q=${encodeURIComponent(q || '')}`, 'GET'),
  getMe: () =>
    apiRequest('/users/me', 'GET', undefined, { skipCache: true }),
  updateUsername: (payload) =>
    apiRequest('/users/me/username', 'PATCH', payload),
  getReputation: ({ page = 1, limit = 20, type = '' } = {}) => {
    const params = new URLSearchParams();
    if (page) params.append('page', String(page));
    if (limit) params.append('limit', String(limit));
    if (type && type.toLowerCase() !== 'all') params.append('type', String(type));
    return apiRequest(`/users/me/reputation?${params.toString()}`, 'GET');
  },
  getResponseTime: (id) =>
    apiRequest(`/users/${id}/response-time`, 'GET'),
  requestExport: () =>
    apiRequest('/users/me/export', 'POST', {}),
  listExports: () =>
    apiRequest('/users/me/export', 'GET', null, { skipCache: true }),
  getExportStatus: (exportId) =>
    apiRequest(`/users/me/export/${encodeURIComponent(exportId)}`, 'GET', null, { skipCache: true }),
  downloadExport: (exportId) =>
    apiDownloadText(`/users/me/export/${encodeURIComponent(exportId)}/download`, {
      role: getCurrentUserRole(),
    }),
  deleteMyAccount: (payload) =>
    apiRequest('/users/me/delete', 'POST', payload),
  checkDeletionEligibility: () =>
    apiRequest('/users/me/deletion-check', 'GET', null, { skipCache: true }),
};

export default usersApi;
