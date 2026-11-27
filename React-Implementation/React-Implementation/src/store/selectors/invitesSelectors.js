import { createSelector } from '@reduxjs/toolkit';

const EMPTY_LIST = [];

export const selectProjectInvitesSlice = (state) => state?.projectInvites;

export const selectMyInvites = createSelector(
  [
    (state) => state?.projectInvites?.entities,
    (state) => state?.projectInvites?.myInviteIds,
  ],
  (entities, myInviteIds) => {
    if (!entities || !Array.isArray(myInviteIds) || myInviteIds.length === 0) {
      return EMPTY_LIST;
    }
    return myInviteIds.map((id) => entities[id]).filter(Boolean);
  },
);

export const selectMyPendingInvites = createSelector(
  [selectMyInvites],
  (invites) =>
    invites.filter(
      (inv) => String(inv.status || '').toLowerCase() === 'pending',
    ),
);

export const selectProjectInvitesByProjectId = createSelector(
  [
    (state) => state?.projectInvites?.entities,
    (state) => state?.projectInvites?.inviteIdsByProject,
    (_state, projectId) => (projectId ? String(projectId) : ''),
  ],
  (entities, inviteIdsByProject, pid) => {
    if (!pid || !entities || !inviteIdsByProject) return EMPTY_LIST;
    const ids = inviteIdsByProject[pid];
    if (!Array.isArray(ids) || ids.length === 0) return EMPTY_LIST;
    return ids.map((id) => entities[id]).filter(Boolean);
  },
);

export const selectInviteActingIds = (state) =>
  state?.projectInvites?.actingIds || {};

export const selectIsInviteActing = (state, inviteId) =>
  Boolean(inviteId && state?.projectInvites?.actingIds?.[String(inviteId)]);

export const selectInvitesSendStatus = (state) =>
  state?.projectInvites?.sendStatus || 'idle';

export const selectInvitesWorking = (state) =>
  state?.projectInvites?.working || {
    selectedInviteId: null,
    sendError: null,
    actionError: null,
    actionSuccess: null,
  };
