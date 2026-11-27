import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import { addRouteReset } from '../utils/routeReset';
import { sessionReset } from '../actions/appActions';
import {
  approveModerationAction,
  fetchModerationActions,
  reactivateUserModeration,
  rejectModerationAction,
  suspendUserModeration,
} from '../thunks/pendingModerationActionsThunks';

function deriveModActionId(item) {
  return String(item?.id || '');
}

/**
 * Pending Moderation Actions Slice (`pendingModerationActionsSlice`)
 * ==================================================================
 * Mirrors `ModerationService.pendingActions` powering the 2-person second
 * approval suspension queue (`AdminUsers.jsx`) and suspend/reactivate thunks.
 *
 * Route-Leave Reset (Reading B — Decision D3):
 * - CLEARS on `routeChanged`: `working` (`submitting`, `error`, `actionBanner`,
 *   `approvalModalActionId`, `approvalModalDecision`, `approvalError`,
 *   `approvalSubmitting`).
 * - STAYS across `routeChanged`: loaded queue `entities` and `ids`.
 * - Full reset on `sessionReset`.
 */
export const pendingModerationActionsAdapter = createEntityAdapter({
  selectId: deriveModActionId,
});

export function createInitialModerationWorking() {
  return {
    submitting: false,
    error: '',
    actionBanner: null,
    approvalModalActionId: null,
    approvalModalDecision: null,
    approvalError: '',
    approvalSubmitting: false,
  };
}

export function createInitialPendingModerationActionsState() {
  return pendingModerationActionsAdapter.getInitialState({
    status: 'idle',
    error: null,
    lastFetchedAt: null,
    working: createInitialModerationWorking(),
  });
}

function ensureSubstates(state) {
  if (!state.entities) state.entities = {};
  if (!Array.isArray(state.ids)) state.ids = [];
  if (!state.working) state.working = createInitialModerationWorking();
}

function clearWorkingModerationState(state) {
  ensureSubstates(state);
  state.working = createInitialModerationWorking();
  state.error = null;
}

