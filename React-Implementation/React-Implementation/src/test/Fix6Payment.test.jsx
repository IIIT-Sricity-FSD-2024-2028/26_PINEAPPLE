import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import MentorsDirectory from '../pages/owner/MentorsDirectory';
import { formatPaymentError as formatBookingError } from '../store/thunks/paymentsThunks';
import { renderWithStore } from './test-utils';

const { mockMentorApi, mockProjectsApi } = vi.hoisted(() => ({
  mockMentorApi: {
    listMentors: vi.fn(),
    mySessions: vi.fn(),
    bookSession: vi.fn(),
    confirmPayment: vi.fn(),
    cancelPayment: vi.fn(),
  },
  mockProjectsApi: {
    list: vi.fn(),
    get: vi.fn(),
  },
}));

vi.mock('../services/mentorMarketplaceApi', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: mockMentorApi,
  };
});

vi.mock('../services/projectsApi', () => ({
  default: mockProjectsApi,
  projectsApi: mockProjectsApi,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

describe('Fix 6 Frontend Tests: Payment Error Mapping & Idempotency Key Handling', () => {
  const mockUser = { id: '1', name: 'Priya Patel', role: 'Project Owner' };
  const mockMentor = {
    id: 'm-prof-1',
    name: 'Dr. Sarah Connor',
    title: 'Senior Architect',
    bio: 'Distributed systems and cloud architecture specialist.',
    sessionPrice: 2000,
    skills: ['Architecture', 'Cloud'],
    isAvailable: true,
  };
  const mockProject = {
    id: 'proj-1',
    title: 'AI Study Planner',
    ownerId: '1',
    owner: 'Priya Patel',
    status: 'Open',
    dueDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
  };

  const renderWithContext = (ui) => {
    return renderWithStore(ui, {
      route: '/',
      preloadedState: {
        session: {
          user: mockUser,
          isAuthenticated: true,
          loading: false,
          status: 'authenticated',
          activeRole: 'Project Owner',
          allowedRoles: ['Project Owner', 'Collaborator', 'Mentor', 'Admin'],
        },
      },
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockMentorApi.listMentors.mockResolvedValue([mockMentor]);
    mockProjectsApi.list.mockResolvedValue([mockProject]);
    mockMentorApi.mySessions.mockResolvedValue([]);
  });

  describe('1. Error Mapping Unit Tests (formatBookingError)', () => {
    it('returns Network error ONLY when there is genuine network failure without HTTP response', () => {
      const genuineNetworkError = new TypeError('Failed to fetch');
      expect(formatBookingError(genuineNetworkError)).toBe(
        'Network error. Please check your connection and try again.'
      );

      const netErrWithFlag = new Error('fetch failed');
      netErrWithFlag.isNetworkError = true;
      expect(formatBookingError(netErrWithFlag)).toBe(
        'Network error. Please check your connection and try again.'
      );
    });

    it('translates EMAIL_NOT_VERIFIED code into user-friendly message', () => {
      const err = new Error('Access Forbidden: Verify your email address before doing this.');
      err.statusCode = 403;
      err.code = 'EMAIL_NOT_VERIFIED';
      err.serverMessage = 'Verify your email address before doing this.';
      expect(formatBookingError(err)).toBe('Verify your email to book a mentor');
    });

    it('translates SESSION_INVALID code into re-authentication message', () => {
      const err = new Error('Authentication required.');
      err.statusCode = 401;
      err.code = 'SESSION_INVALID';
      err.serverMessage = 'Your session has expired.';
      expect(formatBookingError(err)).toBe('Your session expired. Please sign in again');
    });

    it('translates ALREADY_PAID code into already paid message', () => {
      const err = { code: 'ALREADY_PAID' };
      expect(formatBookingError(err)).toBe('This booking has already been paid');
    });

    it('translates PAYMENT_EXPIRED and HOLD_EXPIRED codes into expired message', () => {
      const err = new Error('Bad Request: Payment window has expired.');
      err.statusCode = 400;
      err.code = 'PAYMENT_EXPIRED';
      expect(formatBookingError(err)).toBe('This payment hold has expired. Please book again.');

      const holdErr = { code: 'HOLD_EXPIRED' };
      expect(formatBookingError(holdErr)).toBe('This payment hold has expired. Please book again.');
    });

    it('preserves real backend serverMessage for unknown or 500 error responses', () => {
      const server500 = new Error('Server error. Please try again later.');
      server500.statusCode = 500;
      server500.serverMessage = 'Database ledger deadlock detected during escrow funding';
      expect(formatBookingError(server500)).toBe(
        'Database ledger deadlock detected during escrow funding'
      );
    });
  });

  describe('2. Payment Dialog & Idempotency Key Lifecycle', () => {
    const advanceToPaymentScreen = async () => {
      const mockBookResult = {
        session: {
          id: 'sess-fix6-101',
          status: 'payment_pending',
          mentorId: mockMentor.id,
          projectId: mockProject.id,
          totalAmount: 2300,
        },
        paymentIntent: {
          id: 'pi-fix6-101',
          payeeVpa: 'teamforge@demo',
          upiUri: 'upi://pay?pa=teamforge@demo&pn=TeamForge&am=2300',
        },
      };

      mockMentorApi.bookSession.mockResolvedValue(mockBookResult);
      renderWithContext(<MentorsDirectory />);

      await waitFor(() => {
        expect(screen.getByText('Dr. Sarah Connor')).toBeDefined();
      });

      fireEvent.click(screen.getByRole('button', { name: /Book with Escrow/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Proceed to Payment/i })).toBeDefined();
      });

      fireEvent.click(screen.getByRole('button', { name: /Proceed to Payment/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /I have paid/i })).toBeDefined();
      });
    };

    it('reuses the same Idempotency-Key across retry clicks after an error', async () => {
      await advanceToPaymentScreen();

      // First click: mock failure with 403 EMAIL_NOT_VERIFIED
      const unverifiedError = new Error('Access Forbidden: Verify your email address before doing this.');
      unverifiedError.statusCode = 403;
      unverifiedError.code = 'EMAIL_NOT_VERIFIED';
      unverifiedError.serverMessage = 'Verify your email address before doing this.';
      mockMentorApi.confirmPayment.mockRejectedValueOnce(unverifiedError);

      const payBtn = screen.getByRole('button', { name: /I have paid/i });
      fireEvent.click(payBtn);

      await waitFor(() => {
        expect(screen.getByText(/Verify your email to book a mentor/i)).toBeDefined();
      });

      expect(mockMentorApi.confirmPayment).toHaveBeenCalledTimes(1);
      const firstCallHeaders = mockMentorApi.confirmPayment.mock.calls[0][2];
      const firstKey = firstCallHeaders['Idempotency-Key'];
      expect(firstKey).toBeTruthy();

      // Second click (retry): mock success
      mockMentorApi.confirmPayment.mockResolvedValueOnce({
        session: { id: 'sess-fix6-101', status: 'escrow_funded' },
        escrow: { id: 'esc-1', status: 'funded' },
      });

      fireEvent.click(payBtn);

      await waitFor(() => {
        expect(mockMentorApi.confirmPayment).toHaveBeenCalledTimes(2);
      });

      const secondCallHeaders = mockMentorApi.confirmPayment.mock.calls[1][2];
      const secondKey = secondCallHeaders['Idempotency-Key'];

      // Crucial: The Idempotency-Key MUST be identical on retry
      expect(secondKey).toBe(firstKey);

      // Verify success feedback appears
      await waitFor(() => {
        expect(screen.getByText(/Demo payment confirmed!/i)).toBeDefined();
      });
    });

    it('shows backend server message instead of generic network error when server responds with 409', async () => {
      await advanceToPaymentScreen();

      const conflictErr = new Error('Conflict: This session has already been paid for.');
      conflictErr.statusCode = 409;
      conflictErr.code = 'ALREADY_PAID';
      conflictErr.serverMessage = 'This session has already been paid for.';
      mockMentorApi.confirmPayment.mockRejectedValueOnce(conflictErr);

      fireEvent.click(screen.getByRole('button', { name: /I have paid/i }));

      await waitFor(() => {
        expect(screen.getByText(/already been paid/i)).toBeDefined();
      });
    });
  });
});
