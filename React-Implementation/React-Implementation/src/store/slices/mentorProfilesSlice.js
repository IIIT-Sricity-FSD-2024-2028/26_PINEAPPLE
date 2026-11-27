import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import { addRouteReset } from '../utils/routeReset';
import { sessionReset } from '../actions/appActions';
import {
  confirmMentorRole,
  fetchMentorById,
  fetchMentors,
  fetchMyMentorProfile,
  fetchMyMentorStats,
  saveMentorProfile,
  toggleMentorAvailability,
} from '../thunks/mentorProfilesThunks';

function deriveProfileId(profile) {
  return String(profile?.id || profile?.userId || '');
}

/**
 * Mentor Profiles Repository Slice (`mentorProfilesSlice`)
 * ========================================================
 * Manages verified mentor directory listings and the authenticated mentor's
 * own marketplace profile and aggregate statistics.
 *
 * Route-Leave Reset (Reading B — Decision D3):
 * - CLEARS on `routeChanged`: `working` search/filter/selection/form errors.
 * - STAYS across `routeChanged`: loaded directory `entities`/`listIds`,
 *   `myProfile`, `hasExistingProfile`, and `myStats`.
 * - Full reset on `sessionReset`.
 */
export const mentorProfilesAdapter = createEntityAdapter({
  selectId: deriveProfileId,
});

export function createInitialMentorProfilesWorking() {
  return {
    searchQuery: '',
    selectedMentorId: null,
    saveError: null,
    availabilityError: null,
    feedbackNotice: null,
  };
}

export function createInitialMentorProfilesState() {
  return mentorProfilesAdapter.getInitialState({
    listIds: [],
    listStatus: 'idle',
    listError: null,
    listLastFetchedAt: null,
    detailStatus: 'idle',
    detailError: null,
    myProfile: null,
    hasExistingProfile: false,
    myProfileStatus: 'idle',
    myProfileError: null,
    myProfileLastFetchedAt: null,
    myStats: null,
    myStatsStatus: 'idle',
    myStatsLastFetchedAt: null,
    savingStatus: 'idle',
    availabilityStatus: 'idle',
    confirmRoleStatus: 'idle',
    error: null,
    working: createInitialMentorProfilesWorking(),
  });
}

function ensureSubstates(state) {
  if (!state.entities) state.entities = {};
  if (!Array.isArray(state.ids)) state.ids = [];
  if (!Array.isArray(state.listIds)) state.listIds = [];
  if (!state.listStatus) state.listStatus = 'idle';
  if (!state.myProfileStatus) state.myProfileStatus = 'idle';
  if (!state.savingStatus) state.savingStatus = 'idle';
  if (!state.availabilityStatus) state.availabilityStatus = 'idle';
  if (!state.working) state.working = createInitialMentorProfilesWorking();
}

function clearWorkingMentorProfilesState(state) {
  state.working = createInitialMentorProfilesWorking();
  state.error = null;
}

