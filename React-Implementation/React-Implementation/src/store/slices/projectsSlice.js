import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import { addRouteReset } from '../utils/routeReset';
import { sessionReset } from '../actions/appActions';
import { getProjectSeatCounts, isProjectLocked } from '../../utils/projectStatus';
import {
  cancelProjectDeletion,
  changeProjectDeadline,
  checkProjectDeletion,
  completeProject,
  createProject,
  deleteProject,
  fetchMyProjectLeaveRequest,
  fetchMyProjects,
  fetchMyWork,
  fetchProjectById,
  fetchProjectMatch,
  fetchProjectMembers,
  fetchProjects,
  fetchProjectTaskTemplates,
  fetchRemovalCheck,
  fetchTaskTemplatesByCategory,
  removeProjectMember,
  requestCloseProject,
  submitProjectLeaveRequest,
  updateProject,
  withdrawProjectLeaveRequest,
} from '../thunks/projectsThunks';

/**
 * Reference Domain Repository Slice (`projectsSlice` — Model for Phases 5–11)
 * =============================================================================
 * Demonstrates all TeamForge Redux rules:
 * 1. `createEntityAdapter` normalizes project entities by `id` (`entities`, `ids`)
 *    so entities fetched across Marketplace, My Projects, My Work, and Workspaces
 *    merge by ID without duplication.
 * 2. Four explicit synchronous CRUD reducers (`setAll`, `addOne`, `updateOne`,
 *    `removeOne`) satisfy Professor Requirements 2 & 3 (`N_ui x 4`).
 * 3. Server-returned ordered ID lists (`marketplaceIds`, `myProjectIds`,
 *    `myWorkOngoingIds`, `myWorkCompletedIds`) and `summary` counts stay verbatim
 *    from server responses rather than being recomputed from entity state.
 * 4. Page working state (`searchQuery`, `myProjectsFilter`, `myWorkFilter`,
 *    `selectedProjectId`, `selectedTab`, `marketplacePreviewId`, errors, starter
 *    template draft) clears automatically on `routeChanged` via `addRouteReset`,
 *    while entities, ID lists, and summary counts stay cached across navigation.
 */
export const projectsAdapter = createEntityAdapter({
  selectId: (project) => String(project.id),
});

export function createInitialProjectsWorking() {
  return {
    searchQuery: '',
    myProjectsFilter: 'all', // 'all' | 'active' | 'completed' | 'closed'
    myWorkFilter: 'ongoing', // 'ongoing' | 'completed'
    selectedProjectId: null,
    selectedTab: 'overview',
    marketplacePreviewId: null,
    summaryProjectId: null,
    starterTemplates: [],
    starterTemplatesCategory: '',
    loadingTemplates: false,
    starterError: '',
    editError: '',
    deadlineError: '',
    deleteError: '',
    checkError: '',
    closeError: '',
    closeMessage: '',
    completeError: '',
    removeMemberError: '',
    leaveError: '',
    leaveCooldownMsg: '',
    createError: null,
  };
}

function createInitialSummary() {
  return {
    marketplaceCount: 0,
    myProjectsTotalCount: 0,
    myProjectsActiveCount: 0,
    myProjectsCompletedCount: 0,
    myProjectsClosedCount: 0,
    myWorkOngoingCount: 0,
    myWorkCompletedCount: 0,
  };
}

export function createInitialProjectsState() {
  return projectsAdapter.getInitialState({
    // Ordered server-driven ID lists per view (never duplicated entities)
    marketplaceIds: [],
    myProjectIds: [],
    myWorkOngoingIds: [],
    myWorkCompletedIds: [],
    summary: createInitialSummary(),

    // Per-project detail auxiliary server state
    membersByProjectId: {},
    tombstoneById: {},
    deletionChecksById: {},
    removalChecksById: {},
    skillMatchById: {},
    myLeaveRequestByProjectId: {},
    projectTaskTemplatesById: {},

    // Async lifecycle status & error tracking
    status: 'idle', // Marketplace / generic fetch status
    myProjectsStatus: 'idle',
    myWorkStatus: 'idle',
    detailStatus: 'idle',
    createStatus: 'idle',
    updateStatus: 'idle',
    deleteStatus: 'idle',
    deletionCheckStatus: 'idle',
    matchStatus: 'idle',
    byIdStatus: {},
    error: null,
    lastFetchedAt: null,
    viewLastFetchedAt: {
      marketplace: null,
      myProjects: null,
      myWork: null,
    },
    detailLastFetchedAt: {},

    // Transient page UI working state (cleared on routeChanged)
    working: createInitialProjectsWorking(),
  });
}

