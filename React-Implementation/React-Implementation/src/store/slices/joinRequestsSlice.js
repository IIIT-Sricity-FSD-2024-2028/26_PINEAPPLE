import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import { addRouteReset } from '../utils/routeReset';
import { sessionReset } from '../actions/appActions';
import {
  createJoinRequest,
  deleteJoinRequest,
  fetchJoinRequestById,
  fetchJoinRequests,
  fetchMyJoinRequests,
  respondJoinRequest,
  updateJoinRequest,
} from '../thunks/joinRequestsThunks';
import {
  acceptProjectInvite,
  cancelProjectInvite,
  declineProjectInvite,
} from '../thunks/invitesThunks';
import {
  completeProject,
  removeProjectMember,
} from '../thunks/projectsThunks';

/**
 * Join Requests Repository Slice (`joinRequestsSlice`)
 * ====================================================
 * Stores collaborator project applications (`Applied`) and optional server-merged
 * owner request rows (`GET /join-requests?projectId=...`) in normalized state.
 */
export const joinRequestsAdapter = createEntityAdapter({
  selectId: (req) => String(req.id),
});

export function createInitialJoinRequestsWorking() {
  return {
    requestStatusFilter: 'all', // 'all' | 'pending' | 'approved' | 'rejected'
    membersSubSection: 'all', // 'all' | 'team' | 'requests'
    selectedRequestId: null,
    rejectReasonError: '',
    applyError: null,
    respondError: null,
  };
}

export function createInitialJoinRequestsState() {
  return joinRequestsAdapter.getInitialState({
    myRequestIds: [],
    requestIdsByProject: {},
    countsByProject: {},
    respondingIds: {},
    status: 'idle',
    myStatus: 'idle',
    createStatus: 'idle',
    deleteStatus: 'idle',
    byProjectStatus: {},
    byProjectError: {},
    byProjectLastFetchedAt: {},
    myLastFetchedAt: null,
    error: null,
    working: createInitialJoinRequestsWorking(),
  });
}

function ensureSubstates(state) {
  if (!state.entities) state.entities = {};
  if (!Array.isArray(state.ids)) state.ids = [];
  if (!Array.isArray(state.myRequestIds)) state.myRequestIds = [];
  if (!state.requestIdsByProject) state.requestIdsByProject = {};
  if (!state.countsByProject) state.countsByProject = {};
  if (!state.respondingIds) state.respondingIds = {};
  if (!state.byProjectStatus) state.byProjectStatus = {};
  if (!state.byProjectError) state.byProjectError = {};
  if (!state.byProjectLastFetchedAt) state.byProjectLastFetchedAt = {};
  if (!state.working) state.working = createInitialJoinRequestsWorking();
}

export function deriveFilterGroup(item) {
  if (item?.filterGroup) return item.filterGroup;
  const st = String(item?.status || 'pending').toLowerCase().trim();
  if (st === 'pending') return 'Pending';
  if (st === 'approved' || st === 'accepted') return 'Approved';
  if (st === 'rejected' || st === 'declined') return 'Rejected';
  return 'All';
}

function computeCountsFromItems(items) {
  let pending = 0;
  let approved = 0;
  let rejected = 0;
  for (const item of items) {
    if (!item) continue;
    const fg = deriveFilterGroup(item);
    if (fg === 'Pending') pending += 1;
    else if (fg === 'Approved') approved += 1;
    else if (fg === 'Rejected') rejected += 1;
  }
  return {
    all: items.length,
    pending,
    approved,
    rejected,
  };
}

function recomputeProjectCountsIfTracked(state, projectId) {
  if (!projectId) return;
  const pid = String(projectId);
  const ids = state.requestIdsByProject[pid];
  if (!Array.isArray(ids)) return;
  const items = ids.map((id) => state.entities[id]).filter(Boolean);
  state.countsByProject[pid] = computeCountsFromItems(items);
}

const initialState = createInitialJoinRequestsState();

