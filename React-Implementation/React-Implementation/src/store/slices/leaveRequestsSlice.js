import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import { addRouteReset } from '../utils/routeReset';
import { sessionReset } from '../actions/appActions';
import {
  approveLeaveRequest,
  createLeaveRequest,
  fetchMyLeaveRequest,
  fetchProjectLeaveRequests,
  rejectLeaveRequest,
  withdrawLeaveRequest,
} from '../thunks/leaveRequestsThunks';
import {
  fetchMyProjectLeaveRequest,
  submitProjectLeaveRequest,
  withdrawProjectLeaveRequest,
} from '../thunks/projectsThunks';

function deriveLeaveId(lr) {
  if (lr?.id) return String(lr.id);
  return `mine:${String(lr?.projectId || 'unknown')}`;
}

/**
 * Leave Requests Repository Slice (`leaveRequestsSlice`)
 * ======================================================
 * Manages project leave requests across CollaboratorWorkspace (request / mine / withdraw)
 * and OwnedWorkspace (list pending leave requests / approve / reject with cooldown).
 */
export const leaveRequestsAdapter = createEntityAdapter({
  selectId: deriveLeaveId,
});

export function createInitialLeaveRequestsWorking() {
  return {
    cooldownMessageByProject: {},
    submitError: null,
    respondError: null,
    rejectingRequestId: null,
  };
}

export function createInitialLeaveRequestsState() {
  return leaveRequestsAdapter.getInitialState({
    leaveRequestIdsByProject: {},
    myLeaveRequestIdByProject: {},
    processingIds: {},
    byProjectStatus: {},
    byProjectError: {},
    byProjectLastFetchedAt: {},
    error: null,
    working: createInitialLeaveRequestsWorking(),
  });
}

function ensureSubstates(state) {
  if (!state.entities) state.entities = {};
  if (!Array.isArray(state.ids)) state.ids = [];
  if (!state.leaveRequestIdsByProject) state.leaveRequestIdsByProject = {};
  if (!state.myLeaveRequestIdByProject) state.myLeaveRequestIdByProject = {};
  if (!state.processingIds) state.processingIds = {};
  if (!state.byProjectStatus) state.byProjectStatus = {};
  if (!state.byProjectError) state.byProjectError = {};
  if (!state.byProjectLastFetchedAt) state.byProjectLastFetchedAt = {};
  if (!state.working) state.working = createInitialLeaveRequestsWorking();
}

const initialState = createInitialLeaveRequestsState();

function upsertMyLeaveEntry(state, projectId, leaveRequest) {
  const pid = String(projectId);
  if (leaveRequest) {
    const normalized = {
      ...leaveRequest,
      projectId: leaveRequest.projectId || pid,
      id: deriveLeaveId({ ...leaveRequest, projectId: pid }),
    };
    leaveRequestsAdapter.upsertOne(state, normalized);
    state.myLeaveRequestIdByProject[pid] = normalized.id;
  } else {
    state.myLeaveRequestIdByProject[pid] = null;
  }
}

function clearMyLeaveEntry(state, projectId) {
  const pid = String(projectId);
  const existingId = state.myLeaveRequestIdByProject[pid];
  if (existingId && state.entities[existingId]) {
    leaveRequestsAdapter.updateOne(state, {
      id: existingId,
      changes: { status: 'withdrawn' },
    });
  }
  state.myLeaveRequestIdByProject[pid] = null;
}