function normalizeCapacityPatch(patch) {
  if (!patch || typeof patch !== 'object') return patch;
  const next = { ...patch };
  if (patch.teamSize !== undefined && patch.maxCollaborators === undefined) {
    next.maxCollaborators = patch.teamSize;
  } else if (patch.maxCollaborators !== undefined && patch.teamSize === undefined) {
    next.teamSize = patch.maxCollaborators;
  }
  return next;
}

function applyCapacitySync(entity, patch) {
  if (!entity || !patch) return;
  const capacityTouched =
    patch.teamSize !== undefined ||
    patch.maxCollaborators !== undefined ||
    patch.collaborators !== undefined ||
    patch.members !== undefined ||
    patch.removedUsers !== undefined;
  if (capacityTouched && patch.isFull === undefined) {
    const seats = getProjectSeatCounts(entity);
    entity.approvedCollaboratorCount = seats.used;
    entity.collaboratorCount = seats.used;
    entity.isFull = seats.isFull;
  }
}

function mergeUpsertProject(state, incoming) {
  if (!incoming || incoming.id === undefined || incoming.id === null) return;
  const normalizedIncoming = normalizeCapacityPatch(incoming);
  const key = String(normalizedIncoming.id);
  const existing = state.entities[key];
  if (!existing) {
    projectsAdapter.addOne(state, { ...normalizedIncoming, id: normalizedIncoming.id });
    return;
  }
  // Merge shallow server payload while preserving richer detail fields when omitted
  const merged = {
    ...existing,
    ...normalizedIncoming,
    ...(normalizedIncoming.members === undefined && existing.members !== undefined
      ? { members: existing.members }
      : {}),
    ...(normalizedIncoming.deadlineHistory === undefined &&
    existing.deadlineHistory !== undefined
      ? { deadlineHistory: existing.deadlineHistory }
      : {}),
  };
  applyCapacitySync(merged, normalizedIncoming);
  projectsAdapter.upsertOne(state, merged);
}

function mergeUpsertManyProjects(state, list) {
  if (!Array.isArray(list)) return;
  for (const item of list) {
    mergeUpsertProject(state, item);
  }
}

function recomputeOwnedSummary(state) {
  const items = state.myProjectIds
    .map((id) => state.entities[id])
    .filter(Boolean);
  let active = 0;
  let completed = 0;
  let closed = 0;
  for (const p of items) {
    const st = String(p.status || '').toLowerCase();
    if (st === 'closed') {
      closed += 1;
    } else if (p.isCompleted === true || isProjectLocked(p)) {
      completed += 1;
    } else {
      active += 1;
    }
  }
  state.summary.myProjectsTotalCount = items.length;
  state.summary.myProjectsActiveCount = active;
  state.summary.myProjectsCompletedCount = completed;
  state.summary.myProjectsClosedCount = closed;
}

function ensureProjectsSubstates(state) {
  if (!state.working) state.working = createInitialProjectsWorking();
  if (!state.summary) state.summary = createInitialSummary();
  if (!state.marketplaceIds) state.marketplaceIds = [];
  if (!state.myProjectIds) state.myProjectIds = [];
  if (!state.myWorkOngoingIds) state.myWorkOngoingIds = [];
  if (!state.myWorkCompletedIds) state.myWorkCompletedIds = [];
  if (!state.membersByProjectId) state.membersByProjectId = {};
  if (!state.tombstoneById) state.tombstoneById = {};
  if (!state.deletionChecksById) state.deletionChecksById = {};
  if (!state.removalChecksById) state.removalChecksById = {};
  if (!state.skillMatchById) state.skillMatchById = {};
  if (!state.myLeaveRequestByProjectId) state.myLeaveRequestByProjectId = {};
  if (!state.projectTaskTemplatesById) state.projectTaskTemplatesById = {};
  if (!state.byIdStatus) state.byIdStatus = {};
  if (!state.viewLastFetchedAt) {
    state.viewLastFetchedAt = {
      marketplace: null,
      myProjects: null,
      myWork: null,
    };
  }
  if (!state.detailLastFetchedAt) state.detailLastFetchedAt = {};
}

