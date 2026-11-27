import { createAsyncThunk } from '@reduxjs/toolkit';
import projectsApi from '../../services/projectsApi';
import { normalizeThunkError } from '../utils/thunkError';

export const PROJECTS_STALE_MS = 60 * 1000;

function safeInvokeList(params, role) {
  const hasParams = params && Object.keys(params).length > 0;
  if (role !== undefined && hasParams) return projectsApi.list(params, role);
  if (hasParams) return projectsApi.list(params);
  if (role !== undefined) return projectsApi.list(undefined, role);
  return projectsApi.list();
}

function safeInvokeGet(id, role) {
  return role !== undefined ? projectsApi.get(id, role) : projectsApi.get(id);
}

/**
 * Fetches marketplace / general projects list (`GET /projects`).
 * Skips when already loading or fresh within `PROJECTS_STALE_MS` unless `{ force: true }`.
 */
export const fetchProjects = createAsyncThunk(
  'projects/fetchProjects',
  async (arg = {}, { rejectWithValue }) => {
    try {
      const { params, role, view = 'marketplace' } =
        arg && typeof arg === 'object' ? arg : {};
      const res = await safeInvokeList(params, role);
      const items = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
          ? res.data
          : [];
      return { items, view };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
  {
    condition: (arg = {}, { getState }) => {
      const opts = arg && typeof arg === 'object' ? arg : {};
      if (opts.force === true) return true;
      const slice = getState()?.projects;
      if (!slice) return true;
      if (slice.status === 'loading') return false;
      const view = opts.view || 'marketplace';
      const ts = slice.viewLastFetchedAt?.[view];
      if (ts) {
        const parsed = Date.parse(ts);
        if (Number.isFinite(parsed) && Date.now() - parsed < PROJECTS_STALE_MS) {
          return false;
        }
      }
      return true;
    },
  },
);

/**
 * Fetches projects owned by the current user (`GET /projects?status=all` filtered
 * by owner identity) and stores `myProjectIds` + server summary counts.
 */
export const fetchMyProjects = createAsyncThunk(
  'projects/fetchMyProjects',
  async (arg = {}, { rejectWithValue }) => {
    try {
      const { ownerId, ownerName = '', role } =
        arg && typeof arg === 'object' ? arg : {};
      const allProjects = await safeInvokeList({ status: 'all' }, role);
      const list = Array.isArray(allProjects)
        ? allProjects
        : Array.isArray(allProjects?.data)
          ? allProjects.data
          : [];
      const owned =
        ownerId || ownerName
          ? list.filter(
              (p) =>
                (ownerId && String(p.ownerId) === String(ownerId)) ||
                (ownerName && p.owner === ownerName),
            )
          : list;
      return { items: owned };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
  {
    condition: (arg = {}, { getState }) => {
      const opts = arg && typeof arg === 'object' ? arg : {};
      if (opts.force === true) return true;
      const slice = getState()?.projects;
      if (!slice) return true;
      if (slice.myProjectsStatus === 'loading') return false;
      const ts = slice.viewLastFetchedAt?.myProjects;
      if (ts) {
        const parsed = Date.parse(ts);
        if (Number.isFinite(parsed) && Date.now() - parsed < PROJECTS_STALE_MS) {
          return false;
        }
      }
      return true;
    },
  },
);

/**
 * Fetches collaborator ongoing and completed work (`GET /projects/collaborator/:userId`).
 * Preserves server-computed `ongoing`, `completed`, `ongoingCount`, and `completedCount`.
 */
export const fetchMyWork = createAsyncThunk(
  'projects/fetchMyWork',
  async (arg = {}, { rejectWithValue }) => {
    try {
      const { userId, userName = '', role } =
        arg && typeof arg === 'object' ? arg : {};
      let res;
      try {
        res =
          role !== undefined
            ? await projectsApi.getMyWork(userId, role)
            : await projectsApi.getMyWork(userId);
      } catch {
        const allProjects = await safeInvokeList({ status: 'all' }, role);
        const collabs = (Array.isArray(allProjects) ? allProjects : []).filter(
          (p) => {
            const isOwner = p.owner === userName || p.ownerId === userId;
            if (isOwner) return false;
            return (
              Array.isArray(p.collaborators) &&
              p.collaborators.some(
                (c) =>
                  c === userId ||
                  c === userName ||
                  (typeof c === 'object' &&
                    (c.id === userId || c.name === userName)),
              )
            );
          },
        );
        const ongoingFallback = collabs.filter(
          (p) =>
            String(p.status || '').toLowerCase() !== 'completed' &&
            String(p.status || '').toLowerCase() !== 'closed' &&
            !p.isCompleted,
        );
        const completedFallback = collabs.filter(
          (p) =>
            String(p.status || '').toLowerCase() === 'completed' ||
            String(p.status || '').toLowerCase() === 'closed' ||
            p.isCompleted,
        );
        res = {
          ongoing: ongoingFallback,
          completed: completedFallback,
          ongoingCount: ongoingFallback.length,
          completedCount: completedFallback.length,
        };
      }

      const ongoing = Array.isArray(res?.ongoing) ? res.ongoing : [];
      const completed = Array.isArray(res?.completed) ? res.completed : [];
      const ongoingCount =
        typeof res?.ongoingCount === 'number' ? res.ongoingCount : ongoing.length;
      const completedCount =
        typeof res?.completedCount === 'number'
          ? res.completedCount
          : completed.length;

      return {
        ongoing,
        completed,
        ongoingCount,
        completedCount,
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
  {
    condition: (arg = {}, { getState }) => {
      const opts = arg && typeof arg === 'object' ? arg : {};
      if (opts.force === true) return true;
      const slice = getState()?.projects;
      if (!slice) return true;
      if (slice.myWorkStatus === 'loading') return false;
      const ts = slice.viewLastFetchedAt?.myWork;
      if (ts) {
        const parsed = Date.parse(ts);
        if (Number.isFinite(parsed) && Date.now() - parsed < PROJECTS_STALE_MS) {
          return false;
        }
      }
      return true;
    },
  },
);

/**
 * Fetches single project detail (`GET /projects/:id`).
 * Preserves structured 410 PROJECT_DELETED tombstone payload for Tombstone rendering.
 */
export const fetchProjectById = createAsyncThunk(
  'projects/fetchProjectById',
  async (arg, { rejectWithValue }) => {
    const id = typeof arg === 'object' ? arg?.id : arg;
    const role = typeof arg === 'object' ? arg?.role : undefined;
    try {
      const project = await safeInvokeGet(id, role);
      return { id: String(id), project };
    } catch (err) {
      const normalized = normalizeThunkError(err);
      if (normalized.statusCode === 410 || normalized.code === 'PROJECT_DELETED') {
        const tombstoneProject = err?.project || err?.data?.project || { id };
        return rejectWithValue({
          ...normalized,
          isDeletedProject: true,
          projectId: String(id),
          project: tombstoneProject,
        });
      }
      return rejectWithValue(normalized);
    }
  },
  {
    condition: (arg, { getState }) => {
      if (typeof arg === 'object' && arg?.force === true) return true;
      const id = String(typeof arg === 'object' ? arg?.id : arg || '');
      const slice = getState()?.projects;
      if (!slice || !id) return true;
      if (slice.byIdStatus?.[id] === 'loading') return false;
      const ts = slice.detailLastFetchedAt?.[id];
      if (ts && slice.entities?.[id]) {
        const parsed = Date.parse(ts);
        if (Number.isFinite(parsed) && Date.now() - parsed < PROJECTS_STALE_MS) {
          return false;
        }
      }
      return true;
    },
  },
);

export const fetchProjectMembers = createAsyncThunk(
  'projects/fetchProjectMembers',
  async (arg, { rejectWithValue }) => {
    const id = String(typeof arg === 'object' ? arg?.id : arg || '');
    const role = typeof arg === 'object' ? arg?.role : undefined;
    try {
      const members =
        role !== undefined
          ? await projectsApi.getMembers(id, role)
          : await projectsApi.getMembers(id);
      return { id, members: Array.isArray(members) ? members : [] };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

export const fetchProjectMatch = createAsyncThunk(
  'projects/fetchProjectMatch',
  async (arg, { rejectWithValue }) => {
    const id = String(typeof arg === 'object' ? arg?.id : arg || '');
    const role = typeof arg === 'object' ? arg?.role : undefined;
    const userId = typeof arg === 'object' ? arg?.userId : undefined;
    try {
      if (typeof projectsApi.getMatch !== 'function') {
        return { id, match: null };
      }
      let match;
      if (role !== undefined && userId !== undefined) {
        match = await projectsApi.getMatch(id, role, userId);
      } else if (role !== undefined) {
        match = await projectsApi.getMatch(id, role);
      } else {
        match = await projectsApi.getMatch(id);
      }
      return { id, match: match || null };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

export const createProject = createAsyncThunk(
  'projects/createProject',
  async (arg, { rejectWithValue }) => {
    const payload = arg?.payload ?? arg;
    const role = arg?.role;
    const userId = arg?.userId;
    try {
      let created;
      if (role !== undefined || userId !== undefined) {
        created = await projectsApi.create(payload, role, userId);
      } else {
        created = await projectsApi.create(payload);
      }
      return created;
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

export const updateProject = createAsyncThunk(
  'projects/updateProject',
  async (arg, { dispatch, rejectWithValue }) => {
    const { id, payload, role } = arg || {};
    try {
      const updated =
        role !== undefined
          ? await projectsApi.update(id, payload, role)
          : await projectsApi.update(id, payload);
      if (typeof projectsApi.get === 'function') {
        try {
          await dispatch(
            fetchProjectById({ id, role, force: true }),
          ).unwrap();
        } catch {
          // Non-blocking refresh if test mock omits .get
        }
      }
      return { id: String(id), updated, fallbackPatch: payload };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

export const changeProjectDeadline = createAsyncThunk(
  'projects/changeProjectDeadline',
  async (arg, { dispatch, rejectWithValue }) => {
    const { id, payload, role, userId } = arg || {};
    try {
      let res;
      if (userId !== undefined) {
        res = await projectsApi.changeDeadline(id, payload, role, userId);
      } else if (role !== undefined) {
        res = await projectsApi.changeDeadline(id, payload, role);
      } else {
        res = await projectsApi.changeDeadline(id, payload);
      }
      if (typeof projectsApi.get === 'function') {
        try {
          await dispatch(
            fetchProjectById({ id, role, force: true }),
          ).unwrap();
        } catch {
          // Safe fallback when mock omits get
        }
      }
      return {
        id: String(id),
        project: res?.project || res,
        dueDate: res?.dueDate || res?.project?.dueDate || payload?.dueDate,
        deadlineHistory:
          res?.deadlineHistory || res?.project?.deadlineHistory || undefined,
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

export const completeProject = createAsyncThunk(
  'projects/completeProject',
  async (arg, { rejectWithValue }) => {
    const { id, payload, role } = arg || {};
    try {
      const res =
        role !== undefined
          ? await projectsApi.complete(id, payload, role)
          : await projectsApi.complete(id, payload);
      return {
        id: String(id),
        res,
        finalLink: payload?.finalLink || payload?.finishedLink,
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

export const checkProjectDeletion = createAsyncThunk(
  'projects/checkProjectDeletion',
  async (arg, { rejectWithValue }) => {
    const id = typeof arg === 'object' ? arg?.id : arg;
    const role = typeof arg === 'object' ? arg?.role : undefined;
    try {
      const result =
        role !== undefined
          ? await projectsApi.checkDeletion(id, role)
          : await projectsApi.checkDeletion(id);
      return { id: String(id), result };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

export const deleteProject = createAsyncThunk(
  'projects/deleteProject',
  async (arg, { rejectWithValue }) => {
    const { id, payload, role } = arg || {};
    try {
      let res;
      if (role !== undefined) {
        res = await projectsApi.softDelete(id, payload, role);
      } else if (payload !== undefined) {
        res = await projectsApi.softDelete(id, payload);
      } else {
        res = await projectsApi.softDelete(id);
      }
      return { id: String(id), result: res };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

export const cancelProjectDeletion = createAsyncThunk(
  'projects/cancelProjectDeletion',
  async (arg, { dispatch, rejectWithValue }) => {
    const id = typeof arg === 'object' ? arg?.id : arg;
    const role = typeof arg === 'object' ? arg?.role : undefined;
    try {
      const res =
        role !== undefined
          ? await projectsApi.cancelDeletion(id, role)
          : await projectsApi.cancelDeletion(id);
      if (!res?.project && typeof projectsApi.get === 'function') {
        try {
          await dispatch(fetchProjectById({ id, role, force: true })).unwrap();
        } catch {
          // Non-blocking refresh
        }
      }
      return { id: String(id), result: res };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

export const fetchRemovalCheck = createAsyncThunk(
  'projects/fetchRemovalCheck',
  async (arg, { rejectWithValue }) => {
    const { projectId, userId, role } = arg || {};
    try {
      const res =
        role !== undefined
          ? await projectsApi.getRemovalCheck(projectId, userId, role)
          : await projectsApi.getRemovalCheck(projectId, userId);
      return { projectId: String(projectId), userId: String(userId), check: res };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

export const removeProjectMember = createAsyncThunk(
  'projects/removeProjectMember',
  async (arg, { dispatch, rejectWithValue }) => {
    const { projectId, memberId, memberName, reason, role, userId } = arg || {};
    try {
      let res;
      if (userId !== undefined || role !== undefined) {
        res = await projectsApi.removeMember(
          projectId,
          memberId,
          reason,
          role,
          userId,
        );
      } else {
        res = await projectsApi.removeMember(projectId, memberId, reason);
      }
      if (typeof projectsApi.get === 'function') {
        try {
          await dispatch(
            fetchProjectById({ id: projectId, role, force: true }),
          ).unwrap();
        } catch {
          // Mock fallback updates locally in slice
        }
      }
      return {
        projectId: String(projectId),
        memberId: String(memberId),
        memberName,
        reason,
        res,
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

export const releaseMemberTasks = createAsyncThunk(
  'projects/releaseMemberTasks',
  async (arg, { rejectWithValue }) => {
    const { projectId, memberId, role } = arg || {};
    try {
      const res =
        role !== undefined
          ? await projectsApi.releaseMemberTasks(projectId, memberId, role)
          : await projectsApi.releaseMemberTasks(projectId, memberId);
      return { projectId: String(projectId), memberId: String(memberId), res };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

export const fetchMyProjectLeaveRequest = createAsyncThunk(
  'projects/fetchMyProjectLeaveRequest',
  async (arg, { rejectWithValue }) => {
    const id = typeof arg === 'object' ? arg?.id : arg;
    const role = typeof arg === 'object' ? arg?.role : undefined;
    const userId = typeof arg === 'object' ? arg?.userId : undefined;
    try {
      if (typeof projectsApi.getMyLeaveRequest !== 'function') {
        return { projectId: String(id), leaveRequest: null };
      }
      let res;
      if (userId !== undefined) {
        res = await projectsApi.getMyLeaveRequest(id, role, userId);
      } else if (role !== undefined) {
        res = await projectsApi.getMyLeaveRequest(id, role);
      } else {
        res = await projectsApi.getMyLeaveRequest(id);
      }
      return {
        projectId: String(id),
        leaveRequest: res && res.status === 'pending' ? res : null,
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

export const submitProjectLeaveRequest = createAsyncThunk(
  'projects/submitProjectLeaveRequest',
  async (arg, { rejectWithValue }) => {
    const { projectId, payload, role, userId } = arg || {};
    try {
      let res;
      if (userId !== undefined) {
        res = await projectsApi.submitLeaveRequest(projectId, payload, role, userId);
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

export const withdrawProjectLeaveRequest = createAsyncThunk(
  'projects/withdrawProjectLeaveRequest',
  async (arg, { rejectWithValue }) => {
    const { projectId, role, userId } = arg || {};
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

export const requestCloseProject = createAsyncThunk(
  'projects/requestCloseProject',
  async (arg, { rejectWithValue }) => {
    const { projectId, payload = {}, role } = arg || {};
    try {
      const res =
        role !== undefined
          ? await projectsApi.requestClose(projectId, payload, role)
          : await projectsApi.requestClose(projectId, payload);
      return { projectId: String(projectId), res };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

export const fetchTaskTemplatesByCategory = createAsyncThunk(
  'projects/fetchTaskTemplatesByCategory',
  async (arg, { rejectWithValue }) => {
    const category = typeof arg === 'object' ? arg?.category : arg;
    const role = typeof arg === 'object' ? arg?.role : undefined;
    try {
      const res =
        role !== undefined
          ? await projectsApi.getTaskTemplatesByCategory(category, role)
          : await projectsApi.getTaskTemplatesByCategory(category);
      return {
        category: res?.category || category,
        items: Array.isArray(res?.items) ? res.items : [],
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

export const fetchProjectTaskTemplates = createAsyncThunk(
  'projects/fetchProjectTaskTemplates',
  async (arg, { rejectWithValue }) => {
    const id = typeof arg === 'object' ? arg?.id : arg;
    const role = typeof arg === 'object' ? arg?.role : undefined;
    const userId = typeof arg === 'object' ? arg?.userId : undefined;
    try {
      if (typeof projectsApi.getProjectTaskTemplates !== 'function') {
        return { projectId: String(id), category: '', items: [] };
      }
      let res;
      if (userId !== undefined) {
        res = await projectsApi.getProjectTaskTemplates(id, role, userId);
      } else if (role !== undefined) {
        res = await projectsApi.getProjectTaskTemplates(id, role);
      } else {
        res = await projectsApi.getProjectTaskTemplates(id);
      }
      return {
        projectId: String(id),
        category: res?.category || '',
        items: Array.isArray(res?.items) ? res.items : [],
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

export const applyProjectTaskTemplates = createAsyncThunk(
  'projects/applyProjectTaskTemplates',
  async (arg, { rejectWithValue }) => {
    const { id, payload, role, userId } = arg || {};
    try {
      let res;
      if (userId !== undefined) {
        res = await projectsApi.applyProjectTaskTemplates(id, payload, role, userId);
      } else if (role !== undefined) {
        res = await projectsApi.applyProjectTaskTemplates(id, payload, role);
      } else {
        res = await projectsApi.applyProjectTaskTemplates(id, payload);
      }
      return { projectId: String(id), res };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);
