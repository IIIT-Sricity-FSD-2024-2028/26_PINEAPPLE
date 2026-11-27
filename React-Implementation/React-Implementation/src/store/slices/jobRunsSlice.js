import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import { addRouteReset } from '../utils/routeReset';
import { sessionReset } from '../actions/appActions';
import {
  fetchJobRunById,
  fetchJobRuns,
  triggerJobTick,
} from '../thunks/jobRunsThunks';

/**
 * Job Runs Repository Slice (`jobRunsSlice`)
 * ==========================================
 * Mirrors `JobRunsService.runs` (`GET /admin/jobs/runs`, `POST /admin/jobs/tick`)
 * and stores manual execution modal/feedback state.
 *
 * Route-Leave Reset (Reading B — Decision D3):
 * - CLEARS on `routeChanged`: `working` (`selectedRunId`, `showConfirmModal`,
 *   `isTriggering`, `errorMessage`, `successMessage`).
 * - STAYS across `routeChanged`: loaded run `entities` / `ids`.
 * - Full reset on `sessionReset`.
 */
export const jobRunsAdapter = createEntityAdapter({
  selectId: (run) => String(run?.id || ''),
});

export function createInitialJobRunsWorking() {
  return {
    selectedRunId: null,
    showConfirmModal: false,
    isTriggering: false,
    errorMessage: '',
    successMessage: '',
  };
}

export function createInitialJobRunsState() {
  return jobRunsAdapter.getInitialState({
    status: 'idle',
    error: null,
    lastFetchedAt: null,
    working: createInitialJobRunsWorking(),
  });
}

function ensureSubstates(state) {
  if (!state.entities) state.entities = {};
  if (!Array.isArray(state.ids)) state.ids = [];
  if (!state.working) state.working = createInitialJobRunsWorking();
}

function clearWorkingJobRunsState(state) {
  ensureSubstates(state);
  state.working = createInitialJobRunsWorking();
  state.error = null;
}

const jobRunsSlice = createSlice({
  name: 'jobRuns',
  initialState: createInitialJobRunsState(),
  reducers: {
    // ── Four Explicit CRUD Reducers (SPEC 2, D2) ──
    setAll: (state, action) => {
      ensureSubstates(state);
      const items = Array.isArray(action.payload) ? action.payload : [];
      jobRunsAdapter.setAll(state, items);
    },
    addOne: (state, action) => {
      ensureSubstates(state);
      if (action.payload?.id) {
        jobRunsAdapter.addOne(state, action.payload);
      }
    },
    updateOne: (state, action) => {
      ensureSubstates(state);
      jobRunsAdapter.updateOne(state, action.payload);
    },
    removeOne: (state, action) => {
      ensureSubstates(state);
      jobRunsAdapter.removeOne(state, String(action.payload));
    },

    // ── Volatile Working State Reducers ──
    selectJobRun: (state, action) => {
      ensureSubstates(state);
      state.working.selectedRunId = action.payload ? String(action.payload) : null;
    },
    setJobConfirmModalOpen: (state, action) => {
      ensureSubstates(state);
      state.working.showConfirmModal = Boolean(action.payload);
    },
    clearJobMessages: (state) => {
      ensureSubstates(state);
      state.working.errorMessage = '';
      state.working.successMessage = '';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchJobRuns.pending, (state) => {
        ensureSubstates(state);
        if (state.status === 'idle') state.status = 'loading';
      })
      .addCase(fetchJobRuns.fulfilled, (state, action) => {
        ensureSubstates(state);
        const items = (Array.isArray(action.payload) ? action.payload : []).filter(
          (r) => r && r.id,
        );
        jobRunsAdapter.setAll(state, items);
        state.status = 'succeeded';
        state.error = null;
        state.lastFetchedAt = new Date().toISOString();
      })
      .addCase(fetchJobRuns.rejected, (state, action) => {
        ensureSubstates(state);
        state.status = 'failed';
        state.error =
          action.payload?.serverMessage ||
          action.payload?.message ||
          action.error?.message ||
          'Failed to fetch job runs.';
      })

      .addCase(fetchJobRunById.fulfilled, (state, action) => {
        ensureSubstates(state);
        if (action.payload?.id) {
          jobRunsAdapter.upsertOne(state, action.payload);
        }
      })

      .addCase(triggerJobTick.pending, (state) => {
        ensureSubstates(state);
        state.working.showConfirmModal = false;
        state.working.isTriggering = true;
        state.working.errorMessage = '';
        state.working.successMessage = '';
      })
      .addCase(triggerJobTick.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.working.isTriggering = false;
        const runId = action.payload?.runId || 'initiated';
        state.working.successMessage = `Job tick accepted successfully (Run ID: ${runId}).`;
      })
      .addCase(triggerJobTick.rejected, (state, action) => {
        ensureSubstates(state);
        state.working.isTriggering = false;
        const payload = action.payload || {};
        const code = payload.code || '';
        state.working.errorMessage =
          payload.serverMessage ||
          payload.message ||
          action.error?.message ||
          (code === 'JOB_ALREADY_RUNNING'
            ? 'A job tick is already in progress.'
            : 'Failed to trigger job tick.');
      })

      .addCase(sessionReset, () => createInitialJobRunsState());

    addRouteReset(builder, clearWorkingJobRunsState);
  },
});

export const {
  setAll,
  addOne,
  updateOne,
  removeOne,
  selectJobRun,
  setJobConfirmModalOpen,
  clearJobMessages,
} = jobRunsSlice.actions;

export default jobRunsSlice.reducer;
