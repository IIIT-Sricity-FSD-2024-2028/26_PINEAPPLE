import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import { addRouteReset } from '../utils/routeReset';
import { sessionReset } from '../actions/appActions';
import {
  bookMentorSession,
  fetchMentorSessions,
  fetchSessionAdminStats,
} from '../thunks/mentorSessionsThunks';
import { fetchMyMentorStats } from '../thunks/mentorProfilesThunks';
import {
  cancelSessionPayment,
  confirmSessionPayment,
  generateIdempotencyKey,
  payMentorSession,
  retryPayoutAndRefresh,
} from '../thunks/paymentsThunks';

function derivePaymentRecordId(record) {
  return String(
    record?.id ||
      record?.paymentIntentId ||
      record?.sessionId ||
      record?.session?.id ||
      '',
  );
}

/**
 * Payments Repository Slice (`paymentsSlice`)
 * ===========================================
 * Manages checkout payment intents, `Idempotency-Key` lifecycle for Demo Payment
 * retries, server-computed admin revenue stats, and server-returned mentor earnings
 * summaries (no frontend money arithmetic).
 *
 * Route-Leave Reset (Reading B — Decision D3 Exception for Idempotency-Key):
 * - CLEARS on `routeChanged`: `working` (`copiedUpi`, `retryError`,
 *   `selectedSessionId`) and top-level transient `error`.
 * - STAYS across `routeChanged` (Decision D3 Exception): `checkout` (including
 *   `idempotencyKey`, `session`, `paymentIntent`, `bookingStep`, `selectedMentorId`,
 *   `selectedMentorName`, `selectedMentorPrice`, `selectedMentorBreakdown`,
 *   `paymentOpenedAtMs`, `confirmStatus`, `cancelStatus`, `error`, `successMessage`),
 *   `entities`, `adminStats`, and `mentorEarnings`.
 * - `checkout.idempotencyKey` is generated once when opening checkout, reused across
 *   all payment retries for that checkout, and cleared ONLY on payment success,
 *   cancellation, explicit checkout close, or `sessionReset`.
 * - Full reset on `sessionReset`.
 */
export const paymentsAdapter = createEntityAdapter({
  selectId: derivePaymentRecordId,
});

export function createInitialCheckoutState() {
  return {
    isOpen: false,
    bookingStep: 'details',
    selectedMentorId: null,
    selectedMentorName: '',
    selectedMentorPrice: null,
    selectedMentorBreakdown: null,
    session: null,
    paymentIntent: null,
    idempotencyKey: '',
    paymentOpenedAtMs: null,
    confirmStatus: 'idle',
    cancelStatus: 'idle',
    error: null,
    successMessage: '',
  };
}

export function createInitialAdminStats() {
  return {
    totalSessions: 0,
    pendingSessions: 0,
    activeSessions: 0,
    completedSessions: 0,
    refundedSessions: 0,
    paymentPendingSessions: 0,
    totalProcessed: 0,
    platformRevenue: 0,
    totalPayouts: 0,
    escrowHeld: 0,
  };
}

export function createInitialMentorEarnings() {
  return {
    totalEarned: 0,
    pendingInEscrow: 0,
    awaitingResponseCount: null,
    completedCount: null,
  };
}

export function createInitialPaymentsWorking() {
  return {
    copiedUpi: false,
    retryError: null,
    selectedSessionId: null,
  };
}

export function createInitialPaymentsState() {
  return paymentsAdapter.getInitialState({
    checkout: createInitialCheckoutState(),
    adminStats: createInitialAdminStats(),
    adminStatsStatus: 'idle',
    mentorEarnings: createInitialMentorEarnings(),
    working: createInitialPaymentsWorking(),
    status: 'idle',
    error: null,
  });
}