const leaveRequestsSlice = createSlice({
  name: 'leaveRequests',
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
      const normalized = list.map((lr) => ({ ...lr, id: deriveLeaveId(lr) }));
      leaveRequestsAdapter.setAll(state, normalized);
      state.leaveRequestIdsByProject = {};
      for (const lr of normalized) {
        if (!lr.projectId) continue;
        const pid = String(lr.projectId);
        if (!state.leaveRequestIdsByProject[pid]) {
          state.leaveRequestIdsByProject[pid] = [];
        }
        state.leaveRequestIdsByProject[pid].push(lr.id);
      }
    },
    addOne: (state, action) => {
      ensureSubstates(state);
      if (!action.payload) return;
      const lr = { ...action.payload, id: deriveLeaveId(action.payload) };
      leaveRequestsAdapter.upsertOne(state, lr);
      if (lr.projectId) {
        const pid = String(lr.projectId);
        const existing = state.leaveRequestIdsByProject[pid] || [];
        if (!existing.includes(lr.id)) {
          state.leaveRequestIdsByProject[pid] = [lr.id, ...existing];
        }
      }
    },
    updateOne: (state, action) => {
      ensureSubstates(state);
      leaveRequestsAdapter.updateOne(state, action);
    },
    removeOne: (state, action) => {
      ensureSubstates(state);
      const idStr = String(action.payload);
      const existing = state.entities[idStr];
      leaveRequestsAdapter.removeOne(state, idStr);
      if (existing?.projectId) {
        const pid = String(existing.projectId);
        if (Array.isArray(state.leaveRequestIdsByProject[pid])) {
          state.leaveRequestIdsByProject[pid] = state.leaveRequestIdsByProject[
            pid
          ].filter((id) => id !== idStr);
        }
        if (state.myLeaveRequestIdByProject[pid] === idStr) {
          state.myLeaveRequestIdByProject[pid] = null;
        }
      }
    },

    setLeaveCooldownMessage: (state, action) => {
      ensureSubstates(state);
      const { projectId, message } = action.payload || {};
      if (!projectId) return;
      state.working.cooldownMessageByProject[String(projectId)] = message || '';
    },
    setLeaveWorking: (state, action) => {
      ensureSubstates(state);
      Object.assign(state.working, action.payload || {});
    },
    clearLeaveWorking: (state) => {
      state.working = createInitialLeaveRequestsWorking();
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProjectLeaveRequests.pending, (state, action) => {
        ensureSubstates(state);
        const pid = String(
          typeof action.meta.arg === 'object'
            ? action.meta.arg?.projectId
            : action.meta.arg || '',
        );
        if (!pid) return;
        state.byProjectStatus[pid] = 'loading';
        state.byProjectError[pid] = null;
      })
      .addCase(fetchProjectLeaveRequests.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { projectId, items = [] } = action.payload || {};
        if (!projectId) return;
        const pid = String(projectId);
        const normalized = (Array.isArray(items) ? items : [])
          .filter(Boolean)
          .map((lr) => ({
            ...lr,
            projectId: lr.projectId || pid,
            id: deriveLeaveId({ ...lr, projectId: pid }),
          }));
        leaveRequestsAdapter.upsertMany(state, normalized);
        state.leaveRequestIdsByProject[pid] = normalized.map((lr) => lr.id);
        state.byProjectStatus[pid] = 'succeeded';
        state.byProjectError[pid] = null;
        state.byProjectLastFetchedAt[pid] = new Date().toISOString();
      })
      .addCase(fetchProjectLeaveRequests.rejected, (state, action) => {
        ensureSubstates(state);
        const pid = String(
          typeof action.meta.arg === 'object'
            ? action.meta.arg?.projectId
            : action.meta.arg || '',
        );
        if (!pid) return;
        state.byProjectStatus[pid] = 'failed';
        state.byProjectError[pid] = action.payload || {
          message: action.error?.message || 'Failed to load leave requests.',
        };
      })

      .addCase(fetchMyLeaveRequest.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { projectId, leaveRequest } = action.payload || {};
        if (projectId) upsertMyLeaveEntry(state, projectId, leaveRequest);
      })
      .addCase(createLeaveRequest.pending, (state) => {
        ensureSubstates(state);
        state.working.submitError = null;
      })
      .addCase(createLeaveRequest.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { projectId, leaveRequest } = action.payload || {};
        if (projectId) {
          upsertMyLeaveEntry(
            state,
            projectId,
            leaveRequest || { status: 'pending', projectId },
          );
        }
      })
      .addCase(createLeaveRequest.rejected, (state, action) => {
        ensureSubstates(state);
        state.working.submitError = action.payload || {
          message: action.error?.message || 'Failed to submit leave request.',
        };
        const pid = action.meta.arg?.projectId
          ? String(action.meta.arg.projectId)
          : '';
        const msg = String(action.payload?.message || '');
        if (
          pid &&
          action.payload?.statusCode === 409 &&
          (msg.toLowerCase().includes('cooldown') ||
            action.payload?.code === 'LEAVE_REQUEST_COOLDOWN')
        ) {
          state.working.cooldownMessageByProject[pid] = msg;
        }
      })
      .addCase(withdrawLeaveRequest.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { projectId } = action.payload || {};
        if (projectId) clearMyLeaveEntry(state, projectId);
      })

      // Keep compatibility with Phase 4 projectsThunks leave actions if dispatched
      .addCase(fetchMyProjectLeaveRequest.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { projectId, leaveRequest } = action.payload || {};
        if (projectId) upsertMyLeaveEntry(state, projectId, leaveRequest);
      })
      .addCase(submitProjectLeaveRequest.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { projectId, leaveRequest } = action.payload || {};
        if (projectId) {
          upsertMyLeaveEntry(
            state,
            projectId,
            leaveRequest || { status: 'pending', projectId },
          );
        }
      })
      .addCase(withdrawProjectLeaveRequest.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { projectId } = action.payload || {};
        if (projectId) clearMyLeaveEntry(state, projectId);
      })

      .addCase(approveLeaveRequest.pending, (state, action) => {
        ensureSubstates(state);
        const idStr = action.meta.arg?.requestId
          ? String(action.meta.arg.requestId)
          : '';
        if (idStr) state.processingIds[idStr] = true;
        state.working.respondError = null;
      })
      .addCase(approveLeaveRequest.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { requestId } = action.payload || {};
        if (!requestId) return;
        delete state.processingIds[requestId];
        if (state.entities[requestId]) {
          leaveRequestsAdapter.updateOne(state, {
            id: requestId,
            changes: { status: 'approved' },
          });
        }
      })
      .addCase(approveLeaveRequest.rejected, (state, action) => {
        ensureSubstates(state);
        const idStr = action.meta.arg?.requestId
          ? String(action.meta.arg.requestId)
          : '';
        if (idStr) delete state.processingIds[idStr];
        state.working.respondError = action.payload || {
          message: action.error?.message || 'Failed to approve leave request.',
        };
      })

      .addCase(rejectLeaveRequest.pending, (state, action) => {
        ensureSubstates(state);
        const idStr = action.meta.arg?.requestId
          ? String(action.meta.arg.requestId)
          : '';
        if (idStr) state.processingIds[idStr] = true;
        state.working.respondError = null;
      })
      .addCase(rejectLeaveRequest.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { requestId } = action.payload || {};
        if (!requestId) return;
        delete state.processingIds[requestId];
        if (state.entities[requestId]) {
          leaveRequestsAdapter.updateOne(state, {
            id: requestId,
            changes: { status: 'rejected' },
          });
        }
        state.working.rejectingRequestId = null;
      })
      .addCase(rejectLeaveRequest.rejected, (state, action) => {
        ensureSubstates(state);
        const idStr = action.meta.arg?.requestId
          ? String(action.meta.arg.requestId)
          : '';
        if (idStr) delete state.processingIds[idStr];
        state.working.respondError = action.payload || {
          message: action.error?.message || 'Failed to reject leave request.',
        };
      })

      .addCase(sessionReset, () => createInitialLeaveRequestsState());

    addRouteReset(builder, (state) => {
      state.working = createInitialLeaveRequestsWorking();
    });
  },
});

export const {
  setAll,
  addOne,
  updateOne,
  removeOne,
  setLeaveCooldownMessage,
  setLeaveWorking,
  clearLeaveWorking,
} = leaveRequestsSlice.actions;

export const leaveRequestsCrudSelectors = leaveRequestsAdapter.getSelectors(
  (state) => state?.leaveRequests || initialState,
);

export default leaveRequestsSlice.reducer;
