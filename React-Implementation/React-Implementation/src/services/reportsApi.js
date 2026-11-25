import { apiRequest } from './apiClient.js';

export const reportsApi = {
  submitReport: (payload) =>
    apiRequest('/reports', 'POST', payload),
  createReport: (payload) =>
    apiRequest('/reports', 'POST', payload),

  getMyReports: () =>
    apiRequest('/reports/mine', 'GET'),

  getAdminReports: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.status) searchParams.append('status', params.status);
    if (params.q) searchParams.append('q', params.q);
    if (params.page) searchParams.append('page', params.page);
    if (params.limit) searchParams.append('limit', params.limit);
    const qs = searchParams.toString();
    return apiRequest(`/admin/reports${qs ? `?${qs}` : ''}`, 'GET');
  },

  getOpenCount: () =>
    apiRequest('/admin/reports/open-count', 'GET'),

  getAdminReportById: (id) =>
    apiRequest(`/admin/reports/${id}`, 'GET'),
  getReportDetails: (id) =>
    apiRequest(`/admin/reports/${id}`, 'GET'),

  updateReportStatus: (id, payload) =>
    apiRequest(`/admin/reports/${id}/status`, 'PATCH', payload),

  actionReport: (id, payload) =>
    apiRequest(`/admin/reports/${id}/action`, 'POST', payload),

  getOwnerPatterns: (days = 30) =>
    apiRequest(`/admin/reports/owner-patterns?days=${days}`, 'GET'),
};

export default reportsApi;
