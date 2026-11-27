import { createSelector } from '@reduxjs/toolkit';
import {
  gamificationAdapter,
  createInitialGamificationWorking,
} from '../slices/gamificationSlice';

const EMPTY_LIST = [];
const DEFAULT_WORKING = createInitialGamificationWorking();

const adapterSelectors = gamificationAdapter.getSelectors(
  (state) => state?.gamification || { ids: [], entities: {} },
);

export const selectLeaderboardEntries = adapterSelectors.selectAll;
export const selectGamificationStatus = (state) =>
  state?.gamification?.status || 'idle';
export const selectGamificationError = (state) =>
  state?.gamification?.error || null;
export const selectGamificationWorking = (state) =>
  state?.gamification?.working || DEFAULT_WORKING;

export const selectUserBadges = (state, userId) => {
  const uid = String(userId || '').trim();
  if (!uid) return EMPTY_LIST;
  return state?.gamification?.badgesByUserId?.[uid] || EMPTY_LIST;
};

export const selectProjectBadges = (state, projectId) => {
  const pid = String(projectId || '').trim();
  if (!pid) return EMPTY_LIST;
  return state?.gamification?.badgesByProjectId?.[pid] || EMPTY_LIST;
};

export const selectUserGamificationLedger = (state, userId) => {
  const uid = String(userId || '').trim();
  if (!uid) return EMPTY_LIST;
  return state?.gamification?.xpLedgerByUserId?.[uid] || EMPTY_LIST;
};

export const selectUserGamificationStats = (state, userId) => {
  const uid = String(userId || '').trim();
  if (!uid) return null;
  return state?.gamification?.statsByUserId?.[uid] || null;
};

export const selectUserRank = (state, userId) => {
  const uid = String(userId || '').trim();
  if (!uid) return null;
  return state?.gamification?.userRankByUserId?.[uid] || null;
};

const STANDING_RANK = {
  'good standing': 3,
  'fair standing': 2,
  'low standing': 1,
};

function standingWeight(band) {
  return STANDING_RANK[String(band || '').trim().toLowerCase()] || 0;
}

/**
 * Sorts and filters stored leaderboard entries for the selected tab (`xp`,
 * `reliable`, `standing`) and optional search query without extra server calls.
 */
export const selectLeaderboardForTab = createSelector(
  [
    selectLeaderboardEntries,
    selectGamificationWorking,
    (_state, options) => options?.tab,
    (_state, options) => options?.searchQuery,
  ],
  (rows, working, tabArg, searchArg) => {
    const tab = tabArg || working.activeTab || 'xp';
    const q = String(searchArg !== undefined ? searchArg : working.searchQuery || '')
      .trim()
      .toLocaleLowerCase();

    const filtered = q
      ? rows.filter((entry) =>
          `${entry?.user || ''} ${entry?.initials || ''}`
            .toLocaleLowerCase()
            .includes(q),
        )
      : [...rows];

    filtered.sort((a, b) => {
      if (tab === 'reliable') {
        const rateA = a?.onTimeRate !== null && a?.onTimeRate !== undefined ? Number(a.onTimeRate) : -1;
        const rateB = b?.onTimeRate !== null && b?.onTimeRate !== undefined ? Number(b.onTimeRate) : -1;
        if (rateB !== rateA) return rateB - rateA;
        const tasksDiff = Number(b?.tasks || 0) - Number(a?.tasks || 0);
        if (tasksDiff !== 0) return tasksDiff;
        return Number(b?.xp || 0) - Number(a?.xp || 0);
      }

      if (tab === 'standing') {
        const rankDiff = standingWeight(b?.band) - standingWeight(a?.band);
        if (rankDiff !== 0) return rankDiff;
        const xpDiff = Number(b?.xp || 0) - Number(a?.xp || 0);
        if (xpDiff !== 0) return xpDiff;
        return Number(b?.tasks || 0) - Number(a?.tasks || 0);
      }

      // Default 'xp' tab
      const xpDiff = Number(b?.xp || 0) - Number(a?.xp || 0);
      if (xpDiff !== 0) return xpDiff;
      const tasksDiff = Number(b?.tasks || 0) - Number(a?.tasks || 0);
      if (tasksDiff !== 0) return tasksDiff;
      return Number(b?.projects || 0) - Number(a?.projects || 0);
    });

    return filtered;
  },
);
