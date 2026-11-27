import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import { addRouteReset } from '../utils/routeReset';
import { sessionReset } from '../actions/appActions';
import {
  addTaskComment,
  createTask,
  deleteTask,
  fetchTaskById,
  fetchTasksByProject,
  fetchTasksForProjects,
  reviewTask,
  unassignTask,
  updateTask,
  updateTaskStatus,
} from '../thunks/tasksThunks';
import {
  releaseMemberTasks,
  removeProjectMember,
} from '../thunks/projectsThunks';

/**
 * Tasks Repository Slice (`tasksSlice`)
 * =====================================
 * 1. `createEntityAdapter` normalizes task entities by `id`, deduplicating tasks
 *    loaded from single-project boards and multi-project views (`My Work`, `OwnerDashboard`).
 * 2. Four explicit synchronous CRUD reducers (`setAll`, `addOne`, `updateOne`, `removeOne`).
 * 3. Server-ordered per-project ID lists (`taskIdsByProject[projectId]`) plus per-project
 *    status / forbidden flags / timestamps.
 * 4. Working state (`selectedTaskId`, filters, open dialog identifiers, API error messages)
 *    resets on `routeChanged` via `addRouteReset`, while normalized tasks remain cached.
 */
export const tasksAdapter = createEntityAdapter({
  selectId: (task) => String(task.id),
});

export function createInitialTasksWorking() {
  return {
    selectedTaskId: null,
    statusFilter: 'all',
    assigneeFilter: 'all',
    searchQuery: '',
    openDialog: null, // 'create' | 'reject' | 'unassign' | 'proof' | 'dueHistory' | null
    rejectTaskId: null,
    unassignTaskId: null,
    proofTaskId: null,
    createError: null,
    updateError: null,
    reviewError: null,
    unassignError: null,
    commentsError: null,
    deleteError: null,
  };
}

export function createInitialTasksState() {
  return tasksAdapter.getInitialState({
    taskIdsByProject: {},
    byProjectStatus: {},
    byProjectError: {},
    byProjectLastFetchedAt: {},
    forbiddenByProject: {},
    multiStatus: 'idle',
    multiError: null,
    optimisticSnapshots: {},
    working: createInitialTasksWorking(),
  });
}

function ensureTasksSubstates(state) {
  if (!state.entities) state.entities = {};
  if (!Array.isArray(state.ids)) state.ids = [];
  if (!state.taskIdsByProject) state.taskIdsByProject = {};
  if (!state.byProjectStatus) state.byProjectStatus = {};
  if (!state.byProjectError) state.byProjectError = {};
  if (!state.byProjectLastFetchedAt) state.byProjectLastFetchedAt = {};
  if (!state.forbiddenByProject) state.forbiddenByProject = {};
  if (!state.multiStatus) state.multiStatus = 'idle';
  if (state.multiError === undefined) state.multiError = null;
  if (!state.optimisticSnapshots) state.optimisticSnapshots = {};
  if (!state.working) state.working = createInitialTasksWorking();
}

function appendProjectTaskId(state, task) {
  const pid = task?.projectId ? String(task.projectId) : '';
  if (!pid || !task?.id) return;
  const tid = String(task.id);
  const existing = state.taskIdsByProject[pid] || [];
  if (!existing.includes(tid)) {
    state.taskIdsByProject[pid] = [...existing, tid];
  }
}

function removeTaskIdFromAllProjects(state, idStr, knownProjectId = null) {
  if (knownProjectId) {
    const pid = String(knownProjectId);
    if (Array.isArray(state.taskIdsByProject[pid])) {
      state.taskIdsByProject[pid] = state.taskIdsByProject[pid].filter(
        (tid) => tid !== idStr,
      );
    }
    return;
  }
  for (const pid of Object.keys(state.taskIdsByProject)) {
    state.taskIdsByProject[pid] = (
      state.taskIdsByProject[pid] || []
    ).filter((tid) => tid !== idStr);
  }
}

const initialState = createInitialTasksState();

