import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import Notifications from '../pages/notifications';
import ChatBox from '../components/features/ChatBox';
import Help from '../pages/help';
import AdminLayout from '../pages/admin/AdminLayout';
import AdminReports from '../pages/admin/AdminReports';
import Navbar from '../components/navbar';
import { fetchNotifications } from '../store/thunks/notificationsThunks';
import { renderWithStore } from './test-utils';

const { mockNotificationsApi, mockCommunicationApi, mockReportsApi } = vi.hoisted(() => ({
  mockNotificationsApi: {
    list: vi.fn(),
    get: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    getUnreadCount: vi.fn(),
    remove: vi.fn(),
  },
  mockCommunicationApi: {
    reportMessage: vi.fn(),
    listMessages: vi.fn(),
    getMessages: vi.fn(),
  },
  mockReportsApi: {
    getMyReports: vi.fn(),
    getAdminReports: vi.fn(),
    getAdminReportById: vi.fn(),
    getReportDetails: vi.fn(),
    getOpenCount: vi.fn(),
    updateReportStatus: vi.fn(),
    actionReport: vi.fn(),
    createReport: vi.fn(),
  },
}));

vi.mock('../services/notificationsApi', () => ({
  default: mockNotificationsApi,
  notificationsApi: mockNotificationsApi,
}));

vi.mock('../services/communicationApi', () => ({
  default: mockCommunicationApi,
  communicationApi: mockCommunicationApi,
}));

vi.mock('../services/reportsApi', () => ({
  default: mockReportsApi,
  reportsApi: mockReportsApi,
}));