function purgeIdFromAllLists(state, rawId) {
  ensureProjectsSubstates(state);
  const key = String(rawId);
  const filterOut = (arr) => arr.filter((id) => id !== key);

  const prevMarketLen = state.marketplaceIds.length;
  state.marketplaceIds = filterOut(state.marketplaceIds);
  if (state.marketplaceIds.length !== prevMarketLen) {
    state.summary.marketplaceCount = state.marketplaceIds.length;
  }

  const prevOwnedLen = state.myProjectIds.length;
  state.myProjectIds = filterOut(state.myProjectIds);
  if (state.myProjectIds.length !== prevOwnedLen) {
    recomputeOwnedSummary(state);
  }

  const prevOngoingLen = state.myWorkOngoingIds.length;
  state.myWorkOngoingIds = filterOut(state.myWorkOngoingIds);
  if (state.myWorkOngoingIds.length !== prevOngoingLen) {
    state.summary.myWorkOngoingCount = Math.max(
      0,
      state.summary.myWorkOngoingCount - (prevOngoingLen - state.myWorkOngoingIds.length),
    );
  }

  const prevCompletedLen = state.myWorkCompletedIds.length;
  state.myWorkCompletedIds = filterOut(state.myWorkCompletedIds);
  if (state.myWorkCompletedIds.length !== prevCompletedLen) {
    state.summary.myWorkCompletedCount = Math.max(
      0,
      state.summary.myWorkCompletedCount -
        (prevCompletedLen - state.myWorkCompletedIds.length),
    );
  }

  delete state.tombstoneById[key];
  delete state.membersByProjectId[key];
  delete state.deletionChecksById[key];
  delete state.removalChecksById[key];
  delete state.skillMatchById[key];
  delete state.myLeaveRequestByProjectId[key];
  delete state.projectTaskTemplatesById[key];
}

function clearWorkingProjectsState(state) {
  state.working = createInitialProjectsWorking();
}

