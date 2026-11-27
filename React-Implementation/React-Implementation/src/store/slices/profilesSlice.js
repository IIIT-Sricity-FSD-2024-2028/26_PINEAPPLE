import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import { addRouteReset } from '../utils/routeReset';
import { sessionReset } from '../actions/appActions';
import {
  fetchMyProfile,
  fetchPublicProfile,
  fetchTrustSummaries,
  fetchUserResponseTime,
  searchUsers,
} from '../thunks/profilesThunks';
import { fetchMyTrust, fetchUserTrust } from '../thunks/reputationThunks';
import {
  deleteUserPhone,
  saveProfileSettings,
  verifyUserPhone,
} from '../thunks/settingsThunks';

function deriveProfileId(item) {
  return String(item?.id || item?.userId || item?.uid || '');
}

/**
 * Profiles Repository Slice (`profilesSlice`)
 * ===========================================
 * Holds the signed-in user's full profile (`GET /users/me`), public profiles
 * (`GET /users/:id/public-profile`), bulk-cached trust summaries keyed by `userId`
 * (`POST /users/trust-summaries`), and response-time stats.
 *
 * Route-Leave Reset (Reading B — Decision D3):
 * - CLEARS on `routeChanged`: `working` (`searchQuery`, `searchResults`,
 *   `searchingUsers`, `loadingPublicProfileId`, `error`).
 * - STAYS across `routeChanged`: `entities`, `ids`, `ownProfileId`, `trustByUserId`,
 *   `responseTimeByUserId`.
 * - Full reset on `sessionReset`.
 */
export const profilesAdapter = createEntityAdapter({
  selectId: deriveProfileId,
});

export function createInitialProfilesWorking() {
  return {
    loadingPublicProfileId: null,
    searchingUsers: false,
    searchQuery: '',
    searchResults: [],
  };
}

export function createInitialProfilesState() {
  return profilesAdapter.getInitialState({
    ownProfileId: null,
    trustByUserId: {},
    responseTimeByUserId: {},
    status: 'idle',
    trustStatus: 'idle',
    error: null,
    lastFetchedAt: null,
    working: createInitialProfilesWorking(),
  });
}

function ensureSubstates(state) {
  if (!state.entities) state.entities = {};
  if (!Array.isArray(state.ids)) state.ids = [];
  if (!state.trustByUserId) state.trustByUserId = {};
  if (!state.responseTimeByUserId) state.responseTimeByUserId = {};
  if (!state.working) state.working = createInitialProfilesWorking();
}

function clearWorkingProfilesState(state) {
  ensureSubstates(state);
  state.working = createInitialProfilesWorking();
  state.error = null;
}

function storeTrustSummary(state, summary) {
  if (!summary || typeof summary !== 'object') return;
  const uid = String(summary.userId || summary.id || '').trim();
  if (!uid) return;
  state.trustByUserId[uid] = summary;
}

