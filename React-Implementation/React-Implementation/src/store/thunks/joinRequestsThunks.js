import { createAsyncThunk } from '@reduxjs/toolkit';
import joinRequestsApi from '../../services/joinRequestsApi';
import { normalizeThunkError } from '../utils/thunkError';
import { fetchProjectById } from './projectsThunks';

export const JOIN_REQUESTS_STALE_MS = 30 * 1000;

/**
 * Fetches join requests (`GET /join-requests`).
 * When `projectId` is given, returns the server's combined applications + invitations list (and optional `counts`).
 */
export const fetchJoinRequests = createAsyncThunk(
  'joinRequests/fetchJoinRequests',
  async (arg = {}, { rejectWithValue }) => {
    try {
      const opts = arg && typeof arg === 'object' ? arg : {};
      const params = {};
      if (opts.projectId) params.projectId = String(opts.projectId);
      if (opts.userId) params.userId = String(opts.userId);
      if (opts.status) params.status = String(opts.status);

      const hasParams = Object.keys(params).length > 0;
      let res;
      if (opts.role !== undefined && hasParams) {
        res = await joinRequestsApi.list(params, opts.role);
      } else if (hasParams) {
        res = await joinRequestsApi.list(params);
      } else if (opts.role !== undefined) {
        res = await joinRequestsApi.list(undefined, opts.role);
      } else {
        res = await joinRequestsApi.list();
      }

      const isCombinedObj =
        res && !Array.isArray(res) && Array.isArray(res.items);
      const items = isCombinedObj
        ? res.items
        : Array.isArray(res)
          ? res
          : Array.isArray(res?.data)
            ? res.data
            : [];
      const counts = isCombinedObj && res.counts ? res.counts : null;

      return {
        projectId: opts.projectId ? String(opts.projectId) : null,
        userId: opts.userId ? String(opts.userId) : null,
        items,
        counts,
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
  {
    condition: (arg = {}, { getState }) => {
      const opts = arg && typeof arg === 'object' ? arg : {};
      if (opts.force === true) return true;
      const slice = getState()?.joinRequests;
      if (!slice) return true;
      const pid = opts.projectId ? String(opts.projectId) : null;
      if (pid) {
        if (slice.byProjectStatus?.[pid] === 'loading') return false;
        const ts = slice.byProjectLastFetchedAt?.[pid];
        if (ts) {
          const parsed = Date.parse(ts);
          if (
            Number.isFinite(parsed) &&
            Date.now() - parsed < JOIN_REQUESTS_STALE_MS
          ) {
            return false;
          }
        }
        return true;
      }
      if (slice.status === 'loading') return false;
      return true;
    },
  },
);

/**
 * Fetches current user's applications (`GET /join-requests/mine`), with `/join-requests?userId=` fallback.
 */
export const fetchMyJoinRequests = createAsyncThunk(
  'joinRequests/fetchMyJoinRequests',
  async (arg = {}, { rejectWithValue }) => {
    try {
      const opts = arg && typeof arg === 'object' ? arg : {};
      let res;
      if (typeof joinRequestsApi.getMyRequests === 'function') {
        try {
          res =
            opts.role !== undefined
              ? await joinRequestsApi.getMyRequests(opts.role)
              : await joinRequestsApi.getMyRequests();
        } catch {
          if (opts.userId && typeof joinRequestsApi.list === 'function') {
            res =
              opts.role !== undefined
                ? await joinRequestsApi.list({ userId: opts.userId }, opts.role)
                : await joinRequestsApi.list({ userId: opts.userId });
          } else {
            res = [];
          }
        }
      } else if (opts.userId && typeof joinRequestsApi.list === 'function') {
        res = await joinRequestsApi.list({ userId: opts.userId });
      } else {
        res = [];
      }

      const items = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
          ? res.data
          : [];
      return items;
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
  {
    condition: (arg = {}, { getState }) => {
      const opts = arg && typeof arg === 'object' ? arg : {};
      if (opts.force === true) return true;
      const slice = getState()?.joinRequests;
      if (!slice) return true;
      if (slice.myStatus === 'loading') return false;
      if (slice.myLastFetchedAt) {
        const parsed = Date.parse(slice.myLastFetchedAt);
        if (
          Number.isFinite(parsed) &&
          Date.now() - parsed < JOIN_REQUESTS_STALE_MS
        ) {
          return false;
        }
      }
      return true;
    },
  },
);

/**
 * Fetches single join request detail (`GET /join-requests/:id`).
 */
export const fetchJoinRequestById = createAsyncThunk(
  'joinRequests/fetchJoinRequestById',
  async (arg, { rejectWithValue }) => {
    try {
      const id = typeof arg === 'object' ? arg?.id : arg;
      const role = typeof arg === 'object' ? arg?.role : undefined;
      return role !== undefined
        ? await joinRequestsApi.get(id, role)
        : await joinRequestsApi.get(id);
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Submits a join request (`POST /join-requests`).
 */
export const createJoinRequest = createAsyncThunk(
  'joinRequests/createJoinRequest',
  async (arg, { rejectWithValue }) => {
    try {
      const hasEnvelope =
        arg &&
        typeof arg === 'object' &&
        Object.prototype.hasOwnProperty.call(arg, 'payload');
      const payload = hasEnvelope ? arg.payload : arg;
      const role = hasEnvelope ? arg.role : undefined;
      const created =
        role !== undefined
          ? await joinRequestsApi.create(payload, role)
          : await joinRequestsApi.create(payload);
      return {
        request: created || {
          ...payload,
          id: `temp-${Date.now()}`,
          status: 'Pending',
        },
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Updates a join request (`PATCH /join-requests/:id`).
 */
export const updateJoinRequest = createAsyncThunk(
  'joinRequests/updateJoinRequest',
  async ({ id, payload, role }, { rejectWithValue }) => {
    try {
      const updated =
        role !== undefined
          ? await joinRequestsApi.update(id, payload, role)
          : await joinRequestsApi.update(id, payload);
      return { id: String(id), payload, request: updated };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Approves or rejects a join request (`PATCH /join-requests/:id`).
 * Guarded by `respondingIds[id]` so double clicks send only one request.
 */
export const respondJoinRequest = createAsyncThunk(
  'joinRequests/respondJoinRequest',
  async (
    { id, status, reasonOrRole, role, projectId, refreshProject = true },
    { dispatch, getState, rejectWithValue },
  ) => {
    try {
      let updated;
      if (role !== undefined) {
        updated = await joinRequestsApi.respond(id, status, reasonOrRole, role);
      } else if (reasonOrRole !== undefined) {
        updated = await joinRequestsApi.respond(id, status, reasonOrRole);
      } else {
        updated = await joinRequestsApi.respond(id, status);
      }

      const existing = getState()?.joinRequests?.entities?.[String(id)];
      const targetProjectId =
        projectId || updated?.projectId || existing?.projectId;
      const statusLower = String(status || '').toLowerCase();

      if (
        refreshProject &&
        targetProjectId &&
        (statusLower === 'approved' || statusLower === 'accepted')
      ) {
        dispatch(fetchProjectById({ id: targetProjectId, force: true })).catch(
          () => {},
        );
      }

      return {
        id: String(id),
        status: updated?.status || status,
        reason:
          updated?.rejectionReason ||
          (typeof reasonOrRole === 'object' ? reasonOrRole?.reason : undefined),
        projectId: targetProjectId ? String(targetProjectId) : null,
        request: updated,
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
  {
    condition: (arg, { getState }) => {
      const id = arg?.id ? String(arg.id) : '';
      if (!id) return false;
      const respondingIds = getState()?.joinRequests?.respondingIds;
      if (respondingIds && respondingIds[id]) return false;
      return true;
    },
  },
);

/**
 * Withdraws/deletes a join request (`DELETE /join-requests/:id`).
 */
export const deleteJoinRequest = createAsyncThunk(
  'joinRequests/deleteJoinRequest',
  async ({ id, payload, projectId, role }, { rejectWithValue }) => {
    try {
      let res;
      if (role !== undefined && payload !== undefined) {
        res = await joinRequestsApi.remove(id, payload, role);
      } else if (payload !== undefined) {
        res = await joinRequestsApi.remove(id, payload);
      } else if (role !== undefined) {
        res = await joinRequestsApi.remove(id, role);
      } else {
        res = await joinRequestsApi.remove(id);
      }
      return {
        id: String(id),
        projectId: projectId ? String(projectId) : null,
        res: res || {},
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);
