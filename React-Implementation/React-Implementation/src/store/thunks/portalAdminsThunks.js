import { createAsyncThunk } from '@reduxjs/toolkit';
import * as portalAdminsApiModule from '../../services/portalAdminsApi';
import { resolveApiModule } from '../utils/apiModule';
import { normalizeThunkError } from '../utils/thunkError';

/**
 * Lists all portal admin accounts (`GET /portal-admins`).
 */
export const fetchPortalAdmins = createAsyncThunk(
  'portalAdmins/fetchPortalAdmins',
  async (_arg, { rejectWithValue }) => {
    try {
      const api = resolveApiModule(portalAdminsApiModule, 'portalAdminsApi');
      const data = await api.list();
      return Array.isArray(data) ? data : data?.items || data?.data || [];
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Creates a portal admin (`POST /portal-admins`).
 */
export const createPortalAdmin = createAsyncThunk(
  'portalAdmins/createPortalAdmin',
  async (payload, { dispatch, rejectWithValue }) => {
    try {
      const api = resolveApiModule(portalAdminsApiModule, 'portalAdminsApi');
      const created = await api.create(payload);
      dispatch(fetchPortalAdmins()).catch(() => null);
      return created || payload;
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Updates a portal admin (`PUT /portal-admins/:id`).
 */
export const updatePortalAdmin = createAsyncThunk(
  'portalAdmins/updatePortalAdmin',
  async ({ id, payload }, { rejectWithValue }) => {
    try {
      const api = resolveApiModule(portalAdminsApiModule, 'portalAdminsApi');
      const updated = await api.update(String(id), payload);
      return updated && typeof updated === 'object'
        ? { id: String(id), ...updated }
        : { id: String(id), ...payload };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Deletes a portal admin (`DELETE /portal-admins/:id`).
 */
export const deletePortalAdmin = createAsyncThunk(
  'portalAdmins/deletePortalAdmin',
  async (id, { rejectWithValue }) => {
    try {
      const api = resolveApiModule(portalAdminsApiModule, 'portalAdminsApi');
      const aid = String(id);
      await api.remove(aid);
      return aid;
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);
