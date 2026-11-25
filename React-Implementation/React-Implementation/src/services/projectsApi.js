import { apiRequest, clearApiCache, getCurrentUserRole, getCurrentUserId } from './apiClient.js';

export function isProjectLocked(project) {
  if (!project) return false;
  if (project.isCompleted === true || project.is_completed === true) return true;
  if (project.deletionScheduledAt) return true;
  const status = typeof project.status === 'string' ? project.status.toLowerCase() : '';
  if (status === 'completed' || status === 'closed' || status === 'deleted' || status === 'deletion_scheduled') return true;
  return false;
}

export function isProjectActive(project) {
  if (!project) return false;
  if (isProjectLocked(project)) return false;
  const status = String(project.status || '').toLowerCase().trim();
  return status !== 'completed' && status !== 'closed' && status !== 'cancelled' && status !== 'archived';
}

export const projectsApi = {
  isLocked: isProjectLocked,
  isActive: isProjectActive,
  getMyWork: (userId, role) => {
    const uid = userId || getCurrentUserId();
    return apiRequest(`/projects/collaborator/${encodeURIComponent(uid)}`, "GET", null, {
      role: role || getCurrentUserRole(),
      userId: uid || "",
    });
  },
  list: (params, role) => {
    const queryParams = new URLSearchParams();
    if (params?.owner) queryParams.append("owner", params.owner);
    if (params?.status) queryParams.append("status", params.status);
    if (params?.skill) queryParams.append("skill", params.skill);
    if (params?.collaborator) queryParams.append("collaborator", params.collaborator);
    const query = queryParams.toString();
    return apiRequest(`/projects${query ? `?${query}` : ""}`, "GET", null, {
      role: role || getCurrentUserRole(),
    });
  },
  get: (id, role) =>
    apiRequest(`/projects/${id}`, "GET", null, {
      role: role || getCurrentUserRole(),
    }),
  getMembers: (id, role) =>
    apiRequest(`/projects/${id}/members`, "GET", null, {
      role: role || getCurrentUserRole(),
    }),
  getRemovalCheck: (id, userId, role) =>
    apiRequest(`/projects/${id}/members/${encodeURIComponent(userId)}/removal-check`, "GET", null, {
      role: role || getCurrentUserRole(),
      userId: getCurrentUserId() || "",
    }),
  create: async (payload, role, userId) => {
    const res = await apiRequest("/projects", "POST", payload, {
      role: role || getCurrentUserRole(),
      userId: userId || getCurrentUserId() || "",
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("teamforge:project_updated"));
    }
    return res;
  },
  update: async (id, payload, role) => {
    const res = await apiRequest(`/projects/${id}`, "PATCH", payload, {
      role: role || getCurrentUserRole(),
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("teamforge:project_updated"));
    }
    return res;
  },
  complete: async (id, payload, role) => {
    const res = await apiRequest(`/projects/${id}/complete`, "POST", payload, {
      role: role || getCurrentUserRole(),
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("teamforge:project_updated"));
      window.dispatchEvent(new CustomEvent("teamforge:task_updated"));
    }
    return res;
  },
  leave: async (id, payloadOrRole, role, userId) => {
    let payload = null;
    let actualRole = role;
    if (payloadOrRole && typeof payloadOrRole === 'object') {
      payload = payloadOrRole;
    } else if (typeof payloadOrRole === 'string') {
      actualRole = payloadOrRole;
    }
    const res = await apiRequest(`/projects/${id}/leave`, "POST", payload, {
      role: actualRole || getCurrentUserRole(),
      userId: userId || getCurrentUserId() || "",
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("teamforge:project_updated"));
    }
    return res;
  },
  submitLeaveRequest: async (id, payload, role, userId) => {
    const res = await apiRequest(`/projects/${id}/leave-requests`, "POST", payload, {
      role: role || getCurrentUserRole(),
      userId: userId || getCurrentUserId() || "",
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("teamforge:project_updated"));
    }
    return res;
  },
  getMyLeaveRequest: (id, role, userId) =>
    apiRequest(`/projects/${id}/leave-requests/mine`, "GET", null, {
      role: role || getCurrentUserRole(),
      userId: userId || getCurrentUserId() || "",
      skipCache: true,
    }),
  withdrawLeaveRequest: async (id, role, userId) => {
    const res = await apiRequest(`/projects/${id}/leave-requests/mine`, "DELETE", null, {
      role: role || getCurrentUserRole(),
      userId: userId || getCurrentUserId() || "",
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("teamforge:project_updated"));
    }
    return res;
  },
  listLeaveRequests: (id, role) =>
    apiRequest(`/projects/${id}/leave-requests`, "GET", null, {
      role: role || getCurrentUserRole(),
      skipCache: true,
    }),
  approveLeaveRequest: async (requestId, projectId, role) => {
    const url = projectId
      ? `/projects/${projectId}/leave-requests/${requestId}/approve`
      : `/leave-requests/${requestId}/approve`;
    const res = await apiRequest(url, "POST", {}, {
      role: role || getCurrentUserRole(),
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("teamforge:project_updated"));
      window.dispatchEvent(new CustomEvent("teamforge:task_updated"));
    }
    return res;
  },
  rejectLeaveRequest: async (requestId, payload, projectId, role) => {
    const url = projectId
      ? `/projects/${projectId}/leave-requests/${requestId}/reject`
      : `/leave-requests/${requestId}/reject`;
    const res = await apiRequest(url, "POST", payload, {
      role: role || getCurrentUserRole(),
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("teamforge:project_updated"));
    }
    return res;
  },
  getMyRequestStatus: (id, role) =>
    apiRequest(`/projects/${id}/my-request-status`, "GET", null, {
      role: role || getCurrentUserRole(),
    }),
  removeMember: async (id, memberId, reason, role, userId) => {
    const payload = typeof reason === 'object' && reason !== null ? { ...reason } : { reason };
    const res = await apiRequest(`/projects/${id}/members/${encodeURIComponent(memberId)}`, "DELETE", payload, {
      role: role || getCurrentUserRole(),
      userId: userId || getCurrentUserId() || "",
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("teamforge:project_updated"));
    }
    return res;
  },
  changeDeadline: async (id, payload, role, userId) => {
    const res = await apiRequest(`/projects/${id}/deadline`, "PATCH", payload, {
      role: role || getCurrentUserRole(),
      userId: userId || getCurrentUserId() || "",
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("teamforge:project_updated"));
    }
    return res;
  },
  releaseMemberTasks: async (id, userId, role) => {
    const res = await apiRequest(`/projects/${id}/members/${encodeURIComponent(userId)}/release-tasks`, "POST", null, {
      role: role || getCurrentUserRole(),
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("teamforge:task_updated"));
      window.dispatchEvent(new CustomEvent("teamforge:project_updated"));
    }
    return res;
  },
  requestClose: async (id, payload, role) => {
    const res = await apiRequest(`/projects/${id}/request-close`, "POST", payload || {}, {
      role: role || getCurrentUserRole(),
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("teamforge:project_updated"));
    }
    return res;
  },
  close: async (id, reason = 'Owner inactive', role) => {
    const res = await apiRequest(`/admin/projects/${id}/close`, "POST", { reason }, {
      role: role || getCurrentUserRole(),
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("teamforge:project_updated"));
    }
    return res;
  },
  getMatch: (id, role, userId) =>
    apiRequest(`/projects/${id}/match`, "GET", null, {
      role: role || getCurrentUserRole(),
      userId: userId || getCurrentUserId(),
      skipCache: true,
    }),
  listInvites: (id, role) =>
    apiRequest(`/projects/${id}/invites`, "GET", null, {
      role: role || getCurrentUserRole(),
      userId: getCurrentUserId(),
      skipCache: true,
    }),
  sendInvite: async (id, username, role) => {
    const res = await apiRequest(`/projects/${id}/invites`, "POST", { username }, {
      role: role || getCurrentUserRole(),
      userId: getCurrentUserId(),
    });
    clearApiCache();
    return res;
  },
  cancelInvite: async (id, inviteId, payloadOrRole, maybeRole) => {
    const payload = typeof payloadOrRole === 'object' && payloadOrRole !== null ? payloadOrRole : null;
    const effectiveRole = typeof payloadOrRole === 'string' ? payloadOrRole : maybeRole;
    const res = await apiRequest(`/projects/${id}/invites/${inviteId}`, "DELETE", payload, {
      role: effectiveRole || getCurrentUserRole(),
      userId: getCurrentUserId(),
    });
    clearApiCache();
    return res;
  },
  getMyInvites: (role, userId) =>
    apiRequest("/users/me/invites", "GET", null, {
      role: role || getCurrentUserRole(),
      userId: userId || getCurrentUserId(),
      skipCache: true,
    }),
  acceptInvite: async (inviteId, role) => {
    const res = await apiRequest(`/invites/${inviteId}/accept`, "POST", {}, {
      role: role || getCurrentUserRole(),
      userId: getCurrentUserId(),
    });
    clearApiCache();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("teamforge:project_updated"));
    }
    return res;
  },
  declineInvite: async (inviteId, blockOrPayload = false, role) => {
    const payload =
      typeof blockOrPayload === 'object' && blockOrPayload !== null
        ? { ...blockOrPayload }
        : { block: Boolean(blockOrPayload) };
    const res = await apiRequest(`/invites/${inviteId}/decline`, "POST", payload, {
      role: role || getCurrentUserRole(),
      userId: getCurrentUserId(),
    });
    clearApiCache();
    return res;
  },
  checkDeletion: (id, role) =>
    apiRequest(`/projects/${id}/deletion-check`, "GET", null, {
      role: role || getCurrentUserRole(),
      skipCache: true,
    }),
  cancelDeletion: async (id, role) => {
    const res = await apiRequest(`/projects/${id}/cancel-deletion`, "POST", {}, {
      role: role || getCurrentUserRole(),
      userId: getCurrentUserId(),
    });
    clearApiCache();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("teamforge:project_updated"));
    }
    return res;
  },
  softDelete: async (id, payloadOrRole, maybeRole) => {
    const payload = typeof payloadOrRole === 'object' && payloadOrRole !== null ? payloadOrRole : null;
    const effectiveRole = typeof payloadOrRole === 'string' ? payloadOrRole : maybeRole;
    const res = await apiRequest(`/projects/${id}`, "DELETE", payload, {
      role: effectiveRole || getCurrentUserRole(),
      userId: getCurrentUserId(),
    });
    clearApiCache();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("teamforge:project_updated"));
    }
    return res;
  },
  restore: async (id, role) => {
    const res = await apiRequest(`/admin/projects/${id}/restore`, "POST", {}, {
      role: role || getCurrentUserRole(),
      userId: getCurrentUserId(),
    });
    clearApiCache();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("teamforge:project_updated"));
    }
    return res;
  },
  getTaskTemplatesByCategory: (category = 'General', role) =>
    apiRequest(`/task-templates?category=${encodeURIComponent(category || 'General')}`, "GET", null, {
      role: role || getCurrentUserRole(),
      skipCache: true,
    }),
  getProjectTaskTemplates: (id, role, userId) =>
    apiRequest(`/projects/${id}/task-templates`, "GET", null, {
      role: role || getCurrentUserRole(),
      userId: userId || getCurrentUserId(),
      skipCache: true,
    }),
  applyProjectTaskTemplates: async (id, payload, role, userId) => {
    const res = await apiRequest(`/projects/${id}/task-templates/apply`, "POST", payload, {
      role: role || getCurrentUserRole(),
      userId: userId || getCurrentUserId(),
    });
    clearApiCache();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("teamforge:task_updated"));
      window.dispatchEvent(new CustomEvent("teamforge:project_updated"));
    }
    return res;
  },
};

export default projectsApi;
