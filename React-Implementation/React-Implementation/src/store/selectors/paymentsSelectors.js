import { createSelector } from '@reduxjs/toolkit';
import {
  createInitialAdminStats,
  createInitialCheckoutState,
  createInitialMentorEarnings,
  createInitialPaymentsWorking,
  paymentsAdapter,
} from '../slices/paymentsSlice';

const FALLBACK_CHECKOUT = createInitialCheckoutState();
const FALLBACK_ADMIN_STATS = createInitialAdminStats();
const FALLBACK_MENTOR_EARNINGS = createInitialMentorEarnings();
const FALLBACK_WORKING = createInitialPaymentsWorking();

export const selectPaymentsState = (state) => state?.payments;

export const paymentsEntitySelectors = paymentsAdapter.getSelectors(
  selectPaymentsState,
);

export const selectPaymentCheckout = (state) =>
  state?.payments?.checkout || FALLBACK_CHECKOUT;

export const selectCheckoutIdempotencyKey = (state) =>
  state?.payments?.checkout?.idempotencyKey || '';

export const selectCheckoutConfirmStatus = (state) =>
  state?.payments?.checkout?.confirmStatus || 'idle';

export const selectAdminRevenueStats = (state) =>
  state?.payments?.adminStats || FALLBACK_ADMIN_STATS;

export const selectAdminRevenueStatsStatus = (state) =>
  state?.payments?.adminStatsStatus || 'idle';

export const selectMentorEarningsTotals = (state) =>
  state?.payments?.mentorEarnings || FALLBACK_MENTOR_EARNINGS;

export const selectPaymentsWorking = (state) =>
  state?.payments?.working || FALLBACK_WORKING;

export const selectCheckoutDisplayTotals = createSelector(
  [selectPaymentCheckout],
  (checkout) => {
    const session = checkout?.session;
    const intent = checkout?.paymentIntent;
    const mentorBreakdown = checkout?.selectedMentorBreakdown;
    const basePrice =
      session?.agreedPrice ??
      mentorBreakdown?.price ??
      checkout?.selectedMentorPrice ??
      0;
    const platformFee = session?.platformFee ?? mentorBreakdown?.platformFee ?? null;
    const gatewayFee = session?.gatewayFee ?? mentorBreakdown?.gatewayFee ?? null;
    const mentorPayout =
      session?.payout ?? mentorBreakdown?.mentorPayout ?? basePrice;
    const totalAmount =
      session?.totalAmount ??
      intent?.amount ??
      mentorBreakdown?.totalAmount ??
      checkout?.selectedMentorPrice ??
      0;
    return {
      basePrice,
      platformFee,
      gatewayFee,
      mentorPayout,
      totalAmount,
    };
  },
);
