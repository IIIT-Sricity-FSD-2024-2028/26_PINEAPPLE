import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import { addRouteReset } from '../utils/routeReset';
import { sessionReset } from '../actions/appActions';
import {
  fetchMyReputation,
  fetchMyTrust,
  fetchUserTrust,
} from '../thunks/reputationThunks';

function deriveLedgerEntryId(item) {
  return String(
    item?.id ||
      item?._id ||
      `${item?.type || 'entry'}-${item?.refId || item?.taskId || 'none'}-${item?.createdAt || item?.date || ''}`,
  );
}

function normalizeLedgerItems(list) {
  return (Array.isArray(list) ? list : []).map((item, idx) => {
    const baseId = deriveLedgerEntryId(item);
    return {
      ...item,
      id: item?.id ? String(item.id) : `${baseId}-${idx}`,
    };
  });
}

/**
 * Reputation & Conduct Ledger Slice (`reputationSlice`)
 * =====================================================
 * Holds the user's paginated conduct/XP reputation ledger (`GET /users/me/reputation`)
 * and personal/user trust summaries (`GET /users/me/trust`, `GET /users/:id/trust`).
 *
 * Route-Leave Reset (Reading B — Decision D3):
 * - CLEARS on `routeChanged`: `working` (`page`, `limit`, `typeFilter`, `groupFilter`).
 * - STAYS across `routeChanged`: `entities`, `ids`, `total`, `myTrust`, `trustByUserId`.
 * - Full reset on `sessionReset`.
 */
export const reputationAdapter = createEntityAdapter({
  selectId: (item) => String(item?.id || deriveLedgerEntryId(item)),
});

export function createInitialReputationWorking() {
  return {
    page: 1,
    limit: 20,
    typeFilter: 'all',
    groupFilter: 'all',
  };
}

export function createInitialReputationState() {
  return reputationAdapter.getInitialState({
    total: 0,
    myTrust: null,
    trustByUserId: {},
    status: 'idle',
    trustStatus: 'idle',
    error: null,
    lastFetchedAt: null,
    working: createInitialReputationWorking(),
  });
}

function ensureSubstates(state) {
  if (!state.entities) state.entities = {};
  if (!Array.isArray(state.ids)) state.ids = [];
  if (!state.trustByUserId) state.trustByUserId = {};
  if (!state.working) state.working = createInitialReputationWorking();
}

function clearWorkingReputationState(state) {
  ensureSubstates(state);
  state.working = createInitialReputationWorking();
  state.error = null;
}

const reputationSlice = createSlice({
  name: 'reputation',
  initialState: createInitialReputationState(),
  reducers: {
    // ── Four Explicit CRUD Reducers (SPEC 2, D2) ──
    setAll: (state, action) => {
      ensureSubstates(state);
      const list = normalizeLedgerItems(action.payload);
      reputationAdapter.setAll(state, list);
      state.total = list.length;
    },
    addOne: (state, action) => {
      ensureSubstates(state);
      if (!action.payload) return;
      const [normalized] = normalizeLedgerItems([action.payload]);
      reputationAdapter.addOne(state, normalized);
      state.total = state.ids.length;
    },
    updateOne: (state, action) => {
      ensureSubstates(state);
      reputationAdapter.updateOne(state, action.payload);
    },
    removeOne: (state, action) => {
      ensureSubstates(state);
      reputationAdapter.removeOne(state, String(action.payload));
      state.total = state.ids.length;
    },
    setReputationFilters: (state, action) => {
      ensureSubstates(state);
      const { page, limit, typeFilter, groupFilter } = action.payload || {};
      if (page !== undefined) state.working.page = Number(page) || 1;
      if (limit !== undefined) state.working.limit = Number(limit) || 20;
      if (typeFilter !== undefined) state.working.typeFilter = String(typeFilter);
      if (groupFilter !== undefined) state.working.groupFilter = String(groupFilter);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMyReputation.pending, (state) => {
        ensureSubstates(state);
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchMyReputation.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.status = 'succeeded';
        state.lastFetchedAt = Date.now();
        const items = normalizeLedgerItems(action.payload?.items);
        reputationAdapter.setAll(state, items);
        state.total = Number(action.payload?.total ?? items.length) || 0;
      })
      .addCase(fetchMyReputation.rejected, (state, action) => {
        ensureSubstates(state);
        state.status = 'failed';
        state.error = action.payload || { message: action.error?.message || 'Failed to load reputation.' };
      })
      .addCase(fetchMyTrust.pending, (state) => {
        ensureSubstates(state);
        state.trustStatus = 'loading';
      })
      .addCase(fetchMyTrust.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.trustStatus = 'succeeded';
        state.myTrust = action.payload || null;
        if (action.payload?.userId) {
          state.trustByUserId[String(action.payload.userId)] = action.payload;
        }
      })
      .addCase(fetchMyTrust.rejected, (state, action) => {
        ensureSubstates(state);
        state.trustStatus = 'failed';
        state.error = action.payload || state.error;
      })
      .addCase(fetchUserTrust.fulfilled, (state, action) => {
        ensureSubstates(state);
        const summary = action.payload;
        if (summary?.userId) {
          state.trustByUserId[String(summary.userId)] = summary;
        }
      })
      .addCase(sessionReset, () => createInitialReputationState());

    addRouteReset(builder, clearWorkingReputationState);
  },
});

export const {
  setAll,
  addOne,
  updateOne,
  removeOne,
  setReputationFilters,
} = reputationSlice.actions;

export default reputationSlice.reducer;
