import { createAsyncThunk } from '@reduxjs/toolkit';
import mentorApplicationsApi from '../../services/mentorApplicationsApi';
import adminApi from '../../services/adminApi';
import uploadsApi from '../../services/uploadsApi';
import { normalizeThunkError } from '../utils/thunkError';

export const MENTOR_APPS_STALE_MS = 20 * 1000;

/**
 * Fetches applicant's own mentor application status (`GET /mentor-applications/me`),
 * falling back to `GET /mentor-applications?userId=...` when `/me` returns no status field.
 */
export const fetchMyMentorApplicationStatus = createAsyncThunk(
  'mentorApplications/fetchMyMentorApplicationStatus',
  async (arg = {}, { rejectWithValue }) => {
    try {
      const { userId, role } = arg || {};
      if (!userId) return { status: 'none', application: null };

      let statusData = null;
      try {
        if (typeof mentorApplicationsApi?.getMyStatus === 'function') {
          statusData =
            role !== undefined
              ? await mentorApplicationsApi.getMyStatus({ userId }, role)
              : await mentorApplicationsApi.getMyStatus({ userId });
        }
      } catch {
        // Fall through to list fallback
      }

      if (statusData && statusData.status !== undefined) {
        return {
          status: statusData.status,
          mentorUnlocked: Boolean(statusData.mentorUnlocked),
          application:
            statusData.application ||
            (statusData.status === 'approved' ? { status: 'approved' } : null),
          inCooldown: Boolean(statusData.inCooldown),
          cooldownAvailableAt: statusData.cooldownAvailableAt || null,
          cooldownDays: statusData.cooldownDays || 14,
        };
      }

      if (typeof mentorApplicationsApi?.list !== 'function') {
        return { status: 'none', application: null };
      }
      const apps =
        role !== undefined
          ? await mentorApplicationsApi.list({ userId }, role)
          : await mentorApplicationsApi.list({ userId });
      const list = Array.isArray(apps) ? [...apps] : [];
      list.sort((a, b) => {
        const tA = new Date(a?.createdAt || a?.applicationDate || 0).getTime();
        const tB = new Date(b?.createdAt || b?.applicationDate || 0).getTime();
        return tB - tA;
      });
      const activeList = list.filter((a) => a?.status !== 'superseded');
      const myApp = activeList[0] || list[0] || null;
      return {
        status: myApp ? myApp.status || 'pending' : 'none',
        mentorUnlocked: myApp?.status === 'approved',
        application: myApp,
        inCooldown: false,
        cooldownAvailableAt: null,
        cooldownDays: 14,
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
  {
    condition: (arg = {}, { getState }) => {
      if (!arg?.userId) return false;
      if (arg?.force === true) return true;
      const slice = getState()?.mentorApplications;
      if (!slice) return true;
      if (slice.myStatus === 'loading') return false;
      if (slice.myLastFetchedAt) {
        const parsed = Date.parse(slice.myLastFetchedAt);
        if (
          Number.isFinite(parsed) &&
          Date.now() - parsed < MENTOR_APPS_STALE_MS
        ) {
          return false;
        }
      }
      return true;
    },
  },
);

/**
 * Lists all mentor applications (`GET /mentor-applications`).
 */
export const fetchMentorApplications = createAsyncThunk(
  'mentorApplications/fetchMentorApplications',
  async (arg = {}, { rejectWithValue }) => {
    try {
      const { params, role } = arg || {};
      const res =
        role !== undefined
          ? await mentorApplicationsApi.list(params || {}, role)
          : params !== undefined
          ? await mentorApplicationsApi.list(params)
          : await mentorApplicationsApi.list();
      return Array.isArray(res) ? res : [];
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Fetches single mentor application by ID (`GET /mentor-applications/:id`).
 */
export const fetchMentorApplicationById = createAsyncThunk(
  'mentorApplications/fetchMentorApplicationById',
  async (arg, { rejectWithValue }) => {
    try {
      const opts = typeof arg === 'object' && arg !== null ? arg : { id: arg };
      const res =
        opts.role !== undefined
          ? await mentorApplicationsApi.get(String(opts.id), opts.role)
          : await mentorApplicationsApi.get(String(opts.id));
      return res || null;
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Submits a new mentor application (`POST /mentor-applications`).
 */
export const submitMentorApplication = createAsyncThunk(
  'mentorApplications/submitMentorApplication',
  async ({ payload, role, excludedCount = 0, verifiedCount = 0 }, { rejectWithValue }) => {
    try {
      const created =
        role !== undefined
          ? await mentorApplicationsApi.create(payload, role)
          : await mentorApplicationsApi.create(payload);
      return {
        application: created || null,
        excludedCount,
        verifiedCount,
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

export const updateMentorApplication = createAsyncThunk(
  'mentorApplications/updateMentorApplication',
  async ({ id, payload, role }, { rejectWithValue }) => {
    try {
      const updated =
        role !== undefined
          ? await mentorApplicationsApi.update(String(id), payload, role)
          : await mentorApplicationsApi.update(String(id), payload);
      return updated || null;
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

export const approveMentorApplication = createAsyncThunk(
  'mentorApplications/approveMentorApplication',
  async ({ id, payload = {}, role }, { rejectWithValue }) => {
    try {
      const updated =
        role !== undefined
          ? await mentorApplicationsApi.approve(String(id), payload, role)
          : await mentorApplicationsApi.approve(String(id), payload);
      return updated || { id: String(id), status: 'approved' };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

export const rejectMentorApplication = createAsyncThunk(
  'mentorApplications/rejectMentorApplication',
  async ({ id, payload = {}, role }, { rejectWithValue }) => {
    try {
      const updated =
        role !== undefined
          ? await mentorApplicationsApi.reject(String(id), payload, role)
          : await mentorApplicationsApi.reject(String(id), payload);
      return updated || { id: String(id), status: 'rejected' };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

export const deleteMentorApplication = createAsyncThunk(
  'mentorApplications/deleteMentorApplication',
  async (arg, { rejectWithValue }) => {
    try {
      const opts = typeof arg === 'object' && arg !== null ? arg : { id: arg };
      const id = String(opts.id);
      if (opts.role !== undefined) {
        await mentorApplicationsApi.remove(id, opts.role);
      } else {
        await mentorApplicationsApi.remove(id);
      }
      return { id };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

export const fetchDigiLockerStatus = createAsyncThunk(
  'mentorApplications/fetchDigiLockerStatus',
  async (arg = {}, { rejectWithValue }) => {
    try {
      if (typeof mentorApplicationsApi?.getDigiLockerStatus !== 'function') {
        return { mode: 'sandbox', available: true };
      }
      const res =
        arg?.role !== undefined
          ? await mentorApplicationsApi.getDigiLockerStatus(arg.role)
          : await mentorApplicationsApi.getDigiLockerStatus();
      return res || { mode: 'sandbox', available: true };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

export const pullDigiLockerDocuments = createAsyncThunk(
  'mentorApplications/pullDigiLockerDocuments',
  async ({ applicantName, role }, { rejectWithValue }) => {
    try {
      const res =
        role !== undefined
          ? await mentorApplicationsApi.pullDigiLockerDocuments(applicantName, role)
          : await mentorApplicationsApi.pullDigiLockerDocuments(applicantName);
      return Array.isArray(res?.documents) ? res.documents : [];
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

export const fetchMentorMinYearsConfig = createAsyncThunk(
  'mentorApplications/fetchMentorMinYearsConfig',
  async () => {
    try {
      if (typeof adminApi?.getPublicConfig !== 'function') return 5;
      const cfg = await adminApi.getPublicConfig();
      const tenure = cfg?.minimumTenure ?? cfg?.mentorMinYearsExperience;
      return tenure !== undefined ? Math.max(5, Number(tenure)) : 5;
    } catch {
      return 5;
    }
  },
);

export const uploadMentorCv = createAsyncThunk(
  'mentorApplications/uploadMentorCv',
  async (file, { rejectWithValue }) => {
    try {
      const res = await uploadsApi.uploadCv(file);
      return {
        filename: res.filename,
        originalName: res.originalName || file.name,
        size: res.size || file.size,
        url: res.url,
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Triggers CV download without putting non-serializable `Blob` into Redux state.
 */
export const downloadMentorCv = createAsyncThunk(
  'mentorApplications/downloadMentorCv',
  async ({ filename, originalName }, { rejectWithValue }) => {
    try {
      const blob = await uploadsApi.downloadCv(filename);
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = originalName || filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
      return { filename, downloaded: true };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);
