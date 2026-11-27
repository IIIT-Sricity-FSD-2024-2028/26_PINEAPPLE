import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import { addRouteReset } from '../utils/routeReset';
import { sessionReset } from '../actions/appActions';
import {
  createPortalAdmin,
  deletePortalAdmin,
  fetchPortalAdmins,
  updatePortalAdmin,
} from '../thunks/portalAdminsThunks';

/**
 * Portal Admins Repository Slice (`portalAdminsSlice`)
 * ====================================================
 * Mirrors `PortalAdminsService.items` (`GET /portal-admins`, `POST`, `PUT`, `DELETE`).
 *
 * Route-Leave Reset (Reading B — Decision D3):
 * - CLEARS on `routeChanged`: `working` (`modalOpen`, `editingAdminId`,
 *   `adminToEraseId`, `saving`, `erasing`, `modalError`, `actionError`).
 * - STAYS across `routeChanged`: loaded portal admin `entities` / `ids`.
 * - Full reset on `sessionReset`.
 */
export const portalAdminsAdapter = createEntityAdapter({
  selectId: (a) => String(a?.id || ''),
});

export function createInitialPortalAdminsWorking() {
  return {
    modalOpen: false,
    editingAdminId: null,
    adminToEraseId: null,
    saving: false,
    erasing: false,
    modalError: '',
    actionError: '',
  };
}

export function createInitialPortalAdminsState() {
  return portalAdminsAdapter.getInitialState({
    status: 'idle',
    error: null,
    lastFetchedAt: null,
    working: createInitialPortalAdminsWorking(),
  });
}

function ensureSubstates(state) {
  if (!state.entities) state.entities = {};
  if (!Array.isArray(state.ids)) state.ids = [];
  if (!state.working) state.working = createInitialPortalAdminsWorking();
}

function clearWorkingPortalAdminsState(state) {
  ensureSubstates(state);
  state.working = createInitialPortalAdminsWorking();
  state.error = null;
}

const portalAdminsSlice = createSlice({
  name: 'portalAdmins',
  initialState: createInitialPortalAdminsState(),
  reducers: {
    // ── Four Explicit CRUD Reducers (SPEC 2, D2) ──
    setAll: (state, action) => {
      ensureSubstates(state);
      const items = Array.isArray(action.payload) ? action.payload : [];
      portalAdminsAdapter.setAll(state, items);
    },
    addOne: (state, action) => {
      ensureSubstates(state);
      if (action.payload?.id) {
        portalAdminsAdapter.addOne(state, action.payload);
      }
    },
    updateOne: (state, action) => {
      ensureSubstates(state);
      portalAdminsAdapter.updateOne(state, action.payload);
    },
    removeOne: (state, action) => {
      ensureSubstates(state);
      portalAdminsAdapter.removeOne(state, String(action.payload));
    },

    // ── Volatile Working State Reducers ──
    openAdminModal: (state, action) => {
      ensureSubstates(state);
      state.working.modalOpen = true;
      state.working.editingAdminId = action.payload ? String(action.payload) : null;
      state.working.modalError = '';
    },
    closeAdminModal: (state) => {
      ensureSubstates(state);
      state.working.modalOpen = false;
      state.working.editingAdminId = null;
      state.working.modalError = '';
    },
    setAdminToEraseId: (state, action) => {
      ensureSubstates(state);
      state.working.adminToEraseId = action.payload ? String(action.payload) : null;
      state.working.actionError = '';
    },
    setPortalAdminModalError: (state, action) => {
      ensureSubstates(state);
      state.working.modalError =
        typeof action.payload === 'string' ? action.payload : '';
    },
    clearPortalAdminErrors: (state) => {
      ensureSubstates(state);
      state.working.modalError = '';
      state.working.actionError = '';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPortalAdmins.pending, (state) => {
        ensureSubstates(state);
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchPortalAdmins.fulfilled, (state, action) => {
        ensureSubstates(state);
        const list = (Array.isArray(action.payload) ? action.payload : []).filter(
          (a) => a && a.id,
        );
        portalAdminsAdapter.setAll(state, list);
        state.status = 'succeeded';
        state.lastFetchedAt = new Date().toISOString();
      })
      .addCase(fetchPortalAdmins.rejected, (state, action) => {
        ensureSubstates(state);
        state.status = 'failed';
        state.error =
          action.payload?.serverMessage ||
          action.payload?.message ||
          action.error?.message ||
          'Failed to load admins';
      })

      .addCase(createPortalAdmin.pending, (state) => {
        ensureSubstates(state);
        state.working.saving = true;
        state.working.modalError = '';
      })
      .addCase(createPortalAdmin.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.working.saving = false;
        if (action.payload?.id) {
          portalAdminsAdapter.upsertOne(state, action.payload);
        }
        state.working.modalOpen = false;
        state.working.editingAdminId = null;
      })
      .addCase(createPortalAdmin.rejected, (state, action) => {
        ensureSubstates(state);
        state.working.saving = false;
        const msg =
          action.payload?.serverMessage ||
          action.payload?.message ||
          action.error?.message ||
          'An error occurred while saving.';
        state.working.modalError = msg.replace(/^Validation Error:\s*/i, '');
      })

      .addCase(updatePortalAdmin.pending, (state) => {
        ensureSubstates(state);
        state.working.saving = true;
        state.working.modalError = '';
        state.working.actionError = '';
      })
      .addCase(updatePortalAdmin.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.working.saving = false;
        if (action.payload?.id) {
          const prev = state.entities[String(action.payload.id)] || {};
          portalAdminsAdapter.upsertOne(state, { ...prev, ...action.payload });
        }
        state.working.modalOpen = false;
        state.working.editingAdminId = null;
      })
      .addCase(updatePortalAdmin.rejected, (state, action) => {
        ensureSubstates(state);
        state.working.saving = false;
        const msg =
          action.payload?.serverMessage ||
          action.payload?.message ||
          action.error?.message ||
          'Failed to update admin.';
        state.working.modalError = msg.replace(/^Validation Error:\s*/i, '');
        state.working.actionError = msg;
      })

      .addCase(deletePortalAdmin.pending, (state) => {
        ensureSubstates(state);
        state.working.erasing = true;
        state.working.actionError = '';
      })
      .addCase(deletePortalAdmin.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.working.erasing = false;
        portalAdminsAdapter.removeOne(state, String(action.payload));
        state.working.adminToEraseId = null;
      })
      .addCase(deletePortalAdmin.rejected, (state, action) => {
        ensureSubstates(state);
        state.working.erasing = false;
        state.working.actionError =
          action.payload?.serverMessage ||
          action.payload?.message ||
          action.error?.message ||
          'Failed to delete admin.';
      })

      .addCase(sessionReset, () => createInitialPortalAdminsState());

    addRouteReset(builder, clearWorkingPortalAdminsState);
  },
});

export const {
  setAll,
  addOne,
  updateOne,
  removeOne,
  openAdminModal,
  closeAdminModal,
  setAdminToEraseId,
  setPortalAdminModalError,
  clearPortalAdminErrors,
} = portalAdminsSlice.actions;

export default portalAdminsSlice.reducer;
