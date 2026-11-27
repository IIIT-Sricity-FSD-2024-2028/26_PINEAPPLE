import { createAsyncThunk } from '@reduxjs/toolkit';
import tasksApi from '../../services/tasksApi';
import { normalizeThunkError } from '../utils/thunkError';
import { fetchProjectById } from './projectsThunks';

export const TASKS_STALE_MS = 30 * 1000;

/**
 * Fetches ordered tasks for a project (`GET /tasks/project/:projectId`).
 */
export const fetchTasksByProject = createAsyncThunk(
  'tasks/fetchTasksByProject',
  async (arg, { rejectWithValue }) => {
    try {
      const { projectId, role } =
        typeof arg === 'object' && arg !== null ? arg : { projectId: arg };
      const pid = String(projectId);
      const data =
        role !== undefined
          ? await tasksApi.list({ projectId: pid }, role)
          : await tasksApi.list({ projectId: pid });
      const items = Array.isArray(data)
        ? data
        : Array.isArray(data?.data)
          ? data.data
          : [];
      return { projectId: pid, items };
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
      const slice = getState()?.tasks;
      if (!slice) return true;
      if (slice.byProjectStatus?.[pid] === 'loading') return false;
      const ts = slice.byProjectLastFetchedAt?.[pid];
      if (ts) {
        const parsed = Date.parse(ts);
        if (Number.isFinite(parsed) && Date.now() - parsed < TASKS_STALE_MS) {
          return false;
        }
      }
      return true;
    },
  },
);

/**
 * Fetches tasks across multiple projects (`GET /tasks/project/:pid` fan-out).
 */
