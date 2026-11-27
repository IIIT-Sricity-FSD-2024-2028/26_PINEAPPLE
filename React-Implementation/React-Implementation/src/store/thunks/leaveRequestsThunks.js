import { createAsyncThunk } from '@reduxjs/toolkit';
import projectsApi from '../../services/projectsApi';
import { normalizeThunkError } from '../utils/thunkError';
import { fetchProjectById } from './projectsThunks';
import { fetchTasksByProject } from './tasksThunks';

export const LEAVE_REQUESTS_STALE_MS = 30 * 1000;

/**
 * Lists leave requests for a project (`GET /projects/:id/leave-requests`).
 */
export const fetchProjectLeaveRequests = createAsyncThunk(
  'leaveRequests/fetchProjectLeaveRequests',
  async (arg, { rejectWithValue }) => {
    try {
      const projectId = String(typeof arg === 'object' ? arg?.projectId : arg);
      const role = typeof arg === 'object' ? arg?.role : undefined;
      if (typeof projectsApi.listLeaveRequests !== 'function') {
        return { projectId, items: [] };
      }
      const res =
        role !== undefined
          ? await projectsApi.listLeaveRequests(projectId, role)
          : await projectsApi.listLeaveRequests(projectId);
      const items = Array.isArray(res) ? res : [];
      return { projectId, items };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
  {
    condition: (arg, { getState }) => {
      const opts =
        typeof arg === 'object' && arg !== null ? arg : { projectId: arg };
      const pid = opts.projectId ? String(opts.projectId) : '';
      if (!pid) return false;
      if (opts.force === true) return true;
      const slice = getState()?.leaveRequests;
      if (!slice) return true;
      if (slice.byProjectStatus?.[pid] === 'loading') return false;
      const ts = slice.byProjectLastFetchedAt?.[pid];
      if (ts) {
        const parsed = Date.parse(ts);
        if (
          Number.isFinite(parsed) &&
          Date.now() - parsed < LEAVE_REQUESTS_STALE_MS
        ) {
          return false;
        }
      }
      return true;
    },
  },
);

/**
 * Fetches caller's pending leave request for a project (`GET /projects/:id/leave-requests/mine`).
 */
export const fetchMyLeaveRequest = createAsyncThunk(
  'leaveRequests/fetchMyLeaveRequest',
  async (arg, { rejectWithValue }) => {
    const projectId = String(
      typeof arg === 'object' ? (arg?.projectId ?? arg?.id) : arg,
    );
    const role = typeof arg === 'object' ? arg?.role : undefined;
    const userId = typeof arg === 'object' ? arg?.userId : undefined;
    try {
      if (typeof projectsApi.getMyLeaveRequest !== 'function') {
        return { projectId, leaveRequest: null };
      }
      let res;
      if (userId !== undefined) {
        res = await projectsApi.getMyLeaveRequest(projectId, role, userId);
      } else if (role !== undefined) {
        res = await projectsApi.getMyLeaveRequest(projectId, role);
      } else {
        res = await projectsApi.getMyLeaveRequest(projectId);
      }
      return {
        projectId,
        leaveRequest: res && res.status === 'pending' ? res : null,
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Collaborator submits a leave request (`POST /projects/:id/leave-requests`).
 */
export const createLeaveRequest = createAsyncThunk(
  'leaveRequests/createLeaveRequest',
  async ({ projectId, payload, role, userId }, { rejectWithValue }) => {
    try {
      let res;
      if (userId !== undefined) {
        res = await projectsApi.submitLeaveRequest(
          projectId,
          payload,
          role,
          userId,
        );
      } else if (role !== undefined) {
        res = await projectsApi.submitLeaveRequest(projectId, payload, role);
      } else {
        res = await projectsApi.submitLeaveRequest(projectId, payload);
      }
      return { projectId: String(projectId), leaveRequest: res };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Collaborator withdraws their pending leave request (`DELETE /projects/:id/leave-requests/mine`).
 */
export const withdrawLeaveRequest = createAsyncThunk(
  'leaveRequests/withdrawLeaveRequest',
  async ({ projectId, role, userId }, { rejectWithValue }) => {
    try {
      if (userId !== undefined) {
        await projectsApi.withdrawLeaveRequest(projectId, role, userId);
      } else if (role !== undefined) {
        await projectsApi.withdrawLeaveRequest(projectId, role);
      } else {
        await projectsApi.withdrawLeaveRequest(projectId);
      }
      return { projectId: String(projectId) };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Owner approves a leave request (`POST /projects/:id/leave-requests/:requestId/approve`).
 */
export const approveLeaveRequest = createAsyncThunk(
  'leaveRequests/approveLeaveRequest',
  async ({ requestId, projectId, role }, { dispatch, rejectWithValue }) => {
    try {
      const res =
        role !== undefined
          ? await projectsApi.approveLeaveRequest(requestId, projectId, role)
          : await projectsApi.approveLeaveRequest(requestId, projectId);

      if (projectId) {
        await Promise.all([
          dispatch(fetchProjectById({ id: projectId, force: true }))
            .unwrap()
            .catch(() => null),
          dispatch(fetchTasksByProject({ projectId, force: true }))
            .unwrap()
            .catch(() => []),
        ]);
      }

      return {
        requestId: String(requestId),
        projectId: projectId ? String(projectId) : null,
        res: res || {},
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
  {
    condition: (arg, { getState }) => {
      const id = arg?.requestId ? String(arg.requestId) : '';
      if (!id) return false;
      return !getState()?.leaveRequests?.processingIds?.[id];
    },
  },
);

/**
 * Owner rejects a leave request (`POST /projects/:id/leave-requests/:requestId/reject`).
 */
export const rejectLeaveRequest = createAsyncThunk(
  'leaveRequests/rejectLeaveRequest',
  async ({ requestId, payload, projectId, role }, { rejectWithValue }) => {
    try {
      const res =
        role !== undefined
          ? await projectsApi.rejectLeaveRequest(
              requestId,
              payload,
              projectId,
              role,
            )
          : await projectsApi.rejectLeaveRequest(requestId, payload, projectId);
      return {
        requestId: String(requestId),
        projectId: projectId ? String(projectId) : null,
        res: res || {},
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
  {
    condition: (arg, { getState }) => {
      const id = arg?.requestId ? String(arg.requestId) : '';
      if (!id) return false;
      return !getState()?.leaveRequests?.processingIds?.[id];
    },
  },
);
