import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import { addRouteReset } from '../utils/routeReset';
import { sessionReset } from '../actions/appActions';
import {
  decideSessionDispute,
  fetchAdminDisputes,
  openSessionDispute,
} from '../thunks/sessionDisputesThunks';

function deriveDisputeId(item) {
  return String(item?.id || item?.disputeId || item?.sessionId || '');
}

/**
 * Session Disputes Repository Slice (`sessionDisputesSlice`)
 * ==========================================================
 * Mirrors `MentorMarketplaceService.disputes` and dispute dialog working state.
 *
 * Route-Leave Reset (Reading B — Decision D3):
 * - CLEARS on `routeChanged`: `working` (`targetSessionId`, `submitting`,
 *   `modalError`, `selectedDisputeId`, `decisionSubmitting`, `decisionError`, `filter`).
 * - STAYS across `routeChanged`: loaded dispute `entities`.
 * - Full reset on `sessionReset`.
 */
export const sessionDisputesAdapter = createEntityAdapter({
  selectId: deriveDisputeId,
});

export function createInitialDisputesWorking() {
  return {
    targetSessionId: null,
    submitting: false,
    modalError: '',
    filter: 'all',
    selectedDisputeId: null,
    decisionSubmitting: false,
    decisionError: '',
  };
}

export function createInitialSessionDisputesState() {
  return sessionDisputesAdapter.getInitialState({
    status: 'idle',
    error: null,
    lastFetchedAt: null,
    working: createInitialDisputesWorking(),
  });
}

function ensureSubstates(state) {
  if (!state.entities) state.entities = {};
  if (!Array.isArray(state.ids)) state.ids = [];
  if (!state.working) state.working = createInitialDisputesWorking();
}

function clearWorkingDisputesState(state) {
  ensureSubstates(state);
  state.working = createInitialDisputesWorking();
  state.error = null;
}

const sessionDisputesSlice = createSlice({
  name: 'sessionDisputes',
  initialState: createInitialSessionDisputesState(),
  reducers: {
    // ── Four Explicit CRUD Reducers (SPEC 2, D2) ──
    setAll: (state, action) => {
      ensureSubstates(state);
      const items = Array.isArray(action.payload) ? action.payload : [];
      sessionDisputesAdapter.setAll(state, items);
    },
    addOne: (state, action) => {
      ensureSubstates(state);
      if (!deriveDisputeId(action.payload)) return;
      sessionDisputesAdapter.addOne(state, action.payload);
    },
    updateOne: (state, action) => {
      ensureSubstates(state);
      sessionDisputesAdapter.updateOne(state, action.payload);
    },
    removeOne: (state, action) => {
      ensureSubstates(state);
      sessionDisputesAdapter.removeOne(state, String(action.payload));
    },

    // ── Volatile Working State Reducers ──
    openDisputeModal: (state, action) => {
      ensureSubstates(state);
      state.working.targetSessionId = action.payload
        ? String(action.payload)
        : null;
      state.working.modalError = '';
      state.working.submitting = false;
    },
    closeDisputeModal: (state) => {
      ensureSubstates(state);
      state.working.targetSessionId = null;
      state.working.modalError = '';
      state.working.submitting = false;
    },
    setDisputeFilter: (state, action) => {
      ensureSubstates(state);
      state.working.filter = action.payload || 'all';
    },
    selectDisputeForDecision: (state, action) => {
      ensureSubstates(state);
      state.working.selectedDisputeId = action.payload
        ? String(action.payload)
        : null;
      state.working.decisionError = '';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdminDisputes.pending, (state) => {
        ensureSubstates(state);
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchAdminDisputes.fulfilled, (state, action) => {
        ensureSubstates(state);
        const items = Array.isArray(action.payload)
          ? action.payload.filter((d) => deriveDisputeId(d))
          : [];
        sessionDisputesAdapter.setAll(state, items);
        state.status = 'succeeded';
        state.lastFetchedAt = new Date().toISOString();
      })
      .addCase(fetchAdminDisputes.rejected, (state, action) => {
        ensureSubstates(state);
        state.status = 'failed';
        state.error = action.payload || { message: action.error?.message };
      })

      .addCase(openSessionDispute.pending, (state) => {
        ensureSubstates(state);
        state.working.submitting = true;
        state.working.modalError = '';
      })
      .addCase(openSessionDispute.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.working.submitting = false;
        state.working.targetSessionId = null;
        state.working.modalError = '';
        const { sessionId, dispute } = action.payload || {};
        if (dispute && deriveDisputeId(dispute)) {
          sessionDisputesAdapter.upsertOne(state, {
            sessionId: String(sessionId),
            ...dispute,
          });
        }
      })
      .addCase(openSessionDispute.rejected, (state, action) => {
        ensureSubstates(state);
        state.working.submitting = false;
        state.working.modalError =
          action.payload?.serverMessage ||
          action.payload?.message ||
          action.error?.message ||
          'Failed to open dispute.';
      })

      .addCase(decideSessionDispute.pending, (state) => {
        ensureSubstates(state);
        state.working.decisionSubmitting = true;
        state.working.decisionError = '';
      })
      .addCase(decideSessionDispute.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.working.decisionSubmitting = false;
        state.working.selectedDisputeId = null;
        state.working.decisionError = '';
        const { dispute } = action.payload || {};
        if (dispute && deriveDisputeId(dispute)) {
          sessionDisputesAdapter.upsertOne(state, dispute);
        }
      })
      .addCase(decideSessionDispute.rejected, (state, action) => {
        ensureSubstates(state);
        state.working.decisionSubmitting = false;
        state.working.decisionError =
          action.payload?.serverMessage ||
          action.payload?.message ||
          action.error?.message ||
          'Failed to decide dispute.';
      })

      .addCase(sessionReset, () => createInitialSessionDisputesState());

    addRouteReset(builder, clearWorkingDisputesState);
  },
});

export const {
  setAll,
  addOne,
  updateOne,
  removeOne,
  openDisputeModal,
  closeDisputeModal,
  setDisputeFilter,
  selectDisputeForDecision,
} = sessionDisputesSlice.actions;

export default sessionDisputesSlice.reducer;
