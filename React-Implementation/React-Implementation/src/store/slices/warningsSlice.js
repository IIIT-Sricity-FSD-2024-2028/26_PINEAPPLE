import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import { addRouteReset } from '../utils/routeReset';
import { sessionReset } from '../actions/appActions';
import {
  fetchMyWarnings,
  fetchUserWarningsAdmin,
  issueUserWarning,
} from '../thunks/warningsThunks';
import { decideAdminAppeal } from '../thunks/appealsThunks';
import { actionAdminReport } from '../thunks/reportsThunks';
import { reactivateUserModeration } from '../thunks/pendingModerationActionsThunks';

function deriveWarningId(warning) {
  return String(warning?.id || warning?.warningId || '');
}

/**
 * Warnings Repository Slice (`warningsSlice`)
 * ===========================================
 * Mirrors `ModerationService.warnings` across user warnings (`/users/me/warnings`),
 * admin user warning history (`/admin/users/:id/warnings`), and warning counts
 * updated immediately after `issueUserWarning`, appeal acceptance, or reactivation.
 *
 * Route-Leave Reset (Reading B — Decision D3):
 * - CLEARS on `routeChanged`: `working` (`submitting`, `error`, `selectedWarningId`).
 * - STAYS across `routeChanged`: `entities`, `myWarningIds`, `byUserId`,
 *   and `activeWarningsCountByUserId`.
 * - Full reset on `sessionReset`.
 */
export const warningsAdapter = createEntityAdapter({
  selectId: deriveWarningId,
});

export function createInitialWarningsWorking() {
  return {
    submitting: false,
    error: '',
    selectedWarningId: null,
  };
}

export function createInitialWarningsState() {
  return warningsAdapter.getInitialState({
    myWarningIds: [],
    myWarningsStatus: 'idle',
    byUserId: {},
    activeWarningsCountByUserId: {},
    error: null,
    lastFetchedAt: null,
    working: createInitialWarningsWorking(),
  });
}

function ensureSubstates(state) {
  if (!state.entities) state.entities = {};
  if (!Array.isArray(state.ids)) state.ids = [];
  if (!Array.isArray(state.myWarningIds)) state.myWarningIds = [];
  if (!state.byUserId) state.byUserId = {};
  if (!state.activeWarningsCountByUserId) state.activeWarningsCountByUserId = {};
  if (!state.working) state.working = createInitialWarningsWorking();
}

function clearWorkingWarningsState(state) {
  ensureSubstates(state);
  state.working = createInitialWarningsWorking();
  state.error = null;
}

