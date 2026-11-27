import { createAsyncThunk } from '@reduxjs/toolkit';
import appealsApi from '../../services/appealsApi';
import { normalizeThunkError } from '../utils/thunkError';
import { fetchMyWarnings } from './warningsThunks';

/**
 * Submits a warning appeal (`POST /warnings/:id/appeal`).
 */
export const submitWarningAppeal = createAsyncThunk(
  'appeals/submitWarningAppeal',
  async ({ warningId, explanation }, { dispatch, rejectWithValue }) => {
    try {
      const wid = String(warningId);
      const res = await appealsApi.submitAppeal(wid, {
        explanation: String(explanation || '').trim(),
      });
      await Promise.allSettled([
        dispatch(fetchMyAppeals()),
        dispatch(fetchMyWarnings()),
      ]);
      return { warningId: wid, appeal: res || null };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Fetches user's own appeals (`GET /users/me/appeals`).
 */
export const fetchMyAppeals = createAsyncThunk(
  'appeals/fetchMyAppeals',
  async (_arg, { rejectWithValue }) => {
    try {
      const res = await appealsApi.getMyAppeals();
      return Array.isArray(res) ? res : res?.items || res?.data || [];
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Fetches admin appeals queue (`GET /admin/appeals`).
 */
export const fetchAdminAppeals = createAsyncThunk(
  'appeals/fetchAdminAppeals',
  async (status = '', { rejectWithValue }) => {
    try {
      const res = await appealsApi.getAdminAppeals(
        status && status !== 'all' ? status : undefined,
      );
      return Array.isArray(res) ? res : res?.items || res?.data || [];
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Decides a pending appeal (`POST /admin/appeals/:id/decision`).
 */
export const decideAdminAppeal = createAsyncThunk(
  'appeals/decideAdminAppeal',
  async ({ appealId, decision, note, warningId, userId, currentFilter }, { dispatch, rejectWithValue }) => {
    try {
      const aid = String(appealId);
      const res = await appealsApi.decideAppeal(aid, {
        decision,
        note: String(note || '').trim(),
      });
      await dispatch(fetchAdminAppeals(currentFilter || 'all')).catch(() => null);
      return {
        appealId: aid,
        decision,
        note: String(note || '').trim(),
        warningId: res?.warningId || warningId || null,
        userId: res?.userId || userId || null,
        appeal: res?.appeal || res || null,
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);
