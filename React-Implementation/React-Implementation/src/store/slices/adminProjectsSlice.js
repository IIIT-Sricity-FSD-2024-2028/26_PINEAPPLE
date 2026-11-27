import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import { addRouteReset } from '../utils/routeReset';
import { sessionReset } from '../actions/appActions';
import {
  cancelAdminProjectDeletion,
  closeAdminProject,
  fetchAdminProjectDetails,
  fetchAdminProjectEscrow,
  fetchAdminProjects,
  restoreAdminProject,
} from '../thunks/adminProjectsThunks';
import { deleteProject } from '../thunks/projectsThunks';
import { closeProjectFromSupportTicket } from '../thunks/supportTicketsThunks';

function deriveProjectId(p) {
  return String(p?.id || p?._id || '');
}

/**
 * Admin Projects & Escrow Tab Repository Slice (`adminProjectsSlice`)
 * ===================================================================
 * Mirrors admin views of `ProjectsRepository.projects` (`AdminProjects`,
 * `AdminProjectDetails`) and project escrow summaries (`GET /admin/projects/:id/escrow`).
 *
 * Route-Leave Reset (Reading B — Decision D3):
 * - CLEARS on `routeChanged`: `working` (`filter`, `search`, `selectedProjectId`,
 *   `activeTab`, `deleteDialogOpen`, action/loading errors).
 * - STAYS across `routeChanged`: normalized project `entities`, `escrowByProjectId`.
 * - Full reset on `sessionReset`.
 */
export const adminProjectsAdapter = createEntityAdapter({
  selectId: deriveProjectId,
});

export function createInitialAdminProjectsWorking() {
  return {
    filter: 'all',
    search: '',
    selectedProjectId: null,
    activeTab: 'overview', // 'overview' | 'escrow'
    deleteDialogOpen: false,
    detailLoading: false,
    detailError: null,
    restoringId: null,
    restoreError: null,
    cancellingDeletion: false,
    cancelDeletionError: null,
    closingProject: false,
    closeError: null,
  };
}

export function createInitialAdminProjectsState() {
  return adminProjectsAdapter.getInitialState({
    escrowByProjectId: {},
    status: 'idle',
    error: null,
    lastFetchedAt: null,
    working: createInitialAdminProjectsWorking(),
  });
}

function ensureSubstates(state) {
  if (!state.entities) state.entities = {};
  if (!Array.isArray(state.ids)) state.ids = [];
  if (!state.escrowByProjectId) state.escrowByProjectId = {};
  if (!state.working) state.working = createInitialAdminProjectsWorking();
}

function clearWorkingAdminProjectsState(state) {
  ensureSubstates(state);
  state.working = createInitialAdminProjectsWorking();
  state.error = null;
}