const projectsSlice = createSlice({
  name: 'projects',
  initialState: createInitialProjectsState(),
  reducers: {
    // ── Four Explicit Repository CRUD Reducers (Requirements 2 & 3, Decision D2) ──
    setAll(state, action) {
      const items = Array.isArray(action.payload) ? action.payload : [];
      projectsAdapter.setAll(state, items);
      state.marketplaceIds = items.map((p) => String(p.id));
      state.summary.marketplaceCount = state.marketplaceIds.length;
    },
    addOne(state, action) {
      const item = action.payload;
      if (!item || item.id === undefined) return;
      projectsAdapter.addOne(state, item);
      const key = String(item.id);
      if (!state.myProjectIds.includes(key)) {
        state.myProjectIds.push(key);
        recomputeOwnedSummary(state);
      }
    },
    updateOne(state, action) {
      const { id, changes } = action.payload || {};
      if (id === undefined || !changes) return;
      const key = String(id);
      const effectiveChanges = normalizeCapacityPatch(changes);
      projectsAdapter.updateOne(state, { id: key, changes: effectiveChanges });
      applyCapacitySync(state.entities[key], effectiveChanges);
    },
    removeOne(state, action) {
      const rawId =
        typeof action.payload === 'object' ? action.payload?.id : action.payload;
      if (rawId === undefined || rawId === null) return;
      const key = String(rawId);
      projectsAdapter.removeOne(state, key);
      purgeIdFromAllLists(state, key);
    },

    // ── Working State Reducers (automatically reset on routeChanged) ──
    setSearchQuery(state, action) {
      ensureProjectsSubstates(state);
      state.working.searchQuery = String(action.payload ?? '');
    },
    setMyProjectsFilter(state, action) {
      ensureProjectsSubstates(state);
      state.working.myProjectsFilter = action.payload || 'all';
    },
    setMyWorkFilter(state, action) {
      ensureProjectsSubstates(state);
      state.working.myWorkFilter = action.payload || 'ongoing';
    },
    setSelectedProjectId(state, action) {
      ensureProjectsSubstates(state);
      state.working.selectedProjectId =
        action.payload !== undefined && action.payload !== null
          ? String(action.payload)
          : null;
    },
    setSelectedTab(state, action) {
      ensureProjectsSubstates(state);
      state.working.selectedTab = action.payload || 'overview';
    },
    setMarketplacePreviewId(state, action) {
      ensureProjectsSubstates(state);
      state.working.marketplacePreviewId =
        action.payload !== undefined && action.payload !== null
          ? String(action.payload)
          : null;
    },
    setSummaryProjectId(state, action) {
      ensureProjectsSubstates(state);
      state.working.summaryProjectId =
        action.payload !== undefined && action.payload !== null
          ? String(action.payload)
          : null;
    },
    clearStarterTemplates(state) {
      ensureProjectsSubstates(state);
      state.working.starterTemplates = [];
      state.working.starterTemplatesCategory = '';
      state.working.starterError = '';
      state.working.loadingTemplates = false;
    },
    setStarterError(state, action) {
      ensureProjectsSubstates(state);
      state.working.starterError = String(action.payload || '');
    },
    setProjectUiError(state, action) {
      ensureProjectsSubstates(state);
      const { field, message } = action.payload || {};
      if (field && field in state.working) {
        state.working[field] = message || '';
      }
    },
    setRemovalCheckEntry(state, action) {
      ensureProjectsSubstates(state);
      const { projectId, userId, check } = action.payload || {};
      if (!projectId || !userId) return;
      const pKey = String(projectId);
      const uKey = String(userId);
      if (!state.removalChecksById[pKey]) {
        state.removalChecksById[pKey] = {};
      }
      state.removalChecksById[pKey][uKey] = check;
    },
    clearWorkingState: clearWorkingProjectsState,
    resetSlice() {
      return createInitialProjectsState();
    },
  },
  extraReducers: (builder) => {
    addRouteReset(builder, clearWorkingProjectsState);
    builder.addCase(sessionReset, () => createInitialProjectsState());

    builder
      // Marketplace / general list
      .addCase(fetchProjects.pending, (state) => {
        ensureProjectsSubstates(state);
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchProjects.fulfilled, (state, action) => {
        ensureProjectsSubstates(state);
        const items = action.payload?.items || [];
        const view = action.payload?.view || 'marketplace';
        mergeUpsertManyProjects(state, items);
        if (view === 'marketplace' || view === 'all') {
          state.marketplaceIds = items.map((p) => String(p.id));
          state.summary.marketplaceCount = state.marketplaceIds.length;
        }
        state.status = 'succeeded';
        state.error = null;
        const nowIso = new Date().toISOString();
        state.lastFetchedAt = nowIso;
        state.viewLastFetchedAt[view] = nowIso;
      })
      .addCase(fetchProjects.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || {
          message: action.error?.message || 'Failed to load projects.',
        };
      })

      // Owner My Projects view
      .addCase(fetchMyProjects.pending, (state) => {
        ensureProjectsSubstates(state);
        state.myProjectsStatus = 'loading';
        state.error = null;
      })
      .addCase(fetchMyProjects.fulfilled, (state, action) => {
        ensureProjectsSubstates(state);
        const items = action.payload?.items || [];
        mergeUpsertManyProjects(state, items);
        state.myProjectIds = items.map((p) => String(p.id));
        recomputeOwnedSummary(state);
        state.myProjectsStatus = 'succeeded';
        const nowIso = new Date().toISOString();
        state.lastFetchedAt = nowIso;
        state.viewLastFetchedAt.myProjects = nowIso;
      })
      .addCase(fetchMyProjects.rejected, (state, action) => {
        state.myProjectsStatus = 'failed';
        state.error = action.payload || {
          message: action.error?.message || 'Failed to load owned projects.',
        };
      })

      // Collaborator My Work view
      .addCase(fetchMyWork.pending, (state) => {
        ensureProjectsSubstates(state);
        state.myWorkStatus = 'loading';
        state.error = null;
      })
      .addCase(fetchMyWork.fulfilled, (state, action) => {
        ensureProjectsSubstates(state);
        const { ongoing, completed, ongoingCount, completedCount } =
          action.payload || {};
        mergeUpsertManyProjects(state, ongoing || []);
        mergeUpsertManyProjects(state, completed || []);
        state.myWorkOngoingIds = (ongoing || []).map((p) => String(p.id));
        state.myWorkCompletedIds = (completed || []).map((p) => String(p.id));
        state.summary.myWorkOngoingCount = ongoingCount ?? state.myWorkOngoingIds.length;
        state.summary.myWorkCompletedCount =
          completedCount ?? state.myWorkCompletedIds.length;
        state.myWorkStatus = 'succeeded';
        const nowIso = new Date().toISOString();
        state.lastFetchedAt = nowIso;
        state.viewLastFetchedAt.myWork = nowIso;
      })
      .addCase(fetchMyWork.rejected, (state, action) => {
        state.myWorkStatus = 'failed';
        state.error = action.payload || {
          message: action.error?.message || 'Failed to load work projects.',
        };
      })

      // Project detail (+ tombstone 410 handling)
      .addCase(fetchProjectById.pending, (state, action) => {
        ensureProjectsSubstates(state);
        const id = String(
          typeof action.meta.arg === 'object' ? action.meta.arg?.id : action.meta.arg,
        );
        state.detailStatus = 'loading';
        state.byIdStatus[id] = 'loading';
      })
      .addCase(fetchProjectById.fulfilled, (state, action) => {
        const { id, project } = action.payload || {};
        state.detailStatus = 'succeeded';
        if (id) {
          state.byIdStatus[id] = 'succeeded';
          state.detailLastFetchedAt[id] = new Date().toISOString();
          delete state.tombstoneById[id];
        }
        if (project) {
          mergeUpsertProject(state, project);
          if (Array.isArray(project.members) && id) {
            state.membersByProjectId[id] = project.members;
          }
        }
      })
      .addCase(fetchProjectById.rejected, (state, action) => {
        const id = String(
          typeof action.meta.arg === 'object' ? action.meta.arg?.id : action.meta.arg,
        );
        state.detailStatus = 'failed';
        state.byIdStatus[id] = 'failed';
        if (action.payload?.isDeletedProject && action.payload?.project) {
          state.tombstoneById[id] = action.payload.project;
        }
        state.error = action.payload || {
          message: action.error?.message || 'Failed to load project.',
        };
      })

      // Project members list
      .addCase(fetchProjectMembers.fulfilled, (state, action) => {
        const { id, members } = action.payload || {};
        if (!id) return;
        state.membersByProjectId[id] = members;
        if (state.entities[id]) {
          state.entities[id].members = members;
        }
      })

      // Marketplace skill match
      .addCase(fetchProjectMatch.pending, (state) => {
        state.matchStatus = 'loading';
      })
      .addCase(fetchProjectMatch.fulfilled, (state, action) => {
        state.matchStatus = 'succeeded';
        const { id, match } = action.payload || {};
        if (id) {
          state.skillMatchById[id] = match;
        }
      })
      .addCase(fetchProjectMatch.rejected, (state) => {
        state.matchStatus = 'failed';
      })

      // Create project
      .addCase(createProject.pending, (state) => {
        ensureProjectsSubstates(state);
        state.createStatus = 'loading';
        state.working.createError = null;
        state.working.starterError = '';
      })
      .addCase(createProject.fulfilled, (state, action) => {
        ensureProjectsSubstates(state);
        state.createStatus = 'succeeded';
        const created = action.payload;
        if (created && created.id !== undefined) {
          mergeUpsertProject(state, created);
          const key = String(created.id);
          if (!state.myProjectIds.includes(key)) {
            state.myProjectIds.unshift(key);
            recomputeOwnedSummary(state);
          }
          if (!state.marketplaceIds.includes(key)) {
            state.marketplaceIds.unshift(key);
            state.summary.marketplaceCount = state.marketplaceIds.length;
          }
        }
      })
      .addCase(createProject.rejected, (state, action) => {
        state.createStatus = 'failed';
        state.working.createError = action.payload || {
          message: action.error?.message || 'Failed to create project.',
        };
      })

      // Update project
      .addCase(updateProject.pending, (state) => {
        state.updateStatus = 'loading';
        state.working.editError = '';
      })
      .addCase(updateProject.fulfilled, (state, action) => {
        state.updateStatus = 'succeeded';
        const { id, updated, fallbackPatch } = action.payload || {};
        if (state.entities[id]) {
          mergeUpsertProject(state, {
            id,
            ...(fallbackPatch || {}),
            ...(updated && typeof updated === 'object' ? updated : {}),
          });
          recomputeOwnedSummary(state);
        }
      })
      .addCase(updateProject.rejected, (state, action) => {
        state.updateStatus = 'failed';
        const err = action.payload || {
          message: action.error?.message || 'Failed to update project.',
        };
        state.error = err;
        state.working.editError =
          err.code === 'TEAM_SIZE_BELOW_MEMBERS'
            ? `TEAM_SIZE_BELOW_MEMBERS: ${err.message}`
            : err.message;
      })

      // Change deadline (with deadlineHistory)
      .addCase(changeProjectDeadline.pending, (state) => {
        state.updateStatus = 'loading';
        state.working.deadlineError = '';
      })
      .addCase(changeProjectDeadline.fulfilled, (state, action) => {
        state.updateStatus = 'succeeded';
        const { id, project, dueDate, deadlineHistory } = action.payload || {};
        if (state.entities[id]) {
          mergeUpsertProject(state, {
            id,
            ...(project && typeof project === 'object' ? project : {}),
            ...(dueDate ? { dueDate } : {}),
            ...(deadlineHistory !== undefined ? { deadlineHistory } : {}),
          });
        }
      })
      .addCase(changeProjectDeadline.rejected, (state, action) => {
        state.updateStatus = 'failed';
        const err = action.payload || {
          message: action.error?.message || 'Failed to change project deadline.',
        };
        state.error = err;
        state.working.deadlineError = err.message;
      })

      // Complete project
      .addCase(completeProject.pending, (state) => {
        state.updateStatus = 'loading';
        state.working.completeError = '';
      })
      .addCase(completeProject.fulfilled, (state, action) => {
        state.updateStatus = 'succeeded';
        const { id, res, finalLink } = action.payload || {};
        if (state.entities[id]) {
          const completedAt = res?.completedAt || new Date().toISOString();
          mergeUpsertProject(state, {
            id,
            status: 'Completed',
            progress: 100,
            finishedLink: finalLink,
            finalLink,
            isCompleted: true,
            completedAt,
            badgeAwarded: res?.badgeAwarded,
            badgeReason: res?.badgeReason,
          });
          recomputeOwnedSummary(state);
        }
      })
      .addCase(completeProject.rejected, (state, action) => {
        state.updateStatus = 'failed';
        const err = action.payload || {
          message: action.error?.message || 'Failed to publish project.',
        };
        state.error = err;
        state.working.completeError = err.message;
      })

      // Check deletion eligibility
      .addCase(checkProjectDeletion.pending, (state) => {
        state.deletionCheckStatus = 'loading';
        state.working.checkError = '';
      })
      .addCase(checkProjectDeletion.fulfilled, (state, action) => {
        state.deletionCheckStatus = 'succeeded';
        const { id, result } = action.payload || {};
        if (id) {
          state.deletionChecksById[id] = result;
        }
      })
      .addCase(checkProjectDeletion.rejected, (state, action) => {
        state.deletionCheckStatus = 'failed';
        const err = action.payload || {
          message: action.error?.message || 'Failed to evaluate deletion eligibility.',
        };
        state.working.checkError = err.message;
      })

      // Delete project (immediate purge OR scheduled deletion)
      .addCase(deleteProject.pending, (state) => {
        state.deleteStatus = 'loading';
        state.working.deleteError = '';
      })
      .addCase(deleteProject.fulfilled, (state, action) => {
        state.deleteStatus = 'succeeded';
        const { id, result } = action.payload || {};
        if (result?.mode === 'scheduled') {
          mergeUpsertProject(state, {
            id,
            ...(result.project && typeof result.project === 'object'
              ? result.project
              : {
                  deletionScheduledAt: new Date().toISOString(),
                  status: 'deletion_scheduled',
                }),
          });
          state.marketplaceIds = state.marketplaceIds.filter((pid) => pid !== id);
          state.summary.marketplaceCount = state.marketplaceIds.length;
          recomputeOwnedSummary(state);
        } else {
          projectsAdapter.removeOne(state, id);
          purgeIdFromAllLists(state, id);
        }
      })
      .addCase(deleteProject.rejected, (state, action) => {
        state.deleteStatus = 'failed';
        const err = action.payload || {
          message: action.error?.message || 'Failed to delete project.',
        };
        state.error = err;
        state.working.deleteError = err.message;
      })

      // Cancel scheduled deletion
      .addCase(cancelProjectDeletion.fulfilled, (state, action) => {
        const { id, result } = action.payload || {};
        if (result?.project) {
          mergeUpsertProject(state, result.project);
        } else if (state.entities[id]) {
          state.entities[id].deletionScheduledAt = null;
          if (state.entities[id].status === 'deletion_scheduled') {
            state.entities[id].status = 'Open';
          }
        }
        recomputeOwnedSummary(state);
      })

      // Member removal check & member removal
      .addCase(fetchRemovalCheck.fulfilled, (state, action) => {
        const { projectId, userId, check } = action.payload || {};
        if (!state.removalChecksById[projectId]) {
          state.removalChecksById[projectId] = {};
        }
        state.removalChecksById[projectId][userId] = check;
      })
      .addCase(removeProjectMember.pending, (state) => {
        state.working.removeMemberError = '';
      })
      .addCase(removeProjectMember.fulfilled, (state, action) => {
        const { projectId, memberId, memberName, reason } = action.payload || {};
        const proj = state.entities[projectId];
        if (proj) {
          const matchesMember = (entry) => {
            if (typeof entry === 'string') return entry === memberId || entry === memberName;
            return (
              String(entry.id || entry.userId) === String(memberId) ||
              (memberName && entry.name === memberName)
            );
          };
          if (Array.isArray(proj.collaborators)) {
            proj.collaborators = proj.collaborators.filter((c) => !matchesMember(c));
          }
          if (Array.isArray(proj.members)) {
            proj.members = proj.members.filter(
              (m) => String(m?.role || '').toLowerCase() === 'owner' ||
                     String(m?.role || '').toLowerCase() === 'mentor' ||
                     !matchesMember(m),
            );
          }
          const currentRemoved = Array.isArray(proj.removedUsers)
            ? proj.removedUsers
            : [];
          proj.removedUsers = [
            ...currentRemoved,
            {
              userId: memberId,
              userName: memberName,
              reason,
              removedAt: new Date().toISOString(),
            },
          ];
          applyCapacitySync(proj, { collaborators: proj.collaborators, members: proj.members });
        }
      })
      .addCase(removeProjectMember.rejected, (state, action) => {
        state.working.removeMemberError =
          action.payload?.message || 'Failed to remove team member.';
      })

      // Collaborator leave & close requests
      .addCase(fetchMyProjectLeaveRequest.fulfilled, (state, action) => {
        const { projectId, leaveRequest } = action.payload || {};
        state.myLeaveRequestByProjectId[projectId] = leaveRequest;
      })
      .addCase(submitProjectLeaveRequest.fulfilled, (state, action) => {
        const { projectId, leaveRequest } = action.payload || {};
        state.myLeaveRequestByProjectId[projectId] = leaveRequest;
      })
      .addCase(submitProjectLeaveRequest.rejected, (state, action) => {
        state.working.leaveError =
          action.payload?.message || 'Failed to submit leave request.';
      })
      .addCase(withdrawProjectLeaveRequest.fulfilled, (state, action) => {
        const { projectId } = action.payload || {};
        state.myLeaveRequestByProjectId[projectId] = null;
      })
      .addCase(requestCloseProject.fulfilled, (state, action) => {
        const { projectId, res } = action.payload || {};
        state.working.closeMessage = 'Close request sent to admins for review.';
        if (res?.project) {
          mergeUpsertProject(state, res.project);
        } else if (state.entities[projectId]) {
          state.entities[projectId].closeRequestedAt = new Date().toISOString();
        }
      })
      .addCase(requestCloseProject.rejected, (state, action) => {
        state.working.closeError =
          action.payload?.message || 'Failed to submit closure request.';
      })

      // Starter task templates
      .addCase(fetchTaskTemplatesByCategory.pending, (state) => {
        state.working.loadingTemplates = true;
        state.working.starterError = '';
      })
      .addCase(fetchTaskTemplatesByCategory.fulfilled, (state, action) => {
        state.working.loadingTemplates = false;
        state.working.starterTemplatesCategory = action.payload?.category || '';
        state.working.starterTemplates = action.payload?.items || [];
      })
      .addCase(fetchTaskTemplatesByCategory.rejected, (state, action) => {
        state.working.loadingTemplates = false;
        state.working.starterTemplates = [];
        state.working.starterError =
          action.payload?.message || 'Failed to load starter task templates.';
      })
      .addCase(fetchProjectTaskTemplates.fulfilled, (state, action) => {
        const { projectId, category, items } = action.payload || {};
        state.projectTaskTemplatesById[projectId] = { category, items };
      });
  },
});

export const {
  setAll,
  addOne,
  updateOne,
  removeOne,
  setSearchQuery,
  setMyProjectsFilter,
  setMyWorkFilter,
  setSelectedProjectId,
  setSelectedTab,
  setMarketplacePreviewId,
  setSummaryProjectId,
  clearStarterTemplates,
  setStarterError,
  setProjectUiError,
  setRemovalCheckEntry,
  clearWorkingState,
  resetSlice,
} = projectsSlice.actions;

export default projectsSlice.reducer;