const warningsSlice = createSlice({
  name: 'warnings',
  initialState: createInitialWarningsState(),
  reducers: {
    // ── Four Explicit CRUD Reducers (SPEC 2, D2) ──
    setAll: (state, action) => {
      ensureSubstates(state);
      const items = Array.isArray(action.payload) ? action.payload : [];
      warningsAdapter.setAll(state, items);
      state.myWarningIds = items.map(deriveWarningId).filter(Boolean);
    },
    addOne: (state, action) => {
      ensureSubstates(state);
      const wid = deriveWarningId(action.payload);
      if (!wid) return;
      warningsAdapter.addOne(state, action.payload);
      if (!state.myWarningIds.includes(wid)) {
        state.myWarningIds.unshift(wid);
      }
      const uid = action.payload?.userId ? String(action.payload.userId) : '';
      if (uid) {
        const current = Array.isArray(state.byUserId[uid]) ? state.byUserId[uid] : [];
        if (!current.includes(wid)) {
          state.byUserId[uid] = [wid, ...current];
        }
        if (action.payload?.active !== false) {
          state.activeWarningsCountByUserId[uid] =
            (state.activeWarningsCountByUserId[uid] || 0) + 1;
        }
      }
    },
    updateOne: (state, action) => {
      ensureSubstates(state);
      warningsAdapter.updateOne(state, action.payload);
    },
    removeOne: (state, action) => {
      ensureSubstates(state);
      const wid = String(action.payload);
      warningsAdapter.removeOne(state, wid);
      state.myWarningIds = state.myWarningIds.filter((id) => id !== wid);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMyWarnings.pending, (state) => {
        ensureSubstates(state);
        state.myWarningsStatus = 'loading';
      })
      .addCase(fetchMyWarnings.fulfilled, (state, action) => {
        ensureSubstates(state);
        const list = (Array.isArray(action.payload) ? action.payload : []).filter(
          (w) => deriveWarningId(w),
        );
        warningsAdapter.upsertMany(state, list);
        state.myWarningIds = list.map(deriveWarningId);
        state.myWarningsStatus = 'succeeded';
        state.lastFetchedAt = new Date().toISOString();
      })
      .addCase(fetchMyWarnings.rejected, (state, action) => {
        ensureSubstates(state);
        state.myWarningsStatus = 'failed';
        state.error = action.payload || { message: action.error?.message };
      })

      .addCase(fetchUserWarningsAdmin.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { userId, items } = action.payload || {};
        if (!Array.isArray(items)) return;
        const list = items.filter((w) => deriveWarningId(w));
        warningsAdapter.upsertMany(state, list);
        if (userId) {
          state.byUserId[userId] = list.map(deriveWarningId);
          state.activeWarningsCountByUserId[userId] = list.filter((w) => {
            const st = String(w?.status || '').toLowerCase();
            return (
              w.active !== false &&
              st !== 'removed' &&
              st !== 'cleared' &&
              st !== 'expired'
            );
          }).length;
        }
      })

      .addCase(issueUserWarning.pending, (state) => {
        ensureSubstates(state);
        state.working.submitting = true;
        state.working.error = '';
      })
      .addCase(issueUserWarning.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.working.submitting = false;
        const { userId, warning, activeCount } = action.payload || {};
        if (warning && deriveWarningId(warning)) {
          warningsAdapter.upsertOne(state, warning);
          const wid = deriveWarningId(warning);
          if (userId) {
            const list = Array.isArray(state.byUserId[userId])
              ? state.byUserId[userId]
              : [];
            if (!list.includes(wid)) {
              state.byUserId[userId] = [wid, ...list];
            }
          }
        }
        if (userId) {
          if (typeof activeCount === 'number') {
            state.activeWarningsCountByUserId[userId] = activeCount;
          } else {
            state.activeWarningsCountByUserId[userId] =
              (state.activeWarningsCountByUserId[userId] || 0) + 1;
          }
        }
      })
      .addCase(issueUserWarning.rejected, (state, action) => {
        ensureSubstates(state);
        state.working.submitting = false;
        state.working.error =
          action.payload?.message ||
          action.error?.message ||
          'Failed to issue warning';
      })

      // Sync report action warnings & accepted appeals
      .addCase(actionAdminReport.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { action: actType, result } = action.payload || {};
        if (actType === 'warn' && result) {
          const uid = result.userId || result.targetUserId || result.warning?.userId;
          if (result.warning && deriveWarningId(result.warning)) {
            warningsAdapter.upsertOne(state, result.warning);
          }
          if (uid) {
            const uidStr = String(uid);
            const count =
              result.activeCount ??
              result.activeWarningsCount ??
              (state.activeWarningsCountByUserId[uidStr] || 0) + 1;
            state.activeWarningsCountByUserId[uidStr] = count;
          }
        }
      })
      .addCase(decideAdminAppeal.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { decision, warningId, userId } = action.payload || {};
        if (decision === 'accept') {
          if (warningId && state.entities[String(warningId)]) {
            warningsAdapter.updateOne(state, {
              id: String(warningId),
              changes: { active: false, status: 'removed' },
            });
          }
          if (userId && state.activeWarningsCountByUserId[String(userId)] > 0) {
            state.activeWarningsCountByUserId[String(userId)] -= 1;
          }
        }
      })
      .addCase(reactivateUserModeration.fulfilled, (state, action) => {
        ensureSubstates(state);
        const uid = String(action.payload?.userId || '');
        if (uid) {
          state.activeWarningsCountByUserId[uid] = 0;
        }
      })

      .addCase(sessionReset, () => createInitialWarningsState());

    addRouteReset(builder, clearWorkingWarningsState);
  },
});

export const { setAll, addOne, updateOne, removeOne } = warningsSlice.actions;

export default warningsSlice.reducer;
