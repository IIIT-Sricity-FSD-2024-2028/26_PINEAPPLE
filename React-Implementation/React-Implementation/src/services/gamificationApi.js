import { apiRequest, getCurrentUserRole } from './apiClient.js';

export const gamificationApi = {
  getUserLedger: (userId, role) => {
    return apiRequest(`/gamification/${userId}/ledger`, 'GET', null, {
      role: role || getCurrentUserRole(),
    });
  },
  getUserStats: (userId, params, role) => {
    const queryParams = new URLSearchParams();
    if (params?.period) queryParams.append('period', params.period);
    const query = queryParams.toString();
    return apiRequest(
      `/gamification/${userId}/stats${query ? `?${query}` : ''}`,
      'GET',
      null,
      {
        role: role || getCurrentUserRole(),
      },
    );
  },
  getLeaderboard: (params, role) => {
    const queryParams = new URLSearchParams();
    if (params?.period) queryParams.append('period', params.period);
    const query = queryParams.toString();
    return apiRequest(
      `/gamification/leaderboard${query ? `?${query}` : ''}`,
      'GET',
      null,
      {
        role: role || getCurrentUserRole(),
      },
    );
  },
};

export default gamificationApi;
