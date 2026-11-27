import { apiRequest } from './apiClient.js';

export const authApi = {
  signup: (payload) =>
    apiRequest('/auth/signup', 'POST', payload),
  login: (credentials) =>
    apiRequest('/auth/login', 'POST', credentials),
  refresh: (refreshToken) =>
    apiRequest('/auth/refresh', 'POST', { refreshToken }),
  logout: (refreshToken) =>
    apiRequest('/auth/logout', 'POST', { refreshToken }),
  getMe: () =>
    apiRequest('/auth/me', 'GET'),
  switchRole: (role) =>
    apiRequest('/users/switch-role', 'POST', { role }),
  createProfile: (profileData) =>
    apiRequest('/auth/profile', 'POST', profileData),
  resolveIdentifier: (identifier) =>
    apiRequest(`/auth/resolve-identifier?identifier=${encodeURIComponent(identifier)}`, 'GET'),
  forgotPassword: (identifier) =>
    apiRequest('/auth/forgot-password', 'POST', { identifier }),
  resetPassword: (token, newPassword) =>
    apiRequest('/auth/reset-password', 'POST', { token, newPassword }),
  verifyEmail: (token) =>
    apiRequest('/auth/verify-email', 'POST', { token }),
  resendVerification: () =>
    apiRequest('/auth/resend-verification', 'POST', {}),
};

export default authApi;
