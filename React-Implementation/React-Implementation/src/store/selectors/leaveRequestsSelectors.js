import { createSelector } from '@reduxjs/toolkit';

const EMPTY_LIST = [];

export const selectLeaveRequestsSlice = (state) => state?.leaveRequests;

export const selectLeaveRequestsByProjectId = createSelector(
  [
    (state) => state?.leaveRequests?.entities,
    (state) => state?.leaveRequests?.leaveRequestIdsByProject,
    (_state, projectId) => (projectId ? String(projectId) : ''),
  ],
  (entities, leaveRequestIdsByProject, pid) => {
    if (!pid || !entities || !leaveRequestIdsByProject) return EMPTY_LIST;
    const ids = leaveRequestIdsByProject[pid];
    if (!Array.isArray(ids) || ids.length === 0) return EMPTY_LIST;
    return ids.map((id) => entities[id]).filter(Boolean);
  },
);

export const selectPendingLeaveRequestsByProjectId = createSelector(
  [selectLeaveRequestsByProjectId],
  (items) =>
    items.filter((r) => String(r.status || '').toLowerCase() === 'pending'),
);

export const selectMyLeaveRequestForProject = (state, projectId) => {
  if (!projectId) return null;
  const pid = String(projectId);
  const myId = state?.leaveRequests?.myLeaveRequestIdByProject?.[pid];
  if (myId && state?.leaveRequests?.entities?.[myId]) {
    const req = state.leaveRequests.entities[myId];
    return req?.status === 'pending' ? req : null;
  }
  return state?.projects?.myLeaveRequestByProject?.[pid] || null;
};

export const selectLeaveProcessingIds = (state) =>
  state?.leaveRequests?.processingIds || {};

export const selectIsLeaveProcessing = (state, requestId) =>
  Boolean(requestId && state?.leaveRequests?.processingIds?.[String(requestId)]);

export const selectLeaveCooldownForProject = (state, projectId) =>
  projectId
    ? state?.leaveRequests?.working?.cooldownMessageByProject?.[
        String(projectId)
      ] || ''
    : '';

export const selectLeaveRequestsWorking = (state) =>
  state?.leaveRequests?.working || {
    cooldownMessageByProject: {},
    submitError: null,
    respondError: null,
    rejectingRequestId: null,
  };
