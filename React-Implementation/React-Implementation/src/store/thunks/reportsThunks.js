import { createAsyncThunk } from '@reduxjs/toolkit';
import reportsApi from '../../services/reportsApi';
import { normalizeThunkError } from '../utils/thunkError';

function extractCount(res) {
  if (typeof res === 'number') return res;
  if (typeof res?.count === 'number') return res.count;
  if (typeof res?.openCount === 'number') return res.openCount;
  return 0;
}

/**
 * Submits a user conduct report (`POST /reports`).
 */
export const createUserReport = createAsyncThunk(
  'reports/createUserReport',
  async (payload, { dispatch, rejectWithValue }) => {
    try {
      const fn =
        typeof reportsApi.createReport === 'function'
          ? reportsApi.createReport
          : reportsApi.submitReport;
      const res = await fn(payload);
      await dispatch(fetchMyReports({ force: true })).catch(() => null);
      return res || null;
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Fetches reports submitted by the current user (`GET /reports/mine`).
 */
export const fetchMyReports = createAsyncThunk(
  'reports/fetchMyReports',
  async (_arg, { rejectWithValue }) => {
    try {
      const res = await reportsApi.getMyReports();
      return Array.isArray(res) ? res : res?.items || res?.data || [];
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Fetches open reports count badge (`GET /admin/reports/open-count`).
 */
export const fetchOpenReportsCount = createAsyncThunk(
  'reports/fetchOpenReportsCount',
  async (_arg, { rejectWithValue }) => {
    try {
      if (typeof reportsApi?.getOpenCount !== 'function') return 0;
      const res = await reportsApi.getOpenCount();
      return extractCount(res);
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Fetches admin reports list (`GET /admin/reports`).
 */
export const fetchAdminReports = createAsyncThunk(
  'reports/fetchAdminReports',
  async (params = {}, { rejectWithValue }) => {
    try {
      const res = await reportsApi.getAdminReports(params);
      return Array.isArray(res) ? res : res?.items || res?.data || [];
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Fetches full report detail + prior history (`GET /admin/reports/:id`).
 */
export const fetchAdminReportDetails = createAsyncThunk(
  'reports/fetchAdminReportDetails',
  async (reportId, { rejectWithValue }) => {
    try {
      const fn =
        typeof reportsApi.getReportDetails === 'function'
          ? reportsApi.getReportDetails
          : reportsApi.getAdminReportById;
      const data = await fn(String(reportId));
      return data || null;
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Updates report status (`PATCH /admin/reports/:id/status`), keeping 409 final handling.
 */
export const updateAdminReportStatus = createAsyncThunk(
  'reports/updateAdminReportStatus',
  async ({ reportId, status, note, filters }, { dispatch, rejectWithValue }) => {
    try {
      const rid = String(reportId);
      const res = await reportsApi.updateReportStatus(rid, {
        status,
        note: note?.trim() || undefined,
      });
      const detailFn =
        typeof reportsApi.getReportDetails === 'function'
          ? reportsApi.getReportDetails
          : reportsApi.getAdminReportById;
      const updated =
        typeof detailFn === 'function'
          ? await detailFn(rid).catch(() => res)
          : res;
      await Promise.allSettled([
        dispatch(fetchAdminReports(filters || {})),
        dispatch(fetchOpenReportsCount()),
      ]);
      return { reportId: rid, report: updated || { id: rid, status } };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Executes an action on a report (`POST /admin/reports/:id/action`: dismiss/warn/suspend).
 */
export const actionAdminReport = createAsyncThunk(
  'reports/actionAdminReport',
  async ({ reportId, action, reason, filters }, { dispatch, rejectWithValue }) => {
    try {
      const rid = String(reportId);
      const res = await reportsApi.actionReport(rid, { action, reason });
      await Promise.allSettled([
        dispatch(fetchAdminReports(filters || {})),
        dispatch(fetchOpenReportsCount()),
      ]);
      return { reportId: rid, action, reason, result: res || null };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Fetches owner rejection pattern alerts (`GET /admin/reports/owner-patterns`).
 */
export const fetchOwnerPatterns = createAsyncThunk(
  'reports/fetchOwnerPatterns',
  async (days = 30, { rejectWithValue }) => {
    try {
      if (typeof reportsApi?.getOwnerPatterns !== 'function') return [];
      const res = await reportsApi.getOwnerPatterns(days);
      return Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);