const pendingModerationActionsSlice = createSlice({
  name: 'pendingModerationActions',
  initialState: createInitialPendingModerationActionsState(),
  reducers: {
    // ── Four Explicit CRUD Reducers (SPEC 2, D2) ──
    setAll: (state, action) => {
      ensureSubstates(state);
      const items = Array.isArray(action.payload) ? action.payload : [];
      pendingModerationActionsAdapter.setAll(state, items);
    },
    addOne: (state, action) => {
      ensureSubstates(state);
      if (!deriveModActionId(action.payload)) return;
      pendingModerationActionsAdapter.addOne(state, action.payload);
    },
    updateOne: (state, action) => {
      ensureSubstates(state);
      pendingModerationActionsAdapter.updateOne(state, action.payload);
    },
    removeOne: (state, action) => {
      ensureSubstates(state);
      pendingModerationActionsAdapter.removeOne(state, String(action.payload));
    },

    // ── Volatile Working State Reducers ──
    openApprovalDecisionModal: (state, action) => {
      ensureSubstates(state);
      const { actionId, decision } = action.payload || {};
      state.working.approvalModalActionId = actionId ? String(actionId) : null;
      state.working.approvalModalDecision = decision || null;
      state.working.approvalError = '';
    },
    closeApprovalDecisionModal: (state) => {
      ensureSubstates(state);
      state.working.approvalModalActionId = null;
      state.working.approvalModalDecision = null;
      state.working.approvalError = '';
      state.working.approvalSubmitting = false;
    },
    setModerationActionBanner: (state, action) => {
      ensureSubstates(state);
      state.working.actionBanner = action.payload || null;
    },
    clearModerationError: (state) => {
      ensureSubstates(state);
      state.working.error = '';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchModerationActions.pending, (state) => {
        ensureSubstates(state);
        state.status = 'loading';
      })
      .addCase(fetchModerationActions.fulfilled, (state, action) => {
        ensureSubstates(state);
        const list = (Array.isArray(action.payload) ? action.payload : []).filter(
          (a) => deriveModActionId(a),
        );
        pendingModerationActionsAdapter.setAll(state, list);
        state.status = 'succeeded';
        state.lastFetchedAt = new Date().toISOString();
      })
      .addCase(fetchModerationActions.rejected, (state, action) => {
        ensureSubstates(state);
        state.status = 'failed';
        state.error = action.payload || { message: action.error?.message };
      })

      .addCase(suspendUserModeration.pending, (state) => {
        ensureSubstates(state);
        state.working.submitting = true;
        state.working.error = '';
      })
      .addCase(suspendUserModeration.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.working.submitting = false;
        const { targetUserName, result } = action.payload || {};
        if (result?.status === 'pending_second_approval') {
          state.working.actionBanner = {
            type: 'info',
            message: `Pending second approval for ${targetUserName || 'user'} — waiting for another admin or Super User within 72 hours.`,
          };
          if (result.action && deriveModActionId(result.action)) {
            pendingModerationActionsAdapter.upsertOne(state, result.action);
          }
        }
      })
      .addCase(suspendUserModeration.rejected, (state, action) => {
        ensureSubstates(state);
        state.working.submitting = false;
        state.working.error =
          action.payload?.message || action.error?.message || 'Action failed.';
      })

      .addCase(reactivateUserModeration.pending, (state) => {
        ensureSubstates(state);
        state.working.submitting = true;
        state.working.error = '';
      })
      .addCase(reactivateUserModeration.fulfilled, (state) => {
        ensureSubstates(state);
        state.working.submitting = false;
      })
      .addCase(reactivateUserModeration.rejected, (state, action) => {
        ensureSubstates(state);
        state.working.submitting = false;
        state.working.error =
          action.payload?.message || action.error?.message || 'Action failed.';
      })

      .addCase(approveModerationAction.pending, (state) => {
        ensureSubstates(state);
        state.working.approvalSubmitting = true;
        state.working.approvalError = '';
      })
      .addCase(approveModerationAction.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.working.approvalSubmitting = false;
        state.working.approvalModalActionId = null;
        state.working.approvalModalDecision = null;
        const { actionId, reason, result } = action.payload || {};
        if (actionId && state.entities[actionId]) {
          pendingModerationActionsAdapter.updateOne(state, {
            id: actionId,
            changes: {
              ...(result?.action || {}),
              status: 'approved',
              decisionReason: reason,
            },
          });
        }
      })
      .addCase(approveModerationAction.rejected, (state, action) => {
        ensureSubstates(state);
        state.working.approvalSubmitting = false;
        state.working.approvalError =
          action.payload?.serverMessage ||
          action.payload?.message ||
          action.error?.message ||
          'Decision failed.';
      })

      .addCase(rejectModerationAction.pending, (state) => {
        ensureSubstates(state);
        state.working.approvalSubmitting = true;
        state.working.approvalError = '';
      })
      .addCase(rejectModerationAction.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.working.approvalSubmitting = false;
        state.working.approvalModalActionId = null;
        state.working.approvalModalDecision = null;
        const { actionId, reason, result } = action.payload || {};
        if (actionId && state.entities[actionId]) {
          pendingModerationActionsAdapter.updateOne(state, {
            id: actionId,
            changes: {
              ...(result?.action || {}),
              status: 'rejected',
              decisionReason: reason,
            },
          });
        }
      })
      .addCase(rejectModerationAction.rejected, (state, action) => {
        ensureSubstates(state);
        state.working.approvalSubmitting = false;
        state.working.approvalError =
          action.payload?.serverMessage ||
          action.payload?.message ||
          action.error?.message ||
          'Decision failed.';
      })

      .addCase(sessionReset, () => createInitialPendingModerationActionsState());

    addRouteReset(builder, clearWorkingModerationState);
  },
});

export const {
  setAll,
  addOne,
  updateOne,
  removeOne,
  openApprovalDecisionModal,
  closeApprovalDecisionModal,
  setModerationActionBanner,
  clearModerationError,
} = pendingModerationActionsSlice.actions;

export default pendingModerationActionsSlice.reducer;
