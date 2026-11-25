import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MentorsDirectory from '../pages/owner/MentorsDirectory';
import MentorRevenue from '../pages/admin/MentorRevenue';
import MentorEarnings from '../pages/mentor/MentorEarnings';
import { AuthContext } from '../context/AuthContext';
import { RoleContext } from '../context/RoleContext';
import { UIProvider } from '../context/UIContext';
import { NotificationProvider } from '../context/NotificationContext';

const { mockMentorApi, mockProjectsApi } = vi.hoisted(() => ({
  mockMentorApi: {
    listMentors: vi.fn(),
    mySessions: vi.fn(),
    bookSession: vi.fn(),
    confirmPayment: vi.fn(),
    cancelPayment: vi.fn(),
    allSessions: vi.fn(),
    adminStats: vi.fn(),
    mentorSessions: vi.fn(),
    reconcileEscrow: vi.fn(),
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
    mentorMarketApi: mockMentorApi,
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

describe('Phase 9 Frontend Tests: Escrow & Payment Safety', () => {
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
    dueDate: '2026-03-25T00:00:00.000Z',
  };

  const renderWithCustomAuth = (ui, { auth = {}, role = 'Project Owner', route = '/' } = {}) => {
    const authValue = {
      user: mockUser,
      isAuthenticated: true,
      loading: false,
      updateUser: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
      ...auth,
    };
    const roleValue = {
      currentRole: role,
      setRole: vi.fn(),
      availableRoles: ['Project Owner', 'Collaborator', 'Mentor', 'Admin'],
    };

    return render(
      <MemoryRouter initialEntries={[route]}>
        <AuthContext.Provider value={authValue}>
          <RoleContext.Provider value={roleValue}>
            <UIProvider>
              <NotificationProvider>
                {ui}
              </NotificationProvider>
            </UIProvider>
          </RoleContext.Provider>
        </AuthContext.Provider>
      </MemoryRouter>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    sessionStorage.setItem('teamforge.portalRole', 'Project Owner');
    localStorage.setItem('teamforge.currentUser', JSON.stringify(mockUser));
  });

  describe('Demo Payment Flow, Idempotency & 30-min Timer', () => {
    it('proceeds to payment step with 30-min timer and passes Idempotency-Key header on payment', async () => {
      mockMentorApi.listMentors.mockResolvedValue([mockMentor]);
      mockProjectsApi.list.mockResolvedValue([mockProject]);
      mockMentorApi.mySessions.mockResolvedValue([]);

      const mockBookResult = {
        session: {
          id: 'sess-phase9-test-1',
          status: 'payment_pending',
          mentorId: mockMentor.id,
          projectId: mockProject.id,
          totalAmount: 2300,
        },
        paymentIntent: {
          id: 'pi-12345',
          payeeVpa: 'teamforge@demo',
          upiUri: 'upi://pay?pa=teamforge@demo&pn=TeamForge&am=2300',
        },
      };

      mockMentorApi.bookSession.mockResolvedValue(mockBookResult);
      mockMentorApi.confirmPayment.mockResolvedValue({
        success: true,
        session: { ...mockBookResult.session, status: 'escrow_funded' },
      });

      renderWithCustomAuth(<MentorsDirectory />);

      await waitFor(() => {
        expect(screen.getByText('Dr. Sarah Connor')).toBeDefined();
      });

      fireEvent.click(screen.getByRole('button', { name: /Book with Escrow/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Proceed to Payment/i })).toBeDefined();
      });

      fireEvent.click(screen.getByRole('button', { name: /Proceed to Payment/i }));

      // Wait for Payment modal step
      await waitFor(() => {
        expect(screen.getByText(/Demo payment: no real money is charged/i)).toBeDefined();
        expect(screen.getByText(/Hold expires in: 30:00/i)).toBeDefined();
      });

      // Submit payment
      const payBtn = screen.getByRole('button', { name: /I have paid/i });
      fireEvent.click(payBtn);

      await waitFor(() => {
        expect(mockMentorApi.confirmPayment).toHaveBeenCalledWith(
          'sess-phase9-test-1',
          null,
          expect.objectContaining({
            'Idempotency-Key': expect.any(String),
          })
        );
        const calledHeaders = mockMentorApi.confirmPayment.mock.calls[0][2];
        expect(calledHeaders['Idempotency-Key'].length).toBeGreaterThan(5);
      });
    });

    it('handles 409 ALREADY_PAID gracefully in payment step', async () => {
      mockMentorApi.listMentors.mockResolvedValue([mockMentor]);
      mockProjectsApi.list.mockResolvedValue([mockProject]);
      mockMentorApi.mySessions.mockResolvedValue([]);

      const mockBookResult = {
        session: {
          id: 'sess-already-paid-1',
          status: 'payment_pending',
          mentorId: mockMentor.id,
          projectId: mockProject.id,
          totalAmount: 2300,
        },
        paymentIntent: {
          id: 'pi-already-paid',
          payeeVpa: 'teamforge@demo',
          upiUri: 'upi://pay?pa=teamforge@demo&pn=TeamForge&am=2300',
        },
      };

      mockMentorApi.bookSession.mockResolvedValue(mockBookResult);
      const alreadyPaidError = new Error('This session has already been paid for.');
      alreadyPaidError.code = 'ALREADY_PAID';
      alreadyPaidError.status = 409;
      mockMentorApi.confirmPayment.mockRejectedValue(alreadyPaidError);

      renderWithCustomAuth(<MentorsDirectory />);

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

      fireEvent.click(screen.getByRole('button', { name: /I have paid/i }));

      await waitFor(() => {
        expect(screen.getByText(/This session has already been paid for/i)).toBeDefined();
      });
    });
  });

  describe('3. Display of Refunded Amounts and Closure Reasons', () => {
    it('displays refunded amount and closure reason in MentorsDirectory booking history', async () => {
      const refundedSession = {
        id: 'sess-refund-1',
        mentorId: 'm-prof-1',
        projectId: 'proj-1',
        studentId: '1',
        status: 'refunded',
        totalAmount: 2300,
        agreedPrice: 2000,
        declineReason: 'Project closed: owner account deactivated',
        createdAt: '2026-11-01T10:00:00.000Z',
      };

      mockMentorApi.listMentors.mockResolvedValue([mockMentor]);
      mockProjectsApi.list.mockResolvedValue([mockProject]);
      mockMentorApi.mySessions.mockResolvedValue([refundedSession]);

      renderWithCustomAuth(<MentorsDirectory />);

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /Booking History/i })).toBeDefined();
      });

      // Switch to Booking History tab
      fireEvent.click(screen.getByRole('tab', { name: /Booking History/i }));

      await waitFor(() => {
        expect(screen.getByText('Refunded')).toBeDefined();
        expect(screen.getAllByText(/2,300/i).length).toBeGreaterThan(0);
        expect(screen.getByText(/Project closed: owner account deactivated/i)).toBeDefined();
      });
    });

    it('displays refunded sessions and Escrow Reconciliation in Admin MentorRevenue', async () => {
      const refundedSession = {
        id: 'sess-admin-refund-1',
        mentorId: 'm-prof-1',
        projectId: 'proj-1',
        studentId: '1',
        status: 'refunded',
        totalAmount: 1800,
        agreedPrice: 1500,
        declineReason: 'Project closed by admin',
        createdAt: '2026-11-02T10:00:00.000Z',
      };

      mockMentorApi.allSessions.mockResolvedValue([refundedSession]);
      mockMentorApi.adminStats.mockResolvedValue({
        totalProcessed: 1800,
        platformRevenue: 150,
        pendingSessions: 0,
        activeSessions: 0,
        completedSessions: 0,
        refundedSessions: 1,
      });
      mockMentorApi.listMentors.mockResolvedValue([mockMentor]);
      mockMentorApi.reconcileEscrow.mockResolvedValue({
        ok: true,
        totalSessions: 1,
        reconciledCount: 1,
        totals: { totalOwnerPaid: 1800, totalMentorPayout: 0, totalPlatformFee: 0, totalRefunds: 1800 },
        mismatches: [],
      });

      sessionStorage.setItem('teamforge.portalRole', 'Admin');

      renderWithCustomAuth(<MentorRevenue />, { role: 'Admin' });

      await waitFor(() => {
        expect(screen.getByText(/1,800 refunded/i)).toBeDefined();
        expect(screen.getByText(/Project closed by admin/i)).toBeDefined();
      });

      // Click Reconcile Escrow button
      const reconcileBtn = screen.getByRole('button', { name: /Reconcile Escrow/i });
      fireEvent.click(reconcileBtn);

      await waitFor(() => {
        expect(mockMentorApi.reconcileEscrow).toHaveBeenCalled();
        expect(screen.getByText(/Escrow Reconciled/i)).toBeDefined();
      });
    });

    it('displays refund/decline reason in MentorEarnings for cancelled or refunded sessions', async () => {
      const mentorCancelledSession = {
        id: 'sess-mentor-canc-1',
        projectId: 'proj-1',
        studentId: '1',
        status: 'refunded',
        totalAmount: 2000,
        agreedPrice: 1700,
        payout: 1700,
        declineReason: 'Project closed: owner inactive for 5 days',
        createdAt: '2026-11-03T10:00:00.000Z',
      };

      mockMentorApi.mentorSessions.mockResolvedValue([mentorCancelledSession]);
      sessionStorage.setItem('teamforge.portalRole', 'Mentor');

      renderWithCustomAuth(<MentorEarnings />, { role: 'Mentor' });

      await waitFor(() => {
        expect(screen.getByText(/Project closed: owner inactive for 5 days/i)).toBeDefined();
        expect(screen.getByText('—')).toBeDefined();
      });
    });
  });
});
