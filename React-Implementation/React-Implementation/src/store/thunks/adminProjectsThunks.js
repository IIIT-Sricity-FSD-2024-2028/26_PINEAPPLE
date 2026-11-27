import { createAsyncThunk } from '@reduxjs/toolkit';
import * as projectsApiModule from '../../services/projectsApi';
import * as adminApiModule from '../../services/adminApi';
import { resolveApiModule } from '../utils/apiModule';
import { normalizeThunkError } from '../utils/thunkError';

/**
 * Fetches active & deleted project lists for Admin Projects table (`GET /projects?status=all|deleted`).
 */
export const fetchAdminProjects = createAsyncThunk(
  'adminProjects/fetchAdminProjects',
  async (_arg, { rejectWithValue }) => {
    try {
      const projectsApi = resolveApiModule(projectsApiModule, 'projectsApi');
      const [activeRes, deletedRes] = await Promise.all([
        Promise.resolve(projectsApi.list({ status: 'all' })).catch(() => []),
        Promise.resolve(projectsApi.list({ status: 'deleted' })).catch(() => []),
      ]);
      const activeList = Array.isArray(activeRes) ? activeRes : [];
      const deletedList = Array.isArray(deletedRes) ? deletedRes : [];
      const byId = new Map();
      for (const p of [...activeList, ...deletedList]) {
        if (p && (p.id || p._id)) {
          byId.set(String(p.id || p._id), p);
        }
      }
      return Array.from(byId.values());
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Fetches full admin project details (`GET /projects/:id`) + project escrow summary
 * (`GET /admin/projects/:id/escrow`).
 */
export const fetchAdminProjectDetails = createAsyncThunk(
  'adminProjects/fetchAdminProjectDetails',
  async (projectId, { rejectWithValue }) => {
    try {
      const projectsApi = resolveApiModule(projectsApiModule, 'projectsApi');
      const adminApi = resolveApiModule(adminApiModule, 'adminApi');
      const pid = String(projectId);

      const [projectData, escrowData] = await Promise.all([
        projectsApi.get(pid),
        typeof adminApi?.getProjectEscrow === 'function'
          ? adminApi.getProjectEscrow(pid).catch(() => null)
          : Promise.resolve(null),
      ]);

      return {
        projectId: pid,
        project: projectData || null,
        escrowSummary: escrowData || null,
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Fetches project-scoped escrow summary (`GET /admin/projects/:id/escrow`).
 */
export const fetchAdminProjectEscrow = createAsyncThunk(
  'adminProjects/fetchAdminProjectEscrow',
  async (projectId, { rejectWithValue }) => {
    try {
      const adminApi = resolveApiModule(adminApiModule, 'adminApi');
      const pid = String(projectId);
      if (typeof adminApi?.getProjectEscrow !== 'function') {
        return { projectId: pid, summary: null };
      }
      const res = await adminApi.getProjectEscrow(pid);
      return { projectId: pid, summary: res || null };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Restores a soft-deleted project (`POST /admin/projects/:id/restore` / `projectsApi.restore`).
 */
export const restoreAdminProject = createAsyncThunk(
  'adminProjects/restoreAdminProject',
  async (projectId, { dispatch, rejectWithValue }) => {
    try {
      const projectsApi = resolveApiModule(projectsApiModule, 'projectsApi');
      const pid = String(projectId);
      const res = await projectsApi.restore(pid);
      dispatch(fetchAdminProjects()).catch(() => null);
      return {
        projectId: pid,
        project: res?.project || null,
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Cancels scheduled deletion for a project (`POST /projects/:id/cancel-deletion`).
 */
export const cancelAdminProjectDeletion = createAsyncThunk(
  'adminProjects/cancelAdminProjectDeletion',
  async (projectId, { rejectWithValue }) => {
    try {
      const projectsApi = resolveApiModule(projectsApiModule, 'projectsApi');
      const pid = String(projectId);
      const res = await projectsApi.cancelDeletion(pid);
      if (res?.project) {
        return { projectId: pid, project: res.project };
      }
      const fresh = await projectsApi.get(pid).catch(() => null);
      return { projectId: pid, project: fresh };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Admin-closes a project (`POST /admin/projects/:id/close`).
 */
export const closeAdminProject = createAsyncThunk(
  'adminProjects/closeAdminProject',
  async ({ projectId, reason = 'Owner inactive' }, { rejectWithValue }) => {
    try {
      const projectsApi = resolveApiModule(projectsApiModule, 'projectsApi');
      const pid = String(projectId);
      const updated = await projectsApi.close(pid, reason);
      return { projectId: pid, project: updated || null };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);