describe('Fix 7 Frontend Tests: Notifications Read-All & Chat Reports Visibility', () => {
  const mockUser = { id: 'user-1', name: 'Alice Smith', email: 'alice@example.com', role: 'Collaborator' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockNotificationsApi.list.mockResolvedValue([]);
    mockNotificationsApi.getUnreadCount.mockResolvedValue({ count: 0, unreadCount: 0 });
    mockReportsApi.getMyReports.mockResolvedValue([]);
    mockReportsApi.getOpenCount.mockResolvedValue({ count: 0, openCount: 0 });
    mockReportsApi.getAdminReports.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  describe('ITEM 10: Notifications Mark All Read & Badge Sync', () => {
    it('button is always rendered, disabled at 0 unread, enabled with unread count', () => {
      renderWithStore(<Notifications />, {
        preloadedState: {
          notifications: {
            ids: ['n1'],
            entities: { n1: { id: 'n1', title: 'Task Done', message: 'Read item', isRead: true } },
            unreadCount: 0,
            status: 'succeeded',
          },
        },
      });

      const btn = screen.getByTestId('mark-all-read-btn');
      expect(btn).toBeDefined();
      expect(btn.disabled).toBe(true);
      expect(btn.textContent).toContain('Mark all as read');

      renderWithStore(<Notifications />, {
        preloadedState: {
          notifications: {
            ids: ['n2'],
            entities: { n2: { id: 'n2', title: 'Task Done', message: 'Unread item', isRead: false } },
            unreadCount: 1,
            status: 'succeeded',
          },
        },
      });
      const btns = screen.getAllByTestId('mark-all-read-btn');
      expect(btns[1].disabled).toBe(false);
    });

    it('clicking Mark All Read updates notifications list and unread badge via store and shows loading state', async () => {
      let notifsState = [
        { id: 'n-1', title: 'Invite Received', message: 'Project A', isRead: false, readStatus: false },
        { id: 'n-2', title: 'Task Assigned', message: 'Project B', isRead: false, readStatus: false },
      ];
      mockNotificationsApi.list.mockImplementation(async () => notifsState);
      mockNotificationsApi.getUnreadCount.mockImplementation(async () => {
        const unread = notifsState.filter((n) => !n.isRead).length;
        return { count: unread, unreadCount: unread };
      });
      mockNotificationsApi.markAllAsRead.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => {
              notifsState = notifsState.map((n) => ({ ...n, isRead: true, readStatus: true }));
              resolve({ updated: 2, unread: 0 });
            }, 50),
          ),
      );

      const { store } = renderWithStore(
        <>
          <Navbar />
          <Notifications />
        </>,
        {
          preloadedState: {
            session: {
              user: mockUser,
              isAuthenticated: true,
              status: 'authenticated',
              activeRole: 'Collaborator',
              allowedRoles: ['Collaborator'],
            },
          },
        },
      );
      await store.dispatch(fetchNotifications({ userId: mockUser.id, force: true }));

      // Wait for notifications to load
      await waitFor(() => {
        expect(screen.getByText('Invite Received')).toBeDefined();
      });

      const markAllBtn = screen.getByTestId('mark-all-read-btn');
      expect(markAllBtn.disabled).toBe(false);

      // Verify unread badge in navbar
      const notifBtn = screen.getByRole('button', { name: /2 unread notifications/i });
      expect(notifBtn).toBeDefined();

      fireEvent.click(markAllBtn);

      // Shows loading state while in-flight
      expect(markAllBtn.textContent).toContain('Marking all as read...');

      await waitFor(() => {
        expect(mockNotificationsApi.markAllAsRead).toHaveBeenCalled();
        // After call, button is disabled
        expect(screen.getByTestId('mark-all-read-btn').disabled).toBe(true);
        // Unread badge is removed or 0
        expect(screen.queryByRole('button', { name: /unread notifications/i })).toBeNull();
      });
    });

    it('displays server error banner if markAllAsRead fails', async () => {
      mockNotificationsApi.list.mockResolvedValue([
        { id: 'n-1', title: 'Update', message: 'Unread', isRead: false },
      ]);
      mockNotificationsApi.markAllAsRead.mockRejectedValue(new Error('Database lock error. Please try again.'));

      const { store } = renderWithStore(<Notifications />, {
        preloadedState: {
          session: {
            user: mockUser,
            isAuthenticated: true,
            status: 'authenticated',
          },
        },
      });
      await store.dispatch(fetchNotifications({ userId: mockUser.id, force: true }));

      await waitFor(() => {
        expect(screen.getByText('Update')).toBeDefined();
      });

      const markAllBtn = screen.getByTestId('mark-all-read-btn');
      fireEvent.click(markAllBtn);

      await waitFor(() => {
        const errorAlert = screen.getByTestId('mark-all-error');
        expect(errorAlert).toBeDefined();
        expect(errorAlert.textContent).toContain('Database lock error');
      });
    });
  });

  describe('ITEM 9: Chat Reports, Help & Support "My Reports", and Admin Queue', () => {
    it('ChatBox shows new post-report confirmation message tracking in Help & Support under My reports', async () => {
      mockCommunicationApi.reportMessage.mockResolvedValueOnce({ id: 'rep-chat-1' });

      const messages = [
        { id: 'msg-1', senderId: 'other-user', senderName: 'Other Person', content: 'Inappropriate chat content', timestamp: new Date().toISOString() },
      ];

      renderWithStore(
        <ChatBox
          messages={messages}
          currentUserId="user-1"
          currentUserName="Alice Smith"
          onSendMessage={vi.fn()}
        />,
      );

      const reportBtn = screen.getByTestId('report-msg-btn-msg-1');
      fireEvent.click(reportBtn);

      const textarea = screen.getByTestId('chat-report-reason-input');
      fireEvent.change(textarea, { target: { value: 'This message violates community guidelines.' } });
      fireEvent.click(screen.getByTestId('submit-chat-report-btn'));

      await waitFor(() => {
        const successNotice = screen.getByTestId('chat-report-success');
        expect(successNotice).toBeDefined();
        expect(successNotice.textContent).toContain(
          'Report sent. Admins will review it. You can track it in Help & Support under My reports.',
        );
      });
    });

    it('Help & Support shows My reports with statuses (Received, Under review, Resolved, Dismissed) and dates', async () => {
      mockReportsApi.getMyReports.mockResolvedValue([
        {
          id: 'rep-1',
          type: 'chat_message',
          reportedUserName: 'Bob Wilson',
          reportedUserUsername: 'bobw',
          projectName: 'Alpha Portal',
          reason: 'Harassment',
          status: 'Received',
          outcome: 'Pending review',
          createdAt: '2026-11-10T12:00:00.000Z',
        },
        {
          id: 'rep-2',
          type: 'user',
          reportedUserName: 'Charlie Brown',
          reason: 'Spam',
          status: 'Under review',
          outcome: 'Under review by moderator',
          createdAt: '2026-11-09T10:00:00.000Z',
        },
      ]);

      renderWithStore(<Help />, {
        route: '/help?tab=my-reports',
        preloadedState: {
          session: {
            user: mockUser,
            isAuthenticated: true,
            status: 'authenticated',
          },
        },
      });

      // Verify My reports tab is active and rendered
      await waitFor(() => {
        expect(screen.getByTestId('my-reports-section')).toBeDefined();
        expect(screen.getByTestId('standalone-my-report-row-rep-1')).toBeDefined();
        expect(screen.getByTestId('standalone-my-report-row-rep-2')).toBeDefined();
      });

      // Check status display
      expect(screen.getByTestId('standalone-my-report-status-rep-1').textContent).toBe('Received');
      expect(screen.getByTestId('standalone-my-report-status-rep-2').textContent).toBe('Under review');

      // Check chat badge and project name for rep-1
      expect(screen.getByTestId('standalone-my-report-chat-badge-rep-1')).toBeDefined();
      expect(screen.getByText(/Project: Alpha Portal/i)).toBeDefined();

      // Ensure no private admin notes are displayed anywhere
      expect(screen.queryByText(/adminNote/i)).toBeNull();
    });

    it('AdminReports renders chat report with message snapshot box and surrounding conversation context', async () => {
      mockReportsApi.getAdminReports.mockResolvedValue({
        items: [
          {
            id: 'rep-chat-100',
            type: 'chat_message',
            reportedUserName: 'Bad Actor',
            reportedUserUsername: 'badactor',
            reporterName: 'Good Member',
            projectName: 'Mobile App',
            status: 'Open',
            reason: 'Harassment',
            details: 'Harassing members in general channel.',
            createdAt: '2026-11-13T09:00:00.000Z',
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
      });

      mockReportsApi.getReportDetails.mockResolvedValue({
        id: 'rep-chat-100',
        type: 'chat_message',
        projectName: 'Mobile App',
        status: 'Open',
        reason: 'Harassment',
        details: 'Harassing members in general channel.',
        reportedMessage: {
          id: 'msg-99',
          senderName: 'Bad Actor',
          content: 'Disruptive hostile remark',
        },
        messageSnapshot: [
          { id: 'msg-98', senderName: 'Good Member', content: 'Can we discuss the task?' },
          { id: 'msg-99', senderName: 'Bad Actor', content: 'Disruptive hostile remark' },
          { id: 'msg-100', senderName: 'Other Collab', content: 'Please stay professional.' },
        ],
        reporter: { id: 'u-good', name: 'Good Member', username: 'goodm' },
        reportedUser: { id: 'u-bad', name: 'Bad Actor', username: 'badactor' },
      });

      renderWithStore(<AdminReports />, {
        preloadedState: {
          session: {
            isSuperUser: true,
            portalRole: 'superuser',
            permissions: ['*'],
          },
        },
      });

      // Verify chat message badge in reports table
      await waitFor(() => {
        expect(screen.getByTestId('chat-report-badge-rep-chat-100')).toBeDefined();
      });

      // Click review button to open report details
      fireEvent.click(screen.getByTestId('review-report-rep-chat-100'));

      await waitFor(() => {
        expect(screen.getByTestId('chat-report-evidence')).toBeDefined();
        const msgBox = screen.getByTestId('reported-message-box');
        expect(msgBox.textContent).toContain('Disruptive hostile remark');
        expect(msgBox.textContent).toContain('Project: Mobile App');

        const snapshotList = screen.getByTestId('chat-snapshot-list');
        expect(snapshotList.textContent).toContain('Can we discuss the task?');
        expect(snapshotList.textContent).toContain('Please stay professional.');
      });
    });

    it('Admin menu displays open reports count badge when reports are open', async () => {
      mockReportsApi.getOpenCount.mockResolvedValue({ count: 4, openCount: 4 });

      renderWithStore(<AdminLayout />, {
        preloadedState: {
          session: {
            isSuperUser: false,
            portalRole: 'admin',
            permissions: ['reports'],
          },
        },
      });

      await waitFor(() => {
        const badge = screen.getByTestId('admin-reports-count-badge');
        expect(badge).toBeDefined();
        expect(badge.textContent).toBe('4');
      });
    });
  });
});