const tasksSlice = createSlice({
  name: 'tasks',
  initialState,
  reducers: {
    /**
     * 4 explicit synchronous CRUD reducers (SPEC 2 & 3 / Decision D2).
     */
    setAll: (state, action) => {
      ensureTasksSubstates(state);
      const list = (Array.isArray(action.payload) ? action.payload : []).filter(
        Boolean,
      );
      tasksAdapter.setAll(state, list);
      state.taskIdsByProject = {};
      for (const t of list) {
        appendProjectTaskId(state, t);
      }
    },
    addOne: (state, action) => {
      ensureTasksSubstates(state);
      if (!action.payload?.id) return;
      tasksAdapter.upsertOne(state, action.payload);
      appendProjectTaskId(state, action.payload);
    },
    updateOne: (state, action) => {
      ensureTasksSubstates(state);
      tasksAdapter.updateOne(state, action);
    },
    removeOne: (state, action) => {
      ensureTasksSubstates(state);
      const idStr = String(action.payload);
      const prev = state.entities[idStr];
      tasksAdapter.removeOne(state, idStr);
      removeTaskIdFromAllProjects(state, idStr, prev?.projectId);
    },

    // Helper for adding/merging multiple tasks returned by template endpoints
    upsertMany: (state, action) => {
      ensureTasksSubstates(state);
      const list = (Array.isArray(action.payload) ? action.payload : []).filter(
        Boolean,
      );
      tasksAdapter.upsertMany(state, list);
      for (const t of list) {
        appendProjectTaskId(state, t);
      }
    },

    setSelectedTaskId: (state, action) => {
      ensureTasksSubstates(state);
      state.working.selectedTaskId =
        action.payload != null ? String(action.payload) : null;
    },
    setTaskFilters: (state, action) => {
      ensureTasksSubstates(state);
      const { statusFilter, assigneeFilter, searchQuery } =
        action.payload || {};
      if (statusFilter !== undefined) state.working.statusFilter = statusFilter;
      if (assigneeFilter !== undefined)
        state.working.assigneeFilter = assigneeFilter;
      if (searchQuery !== undefined) state.working.searchQuery = searchQuery;
    },
    setTasksWorking: (state, action) => {
      ensureTasksSubstates(state);
      Object.assign(state.working, action.payload || {});
    },
    clearTaskWorkingErrors: (state) => {
      ensureTasksSubstates(state);
      state.working.createError = null;
      state.working.updateError = null;
      state.working.reviewError = null;
      state.working.unassignError = null;
      state.working.commentsError = null;
      state.working.deleteError = null;
    },
    resetTasksWorking: (state) => {
      state.working = createInitialTasksWorking();
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch by project (`GET /tasks/project/:projectId`)
      .addCase(fetchTasksByProject.pending, (state, action) => {
        ensureTasksSubstates(state);
        const arg = action.meta.arg;
        const pid = String(
          typeof arg === 'object' && arg !== null ? arg.projectId : arg,
        );
        state.byProjectStatus[pid] = 'loading';
        state.byProjectError[pid] = null;
      })
      .addCase(fetchTasksByProject.fulfilled, (state, action) => {
        ensureTasksSubstates(state);
        const { projectId, items } = action.payload || {};
        if (!projectId) return;
        const normalized = (Array.isArray(items) ? items : [])
          .filter(Boolean)
          .map((t) => (t.projectId ? t : { ...t, projectId }));
        tasksAdapter.upsertMany(state, normalized);
        state.taskIdsByProject[projectId] = normalized.map((t) => String(t.id));
        state.byProjectStatus[projectId] = 'succeeded';
        state.byProjectError[projectId] = null;
        state.forbiddenByProject[projectId] = false;
        state.byProjectLastFetchedAt[projectId] = new Date().toISOString();
      })
      .addCase(fetchTasksByProject.rejected, (state, action) => {
        ensureTasksSubstates(state);
        const arg = action.meta.arg;
        const pid = String(
          typeof arg === 'object' && arg !== null ? arg.projectId : arg,
        );
        state.byProjectStatus[pid] = 'failed';
        state.byProjectError[pid] =
          action.payload || { message: action.error?.message || 'Failed to load tasks.' };
        if (
          action.payload?.statusCode === 403 ||
          action.payload?.code === 'NOT_A_PROJECT_MEMBER'
        ) {
          state.forbiddenByProject[pid] = true;
        }
      })

      // Fetch across multiple projects
      .addCase(fetchTasksForProjects.pending, (state) => {
        ensureTasksSubstates(state);
        state.multiStatus = 'loading';
        state.multiError = null;
      })
      .addCase(fetchTasksForProjects.fulfilled, (state, action) => {
        ensureTasksSubstates(state);
        const { projectIds = [], items = [] } = action.payload || {};
        const grouped = {};
        for (const pid of projectIds) {
          grouped[String(pid)] = [];
        }
        const validItems = (Array.isArray(items) ? items : []).filter(Boolean);
        tasksAdapter.upsertMany(state, validItems);
        for (const t of validItems) {
          const pid = t.projectId ? String(t.projectId) : '';
          if (!pid) continue;
          if (!grouped[pid]) grouped[pid] = [];
          grouped[pid].push(String(t.id));
        }
        const nowIso = new Date().toISOString();
        for (const [pid, ids] of Object.entries(grouped)) {
          state.taskIdsByProject[pid] = ids;
          state.byProjectStatus[pid] = 'succeeded';
          state.byProjectError[pid] = null;
          state.byProjectLastFetchedAt[pid] = nowIso;
        }
        state.multiStatus = 'succeeded';
        state.multiError = null;
      })
      .addCase(fetchTasksForProjects.rejected, (state, action) => {
        ensureTasksSubstates(state);
        state.multiStatus = 'failed';
        state.multiError =
          action.payload || { message: action.error?.message || 'Failed to load tasks.' };
      })

      // Fetch single task
      .addCase(fetchTaskById.fulfilled, (state, action) => {
        ensureTasksSubstates(state);
        if (action.payload?.id) {
          tasksAdapter.upsertOne(state, action.payload);
          appendProjectTaskId(state, action.payload);
        }
      })

      // Create task (`POST /tasks`)
      .addCase(createTask.pending, (state) => {
        ensureTasksSubstates(state);
        state.working.createError = null;
      })
      .addCase(createTask.fulfilled, (state, action) => {
        ensureTasksSubstates(state);
        if (action.payload?.id) {
          tasksAdapter.upsertOne(state, action.payload);
          appendProjectTaskId(state, action.payload);
        }
        state.working.createError = null;
      })
      .addCase(createTask.rejected, (state, action) => {
        ensureTasksSubstates(state);
        state.working.createError =
          action.payload || { message: action.error?.message || 'Failed to create task.' };
      })

      // Update task (`PATCH /tasks/:id`)
      .addCase(updateTask.pending, (state) => {
        ensureTasksSubstates(state);
        state.working.updateError = null;
      })
      .addCase(updateTask.fulfilled, (state, action) => {
        ensureTasksSubstates(state);
        const { id, payload, task } = action.payload || {};
        const prev = state.entities[id];
        const merged = {
          ...(prev || {}),
          ...(payload || {}),
          ...(task && typeof task === 'object' ? task : {}),
          id: task?.id || prev?.id || id,
        };
        if (payload && 'assigneeId' in payload && !payload.assigneeId) {
          merged.assigneeId = '';
        }
        tasksAdapter.upsertOne(state, merged);
        appendProjectTaskId(state, merged);
      })
      .addCase(updateTask.rejected, (state, action) => {
        ensureTasksSubstates(state);
        state.working.updateError =
          action.payload || { message: action.error?.message || 'Failed to update task.' };
      })

      // Status transition (`PATCH /tasks/:id/status`) with optional optimistic rollback
      .addCase(updateTaskStatus.pending, (state, action) => {
        ensureTasksSubstates(state);
        state.working.updateError = null;
        const { id, payload, optimistic } = action.meta.arg || {};
        if (!optimistic || !id) return;
        const tid = String(id);
        const prev = state.entities[tid];
        if (!prev) return;
        state.optimisticSnapshots[action.meta.requestId] = {
          id: tid,
          prev: { ...prev },
        };
        tasksAdapter.updateOne(state, {
          id: tid,
          changes: {
            ...(payload || {}),
            status: payload?.status || prev.status,
          },
        });
      })
      .addCase(updateTaskStatus.fulfilled, (state, action) => {
        ensureTasksSubstates(state);
        delete state.optimisticSnapshots[action.meta.requestId];
        const { id, payload, clearRejection, task } = action.payload || {};
        const prev = state.entities[id];
        const merged = {
          ...(prev || {}),
          ...(payload || {}),
          ...(task && typeof task === 'object' ? task : {}),
          id: task?.id || prev?.id || id,
          status: task?.status || payload?.status || prev?.status,
        };
        if (clearRejection) {
          merged.rejectionReason = undefined;
          merged.rejectedAt = undefined;
          merged.rejectedBy = undefined;
        }
        tasksAdapter.upsertOne(state, merged);
        appendProjectTaskId(state, merged);
      })
      .addCase(updateTaskStatus.rejected, (state, action) => {
        ensureTasksSubstates(state);
        const snap = state.optimisticSnapshots[action.meta.requestId];
        if (snap?.prev) {
          tasksAdapter.upsertOne(state, snap.prev);
        }
        delete state.optimisticSnapshots[action.meta.requestId];
        state.working.updateError =
          action.payload || { message: action.error?.message || 'Failed to update task status.' };
      })

      // Task review (`POST /tasks/:id/review`) — rejected keeps task unchanged & records reviewError
      .addCase(reviewTask.pending, (state) => {
        ensureTasksSubstates(state);
        state.working.reviewError = null;
      })
      .addCase(reviewTask.fulfilled, (state, action) => {
        ensureTasksSubstates(state);
        const { id, payload, task } = action.payload || {};
        const prev = state.entities[id];
        const isApprove = payload?.decision === 'approve';
        const merged = {
          ...(prev || {}),
          ...(task && typeof task === 'object' ? task : {}),
          id: task?.id || prev?.id || id,
        };
        if (isApprove) {
          merged.status = task?.status || 'Completed';
          if (merged.xpAwarded === undefined) merged.xpAwarded = true;
        } else {
          merged.status = task?.status || 'To Do';
          if (!merged.rejectionReason && payload?.reason) {
            merged.rejectionReason = payload.reason;
          }
        }
        tasksAdapter.upsertOne(state, merged);
        appendProjectTaskId(state, merged);
        state.working.reviewError = null;
      })
      .addCase(reviewTask.rejected, (state, action) => {
        ensureTasksSubstates(state);
        state.working.reviewError =
          action.payload || { message: action.error?.message || 'Failed to review task.' };
      })

      // Unassign / Drop (`POST /tasks/:id/unassign`) — rejected keeps task unchanged & records unassignError
      .addCase(unassignTask.pending, (state) => {
        ensureTasksSubstates(state);
        state.working.unassignError = null;
      })
      .addCase(unassignTask.fulfilled, (state, action) => {
        ensureTasksSubstates(state);
        const { id, task } = action.payload || {};
        const prev = state.entities[id];
        const merged = {
          ...(prev || {}),
          ...(task && typeof task === 'object' ? task : {}),
          id: task?.id || prev?.id || id,
          assigneeId: task?.assigneeId ?? '',
          assigneeName: task?.assigneeName || 'Unassigned',
          assignee: task?.assignee || 'Unassigned',
          status: task?.status || 'To Do',
        };
        tasksAdapter.upsertOne(state, merged);
        appendProjectTaskId(state, merged);
        state.working.unassignError = null;
      })
      .addCase(unassignTask.rejected, (state, action) => {
        ensureTasksSubstates(state);
        state.working.unassignError =
          action.payload || { message: action.error?.message || 'Failed to drop task.' };
      })

      // Task comments (`POST /tasks/:id/comments`)
      .addCase(addTaskComment.pending, (state) => {
        ensureTasksSubstates(state);
        state.working.commentsError = null;
      })
      .addCase(addTaskComment.fulfilled, (state, action) => {
        ensureTasksSubstates(state);
        const { id, commentResult } = action.payload || {};
        const prev = state.entities[id];
        if (!prev || !commentResult) return;
        if (Array.isArray(commentResult.comments)) {
          tasksAdapter.updateOne(state, {
            id,
            changes: { comments: commentResult.comments },
          });
        } else if (commentResult.id && Array.isArray(prev.comments)) {
          tasksAdapter.updateOne(state, {
            id,
            changes: { comments: [...prev.comments, commentResult] },
          });
        }
      })
      .addCase(addTaskComment.rejected, (state, action) => {
        ensureTasksSubstates(state);
        state.working.commentsError =
          action.payload || { message: action.error?.message || 'Failed to add comment.' };
      })

      // Delete task (`DELETE /tasks/:id`)
      .addCase(deleteTask.pending, (state) => {
        ensureTasksSubstates(state);
        state.working.deleteError = null;
      })
      .addCase(deleteTask.fulfilled, (state, action) => {
        ensureTasksSubstates(state);
        const { id, projectId } = action.payload || {};
        if (!id) return;
        const prev = state.entities[id];
        tasksAdapter.removeOne(state, id);
        removeTaskIdFromAllProjects(state, id, projectId || prev?.projectId);
      })
      .addCase(deleteTask.rejected, (state, action) => {
        ensureTasksSubstates(state);
        state.working.deleteError =
          action.payload || { message: action.error?.message || 'Failed to delete task.' };
      })

      // Cross-slice synchronization from Projects member removal / task release
      .addCase(releaseMemberTasks.fulfilled, (state, action) => {
        ensureTasksSubstates(state);
        const { projectId, memberId, res } = action.payload || {};
        const releasedIds = new Set(
          Array.isArray(res?.taskIds) ? res.taskIds.map(String) : [],
        );
        const pid = String(projectId);
        const targetIds = state.taskIdsByProject[pid] || [];
        for (const tid of targetIds) {
          const t = state.entities[tid];
          if (!t) continue;
          const st = String(t.status || '').toLowerCase();
          const tAssignee = String(t.assigneeId || t.assignedTo || '');
          const shouldRelease =
            releasedIds.size > 0
              ? releasedIds.has(String(t.id))
              : tAssignee === String(memberId) &&
                (st === 'open' ||
                  st === 'to do' ||
                  st === 'todo' ||
                  st === 'in progress' ||
                  st === 'in_progress');
          if (shouldRelease) {
            state.entities[tid] = {
              ...t,
              assigneeId: '',
              assignedTo: null,
              assigneeName: 'Unassigned',
              assignee: 'Unassigned',
              status: 'To Do',
            };
          }
        }
      })
      .addCase(removeProjectMember.fulfilled, (state, action) => {
        ensureTasksSubstates(state);
        const { projectId, memberId, memberName } = action.payload || {};
        const pid = String(projectId);
        const targetIds = state.taskIdsByProject[pid] || [];
        for (const tid of targetIds) {
          const t = state.entities[tid];
          if (!t) continue;
          const isAssigned =
            t.assignee === memberName ||
            t.assignee === memberId ||
            String(t.assigneeId || '') === String(memberId);
          const normStatus = String(t.status || '')
            .toLowerCase()
            .trim()
            .replace(/[\s-_]/g, '');
          const isCompleted =
            normStatus === 'completed' ||
            normStatus === 'done' ||
            normStatus === 'approved';
          const isInReview =
            normStatus === 'inreview' ||
            normStatus === 'underreview' ||
            normStatus === 'submitted';
          if (isAssigned && !isCompleted && !isInReview) {
            state.entities[tid] = {
              ...t,
              assignee: 'Unassigned',
              assigneeId: null,
              proofLink: null,
              proof_link: null,
              status: 'Open',
            };
          }
        }
      })

      .addCase(sessionReset, () => createInitialTasksState());

    addRouteReset(builder, (state) => {
      state.working = createInitialTasksWorking();
    });
  },
});

export const {
  setAll,
  addOne,
  updateOne,
  removeOne,
  upsertMany,
  setSelectedTaskId,
  setTaskFilters,
  setTasksWorking,
  clearTaskWorkingErrors,
  resetTasksWorking,
} = tasksSlice.actions;

export const tasksCrudSelectors = tasksAdapter.getSelectors(
  (state) => state?.tasks || initialState,
);

export default tasksSlice.reducer;
