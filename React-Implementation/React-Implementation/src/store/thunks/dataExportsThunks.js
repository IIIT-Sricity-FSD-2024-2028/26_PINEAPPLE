import { createAsyncThunk } from '@reduxjs/toolkit';
import * as usersApiModule from '../../services/usersApi';
import { resolveApiModule } from '../utils/apiModule';
import { normalizeThunkError } from '../utils/thunkError';

/**
 * Lists the user's GDPR / account data exports (`GET /users/me/export`).
 */
export const fetchDataExports = createAsyncThunk(
  'dataExports/fetchDataExports',
  async (_arg, { rejectWithValue }) => {
    try {
      const usersApi = resolveApiModule(usersApiModule, 'usersApi');
      if (typeof usersApi?.listExports !== 'function') return [];
      const list = await usersApi.listExports();
      return Array.isArray(list) ? list : list?.items || list?.data || [];
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Requests a new user data export (`POST /users/me/export`).
 */
export const requestDataExport = createAsyncThunk(
  'dataExports/requestDataExport',
  async (_arg, { rejectWithValue }) => {
    try {
      const usersApi = resolveApiModule(usersApiModule, 'usersApi');
      const res = await usersApi.requestExport();
      return res || null;
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Polls status of one data export (`GET /users/me/export/:id`).
 */
export const fetchDataExportStatus = createAsyncThunk(
  'dataExports/fetchDataExportStatus',
  async (exportId, { rejectWithValue }) => {
    try {
      const usersApi = resolveApiModule(usersApiModule, 'usersApi');
      if (typeof usersApi?.getExportStatus !== 'function') return null;
      const res = await usersApi.getExportStatus(String(exportId));
      return res || null;
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Downloads data export JSON payload (`GET /users/me/export/:id/download`).
 */
export const downloadDataExport = createAsyncThunk(
  'dataExports/downloadDataExport',
  async (exportId, { rejectWithValue }) => {
    try {
      const usersApi = resolveApiModule(usersApiModule, 'usersApi');
      const eid = String(exportId);
      const file = await usersApi.downloadExport(eid);
      return {
        exportId: eid,
        file,
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);
