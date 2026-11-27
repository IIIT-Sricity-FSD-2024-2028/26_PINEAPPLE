import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import { addRouteReset } from '../utils/routeReset';
import { sessionReset } from '../actions/appActions';
import {
  fetchBadgesByProject,
  fetchGamificationLedger,
  fetchGamificationStats,
  fetchLeaderboard,
  fetchUserBadges,
  fetchUserRank,
  issueMentorBadge,
} from '../thunks/gamificationThunks';

function deriveLeaderboardId(row) {
  return String(row?.userId || row?.id || row?.email || row?.user || '');
}

/**
 * Gamification Repository Slice (`gamificationSlice`)
 * ===================================================
 * Holds leaderboard rows (`GET /leaderboard`), XP ledgers & stats
 * (`GET /gamification/:userId/*`), and mentorship recommendation badges
 * (`GET /mentorship/badges/:userId`).
 *
 * Route-Leave Reset (Reading B — Decision D3):
 * - CLEARS on `routeChanged`: `working` (`activeTab`, `period`, `searchQuery`, `error`).
 * - STAYS across `routeChanged`: `entities`, `ids`, `badgesByUserId`,
 *   `xpLedgerByUserId`, `statsByUserId`, `userRankByUserId`.
 * - Full reset on `sessionReset`.
 */
export const gamificationAdapter = createEntityAdapter({
  selectId: deriveLeaderboardId,
});

export function createInitialGamificationWorking() {
  return {
    activeTab: 'xp',
    period: 'alltime',
    searchQuery: '',
  };
}

export function createInitialGamificationState() {
  return gamificationAdapter.getInitialState({
    badgesByUserId: {},
    badgesByProjectId: {},
    xpLedgerByUserId: {},
    statsByUserId: {},
    userRankByUserId: {},
    status: 'idle',
    error: null,
    lastFetchedAt: null,
    working: createInitialGamificationWorking(),
  });
}

function ensureSubstates(state) {
  if (!state.entities) state.entities = {};
  if (!Array.isArray(state.ids)) state.ids = [];
  if (!state.badgesByUserId) state.badgesByUserId = {};
  if (!state.badgesByProjectId) state.badgesByProjectId = {};
  if (!state.xpLedgerByUserId) state.xpLedgerByUserId = {};
  if (!state.statsByUserId) state.statsByUserId = {};
  if (!state.userRankByUserId) state.userRankByUserId = {};
  if (!state.working) state.working = createInitialGamificationWorking();
}

function clearWorkingGamificationState(state) {
  ensureSubstates(state);
  state.working = createInitialGamificationWorking();
  state.error = null;
}

const gamificationSlice = createSlice({
  name: 'gamification',
  initialState: createInitialGamificationState(),
  reducers: {
    // ── Four Explicit CRUD Reducers (SPEC 2, D2) ──
    setAll: (state, action) => {
      ensureSubstates(state);
      const list = Array.isArray(action.payload) ? action.payload : [];
      gamificationAdapter.setAll(
        state,
        list.filter((row) => deriveLeaderboardId(row)),
      );
    },
    addOne: (state, action) => {
      ensureSubstates(state);
      if (!deriveLeaderboardId(action.payload)) return;
      gamificationAdapter.upsertOne(state, action.payload);
    },
    updateOne: (state, action) => {
      ensureSubstates(state);
      gamificationAdapter.updateOne(state, action.payload);
    },
    removeOne: (state, action) => {
      ensureSubstates(state);
      gamificationAdapter.removeOne(state, String(action.payload));
    },
    setLeaderboardFilters: (state, action) => {
      ensureSubstates(state);
      const { activeTab, period, searchQuery } = action.payload || {};
      if (activeTab !== undefined) state.working.activeTab = String(activeTab);
      if (period !== undefined) state.working.period = String(period);
      if (searchQuery !== undefined) state.working.searchQuery = String(searchQuery);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchLeaderboard.pending, (state) => {
        ensureSubstates(state);
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchLeaderboard.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.status = 'succeeded';
        state.lastFetchedAt = Date.now();
        const items = Array.isArray(action.payload?.items) ? action.payload.items : [];
        const normalized = items.map((row, idx) => ({
          ...row,
          userId: deriveLeaderboardId(row) || `row-${idx}`,
        }));
        gamificationAdapter.setAll(state, normalized);
      })
      .addCase(fetchLeaderboard.rejected, (state, action) => {
        ensureSubstates(state);
        state.status = 'failed';
        state.error = action.payload || {
          message: action.error?.message || 'Unable to load leaderboard right now.',
        };
      })
      .addCase(fetchUserRank.fulfilled, (state, action) => {
        ensureSubstates(state);
        if (action.payload?.userId) {
          state.userRankByUserId[action.payload.userId] = action.payload.rank;
        }
      })
      .addCase(fetchGamificationStats.fulfilled, (state, action) => {
        ensureSubstates(state);
        if (action.payload?.userId) {
          state.statsByUserId[action.payload.userId] = action.payload.stats;
        }
      })
      .addCase(fetchGamificationLedger.fulfilled, (state, action) => {
        ensureSubstates(state);
        if (action.payload?.userId) {
          state.xpLedgerByUserId[action.payload.userId] = Array.isArray(action.payload.items)
            ? action.payload.items
            : [];
        }
      })
      .addCase(fetchUserBadges.fulfilled, (state, action) => {
        ensureSubstates(state);
        if (action.payload?.userId) {
          state.badgesByUserId[action.payload.userId] = Array.isArray(action.payload.badges)
            ? action.payload.badges
            : [];
        }
      })
      .addCase(fetchBadgesByProject.fulfilled, (state, action) => {
        ensureSubstates(state);
        if (action.payload?.projectId) {
          state.badgesByProjectId[action.payload.projectId] = Array.isArray(
            action.payload.badges,
          )
            ? action.payload.badges
            : [];
        }
      })
      .addCase(issueMentorBadge.fulfilled, (state, action) => {
        ensureSubstates(state);
        const badge = action.payload;
        const recipientId = String(badge?.userId || badge?.recipientId || badge?.collaboratorId || '').trim();
        if (recipientId) {
          const prev = Array.isArray(state.badgesByUserId[recipientId])
            ? state.badgesByUserId[recipientId]
            : [];
          state.badgesByUserId[recipientId] = [badge, ...prev];
        }
        const projectId = String(badge?.projectId || '').trim();
        if (projectId) {
          const prevProj = Array.isArray(state.badgesByProjectId[projectId])
            ? state.badgesByProjectId[projectId]
            : [];
          state.badgesByProjectId[projectId] = [badge, ...prevProj];
        }
      })
      .addCase(sessionReset, () => createInitialGamificationState());

    addRouteReset(builder, clearWorkingGamificationState);
  },
});

export const {
  setAll,
  addOne,
  updateOne,
  removeOne,
  setLeaderboardFilters,
} = gamificationSlice.actions;

export default gamificationSlice.reducer;
