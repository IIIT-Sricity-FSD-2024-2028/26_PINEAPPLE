import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import { addRouteReset } from '../utils/routeReset';
import { sessionReset } from '../actions/appActions';
import {
  cancelAbandonmentReview,
  confirmAbandonmentReview,
  fetchMyAbandonmentReviews,
  fetchProjectAbandonmentReview,
  openAbandonmentReview,
} from '../thunks/abandonmentReviewsThunks';

function deriveReviewId(review) {
  if (review?.id) return String(review.id);
  if (review?.review?.id) return String(review.review.id);
  if (review?.projectId) return `project:${String(review.projectId)}`;
  return '';
}

/**
 * Abandonment Reviews Repository Slice (`abandonmentReviewsSlice`)
 * ================================================================
 * Manages mentor inactivity status and 48-hour abandonment review workflows
 * across OwnedWorkspace (open/banner), MentoredProjects, and Dashboard ("Still active").
 *
 * Route-Leave Reset (Reading B — Decision D3):
 * - CLEARS on `routeChanged`: `working` (`reportModalOpen`, `reportReason`, `reportError`).
 * - STAYS across `routeChanged`: `entities`, `myOpenReviewIds`, `byProjectInfo`.
 * - Full reset on `sessionReset`.
 */
export const abandonmentReviewsAdapter = createEntityAdapter({
  selectId: deriveReviewId,
});

export function createInitialAbandonmentWorking() {
  return {
    reportModalOpen: false,
    reportReason: '',
    reportError: '',
  };
}

export function createInitialAbandonmentState() {
  return abandonmentReviewsAdapter.getInitialState({
    myOpenReviewIds: [],
    myReviewsStatus: 'idle',
    myReviewsError: null,
    myReviewsLastFetchedAt: null,
    byProjectInfo: {},
    byProjectStatus: {},
    confirmingIds: {},
    openingByProject: {},
    error: null,
    working: createInitialAbandonmentWorking(),
  });
}

function ensureSubstates(state) {
  if (!state.entities) state.entities = {};
  if (!Array.isArray(state.ids)) state.ids = [];
  if (!Array.isArray(state.myOpenReviewIds)) state.myOpenReviewIds = [];
  if (!state.byProjectInfo) state.byProjectInfo = {};
  if (!state.byProjectStatus) state.byProjectStatus = {};
  if (!state.confirmingIds) state.confirmingIds = {};
  if (!state.openingByProject) state.openingByProject = {};
  if (!state.working) state.working = createInitialAbandonmentWorking();
}

function clearWorkingAbandonmentState(state) {
  state.working = createInitialAbandonmentWorking();
  state.error = null;
}