const profilesSlice = createSlice({
  name: 'profiles',
  initialState: createInitialProfilesState(),
  reducers: {
    // ── Four Explicit CRUD Reducers (SPEC 2, D2) ──
    setAll: (state, action) => {
      ensureSubstates(state);
      const list = Array.isArray(action.payload) ? action.payload : [];
      profilesAdapter.setAll(
        state,
        list.filter((p) => deriveProfileId(p)),
      );
    },
    addOne: (state, action) => {
      ensureSubstates(state);
      if (!deriveProfileId(action.payload)) return;
      profilesAdapter.upsertOne(state, action.payload);
    },
    updateOne: (state, action) => {
      ensureSubstates(state);
      profilesAdapter.updateOne(state, action.payload);
    },
    removeOne: (state, action) => {
      ensureSubstates(state);
      const uid = String(action.payload);
      profilesAdapter.removeOne(state, uid);
      if (state.ownProfileId === uid) state.ownProfileId = null;
    },
    upsertTrustSummaries: (state, action) => {
      ensureSubstates(state);
      const list = Array.isArray(action.payload) ? action.payload : [];
      list.forEach((s) => storeTrustSummary(state, s));
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMyProfile.pending, (state) => {
        ensureSubstates(state);
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchMyProfile.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.status = 'succeeded';
        state.lastFetchedAt = Date.now();
        const profile = action.payload;
        const uid = deriveProfileId(profile);
        if (uid) {
          state.ownProfileId = uid;
          profilesAdapter.upsertOne(state, profile);
        }
      })
      .addCase(fetchMyProfile.rejected, (state, action) => {
        ensureSubstates(state);
        state.status = 'failed';
        state.error = action.payload || { message: action.error?.message || 'Failed to load profile.' };
      })
      .addCase(fetchPublicProfile.pending, (state, action) => {
        ensureSubstates(state);
        state.working.loadingPublicProfileId = String(action.meta.arg || '');
        state.error = null;
      })
      .addCase(fetchPublicProfile.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.working.loadingPublicProfileId = null;
        if (deriveProfileId(action.payload)) {
          profilesAdapter.upsertOne(state, action.payload);
        }
      })
      .addCase(fetchPublicProfile.rejected, (state, action) => {
        ensureSubstates(state);
        state.working.loadingPublicProfileId = null;
        state.error = action.payload || { message: action.error?.message || 'Failed to load public profile.' };
      })
      .addCase(fetchTrustSummaries.pending, (state) => {
        ensureSubstates(state);
        state.trustStatus = 'loading';
      })
      .addCase(fetchTrustSummaries.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.trustStatus = 'succeeded';
        const summaries = Array.isArray(action.payload?.summaries)
          ? action.payload.summaries
          : Array.isArray(action.payload)
            ? action.payload
            : [];
        summaries.forEach((s) => storeTrustSummary(state, s));
      })
      .addCase(fetchTrustSummaries.rejected, (state) => {
        ensureSubstates(state);
        state.trustStatus = 'failed';
      })
      .addCase(fetchMyTrust.fulfilled, (state, action) => {
        ensureSubstates(state);
        const summary = action.payload;
        if (!summary) return;
        const uid = String(summary.userId || summary.id || state.ownProfileId || '').trim();
        if (uid) {
          state.trustByUserId[uid] = { ...summary, userId: uid };
        }
      })
      .addCase(fetchUserTrust.fulfilled, (state, action) => {
        ensureSubstates(state);
        storeTrustSummary(state, action.payload);
      })
      .addCase(fetchUserResponseTime.fulfilled, (state, action) => {
        ensureSubstates(state);
        const uid = String(action.payload?.userId || '').trim();
        if (uid && action.payload?.data) {
          state.responseTimeByUserId[uid] = action.payload.data;
        }
      })
      .addCase(searchUsers.pending, (state, action) => {
        ensureSubstates(state);
        state.working.searchingUsers = true;
        state.working.searchQuery = String(action.meta.arg || '');
      })
      .addCase(searchUsers.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.working.searchingUsers = false;
        state.working.searchQuery = action.payload?.query || '';
        state.working.searchResults = Array.isArray(action.payload?.items)
          ? action.payload.items
          : [];
      })
      .addCase(searchUsers.rejected, (state) => {
        ensureSubstates(state);
        state.working.searchingUsers = false;
        state.working.searchResults = [];
      })
      .addCase(saveProfileSettings.fulfilled, (state, action) => {
        ensureSubstates(state);
        const updated = action.payload;
        const uid = deriveProfileId(updated) || state.ownProfileId;
        if (!uid) return;
        const existing = state.entities[uid] || {};
        profilesAdapter.upsertOne(state, {
          ...existing,
          ...(updated && typeof updated === 'object' ? updated : {}),
          id: uid,
          profile: {
            ...(existing.profile || {}),
            ...(updated?.profile || {}),
          },
        });
      })
      .addCase(verifyUserPhone.fulfilled, (state, action) => {
        ensureSubstates(state);
        const uid = state.ownProfileId;
        if (!uid || !state.entities[uid]) return;
        const existing = state.entities[uid];
        const phoneE164 = action.meta.arg?.phoneE164 || existing.phone;
        profilesAdapter.updateOne(state, {
          id: uid,
          changes: {
            phone: phoneE164,
            phoneVerified: true,
            phoneVerifiedAt: action.payload?.phoneVerifiedAt || new Date().toISOString(),
            profile: {
              ...(existing.profile || {}),
              phone: phoneE164,
              phoneVerified: true,
            },
          },
        });
      })
      .addCase(deleteUserPhone.fulfilled, (state) => {
        ensureSubstates(state);
        const uid = state.ownProfileId;
        if (!uid || !state.entities[uid]) return;
        const existing = state.entities[uid];
        profilesAdapter.updateOne(state, {
          id: uid,
          changes: {
            phone: '',
            phoneVerified: false,
            profile: {
              ...(existing.profile || {}),
              phone: '',
              phoneVerified: false,
            },
          },
        });
      })
      .addCase(sessionReset, () => createInitialProfilesState());

    addRouteReset(builder, clearWorkingProfilesState);
  },
});

export const {
  setAll,
  addOne,
  updateOne,
  removeOne,
  upsertTrustSummaries,
} = profilesSlice.actions;

export default profilesSlice.reducer;
