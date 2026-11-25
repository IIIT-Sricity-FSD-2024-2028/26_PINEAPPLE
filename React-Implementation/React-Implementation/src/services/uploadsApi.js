import { apiRequest, apiDownload, getCurrentUserRole } from './apiClient.js';

export const uploadsApi = {
  uploadCv: (file, role) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiRequest('/uploads/cv', 'POST', formData, {
      role: role || getCurrentUserRole(),
    });
  },

  downloadCv: (filename, role) => {
    return apiDownload(`/uploads/cv/${filename}`, {
      role: role || getCurrentUserRole(),
    });
  },

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
