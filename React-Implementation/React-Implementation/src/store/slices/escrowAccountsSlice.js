import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import { addRouteReset } from '../utils/routeReset';
import { sessionReset } from '../actions/appActions';
import {
  fetchEscrowAccounts,
  fetchEscrowById,
  fetchProjectEscrow,
  reconcileEscrowLedger,
} from '../thunks/escrowAccountsThunks';
import {
  confirmSessionPayment,
  payMentorSession,
} from '../thunks/paymentsThunks';
import {
  decideSessionDispute,
  openSessionDispute,
} from '../thunks/sessionDisputesThunks';

function deriveEscrowId(item) {
  return String(item?.id || item?.escrowId || item?.sessionId || '');
}

/**
 * Escrow Accounts Repository Slice (`escrowAccountsSlice`)
 * ========================================================
 * Mirrors `EscrowService.items`, project escrow financial summaries,
 * and server-side escrow reconciliation results (`GET /admin/escrow/reconcile`).
 *
 * Route-Leave Reset (Reading B — Decision D3):
 * - CLEARS on `routeChanged`: `working` (`selectedEscrowId`, `reconcileError`,
 *   `projectError`).
 * - STAYS across `routeChanged`: `entities`, `byProjectId`, and `reconciliation`.
 * - Full reset on `sessionReset`.
 */
export const escrowAccountsAdapter = createEntityAdapter({
  selectId: deriveEscrowId,
});

export function createInitialEscrowWorking() {
  return {
    selectedEscrowId: null,
    reconcileError: null,
    projectError: null,
  };
}

export function createInitialEscrowAccountsState() {
  return escrowAccountsAdapter.getInitialState({
    byProjectId: {},
    reconciliation: null,
    status: 'idle',
    reconcileStatus: 'idle',
    projectEscrowStatus: 'idle',
    error: null,
    lastFetchedAt: null,
    working: createInitialEscrowWorking(),
  });
}

function ensureSubstates(state) {
  if (!state.entities) state.entities = {};
  if (!Array.isArray(state.ids)) state.ids = [];
  if (!state.byProjectId) state.byProjectId = {};
  if (!state.working) state.working = createInitialEscrowWorking();
}

function clearWorkingEscrowState(state) {
  ensureSubstates(state);
  state.working = createInitialEscrowWorking();
  state.error = null;
}

const escrowAccountsSlice = createSlice({
  name: 'escrowAccounts',
  initialState: createInitialEscrowAccountsState(),
  reducers: {
    // ── Four Explicit CRUD Reducers (SPEC 2, D2) ──
    setAll: (state, action) => {
      ensureSubstates(state);
      const items = Array.isArray(action.payload) ? action.payload : [];
      escrowAccountsAdapter.setAll(state, items);
    },
    addOne: (state, action) => {
      ensureSubstates(state);
      if (!deriveEscrowId(action.payload)) return;
      escrowAccountsAdapter.addOne(state, action.payload);
    },
    updateOne: (state, action) => {
      ensureSubstates(state);
      escrowAccountsAdapter.updateOne(state, action.payload);
    },
    removeOne: (state, action) => {
      ensureSubstates(state);
      escrowAccountsAdapter.removeOne(state, String(action.payload));
    },
    selectEscrowAccount: (state, action) => {
      ensureSubstates(state);
      state.working.selectedEscrowId = action.payload
        ? String(action.payload)
        : null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchEscrowAccounts.pending, (state) => {
        ensureSubstates(state);
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchEscrowAccounts.fulfilled, (state, action) => {
        ensureSubstates(state);
        const items = Array.isArray(action.payload)
          ? action.payload.filter((e) => deriveEscrowId(e))
          : [];
        escrowAccountsAdapter.setAll(state, items);
        state.status = 'succeeded';
        state.lastFetchedAt = new Date().toISOString();
      })
      .addCase(fetchEscrowAccounts.rejected, (state, action) => {
        ensureSubstates(state);
        state.status = 'failed';
        state.error = action.payload || { message: action.error?.message };
      })

      .addCase(fetchEscrowById.fulfilled, (state, action) => {
        ensureSubstates(state);
        if (action.payload && deriveEscrowId(action.payload)) {
          escrowAccountsAdapter.upsertOne(state, action.payload);
        }
      })

      .addCase(fetchProjectEscrow.pending, (state) => {
        ensureSubstates(state);
        state.projectEscrowStatus = 'loading';
        state.working.projectError = null;
      })
      .addCase(fetchProjectEscrow.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { projectId, summary } = action.payload || {};
        if (projectId && summary) {
          state.byProjectId[String(projectId)] = summary;
        }
        state.projectEscrowStatus = 'succeeded';
      })
      .addCase(fetchProjectEscrow.rejected, (state, action) => {
        ensureSubstates(state);
        state.projectEscrowStatus = 'failed';
        state.working.projectError =
          action.payload?.message || action.error?.message || null;
      })

      .addCase(reconcileEscrowLedger.pending, (state) => {
        ensureSubstates(state);
        state.reconcileStatus = 'loading';
        state.working.reconcileError = null;
      })
      .addCase(reconcileEscrowLedger.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.reconcileStatus = 'succeeded';
        state.reconciliation = action.payload || null;
      })
      .addCase(reconcileEscrowLedger.rejected, (state, action) => {
        ensureSubstates(state);
        state.reconcileStatus = 'failed';
        state.working.reconcileError =
          action.payload?.message ||
          action.error?.message ||
          'Reconcile failed';
      })

      // Cross-slice escrow sync
      .addCase(confirmSessionPayment.fulfilled, (state, action) => {
        ensureSubstates(state);
        const escrow = action.payload?.escrow;
        if (escrow && deriveEscrowId(escrow)) {
          escrowAccountsAdapter.upsertOne(state, escrow);
        }
      })
      .addCase(payMentorSession.fulfilled, (state, action) => {
        ensureSubstates(state);
        const escrow = action.payload?.escrow;
        if (escrow && deriveEscrowId(escrow)) {
          escrowAccountsAdapter.upsertOne(state, escrow);
        }
      })
      .addCase(openSessionDispute.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { sessionId, dispute } = action.payload || {};
        const matching = Object.values(state.entities).find(
          (e) => e && String(e.sessionId) === String(sessionId),
        );
        if (matching) {
          escrowAccountsAdapter.updateOne(state, {
            id: deriveEscrowId(matching),
            changes: { status: 'frozen', disputed: true, dispute },
          });
        }
      })
      .addCase(decideSessionDispute.fulfilled, (state, action) => {
        ensureSubstates(state);
        const escrow = action.payload?.escrow;
        if (escrow && deriveEscrowId(escrow)) {
          escrowAccountsAdapter.upsertOne(state, escrow);
        }
      })

      .addCase(sessionReset, () => createInitialEscrowAccountsState());

    addRouteReset(builder, clearWorkingEscrowState);
  },
});

export const {
  setAll,
  addOne,
  updateOne,
  removeOne,
  selectEscrowAccount,
} = escrowAccountsSlice.actions;

// Alias exported per prompt naming alongside canonical `01`/`07` name
export const escrowSlice = escrowAccountsSlice;

export default escrowAccountsSlice.reducer;