export const fetchTasksForProjects = createAsyncThunk(
  'tasks/fetchTasksForProjects',
  async (arg = {}, { rejectWithValue }) => {
    try {
      const opts = Array.isArray(arg) ? { projectIds: arg } : arg || {};
      const ids = Array.isArray(opts.projectIds)
        ? opts.projectIds.filter(Boolean).map(String)
        : [];
      if (ids.length === 0) return { projectIds: [], items: [] };
      const data =
        opts.role !== undefined
          ? await tasksApi.listForProjects(ids, opts.role)
          : await tasksApi.listForProjects(ids);
      const items = Array.isArray(data) ? data : [];
      return { projectIds: ids, items };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
  {
    condition: (arg, { getState }) => {
      const opts = Array.isArray(arg) ? { projectIds: arg } : arg || {};
      const ids = Array.isArray(opts.projectIds)
        ? opts.projectIds.filter(Boolean).map(String)
        : [];
      if (ids.length === 0) return false;
      if (opts.force === true) return true;
      const slice = getState()?.tasks;
      if (!slice) return true;
      if (slice.multiStatus === 'loading') return false;
      return true;
    },
  },
);

/**
 * Fetches a single task detail (`GET /tasks/:id`).
 */
export const fetchTaskById = createAsyncThunk(
  'tasks/fetchTaskById',
  async (arg, { rejectWithValue }) => {
    try {
      const opts =
        typeof arg === 'object' && arg !== null ? arg : { id: arg };
      const data =
        opts.role !== undefined
          ? await tasksApi.get(opts.id, opts.role)
          : await tasksApi.get(opts.id);
      return data;
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Creates a task (`POST /tasks`).
 */
export const createTask = createAsyncThunk(
  'tasks/createTask',
  async (arg, { rejectWithValue }) => {
    try {
      const hasEnvelope =
        arg && typeof arg === 'object' && Object.prototype.hasOwnProperty.call(arg, 'payload');
      const payload = hasEnvelope ? arg.payload : arg;
      const role = hasEnvelope ? arg.role : undefined;
      const created =
        role !== undefined
          ? await tasksApi.create(payload, role)
          : await tasksApi.create(payload);
      return created;
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Updates a task's fields or assignment (`PATCH /tasks/:id`).
 */
export const updateTask = createAsyncThunk(
  'tasks/updateTask',
  async ({ id, payload, role }, { rejectWithValue }) => {
    try {
      const updated =
        role !== undefined
          ? await tasksApi.update(id, payload, role)
          : await tasksApi.update(id, payload);
      return { id: String(id), payload, task: updated };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Transitions task status (`PATCH /tasks/:id/status`), with optional optimistic update & rollback.
 */
export const updateTaskStatus = createAsyncThunk(
  'tasks/updateTaskStatus',
  async ({ id, payload, clearRejection = false, role }, { rejectWithValue }) => {
    try {
      const updated =
        role !== undefined
          ? await tasksApi.updateStatus(id, payload, role)
          : await tasksApi.updateStatus(id, payload);
      return {
        id: String(id),
        payload,
        clearRejection,
        task: updated,
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Reviews a submitted task (`POST /tasks/:id/review`) — approve, reject, or send back.
 * When `extendedProjectDueDate` is returned/sent, cascades a forced project refetch.
 */
export const reviewTask = createAsyncThunk(
  'tasks/reviewTask',
  async (
    { id, payload, projectId, cascadeProject = false, role },
    { dispatch, getState, rejectWithValue },
  ) => {
    try {
      let updated;
      if (typeof tasksApi.review === 'function') {
        updated =
          role !== undefined
            ? await tasksApi.review(id, payload, role)
            : await tasksApi.review(id, payload);
      } else {
        const fallbackStatus =
          payload?.decision === 'approve' ? 'Completed' : 'Open';
        const fallbackPayload = { status: fallbackStatus, ...payload };
        updated =
          role !== undefined
            ? await tasksApi.updateStatus(id, fallbackPayload, role)
            : await tasksApi.updateStatus(id, fallbackPayload);
      }

      const existing = getState()?.tasks?.entities?.[String(id)];
      const targetProjectId =
        projectId || updated?.projectId || existing?.projectId;

      if (
        targetProjectId &&
        (cascadeProject ||
          Boolean(payload?.extendedProjectDueDate) ||
          Boolean(updated?.extendedProjectDueDate))
      ) {
        await dispatch(
          fetchProjectById({ id: targetProjectId, force: true }),
        ).catch(() => {});
      }

      return { id: String(id), payload, task: updated };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Drops or unassigns a task with structured feedback (`POST /tasks/:id/unassign`).
 */
export const unassignTask = createAsyncThunk(
  'tasks/unassignTask',
  async ({ id, payload = {}, role }, { rejectWithValue }) => {
    try {
      let updated;
      if (typeof tasksApi.unassign === 'function') {
        updated =
          role !== undefined
            ? await tasksApi.unassign(id, payload, role)
            : await tasksApi.unassign(id, payload);
      } else {
        const fallbackPayload = {
          assigneeId: '',
          assigneeName: 'Unassigned',
          assignee: 'Unassigned',
          ...payload,
        };
        updated =
          role !== undefined
            ? await tasksApi.update(id, fallbackPayload, role)
            : await tasksApi.update(id, fallbackPayload);
      }
      return { id: String(id), payload, task: updated };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Adds a comment to a task (`POST /tasks/:id/comments`).
 */
export const addTaskComment = createAsyncThunk(
  'tasks/addTaskComment',
  async ({ id, payload, role }, { rejectWithValue }) => {
    try {
      const updated =
        role !== undefined
          ? await tasksApi.addComment(id, payload, role)
          : await tasksApi.addComment(id, payload);
      return { id: String(id), commentResult: updated };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Deletes a task (`DELETE /tasks/:id`).
 */
export const deleteTask = createAsyncThunk(
  'tasks/deleteTask',
  async ({ id, projectId, role }, { rejectWithValue }) => {
    try {
      if (role !== undefined) {
        await tasksApi.remove(id, role);
      } else {
        await tasksApi.remove(id);
      }
      return { id: String(id), projectId: projectId ? String(projectId) : null };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);
