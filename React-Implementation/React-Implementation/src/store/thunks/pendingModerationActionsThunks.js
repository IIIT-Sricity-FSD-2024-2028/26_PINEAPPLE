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
 * Fetches second-approval moderation actions (`GET /admin/moderation-actions`).
 */
export const fetchModerationActions = createAsyncThunk(
  'pendingModerationActions/fetchModerationActions',
  async ({ status = '', role } = {}, { rejectWithValue }) => {
    try {
      const adminApi = getAdminApi();
      if (typeof adminApi?.getModerationActions !== 'function') return [];
      const res =
        role !== undefined
          ? await adminApi.getModerationActions(status, role)
          : await adminApi.getModerationActions(status);
      return Array.isArray(res) ? res : res?.items || res?.data || [];
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Suspends a user account (`POST /admin/users/:id/suspend`), creating a
 * `pending_second_approval` record when threshold requires a peer admin.
 */
export const suspendUserModeration = createAsyncThunk(
  'pendingModerationActions/suspendUserModeration',
  async ({ userId, targetUserName, reason, role }, { dispatch, rejectWithValue }) => {
    try {
      const adminApi = getAdminApi();
      const uid = String(userId);
      const payload = { reason: String(reason || '').trim() };
      const res =
        role !== undefined
          ? await adminApi.suspendUser(uid, payload, role)
          : await adminApi.suspendUser(uid, payload);
      await dispatch(fetchModerationActions()).catch(() => null);
      return {
        userId: uid,
        targetUserName: targetUserName || 'user',
        result: res || null,
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Reactivates a suspended user account (`POST /admin/users/:id/reactivate`).
 */
export const reactivateUserModeration = createAsyncThunk(
  'pendingModerationActions/reactivateUserModeration',
  async ({ userId, reason, role }, { dispatch, rejectWithValue }) => {
    try {
      const adminApi = getAdminApi();
      const uid = String(userId);
      const payload = { reason: String(reason || '').trim() };
      const res =
        role !== undefined
          ? await adminApi.reactivateUser(uid, payload, role)
          : await adminApi.reactivateUser(uid, payload);
      await dispatch(fetchModerationActions()).catch(() => null);
      return { userId: uid, result: res || null };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Approves a peer admin's pending suspension (`POST /admin/moderation-actions/:id/approve`).
 */
export const approveModerationAction = createAsyncThunk(
  'pendingModerationActions/approveModerationAction',
  async ({ actionId, reason, role }, { dispatch, rejectWithValue }) => {
    try {
      const adminApi = getAdminApi();
      const aid = String(actionId);
      const trimmed = String(reason || '').trim();
      const res =
        role !== undefined
          ? await adminApi.approveModerationAction(aid, trimmed, role)
          : await adminApi.approveModerationAction(aid, trimmed);
      await dispatch(fetchModerationActions()).catch(() => null);
      return { actionId: aid, reason: trimmed, result: res || null };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Rejects a peer admin's pending suspension (`POST /admin/moderation-actions/:id/reject`).
 */
export const rejectModerationAction = createAsyncThunk(
  'pendingModerationActions/rejectModerationAction',
  async ({ actionId, reason, role }, { dispatch, rejectWithValue }) => {
    try {
      const adminApi = getAdminApi();
      const aid = String(actionId);
      const trimmed = String(reason || '').trim();
      const res =
        role !== undefined
          ? await adminApi.rejectModerationAction(aid, trimmed, role)
          : await adminApi.rejectModerationAction(aid, trimmed);
      await dispatch(fetchModerationActions()).catch(() => null);
      return { actionId: aid, reason: trimmed, result: res || null };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);
