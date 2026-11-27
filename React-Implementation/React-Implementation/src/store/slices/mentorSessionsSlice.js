import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import { addRouteReset } from '../utils/routeReset';
import { sessionReset } from '../actions/appActions';
import {
  acceptMentorSession,
  addMentorSessionNote,
  bookMentorSession,
  cancelMentorSession,
  completeMentorSession,
  declineMentorSession,
  fetchAllSessionsAdmin,
  fetchMentoredProjects,
  fetchMentorSessions,
  fetchMySessions,
  fetchSessionAdminStats,
  retrySessionPayout,
  reviewMentorSession,
  startMentorSession,
} from '../thunks/mentorSessionsThunks';
import { submitSessionFeedback } from '../thunks/sessionFeedbackThunks';
import {
  cancelSessionPayment,
  confirmSessionPayment,
  payMentorSession,
  retryPayoutAndRefresh,
} from '../thunks/paymentsThunks';
import {
  decideSessionDispute,
  openSessionDispute,
} from '../thunks/sessionDisputesThunks';

function deriveSessionId(session) {
  return String(session?.id || session?.projectId || '');
}

/**
 * Mentor Sessions Repository Slice (`mentorSessionsSlice`)
 * ========================================================
 * Manages mentorship sessions (`sessions/mine`, `sessions/mentor-view`,
 * admin `sessions`), mentored projects (`mentors/mentored-projects` storing
 * server `items` and `counts` verbatim), and pre-payment booking workflow.
 *
 * Route-Leave Reset (Reading B — Decision D3):
 * - CLEARS on `routeChanged`: `working` (`mentoredFilter`, `directoryTab`,
 *   `declineModalOpen`, `declineError`, `selectedDeclineSessionId`,
 *   `actionFeedback`, `bookStatus`, `bookError`).
 * - STAYS across `routeChanged`: session `entities`, `mySessionIds`,
 *   `mentorSessionIds`, `mentoredProjectsById`, `mentoredProjectIds`,
 *   `mentoredCounts`, and `activeCheckout` (payment intent kept until paid/cancelled).
 * - Full reset on `sessionReset`.
 */
export const mentorSessionsAdapter = createEntityAdapter({
  selectId: deriveSessionId,
});

export function createInitialMentorSessionsWorking() {
  return {
    mentoredFilter: 'all',
    directoryTab: 'browse',
    requestsViewIds: [],
    declineModalOpen: false,
    selectedDeclineSessionId: null,
    declineError: '',
    actionFeedback: null,
    bookStatus: 'idle',
    bookError: null,
  };
}

export function createInitialMentorSessionsState() {
  return mentorSessionsAdapter.getInitialState({
    mySessionIds: [],
    mySessionsStatus: 'idle',
    mySessionsError: null,
    mySessionsLastFetchedAt: null,
    mentorSessionIds: [],
    mentorSessionsStatus: 'idle',
    mentorSessionsError: null,
    mentorSessionsLastFetchedAt: null,
    allSessionIds: [],
    allSessionsStatus: 'idle',
    allSessionsLastFetchedAt: null,
    mentoredProjectsById: {},
    mentoredProjectIds: [],
    mentoredCounts: { all: 0, active: 0, completed: 0 },
    mentoredProjectsStatus: 'idle',
    mentoredProjectsError: null,
    mentoredProjectsLastFetchedAt: null,
    adminStats: null,
    processingIds: {},
    activeCheckout: null,
    error: null,
    working: createInitialMentorSessionsWorking(),
  });
}

function ensureSubstates(state) {
  if (!state.entities) state.entities = {};
  if (!Array.isArray(state.ids)) state.ids = [];
  if (!Array.isArray(state.mySessionIds)) state.mySessionIds = [];
  if (!Array.isArray(state.mentorSessionIds)) state.mentorSessionIds = [];
  if (!Array.isArray(state.allSessionIds)) state.allSessionIds = [];
  if (!state.mentoredProjectsById) state.mentoredProjectsById = {};
  if (!Array.isArray(state.mentoredProjectIds)) state.mentoredProjectIds = [];
  if (!state.mentoredCounts) {
    state.mentoredCounts = { all: 0, active: 0, completed: 0 };
  }
  if (!state.processingIds) state.processingIds = {};
  if (!state.working) state.working = createInitialMentorSessionsWorking();
}

