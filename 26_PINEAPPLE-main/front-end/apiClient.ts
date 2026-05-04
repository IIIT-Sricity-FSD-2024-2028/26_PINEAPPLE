const API_BASE_URL = 'http://localhost:3000/api';

interface ApiClientOptions {
  role: 'admin' | 'user';
}

const defaultHeaders = (role: ApiClientOptions['role']) => ({
  'Content-Type': 'application/json',
  'x-user-role': role,
});

export async function apiRequest<T>(
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  body: unknown = null,
  options: ApiClientOptions,
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const config: RequestInit = {
    method,
    headers: defaultHeaders(options.role),
  };

  if (body && (method === 'POST' || method === 'PUT')) {
    config.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch {
        // If response is not JSON, use default error message
      }

      // Handle specific HTTP status codes
      switch (response.status) {
        case 400:
          throw new Error(`Validation Error: ${errorMessage}`);
        case 401:
          throw new Error('Authentication required. Please log in again.');
        case 403:
          throw new Error(`Access Forbidden: ${errorMessage}`);
        case 404:
          throw new Error(`Resource not found: ${errorMessage}`);
        case 409:
          throw new Error(`Conflict: ${errorMessage}`);
        case 422:
          throw new Error(`Validation failed: ${errorMessage}`);
        case 500:
          throw new Error('Server error. Please try again later.');
        default:
          throw new Error(errorMessage);
      }
    }

    // For DELETE requests, return success message if no content
    if (method === 'DELETE' && response.status === 200) {
      try {
        return await response.json();
      } catch {
        return { message: 'Deleted successfully' } as T;
      }
    }

    return await response.json();
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Network error. Please check your connection and try again.');
    }
    throw error;
  }
}

// Get current user role from localStorage or default to 'user'
export function getCurrentUserRole(): 'admin' | 'user' {
  try {
    // You can implement logic to get role from localStorage or state
    // For now, default to 'user'
    return 'user';
  } catch {
    return 'user';
  }
}

export const usersApi = {
  list: (role?: ApiClientOptions['role']) => apiRequest('/users', 'GET', null, { role: role || getCurrentUserRole() }),
  get: (id: string, role?: ApiClientOptions['role']) => apiRequest(`/users/${id}`, 'GET', null, { role: role || getCurrentUserRole() }),
  create: (payload: { name: string; email: string; role: 'admin' | 'user' }, role?: ApiClientOptions['role']) =>
    apiRequest('/users', 'POST', payload, { role: role || getCurrentUserRole() }),
  update: (id: string, payload: Partial<{ name: string; email: string; role: 'admin' | 'user' }>, role?: ApiClientOptions['role']) =>
    apiRequest(`/users/${id}`, 'PUT', payload, { role: role || getCurrentUserRole() }),
  remove: (id: string, role?: ApiClientOptions['role']) => apiRequest(`/users/${id}`, 'DELETE', null, { role: role || getCurrentUserRole() }),
};

export const projectsApi = {
  list: (params?: { owner?: string; status?: string; skill?: string }, role?: ApiClientOptions['role']) => {
    const queryParams = new URLSearchParams();
    if (params?.owner) queryParams.append('owner', params.owner);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.skill) queryParams.append('skill', params.skill);
    const query = queryParams.toString();
    return apiRequest(`/projects${query ? `?${query}` : ''}`, 'GET', null, { role: role || getCurrentUserRole() });
  },
  get: (id: string, role?: ApiClientOptions['role']) => apiRequest(`/projects/${id}`, 'GET', null, { role: role || getCurrentUserRole() }),
  create: (payload: any, role?: ApiClientOptions['role']) => apiRequest('/projects', 'POST', payload, { role: role || getCurrentUserRole() }),
  update: (id: string, payload: any, role?: ApiClientOptions['role']) => apiRequest(`/projects/${id}`, 'PUT', payload, { role: role || getCurrentUserRole() }),
  remove: (id: string, role?: ApiClientOptions['role']) => apiRequest(`/projects/${id}`, 'DELETE', null, { role: role || getCurrentUserRole() }),
};

export const tasksApi = {
  list: (params?: { projectId?: string; assigneeId?: string; status?: string; priority?: string }, role?: ApiClientOptions['role']) => {
    const queryParams = new URLSearchParams();
    if (params?.projectId) queryParams.append('projectId', params.projectId);
    if (params?.assigneeId) queryParams.append('assigneeId', params.assigneeId);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.priority) queryParams.append('priority', params.priority);
    const query = queryParams.toString();
    return apiRequest(`/tasks${query ? `?${query}` : ''}`, 'GET', null, { role: role || getCurrentUserRole() });
  },
  get: (id: string, role?: ApiClientOptions['role']) => apiRequest(`/tasks/${id}`, 'GET', null, { role: role || getCurrentUserRole() }),
  create: (payload: any, role?: ApiClientOptions['role']) => apiRequest('/tasks', 'POST', payload, { role: role || getCurrentUserRole() }),
  update: (id: string, payload: any, role?: ApiClientOptions['role']) => apiRequest(`/tasks/${id}`, 'PUT', payload, { role: role || getCurrentUserRole() }),
  remove: (id: string, role?: ApiClientOptions['role']) => apiRequest(`/tasks/${id}`, 'DELETE', null, { role: role || getCurrentUserRole() }),
};

export const joinRequestsApi = {
  list: (params?: { projectId?: string; userId?: string; status?: string }, role?: ApiClientOptions['role']) => {
    const queryParams = new URLSearchParams();
    if (params?.projectId) queryParams.append('projectId', params.projectId);
    if (params?.userId) queryParams.append('userId', params.userId);
    if (params?.status) queryParams.append('status', params.status);
    const query = queryParams.toString();
    return apiRequest(`/join-requests${query ? `?${query}` : ''}`, 'GET', null, { role: role || getCurrentUserRole() });
  },
  get: (id: string, role?: ApiClientOptions['role']) => apiRequest(`/join-requests/${id}`, 'GET', null, { role: role || getCurrentUserRole() }),
  create: (payload: any, role?: ApiClientOptions['role']) => apiRequest('/join-requests', 'POST', payload, { role: role || getCurrentUserRole() }),
  update: (id: string, payload: any, role?: ApiClientOptions['role']) => apiRequest(`/join-requests/${id}`, 'PUT', payload, { role: role || getCurrentUserRole() }),
  remove: (id: string, role?: ApiClientOptions['role']) => apiRequest(`/join-requests/${id}`, 'DELETE', null, { role: role || getCurrentUserRole() }),
};
