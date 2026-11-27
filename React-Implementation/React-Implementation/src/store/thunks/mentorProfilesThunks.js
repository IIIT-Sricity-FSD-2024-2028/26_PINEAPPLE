import { createAsyncThunk } from '@reduxjs/toolkit';
import mentorMarketplaceApi from '../../services/mentorMarketplaceApi';
import { normalizeThunkError } from '../utils/thunkError';

export const MENTOR_PROFILES_STALE_MS = 20 * 1000;

/**
 * Lists mentor profiles in directory (`GET /mentor-marketplace/mentors`).
 */
export const fetchMentors = createAsyncThunk(
  'mentorProfiles/fetchMentors',
  async (arg = {}, { rejectWithValue }) => {
    try {
      const { params = {}, role } = arg || {};
      if (typeof mentorMarketplaceApi?.listMentors !== 'function') {
        return [];
      }
      const res =
        role !== undefined
          ? await mentorMarketplaceApi.listMentors(params, role)
          : Object.keys(params).length > 0
            ? await mentorMarketplaceApi.listMentors(params)
            : await mentorMarketplaceApi.listMentors();
      return Array.isArray(res) ? res : [];
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
  {
    condition: (arg = {}, { getState }) => {
      if (arg?.force === true) return true;
      const slice = getState()?.mentorProfiles;
      if (!slice) return true;
      if (slice.listStatus === 'loading') return false;
      if (slice.listLastFetchedAt && !arg?.params) {
        const parsed = Date.parse(slice.listLastFetchedAt);
        if (
          Number.isFinite(parsed) &&
          Date.now() - parsed < MENTOR_PROFILES_STALE_MS
        ) {
          return false;
        }
      }
      return true;
    },
  },
);

/**
 * Fetches single mentor profile detail (`GET /mentor-marketplace/mentors/:id`).
 */
export const fetchMentorById = createAsyncThunk(
  'mentorProfiles/fetchMentorById',
  async (arg, { rejectWithValue }) => {
    try {
      const opts = typeof arg === 'object' && arg !== null ? arg : { id: arg };
      const id = String(opts.id);
      const res =
        opts.role !== undefined
          ? await mentorMarketplaceApi.getMentor(id, opts.role)
          : await mentorMarketplaceApi.getMentor(id);
      return res || null;
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Fetches authenticated mentor's own listing (`GET /mentor-marketplace/mentors/me`).
 * Treats 404 / "not found" as `null` (profile not created yet) without raising an error.
 */
export const fetchMyMentorProfile = createAsyncThunk(
  'mentorProfiles/fetchMyMentorProfile',
  async (arg = {}, { rejectWithValue }) => {
    try {
      if (typeof mentorMarketplaceApi?.myProfile !== 'function') {
        return null;
      }
      const { role, userId } = arg || {};
      try {
        const res = await mentorMarketplaceApi.myProfile(role, userId);
        return res && res.id ? res : null;
      } catch (err) {
        const msg = String(err?.message || '').toLowerCase();
        if (
          err?.statusCode === 404 ||
          msg.includes('not found') ||
          msg.includes('404')
        ) {
          return null;
        }
        throw err;
      }
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
  {
    condition: (arg = {}, { getState }) => {
      if (arg?.force === true) return true;
      const slice = getState()?.mentorProfiles;
      if (!slice) return true;
      if (slice.myProfileStatus === 'loading') return false;
      if (slice.myProfileLastFetchedAt) {
        const parsed = Date.parse(slice.myProfileLastFetchedAt);
        if (
          Number.isFinite(parsed) &&
          Date.now() - parsed < MENTOR_PROFILES_STALE_MS
        ) {
          return false;
        }
      }
      return true;
    },
  },
);

/**
 * Fetches mentor's private aggregate stats (`GET /mentor-marketplace/mentors/me/stats`).
 */
export const fetchMyMentorStats = createAsyncThunk(
  'mentorProfiles/fetchMyMentorStats',
  async (arg = {}, { rejectWithValue }) => {
    try {
      if (typeof mentorMarketplaceApi?.myStats !== 'function') {
        return null;
      }
      const { role, userId } = arg || {};
      const res = await mentorMarketplaceApi.myStats(role, userId);
      return res || null;
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Creates or updates mentor listing (`POST` or `PATCH /mentor-marketplace/mentors/profile`).
 */
export const saveMentorProfile = createAsyncThunk(
  'mentorProfiles/saveMentorProfile',
  async (
    { payload, isUpdate = false, role, userId, syncAvailability = true },
    { rejectWithValue },
  ) => {
    try {
      const saved = isUpdate
        ? await mentorMarketplaceApi.updateProfile(payload, role, userId)
        : await mentorMarketplaceApi.createProfile(payload, role, userId);

      if (
        syncAvailability &&
        typeof mentorMarketplaceApi?.updateAvailability === 'function'
      ) {
        await mentorMarketplaceApi
          .updateAvailability(Boolean(payload?.isAvailable), role, userId)
          .catch(() => {});
      }

      return { saved: saved || payload, isUpdate };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Toggles mentor availability (`PATCH /mentor-marketplace/mentors/availability`).
 */
export const toggleMentorAvailability = createAsyncThunk(
  'mentorProfiles/toggleMentorAvailability',
  async ({ isAvailable, role, userId }, { rejectWithValue }) => {
    try {
      const res = await mentorMarketplaceApi.updateAvailability(
        Boolean(isAvailable),
        role,
        userId,
      );
      return {
        isAvailable: Boolean(isAvailable),
        profile: res || null,
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Self-service sync of backend role to Mentor (`PATCH /mentor-marketplace/mentors/confirm-role`).
 */
export const confirmMentorRole = createAsyncThunk(
  'mentorProfiles/confirmMentorRole',
  async (arg = {}, { rejectWithValue }) => {
    try {
      const { role, userId } = arg || {};
      const res = await mentorMarketplaceApi.confirmMentorRole(role, userId);
      return res || null;
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);
