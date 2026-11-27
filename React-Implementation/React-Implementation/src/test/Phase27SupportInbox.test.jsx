import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import AdminLayout from '../pages/admin/AdminLayout';
import AdminSupport from '../pages/admin/AdminSupport';
import Help from '../pages/help';
import { renderWithProviders } from './test-utils';

const { mockSupportApi, mockReportsApi, mockUsersApi } = vi.hoisted(() => ({
  mockSupportApi: {
    listAdminTickets: vi.fn(),
    listAssignees: vi.fn(),
    getAdminTicket: vi.fn(),
    updateAdminTicket: vi.fn(),
    replyAdminTicket: vi.fn(),
    closeProjectFromTicket: vi.fn(),
    listMyTickets: vi.fn(),
    getMyTicket: vi.fn(),
    createTicket: vi.fn(),
    replyToMyTicket: vi.fn(),
  },
  mockReportsApi: {
    getMyReports: vi.fn().mockResolvedValue([]),
  },
  mockUsersApi: {
    searchUsers: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../services/supportApi', () => ({
  default: mockSupportApi,
  supportApi: mockSupportApi,
}));

vi.mock('../services/reportsApi', () => ({
  default: mockReportsApi,
  reportsApi: mockReportsApi,
}));

vi.mock('../services/usersApi', () => ({
  default: mockUsersApi,
  usersApi: mockUsersApi,
}));

describe('Phase 27 Frontend Tests: Admin Support Inbox, Closure Panel, My Tickets & Permissions', () => {
  const closureTicket = {
    id: 'ticket-closure-1',
    type: 'project_closure',
    userId: '2',
    userName: 'Arjun Sharma',
    from: 'arjun.sharma@teamforge.io',
    category: 'Project Closure Request',
    subject: 'Ask Admin to Close: Abandoned AI App',
    message: 'Owner has been inactive for 35 days.',
    priority: 'high',
    status: 'open',
    assigneeId: null,
    assigneeName: null,
    replies: [
      {
        id: 'rep-internal',
        authorId: 'u-admin',
        authorName: 'Support Admin',
        authorRole: 'admin',
        body: 'Internal check: verified owner last login 35d ago.',
        internal: true,
        createdAt: '2026-11-12T08:00:00.000Z',
      },
      {
        id: 'rep-public',
        authorId: 'u-admin',
        authorName: 'Support Admin',
        authorRole: 'admin',
        body: 'We are reviewing your closure request shortly.',
        internal: false,
        createdAt: '2026-11-12T08:15:00.000Z',
      },
    ],
    createdAt: '2026-11-12T07:00:00.000Z',
    projectFacts: {
      projectId: 'proj-abandoned-1',
      projectTitle: 'Abandoned AI App',
      projectStatus: 'Open',
      isDeleted: false,
      ownerId: '1',
      ownerLastActiveAt: '2026-10-01T10:00:00.000Z',
      membersLastActiveAt: '2026-11-11T10:00:00.000Z',
      openTasksCount: 4,
      totalTasksCount: 6,
      escrowHeldAmount: 1755,
      pendingRequestsCount: 2,
    },
  };

  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
    mockSupportApi.listAssignees.mockResolvedValue([
      { id: 'u-admin-support', name: 'Support Lead', email: 'support@teamforge.io', role: 'admin' },
    ]);
    mockSupportApi.listAdminTickets.mockResolvedValue({
      items: [closureTicket],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    });
    mockSupportApi.getAdminTicket.mockResolvedValue(closureTicket);
    mockSupportApi.listMyTickets.mockResolvedValue([]);
  });

  describe('1. Permission-based Admin Menu & Page Guard', () => {
    it('shows Support Inbox link in AdminLayout when admin has "support" permission and hides it otherwise', () => {
      const { unmount } = renderWithProviders(<AdminLayout />, {
        preloadedState: {
          session: {
            portalRole: 'admin',
            isSuperUser: false,
            permissions: ['users', 'support'],
            isAuthenticated: true,
            initialized: true,
          },
        },
      });
      expect(screen.getByText(/support inbox/i)).toBeDefined();
      unmount();

      renderWithProviders(<AdminLayout />, {
        preloadedState: {
          session: {
            portalRole: 'admin',
            isSuperUser: false,
            permissions: ['users', 'reports'],
            isAuthenticated: true,
            initialized: true,
          },
        },
      });
      expect(screen.queryByText(/support inbox/i)).toBeNull();
    });

    it('blocks AdminSupport screen when admin lacks "support" permission', () => {
      renderWithProviders(<AdminSupport />, {
        preloadedState: {
          session: {
            portalRole: 'admin',
            isSuperUser: false,
            permissions: ['users'],
            isAuthenticated: true,
            initialized: true,
          },
        },
      });

      expect(screen.getByTestId('admin-support-denied')).toBeDefined();
      expect(mockSupportApi.listAdminTickets).not.toHaveBeenCalled();
    });
  });

  describe('2. AdminSupport Filters, Drawer, Replies & Closure Action', () => {
    it('renders ticket list, applies filters, opens drawer with internal/public notes, sends reply, and closes abandoned project', async () => {
      mockSupportApi.replyAdminTicket.mockResolvedValue({
        ...closureTicket,
        replies: [
          ...closureTicket.replies,
          {
            id: 'rep-new',
            authorId: 'u-superuser',
            authorName: 'Super User',
            authorRole: 'admin',
            body: 'Escrow check complete internally.',
            internal: true,
            createdAt: '2026-11-12T09:00:00.000Z',
          },
        ],
      });

      mockSupportApi.closeProjectFromTicket.mockResolvedValue({
        ticket: {
          ...closureTicket,
          status: 'resolved',
          resolutionNote: 'Confirmed owner inactive 30+ days and closed project cleanly.',
        },
      });

      renderWithProviders(<AdminSupport />, {
        preloadedState: {
          session: {
            portalRole: 'admin',
            isSuperUser: true,
            permissions: ['*'],
            isAuthenticated: true,
            initialized: true,
          },
        },
      });

      await waitFor(() => {
        expect(screen.getByTestId('admin-support-table')).toBeDefined();
      });
      expect(screen.getByText('Ask Admin to Close: Abandoned AI App')).toBeDefined();

      // Trigger filter query
      fireEvent.change(screen.getByTestId('filter-type'), { target: { value: 'project_closure' } });
      await waitFor(() => {
        expect(mockSupportApi.listAdminTickets).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'project_closure' }),
        );
      });

      // Open drawer
      fireEvent.click(screen.getByTestId(`open-ticket-${closureTicket.id}`));
      await waitFor(() => {
        expect(screen.getByTestId('support-detail-drawer')).toBeDefined();
      });

      // Verifies closure projectFacts panel and separate internal note badge
      expect(screen.getByTestId('closure-facts-panel')).toBeDefined();
      expect(screen.getByText('₹1755')).toBeDefined();
      expect(screen.getByTestId('internal-note-rep-internal')).toBeDefined();
      expect(screen.getByTestId('public-reply-rep-public')).toBeDefined();

      // Post internal note
      fireEvent.change(screen.getByTestId('admin-reply-input'), {
        target: { value: 'Escrow check complete internally.' },
      });
      fireEvent.click(screen.getByTestId('admin-reply-internal-toggle'));
      fireEvent.click(screen.getByTestId('send-admin-reply-btn'));

      await waitFor(() => {
        expect(mockSupportApi.replyAdminTicket).toHaveBeenCalledWith(closureTicket.id, {
          body: 'Escrow check complete internally.',
          internal: true,
        });
      });

      // Open Close Project reason modal and confirm
      fireEvent.click(screen.getByTestId('close-project-from-ticket-btn'));
      expect(screen.getByTestId('close-project-modal')).toBeDefined();

      fireEvent.change(screen.getByTestId('close-project-reason-input'), {
        target: { value: 'Confirmed owner inactive 30+ days and closed project cleanly.' },
      });
      fireEvent.click(screen.getByTestId('confirm-close-project-btn'));

      await waitFor(() => {
        expect(mockSupportApi.closeProjectFromTicket).toHaveBeenCalledWith(
          closureTicket.id,
          'Confirmed owner inactive 30+ days and closed project cleanly.',
        );
      });
    });
  });

  describe('3. User Help Page: New Ticket & My Tickets Detail with Public Replies', () => {
    it('submits a new help ticket, opens My Tickets thread without internal notes, and sends a reply', async () => {
      const publicTicket = {
        id: 't-user-1',
        type: 'help',
        subject: 'Cannot download project markdown export',
        message: 'Clicked export button twice with no download.',
        priority: 'normal',
        status: 'open',
        replies: [
          {
            id: 'r-1',
            authorName: 'Support Admin',
            authorRole: 'admin',
            body: 'Please verify your project is Closed or Completed.',
            internal: false,
            createdAt: '2026-11-12T08:30:00.000Z',
          },
        ],
        createdAt: '2026-11-12T08:00:00.000Z',
      };

      mockSupportApi.createTicket.mockResolvedValue(publicTicket);
      mockSupportApi.listMyTickets.mockResolvedValue([publicTicket]);
      mockSupportApi.getMyTicket.mockResolvedValue(publicTicket);
      mockSupportApi.replyToMyTicket.mockResolvedValue({
        ...publicTicket,
        replies: [
          ...publicTicket.replies,
          {
            id: 'r-2',
            authorName: 'Arjun Sharma',
            authorRole: 'user',
            body: 'Thanks, checked and it is Open right now.',
            internal: false,
            createdAt: '2026-11-12T08:35:00.000Z',
          },
        ],
      });

      renderWithProviders(<Help />);

      // Direct CTA switches to My Tickets tab
      fireEvent.click(screen.getByTestId('open-my-tickets-link'));
      expect(screen.getByTestId('my-tickets-section')).toBeDefined();

      // Create new ticket
      fireEvent.change(screen.getByTestId('ticket-subject-input'), {
        target: { value: 'Cannot download project markdown export' },
      });
      fireEvent.change(screen.getByTestId('ticket-message-input'), {
        target: { value: 'Clicked export button twice with no download.' },
      });
      fireEvent.click(screen.getByTestId('submit-ticket-btn'));

      await waitFor(() => {
        expect(mockSupportApi.createTicket).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'help',
            subject: 'Cannot download project markdown export',
          }),
        );
      });

      // Open ticket detail and reply
      await waitFor(() => {
        expect(screen.getByTestId('my-ticket-detail')).toBeDefined();
      });
      expect(screen.getByText('Please verify your project is Closed or Completed.')).toBeDefined();

      fireEvent.change(screen.getByTestId('my-ticket-reply-input'), {
        target: { value: 'Thanks, checked and it is Open right now.' },
      });
      fireEvent.click(screen.getByTestId('send-my-reply-btn'));

      await waitFor(() => {
        expect(mockSupportApi.replyToMyTicket).toHaveBeenCalledWith(
          't-user-1',
          'Thanks, checked and it is Open right now.',
        );
      });
    });
  });
});