const mentorProfilesSlice = createSlice({
  name: 'mentorProfiles',
  initialState: createInitialMentorProfilesState(),
  reducers: {
    // ── Four Explicit CRUD Reducers (SPEC 2, D2) ──
    setAll: (state, action) => {
      ensureSubstates(state);
      const items = Array.isArray(action.payload) ? action.payload : [];
      mentorProfilesAdapter.setAll(state, items);
      state.listIds = items.map(deriveProfileId).filter(Boolean);
    },
    addOne: (state, action) => {
      ensureSubstates(state);
      const profile = action.payload;
      const pid = deriveProfileId(profile);
      if (!pid) return;
      mentorProfilesAdapter.addOne(state, profile);
      if (!state.listIds.includes(pid)) {
        state.listIds.push(pid);
      }
    },
    updateOne: (state, action) => {
      ensureSubstates(state);
      mentorProfilesAdapter.updateOne(state, action.payload);
    },
    removeOne: (state, action) => {
      ensureSubstates(state);
      const id = String(action.payload);
      mentorProfilesAdapter.removeOne(state, id);
      state.listIds = state.listIds.filter((itemId) => itemId !== id);
    },

    // ── Volatile Working State Reducers ──
    setMentorSearchQuery: (state, action) => {
      ensureSubstates(state);
      state.working.searchQuery =
        typeof action.payload === 'string' ? action.payload : '';
    },
    setSelectedMentorId: (state, action) => {
      ensureSubstates(state);
      state.working.selectedMentorId = action.payload
        ? String(action.payload)
        : null;
    },
    setProfileFeedbackNotice: (state, action) => {
      ensureSubstates(state);
      state.working.feedbackNotice = action.payload || null;
    },
    clearMentorProfileErrors: (state) => {
      ensureSubstates(state);
      state.working.saveError = null;
      state.working.availabilityError = null;
      state.working.feedbackNotice = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMentors.pending, (state) => {
        ensureSubstates(state);
        state.listStatus = 'loading';
        state.listError = null;
      })
      .addCase(fetchMentors.fulfilled, (state, action) => {
        ensureSubstates(state);
        const items = Array.isArray(action.payload)
          ? action.payload.filter((m) => deriveProfileId(m))
          : [];
        mentorProfilesAdapter.upsertMany(state, items);
        state.listIds = items.map(deriveProfileId);
        state.listStatus = 'succeeded';
        state.listError = null;
        state.listLastFetchedAt = new Date().toISOString();
      })
      .addCase(fetchMentors.rejected, (state, action) => {
        ensureSubstates(state);
        state.listStatus = 'failed';
        state.listError = action.payload || { message: action.error?.message };
        state.error = state.listError;
      })

      .addCase(fetchMentorById.pending, (state) => {
        ensureSubstates(state);
        state.detailStatus = 'loading';
        state.detailError = null;
      })
      .addCase(fetchMentorById.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.detailStatus = 'succeeded';
        if (action.payload && deriveProfileId(action.payload)) {
          mentorProfilesAdapter.upsertOne(state, action.payload);
        }
      })
      .addCase(fetchMentorById.rejected, (state, action) => {
        ensureSubstates(state);
        state.detailStatus = 'failed';
        state.detailError = action.payload || { message: action.error?.message };
      })

      .addCase(fetchMyMentorProfile.pending, (state) => {
        ensureSubstates(state);
        state.myProfileStatus = 'loading';
        state.myProfileError = null;
      })
      .addCase(fetchMyMentorProfile.fulfilled, (state, action) => {
        ensureSubstates(state);
        const profile = action.payload;
        state.myProfileStatus = 'succeeded';
        state.myProfileLastFetchedAt = new Date().toISOString();
        if (profile && profile.id) {
          state.myProfile = profile;
          state.hasExistingProfile = true;
          mentorProfilesAdapter.upsertOne(state, profile);
        } else {
          state.myProfile = null;
          state.hasExistingProfile = false;
        }
      })
      .addCase(fetchMyMentorProfile.rejected, (state, action) => {
        ensureSubstates(state);
        state.myProfileStatus = 'failed';
        state.myProfileError = action.payload || {
          message: action.error?.message,
        };
      })

      .addCase(fetchMyMentorStats.pending, (state) => {
        ensureSubstates(state);
        state.myStatsStatus = 'loading';
      })
      .addCase(fetchMyMentorStats.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.myStatsStatus = 'succeeded';
        state.myStats = action.payload || null;
        state.myStatsLastFetchedAt = new Date().toISOString();
      })
      .addCase(fetchMyMentorStats.rejected, (state) => {
        ensureSubstates(state);
        state.myStatsStatus = 'failed';
      })

      .addCase(saveMentorProfile.pending, (state) => {
        ensureSubstates(state);
        state.savingStatus = 'loading';
        state.working.saveError = null;
        state.working.feedbackNotice = null;
      })
      .addCase(saveMentorProfile.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { saved } = action.payload || {};
        state.savingStatus = 'succeeded';
        state.hasExistingProfile = true;
        if (saved) {
          const merged = {
            ...(state.myProfile || {}),
            ...saved,
          };
          state.myProfile = merged;
          if (deriveProfileId(merged)) {
            mentorProfilesAdapter.upsertOne(state, merged);
          }
        }
        state.working.saveError = null;
        state.working.feedbackNotice = {
          type: 'success',
          message:
            'Your mentor profile and pricing have been saved and published to the marketplace!',
        };
      })
      .addCase(saveMentorProfile.rejected, (state, action) => {
        ensureSubstates(state);
        const errPayload = action.payload || { message: action.error?.message };
        state.savingStatus = 'failed';
        state.working.saveError = errPayload;
        state.error = errPayload;
        state.working.feedbackNotice = {
          type: 'error',
          message:
            errPayload?.message ||
            'Failed to save mentor profile. Please check all fields.',
        };
      })

      // Optimistic availability toggle with rollback on failure
      .addCase(toggleMentorAvailability.pending, (state, action) => {
        ensureSubstates(state);
        state.availabilityStatus = 'loading';
        state.working.availabilityError = null;
        const nextVal = Boolean(action.meta.arg?.isAvailable);
        if (state.myProfile) {
          state.myProfile = {
            ...state.myProfile,
            _prevIsAvailable: state.myProfile.isAvailable,
            isAvailable: nextVal,
          };
        }
      })
      .addCase(toggleMentorAvailability.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.availabilityStatus = 'succeeded';
        if (state.myProfile) {
          const { _prevIsAvailable, ...rest } = state.myProfile;
          void _prevIsAvailable;
          state.myProfile = {
            ...rest,
            ...(action.payload?.profile || {}),
            isAvailable: Boolean(action.payload?.isAvailable),
          };
          if (deriveProfileId(state.myProfile)) {
            mentorProfilesAdapter.upsertOne(state, state.myProfile);
          }
        }
      })
      .addCase(toggleMentorAvailability.rejected, (state, action) => {
        ensureSubstates(state);
        state.availabilityStatus = 'failed';
        state.working.availabilityError =
          action.payload || { message: action.error?.message };
        if (state.myProfile && '_prevIsAvailable' in state.myProfile) {
          const { _prevIsAvailable, ...rest } = state.myProfile;
          state.myProfile = {
            ...rest,
            isAvailable: _prevIsAvailable,
          };
        }
      })

      .addCase(confirmMentorRole.pending, (state) => {
        ensureSubstates(state);
        state.confirmRoleStatus = 'loading';
      })
      .addCase(confirmMentorRole.fulfilled, (state) => {
        ensureSubstates(state);
        state.confirmRoleStatus = 'succeeded';
      })
      .addCase(confirmMentorRole.rejected, (state) => {
        ensureSubstates(state);
        state.confirmRoleStatus = 'failed';
      })

      .addCase(sessionReset, () => createInitialMentorProfilesState());

    addRouteReset(builder, clearWorkingMentorProfilesState);
  },
});

export const {
  setAll,
  addOne,
  updateOne,
  removeOne,
  setMentorSearchQuery,
  setSelectedMentorId,
  setProfileFeedbackNotice,
  clearMentorProfileErrors,
} = mentorProfilesSlice.actions;

export default mentorProfilesSlice.reducer;
