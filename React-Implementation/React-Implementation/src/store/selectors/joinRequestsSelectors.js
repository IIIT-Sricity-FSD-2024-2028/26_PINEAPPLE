import { createSelector } from '@reduxjs/toolkit';
import { deriveFilterGroup } from '../slices/joinRequestsSlice';

const EMPTY_LIST = [];
const EMPTY_COUNTS = { all: 0, pending: 0, approved: 0, rejected: 0 };

export const selectJoinRequestsSlice = (state) => state?.joinRequests;

export const selectAllJoinRequests = createSelector(
  [
    (state) => state?.joinRequests?.entities,
    (state) => state?.joinRequests?.ids,
  ],
  (entities, ids) => {
    if (!entities || !Array.isArray(ids) || ids.length === 0) return EMPTY_LIST;
    return ids.map((id) => entities[id]).filter(Boolean);
  },
);

export const selectMyJoinRequests = createSelector(
  [
    (state) => state?.joinRequests?.entities,
    (state) => state?.joinRequests?.myRequestIds,
  ],
  (entities, myIds) => {
    if (!entities || !Array.isArray(myIds) || myIds.length === 0) return EMPTY_LIST;
    return myIds.map((id) => entities[id]).filter(Boolean);
  },
);

export const selectMyJoinRequestsStatus = (state) =>
  state?.joinRequests?.myStatus || 'idle';

export const selectJoinRequestById = (state, id) =>
  id ? state?.joinRequests?.entities?.[String(id)] || null : null;

export const selectJoinRequestsByProjectId = createSelector(
  [
    (state) => state?.joinRequests?.entities,
    (state) => state?.joinRequests?.requestIdsByProject,
    (_state, projectId) => (projectId ? String(projectId) : ''),
  ],
  (entities, requestIdsByProject, pid) => {
    if (!pid || !entities || !requestIdsByProject) return EMPTY_LIST;
    const ids = requestIdsByProject[pid];
    if (!Array.isArray(ids) || ids.length === 0) return EMPTY_LIST;
    return ids.map((id) => entities[id]).filter(Boolean);
  },
);

export const selectJoinRequestRespondingIds = (state) =>
  state?.joinRequests?.respondingIds || {};

export const selectIsJoinRequestResponding = (state, requestId) =>
  Boolean(requestId && state?.joinRequests?.respondingIds?.[String(requestId)]);

export const selectJoinRequestsWorking = (state) =>
  state?.joinRequests?.working || {
    requestStatusFilter: 'all',
    membersSubSection: 'all',
    selectedRequestId: null,
    rejectReasonError: '',
    applyError: null,
    respondError: null,
  };

export const selectRequestStatusFilter = (state) =>
  state?.joinRequests?.working?.requestStatusFilter || 'all';

export const selectMembersSubSection = (state) =>
  state?.joinRequests?.working?.membersSubSection || 'all';

/**
 * Combines project join requests (`Applied`) and project invites (`Invited`) into
 * one deduplicated list ordered newest first, preserving server `filterGroup` & counts.
 */
export const selectCombinedProjectRequests = createSelector(
  [
    selectJoinRequestsByProjectId,
    (state) => state?.projectInvites?.entities,
    (state) => state?.projectInvites?.inviteIdsByProject,
    (state, projectId) =>
      projectId ? state?.joinRequests?.countsByProject?.[String(projectId)] : null,
    (_state, projectId) => (projectId ? String(projectId) : ''),
  ],
  (joinRequests, inviteEntities, inviteIdsByProject, serverCounts, pid) => {
    const projectInviteIds =
      pid && inviteIdsByProject ? inviteIdsByProject[pid] || EMPTY_LIST : EMPTY_LIST;
    const projectInvites = inviteEntities
      ? projectInviteIds.map((id) => inviteEntities[id]).filter(Boolean)
      : EMPTY_LIST;

    if (joinRequests.length === 0 && projectInvites.length === 0) {
      return {
        items: EMPTY_LIST,
        pendingItems: EMPTY_LIST,
        approvedItems: EMPTY_LIST,
        rejectedItems: EMPTY_LIST,
        counts: serverCounts || EMPTY_COUNTS,
      };
    }

    const list = [];
    const seenIds = new Set();

    for (const req of joinRequests) {
      if (!req || !req.id) continue;
      seenIds.add(String(req.id));
      const isInv = req.type === 'Invited';
      const type = isInv ? 'Invited' : 'Applied';
      const filterGroup = deriveFilterGroup(req);
      list.push({
        ...req,
        type,
        filterGroup,
        date: req.date || req.sentAt || req.createdAt,
      });
    }

    let addedSeparateInvites = false;
    for (const inv of projectInvites) {
      if (!inv || !inv.id || seenIds.has(String(inv.id))) continue;
      seenIds.add(String(inv.id));
      addedSeparateInvites = true;
      const statusLower = String(inv.status || 'pending').toLowerCase();
      let filterGroup = 'All';
      let displayStatus = inv.status || 'Pending';
      if (statusLower === 'pending') {
        filterGroup = 'Pending';
        displayStatus = 'Pending';
      } else if (statusLower === 'accepted') {
        filterGroup = 'Approved';
        displayStatus = 'Accepted';
      } else if (statusLower === 'declined') {
        filterGroup = 'Rejected';
        displayStatus = 'Declined';
      } else if (statusLower === 'cancelled') {
        displayStatus = 'Cancelled';
      } else if (statusLower === 'expired') {
        displayStatus = 'Expired';
      }

      const inviteeName =
        inv.invitedUserName ||
        inv.invitedUsername ||
        inv.invitedUserId ||
        'Invited Collaborator';

      list.push({
        id: inv.id,
        projectId: inv.projectId,
        userId: inv.invitedUserId,
        type: 'Invited',
        filterGroup,
        applicantName: inviteeName,
        userName: inviteeName,
        name: inviteeName,
        username: inv.invitedUsername || '',
        applicantUsername: inv.invitedUsername || '',
        role: 'Collaborator',
        status: displayStatus,
        rawStatus: inv.status,
        message: inv.message || 'Direct invitation to join project',
        date: inv.createdAt,
        sentAt: inv.createdAt,
        createdAt: inv.createdAt,
      });
    }

    list.sort(
      (a, b) =>
        new Date(b.date || b.createdAt || 0) -
        new Date(a.date || a.createdAt || 0),
    );

    const pendingItems = list.filter((item) => item.filterGroup === 'Pending');
    const approvedItems = list.filter((item) => item.filterGroup === 'Approved');
    const rejectedItems = list.filter((item) => item.filterGroup === 'Rejected');

    const counts =
      !addedSeparateInvites && serverCounts
        ? serverCounts
        : {
            all: list.length,
            pending: pendingItems.length,
            approved: approvedItems.length,
            rejected: rejectedItems.length,
          };

    return {
      items: list,
      pendingItems,
      approvedItems,
      rejectedItems,
      counts,
    };
  },
);

export const selectFilteredCombinedProjectRequests = createSelector(
  [selectCombinedProjectRequests, selectRequestStatusFilter],
  (combined, filter) => {
    if (filter === 'pending') return combined.pendingItems;
    if (filter === 'approved') return combined.approvedItems;
    if (filter === 'rejected') return combined.rejectedItems;
    return combined.items;
  },
);
