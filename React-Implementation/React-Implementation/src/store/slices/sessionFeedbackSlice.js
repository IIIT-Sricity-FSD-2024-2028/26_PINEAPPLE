import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import { addRouteReset } from '../utils/routeReset';
import { sessionReset } from '../actions/appActions';
import {
  fetchAdminMentorFeedback,
  submitSessionFeedback,
} from '../thunks/sessionFeedbackThunks';

function deriveFeedbackId(fb) {
  return String(fb?.id || fb?.sessionId || '');
}

/**
 * Session Feedback Repository Slice (`sessionFeedbackSlice`)
 * ============================================================
 * Manages confidential 1-5 post-session feedback submissions (`sessions/:id/feedback`)
 * and admin aggregate mentor feedback + abandonment incident history
 * (`admin/mentors/:id/feedback`).
 *
 * Route-Leave Reset (Reading B — Decision D3):
 * - CLEARS on `routeChanged`: `working` (`targetSessionId`, `modalError`).
 * - STAYS across `routeChanged`: submitted `entities` and `adminSummaryByMentorId`.
 * - Full reset on `sessionReset`.
 */
export const sessionFeedbackAdapter = createEntityAdapter({
  selectId: deriveFeedbackId,
});

export function createInitialSessionFeedbackWorking() {
  return {
    targetSessionId: null,
    modalError: '',
  };
}

export function createInitialSessionFeedbackState() {
  return sessionFeedbackAdapter.getInitialState({
    adminSummaryByMentorId: {},
    byMentorStatus: {},
    byMentorError: {},
    submitStatus: 'idle',
    submitError: null,
    error: null,
    working: createInitialSessionFeedbackWorking(),
  });
}

function ensureSubstates(state) {
  if (!state.entities) state.entities = {};
  if (!Array.isArray(state.ids)) state.ids = [];
  if (!state.adminSummaryByMentorId) state.adminSummaryByMentorId = {};
  if (!state.byMentorStatus) state.byMentorStatus = {};
  if (!state.byMentorError) state.byMentorError = {};
  if (!state.working) state.working = createInitialSessionFeedbackWorking();
}

function clearWorkingSessionFeedbackState(state) {
  state.working = createInitialSessionFeedbackWorking();
  state.submitStatus = 'idle';
  state.submitError = null;
  state.error = null;
}

const sessionFeedbackSlice = createSlice({
  name: 'sessionFeedback',
  initialState: createInitialSessionFeedbackState(),
  reducers: {
    // ── Four Explicit CRUD Reducers (SPEC 2, D2) ──
    setAll: (state, action) => {
      ensureSubstates(state);
      sessionFeedbackAdapter.setAll(
        state,
        Array.isArray(action.payload) ? action.payload : [],
      );
    },
    addOne: (state, action) => {
      ensureSubstates(state);
      if (deriveFeedbackId(action.payload)) {
        sessionFeedbackAdapter.addOne(state, action.payload);
      }
    },
    updateOne: (state, action) => {
      ensureSubstates(state);
      sessionFeedbackAdapter.updateOne(state, action.payload);
    },
    removeOne: (state, action) => {
      ensureSubstates(state);
      sessionFeedbackAdapter.removeOne(state, String(action.payload));
    },

    // ── Working / Modal UI Reducers ──
    openSessionFeedbackModal: (state, action) => {
      ensureSubstates(state);
      state.working.targetSessionId = action.payload
        ? String(action.payload)
        : null;
      state.working.modalError = '';
      state.submitStatus = 'idle';
    },
    closeSessionFeedbackModal: (state) => {
      ensureSubstates(state);
      if (state.submitStatus === 'loading') return;
      state.working.targetSessionId = null;
      state.working.modalError = '';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(submitSessionFeedback.pending, (state) => {
        ensureSubstates(state);
        state.submitStatus = 'loading';
        state.submitError = null;
        state.working.modalError = '';
      })
      .addCase(submitSessionFeedback.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.submitStatus = 'succeeded';
        if (action.payload?.feedback && deriveFeedbackId(action.payload.feedback)) {
          sessionFeedbackAdapter.upsertOne(state, action.payload.feedback);
        }
        state.working.targetSessionId = null;
        state.working.modalError = '';
      })
      .addCase(submitSessionFeedback.rejected, (state, action) => {
        ensureSubstates(state);
        state.submitStatus = 'failed';
        const err = action.payload || { message: action.error?.message };
        state.submitError = err;
        state.working.modalError =
          err?.message || 'Failed to submit session feedback.';
      })

      .addCase(fetchAdminMentorFeedback.pending, (state, action) => {
        ensureSubstates(state);
        const arg = action.meta.arg;
        const mid = String(
          typeof arg === 'object' && arg !== null ? arg.mentorId || arg.id : arg,
        );
        if (mid) state.byMentorStatus[mid] = 'loading';
      })
      .addCase(fetchAdminMentorFeedback.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { mentorId, data } = action.payload || {};
        const mid = String(mentorId || '');
        if (!mid) return;
        state.byMentorStatus[mid] = 'succeeded';
        state.adminSummaryByMentorId[mid] = data || null;
        if (Array.isArray(data?.feedback)) {
          sessionFeedbackAdapter.upsertMany(
            state,
            data.feedback.filter((f) => deriveFeedbackId(f)),
          );
        }
      })
      .addCase(fetchAdminMentorFeedback.rejected, (state, action) => {
        ensureSubstates(state);
        const arg = action.meta.arg;
        const mid = String(
          typeof arg === 'object' && arg !== null ? arg.mentorId || arg.id : arg,
        );
        if (mid) {
          state.byMentorStatus[mid] = 'failed';
          state.byMentorError[mid] = action.payload || {
            message: action.error?.message,
          };
        }
      })

      .addCase(sessionReset, () => createInitialSessionFeedbackState());

    addRouteReset(builder, clearWorkingSessionFeedbackState);
  },
});

export const {
  setAll,
  addOne,
  updateOne,
  removeOne,
  openSessionFeedbackModal,
  closeSessionFeedbackModal,
} = sessionFeedbackSlice.actions;

export default sessionFeedbackSlice.reducer;
