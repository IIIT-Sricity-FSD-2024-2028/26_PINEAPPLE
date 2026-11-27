import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import { addRouteReset } from '../utils/routeReset';
import { sessionReset } from '../actions/appActions';
import {
  acceptProjectInvite,
  cancelProjectInvite,
  declineProjectInvite,
  fetchMyInvites,
  fetchProjectInvites,
  sendProjectInvite,
} from '../thunks/invitesThunks';

/**
 * Project Invites Repository Slice (`projectInvitesSlice`)
 * ========================================================
 * Normalizes sent and received invitations across Owner Workspace, Notifications,
 * and Projects Marketplace.
 */
export const projectInvitesAdapter = createEntityAdapter({
  selectId: (inv) => String(inv.id),
});

export function createInitialInvitesWorking() {
  return {
    selectedInviteId: null,
    sendError: null,
    actionError: null,
    actionSuccess: null,
  };
}

export function createInitialProjectInvitesState() {
  return projectInvitesAdapter.getInitialState({
    myInviteIds: [],
    inviteIdsByProject: {},
    actingIds: {},
    myStatus: 'idle',
    sendStatus: 'idle',
    byProjectStatus: {},
    byProjectError: {},
    byProjectLastFetchedAt: {},
    myLastFetchedAt: null,
    error: null,
    working: createInitialInvitesWorking(),
  });
}

function ensureSubstates(state) {
  if (!state.entities) state.entities = {};
  if (!Array.isArray(state.ids)) state.ids = [];
  if (!Array.isArray(state.myInviteIds)) state.myInviteIds = [];
  if (!state.inviteIdsByProject) state.inviteIdsByProject = {};
  if (!state.actingIds) state.actingIds = {};
  if (!state.byProjectStatus) state.byProjectStatus = {};
  if (!state.byProjectError) state.byProjectError = {};
  if (!state.byProjectLastFetchedAt) state.byProjectLastFetchedAt = {};
  if (!state.working) state.working = createInitialInvitesWorking();
}

const initialState = createInitialProjectInvitesState();

