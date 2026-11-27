import { createAsyncThunk } from '@reduxjs/toolkit';
import * as adminApiModule from '../../services/adminApi';
import { normalizeThunkError } from '../utils/thunkError';

function getAdminApi() {
  const keys = Object.keys(adminApiModule);
  if (keys.includes('default')) return adminApiModule.default;
  if (keys.includes('adminApi')) return adminApiModule.adminApi;
  return adminApiModule;
}

/**
 * Fetches active & past warnings for the logged-in user (`GET /users/me/warnings`).
 */
export const fetchMyWarnings = createAsyncThunk(
  'warnings/fetchMyWarnings',
  async (_arg, { rejectWithValue }) => {
    try {
      const adminApi = getAdminApi();
      if (typeof adminApi?.getMyWarnings !== 'function') return [];
      const res = await adminApi.getMyWarnings();
      return Array.isArray(res) ? res : res?.items || res?.data || [];
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Fetches warnings for a specific user (`GET /admin/users/:id/warnings`).
 */
export const fetchUserWarningsAdmin = createAsyncThunk(
  'warnings/fetchUserWarningsAdmin',
  async ({ userId, role }, { rejectWithValue }) => {
    try {
      const adminApi = getAdminApi();
      if (!userId || typeof adminApi?.getWarnings !== 'function') {
        return { userId: String(userId || ''), items: null };
      }
      const uid = String(userId);
      const res =
        role !== undefined
          ? await adminApi.getWarnings(uid, role)
          : await adminApi.getWarnings(uid);
      const items = Array.isArray(res) ? res : res?.items || res?.data || [];
      return { userId: uid, items };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Issues a warning to a user (`POST /admin/users/:id/warn`).
 */
export const issueUserWarning = createAsyncThunk(
  'warnings/issueUserWarning',
  async ({ userId, reason, role }, { rejectWithValue }) => {
    try {
      const adminApi = getAdminApi();
      const uid = String(userId);
      const payload = { reason: String(reason || '').trim() };
      const res =
        role !== undefined
          ? await adminApi.warnUser(uid, payload, role)
          : await adminApi.warnUser(uid, payload);
      return {
        userId: uid,
        warning: res?.warning || null,
        activeCount:
          res?.activeCount ??
          res?.activeWarningsCount ??
          (typeof res?.warnings === 'number' ? res.warnings : undefined),
        autoSuspended: Boolean(res?.autoSuspended),
        raw: res || null,
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);