const joinRequestsSlice = createSlice({
  name: 'joinRequests',
  initialState,
  reducers: {
    /**
     * 4 explicit synchronous CRUD reducers (SPEC 2 & 3 / Decision D2).
     */
    setAll: (state, action) => {
      ensureSubstates(state);
      const list = (Array.isArray(action.payload) ? action.payload : []).filter(
        Boolean,
      );
      joinRequestsAdapter.setAll(state, list);
      state.requestIdsByProject = {};
      for (const req of list) {
        if (!req.projectId) continue;
        const pid = String(req.projectId);
        if (!state.requestIdsByProject[pid]) {
          state.requestIdsByProject[pid] = [];
        }
        state.requestIdsByProject[pid].push(String(req.id));
      }
    },
    addOne: (state, action) => {
      ensureSubstates(state);
      if (!action.payload?.id) return;
      joinRequestsAdapter.upsertOne(state, action.payload);
      const idStr = String(action.payload.id);
      if (action.payload.projectId) {
        const pid = String(action.payload.projectId);
        const existing = state.requestIdsByProject[pid] || [];
        if (!existing.includes(idStr)) {
          state.requestIdsByProject[pid] = [idStr, ...existing];
          recomputeProjectCountsIfTracked(state, pid);
        }
      }
      if (!state.myRequestIds.includes(idStr)) {
        state.myRequestIds = [idStr, ...state.myRequestIds];
      }
    },
    updateOne: (state, action) => {
      ensureSubstates(state);
      joinRequestsAdapter.updateOne(state, action);
      const idStr = String(action.payload?.id || '');
      const entity = state.entities[idStr];
      if (entity?.projectId) {
        recomputeProjectCountsIfTracked(state, entity.projectId);
      }
    },
    removeOne: (state, action) => {
      ensureSubstates(state);
      const idStr = String(action.payload);
      const existing = state.entities[idStr];
      joinRequestsAdapter.removeOne(state, idStr);
      state.myRequestIds = state.myRequestIds.filter((id) => id !== idStr);
      if (existing?.projectId) {
        const pid = String(existing.projectId);
        if (Array.isArray(state.requestIdsByProject[pid])) {
          state.requestIdsByProject[pid] = state.requestIdsByProject[pid].filter(
            (id) => id !== idStr,
          );
          recomputeProjectCountsIfTracked(state, pid);
        }
      } else {
        for (const pid of Object.keys(state.requestIdsByProject)) {
          state.requestIdsByProject[pid] = (
            state.requestIdsByProject[pid] || []
          ).filter((id) => id !== idStr);
        }
      }
    },

    setRequestStatusFilter: (state, action) => {
      ensureSubstates(state);
      state.working.requestStatusFilter = action.payload || 'all';
    },
    setMembersSubSection: (state, action) => {
      ensureSubstates(state);
      state.working.membersSubSection = action.payload || 'all';
    },
    setSelectedRequestId: (state, action) => {
      ensureSubstates(state);
      state.working.selectedRequestId =
        action.payload != null ? String(action.payload) : null;
    },
    setJoinRequestWorking: (state, action) => {
      ensureSubstates(state);
      Object.assign(state.working, action.payload || {});
    },
    clearJoinRequestWorking: (state) => {
      state.working = createInitialJoinRequestsWorking();
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchJoinRequests.pending, (state, action) => {
        ensureSubstates(state);
        const pid = action.meta.arg?.projectId
          ? String(action.meta.arg.projectId)
          : null;
        if (pid) {
          state.byProjectStatus[pid] = 'loading';
          state.byProjectError[pid] = null;
        } else {
          state.status = 'loading';
          state.error = null;
        }
      })
      .addCase(fetchJoinRequests.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { projectId, items = [], counts = null } = action.payload || {};
        const valid = (Array.isArray(items) ? items : []).filter((r) => r?.id);
        joinRequestsAdapter.upsertMany(state, valid);
        if (projectId) {
          const pid = String(projectId);
          state.requestIdsByProject[pid] = valid.map((r) => String(r.id));
          state.countsByProject[pid] = counts || computeCountsFromItems(valid);
          state.byProjectStatus[pid] = 'succeeded';
          state.byProjectError[pid] = null;
          state.byProjectLastFetchedAt[pid] = new Date().toISOString();
        } else {
          state.status = 'succeeded';
          state.error = null;
        }
      })
      .addCase(fetchJoinRequests.rejected, (state, action) => {
        ensureSubstates(state);
        const pid = action.meta.arg?.projectId
          ? String(action.meta.arg.projectId)
          : null;
        if (pid) {
          state.byProjectStatus[pid] = 'failed';
          state.byProjectError[pid] = action.payload || {
            message: action.error?.message || 'Failed to load join requests.',
          };
        } else {
          state.status = 'failed';
          state.error = action.payload || {
            message: action.error?.message || 'Failed to load join requests.',
          };
        }
      })

      .addCase(fetchMyJoinRequests.pending, (state) => {
        ensureSubstates(state);
        state.myStatus = 'loading';
        state.error = null;
      })
      .addCase(fetchMyJoinRequests.fulfilled, (state, action) => {
        ensureSubstates(state);
        const items = (Array.isArray(action.payload) ? action.payload : []).filter(
          (r) => r?.id,
        );
        joinRequestsAdapter.upsertMany(state, items);
        state.myRequestIds = items.map((r) => String(r.id));
        state.myStatus = 'succeeded';
        state.myLastFetchedAt = new Date().toISOString();
      })
      .addCase(fetchMyJoinRequests.rejected, (state, action) => {
        ensureSubstates(state);
        state.myStatus = 'failed';
        state.error = action.payload || {
          message: action.error?.message || 'Failed to load your applications.',
        };
      })

      .addCase(fetchJoinRequestById.fulfilled, (state, action) => {
        ensureSubstates(state);
        if (action.payload?.id) {
          joinRequestsAdapter.upsertOne(state, action.payload);
        }
      })

      .addCase(createJoinRequest.pending, (state) => {
        ensureSubstates(state);
        state.createStatus = 'loading';
        state.working.applyError = null;
      })
      .addCase(createJoinRequest.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.createStatus = 'succeeded';
        const req = action.payload?.request;
        if (req?.id) {
          const idStr = String(req.id);
          joinRequestsAdapter.upsertOne(state, req);
          if (!state.myRequestIds.includes(idStr)) {
            state.myRequestIds = [idStr, ...state.myRequestIds];
          }
          if (req.projectId) {
            const pid = String(req.projectId);
            const existing = state.requestIdsByProject[pid] || [];
            if (!existing.includes(idStr)) {
              state.requestIdsByProject[pid] = [idStr, ...existing];
              recomputeProjectCountsIfTracked(state, pid);
            }
          }
        }
      })
      .addCase(createJoinRequest.rejected, (state, action) => {
        ensureSubstates(state);
        state.createStatus = 'failed';
        state.working.applyError = action.payload || {
          message: action.error?.message || 'Failed to submit application.',
        };
      })

      .addCase(updateJoinRequest.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { id, payload, request } = action.payload || {};
        const prev = state.entities[id];
        if (!prev && !request) return;
        const merged = {
          ...(prev || {}),
          ...(payload || {}),
          ...(request && typeof request === 'object' ? request : {}),
          id: request?.id || prev?.id || id,
        };
        joinRequestsAdapter.upsertOne(state, merged);
        recomputeProjectCountsIfTracked(state, merged.projectId);
      })

      .addCase(respondJoinRequest.pending, (state, action) => {
        ensureSubstates(state);
        const idStr = action.meta.arg?.id ? String(action.meta.arg.id) : '';
        if (idStr) state.respondingIds[idStr] = true;
        state.working.respondError = null;
      })
      .addCase(respondJoinRequest.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { id, status, reason, projectId, request } = action.payload || {};
        if (id) delete state.respondingIds[id];
        const prev = state.entities[id];
        const nextStatus = request?.status || status || prev?.status;
        const nextFilterGroup = deriveFilterGroup({ status: nextStatus });
        const merged = {
          ...(prev || {}),
          ...(request && typeof request === 'object' ? request : {}),
          id: request?.id || prev?.id || id,
          status: nextStatus,
          filterGroup: nextFilterGroup,
          ...(reason !== undefined ? { rejectionReason: reason } : {}),
        };
        joinRequestsAdapter.upsertOne(state, merged);
        recomputeProjectCountsIfTracked(state, projectId || merged.projectId);
      })
      .addCase(respondJoinRequest.rejected, (state, action) => {
        ensureSubstates(state);
        const idStr = action.meta.arg?.id ? String(action.meta.arg.id) : '';
        if (idStr) delete state.respondingIds[idStr];
        state.working.respondError = action.payload || {
          message: action.error?.message || 'Failed to respond to join request.',
        };
      })

      .addCase(deleteJoinRequest.pending, (state, action) => {
        ensureSubstates(state);
        const idStr = action.meta.arg?.id ? String(action.meta.arg.id) : '';
        if (idStr) state.respondingIds[idStr] = true;
        state.deleteStatus = 'loading';
      })
      .addCase(deleteJoinRequest.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.deleteStatus = 'succeeded';
        const { id, projectId } = action.payload || {};
        if (!id) return;
        delete state.respondingIds[id];
        const prev = state.entities[id];
        joinRequestsAdapter.removeOne(state, id);
        state.myRequestIds = state.myRequestIds.filter((x) => x !== id);
        const pid = projectId || (prev?.projectId ? String(prev.projectId) : null);
        if (pid && Array.isArray(state.requestIdsByProject[pid])) {
          state.requestIdsByProject[pid] = state.requestIdsByProject[pid].filter(
            (x) => x !== id,
          );
          recomputeProjectCountsIfTracked(state, pid);
        }
      })
      .addCase(deleteJoinRequest.rejected, (state, action) => {
        ensureSubstates(state);
        const idStr = action.meta.arg?.id ? String(action.meta.arg.id) : '';
        if (idStr) delete state.respondingIds[idStr];
        state.deleteStatus = 'failed';
        state.error = action.payload || {
          message: action.error?.message || 'Failed to withdraw request.',
        };
      })

      // Sync invite cancellation/response on any combined 'Invited' rows stored in joinRequests
      .addCase(cancelProjectInvite.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { inviteId, projectId } = action.payload || {};
        if (inviteId && state.entities[inviteId]) {
          joinRequestsAdapter.updateOne(state, {
            id: inviteId,
            changes: { status: 'Cancelled', rawStatus: 'cancelled', filterGroup: 'All' },
          });
          recomputeProjectCountsIfTracked(state, projectId || state.entities[inviteId].projectId);
        }
      })
      .addCase(acceptProjectInvite.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { inviteId, projectId } = action.payload || {};
        if (inviteId && state.entities[inviteId]) {
          joinRequestsAdapter.updateOne(state, {
            id: inviteId,
            changes: { status: 'Accepted', rawStatus: 'accepted', filterGroup: 'Approved' },
          });
          recomputeProjectCountsIfTracked(state, projectId || state.entities[inviteId].projectId);
        }
      })
      .addCase(declineProjectInvite.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { inviteId } = action.payload || {};
        if (inviteId && state.entities[inviteId]) {
          const ent = state.entities[inviteId];
          joinRequestsAdapter.updateOne(state, {
            id: inviteId,
            changes: { status: 'Declined', rawStatus: 'declined', filterGroup: 'Rejected' },
          });
          recomputeProjectCountsIfTracked(state, ent.projectId);
        }
      })

      // Sync project completion and member removal with approved requests
      .addCase(completeProject.fulfilled, (state, action) => {
        ensureSubstates(state);
        const pid = action.payload?.id ? String(action.payload.id) : '';
        if (!pid) return;
        const ids = state.requestIdsByProject[pid] || [];
        for (const id of ids) {
          const r = state.entities[id];
          if (r && String(r.status || '').toLowerCase() === 'approved') {
            state.entities[id] = { ...r, status: 'Completed', filterGroup: 'Approved' };
          }
        }
      })
      .addCase(removeProjectMember.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { projectId, memberId, memberName, reason } = action.payload || {};
        if (!projectId) return;
        const pid = String(projectId);
        const ids = state.requestIdsByProject[pid] || [];
        for (const id of ids) {
          const r = state.entities[id];
          if (!r) continue;
          const isMatch =
            String(r.userId || '') === String(memberId) ||
            (memberName && r.userName === memberName);
          if (isMatch) {
            state.entities[id] = {
              ...r,
              status: 'Removed',
              removalReason: reason,
              filterGroup: 'All',
            };
          }
        }
        recomputeProjectCountsIfTracked(state, pid);
      })

      .addCase(sessionReset, () => createInitialJoinRequestsState());

    addRouteReset(builder, (state) => {
      state.working = createInitialJoinRequestsWorking();
    });
  },
});

export const {
  setAll,
  addOne,
  updateOne,
  removeOne,
  setRequestStatusFilter,
  setMembersSubSection,
  setSelectedRequestId,
  setJoinRequestWorking,
  clearJoinRequestWorking,
} = joinRequestsSlice.actions;

export const joinRequestsCrudSelectors = joinRequestsAdapter.getSelectors(
  (state) => state?.joinRequests || initialState,
);

export default joinRequestsSlice.reducer;
