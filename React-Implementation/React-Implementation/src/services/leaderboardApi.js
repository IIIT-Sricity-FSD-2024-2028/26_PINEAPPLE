import { apiRequest, getCurrentUserRole } from './apiClient.js';

export const leaderboardApi = {
  getLeaderboard: (params, role) => {
    const queryParams = new URLSearchParams();
    if (params?.period) queryParams.append("period", params.period);
    if (params?.limit) queryParams.append("limit", params.limit);
    const query = queryParams.toString();
    return apiRequest(`/leaderboard${query ? `?${query}` : ""}`, "GET", null, {
      role: role || getCurrentUserRole(),
    });
  },
  getUserRank: (userId, params, role) => {
    const queryParams = new URLSearchParams();
    if (params?.period) queryParams.append("period", params.period);
    const query = queryParams.toString();
    return apiRequest(
      `/leaderboard/${userId}${query ? `?${query}` : ""}`,
      "GET",
      null,
      {
        role: role || getCurrentUserRole(),
      },
    );
  },
};

export default leaderboardApi;
