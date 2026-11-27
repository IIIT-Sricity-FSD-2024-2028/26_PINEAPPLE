import { createAsyncThunk } from '@reduxjs/toolkit';
import * as adminApiModule from '../../services/adminApi';
import { resolveApiModule } from '../utils/apiModule';
import { normalizeThunkError } from '../utils/thunkError';

/**
 * Fetches scheduled job execution runs (`GET /admin/jobs/runs`).
 */
export const fetchJobRuns = createAsyncThunk(
  'jobRuns/fetchJobRuns',
  async (limit = 50, { rejectWithValue }) => {
    try {
      const adminApi = resolveApiModule(adminApiModule, 'adminApi');
      const data = await adminApi.getJobRuns(limit);
      return Array.isArray(data) ? data : data?.items || data?.data || [];
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Fetches single job run detail (`GET /admin/jobs/runs/:id`).
 */
export const fetchJobRunById = createAsyncThunk(
  'jobRuns/fetchJobRunById',
  async (runId, { rejectWithValue }) => {
    try {
      const adminApi = resolveApiModule(adminApiModule, 'adminApi');
      const run = await adminApi.getJobRun(String(runId));
      return run || null;
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Triggers manual scheduled jobs tick (`POST /admin/jobs/tick`, Super User only).
 */
export const triggerJobTick = createAsyncThunk(
  'jobRuns/triggerJobTick',
  async (_arg, { dispatch, rejectWithValue }) => {
    try {
      const adminApi = resolveApiModule(adminApiModule, 'adminApi');
      const res = await adminApi.triggerJobTick();
      dispatch(fetchJobRuns(50)).catch(() => null);
      return res || { runId: 'initiated' };
    } catch (err) {
      dispatch(fetchJobRuns(50)).catch(() => null);
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);
