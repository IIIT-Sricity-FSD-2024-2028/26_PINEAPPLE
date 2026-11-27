import { createSelector } from '@reduxjs/toolkit';
import {
  adminUsersAdapter,
  createInitialAdminUsersWorking,
  createInitialDashboardStats,
  createInitialUserCounts,
} from '../slices/adminUsersSlice';

const EMPTY_IDS = [];
const EMPTY_MAP = {};
const EMPTY_LIST = [];
const FALLBACK_WORKING = createInitialAdminUsersWorking();
const FALLBACK_STATS = createInitialDashboardStats();
const FALLBACK_COUNTS = createInitialUserCounts();
const FALLBACK_REP = { items: [], total: 0 };

export const selectAdminUsersState = (state) => state?.adminUsers;

export const adminUsersEntitySelectors =
  adminUsersAdapter.getSelectors(selectAdminUsersState);

export const selectAdminUserEntities = (state) =>
  state?.adminUsers?.entities || EMPTY_MAP;

export const selectAdminUserIds = (state) =>
  state?.adminUsers?.ids || EMPTY_IDS;

export const selectAllAdminUsers = createSelector(
  [selectAdminUserEntities, selectAdminUserIds],
  (entities, ids) => ids.map((id) => entities[id]).filter(Boolean),
);

export const selectAdminDuplicateGroups = (state) =>
  state?.adminUsers?.duplicateGroups || EMPTY_LIST;

export const selectAdminTrustSummaries = (state) =>
  state?.adminUsers?.trustByUserId || EMPTY_MAP;

export const selectAdminUsersStatus = (state) =>
  state?.adminUsers?.listStatus || 'idle';

export const selectAdminUsersError = (state) =>
  state?.adminUsers?.listError || null;

export const selectAdminUserDetailsById = (userId) => (state) =>
  state?.adminUsers?.userDetailsById?.[String(userId)] || null;

export const selectAdminUserReputationById = (userId) => (state) =>
  state?.adminUsers?.reputationByUserId?.[String(userId)] || FALLBACK_REP;

export const selectDashboardStats = (state) =>
  state?.adminUsers?.dashboardStats || FALLBACK_STATS;

export const selectAdminUserCounts = createSelector(
  [(state) => state?.adminUsers?.userCounts, selectDashboardStats],
  (userCounts, stats) => {
    if (userCounts && typeof userCounts === 'object') {
      const hasNonZeroUserCounts =
        userCounts.total > 0 ||
        userCounts.active > 0 ||
        userCounts.suspended > 0 ||
        userCounts.flagged > 0 ||
        userCounts.warned > 0 ||
        userCounts.possibleDuplicates > 0 ||
        userCounts.pendingApprovals > 0;
      if (hasNonZeroUserCounts || (!stats?.counts && !stats?.totalUsers)) {
        return userCounts;
      }
    }
    if (stats?.counts && typeof stats.counts === 'object') {
      return stats.counts;
    }
    if (stats) {
      return {
        total: Number(stats.totalUsers ?? 0),
        active: Number(stats.activeUsers ?? 0),
        suspended: Number(stats.suspendedUsers ?? 0),
        flagged: Number(stats.flaggedUsers ?? stats.flaggedWarned ?? 0),
        warned: Number(stats.warnedUsers ?? 0),
        possibleDuplicates: Number(stats.possibleDuplicates ?? 0),
        pendingApprovals: Number(stats.pendingApprovals ?? 0),
      };
    }
    return FALLBACK_COUNTS;
  },
);

export const selectDashboardStatsStatus = (state) =>
  state?.adminUsers?.statsStatus || 'idle';

export const selectAdminUsersWorking = (state) =>
  state?.adminUsers?.working || FALLBACK_WORKING;