function ensureSubstates(state) {
  if (!state.entities) state.entities = {};
  if (!Array.isArray(state.ids)) state.ids = [];
  if (!state.checkout) state.checkout = createInitialCheckoutState();
  if (!state.adminStats) state.adminStats = createInitialAdminStats();
  if (!state.mentorEarnings) state.mentorEarnings = createInitialMentorEarnings();
  if (!state.working) state.working = createInitialPaymentsWorking();
}

function clearWorkingPaymentsState(state) {
  ensureSubstates(state);
  // Intentional D3 exception: `checkout` (and `idempotencyKey`) MUST survive routeChanged.
  state.working = createInitialPaymentsWorking();
  state.error = null;
}

function applyServerMentorEarnings(state, payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return;
  const totals = payload.totals || payload.summary || payload.earnings || payload;
  if (
    totals.totalEarned !== undefined ||
    totals.pendingInEscrow !== undefined ||
    totals.awaitingResponseCount !== undefined ||
    totals.completedCount !== undefined
  ) {
    state.mentorEarnings = {
      totalEarned: Number(totals.totalEarned ?? state.mentorEarnings.totalEarned ?? 0),
      pendingInEscrow: Number(
        totals.pendingInEscrow ?? state.mentorEarnings.pendingInEscrow ?? 0,
      ),
      awaitingResponseCount:
        totals.awaitingResponseCount !== undefined
          ? Number(totals.awaitingResponseCount)
          : state.mentorEarnings.awaitingResponseCount,
      completedCount:
        totals.completedCount !== undefined
          ? Number(totals.completedCount)
          : state.mentorEarnings.completedCount,
    };
  }
}

