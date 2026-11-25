import { apiRequest } from './apiClient.js';

export const OTHER_REASON_ID = 'OTHER';

let cachedReasonsConfig = null;
let pendingConfigRequest = null;

export const feedbackApi = {
  /**
   * Fetches the universal action reason configuration from GET /feedback/reasons.
   * Caches response in-memory so it is fetched once per session.
   *
   * @param {boolean} [forceRefresh=false]
   * @returns {Promise<Object>}
   */
  async getFeedbackReasons(forceRefresh = false) {
    if (!forceRefresh && cachedReasonsConfig) {
      return cachedReasonsConfig;
    }

    if (pendingConfigRequest) {
      return pendingConfigRequest;
    }

    pendingConfigRequest = apiRequest('/feedback/reasons', 'GET')
      .then((data) => {
        cachedReasonsConfig = data;
        pendingConfigRequest = null;
        return data;
      })
      .catch((err) => {
        pendingConfigRequest = null;
        throw err;
      });

    return pendingConfigRequest;
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

  /**
   * Clears the in-memory cache (primarily for tests).
   */
  clearCache() {
    cachedReasonsConfig = null;
    pendingConfigRequest = null;
  },
};

export default feedbackApi;
