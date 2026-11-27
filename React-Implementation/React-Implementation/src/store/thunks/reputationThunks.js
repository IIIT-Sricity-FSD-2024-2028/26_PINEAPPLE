import { createAsyncThunk } from '@reduxjs/toolkit';
import * as usersApiModule from '../../services/usersApi';
import * as trustApiModule from '../../services/trustApi';
import { resolveApiForMethod } from '../utils/apiModule';
import { normalizeThunkError } from '../utils/thunkError';

/**
 * Fetches the authenticated user's paginated reputation ledger (`GET /users/me/reputation`).
 */
export const fetchMyReputation = createAsyncThunk(
  'reputation/fetchMyReputation',
  async (params = {}, { rejectWithValue }) => {
    try {
      const usersApi = resolveApiForMethod(usersApiModule, 'usersApi', 'getReputation');
      if (typeof usersApi?.getReputation !== 'function') {
        return { items: [], total: 0, page: 1 };
      }
      const { page = 1, limit = 20, type = 'all' } = params || {};
      const res = await usersApi.getReputation({ page, limit, type });
      const items = Array.isArray(res?.items)
        ? res.items
        : Array.isArray(res)
          ? res
          : [];
      const total = Number(res?.total ?? items.length) || 0;
      return { items, total, page: Number(page) || 1, type };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Fetches the authenticated user's private trust summary (`GET /users/me/trust`).
 */
export const fetchMyTrust = createAsyncThunk(
  'reputation/fetchMyTrust',
  async (_arg, { rejectWithValue }) => {
    try {
      const trustApi = resolveApiForMethod(trustApiModule, 'trustApi', 'getMyTrust');
      if (typeof trustApi?.getMyTrust !== 'function') return null;
      const res = await trustApi.getMyTrust();
      return res || null;
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Fetches a user's trust summary (`GET /users/:id/trust`).
 * Private fields only exist when returned by the backend for self or admin callers.
 */
export const fetchUserTrust = createAsyncThunk(
  'reputation/fetchUserTrust',
  async (arg, { rejectWithValue }) => {
    try {
      const trustApi = resolveApiForMethod(trustApiModule, 'trustApi', 'getUserTrust');
      const userId = typeof arg === 'object' ? arg?.userId : arg;
      const role = typeof arg === 'object' ? arg?.role : undefined;
      const uid = String(userId || '').trim();
      if (!uid || typeof trustApi?.getUserTrust !== 'function') return null;
      const res = await trustApi.getUserTrust(uid, role);
      return res ? { ...res, userId: String(res.userId || res.id || uid) } : null;
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);
