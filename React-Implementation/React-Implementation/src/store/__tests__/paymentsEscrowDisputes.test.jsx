import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { createAppStore } from '../index';
import { renderWithStore } from '../../test/test-utils';
import { routeChanged, sessionReset } from '../actions/appActions';
import paymentsReducer, {
  setAll as setAllPayments,
  addOne as addOnePayment,
  updateOne as updateOnePayment,
  removeOne as removeOnePayment,
  openPaymentCheckout,
  closePaymentCheckout,
  setCopiedUpi,
} from '../slices/paymentsSlice';
import escrowAccountsReducer, {
  setAll as setAllEscrows,
  addOne as addOneEscrow,
  updateOne as updateOneEscrow,
  removeOne as removeOneEscrow,
  selectEscrowAccount,
} from '../slices/escrowAccountsSlice';
import sessionDisputesReducer, {
  setAll as setAllDisputes,
  addOne as addOneDispute,
  updateOne as updateOneDispute,
  removeOne as removeOneDispute,
  openDisputeModal,
} from '../slices/sessionDisputesSlice';
import {
  confirmSessionPayment,
  cancelSessionPayment,
  formatPaymentError,
} from '../thunks/paymentsThunks';
import { bookMentorSession } from '../thunks/mentorSessionsThunks';
import { reconcileEscrowLedger } from '../thunks/escrowAccountsThunks';
import MentorsDirectory from '../../pages/owner/MentorsDirectory';
import MentorEarnings from '../../pages/mentor/MentorEarnings';
import MentorRevenue from '../../pages/admin/MentorRevenue';

vi.mock('../../services/mentorMarketplaceApi', () => {
  const api = {
    listMentors: vi.fn().mockResolvedValue([]),
    mySessions: vi.fn().mockResolvedValue([]),
    mentorSessions: vi.fn().mockResolvedValue([]),
    allSessions: vi.fn().mockResolvedValue([]),
    adminStats: vi.fn().mockResolvedValue({}),
    bookSession: vi.fn(),
    confirmPayment: vi.fn(),
    paySession: vi.fn(),
    cancelPayment: vi.fn().mockResolvedValue({ success: true }),
    retryPayout: vi.fn(),
    openDispute: vi.fn(),
    listDisputes: vi.fn().mockResolvedValue([]),
    decideDispute: vi.fn(),
    reconcileEscrow: vi.fn(),
    getProjectEscrow: vi.fn(),
    listEscrows: vi.fn().mockResolvedValue([]),
    getEscrowById: vi.fn().mockResolvedValue(null),
  };
  return {
    __esModule: true,
    default: api,
    mentorMarketplaceApi: api,
  };
});

vi.mock('../../services/projectsApi', () => ({
  __esModule: true,
  default: {
    list: vi.fn().mockResolvedValue([]),
  },
  isProjectActive: (p) => p?.status === 'Open',
  isProjectLocked: (p) => p?.status === 'Completed',
}));

vi.mock('../../services/trustApi', () => ({
  __esModule: true,
  default: {
    getTrustSummaries: vi.fn().mockResolvedValue([]),
  },
}));

import mentorMarketplaceApi from '../../services/mentorMarketplaceApi';
import projectsApi from '../../services/projectsApi';

