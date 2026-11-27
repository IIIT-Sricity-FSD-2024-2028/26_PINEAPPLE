import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import { addRouteReset } from '../utils/routeReset';
import { sessionReset } from '../actions/appActions';
import {
  decideAdminAppeal,
  fetchAdminAppeals,
  fetchMyAppeals,
  submitWarningAppeal,
} from '../thunks/appealsThunks';

function deriveAppealId(appeal) {
  return String(appeal?.id || '');
}

/**
 * Appeals Repository Slice (`appealsSlice`)
 * =========================================
 * Mirrors `AppealsService.appeals` for both user appeals (`/users/me/appeals`,
 * `/warnings/:id/appeal`) and admin appeal decisions (`/admin/appeals`).
 *
 * Route-Leave Reset (Reading B — Decision D3):
 * - CLEARS on `routeChanged`: `working` (`appealFilter`, `appealSearch`,
 *   `selectedAppealId`, `appealModalOpen`, `selectedWarningId`, `submitting`,
 *   `submitError`, `submitSuccess`, `deciding`, `decisionError`).
 * - STAYS across `routeChanged`: `entities`, `myAppealIds`, `adminAppealIds`.
 * - Full reset on `sessionReset`.
 */
export const appealsAdapter = createEntityAdapter({
  selectId: deriveAppealId,
});

export function createInitialAppealsWorking() {
  return {
    appealFilter: 'all',
    appealSearch: '',
    selectedAppealId: null,
    appealModalOpen: false,
    selectedWarningId: null,
    submitting: false,
    submitError: '',
    submitSuccess: '',
    deciding: false,
    decisionError: '',
  };
}

export function createInitialAppealsState() {
  return appealsAdapter.getInitialState({
    myAppealIds: [],
    myAppealsStatus: 'idle',
    adminAppealIds: [],
    adminAppealsStatus: 'idle',
    error: null,
    lastFetchedAt: null,
    working: createInitialAppealsWorking(),
  });
}

function ensureSubstates(state) {
  if (!state.entities) state.entities = {};
  if (!Array.isArray(state.ids)) state.ids = [];
  if (!Array.isArray(state.myAppealIds)) state.myAppealIds = [];
  if (!Array.isArray(state.adminAppealIds)) state.adminAppealIds = [];
  if (!state.working) state.working = createInitialAppealsWorking();
}

function clearWorkingAppealsState(state) {
  ensureSubstates(state);
  state.working = createInitialAppealsWorking();
  state.error = null;
}

