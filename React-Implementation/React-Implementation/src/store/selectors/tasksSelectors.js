import { createSelector } from '@reduxjs/toolkit';

const EMPTY_LIST = [];

export const selectTasksSlice = (state) => state?.tasks;

export const selectTaskById = (state, id) =>
  id ? state?.tasks?.entities?.[String(id)] || null : null;

export const selectTasksStatusForProject = (state, projectId) =>
  projectId
    ? state?.tasks?.byProjectStatus?.[String(projectId)] || 'idle'
    : 'idle';

export const selectTasksErrorForProject = (state, projectId) =>
  projectId
    ? state?.tasks?.byProjectError?.[String(projectId)] || null
    : null;

export const selectTasksForbiddenForProject = (state, projectId) =>
  projectId
    ? Boolean(state?.tasks?.forbiddenByProject?.[String(projectId)])
    : false;

export const selectTasksWorking = (state) =>
  state?.tasks?.working || {
    selectedTaskId: null,
    statusFilter: 'all',
    assigneeFilter: 'all',
    searchQuery: '',
    openDialog: null,
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

export const selectTasksByProjectId = createSelector(
  [
    (state) => state?.tasks?.entities,
    (state) => state?.tasks?.taskIdsByProject,
    (_state, projectId) => (projectId ? String(projectId) : ''),
  ],
  (entities, taskIdsByProject, pid) => {
    if (!pid || !entities || !taskIdsByProject) return EMPTY_LIST;
    const ids = taskIdsByProject[pid];
    if (!Array.isArray(ids) || ids.length === 0) return EMPTY_LIST;
    return ids.map((id) => entities[id]).filter(Boolean);
  },
);

export const selectFilteredTasksByProjectId = createSelector(
  [selectTasksByProjectId, selectTasksWorking],
  (tasks, working) => {
    const statusFilter = String(working?.statusFilter || 'all').toLowerCase();
    const assigneeFilter = String(working?.assigneeFilter || 'all');
    const query = String(working?.searchQuery || '').trim().toLowerCase();
    return tasks.filter((t) => {
      if (statusFilter !== 'all') {
        const st = String(t.status || '').toLowerCase();
        if (st !== statusFilter) return false;
      }
      if (assigneeFilter !== 'all') {
        if (String(t.assigneeId || '') !== assigneeFilter) return false;
      }
      if (query) {
        const hay = `${t.title || ''} ${t.description || ''}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  },
);

export const selectTasksMapByProject = createSelector(
  [
    (state) => state?.tasks?.entities,
    (state) => state?.tasks?.taskIdsByProject,
  ],
  (entities, taskIdsByProject) => {
    const map = {};
    if (!entities || !taskIdsByProject) return map;
    for (const [pid, ids] of Object.entries(taskIdsByProject)) {
      map[pid] = Array.isArray(ids)
        ? ids.map((id) => entities[id]).filter(Boolean)
        : [];
    }
    return map;
  },
);
