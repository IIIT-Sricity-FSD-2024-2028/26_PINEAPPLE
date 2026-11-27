import { apiRequest } from './apiClient.js';

export const OTHER_REASON_ID = 'OTHER';

export const feedbackApi = {
  /**
   * Fetches the universal action reason configuration from GET /feedback/reasons.
   * State and deduplication live in `actionFeedbackSlice` via `fetchFeedbackReasons`.
   *
   * @returns {Promise<Object>}
   */
  async getFeedbackReasons() {
    return apiRequest('/feedback/reasons', 'GET');
  },

  /**
   * Fetches feedback history for a specific entity.
   *
   * @param {string} entityType - e.g. 'APPLICATION', 'INVITE', 'TASK', 'PROJECT', 'MENTOR_SESSION', etc.
   * @param {string} entityId - Entity ID
   * @returns {Promise<Array>}
   */
  async getEntityFeedback(entityType, entityId) {
    if (!entityType || !entityId) return [];
    const query = new URLSearchParams({
      entityType: String(entityType).trim().toUpperCase(),
      entityId: String(entityId).trim(),
    }).toString();

    return apiRequest(`/feedback?${query}`, 'GET');
  },
};

export default feedbackApi;