describe('Phase 9: paymentsSlice, escrowAccountsSlice, sessionDisputesSlice & Money Screens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mentorMarketplaceApi.listMentors.mockResolvedValue([]);
    mentorMarketplaceApi.mySessions.mockResolvedValue([]);
    mentorMarketplaceApi.mentorSessions.mockResolvedValue([]);
    mentorMarketplaceApi.allSessions.mockResolvedValue([]);
    mentorMarketplaceApi.adminStats.mockResolvedValue({});
    mentorMarketplaceApi.listEscrows.mockResolvedValue([]);
    mentorMarketplaceApi.getEscrowById.mockResolvedValue(null);
    projectsApi.list.mockResolvedValue([]);
  });

  describe('1. CRUD Reducers & Route-Leave / D3 Idempotency-Key Exception', () => {
    it('supports all 4 CRUD reducers on paymentsSlice, escrowAccountsSlice, and sessionDisputesSlice', () => {
      // paymentsSlice CRUD
      let pState = paymentsReducer(undefined, { type: '@@INIT' });
      pState = paymentsReducer(
        pState,
        setAllPayments([{ id: 'pi-1', sessionId: 's1', totalAmount: 1170 }]),
      );
      expect(pState.ids).toEqual(['pi-1']);
      pState = paymentsReducer(
        pState,
        addOnePayment({ id: 'pi-2', sessionId: 's2', totalAmount: 2340 }),
      );
      expect(pState.ids).toEqual(['pi-1', 'pi-2']);
      pState = paymentsReducer(
        pState,
        updateOnePayment({ id: 'pi-2', changes: { status: 'escrow_funded' } }),
      );
      expect(pState.entities['pi-2'].status).toBe('escrow_funded');
      pState = paymentsReducer(pState, removeOnePayment('pi-1'));
      expect(pState.ids).toEqual(['pi-2']);

      // escrowAccountsSlice CRUD
      let eState = escrowAccountsReducer(undefined, { type: '@@INIT' });
      eState = escrowAccountsReducer(
        eState,
        setAllEscrows([{ id: 'esc-1', sessionId: 's1', status: 'funded' }]),
      );
      eState = escrowAccountsReducer(
        eState,
        addOneEscrow({ id: 'esc-2', sessionId: 's2', status: 'funded' }),
      );
      eState = escrowAccountsReducer(
        eState,
        updateOneEscrow({ id: 'esc-1', changes: { status: 'frozen' } }),
      );
      expect(eState.entities['esc-1'].status).toBe('frozen');
      eState = escrowAccountsReducer(eState, removeOneEscrow('esc-2'));
      expect(eState.ids).toEqual(['esc-1']);

      // sessionDisputesSlice CRUD
      let dState = sessionDisputesReducer(undefined, { type: '@@INIT' });
      dState = sessionDisputesReducer(
        dState,
        setAllDisputes([{ id: 'disp-1', sessionId: 's1', status: 'open' }]),
      );
      dState = sessionDisputesReducer(
        dState,
        addOneDispute({ id: 'disp-2', sessionId: 's2', status: 'open' }),
      );
      dState = sessionDisputesReducer(
        dState,
        updateOneDispute({ id: 'disp-1', changes: { status: 'decided' } }),
      );
      expect(dState.entities['disp-1'].status).toBe('decided');
      dState = sessionDisputesReducer(dState, removeOneDispute('disp-2'));
      expect(dState.ids).toEqual(['disp-1']);
    });

    it('preserves checkout and Idempotency-Key across routeChanged (D3 exception) while resetting working state', () => {
      const store = createAppStore();

      store.dispatch(
        openPaymentCheckout({
          mentor: { id: 'm-1', name: 'Dr. Mentor', sessionPrice: 2000 },
        }),
      );
      store.dispatch(setCopiedUpi(true));
      store.dispatch(selectEscrowAccount('esc-1'));
      store.dispatch(openDisputeModal('s-9'));

      const keyBeforeNav = store.getState().payments.checkout.idempotencyKey;
      expect(keyBeforeNav).toBeTruthy();

      // Navigate to another route group
      store.dispatch(routeChanged({ from: '/mentors', to: '/projects' }));

      // Idempotency-Key and active checkout MUST survive routeChanged
      expect(store.getState().payments.checkout.isOpen).toBe(true);
      expect(store.getState().payments.checkout.idempotencyKey).toBe(keyBeforeNav);
      expect(store.getState().payments.working.copiedUpi).toBe(false);

      // Volatile working state in escrowAccounts and sessionDisputes resets
      expect(store.getState().escrowAccounts.working.selectedEscrowId).toBeNull();
      expect(store.getState().sessionDisputes.working.targetSessionId).toBeNull();

      // Full logout / sessionReset clears checkout + key too
      store.dispatch(sessionReset());
      expect(store.getState().payments.checkout.idempotencyKey).toBe('');
      expect(store.getState().payments.checkout.isOpen).toBe(false);
    });
  });

  describe('2. Pay Thunk, Idempotency-Key Reuse, Double-Click Guard & Error Handling', () => {
    it('reuses the same Idempotency-Key across retries, clears on success, and generates a fresh key on reopen', async () => {
      const store = createAppStore();

      store.dispatch(
        openPaymentCheckout({
          mentor: { id: 'm-1', name: 'Mentor A', sessionPrice: 2000 },
        }),
      );
      const firstDialogKey = store.getState().payments.checkout.idempotencyKey;
      expect(firstDialogKey).toBeTruthy();

      mentorMarketplaceApi.bookSession.mockResolvedValueOnce({
        session: {
          id: 'sess-10',
          status: 'payment_pending',
          agreedPrice: 2000,
          platformFee: 300,
          gatewayFee: 40,
          totalAmount: 2340,
          payout: 2000,
        },
        paymentIntent: { id: 'pi-10', amount: 2340, upiUri: 'upi://demo' },
      });

      await store
        .dispatch(
          bookMentorSession({
            payload: { mentorId: 'm-1', projectId: 'p-1', projectDescription: 'Arch review' },
          }),
        )
        .unwrap();

      // Retry #1 fails with EMAIL_NOT_VERIFIED -> key remains intact
      const emailErr = new Error('Verify email');
      emailErr.statusCode = 403;
      emailErr.code = 'EMAIL_NOT_VERIFIED';
      mentorMarketplaceApi.confirmPayment.mockRejectedValueOnce(emailErr);

      await expect(
        store.dispatch(confirmSessionPayment({ sessionId: 'sess-10' })).unwrap(),
      ).rejects.toBeTruthy();

      expect(mentorMarketplaceApi.confirmPayment).toHaveBeenNthCalledWith(
        1,
        'sess-10',
        null,
        { 'Idempotency-Key': firstDialogKey },
      );
      expect(store.getState().payments.checkout.idempotencyKey).toBe(firstDialogKey);
      expect(store.getState().payments.checkout.error).toBe('Verify your email to book a mentor');

      // Retry #2 succeeds -> same key sent, key cleared on success, refetches sessions & escrow
      mentorMarketplaceApi.confirmPayment.mockResolvedValueOnce({
        session: {
          id: 'sess-10',
          status: 'escrow_funded',
          escrowId: 'esc-10',
          totalAmount: 2340,
        },
        escrow: { id: 'esc-10', sessionId: 'sess-10', status: 'funded', amount: 2340 },
      });
      mentorMarketplaceApi.mySessions.mockResolvedValueOnce([
        { id: 'sess-10', status: 'escrow_funded', totalAmount: 2340 },
      ]);
      mentorMarketplaceApi.getEscrowById.mockResolvedValueOnce({
        id: 'esc-10',
        sessionId: 'sess-10',
        status: 'funded',
      });

      await store.dispatch(confirmSessionPayment({ sessionId: 'sess-10' })).unwrap();

      expect(mentorMarketplaceApi.confirmPayment).toHaveBeenNthCalledWith(
        2,
        'sess-10',
        null,
        { 'Idempotency-Key': firstDialogKey },
      );
      expect(store.getState().payments.checkout.idempotencyKey).toBe('');
      expect(mentorMarketplaceApi.mySessions).toHaveBeenCalled();
      expect(mentorMarketplaceApi.getEscrowById).toHaveBeenCalledWith('esc-10');
      expect(store.getState().escrowAccounts.entities['esc-10']?.status).toBe('funded');

      // Reopening checkout dialog creates a fresh Idempotency-Key
      store.dispatch(closePaymentCheckout());
      store.dispatch(
        openPaymentCheckout({
          mentor: { id: 'm-1', name: 'Mentor A', sessionPrice: 2000 },
        }),
      );
      const secondDialogKey = store.getState().payments.checkout.idempotencyKey;
      expect(secondDialogKey).toBeTruthy();
      expect(secondDialogKey).not.toBe(firstDialogKey);
    });

    it('guards against double-click concurrency so rapid dispatches send only one request', async () => {
      const store = createAppStore();
      store.dispatch(
        openPaymentCheckout({
          mentor: { id: 'm-1', name: 'Mentor A', sessionPrice: 1000 },
        }),
      );

      let resolvePayment;
      mentorMarketplaceApi.confirmPayment.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolvePayment = resolve;
          }),
      );

      const firstPromise = store.dispatch(confirmSessionPayment({ sessionId: 'sess-dbl' }));
      const secondPromise = store.dispatch(confirmSessionPayment({ sessionId: 'sess-dbl' }));

      expect(mentorMarketplaceApi.confirmPayment).toHaveBeenCalledTimes(1);

      resolvePayment({ session: { id: 'sess-dbl', status: 'escrow_funded', totalAmount: 1170 } });
      await Promise.all([firstPromise, secondPromise]);

      expect(mentorMarketplaceApi.confirmPayment).toHaveBeenCalledTimes(1);
    });

    it('clears Idempotency-Key on cancelPayment', async () => {
      const store = createAppStore();
      store.dispatch(openPaymentCheckout({ mentor: { id: 'm-2', sessionPrice: 1000 } }));
      expect(store.getState().payments.checkout.idempotencyKey).toBeTruthy();

      await store.dispatch(cancelSessionPayment({ sessionId: 'sess-cancel' })).unwrap();
      expect(mentorMarketplaceApi.cancelPayment).toHaveBeenCalledWith('sess-cancel');
      expect(store.getState().payments.checkout.idempotencyKey).toBe('');
    });

    it('handles ALREADY_PAID, PAYMENT_EXPIRED/HOLD_EXPIRED, and NETWORK_ERROR only when there is no response', () => {
      expect(formatPaymentError({ code: 'ALREADY_PAID' })).toBe(
        'This booking has already been paid',
      );
      const errWithMsg = new Error('This session has already been paid for.');
      errWithMsg.code = 'ALREADY_PAID';
      errWithMsg.status = 409;
      expect(formatPaymentError(errWithMsg)).toBe(
        'This session has already been paid for.',
      );
      expect(formatPaymentError({ code: 'PAYMENT_EXPIRED', statusCode: 400 })).toBe(
        'This payment hold has expired. Please book again.',
      );
      expect(formatPaymentError({ code: 'HOLD_EXPIRED', statusCode: 400 })).toBe(
        'This payment hold has expired. Please book again.',
      );

      // True network failure (no HTTP response)
      const netErr = new TypeError('Failed to fetch');
      netErr.isNetworkError = true;
      expect(formatPaymentError(netErr)).toBe(
        'Network error. Please check your connection and try again.',
      );

      // HTTP 500 with serverMessage MUST NOT show Network error
      expect(
        formatPaymentError({
          statusCode: 500,
          code: 'NETWORK_ERROR',
          serverMessage: 'Escrow ledger unreachable on server',
        }),
      ).toBe('Escrow ledger unreachable on server');
    });
  });

  describe('3. Money Screen Totals From Server Responses & Dispute Flow', () => {
    it('renders MentorEarnings totals directly from preloaded server slice data without frontend arithmetic', async () => {
      mentorMarketplaceApi.mentorSessions.mockResolvedValueOnce({
        sessions: [
          {
            id: 's-m-1',
            projectName: 'AI Mentor App',
            agreedPrice: 2000,
            platformFee: 300,
            gatewayFee: 40,
            totalAmount: 2340,
            payout: 2000,
            status: 'completed',
            createdAt: '2026-11-10T10:00:00.000Z',
          },
        ],
        totals: {
          totalEarned: 9500,
          pendingInEscrow: 4250,
          awaitingResponseCount: 2,
          completedCount: 5,
        },
      });

      const { store } = renderWithStore(<MentorEarnings />);

      await waitFor(() => {
        expect(screen.getByText('₹9,500')).toBeTruthy();
        expect(screen.getByText('₹4,250')).toBeTruthy();
      });
      expect(store.getState().payments.mentorEarnings.totalEarned).toBe(9500);
      expect(store.getState().payments.mentorEarnings.pendingInEscrow).toBe(4250);
    });

    it('renders MentorRevenue KPI totals and runs Reconcile Escrow via Redux escrowAccountsSlice', async () => {
      mentorMarketplaceApi.allSessions.mockResolvedValueOnce([
        {
          id: 's-rev-1',
          mentorId: 'm-1',
          projectId: 'p-1',
          agreedPrice: 1000,
          platformFee: 150,
          gatewayFee: 20,
          totalAmount: 1170,
          payout: 1000,
          status: 'completed',
          createdAt: '2026-11-11T10:00:00.000Z',
        },
      ]);
      mentorMarketplaceApi.adminStats.mockResolvedValueOnce({
        escrowHeld: 3500,
        platformRevenue: 450,
        totalPayouts: 2000,
        pendingSessions: 1,
        activeSessions: 2,
        refundedSessions: 0,
      });
      mentorMarketplaceApi.reconcileEscrow.mockResolvedValueOnce({
        ok: true,
        totalSessions: 1,
        reconciledCount: 1,
        mismatches: [],
      });

      const { store } = renderWithStore(<MentorRevenue />);

      await waitFor(() => {
        expect(screen.getByText('₹3,500')).toBeTruthy();
        expect(screen.getByText('₹450')).toBeTruthy();
        expect(screen.getByText('₹2,000')).toBeTruthy();
      });

      fireEvent.click(screen.getByRole('button', { name: /Reconcile Escrow/i }));

      await waitFor(() => {
        expect(screen.getByText(/Escrow Reconciled/i)).toBeTruthy();
      });
      expect(store.getState().escrowAccounts.reconciliation?.ok).toBe(true);
    });

    it('displays checkout server totalAmount on Demo Payment and freezes payout badge on dispute', async () => {
      mentorMarketplaceApi.listMentors.mockResolvedValueOnce([
        { id: 'm-1', name: 'Dr. Mentor', sessionPrice: 2000, isAvailable: true, skills: ['React'] },
      ]);
      projectsApi.list.mockResolvedValueOnce([
        { id: 'p-1', title: 'Alpha App', ownerId: 'owner-1', status: 'Open', members: [] },
      ]);
      mentorMarketplaceApi.mySessions.mockResolvedValueOnce([
        {
          id: 'sess-disp-1',
          mentorId: 'm-1',
          mentorName: 'Dr. Mentor',
          projectId: 'p-1',
          projectName: 'Alpha App',
          agreedPrice: 2000,
          platformFee: 300,
          gatewayFee: 40,
          totalAmount: 2340,
          payout: 2000,
          status: 'active',
          createdAt: '2026-11-12T10:00:00.000Z',
        },
      ]);
      mentorMarketplaceApi.openDispute.mockResolvedValueOnce({
        id: 'disp-101',
        sessionId: 'sess-disp-1',
        status: 'open',
        reason: 'Mentor unresponsive for 10 days.',
      });

      const { store } = renderWithStore(
        <MentorsDirectory />,
        {
          preloadedState: {
            session: {
              user: { id: 'owner-1', name: 'Owner One', role: 'Project Owner' },
              isAuthenticated: true,
              status: 'authenticated',
              activeRole: 'Project Owner',
              allowedRoles: ['Project Owner', 'Mentor', 'Admin'],
            },
            escrowAccounts: {
            ids: ['esc-disp-1'],
            entities: {
              'esc-disp-1': { id: 'esc-disp-1', sessionId: 'sess-disp-1', status: 'funded' },
            },
            byProjectId: {},
            reconciliation: null,
            status: 'succeeded',
            reconcileStatus: 'idle',
            projectEscrowStatus: 'idle',
            error: null,
            lastFetchedAt: null,
            working: { selectedEscrowId: null, reconcileError: null, projectError: null },
          },
        },
      });

      fireEvent.click(await screen.findByText(/Booking History/i));
      fireEvent.click(await screen.findByTestId('open-dispute-btn-sess-disp-1'));

      fireEvent.change(screen.getByTestId('dispute-reason-input'), {
        target: { value: 'Mentor unresponsive for 10 days.' },
      });
      fireEvent.click(screen.getByTestId('submit-dispute-btn'));

      await waitFor(() => {
        expect(mentorMarketplaceApi.openDispute).toHaveBeenCalledWith(
          'sess-disp-1',
          'Mentor unresponsive for 10 days.',
        );
      });

      expect(await screen.findByTestId('session-frozen-badge-sess-disp-1')).toBeTruthy();
      expect(store.getState().mentorSessions.entities['sess-disp-1']?.status).toBe('disputed');
      expect(store.getState().escrowAccounts.entities['esc-disp-1']?.status).toBe('frozen');
    });

    it('supports reconcileEscrowLedger thunk directly with preloaded server mismatches', async () => {
      const store = createAppStore();
      mentorMarketplaceApi.reconcileEscrow.mockResolvedValueOnce({
        ok: false,
        totalSessions: 2,
        reconciledCount: 1,
        mismatches: [{ sessionId: 's-bad', issue: 'MISSING_ESCROW' }],
      });

      await store.dispatch(reconcileEscrowLedger()).unwrap();
      expect(store.getState().escrowAccounts.reconciliation.ok).toBe(false);
      expect(store.getState().escrowAccounts.reconciliation.mismatches).toHaveLength(1);
    });
  });
});