const projectInvitesSlice = createSlice({
  name: 'projectInvites',
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
      projectInvitesAdapter.setAll(state, list);
      state.inviteIdsByProject = {};
      for (const inv of list) {
        if (!inv.projectId) continue;
        const pid = String(inv.projectId);
        if (!state.inviteIdsByProject[pid]) {
          state.inviteIdsByProject[pid] = [];
        }
        state.inviteIdsByProject[pid].push(String(inv.id));
      }
    },
    addOne: (state, action) => {
      ensureSubstates(state);
      if (!action.payload?.id) return;
      projectInvitesAdapter.upsertOne(state, action.payload);
      const idStr = String(action.payload.id);
      if (action.payload.projectId) {
        const pid = String(action.payload.projectId);
        const existing = state.inviteIdsByProject[pid] || [];
        if (!existing.includes(idStr)) {
          state.inviteIdsByProject[pid] = [idStr, ...existing];
        }
      }
    },
    updateOne: (state, action) => {
      ensureSubstates(state);
      projectInvitesAdapter.updateOne(state, action);
    },
    removeOne: (state, action) => {
      ensureSubstates(state);
      const idStr = String(action.payload);
      const existing = state.entities[idStr];
      projectInvitesAdapter.removeOne(state, idStr);
      state.myInviteIds = state.myInviteIds.filter((id) => id !== idStr);
      if (existing?.projectId) {
        const pid = String(existing.projectId);
        if (Array.isArray(state.inviteIdsByProject[pid])) {
          state.inviteIdsByProject[pid] = state.inviteIdsByProject[pid].filter(
            (id) => id !== idStr,
          );
        }
      } else {
        for (const pid of Object.keys(state.inviteIdsByProject)) {
          state.inviteIdsByProject[pid] = (
            state.inviteIdsByProject[pid] || []
          ).filter((id) => id !== idStr);
        }
      }
    },

    setInvitesWorking: (state, action) => {
      ensureSubstates(state);
      Object.assign(state.working, action.payload || {});
    },
    clearInvitesWorking: (state) => {
      state.working = createInitialInvitesWorking();
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProjectInvites.pending, (state, action) => {
        ensureSubstates(state);
        const pid = action.meta.arg?.projectId
          ? String(action.meta.arg.projectId)
          : String(action.meta.arg || '');
        if (!pid) return;
        state.byProjectStatus[pid] = 'loading';
        state.byProjectError[pid] = null;
      })
      .addCase(fetchProjectInvites.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { projectId, items = [] } = action.payload || {};
        if (!projectId) return;
        const pid = String(projectId);
        const valid = (Array.isArray(items) ? items : []).filter((inv) => inv?.id);
        projectInvitesAdapter.upsertMany(state, valid);
        state.inviteIdsByProject[pid] = valid.map((inv) => String(inv.id));
        state.byProjectStatus[pid] = 'succeeded';
        state.byProjectError[pid] = null;
        state.byProjectLastFetchedAt[pid] = new Date().toISOString();
      })
      .addCase(fetchProjectInvites.rejected, (state, action) => {
        ensureSubstates(state);
        const pid = action.meta.arg?.projectId
          ? String(action.meta.arg.projectId)
          : String(action.meta.arg || '');
        if (!pid) return;
        state.byProjectStatus[pid] = 'failed';
        state.byProjectError[pid] = action.payload || {
          message: action.error?.message || 'Failed to load invitations.',
        };
      })

      .addCase(fetchMyInvites.pending, (state) => {
        ensureSubstates(state);
        state.myStatus = 'loading';
        state.error = null;
      })
      .addCase(fetchMyInvites.fulfilled, (state, action) => {
        ensureSubstates(state);
        const items = (Array.isArray(action.payload) ? action.payload : []).filter(
          (inv) => inv?.id,
        );
        projectInvitesAdapter.upsertMany(state, items);
        state.myInviteIds = items.map((inv) => String(inv.id));
        state.myStatus = 'succeeded';
        state.myLastFetchedAt = new Date().toISOString();
      })
      .addCase(fetchMyInvites.rejected, (state, action) => {
        ensureSubstates(state);
        state.myStatus = 'failed';
        state.error = action.payload || {
          message: action.error?.message || 'Failed to load invitations.',
        };
      })

      .addCase(sendProjectInvite.pending, (state) => {
        ensureSubstates(state);
        state.sendStatus = 'loading';
        state.working.sendError = null;
      })
      .addCase(sendProjectInvite.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.sendStatus = 'succeeded';
        const { projectId, invite } = action.payload || {};
        if (invite?.id) {
          const idStr = String(invite.id);
          projectInvitesAdapter.upsertOne(state, invite);
          const pid = String(projectId || invite.projectId || '');
          if (pid) {
            const existing = state.inviteIdsByProject[pid] || [];
            if (!existing.includes(idStr)) {
              state.inviteIdsByProject[pid] = [idStr, ...existing];
            }
          }
        }
      })
      .addCase(sendProjectInvite.rejected, (state, action) => {
        ensureSubstates(state);
        state.sendStatus = 'failed';
        state.working.sendError = action.payload || {
          message: action.error?.message || 'Failed to send invitation.',
        };
      })

      .addCase(cancelProjectInvite.pending, (state, action) => {
        ensureSubstates(state);
        const idStr = action.meta.arg?.inviteId
          ? String(action.meta.arg.inviteId)
          : '';
        if (idStr) state.actingIds[idStr] = true;
        state.working.actionError = null;
      })
      .addCase(cancelProjectInvite.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { inviteId } = action.payload || {};
        if (!inviteId) return;
        delete state.actingIds[inviteId];
        if (state.entities[inviteId]) {
          projectInvitesAdapter.updateOne(state, {
            id: inviteId,
            changes: { status: 'cancelled' },
          });
        }
      })
      .addCase(cancelProjectInvite.rejected, (state, action) => {
        ensureSubstates(state);
        const idStr = action.meta.arg?.inviteId
          ? String(action.meta.arg.inviteId)
          : '';
        if (idStr) delete state.actingIds[idStr];
        state.working.actionError = action.payload || {
          message: action.error?.message || 'Failed to cancel invitation.',
        };
      })

      .addCase(acceptProjectInvite.pending, (state, action) => {
        ensureSubstates(state);
        const idStr = action.meta.arg?.inviteId
          ? String(action.meta.arg.inviteId)
          : '';
        if (idStr) state.actingIds[idStr] = true;
        state.working.actionError = null;
        state.working.actionSuccess = null;
      })
      .addCase(acceptProjectInvite.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { inviteId } = action.payload || {};
        if (!inviteId) return;
        delete state.actingIds[inviteId];
        if (state.entities[inviteId]) {
          projectInvitesAdapter.updateOne(state, {
            id: inviteId,
            changes: { status: 'accepted' },
          });
        }
        state.working.actionSuccess = 'Invitation accepted! You are now a project member.';
      })
      .addCase(acceptProjectInvite.rejected, (state, action) => {
        ensureSubstates(state);
        const idStr = action.meta.arg?.inviteId
          ? String(action.meta.arg.inviteId)
          : '';
        if (idStr) delete state.actingIds[idStr];
        state.working.actionError = action.payload || {
          message: action.error?.message || 'Failed to accept invitation.',
        };
      })

      .addCase(declineProjectInvite.pending, (state, action) => {
        ensureSubstates(state);
        const idStr = action.meta.arg?.inviteId
          ? String(action.meta.arg.inviteId)
          : '';
        if (idStr) state.actingIds[idStr] = true;
        state.working.actionError = null;
        state.working.actionSuccess = null;
      })
      .addCase(declineProjectInvite.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { inviteId } = action.payload || {};
        if (!inviteId) return;
        delete state.actingIds[inviteId];
        if (state.entities[inviteId]) {
          projectInvitesAdapter.updateOne(state, {
            id: inviteId,
            changes: { status: 'declined' },
          });
        }
        state.working.actionSuccess = 'Invitation declined.';
      })
      .addCase(declineProjectInvite.rejected, (state, action) => {
        ensureSubstates(state);
        const idStr = action.meta.arg?.inviteId
          ? String(action.meta.arg.inviteId)
          : '';
        if (idStr) delete state.actingIds[idStr];
        state.working.actionError = action.payload || {
          message: action.error?.message || 'Failed to decline invitation.',
        };
      })

      .addCase(sessionReset, () => createInitialProjectInvitesState());

    addRouteReset(builder, (state) => {
      state.working = createInitialInvitesWorking();
    });
  },
});

export const {
  setAll,
  addOne,
  updateOne,
  removeOne,
  setInvitesWorking,
  clearInvitesWorking,
} = projectInvitesSlice.actions;

export const projectInvitesCrudSelectors = projectInvitesAdapter.getSelectors(
  (state) => state?.projectInvites || initialState,
);

export default projectInvitesSlice.reducer;