const paymentsSlice = createSlice({
  name: 'payments',
  initialState: createInitialPaymentsState(),
  reducers: {
    // ── Four Explicit CRUD Reducers (SPEC 2, D2) ──
    setAll: (state, action) => {
      ensureSubstates(state);
      const items = Array.isArray(action.payload) ? action.payload : [];
      paymentsAdapter.setAll(state, items);
    },
    addOne: (state, action) => {
      ensureSubstates(state);
      if (!derivePaymentRecordId(action.payload)) return;
      paymentsAdapter.addOne(state, action.payload);
    },
    updateOne: (state, action) => {
      ensureSubstates(state);
      paymentsAdapter.updateOne(state, action.payload);
    },
    removeOne: (state, action) => {
      ensureSubstates(state);
      paymentsAdapter.removeOne(state, String(action.payload));
    },

    // ── Checkout Lifecycle Reducers ──
    openPaymentCheckout: (state, action) => {
      ensureSubstates(state);
      const mentor = action.payload?.mentor || action.payload || {};
      const existingSameMentorOpen =
        state.checkout.isOpen &&
        state.checkout.selectedMentorId &&
        String(state.checkout.selectedMentorId) === String(mentor.id || '') &&
        Boolean(state.checkout.idempotencyKey);

      const serverBreakdown =
        mentor.totalAmount !== undefined ||
        mentor.platformFee !== undefined ||
        mentor.gatewayFee !== undefined ||
        mentor.mentorPayout !== undefined
          ? {
              price: mentor.agreedPrice ?? mentor.sessionPrice ?? 0,
              platformFee: mentor.platformFee ?? null,
              gatewayFee: mentor.gatewayFee ?? null,
              totalAmount: mentor.totalAmount ?? null,
              mentorPayout: mentor.mentorPayout ?? mentor.payout ?? null,
            }
          : null;

      state.checkout = {
        ...createInitialCheckoutState(),
        isOpen: true,
        bookingStep: 'details',
        selectedMentorId: mentor.id ? String(mentor.id) : null,
        selectedMentorName: mentor.name || '',
        selectedMentorPrice:
          mentor.sessionPrice !== undefined ? Number(mentor.sessionPrice) : null,
        selectedMentorBreakdown: serverBreakdown,
        idempotencyKey: existingSameMentorOpen
          ? state.checkout.idempotencyKey
          : generateIdempotencyKey(),
      };
      state.working.copiedUpi = false;
    },
    resetCheckoutToDetails: (state) => {
      ensureSubstates(state);
      state.checkout = {
        ...createInitialCheckoutState(),
        isOpen: Boolean(state.checkout.selectedMentorId),
        bookingStep: 'details',
        selectedMentorId: state.checkout.selectedMentorId,
        selectedMentorName: state.checkout.selectedMentorName,
        selectedMentorPrice: state.checkout.selectedMentorPrice,
        selectedMentorBreakdown: state.checkout.selectedMentorBreakdown,
        idempotencyKey: generateIdempotencyKey(),
      };
    },
    closePaymentCheckout: (state) => {
      ensureSubstates(state);
      state.checkout = createInitialCheckoutState();
      state.working.copiedUpi = false;
    },
    setCheckoutError: (state, action) => {
      ensureSubstates(state);
      state.checkout.error = action.payload || null;
      state.checkout.successMessage = '';
    },
    setCopiedUpi: (state, action) => {
      ensureSubstates(state);
      state.working.copiedUpi = Boolean(action.payload);
    },
    clearRetryError: (state) => {
      ensureSubstates(state);
      state.working.retryError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(bookMentorSession.fulfilled, (state, action) => {
        ensureSubstates(state);
        const res = action.payload || {};
        const session = res.session || null;
        const paymentIntent = res.paymentIntent || null;
        if (session?.id) {
          if (!state.checkout.idempotencyKey) {
            state.checkout.idempotencyKey = generateIdempotencyKey();
          }
          state.checkout.isOpen = true;
          state.checkout.bookingStep = 'payment';
          state.checkout.session = session;
          state.checkout.paymentIntent = paymentIntent;
          state.checkout.paymentOpenedAtMs = Date.now();
          state.checkout.confirmStatus = 'idle';
          state.checkout.error = null;
          state.checkout.successMessage = '';
          paymentsAdapter.upsertOne(state, {
            id: derivePaymentRecordId(paymentIntent || session),
            sessionId: String(session.id),
            paymentIntentId: paymentIntent?.id || session.paymentIntentId || null,
            agreedPrice: session.agreedPrice ?? null,
            platformFee: session.platformFee ?? null,
            gatewayFee: session.gatewayFee ?? null,
            totalAmount: session.totalAmount ?? paymentIntent?.amount ?? null,
            payout: session.payout ?? null,
            status: session.status || 'payment_pending',
          });
        }
      })

      .addCase(confirmSessionPayment.pending, (state) => {
        ensureSubstates(state);
        state.checkout.confirmStatus = 'loading';
        state.checkout.error = null;
        state.checkout.successMessage = '';
      })
      .addCase(confirmSessionPayment.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { sessionId, session, paymentIntent, totals } = action.payload || {};
        const resolvedTotal =
          session?.totalAmount ??
          state.checkout.session?.totalAmount ??
          state.checkout.paymentIntent?.amount ??
          0;
        // Clear Idempotency-Key immediately upon successful payment
        state.checkout.idempotencyKey = '';
        state.checkout.confirmStatus = 'succeeded';
        state.checkout.error = null;
        if (session) {
          state.checkout.session = {
            ...(state.checkout.session || {}),
            ...session,
          };
        }
        state.checkout.successMessage = `Demo payment confirmed! ₹${resolvedTotal} is secured in escrow. The mentor has been notified.`;
        const recordId = derivePaymentRecordId(paymentIntent || session || { sessionId });
        if (recordId) {
          paymentsAdapter.upsertOne(state, {
            ...(state.entities[recordId] || {}),
            id: recordId,
            sessionId: String(sessionId),
            status: session?.status || 'escrow_funded',
            totalAmount: resolvedTotal,
          });
        }
        if (totals && typeof totals === 'object') {
          state.adminStats = { ...state.adminStats, ...totals };
        }
      })
      .addCase(confirmSessionPayment.rejected, (state, action) => {
        ensureSubstates(state);
        // Intentionally preserve checkout.idempotencyKey so every retry sends the same key
        state.checkout.confirmStatus = 'failed';
        state.checkout.error =
          action.payload?.formattedMessage ||
          action.payload?.message ||
          action.error?.message ||
          'Payment confirmation failed. Please try again.';
      })

      .addCase(payMentorSession.pending, (state) => {
        ensureSubstates(state);
        state.checkout.confirmStatus = 'loading';
        state.checkout.error = null;
      })
      .addCase(payMentorSession.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { sessionId, session, totals } = action.payload || {};
        const resolvedTotal =
          session?.totalAmount ?? state.checkout.session?.totalAmount ?? 0;
        state.checkout.idempotencyKey = '';
        state.checkout.confirmStatus = 'succeeded';
        state.checkout.error = null;
        if (session) state.checkout.session = session;
        state.checkout.successMessage = `Demo payment confirmed! ₹${resolvedTotal} is secured in escrow. The mentor has been notified.`;
        if (sessionId) {
          paymentsAdapter.upsertOne(state, {
            ...(state.entities[String(sessionId)] || {}),
            id: String(sessionId),
            sessionId: String(sessionId),
            status: session?.status || 'escrow_funded',
            totalAmount: resolvedTotal,
          });
        }
        if (totals && typeof totals === 'object') {
          state.adminStats = { ...state.adminStats, ...totals };
        }
      })
      .addCase(payMentorSession.rejected, (state, action) => {
        ensureSubstates(state);
        state.checkout.confirmStatus = 'failed';
        state.checkout.error =
          action.payload?.formattedMessage ||
          action.payload?.message ||
          action.error?.message ||
          'Payment failed. Please try again.';
      })

      .addCase(cancelSessionPayment.pending, (state) => {
        ensureSubstates(state);
        state.checkout.cancelStatus = 'loading';
      })
      .addCase(cancelSessionPayment.fulfilled, (state) => {
        ensureSubstates(state);
        state.checkout = createInitialCheckoutState();
      })
      .addCase(cancelSessionPayment.rejected, (state) => {
        ensureSubstates(state);
        state.checkout = createInitialCheckoutState();
      })

      .addCase(fetchSessionAdminStats.pending, (state) => {
        ensureSubstates(state);
        state.adminStatsStatus = 'loading';
      })
      .addCase(fetchSessionAdminStats.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.adminStatsStatus = 'succeeded';
        if (action.payload && typeof action.payload === 'object') {
          state.adminStats = {
            ...createInitialAdminStats(),
            ...action.payload,
          };
        }
      })
      .addCase(fetchSessionAdminStats.rejected, (state, action) => {
        ensureSubstates(state);
        state.adminStatsStatus = 'failed';
        state.error = action.payload || { message: action.error?.message };
      })

      .addCase(fetchMentorSessions.fulfilled, (state, action) => {
        ensureSubstates(state);
        applyServerMentorEarnings(state, action.payload);
      })
      .addCase(fetchMyMentorStats.fulfilled, (state, action) => {
        ensureSubstates(state);
        applyServerMentorEarnings(state, action.payload);
      })

      .addCase(retryPayoutAndRefresh.rejected, (state, action) => {
        ensureSubstates(state);
        state.working.retryError =
          action.payload?.message ||
          action.error?.message ||
          'Failed to retry payout';
      })

      .addCase(sessionReset, () => createInitialPaymentsState());

    addRouteReset(builder, clearWorkingPaymentsState);
  },
});

export const {
  setAll,
  addOne,
  updateOne,
  removeOne,
  openPaymentCheckout,
  resetCheckoutToDetails,
  closePaymentCheckout,
  setCheckoutError,
  setCopiedUpi,
  clearRetryError,
} = paymentsSlice.actions;

export default paymentsSlice.reducer;
