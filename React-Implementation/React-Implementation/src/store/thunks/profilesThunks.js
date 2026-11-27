import { createAsyncThunk } from '@reduxjs/toolkit';
import * as usersApiModule from '../../services/usersApi';
import * as trustApiModule from '../../services/trustApi';
import { resolveApiForMethod } from '../utils/apiModule';
import { normalizeThunkError } from '../utils/thunkError';

/**
 * Fetches the authenticated user's full profile (`GET /users/me`).
 */
export const fetchMyProfile = createAsyncThunk(
  'profiles/fetchMyProfile',
  async (_arg, { rejectWithValue }) => {
    try {
      const usersApi = resolveApiForMethod(usersApiModule, 'usersApi', 'getMe');
      const res = await usersApi.getMe();
      return res || null;
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Fetches a user's public profile (`GET /users/:id/public-profile`).
 */
export const fetchPublicProfile = createAsyncThunk(
  'profiles/fetchPublicProfile',
  async (userId, { rejectWithValue }) => {
    try {
      const usersApi = resolveApiForMethod(usersApiModule, 'usersApi', 'getPublicProfile');
      const uid = String(userId || '').trim();
      if (!uid) return null;
      const res = await usersApi.getPublicProfile(uid);
      return res ? { ...res, id: String(res.id || res.userId || uid), userId: String(res.userId || res.id || uid) } : null;
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Fetches trust summaries in bulk (`POST /users/trust-summaries`).
 * Skips already-cached userIds unless `force: true`.
 */
export const fetchTrustSummaries = createAsyncThunk(
  'profiles/fetchTrustSummaries',
  async (arg, { getState, rejectWithValue }) => {
    try {
      const trustApi = resolveApiForMethod(trustApiModule, 'trustApi', 'getTrustSummaries');
      if (typeof trustApi?.getTrustSummaries !== 'function') return [];

      const rawIds = Array.isArray(arg) ? arg : arg?.ids;
      const force = Boolean(!Array.isArray(arg) && arg?.force);
      const role = !Array.isArray(arg) ? arg?.role : undefined;

      const uniqueIds = Array.from(
        new Set(
          (Array.isArray(rawIds) ? rawIds : [])
            .map((id) => String(id || '').trim())
            .filter(Boolean),
        ),
      );

      const existingMap = getState()?.profiles?.trustByUserId || {};
      const idsToFetch = force
        ? uniqueIds
        : uniqueIds.filter((id) => !existingMap[id]);

      if (idsToFetch.length === 0) {
        return { summaries: [], skippedAll: true };
      }

      const batches = [];
      for (let i = 0; i < idsToFetch.length; i += 50) {
        batches.push(idsToFetch.slice(i, i + 50));
      }

      const collected = [];
      for (const batch of batches) {
        const res = await trustApi.getTrustSummaries(batch, role);
        const list = Array.isArray(res) ? res : res?.items || res?.summaries || [];
        collected.push(...list);
      }

      return { summaries: collected, skippedAll: false };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Fetches a user's response time metrics (`GET /users/:id/response-time`).
 */
export const fetchUserResponseTime = createAsyncThunk(
  'profiles/fetchUserResponseTime',
  async (userId, { rejectWithValue }) => {
    try {
      const usersApi = resolveApiForMethod(usersApiModule, 'usersApi', 'getResponseTime');
      const uid = String(userId || '').trim();
      if (!uid || typeof usersApi?.getResponseTime !== 'function') {
        return { userId: uid, data: null };
      }
      const res = await usersApi.getResponseTime(uid);
      return { userId: uid, data: res || null };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Searches users by handle or name (`GET /users/search`).
 */
export const searchUsers = createAsyncThunk(
  'profiles/searchUsers',
  async (query, { rejectWithValue }) => {
    try {
      const usersApi = resolveApiForMethod(usersApiModule, 'usersApi', 'searchUsers');
      const q = String(query || '').trim();
      if (!q || typeof usersApi?.searchUsers !== 'function') {
        return { query: q, items: [] };
      }
      const res = await usersApi.searchUsers(q);
      const items = Array.isArray(res) ? res : res?.items || res?.data || [];
      return { query: q, items };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);
