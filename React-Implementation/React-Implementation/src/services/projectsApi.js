import { apiRequest, getCurrentUserRole, getCurrentUserId } from './apiClient.js';

export const projectsApi = {
  getMyWork: (userId, role) => {
    const uid = userId || getCurrentUserId();
    return apiRequest(`/projects/collaborator/${encodeURIComponent(uid)}`, 'GET', null, {
      role: role || getCurrentUserRole(),
      userId: uid || '',
    });
  },
  list: (params, role) => {
    const queryParams = new URLSearchParams();
    if (params?.owner) queryParams.append('owner', params.owner);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.skill) queryParams.append('skill', params.skill);
    if (params?.collaborator) queryParams.append('collaborator', params.collaborator);
    const query = queryParams.toString();
    return apiRequest(`/projects${query ? `?${query}` : ''}`, 'GET', null, {
      role: role || getCurrentUserRole(),
    });
  },
  get: (id, role) =>
    apiRequest(`/projects/${id}`, 'GET', null, {
      role: role || getCurrentUserRole(),
    }),
  getMembers: (id, role) =>
    apiRequest(`/projects/${id}/members`, 'GET', null, {
      role: role || getCurrentUserRole(),
    }),
  getRemovalCheck: (id, userId, role) =>
    apiRequest(`/projects/${id}/members/${encodeURIComponent(userId)}/removal-check`, 'GET', null, {
      role: role || getCurrentUserRole(),
      userId: getCurrentUserId() || '',
    }),
  create: (payload, role, userId) =>
    apiRequest('/projects', 'POST', payload, {
      role: role || getCurrentUserRole(),
      userId: userId || getCurrentUserId() || '',
    }),
  update: (id, payload, role) =>
    apiRequest(`/projects/${id}`, 'PATCH', payload, {
      role: role || getCurrentUserRole(),
    }),
  complete: (id, payload, role) =>
    apiRequest(`/projects/${id}/complete`, 'POST', payload, {
      role: role || getCurrentUserRole(),
    }),
  leave: (id, payloadOrRole, role, userId) => {
    let payload = null;
    let actualRole = role;
    if (payloadOrRole && typeof payloadOrRole === 'object') {
      payload = payloadOrRole;
    } else if (typeof payloadOrRole === 'string') {
      actualRole = payloadOrRole;
    }
    return apiRequest(`/projects/${id}/leave`, 'POST', payload, {
      role: actualRole || getCurrentUserRole(),
      userId: userId || getCurrentUserId() || '',
    });
  },
  submitLeaveRequest: (id, payload, role, userId) =>
    apiRequest(`/projects/${id}/leave-requests`, 'POST', payload, {
      role: role || getCurrentUserRole(),
      userId: userId || getCurrentUserId() || '',
    }),
  getMyLeaveRequest: (id, role, userId) =>
    apiRequest(`/projects/${id}/leave-requests/mine`, 'GET', null, {
      role: role || getCurrentUserRole(),
      userId: userId || getCurrentUserId() || '',
      skipCache: true,
    }),
  withdrawLeaveRequest: (id, role, userId) =>
    apiRequest(`/projects/${id}/leave-requests/mine`, 'DELETE', null, {
      role: role || getCurrentUserRole(),
      userId: userId || getCurrentUserId() || '',
    }),
  listLeaveRequests: (id, role) =>
    apiRequest(`/projects/${id}/leave-requests`, 'GET', null, {
      role: role || getCurrentUserRole(),
      skipCache: true,
    }),
  approveLeaveRequest: (requestId, projectId, role) => {
    const url = projectId
      ? `/projects/${projectId}/leave-requests/${requestId}/approve`
      : `/leave-requests/${requestId}/approve`;
    return apiRequest(url, 'POST', {}, {
      role: role || getCurrentUserRole(),
    });
  },
  rejectLeaveRequest: (requestId, payload, projectId, role) => {
    const url = projectId
      ? `/projects/${projectId}/leave-requests/${requestId}/reject`
      : `/leave-requests/${requestId}/reject`;
    return apiRequest(url, 'POST', payload, {
      role: role || getCurrentUserRole(),
    });
  },
  removeMember: (id, memberId, reason, role, userId) => {
    const payload =
      typeof reason === 'object' && reason !== null ? { ...reason } : { reason };
    return apiRequest(`/projects/${id}/members/${encodeURIComponent(memberId)}`, 'DELETE', payload, {
      role: role || getCurrentUserRole(),
      userId: userId || getCurrentUserId() || '',
    });
  },
  changeDeadline: (id, payload, role, userId) =>
    apiRequest(`/projects/${id}/deadline`, 'PATCH', payload, {
      role: role || getCurrentUserRole(),
      userId: userId || getCurrentUserId() || '',
    }),
  releaseMemberTasks: (id, userId, role) =>
    apiRequest(
      `/projects/${id}/members/${encodeURIComponent(userId)}/release-tasks`,
      'POST',
      null,
      {
        role: role || getCurrentUserRole(),
      },
    ),
  requestClose: (id, payload, role) =>
    apiRequest(`/projects/${id}/request-close`, 'POST', payload || {}, {
      role: role || getCurrentUserRole(),
    }),
  close: (id, reason = 'Owner inactive', role) =>
    apiRequest(`/admin/projects/${id}/close`, 'POST', { reason }, {
      role: role || getCurrentUserRole(),
    }),
  getMatch: (id, role, userId) =>
    apiRequest(`/projects/${id}/match`, 'GET', null, {
      role: role || getCurrentUserRole(),
      userId: userId || getCurrentUserId(),
      skipCache: true,
    }),
  listInvites: (id, role) =>
    apiRequest(`/projects/${id}/invites`, 'GET', null, {
      role: role || getCurrentUserRole(),
      userId: getCurrentUserId(),
      skipCache: true,
    }),
  sendInvite: (id, username, role) =>
    apiRequest(`/projects/${id}/invites`, 'POST', { username }, {
      role: role || getCurrentUserRole(),
      userId: getCurrentUserId(),
    }),
  cancelInvite: (id, inviteId, payloadOrRole, maybeRole) => {
    const payload =
      typeof payloadOrRole === 'object' && payloadOrRole !== null ? payloadOrRole : null;
    const effectiveRole =
      typeof payloadOrRole === 'string' ? payloadOrRole : maybeRole;
    return apiRequest(`/projects/${id}/invites/${inviteId}`, 'DELETE', payload, {
      role: effectiveRole || getCurrentUserRole(),
      userId: getCurrentUserId(),
    });
  },
  getMyInvites: (role, userId) =>
    apiRequest('/users/me/invites', 'GET', null, {
      role: role || getCurrentUserRole(),
      userId: userId || getCurrentUserId(),
      skipCache: true,
    }),
  acceptInvite: (inviteId, role) =>
    apiRequest(`/invites/${inviteId}/accept`, 'POST', {}, {
      role: role || getCurrentUserRole(),
      userId: getCurrentUserId(),
    }),
  declineInvite: (inviteId, blockOrPayload = false, role) => {
    const payload =
      typeof blockOrPayload === 'object' && blockOrPayload !== null
        ? { ...blockOrPayload }
        : { block: Boolean(blockOrPayload) };
    return apiRequest(`/invites/${inviteId}/decline`, 'POST', payload, {
      role: role || getCurrentUserRole(),
      userId: getCurrentUserId(),
    });
  },
  checkDeletion: (id, role) =>
    apiRequest(`/projects/${id}/deletion-check`, 'GET', null, {
      role: role || getCurrentUserRole(),
      skipCache: true,
    }),
  cancelDeletion: (id, role) =>
    apiRequest(`/projects/${id}/cancel-deletion`, 'POST', {}, {
      role: role || getCurrentUserRole(),
      userId: getCurrentUserId(),
    }),
  softDelete: (id, payloadOrRole, maybeRole) => {
    const payload =
      typeof payloadOrRole === 'object' && payloadOrRole !== null ? payloadOrRole : null;
    const effectiveRole =
      typeof payloadOrRole === 'string' ? payloadOrRole : maybeRole;
    return apiRequest(`/projects/${id}`, 'DELETE', payload, {
      role: effectiveRole || getCurrentUserRole(),
      userId: getCurrentUserId(),
    });
  },
  restore: (id, role) =>
    apiRequest(`/admin/projects/${id}/restore`, 'POST', {}, {
      role: role || getCurrentUserRole(),
      userId: getCurrentUserId(),
    }),
  getTaskTemplatesByCategory: (category = 'General', role) =>
    apiRequest(
      `/task-templates?category=${encodeURIComponent(category || 'General')}`,
      'GET',
      null,
      {
        role: role || getCurrentUserRole(),
        skipCache: true,
      },
    ),
  getProjectTaskTemplates: (id, role, userId) =>
    apiRequest(`/projects/${id}/task-templates`, 'GET', null, {
      role: role || getCurrentUserRole(),
      userId: userId || getCurrentUserId(),
      skipCache: true,
    }),
  applyProjectTaskTemplates: (id, payload, role, userId) =>
    apiRequest(`/projects/${id}/task-templates/apply`, 'POST', payload, {
      role: role || getCurrentUserRole(),
      userId: userId || getCurrentUserId(),
    }),
};

export default projectsApi;