const adminProjectsSlice = createSlice({
  name: 'adminProjects',
  initialState: createInitialAdminProjectsState(),
  reducers: {
    // ── Four Explicit CRUD Reducers (SPEC 2, D2) ──
    setAll: (state, action) => {
      ensureSubstates(state);
      const list = Array.isArray(action.payload) ? action.payload : [];
      adminProjectsAdapter.setAll(state, list);
    },
    addOne: (state, action) => {
      ensureSubstates(state);
      if (deriveProjectId(action.payload)) {
        adminProjectsAdapter.addOne(state, action.payload);
      }
    },
    updateOne: (state, action) => {
      ensureSubstates(state);
      adminProjectsAdapter.updateOne(state, action.payload);
    },
    removeOne: (state, action) => {
      ensureSubstates(state);
      const pid = String(action.payload);
      adminProjectsAdapter.removeOne(state, pid);
      delete state.escrowByProjectId[pid];
    },

    // ── Volatile Working State Reducers ──
    setAdminProjectsFilter: (state, action) => {
      ensureSubstates(state);
      state.working.filter = action.payload || 'all';
    },
    setAdminProjectsSearch: (state, action) => {
      ensureSubstates(state);
      state.working.search = typeof action.payload === 'string' ? action.payload : '';
    },
    setAdminProjectActiveTab: (state, action) => {
      ensureSubstates(state);
      state.working.activeTab = action.payload === 'escrow' ? 'escrow' : 'overview';
    },
    setAdminDeleteDialogOpen: (state, action) => {
      ensureSubstates(state);
      state.working.deleteDialogOpen = Boolean(action.payload);
    },
    applyAdminProjectSnapshot: (state, action) => {
      ensureSubstates(state);
      if (deriveProjectId(action.payload)) {
        adminProjectsAdapter.upsertOne(state, action.payload);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdminProjects.pending, (state) => {
        ensureSubstates(state);
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchAdminProjects.fulfilled, (state, action) => {
        ensureSubstates(state);
        const list = (Array.isArray(action.payload) ? action.payload : []).filter(
          (p) => deriveProjectId(p),
        );
        adminProjectsAdapter.setAll(state, list);
        state.status = 'succeeded';
        state.lastFetchedAt = new Date().toISOString();
      })
      .addCase(fetchAdminProjects.rejected, (state, action) => {
        ensureSubstates(state);
        state.status = 'failed';
        state.error =
          action.payload?.serverMessage ||
          action.payload?.message ||
          action.error?.message ||
          'Failed to fetch projects';
      })

      .addCase(fetchAdminProjectDetails.pending, (state, action) => {
        ensureSubstates(state);
        state.working.selectedProjectId = String(action.meta?.arg || '');
        state.working.detailLoading = true;
        state.working.detailError = null;
      })
      .addCase(fetchAdminProjectDetails.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.working.detailLoading = false;
        const { projectId, project, escrowSummary } = action.payload || {};
        if (project && deriveProjectId(project)) {
          adminProjectsAdapter.upsertOne(state, project);
        }
        if (projectId && escrowSummary !== undefined) {
          state.escrowByProjectId[projectId] = escrowSummary;
        }
      })
      .addCase(fetchAdminProjectDetails.rejected, (state, action) => {
        ensureSubstates(state);
        state.working.detailLoading = false;
        state.working.detailError =
          action.payload?.serverMessage ||
          action.payload?.message ||
          action.error?.message ||
          'Failed to fetch project details';
      })

      .addCase(fetchAdminProjectEscrow.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { projectId, summary } = action.payload || {};
        if (projectId) {
          state.escrowByProjectId[projectId] = summary || null;
        }
      })

      .addCase(restoreAdminProject.pending, (state, action) => {
        ensureSubstates(state);
        state.working.restoringId = String(action.meta?.arg || '');
        state.working.restoreError = null;
      })
      .addCase(restoreAdminProject.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.working.restoringId = null;
        const { projectId, project } = action.payload || {};
        if (project && deriveProjectId(project)) {
          adminProjectsAdapter.upsertOne(state, project);
        } else if (projectId && state.entities[projectId]) {
          adminProjectsAdapter.updateOne(state, {
            id: projectId,
            changes: { deletedAt: undefined, deletedBy: undefined },
          });
        }
      })
      .addCase(restoreAdminProject.rejected, (state, action) => {
        ensureSubstates(state);
        state.working.restoringId = null;
        const msg =
          action.payload?.serverMessage ||
          action.payload?.message ||
          action.error?.message ||
          'Failed to restore project.';
        state.working.restoreError = msg;
        state.error = msg;
      })

      .addCase(cancelAdminProjectDeletion.pending, (state) => {
        ensureSubstates(state);
        state.working.cancellingDeletion = true;
        state.working.cancelDeletionError = null;
      })
      .addCase(cancelAdminProjectDeletion.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.working.cancellingDeletion = false;
        const { project } = action.payload || {};
        if (project && deriveProjectId(project)) {
          adminProjectsAdapter.upsertOne(state, project);
        }
      })
      .addCase(cancelAdminProjectDeletion.rejected, (state, action) => {
        ensureSubstates(state);
        state.working.cancellingDeletion = false;
        state.working.cancelDeletionError =
          action.payload?.serverMessage ||
          action.payload?.message ||
          action.error?.message ||
          'Failed to cancel deletion.';
      })

      .addCase(closeAdminProject.pending, (state) => {
        ensureSubstates(state);
        state.working.closingProject = true;
        state.working.closeError = null;
      })
      .addCase(closeAdminProject.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.working.closingProject = false;
        const { project } = action.payload || {};
        if (project && deriveProjectId(project)) {
          adminProjectsAdapter.upsertOne(state, project);
        }
      })
      .addCase(closeAdminProject.rejected, (state, action) => {
        ensureSubstates(state);
        state.working.closingProject = false;
        state.working.closeError =
          action.payload?.serverMessage ||
          action.payload?.message ||
          action.error?.message ||
          'Failed to close project.';
      })

      .addCase(deleteProject.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { projectId, result } = action.payload || {};
        if (result?.project && deriveProjectId(result.project)) {
          adminProjectsAdapter.upsertOne(state, result.project);
        } else if (projectId && result?.deletedAt && state.entities[projectId]) {
          adminProjectsAdapter.updateOne(state, {
            id: projectId,
            changes: { deletedAt: result.deletedAt },
          });
        }
      })
      .addCase(closeProjectFromSupportTicket.fulfilled, (state, action) => {
        ensureSubstates(state);
        const proj = action.payload?.project;
        if (proj && deriveProjectId(proj)) {
          adminProjectsAdapter.upsertOne(state, proj);
        }
      })

      .addCase(sessionReset, () => createInitialAdminProjectsState());

    addRouteReset(builder, clearWorkingAdminProjectsState);
  },
});

export const {
  setAll,
  addOne,
  updateOne,
  removeOne,
  setAdminProjectsFilter,
  setAdminProjectsSearch,
  setAdminProjectActiveTab,
  setAdminDeleteDialogOpen,
  applyAdminProjectSnapshot,
} = adminProjectsSlice.actions;

export default adminProjectsSlice.reducer;