const appealsSlice = createSlice({
  name: 'appeals',
  initialState: createInitialAppealsState(),
  reducers: {
    // ── Four Explicit CRUD Reducers (SPEC 2, D2) ──
    setAll: (state, action) => {
      ensureSubstates(state);
      const items = Array.isArray(action.payload) ? action.payload : [];
      appealsAdapter.setAll(state, items);
      state.adminAppealIds = items.map(deriveAppealId).filter(Boolean);
    },
    addOne: (state, action) => {
      ensureSubstates(state);
      const aid = deriveAppealId(action.payload);
      if (!aid) return;
      appealsAdapter.addOne(state, action.payload);
      if (!state.adminAppealIds.includes(aid)) {
        state.adminAppealIds.unshift(aid);
      }
    },
    updateOne: (state, action) => {
      ensureSubstates(state);
      appealsAdapter.updateOne(state, action.payload);
    },
    removeOne: (state, action) => {
      ensureSubstates(state);
      const aid = String(action.payload);
      appealsAdapter.removeOne(state, aid);
      state.myAppealIds = state.myAppealIds.filter((id) => id !== aid);
      state.adminAppealIds = state.adminAppealIds.filter((id) => id !== aid);
    },

    // ── Volatile Working State Reducers ──
    setAppealFilter: (state, action) => {
      ensureSubstates(state);
      state.working.appealFilter = action.payload || 'all';
    },
    setAppealSearch: (state, action) => {
      ensureSubstates(state);
      state.working.appealSearch =
        typeof action.payload === 'string' ? action.payload : '';
    },
    openAppealSubmitModal: (state, action) => {
      ensureSubstates(state);
      state.working.appealModalOpen = true;
      state.working.selectedWarningId = action.payload
        ? String(action.payload)
        : null;
      state.working.submitError = '';
      state.working.submitSuccess = '';
    },
    closeAppealSubmitModal: (state) => {
      ensureSubstates(state);
      state.working.appealModalOpen = false;
      state.working.selectedWarningId = null;
      state.working.submitError = '';
      state.working.submitSuccess = '';
    },
    openAppealDecisionModal: (state, action) => {
      ensureSubstates(state);
      state.working.selectedAppealId = action.payload
        ? String(action.payload)
        : null;
      state.working.decisionError = '';
    },
    closeAppealDecisionModal: (state) => {
      ensureSubstates(state);
      state.working.selectedAppealId = null;
      state.working.decisionError = '';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMyAppeals.pending, (state) => {
        ensureSubstates(state);
        state.myAppealsStatus = 'loading';
      })
      .addCase(fetchMyAppeals.fulfilled, (state, action) => {
        ensureSubstates(state);
        const list = (Array.isArray(action.payload) ? action.payload : []).filter(
          (a) => deriveAppealId(a),
        );
        appealsAdapter.upsertMany(state, list);
        state.myAppealIds = list.map(deriveAppealId);
        state.myAppealsStatus = 'succeeded';
        state.lastFetchedAt = new Date().toISOString();
      })
      .addCase(fetchMyAppeals.rejected, (state, action) => {
        ensureSubstates(state);
        state.myAppealsStatus = 'failed';
        state.error = action.payload || { message: action.error?.message };
      })

      .addCase(fetchAdminAppeals.pending, (state) => {
        ensureSubstates(state);
        state.adminAppealsStatus = 'loading';
      })
      .addCase(fetchAdminAppeals.fulfilled, (state, action) => {
        ensureSubstates(state);
        const list = (Array.isArray(action.payload) ? action.payload : []).filter(
          (a) => deriveAppealId(a),
        );
        appealsAdapter.upsertMany(state, list);
        state.adminAppealIds = list.map(deriveAppealId);
        state.adminAppealsStatus = 'succeeded';
        state.lastFetchedAt = new Date().toISOString();
      })
      .addCase(fetchAdminAppeals.rejected, (state, action) => {
        ensureSubstates(state);
        state.adminAppealsStatus = 'failed';
        state.error = action.payload || { message: action.error?.message };
      })

      .addCase(submitWarningAppeal.pending, (state) => {
        ensureSubstates(state);
        state.working.submitting = true;
        state.working.submitError = '';
        state.working.submitSuccess = '';
      })
      .addCase(submitWarningAppeal.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.working.submitting = false;
        state.working.submitSuccess =
          'Appeal submitted successfully. Administrators will review it.';
        const created = action.payload?.appeal;
        const aid = deriveAppealId(created);
        if (aid) {
          appealsAdapter.upsertOne(state, created);
          if (!state.myAppealIds.includes(aid)) {
            state.myAppealIds.unshift(aid);
          }
        }
      })
      .addCase(submitWarningAppeal.rejected, (state, action) => {
        ensureSubstates(state);
        state.working.submitting = false;
        state.working.submitError =
          action.payload?.message ||
          action.payload?.error ||
          action.error?.message ||
          'Failed to submit appeal.';
      })

      .addCase(decideAdminAppeal.pending, (state) => {
        ensureSubstates(state);
        state.working.deciding = true;
        state.working.decisionError = '';
      })
      .addCase(decideAdminAppeal.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.working.deciding = false;
        state.working.selectedAppealId = null;
        const { appealId, decision, note, appeal } = action.payload || {};
        if (appealId && state.entities[appealId]) {
          appealsAdapter.updateOne(state, {
            id: appealId,
            changes: {
              ...(appeal || {}),
              status: decision === 'accept' ? 'accepted' : 'rejected',
              decisionNote: note,
              decidedAt: appeal?.decidedAt || new Date().toISOString(),
            },
          });
        }
      })
      .addCase(decideAdminAppeal.rejected, (state, action) => {
        ensureSubstates(state);
        state.working.deciding = false;
        state.working.decisionError =
          action.payload?.serverMessage ||
          action.payload?.message ||
          action.error?.message ||
          'Failed to decide appeal';
      })

      .addCase(sessionReset, () => createInitialAppealsState());

    addRouteReset(builder, clearWorkingAppealsState);
  },
});

export const {
  setAll,
  addOne,
  updateOne,
  removeOne,
  setAppealFilter,
  setAppealSearch,
  openAppealSubmitModal,
  closeAppealSubmitModal,
  openAppealDecisionModal,
  closeAppealDecisionModal,
} = appealsSlice.actions;

export default appealsSlice.reducer;
