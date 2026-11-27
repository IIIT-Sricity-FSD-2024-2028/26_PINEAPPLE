import { createAsyncThunk } from '@reduxjs/toolkit';
import mentorMarketplaceApi from '../../services/mentorMarketplaceApi';
import { normalizeThunkError } from '../utils/thunkError';
import {
  fetchAllSessionsAdmin,
  fetchMentorSessions,
  fetchMySessions,
  fetchSessionAdminStats,
} from './mentorSessionsThunks';
import { fetchEscrowById } from './escrowAccountsThunks';

/**
 * Generates a unique Idempotency-Key per checkout dialog open.
 */
export function generateIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Canonical payment error translator used by checkout UI and payment thunks.
 * `NETWORK_ERROR` is returned ONLY when there is no HTTP response from the server.
 */
export function formatPaymentError(err) {
  if (!err) return 'An unexpected error occurred. Please try again.';

  const hasHttpResponse =
    Boolean(err.statusCode && err.statusCode > 0) ||
    Boolean(err.status && err.status > 0) ||
    Boolean(err.serverMessage);

  if (
    !hasHttpResponse &&
    (err.isNetworkError ||
      err.code === 'NETWORK_ERROR' ||
      err instanceof TypeError)
  ) {
    return 'Network error. Please check your connection and try again.';
  }

  const code = err?.code || err?.data?.code;

  switch (code) {
    case 'EMAIL_NOT_VERIFIED':
      return 'Verify your email to book a mentor';
    case 'SESSION_INVALID':
      return 'Your session expired. Please sign in again';
    case 'ALREADY_PAID': {
      const alreadyPaidRx = /already\s+(?:been\s+)?paid\s+for/i;
      if (err?.serverMessage && alreadyPaidRx.test(err.serverMessage)) {
        return err.serverMessage;
      }
      if (err?.message && alreadyPaidRx.test(err.message)) {
        return err.message;
      }
      return 'This booking has already been paid';
    }
    case 'PAYMENT_EXPIRED':
    case 'HOLD_EXPIRED':
      return 'This payment hold has expired. Please book again.';
    case 'CANNOT_BOOK_SELF':
      return (
        err?.serverMessage ||
        err?.message ||
        'You cannot book yourself as a mentor for your own project.'
      );
    case 'CANNOT_BOOK_OWN_PROJECT_MENTOR':
    case 'MENTOR_IS_PROJECT_MEMBER':
      return (
        err?.serverMessage ||
        err?.message ||
        'A project owner or active collaborator cannot be booked as mentor on the same project.'
      );
    case 'PROJECT_NOT_BOOKABLE':
      return (
        err?.serverMessage ||
        err?.message ||
        'This project is not in a live, bookable state.'
      );
    case 'MENTOR_SUSPENDED':
      return (
        err?.serverMessage ||
        err?.message ||
        'This mentor account is suspended and cannot be booked.'
      );
    case 'MENTOR_UNAVAILABLE':
      return (
        err?.serverMessage ||
        err?.message ||
        'This mentor is currently unavailable.'
      );
    case 'MENTOR_AT_CAPACITY':
      return (
        err?.serverMessage ||
        err?.message ||
        'This mentor is currently at full active mentee capacity.'
      );
    default:
      if (
        err?.status === 409 ||
        err?.statusCode === 409 ||
        (err?.message && err.message.toLowerCase().includes('already paid'))
      ) {
        return (
          err.serverMessage ||
          err.message ||
          'This session has already been paid for.'
        );
      }
      return (
        err?.serverMessage ||
        err?.message ||
        'Failed to complete payment. Please try again.'
      );
  }
}

async function refetchPostPaymentState(dispatch, res, options = {}) {
  const sidEscrowId = res?.session?.escrowId || res?.escrow?.id;
  const tasks = [dispatch(fetchMySessions({ force: true }))];

  if (
    sidEscrowId &&
    typeof mentorMarketplaceApi?.getEscrowById === 'function'
  ) {
    tasks.push(dispatch(fetchEscrowById({ escrowId: sidEscrowId })).catch(() => null));
  }

  if (options.includeAdminStats) {
    tasks.push(dispatch(fetchSessionAdminStats({ force: true })).catch(() => null));
  }

  await Promise.allSettled(tasks);
}

/**
 * Confirms Demo Payment for a booked mentor session (`POST /mentor-marketplace/sessions/:id/confirm-payment`).
 * Reads `Idempotency-Key` from Redux store (`payments.checkout.idempotencyKey`),
 * prevents concurrent double-clicks via `condition`, and refetches session/escrow/totals on success.
 */
