import { createSelector } from '@reduxjs/toolkit';
import {
  reputationAdapter,
  createInitialReputationWorking,
} from '../slices/reputationSlice';

const DEFAULT_WORKING = createInitialReputationWorking();
const EMPTY_TRUST_MAP = {};

const adapterSelectors = reputationAdapter.getSelectors(
  (state) => state?.reputation || { ids: [], entities: {} },
);

export const selectAllReputationEntries = adapterSelectors.selectAll;
export const selectReputationTotal = (state) => Number(state?.reputation?.total || 0);
export const selectMyTrust = (state) => state?.reputation?.myTrust || null;
export const selectReputationTrustMap = (state) =>
  state?.reputation?.trustByUserId || EMPTY_TRUST_MAP;
export const selectReputationStatus = (state) => state?.reputation?.status || 'idle';
export const selectReputationError = (state) => state?.reputation?.error || null;
export const selectReputationWorking = (state) =>
  state?.reputation?.working || DEFAULT_WORKING;

export function isContributionEntry(item) {
  return Boolean(
    item?.entryClass === 'contribution' ||
      item?.type === 'task_approved' ||
      item?.type === 'project_completed',
  );
}

export const selectFilteredReputationEntries = createSelector(
  [
    selectAllReputationEntries,
    (_state, groupFilter) => groupFilter,
    selectReputationWorking,
  ],
  (entries, groupFilterArg, working) => {
    const group = groupFilterArg || working.groupFilter || 'all';
    if (group === 'all') return entries;
    if (group === 'contribution') {
      return entries.filter((item) => isContributionEntry(item));
    }
    if (group === 'standing') {
      return entries.filter((item) => !isContributionEntry(item));
    }
    return entries;
  },
);
