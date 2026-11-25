import { apiRequest, getCurrentUserRole } from './apiClient.js';

export const mentorshipApi = {
  issueBadge: (payload, role) =>
    apiRequest('/mentorship/badge', 'POST', payload, {
      role: role || getCurrentUserRole(),
    }),
  getBadges: (userId, role) =>
    apiRequest(`/mentorship/badges/${userId}`, 'GET', null, {
      role: role || getCurrentUserRole(),
    }),
  getBadgesByProject: (projectId, role) =>
    apiRequest(`/mentorship/badges/project/${projectId}`, 'GET', null, {
      role: role || getCurrentUserRole(),
    }),
};

export default mentorshipApi;