export const confirmSessionPayment = createAsyncThunk(
  'payments/confirmSessionPayment',
  async (arg, { getState, dispatch, rejectWithValue }) => {
    try {
      const opts = typeof arg === 'object' && arg !== null ? arg : { sessionId: arg };
      const sid = String(opts.sessionId || '');
      const role = opts.role !== undefined ? opts.role : null;
      const checkoutKey =
        opts.idempotencyKey ||
        getState()?.payments?.checkout?.idempotencyKey ||
        '';
      const headers = checkoutKey ? { 'Idempotency-Key': checkoutKey } : {};

      const res = await mentorMarketplaceApi.confirmPayment(sid, role, headers);
      await refetchPostPaymentState(dispatch, res, {
        includeAdminStats: Boolean(opts.includeAdminStats),
      });

      return {
        sessionId: sid,
        session: res?.session || null,
        escrow: res?.escrow || null,
        paymentIntent: res?.paymentIntent || null,
        totals: res?.totals || null,
        raw: res,
      };
    } catch (err) {
      const normalized = normalizeThunkError(err);
      return rejectWithValue({
        ...normalized,
        formattedMessage: formatPaymentError({ ...err, ...normalized }),
      });
    }
  },
  {
    condition: (arg, { getState }) => {
      const opts = typeof arg === 'object' && arg !== null ? arg : { sessionId: arg };
      if (!opts?.sessionId) return false;
      const checkout = getState()?.payments?.checkout;
      return checkout?.confirmStatus !== 'loading';
    },
  },
);

/**
 * Legacy pay route (`POST /mentor-marketplace/sessions/:id/pay`) reusing store `Idempotency-Key`.
 */
export const payMentorSession = createAsyncThunk(
  'payments/payMentorSession',
  async (arg, { getState, dispatch, rejectWithValue }) => {
    try {
      const opts = typeof arg === 'object' && arg !== null ? arg : { sessionId: arg };
      const sid = String(opts.sessionId || '');
      const checkoutKey =
        opts.idempotencyKey ||
        getState()?.payments?.checkout?.idempotencyKey ||
        '';
      const headers = checkoutKey ? { 'Idempotency-Key': checkoutKey } : {};
      const res =
        opts.role !== undefined
          ? await mentorMarketplaceApi.paySession(sid, headers, opts.role)
          : await mentorMarketplaceApi.paySession(sid, headers);

      await refetchPostPaymentState(dispatch, res, {
        includeAdminStats: Boolean(opts.includeAdminStats),
      });

      return {
        sessionId: sid,
        session: res?.session || null,
        escrow: res?.escrow || null,
        totals: res?.totals || null,
        raw: res,
      };
    } catch (err) {
      const normalized = normalizeThunkError(err);
      return rejectWithValue({
        ...normalized,
        formattedMessage: formatPaymentError({ ...err, ...normalized }),
      });
    }
  },
  {
    condition: (arg, { getState }) => {
      const opts = typeof arg === 'object' && arg !== null ? arg : { sessionId: arg };
      if (!opts?.sessionId) return false;
      const checkout = getState()?.payments?.checkout;
      return checkout?.confirmStatus !== 'loading';
    },
  },
);

/**
 * Cancels an unconfirmed payment session hold (`POST /mentor-marketplace/sessions/:id/cancel-payment`).
 */
export const cancelSessionPayment = createAsyncThunk(
  'payments/cancelSessionPayment',
  async (arg, { dispatch, rejectWithValue }) => {
    try {
      const opts = typeof arg === 'object' && arg !== null ? arg : { sessionId: arg };
      const sid = String(opts.sessionId || '');
      if (sid && typeof mentorMarketplaceApi?.cancelPayment === 'function') {
        await mentorMarketplaceApi.cancelPayment(sid).catch(() => null);
        await dispatch(fetchMySessions({ force: true })).catch(() => null);
      }
      return { sessionId: sid };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Retries payout for a `payout_pending` session and refreshes the caller's session list + stats.
 */
export const retryPayoutAndRefresh = createAsyncThunk(
  'payments/retryPayoutAndRefresh',
  async ({ sessionId, scope = 'mentor', role }, { dispatch, rejectWithValue }) => {
    try {
      const sid = String(sessionId);
      const res =
        role !== undefined
          ? await mentorMarketplaceApi.retryPayout(sid, role)
          : await mentorMarketplaceApi.retryPayout(sid);
      if (scope === 'admin') {
        await Promise.allSettled([
          dispatch(fetchAllSessionsAdmin({ force: true })),
          dispatch(fetchSessionAdminStats({ force: true })),
        ]);
      } else {
        await dispatch(fetchMentorSessions({ force: true }));
      }
      return {
        sessionId: sid,
        session: res && typeof res === 'object' ? res : null,
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);
