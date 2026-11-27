import { createAsyncThunk } from '@reduxjs/toolkit';
import projectsApi from '../../services/projectsApi';
import { normalizeThunkError } from '../utils/thunkError';
import { fetchMyProjects, fetchProjectById, fetchProjects } from './projectsThunks';

export const INVITES_STALE_MS = 30 * 1000;

/**
 * Lists invites sent for a project (`GET /projects/:id/invites`).
 */
export const fetchProjectInvites = createAsyncThunk(
  'projectInvites/fetchProjectInvites',
  async (arg, { rejectWithValue }) => {
    try {
      const projectId = String(typeof arg === 'object' ? arg?.projectId : arg);
      const role = typeof arg === 'object' ? arg?.role : undefined;
      if (typeof projectsApi.listInvites !== 'function') {
        return { projectId, items: [] };
      }
      const res =
        role !== undefined
          ? await projectsApi.listInvites(projectId, role)
          : await projectsApi.listInvites(projectId);
      const items = Array.isArray(res)
        ? res
        : Array.isArray(res?.invites)
          ? res.invites
          : [];
      return { projectId, items };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
  {
    condition: (arg, { getState }) => {
      const opts = typeof arg === 'object' && arg !== null ? arg : { projectId: arg };
      const pid = opts.projectId ? String(opts.projectId) : '';
      if (!pid) return false;
      if (opts.force === true) return true;
      const slice = getState()?.projectInvites;
      if (!slice) return true;
      if (slice.byProjectStatus?.[pid] === 'loading') return false;
      const ts = slice.byProjectLastFetchedAt?.[pid];
      if (ts) {
        const parsed = Date.parse(ts);
        if (Number.isFinite(parsed) && Date.now() - parsed < INVITES_STALE_MS) {
          return false;
        }
      }
      return true;
    },
  },
);

/**
 * Lists current user's pending/historical project invitations (`GET /users/me/invites`).
 */
export const fetchMyInvites = createAsyncThunk(
  'projectInvites/fetchMyInvites',
  async (arg = {}, { rejectWithValue }) => {
    try {
      const opts = arg && typeof arg === 'object' ? arg : {};
      if (typeof projectsApi.getMyInvites !== 'function') {
        return [];
      }
      let res;
      if (opts.userId !== undefined) {
        res = await projectsApi.getMyInvites(opts.role, opts.userId);
      } else if (opts.role !== undefined) {
        res = await projectsApi.getMyInvites(opts.role);
      } else {
        res = await projectsApi.getMyInvites();
      }
      return Array.isArray(res)
        ? res
        : Array.isArray(res?.invites)
          ? res.invites
          : Array.isArray(res?.data)
            ? res.data
            : [];
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
  {
    condition: (arg = {}, { getState }) => {
      const opts = arg && typeof arg === 'object' ? arg : {};
      if (opts.force === true) return true;
      const slice = getState()?.projectInvites;
      if (!slice) return true;
      if (slice.myStatus === 'loading') return false;
      if (slice.myLastFetchedAt) {
        const parsed = Date.parse(slice.myLastFetchedAt);
        if (Number.isFinite(parsed) && Date.now() - parsed < INVITES_STALE_MS) {
          return false;
        }
      }
      return true;
    },
  },
);

/**
 * Sends a direct project invitation by username (`POST /projects/:id/invites`).
 */
export const sendProjectInvite = createAsyncThunk(
  'projectInvites/sendProjectInvite',
  async ({ projectId, username, role }, { dispatch, rejectWithValue }) => {
    try {
      const invite =
        role !== undefined
          ? await projectsApi.sendInvite(projectId, username, role)
          : await projectsApi.sendInvite(projectId, username);
      if (projectId && typeof projectsApi.get === 'function') {
        dispatch(fetchProjectById({ id: projectId, force: true })).catch(() => {});
      }
      return { projectId: String(projectId), invite };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Owner cancels a pending project invitation (`DELETE /projects/:id/invites/:inviteId`).
 */
export const cancelProjectInvite = createAsyncThunk(
  'projectInvites/cancelProjectInvite',
  async ({ projectId, inviteId, payload, role }, { dispatch, rejectWithValue }) => {
    try {
      let res;
      if (role !== undefined && payload !== undefined) {
        res = await projectsApi.cancelInvite(projectId, inviteId, payload, role);
      } else if (payload !== undefined) {
        res = await projectsApi.cancelInvite(projectId, inviteId, payload);
      } else if (role !== undefined) {
        res = await projectsApi.cancelInvite(projectId, inviteId, role);
      } else {
        res = await projectsApi.cancelInvite(projectId, inviteId);
      }
      if (projectId && typeof projectsApi.get === 'function') {
        dispatch(fetchProjectById({ id: projectId, force: true })).catch(() => {});
      }
      return {
        projectId: String(projectId),
        inviteId: String(inviteId),
        res: res || {},
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Invited user accepts an invitation (`POST /invites/:id/accept`).
 * Refreshes marketplace / myProjects pending counts when projects API exists.
 */
export const acceptProjectInvite = createAsyncThunk(
  'projectInvites/acceptProjectInvite',
  async ({ inviteId, projectId, role }, { dispatch, getState, rejectWithValue }) => {
    try {
      const res =
        role !== undefined
          ? await projectsApi.acceptInvite(inviteId, role)
          : await projectsApi.acceptInvite(inviteId);
      const state = getState();
      const targetProjectId =
        projectId ||
        res?.projectId ||
        state?.projectInvites?.entities?.[String(inviteId)]?.projectId;

      if (typeof projectsApi.getMyInvites === 'function') {
        dispatch(fetchMyInvites({ force: true })).catch(() => {});
      }
      if (typeof projectsApi.list === 'function' && state?.projects?.marketplaceIds?.length > 0) {
        dispatch(fetchProjects({ view: 'marketplace', force: true })).catch(() => {});
      }
      if (targetProjectId && typeof projectsApi.get === 'function') {
        dispatch(fetchProjectById({ id: targetProjectId, force: true })).catch(() => {});
      }

      return {
        inviteId: String(inviteId),
        projectId: targetProjectId ? String(targetProjectId) : null,
        res: res || {},
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
  {
    condition: (arg, { getState }) => {
      const id = arg?.inviteId ? String(arg.inviteId) : '';
      if (!id) return false;
      return !getState()?.projectInvites?.actingIds?.[id];
    },
  },
);

/**
 * Invited user declines an invitation (`POST /invites/:id/decline`).
 */
export const declineProjectInvite = createAsyncThunk(
  'projectInvites/declineProjectInvite',
  async ({ inviteId, payload = false, role }, { dispatch, getState, rejectWithValue }) => {
    try {
      const res =
        role !== undefined
          ? await projectsApi.declineInvite(inviteId, payload, role)
          : await projectsApi.declineInvite(inviteId, payload);
      const state = getState();
      if (typeof projectsApi.getMyInvites === 'function') {
        dispatch(fetchMyInvites({ force: true })).catch(() => {});
      }
      if (typeof projectsApi.list === 'function' && state?.projects?.myProjectIds?.length > 0) {
        dispatch(fetchMyProjects({ force: true })).catch(() => {});
      }
      return {
        inviteId: String(inviteId),
        res: res || {},
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
  {
    condition: (arg, { getState }) => {
      const id = arg?.inviteId ? String(arg.inviteId) : '';
      if (!id) return false;
      return !getState()?.projectInvites?.actingIds?.[id];
    },
  },
);
