import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import { addRouteReset } from '../utils/routeReset';
import { sessionReset } from '../actions/appActions';
import { toText } from '../../utils/toText';
import {
  fetchAdminUserDetails,
  fetchAdminUserReputation,
  fetchAdminUsers,
  fetchDashboardStats,
  flagAdminUser,
  updateAdminUserStatus,
} from '../thunks/adminUsersThunks';
import { issueUserWarning } from '../thunks/warningsThunks';
import {
  reactivateUserModeration,
  suspendUserModeration,
} from '../thunks/pendingModerationActionsThunks';

function deriveUserId(u) {
  return String(u?.id || u?.userId || '');
}

function sanitizeUserRecord(user) {
  if (!user || typeof user !== 'object') return user;
  const rawStatus =
    user.status && typeof user.status === 'object' && user.status.status !== undefined
      ? user.status.status
      : user.status;
  const normalizedStatus = user.isDeleted || user.deletedAt
    ? 'Deleted'
    : toText(rawStatus, 'Active');
  return {
    ...user,
    status: normalizedStatus,
  };
}

/**
 * Admin Users & Dashboard Summaries Repository Slice (`adminUsersSlice`)
 * =======================================================================
 * Mirrors `UsersRepository` admin views (`GET /admin/users`, `GET /admin/users/:id`,
 * `GET /admin/users/duplicates`, `GET /admin/users/:id/reputation`, `PUT /flag`,
 * `PATCH /status`), batch `trustSummaries`, and `GET /admin/stats` KPIs.
 *
 * Route-Leave Reset (Reading B — Decision D3):
 * - CLEARS on `routeChanged`: `working` (table filter/search, reputation filter/page,
 *   selected user id, action/detail banners & errors).
 * - STAYS across `routeChanged`: loaded user `entities`, `duplicateGroups`,
 *   `trustByUserId`, `userDetailsById`, `reputationByUserId`, `dashboardStats`.
 * - Full reset on `sessionReset`.
 */
export const adminUsersAdapter = createEntityAdapter({
  selectId: deriveUserId,
});

export function createInitialAdminUsersWorking() {
  return {
    filter: 'all',
    query: '',
    selectedUserId: null,
    detailLoading: false,
    detailError: null,
    repTypeFilter: 'all',
    repPage: 1,
    actionError: '',
  };
}

export function createInitialUserCounts() {
  return {
    total: 0,
    active: 0,
    suspended: 0,
    flagged: 0,
    warned: 0,
    possibleDuplicates: 0,
    pendingApprovals: 0,
  };
}

export function createInitialDashboardStats() {
  return {
    totalUsers: 0,
    activeUsers: 0,
    pendingMentorApps: 0,
    flaggedWarned: 0,
    flaggedUsers: 0,
    warnedUsers: 0,
    suspendedUsers: 0,
    possibleDuplicates: 0,
    pendingApprovals: 0,
    auditEvents: 0,
    activeAdmins: 0,
  };
}

export function createInitialAdminUsersState() {
  return adminUsersAdapter.getInitialState({
    duplicateGroups: [],
    userCounts: createInitialUserCounts(),
    trustByUserId: {},
    userDetailsById: {},
    reputationByUserId: {},
    dashboardStats: createInitialDashboardStats(),
    listStatus: 'idle',
    listError: null,
    statsStatus: 'idle',
    statsError: null,
    lastFetchedAt: null,
    working: createInitialAdminUsersWorking(),
  });
}

function ensureSubstates(state) {
  if (!state.entities) state.entities = {};
  if (!Array.isArray(state.ids)) state.ids = [];
  if (!Array.isArray(state.duplicateGroups)) state.duplicateGroups = [];
  if (!state.userCounts) state.userCounts = createInitialUserCounts();
  if (!state.trustByUserId) state.trustByUserId = {};
  if (!state.userDetailsById) state.userDetailsById = {};
  if (!state.reputationByUserId) state.reputationByUserId = {};
  if (!state.dashboardStats) state.dashboardStats = createInitialDashboardStats();
  if (!state.working) state.working = createInitialAdminUsersWorking();
}

function clearWorkingAdminUsersState(state) {
  ensureSubstates(state);
  state.working = createInitialAdminUsersWorking();
}

