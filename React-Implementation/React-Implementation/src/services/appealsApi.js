import { apiRequest } from './apiClient.js';

export const appealsApi = {
  submitAppeal: (warningId, payload) =>
    apiRequest(`/warnings/${warningId}/appeal`, 'POST', payload),

  getMyAppeals: () =>
    apiRequest('/users/me/appeals', 'GET'),

  getAdminAppeals: (status) => {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return apiRequest(`/admin/appeals${qs}`, 'GET');
  },

  decideAppeal: (id, payload) =>
    apiRequest(`/admin/appeals/${id}/decision`, 'POST', payload),
};

export default appealsApi;