function clearWorkingMentorSessionsState(state) {
  state.working = createInitialMentorSessionsWorking();
  state.error = null;
}

const mentorSessionsSlice = createSlice({
  name: 'mentorSessions',
  initialState: createInitialMentorSessionsState(),
  reducers: {
    // ── Four Explicit CRUD Reducers (SPEC 2, D2) ──
    setAll: (state, action) => {
      ensureSubstates(state);
      const items = Array.isArray(action.payload) ? action.payload : [];
      mentorSessionsAdapter.setAll(state, items);
      state.mySessionIds = items.map(deriveSessionId).filter(Boolean);
    },
    addOne: (state, action) => {
      ensureSubstates(state);
      const item = action.payload;
      const sid = deriveSessionId(item);
      if (!sid) return;
      mentorSessionsAdapter.addOne(state, item);
      if (!state.mySessionIds.includes(sid)) {
        state.mySessionIds.push(sid);
      }
    },
    updateOne: (state, action) => {
      ensureSubstates(state);
      mentorSessionsAdapter.updateOne(state, action.payload);
    },
    removeOne: (state, action) => {
      ensureSubstates(state);
      const id = String(action.payload);
      mentorSessionsAdapter.removeOne(state, id);
      state.mySessionIds = state.mySessionIds.filter((s) => s !== id);
      state.mentorSessionIds = state.mentorSessionIds.filter((s) => s !== id);
      state.allSessionIds = state.allSessionIds.filter((s) => s !== id);
    },

    // ── Volatile Working State Reducers ──
    setMentoredFilter: (state, action) => {
      ensureSubstates(state);
      state.working.mentoredFilter = action.payload || 'all';
    },
    setDirectoryTab: (state, action) => {
      ensureSubstates(state);
      state.working.directoryTab = action.payload || 'browse';
    },
    openSessionDeclineModal: (state, action) => {
      ensureSubstates(state);
      state.working.declineModalOpen = true;
      state.working.selectedDeclineSessionId = action.payload
        ? String(action.payload)
        : null;
      state.working.declineError = '';
    },
    closeSessionDeclineModal: (state) => {
      ensureSubstates(state);
      state.working.declineModalOpen = false;
      state.working.selectedDeclineSessionId = null;
      state.working.declineError = '';
    },
    setSessionDeclineError: (state, action) => {
      ensureSubstates(state);
      state.working.declineError =
        typeof action.payload === 'string' ? action.payload : '';
    },
    setSessionActionFeedback: (state, action) => {
      ensureSubstates(state);
      state.working.actionFeedback = action.payload || null;
    },
    clearSessionBookingError: (state) => {
      ensureSubstates(state);
      state.working.bookError = null;
      state.working.bookStatus = 'idle';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMySessions.pending, (state) => {
        ensureSubstates(state);
        state.mySessionsStatus = 'loading';
        state.mySessionsError = null;
      })
      .addCase(fetchMySessions.fulfilled, (state, action) => {
        ensureSubstates(state);
        const list = Array.isArray(action.payload)
          ? action.payload.filter((s) => deriveSessionId(s))
          : [];
        mentorSessionsAdapter.upsertMany(state, list);
        state.mySessionIds = list.map(deriveSessionId);
        state.mySessionsStatus = 'succeeded';
        state.mySessionsLastFetchedAt = new Date().toISOString();
      })
      .addCase(fetchMySessions.rejected, (state, action) => {
        ensureSubstates(state);
        state.mySessionsStatus = 'failed';
        state.mySessionsError = action.payload || {
          message: action.error?.message,
        };
      })

      .addCase(fetchMentorSessions.pending, (state) => {
        ensureSubstates(state);
        state.mentorSessionsStatus = 'loading';
        state.mentorSessionsError = null;
      })
      .addCase(fetchMentorSessions.fulfilled, (state, action) => {
        ensureSubstates(state);
        const raw = action.payload;
        const arr = Array.isArray(raw)
          ? raw
          : raw?.sessions || raw?.items || raw?.data || [];
        const list = Array.isArray(arr)
          ? arr.filter((s) => deriveSessionId(s))
          : [];
        mentorSessionsAdapter.upsertMany(state, list);
        state.mentorSessionIds = list.map(deriveSessionId);
        const currentViewIds = Array.isArray(state.working.requestsViewIds)
          ? state.working.requestsViewIds
          : [];
        for (const s of list) {
          const sid = deriveSessionId(s);
          if (s.status === 'escrow_funded' && sid && !currentViewIds.includes(sid)) {
            currentViewIds.push(sid);
          }
        }
        state.working.requestsViewIds = currentViewIds;
        state.mentorSessionsStatus = 'succeeded';
        state.mentorSessionsLastFetchedAt = new Date().toISOString();
      })
      .addCase(fetchMentorSessions.rejected, (state, action) => {
        ensureSubstates(state);
        state.mentorSessionsStatus = 'failed';
        state.mentorSessionsError = action.payload || {
          message: action.error?.message,
        };
      })

      .addCase(fetchMentoredProjects.pending, (state) => {
        ensureSubstates(state);
        state.mentoredProjectsStatus = 'loading';
        state.mentoredProjectsError = null;
      })
      .addCase(fetchMentoredProjects.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { items = [], counts } = action.payload || {};
        const nextMap = {};
        const nextIds = [];
        for (const item of items) {
          const id = String(item?.projectId || item?.id || '');
          if (!id) continue;
          nextMap[id] = item;
          if (!nextIds.includes(id)) nextIds.push(id);
        }
        state.mentoredProjectsById = nextMap;
        state.mentoredProjectIds = nextIds;
        state.mentoredCounts = counts || {
          all: nextIds.length,
          active: 0,
          completed: 0,
        };
        state.mentoredProjectsStatus = 'succeeded';
        state.mentoredProjectsLastFetchedAt = new Date().toISOString();
      })
      .addCase(fetchMentoredProjects.rejected, (state, action) => {
        ensureSubstates(state);
        state.mentoredProjectsStatus = 'failed';
        state.mentoredProjectsError = action.payload || {
          message: action.error?.message,
        };
      })

      .addCase(fetchAllSessionsAdmin.pending, (state) => {
        ensureSubstates(state);
        state.allSessionsStatus = 'loading';
      })
      .addCase(fetchAllSessionsAdmin.fulfilled, (state, action) => {
        ensureSubstates(state);
        const list = Array.isArray(action.payload)
          ? action.payload.filter((s) => deriveSessionId(s))
          : [];
        mentorSessionsAdapter.upsertMany(state, list);
        state.allSessionIds = list.map(deriveSessionId);
        state.allSessionsStatus = 'succeeded';
        state.allSessionsLastFetchedAt = new Date().toISOString();
      })
      .addCase(fetchSessionAdminStats.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.adminStats = action.payload || null;
      })

      .addCase(bookMentorSession.pending, (state) => {
        ensureSubstates(state);
        state.working.bookStatus = 'loading';
        state.working.bookError = null;
      })
      .addCase(bookMentorSession.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.working.bookStatus = 'succeeded';
        const res = action.payload;
        if (res?.session?.id) {
          const sid = String(res.session.id);
          mentorSessionsAdapter.upsertOne(state, res.session);
          if (!state.mySessionIds.includes(sid)) {
            state.mySessionIds.push(sid);
          }
          state.activeCheckout = {
            session: res.session,
            paymentIntent: res.paymentIntent || null,
          };
        }
      })
      .addCase(bookMentorSession.rejected, (state, action) => {
        ensureSubstates(state);
        state.working.bookStatus = 'failed';
        state.working.bookError = action.payload || {
          message: action.error?.message,
        };
      })

      .addCase(acceptMentorSession.pending, (state, action) => {
        ensureSubstates(state);
        const arg = action.meta.arg;
        const sid = String(
          typeof arg === 'object' && arg !== null ? arg.sessionId || arg.id : arg,
        );
        if (sid) state.processingIds[sid] = true;
        state.working.actionFeedback = null;
      })
      .addCase(acceptMentorSession.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { sessionId, session } = action.payload || {};
        const sid = String(sessionId || '');
        delete state.processingIds[sid];
        if (sid && state.entities[sid]) {
          mentorSessionsAdapter.updateOne(state, {
            id: sid,
            changes: {
              ...(session || {}),
              status: session?.status || 'active',
            },
          });
        } else if (session?.id) {
          mentorSessionsAdapter.upsertOne(state, session);
        }
      })
      .addCase(acceptMentorSession.rejected, (state, action) => {
        ensureSubstates(state);
        const arg = action.meta.arg;
        const sid = String(
          typeof arg === 'object' && arg !== null ? arg.sessionId || arg.id : arg,
        );
        if (sid) delete state.processingIds[sid];
        const err = action.payload || { message: action.error?.message };
        state.working.actionFeedback = {
          type: 'error',
          message: err?.message || 'Failed to accept mentorship request.',
        };
      })

      .addCase(declineMentorSession.pending, (state, action) => {
        ensureSubstates(state);
        const sid = String(action.meta.arg?.sessionId || '');
        if (sid) state.processingIds[sid] = true;
        state.working.declineError = '';
      })
      .addCase(declineMentorSession.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { sessionId, payload, session } = action.payload || {};
        const sid = String(sessionId || '');
        delete state.processingIds[sid];
        const reason =
          session?.declineReason ||
          payload?.reason ||
          payload?.explanation ||
          '';
        if (sid && state.entities[sid]) {
          mentorSessionsAdapter.updateOne(state, {
            id: sid,
            changes: {
              ...(session || {}),
              status: session?.status || 'refunded',
              declineReason: reason,
              declinedBy: session?.declinedBy || 'mentor',
            },
          });
        }
        state.working.declineModalOpen = false;
        state.working.selectedDeclineSessionId = null;
        state.working.declineError = '';
      })
      .addCase(declineMentorSession.rejected, (state, action) => {
        ensureSubstates(state);
        const sid = String(action.meta.arg?.sessionId || '');
        if (sid) delete state.processingIds[sid];
        const err = action.payload || { message: action.error?.message };
        state.working.declineError =
          err?.message || 'Failed to decline mentorship request.';
      })

      .addCase(cancelMentorSession.pending, (state, action) => {
        ensureSubstates(state);
        const sid = String(action.meta.arg?.sessionId || '');
        if (sid) state.processingIds[sid] = true;
      })
      .addCase(cancelMentorSession.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { sessionId, session } = action.payload || {};
        const sid = String(sessionId || '');
        delete state.processingIds[sid];
        if (sid && state.entities[sid]) {
          mentorSessionsAdapter.updateOne(state, {
            id: sid,
            changes: {
              ...(session || {}),
              status: session?.status || 'cancelled',
            },
          });
        }
      })
      .addCase(cancelMentorSession.rejected, (state, action) => {
        ensureSubstates(state);
        const sid = String(action.meta.arg?.sessionId || '');
        if (sid) delete state.processingIds[sid];
      })

      .addCase(completeMentorSession.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { sessionId, session } = action.payload || {};
        const sid = String(sessionId || '');
        if (sid && state.entities[sid]) {
          mentorSessionsAdapter.updateOne(state, {
            id: sid,
            changes: {
              ...(session || {}),
              status: session?.status || 'completed',
            },
          });
        }
      })
      .addCase(startMentorSession.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { sessionId, session } = action.payload || {};
        const sid = String(sessionId || '');
        if (sid && state.entities[sid]) {
          mentorSessionsAdapter.updateOne(state, {
            id: sid,
            changes: {
              ...(session || {}),
              status: session?.status || 'active',
            },
          });
        }
      })
      .addCase(retrySessionPayout.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { sessionId, session } = action.payload || {};
        const sid = String(sessionId || '');
        if (sid && session) {
          mentorSessionsAdapter.upsertOne(state, {
            ...(state.entities[sid] || {}),
            ...session,
            id: sid,
          });
        }
      })
      .addCase(addMentorSessionNote.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { sessionId, session } = action.payload || {};
        const sid = String(sessionId || '');
        if (sid && session) {
          mentorSessionsAdapter.upsertOne(state, {
            ...(state.entities[sid] || {}),
            ...session,
            id: sid,
          });
        }
      })
      .addCase(reviewMentorSession.fulfilled, (state, action) => {
        ensureSubstates(state);
        const sid = String(action.payload?.sessionId || '');
        if (sid && state.entities[sid]) {
          mentorSessionsAdapter.updateOne(state, {
            id: sid,
            changes: { hasReview: true },
          });
        }
      })
      // Cross-slice sync when confidential session feedback is submitted
      .addCase(submitSessionFeedback.fulfilled, (state, action) => {
        ensureSubstates(state);
        const sid = String(action.payload?.sessionId || '');
        if (sid && state.entities[sid]) {
          mentorSessionsAdapter.updateOne(state, {
            id: sid,
            changes: { hasFeedback: true },
          });
        }
      })

      // Cross-slice sync for payment confirmation, cancellation, payout retry & disputes
      .addCase(confirmSessionPayment.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { sessionId, session } = action.payload || {};
        const sid = String(session?.id || sessionId || '');
        if (sid && (session || state.entities[sid])) {
          mentorSessionsAdapter.upsertOne(state, {
            ...(state.entities[sid] || {}),
            ...(session || {}),
            id: sid,
            status: session?.status || 'escrow_funded',
          });
        }
        state.activeCheckout = null;
      })
      .addCase(payMentorSession.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { sessionId, session } = action.payload || {};
        const sid = String(session?.id || sessionId || '');
        if (sid && (session || state.entities[sid])) {
          mentorSessionsAdapter.upsertOne(state, {
            ...(state.entities[sid] || {}),
            ...(session || {}),
            id: sid,
            status: session?.status || 'escrow_funded',
          });
        }
        state.activeCheckout = null;
      })
      .addCase(cancelSessionPayment.fulfilled, (state, action) => {
        ensureSubstates(state);
        const sid = String(action.payload?.sessionId || '');
        if (sid && state.entities[sid]) {
          mentorSessionsAdapter.updateOne(state, {
            id: sid,
            changes: { status: 'cancelled' },
          });
        }
        state.activeCheckout = null;
      })
      .addCase(retryPayoutAndRefresh.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { sessionId, session } = action.payload || {};
        const sid = String(sessionId || '');
        if (sid && session) {
          mentorSessionsAdapter.upsertOne(state, {
            ...(state.entities[sid] || {}),
            ...session,
            id: sid,
          });
        }
      })
      .addCase(openSessionDispute.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { sessionId, dispute } = action.payload || {};
        const sid = String(sessionId || '');
        if (sid) {
          mentorSessionsAdapter.upsertOne(state, {
            ...(state.entities[sid] || {}),
            id: sid,
            status: 'disputed',
            disputed: true,
            dispute,
          });
        }
      })
      .addCase(decideSessionDispute.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { session, dispute } = action.payload || {};
        const sid = String(session?.id || dispute?.sessionId || '');
        if (sid && state.entities[sid]) {
          mentorSessionsAdapter.upsertOne(state, {
            ...state.entities[sid],
            ...(session || {}),
            id: sid,
            dispute: dispute || state.entities[sid].dispute,
          });
        }
      })

      .addCase(sessionReset, () => createInitialMentorSessionsState());

    addRouteReset(builder, clearWorkingMentorSessionsState);
  },
});

export const {
  setAll,
  addOne,
  updateOne,
  removeOne,
  setMentoredFilter,
  setDirectoryTab,
  openSessionDeclineModal,
  closeSessionDeclineModal,
  setSessionDeclineError,
  setSessionActionFeedback,
  clearSessionBookingError,
} = mentorSessionsSlice.actions;

export default mentorSessionsSlice.reducer;