const abandonmentReviewsSlice = createSlice({
  name: 'abandonmentReviews',
  initialState: createInitialAbandonmentState(),
  reducers: {
    // ── Four Explicit CRUD Reducers (SPEC 2, D2) ──
    setAll: (state, action) => {
      ensureSubstates(state);
      const items = Array.isArray(action.payload) ? action.payload : [];
      abandonmentReviewsAdapter.setAll(state, items);
      state.myOpenReviewIds = items.map(deriveReviewId).filter(Boolean);
    },
    addOne: (state, action) => {
      ensureSubstates(state);
      const rev = action.payload;
      const rid = deriveReviewId(rev);
      if (!rid) return;
      abandonmentReviewsAdapter.addOne(state, rev);
      if (!state.myOpenReviewIds.includes(rid)) {
        state.myOpenReviewIds.push(rid);
      }
    },
    updateOne: (state, action) => {
      ensureSubstates(state);
      abandonmentReviewsAdapter.updateOne(state, action.payload);
    },
    removeOne: (state, action) => {
      ensureSubstates(state);
      const rid = String(action.payload);
      abandonmentReviewsAdapter.removeOne(state, rid);
      state.myOpenReviewIds = state.myOpenReviewIds.filter((id) => id !== rid);
    },

    // ── Volatile Working State Reducers ──
    openReportMentorModal: (state) => {
      ensureSubstates(state);
      state.working.reportModalOpen = true;
      state.working.reportReason = '';
      state.working.reportError = '';
    },
    closeReportMentorModal: (state) => {
      ensureSubstates(state);
      state.working.reportModalOpen = false;
      state.working.reportReason = '';
      state.working.reportError = '';
    },
    setReportMentorReason: (state, action) => {
      ensureSubstates(state);
      state.working.reportReason =
        typeof action.payload === 'string' ? action.payload : '';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProjectAbandonmentReview.pending, (state, action) => {
        ensureSubstates(state);
        const arg = action.meta.arg;
        const pid = String(
          typeof arg === 'object' && arg !== null ? arg.projectId : arg,
        );
        if (pid) state.byProjectStatus[pid] = 'loading';
      })
      .addCase(fetchProjectAbandonmentReview.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { projectId, info } = action.payload || {};
        const pid = String(projectId || '');
        if (!pid) return;
        state.byProjectStatus[pid] = 'succeeded';
        state.byProjectInfo[pid] = info || null;
        if (info && deriveReviewId(info)) {
          abandonmentReviewsAdapter.upsertOne(state, {
            ...info,
            projectId: info.projectId || pid,
          });
        }
      })
      .addCase(fetchProjectAbandonmentReview.rejected, (state, action) => {
        ensureSubstates(state);
        const arg = action.meta.arg;
        const pid = String(
          typeof arg === 'object' && arg !== null ? arg.projectId : arg,
        );
        if (pid) state.byProjectStatus[pid] = 'failed';
      })

      .addCase(fetchMyAbandonmentReviews.pending, (state) => {
        ensureSubstates(state);
        state.myReviewsStatus = 'loading';
        state.myReviewsError = null;
      })
      .addCase(fetchMyAbandonmentReviews.fulfilled, (state, action) => {
        ensureSubstates(state);
        const list = Array.isArray(action.payload)
          ? action.payload.filter((r) => deriveReviewId(r))
          : [];
        abandonmentReviewsAdapter.upsertMany(state, list);
        state.myOpenReviewIds = list.map(deriveReviewId);
        state.myReviewsStatus = 'succeeded';
        state.myReviewsLastFetchedAt = new Date().toISOString();
      })
      .addCase(fetchMyAbandonmentReviews.rejected, (state, action) => {
        ensureSubstates(state);
        state.myReviewsStatus = 'failed';
        state.myReviewsError = action.payload || {
          message: action.error?.message,
        };
      })

      .addCase(openAbandonmentReview.pending, (state, action) => {
        ensureSubstates(state);
        const pid = String(action.meta.arg?.projectId || '');
        if (pid) state.openingByProject[pid] = true;
        state.working.reportError = '';
      })
      .addCase(openAbandonmentReview.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { projectId, review } = action.payload || {};
        const pid = String(projectId || '');
        if (pid) delete state.openingByProject[pid];
        if (review && deriveReviewId(review)) {
          abandonmentReviewsAdapter.upsertOne(state, {
            ...review,
            projectId: review.projectId || pid,
          });
          if (pid && !state.byProjectInfo[pid]) {
            state.byProjectInfo[pid] = review;
          }
        }
        state.working.reportModalOpen = false;
        state.working.reportReason = '';
        state.working.reportError = '';
      })
      .addCase(openAbandonmentReview.rejected, (state, action) => {
        ensureSubstates(state);
        const pid = String(action.meta.arg?.projectId || '');
        if (pid) delete state.openingByProject[pid];
        const err = action.payload || { message: action.error?.message };
        state.working.reportError =
          err?.message || 'Unable to open abandonment review.';
      })

      .addCase(confirmAbandonmentReview.pending, (state, action) => {
        ensureSubstates(state);
        const arg = action.meta.arg;
        const rid = String(
          typeof arg === 'object' && arg !== null ? arg.reviewId || arg.id : arg,
        );
        if (rid) state.confirmingIds[rid] = true;
      })
      .addCase(confirmAbandonmentReview.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { reviewId, review } = action.payload || {};
        const rid = String(reviewId || '');
        delete state.confirmingIds[rid];
        state.myOpenReviewIds = state.myOpenReviewIds.filter((id) => id !== rid);
        if (rid && state.entities[rid]) {
          abandonmentReviewsAdapter.updateOne(state, {
            id: rid,
            changes: {
              ...(review || {}),
              status: review?.status || 'confirmed',
            },
          });
        }
      })
      .addCase(confirmAbandonmentReview.rejected, (state, action) => {
        ensureSubstates(state);
        const arg = action.meta.arg;
        const rid = String(
          typeof arg === 'object' && arg !== null ? arg.reviewId || arg.id : arg,
        );
        if (rid) delete state.confirmingIds[rid];
      })

      .addCase(cancelAbandonmentReview.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { reviewId, review } = action.payload || {};
        const rid = String(reviewId || '');
        state.myOpenReviewIds = state.myOpenReviewIds.filter((id) => id !== rid);
        if (rid && state.entities[rid]) {
          abandonmentReviewsAdapter.updateOne(state, {
            id: rid,
            changes: {
              ...(review || {}),
              status: review?.status || 'cancelled',
            },
          });
        }
      })

      .addCase(sessionReset, () => createInitialAbandonmentState());

    addRouteReset(builder, clearWorkingAbandonmentState);
  },
});

export const {
  setAll,
  addOne,
  updateOne,
  removeOne,
  openReportMentorModal,
  closeReportMentorModal,
  setReportMentorReason,
} = abandonmentReviewsSlice.actions;

export default abandonmentReviewsSlice.reducer;
