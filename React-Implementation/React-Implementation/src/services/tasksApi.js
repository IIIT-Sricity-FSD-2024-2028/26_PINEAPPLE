import { apiRequest, getCurrentUserRole } from './apiClient.js';

export const tasksApi = {
  list: (params, role) => {
    if (!params?.projectId) {
      throw new Error('projectId is required to list tasks.');
    }
    return apiRequest(`/tasks/project/${params.projectId}`, 'GET', null, {
      role: role || getCurrentUserRole(),
    });
  },
  listForProjects: async (projectIds = [], role) => {
    if (!Array.isArray(projectIds) || !projectIds.length) return [];
    try {
      const results = await Promise.all(
        projectIds.map((pid) =>
          apiRequest(`/tasks/project/${pid}`, 'GET', null, {
            role: role || getCurrentUserRole(),
          }).catch(() => []),
        ),
      );
      return results.flat();
    } catch (err) {
      console.warn('[tasksApi] Error listing tasks for projects:', err);
      return [];
    }
  },
  get: (id, role) =>
    apiRequest(`/tasks/${id}`, 'GET', null, {
      role: role || getCurrentUserRole(),
    }),
  create: async (payload, role) =>
    apiRequest('/tasks', 'POST', payload, {
      role: role || getCurrentUserRole(),
    }),
  update: async (id, payload, role) =>
    apiRequest(`/tasks/${id}`, 'PATCH', payload, {
      role: role || getCurrentUserRole(),
    }),
  updateStatus: async (id, payload, role) =>
    apiRequest(`/tasks/${id}/status`, 'PATCH', payload, {
      role: role || getCurrentUserRole(),
    }),
  review: async (id, payload, role) =>
    apiRequest(`/tasks/${id}/review`, 'POST', payload, {
      role: role || getCurrentUserRole(),
    }),
  unassign: async (id, payload = {}, role) =>
    apiRequest(`/tasks/${id}/unassign`, 'POST', payload, {
      role: role || getCurrentUserRole(),
    }),
  addComment: async (id, payload, role) =>
    apiRequest(`/tasks/${id}/comments`, 'POST', payload, {
      role: role || getCurrentUserRole(),
    }),
  remove: async (id, role) =>
    apiRequest(`/tasks/${id}`, 'DELETE', null, {
      role: role || getCurrentUserRole(),
    }),
};

export default tasksApi;
