import { apiRequest, getCurrentUserRole, getCurrentUserId } from './apiClient.js';

export const mentorshipApi = {
  apply: (payload, role) =>
    apiRequest('/mentorship/apply', 'POST', payload, {
      role: role || getCurrentUserRole(),
      userId: getCurrentUserId(),
    }),
  getApplication: (role) =>
    apiRequest('/mentorship/application', 'GET', null, {
      role: role || getCurrentUserRole(),
      userId: getCurrentUserId(),
    }),
  reviewApplication: (id, status, role) =>
    apiRequest(`/mentorship/application/${id}/review`, 'PATCH', { status }, {
      role: role || getCurrentUserRole(),
    }),
  issueBadge: (payload, role) =>
    apiRequest('/mentorship/badge', 'POST', payload, {
      role: role || getCurrentUserRole(),
      userId: getCurrentUserId(),
    }),
  getBadges: (userId, role) =>
    apiRequest(`/mentorship/badges/${userId}`, 'GET', null, {
      role: role || getCurrentUserRole(),
    }),
};

export default mentorshipApi;
