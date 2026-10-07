import { apiRequest, getCurrentUserRole } from './apiClient.js';

export const uploadsApi = {
  uploadTaskProof: (file, role) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiRequest('/uploads/task-proof', 'POST', formData, {
      role: role || getCurrentUserRole(),
    });
  },

  uploadAvatar: (file, role) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiRequest('/uploads/avatar', 'POST', formData, {
      role: role || getCurrentUserRole(),
    });
  },

  uploadResource: (file, role) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiRequest('/uploads/resource', 'POST', formData, {
      role: role || getCurrentUserRole(),
    });
  },

  uploadFile: (file, role) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiRequest('/uploads', 'POST', formData, {
      role: role || getCurrentUserRole(),
    });
  },
};

export default uploadsApi;
