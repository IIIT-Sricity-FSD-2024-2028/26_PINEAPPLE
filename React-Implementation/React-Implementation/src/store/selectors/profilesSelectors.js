import { createSelector } from '@reduxjs/toolkit';
import { profilesAdapter, createInitialProfilesWorking } from '../slices/profilesSlice';

const EMPTY_TRUST_MAP = {};
const EMPTY_RESPONSE_MAP = {};
const DEFAULT_WORKING = createInitialProfilesWorking();

const adapterSelectors = profilesAdapter.getSelectors(
  (state) => state?.profiles || { ids: [], entities: {} },
);

export const selectAllProfiles = adapterSelectors.selectAll;
export const selectProfileEntities = adapterSelectors.selectEntities;

export const selectProfileById = (state, userId) =>
  adapterSelectors.selectById(state, String(userId || ''));

export const selectOwnProfileId = (state) => state?.profiles?.ownProfileId || null;

export const selectOwnProfile = (state) => {
  const uid = selectOwnProfileId(state);
  if (!uid) return null;
  return adapterSelectors.selectById(state, uid) || null;
};

export const selectTrustSummariesMap = (state) =>
  state?.profiles?.trustByUserId || EMPTY_TRUST_MAP;

export const selectTrustSummaryById = (state, userId) => {
  const uid = String(userId || '').trim();
  if (!uid) return null;
  return state?.profiles?.trustByUserId?.[uid] || null;
};

/**
 * Selects a trust summary enforcing private field visibility:
 * `reputation` and `needsAttention` are only exposed when `isSelf` or `isAdminViewer` is true.
 */
export const selectSafeTrustSummaryById = (
  state,
  userId,
  { isSelf, isAdminViewer } = {},
) => {
  const raw = selectTrustSummaryById(state, userId);
  if (!raw) return null;

  const sessionUser = state?.session?.user;
  const sessionAdmin = Boolean(
    state?.session?.portalRole ||
      state?.session?.isSuperUser ||
      String(sessionUser?.role || '').toLowerCase() === 'admin' ||
      String(sessionUser?.role || '').toLowerCase() === 'superuser',
  );
  const viewerIsSelf =
    isSelf !== undefined
      ? Boolean(isSelf)
      : Boolean(sessionUser?.id && String(sessionUser.id) === String(userId));
  const viewerIsAdmin =
    isAdminViewer !== undefined ? Boolean(isAdminViewer) : sessionAdmin;

  if (viewerIsSelf || viewerIsAdmin) {
    if (viewerIsAdmin) return raw;
    const selfView = { ...raw };
    delete selfView.needsAttention;
    return selfView;
  }

  const publicView = { ...raw };
  delete publicView.reputation;
  delete publicView.needsAttention;
  delete publicView.ledgerLink;
  return publicView;
};

export const selectResponseTimeMap = (state) =>
  state?.profiles?.responseTimeByUserId || EMPTY_RESPONSE_MAP;

export const selectResponseTimeByUserId = (state, userId) => {
  const uid = String(userId || '').trim();
  const map = state?.profiles?.responseTimeByUserId || EMPTY_RESPONSE_MAP;
  return uid ? map[uid] || null : null;
};

export const selectProfilesWorking = (state) =>
  state?.profiles?.working || DEFAULT_WORKING;

export const selectUserSearchResults = createSelector(
  [selectProfilesWorking],
  (working) => working.searchResults || [],
);

export const selectProfilesStatus = (state) => state?.profiles?.status || 'idle';
export const selectProfilesError = (state) => state?.profiles?.error || null;