const adminUsersSlice = createSlice({
  name: 'adminUsers',
  initialState: createInitialAdminUsersState(),
  reducers: {
    // ── Four Explicit CRUD Reducers (SPEC 2, D2) ──
    setAll: (state, action) => {
      ensureSubstates(state);
      const list = Array.isArray(action.payload) ? action.payload : [];
      adminUsersAdapter.setAll(state, list);
    },
    addOne: (state, action) => {
      ensureSubstates(state);
      if (deriveUserId(action.payload)) {
        adminUsersAdapter.addOne(state, action.payload);
      }
    },
    updateOne: (state, action) => {
      ensureSubstates(state);
      adminUsersAdapter.updateOne(state, action.payload);
    },
    removeOne: (state, action) => {
      ensureSubstates(state);
      const uid = String(action.payload);
      adminUsersAdapter.removeOne(state, uid);
      delete state.userDetailsById[uid];
    },

    // ── Volatile Working State Reducers ──
    setAdminUsersFilter: (state, action) => {
      ensureSubstates(state);
      state.working.filter = action.payload || 'all';
    },
    setAdminUsersQuery: (state, action) => {
      ensureSubstates(state);
      state.working.query = typeof action.payload === 'string' ? action.payload : '';
    },
    setSelectedAdminUserId: (state, action) => {
      ensureSubstates(state);
      state.working.selectedUserId = action.payload ? String(action.payload) : null;
    },
    setRepTypeFilter: (state, action) => {
      ensureSubstates(state);
      state.working.repTypeFilter = action.payload || 'all';
      state.working.repPage = 1;
    },
    setRepPage: (state, action) => {
      ensureSubstates(state);
      state.working.repPage = Math.max(1, Number(action.payload) || 1);
    },
    clearAdminUsersActionError: (state) => {
      ensureSubstates(state);
      state.working.actionError = '';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdminUsers.pending, (state) => {
        ensureSubstates(state);
        state.listStatus = 'loading';
        state.listError = null;
      })
      .addCase(fetchAdminUsers.fulfilled, (state, action) => {
        ensureSubstates(state);
        const {
          users = [],
          duplicateGroups = [],
          userCounts = null,
          trustSummaries = [],
        } = action.payload || {};
        const valid = users.filter((u) => deriveUserId(u)).map(sanitizeUserRecord);
        adminUsersAdapter.setAll(state, valid);
        state.duplicateGroups = duplicateGroups;
        if (userCounts && typeof userCounts === 'object') {
          state.userCounts = {
            ...createInitialUserCounts(),
            ...userCounts,
          };
          state.dashboardStats = {
            ...state.dashboardStats,
            totalUsers: state.userCounts.total,
            activeUsers: state.userCounts.active,
            suspendedUsers: state.userCounts.suspended,
            flaggedUsers: state.userCounts.flagged,
            warnedUsers: state.userCounts.warned,
            flaggedWarned: state.userCounts.flagged,
            possibleDuplicates: state.userCounts.possibleDuplicates,
            pendingApprovals: state.userCounts.pendingApprovals,
            counts: state.userCounts,
          };
        }
        const trustMap = { ...state.trustByUserId };
        trustSummaries.forEach((s) => {
          if (s?.userId) trustMap[String(s.userId)] = s;
        });
        state.trustByUserId = trustMap;
        state.listStatus = 'succeeded';
        state.lastFetchedAt = new Date().toISOString();
      })
      .addCase(fetchAdminUsers.rejected, (state, action) => {
        ensureSubstates(state);
        state.listStatus = 'failed';
        state.listError =
          action.payload?.serverMessage ||
          action.payload?.message ||
          action.error?.message ||
          'Failed to load users. Please try again later.';
      })

      .addCase(fetchAdminUserDetails.pending, (state, action) => {
        ensureSubstates(state);
        state.working.selectedUserId = String(action.meta?.arg || '');
        state.working.detailLoading = true;
        state.working.detailError = null;
      })
      .addCase(fetchAdminUserDetails.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.working.detailLoading = false;
        const { userId, user } = action.payload || {};
        if (userId && user) {
          const cleanUser = sanitizeUserRecord(user);
          state.userDetailsById[userId] = cleanUser;
          adminUsersAdapter.upsertOne(state, cleanUser);
        }
      })
      .addCase(fetchAdminUserDetails.rejected, (state, action) => {
        ensureSubstates(state);
        state.working.detailLoading = false;
        state.working.detailError =
          action.payload?.serverMessage ||
          action.payload?.message ||
          action.error?.message ||
          'Failed to load user details.';
      })

      .addCase(fetchAdminUserReputation.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { userId, items = [], total = 0 } = action.payload || {};
        if (userId) {
          state.reputationByUserId[userId] = { items, total };
        }
      })

      .addCase(flagAdminUser.fulfilled, (state, action) => {
        ensureSubstates(state);
        const uid = action.payload?.userId;
        if (!uid) return;
        if (state.entities[uid]) {
          adminUsersAdapter.updateOne(state, {
            id: uid,
            changes: { status: 'Flagged', flags: true, flagged: true },
          });
        }
        if (state.userDetailsById[uid]) {
          state.userDetailsById[uid] = {
            ...state.userDetailsById[uid],
            status: 'Flagged',
            flags: true,
            flagged: true,
          };
        }
      })
      .addCase(flagAdminUser.rejected, (state, action) => {
        ensureSubstates(state);
        state.working.actionError =
          action.payload?.serverMessage ||
          action.payload?.message ||
          action.error?.message ||
          'Failed to flag user.';
      })

      .addCase(updateAdminUserStatus.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { userId, status } = action.payload || {};
        if (!userId) return;
        const activePatch =
          String(status).toLowerCase() === 'active'
            ? { status, flags: false, flagged: false }
            : { status };
        if (state.entities[userId]) {
          adminUsersAdapter.updateOne(state, {
            id: userId,
            changes: activePatch,
          });
        }
        if (state.userDetailsById[userId]) {
          state.userDetailsById[userId] = {
            ...state.userDetailsById[userId],
            ...activePatch,
          };
        }
      })
      .addCase(updateAdminUserStatus.rejected, (state, action) => {
        ensureSubstates(state);
        state.working.actionError =
          action.payload?.serverMessage ||
          action.payload?.message ||
          action.error?.message ||
          'Failed to update user status.';
      })

      .addCase(fetchDashboardStats.pending, (state) => {
        ensureSubstates(state);
        state.statsStatus = 'loading';
        state.statsError = null;
      })
      .addCase(fetchDashboardStats.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.statsStatus = 'succeeded';
        if (action.payload && typeof action.payload === 'object') {
          state.dashboardStats = {
            ...createInitialDashboardStats(),
            ...action.payload,
          };
          const payloadCounts = action.payload.counts;
          state.userCounts = {
            ...createInitialUserCounts(),
            ...(payloadCounts && typeof payloadCounts === 'object'
              ? payloadCounts
              : {
                  total: Number(action.payload.totalUsers ?? 0),
                  active: Number(action.payload.activeUsers ?? 0),
                  suspended: Number(action.payload.suspendedUsers ?? 0),
                  flagged: Number(
                    action.payload.flaggedUsers ?? action.payload.flaggedWarned ?? 0,
                  ),
                  warned: Number(action.payload.warnedUsers ?? 0),
                  possibleDuplicates: Number(action.payload.possibleDuplicates ?? 0),
                  pendingApprovals: Number(action.payload.pendingApprovals ?? 0),
                }),
          };
        }
      })
      .addCase(fetchDashboardStats.rejected, (state, action) => {
        ensureSubstates(state);
        state.statsStatus = 'failed';
        state.statsError =
          action.payload?.serverMessage ||
          action.payload?.message ||
          action.error?.message ||
          'Failed to fetch dashboard stats.';
      })

      .addCase(issueUserWarning.fulfilled, (state, action) => {
        ensureSubstates(state);
        const uid = action.payload?.userId;
        if (uid && state.userDetailsById[uid] && typeof action.payload?.activeCount === 'number') {
          state.userDetailsById[uid] = {
            ...state.userDetailsById[uid],
            activeWarningsCount: action.payload.activeCount,
            status: 'Warned',
          };
        }
      })
      .addCase(suspendUserModeration.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { userId, result } = action.payload || {};
        if (userId && result?.status !== 'pending_second_approval' && state.userDetailsById[userId]) {
          state.userDetailsById[userId] = {
            ...state.userDetailsById[userId],
            status: 'Suspended',
            ...(result?.suspensionReason ? { suspensionReason: result.suspensionReason } : {}),
          };
        }
      })
      .addCase(reactivateUserModeration.fulfilled, (state, action) => {
        ensureSubstates(state);
        const uid = action.payload?.userId;
        if (uid && state.userDetailsById[uid]) {
          state.userDetailsById[uid] = {
            ...state.userDetailsById[uid],
            status: 'Active',
            activeWarningsCount: 0,
            suspension: null,
            suspensionReason: null,
            suspendedAt: null,
            suspendedBy: null,
            suspendedByName: null,
            suspensionType: null,
          };
        }
      })

      .addCase(sessionReset, () => createInitialAdminUsersState());

    addRouteReset(builder, clearWorkingAdminUsersState);
  },
});

export const {
  setAll,
  addOne,
  updateOne,
  removeOne,
  setAdminUsersFilter,
  setAdminUsersQuery,
  setSelectedAdminUserId,
  setRepTypeFilter,
  setRepPage,
  clearAdminUsersActionError,
} = adminUsersSlice.actions;

export default adminUsersSlice.reducer;
