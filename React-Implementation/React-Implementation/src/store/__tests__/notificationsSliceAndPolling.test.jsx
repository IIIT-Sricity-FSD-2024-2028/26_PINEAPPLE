import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, Route, Routes } from 'react-router-dom';
import { createAppStore } from '../index';
import notificationsReducer, {
  addOne,
  clearWorkingState,
  removeOne,
  resetSlice,
  setAll,
  setNotificationFilter,
  setSelectedNotificationId,
  toggleGroupExpanded,
  updateOne,
} from '../slices/notificationsSlice';
import {
  selectAllNotifications,
  selectFilteredNotifications,
  selectMarkAllError,
  selectNotificationById,
  selectNotificationsInvalidated,
  selectNotificationsLastFetchedAt,
  selectNotificationsNeedsRefresh,
  selectNotificationsStatus,
  selectNotificationWorking,
  selectSelectedNotificationId,
  selectUnreadNotificationsCount,
} from '../selectors/notificationsSelectors';
import {
  deleteNotification,
  fetchNotifications,
  fetchUnreadCount,
  markAllRead,
  markRead,
} from '../thunks/notificationsThunks';
import { routeChanged } from '../actions/appActions';
import RouteResetListener from '../components/RouteResetListener';
import {
  getActiveNotificationPollHandle,
  getActiveNotificationPollSubscribersCount,
  resetNotificationPollingForTests,
  useNotificationPolling,
} from '../../hooks/useNotificationPolling';
import Navbar from '../../components/navbar';
import NotificationsPage from '../../pages/notifications';
import { renderWithStore } from '../../test/test-utils';

const {
  mockNotificationsApi,
  mockCommunicationApi,
  mockAppealsApi,
  mockAdminApi,
  mockProjectsApi,
} = vi.hoisted(() => ({
  mockNotificationsApi: {
    list: vi.fn(),
    get: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    getUnreadCount: vi.fn(),
    remove: vi.fn(),
  },
  mockCommunicationApi: {
    getUnread: vi.fn(),
  },
  mockAppealsApi: {
    getMyAppeals: vi.fn(),
  },
  mockAdminApi: {
    getMyWarnings: vi.fn(),
  },
  mockProjectsApi: {
    getMyInvites: vi.fn(),
  },
}));

vi.mock('../../services/notificationsApi', () => ({
  default: mockNotificationsApi,
  notificationsApi: mockNotificationsApi,
}));

vi.mock('../../services/communicationApi', () => ({
  default: mockCommunicationApi,
  communicationApi: mockCommunicationApi,
}));

vi.mock('../../services/appealsApi', () => ({
  default: mockAppealsApi,
}));

vi.mock('../../services/adminApi', () => ({
  default: mockAdminApi,
}));

vi.mock('../../services/projectsApi', () => ({
  default: mockProjectsApi,
}));

describe('Phase 3: notificationsSlice, thunks, rollback, polling & UI sync', () => {
  const originalHiddenDescriptor = Object.getOwnPropertyDescriptor(
    Document.prototype,
    'hidden',
  );

  const setDocumentHidden = (hiddenValue) => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => hiddenValue,
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetNotificationPollingForTests();
    setDocumentHidden(false);
    mockNotificationsApi.list.mockResolvedValue([]);
    mockNotificationsApi.getUnreadCount.mockResolvedValue({ count: 0, unreadCount: 0 });
    mockNotificationsApi.markAsRead.mockResolvedValue({ id: 'n1', readStatus: true });
    mockNotificationsApi.markAllAsRead.mockResolvedValue({ updated: 0, unread: 0 });
    mockNotificationsApi.remove.mockResolvedValue(undefined);
    mockCommunicationApi.getUnread.mockResolvedValue({ total: 0, byProject: [] });
    mockAppealsApi.getMyAppeals.mockResolvedValue([]);
    mockAdminApi.getMyWarnings.mockResolvedValue([]);
    mockProjectsApi.getMyInvites.mockResolvedValue([]);
  });

  afterEach(() => {
    resetNotificationPollingForTests();
    vi.useRealTimers();
    if (originalHiddenDescriptor) {
      Object.defineProperty(document, 'hidden', originalHiddenDescriptor);
    } else {
      delete document.hidden;
    }
  });

  it('supports all 4 synchronous CRUD reducers and clears working state on routeChanged while keeping entities & unreadCount', () => {
    let state = notificationsReducer(
      undefined,
      setAll([
        { id: 'n1', type: 'TASK_ASSIGNED', message: 'Task A', readStatus: false },
        { id: 'n2', type: 'PROJECT_UPDATE', message: 'Project B', readStatus: true },
      ]),
    );
    expect(selectAllNotifications({ notifications: state })).toHaveLength(2);
    expect(selectUnreadNotificationsCount({ notifications: state })).toBe(1);
    expect(selectNotificationById({ notifications: state }, 'n1').isRead).toBe(false);

    state = notificationsReducer(
      state,
      addOne({ id: 'n3', type: 'NEW_MESSAGE', message: 'Chat C', readStatus: false }),
    );
    expect(selectAllNotifications({ notifications: state })).toHaveLength(3);
    expect(selectUnreadNotificationsCount({ notifications: state })).toBe(2);

    state = notificationsReducer(
      state,
      updateOne({ id: 'n1', changes: { isRead: true } }),
    );
    expect(selectNotificationById({ notifications: state }, 'n1').readStatus).toBe(true);
    expect(selectUnreadNotificationsCount({ notifications: state })).toBe(1);

    state = notificationsReducer(
      state,
      setNotificationFilter({ readFilter: 'unread', filterType: 'NEW_MESSAGE' }),
    );
    state = notificationsReducer(state, setSelectedNotificationId('n3'));
    state = notificationsReducer(state, toggleGroupExpanded('n3'));
    expect(selectFilteredNotifications({ notifications: state })).toHaveLength(1);
    expect(selectSelectedNotificationId({ notifications: state })).toBe('n3');

    // routeChanged clears page filters, selectedNotificationId, and expand flags, keeping entities & unreadCount
    state = notificationsReducer(
      state,
      routeChanged({ from: '/notifications', to: '/dashboard', group: 'dashboard' }),
    );
    expect(selectAllNotifications({ notifications: state })).toHaveLength(3);
    expect(selectUnreadNotificationsCount({ notifications: state })).toBe(1);
    expect(selectNotificationWorking({ notifications: state }).readFilter).toBe('all');
    expect(selectSelectedNotificationId({ notifications: state })).toBeNull();
    expect(selectNotificationWorking({ notifications: state }).expandedGroupIds).toEqual({});

    state = notificationsReducer(state, removeOne('n3'));
    expect(selectAllNotifications({ notifications: state })).toHaveLength(2);
    expect(selectUnreadNotificationsCount({ notifications: state })).toBe(0);

    state = notificationsReducer(state, clearWorkingState());
    state = notificationsReducer(state, resetSlice());
    expect(selectAllNotifications({ notifications: state })).toEqual([]);
  });

  it('fetchNotifications handles pending/fulfilled/rejected and condition skips fresh fetch unless force: true', async () => {
    const store = createAppStore();

    mockNotificationsApi.list.mockResolvedValueOnce([
      { id: 'n1', title: 'Assigned', message: 'Hello', readStatus: false },
    ]);

    const firstAction = store.dispatch(fetchNotifications({ userId: 'u1' }));
    expect(selectNotificationsStatus(store.getState())).toBe('loading');
    await firstAction;

    expect(selectNotificationsStatus(store.getState())).toBe('succeeded');
    expect(selectNotificationsLastFetchedAt(store.getState())).not.toBeNull();
    expect(mockNotificationsApi.list).toHaveBeenCalledTimes(1);

    // Condition skips a fresh refetch within stale window
    await store.dispatch(fetchNotifications({ userId: 'u1' }));
    expect(mockNotificationsApi.list).toHaveBeenCalledTimes(1);

    // force: true overrides condition cleanly
    mockNotificationsApi.list.mockResolvedValueOnce([
      { id: 'n1', title: 'Assigned', message: 'Hello', readStatus: false },
      { id: 'n2', title: 'New', message: 'World', readStatus: false },
    ]);
    await store.dispatch(fetchNotifications({ userId: 'u1', force: true }));
    expect(mockNotificationsApi.list).toHaveBeenCalledTimes(2);
    expect(selectUnreadNotificationsCount(store.getState())).toBe(2);

    // Rejected sets normalized error
    mockNotificationsApi.list.mockRejectedValueOnce(
      Object.assign(new Error('Network down'), { statusCode: 503 }),
    );
    await store.dispatch(fetchNotifications({ userId: 'u1', force: true }));
    expect(selectNotificationsStatus(store.getState())).toBe('failed');
    expect(store.getState().notifications.error?.statusCode).toBe(503);

    // fetchUnreadCount updates store unreadCount from server
    mockNotificationsApi.getUnreadCount.mockResolvedValueOnce({ count: 7, unreadCount: 7 });
    await store.dispatch(fetchUnreadCount({ userId: 'u1' }));
    expect(selectUnreadNotificationsCount(store.getState())).toBe(7);
  });

  it('markRead and deleteNotification apply optimistic pending state, sync server unreadCount, and roll back on rejection', async () => {
    const store = createAppStore();
    store.dispatch(
      setAll([
        { id: 'n1', message: 'One', readStatus: false },
        { id: 'n2', message: 'Two', readStatus: false },
      ]),
    );

    // markRead optimistic update in pending + refetch unreadCount in fulfilled (since PUT /:id/read returns Notification without unreadCount)
    let resolveMarkRead;
    mockNotificationsApi.markAsRead.mockImplementationOnce(
      () => new Promise((r) => { resolveMarkRead = r; }),
    );
    mockNotificationsApi.getUnreadCount.mockResolvedValueOnce({ count: 1, unreadCount: 1 });

    const pendingMark = store.dispatch(markRead({ id: 'n1', userId: 'u1' }));
    expect(selectNotificationById(store.getState(), 'n1').isRead).toBe(true);
    expect(selectUnreadNotificationsCount(store.getState())).toBe(1);

    resolveMarkRead({ id: 'n1', readStatus: true });
    await pendingMark;
    expect(mockNotificationsApi.getUnreadCount).toHaveBeenCalledTimes(1);
    expect(selectUnreadNotificationsCount(store.getState())).toBe(1);

    // markRead failure rolls back both entity read flags & unreadCount
    mockNotificationsApi.markAsRead.mockRejectedValueOnce(new Error('Write conflict'));
    await store.dispatch(markRead({ id: 'n2', userId: 'u1' }));
    expect(selectNotificationById(store.getState(), 'n2').isRead).toBe(false);
    expect(selectUnreadNotificationsCount(store.getState())).toBe(1);

    // deleteNotification optimistic remove + rollback on rejection + server unread refetch on success
    mockNotificationsApi.remove.mockRejectedValueOnce(new Error('Delete blocked'));
    await store.dispatch(deleteNotification({ id: 'n2', userId: 'u1' }));
    expect(selectNotificationById(store.getState(), 'n2')).toBeDefined();
    expect(selectUnreadNotificationsCount(store.getState())).toBe(1);

    mockNotificationsApi.remove.mockResolvedValueOnce(undefined);
    mockNotificationsApi.getUnreadCount.mockResolvedValueOnce({ count: 0, unreadCount: 0 });
    await store.dispatch(deleteNotification({ id: 'n2', userId: 'u1' }));
    expect(selectNotificationById(store.getState(), 'n2')).toBeUndefined();
    expect(selectUnreadNotificationsCount(store.getState())).toBe(0);
  });

  it('markAllRead updates optimistically in pending, uses server unread count on fulfilled, and rolls back on failure', async () => {
    const store = createAppStore();
    store.dispatch(
      setAll([
        { id: 'n1', message: 'A', readStatus: false },
        { id: 'n2', message: 'B', readStatus: false },
      ]),
    );

    let rejectAll;
    mockNotificationsApi.markAllAsRead.mockImplementationOnce(
      () => new Promise((_, rej) => { rejectAll = rej; }),
    );

    const reqPromise = store.dispatch(markAllRead({ userId: 'u1' }));
    // Optimistically marked read in pending
    expect(selectUnreadNotificationsCount(store.getState())).toBe(0);
    expect(selectNotificationById(store.getState(), 'n1').isRead).toBe(true);
    expect(selectNotificationById(store.getState(), 'n2').isRead).toBe(true);

    rejectAll(new Error('Database lock error'));
    await reqPromise;

    // Full rollback after rejection
    expect(selectUnreadNotificationsCount(store.getState())).toBe(2);
    expect(selectNotificationById(store.getState(), 'n1').isRead).toBe(false);
    expect(selectNotificationById(store.getState(), 'n2').isRead).toBe(false);
    expect(selectMarkAllError(store.getState())).toContain('Database lock error');

    // Successful markAllRead consumes backend { updated, unread: 0 } directly without extra refetch
    mockNotificationsApi.markAllAsRead.mockResolvedValueOnce({ updated: 2, unread: 0 });
    await store.dispatch(markAllRead({ userId: 'u1' }));
    expect(selectUnreadNotificationsCount(store.getState())).toBe(0);
    expect(mockNotificationsApi.getUnreadCount).not.toHaveBeenCalled();
  });

  it('useNotificationPolling starts once, pauses when document.hidden, resumes on visibility, and cleans up on unmount', async () => {
    vi.useFakeTimers();
    const store = createAppStore();
    mockNotificationsApi.getUnreadCount.mockResolvedValue({ count: 3, unreadCount: 3 });

    function Poller({ userId = 'u1' }) {
      useNotificationPolling(store.dispatch, {
        userId,
        enabled: true,
        intervalMs: 10000,
        immediate: true,
      });
      return null;
    }

    const { rerender, unmount } = render(
      <>
        <Poller userId="u1" />
        <Poller userId="u1" />
      </>,
    );

    // Module-level singleton guarantees only 1 initial immediate call & 1 interval handle
    expect(mockNotificationsApi.getUnreadCount).toHaveBeenCalledTimes(1);
    expect(getActiveNotificationPollHandle()).not.toBeNull();
    expect(getActiveNotificationPollSubscribersCount()).toBe(2);

    // Interval tick runs once (no double loop)
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });
    expect(mockNotificationsApi.getUnreadCount).toHaveBeenCalledTimes(2);

    // Tab hidden pauses interval ticks
    setDocumentHidden(true);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await act(async () => {
      vi.advanceTimersByTime(30000);
    });
    expect(mockNotificationsApi.getUnreadCount).toHaveBeenCalledTimes(2);

    // Tab becomes visible -> resumes immediately
    setDocumentHidden(false);
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(mockNotificationsApi.getUnreadCount).toHaveBeenCalledTimes(3);

    // Unmounting one of two subscribers leaves active polling running until last subscriber unmounts
    rerender(<Poller userId="u1" />);
    expect(getActiveNotificationPollSubscribersCount()).toBe(1);
    expect(getActiveNotificationPollHandle()).not.toBeNull();

    unmount();
    expect(getActiveNotificationPollSubscribersCount()).toBe(0);
    expect(getActiveNotificationPollHandle()).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(30000);
    });
    expect(mockNotificationsApi.getUnreadCount).toHaveBeenCalledTimes(3);
  });

  it('Navbar bell, badge, Notifications page, grouped rendering, and route-reset filter agree via preloaded Redux store', async () => {
    mockNotificationsApi.markAllAsRead.mockResolvedValue({ updated: 2, unread: 0 });

    const preloadedNotifications = [
      {
        id: 'n-unread',
        type: 'TASK_ASSIGNED',
        title: 'Task Assigned',
        message: 'Check PR review',
        readStatus: false,
        isRead: false,
      },
      {
        id: 'n-bulk-12',
        type: 'PROJECT_UPDATE',
        title: 'Bulk Updates',
        message: 'Multiple tasks updated',
        count: 12,
        items: Array.from({ length: 12 }, (_, idx) => ({ label: `Item ${idx + 1}` })),
        readStatus: false,
        isRead: false,
      },
      {
        id: 'n-read-1',
        type: 'PROJECT_UPDATE',
        title: 'Read Update',
        message: 'Already acknowledged update',
        readStatus: true,
        isRead: true,
      },
    ];

    const { store } = renderWithStore(
      <>
        <RouteResetListener />
        <Navbar />
        <Link to="/dashboard">Go Dashboard</Link>
        <Routes>
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/dashboard" element={<div data-testid="dash-route">Dashboard</div>} />
        </Routes>
      </>,
      {
        route: '/notifications',
        preloadedState: {
          session: {
            user: { id: 'u1', name: 'Alice', role: 'Collaborator' },
            isAuthenticated: true,
            status: 'authenticated',
            activeRole: 'Collaborator',
            allowedRoles: ['Collaborator'],
            mentorApproved: false,
          },
          notifications: {
            ids: ['n-unread', 'n-bulk-12', 'n-read-1'],
            entities: Object.fromEntries(preloadedNotifications.map((n) => [n.id, n])),
            unreadCount: 2,
            status: 'succeeded',
            error: null,
            lastFetchedAt: new Date().toISOString(),
            invalidated: false,
            working: {
              readFilter: 'all',
              filterType: 'all',
              selectedNotificationId: null,
              expandedGroupIds: {},
              isMarkingAllRead: false,
              markAllError: null,
            },
            optimisticSnapshots: {},
          },
        },
      },
    );

    // Navbar bell + Notifications page agree on unreadCount = 2
    expect(screen.getByRole('button', { name: /2 unread notifications/i })).toBeDefined();
    expect(screen.getByTestId('mark-all-read-btn').disabled).toBe(false);

    // Grouped count preserves exact rendering
    expect(screen.getByTestId('notif-group-count-n-bulk-12').textContent).toBe('(12)');
    fireEvent.click(screen.getByTestId('notif-group-toggle-n-bulk-12'));
    expect(screen.getByTestId('notif-group-overflow-n-bulk-12').textContent).toBe('and 2 more');

    // Unread filter hides read items, keeping working state in Redux
    fireEvent.click(screen.getByTestId('notif-filter-unread'));
    expect(screen.queryByTestId('notif-item-n-read-1')).toBeNull();
    expect(selectNotificationWorking(store.getState()).readFilter).toBe('unread');

    // Mark all read synchronizes Navbar badge + page button from the same Redux store
    fireEvent.click(screen.getByTestId('mark-all-read-btn'));
    await waitFor(() => {
      expect(selectUnreadNotificationsCount(store.getState())).toBe(0);
      expect(screen.queryByRole('button', { name: /unread notifications/i })).toBeNull();
      expect(screen.getByTestId('mark-all-read-btn').disabled).toBe(true);
    });

    // Navigating away clears page filter & expanded working state while preserving entities
    fireEvent.click(screen.getByText('Go Dashboard'));
    expect(screen.getByTestId('dash-route')).toBeDefined();
    expect(selectNotificationWorking(store.getState()).readFilter).toBe('all');
    expect(selectNotificationWorking(store.getState()).expandedGroupIds).toEqual({});
    expect(selectAllNotifications(store.getState())).toHaveLength(3);
  });

  it('invalidates fresh empty list when fetchUnreadCount increases and fetches 3 items on opening /notifications', async () => {
    const store = createAppStore({
      preloadedState: {
        session: {
          user: { id: 'u-sync', name: 'Aditya', role: 'Collaborator' },
          isAuthenticated: true,
          status: 'authenticated',
          activeRole: 'Collaborator',
          allowedRoles: ['Collaborator'],
          mentorApproved: false,
        },
      },
    });

    // Step 1: initial fetch returns [] and marks list succeeded & fresh
    mockNotificationsApi.list.mockResolvedValueOnce([]);
    await store.dispatch(fetchNotifications({ userId: 'u-sync' }));
    expect(selectAllNotifications(store.getState())).toEqual([]);
    expect(selectNotificationsInvalidated(store.getState())).toBe(false);
    expect(selectNotificationsNeedsRefresh(store.getState())).toBe(false);

    // Step 2: poller returns 3 unread notifications -> invalidates cached list despite 60s TTL
    mockNotificationsApi.getUnreadCount.mockResolvedValueOnce({ count: 3, unreadCount: 3 });
    await store.dispatch(fetchUnreadCount({ userId: 'u-sync' }));
    expect(selectUnreadNotificationsCount(store.getState())).toBe(3);
    expect(selectNotificationsInvalidated(store.getState())).toBe(true);
    expect(selectNotificationsNeedsRefresh(store.getState())).toBe(true);

    // Step 3: opening /notifications automatically bypasses stale cache and fetches all 3 items
    const backendThree = [
      { id: 'n-1', type: 'APPLICATION_APPROVED', title: 'Application Approved', message: 'Joined project', readStatus: false },
      { id: 'n-2', type: 'TASK_APPROVED', title: 'Task Review Approved', message: 'Task passed', readStatus: false },
      { id: 'n-3', type: 'REPORT_ACTIONED', title: 'Report Decision Update', message: 'Report reviewed', readStatus: false },
    ];
    mockNotificationsApi.list.mockResolvedValueOnce(backendThree);

    renderWithStore(
      <>
        <Navbar />
        <NotificationsPage />
      </>,
      { route: '/notifications', store },
    );

    expect(await screen.findByTestId('notif-item-n-1')).toBeDefined();
    expect(screen.getByTestId('notif-item-n-2')).toBeDefined();
    expect(screen.getByTestId('notif-item-n-3')).toBeDefined();
    expect(screen.getByRole('button', { name: /3 unread notifications/i })).toBeDefined();
    expect(screen.queryByText(/caught up/i)).toBeNull();
    expect(selectNotificationsInvalidated(store.getState())).toBe(false);
    expect(selectUnreadNotificationsCount(store.getState())).toBe(3);
    expect(mockNotificationsApi.list).toHaveBeenCalledTimes(2);
  });

  it('shows loading and retry error UI on NotificationsPage instead of empty caught-up state', async () => {
    const store = createAppStore({
      preloadedState: {
        session: {
          user: { id: 'u-err', name: 'Aditya', role: 'Collaborator' },
          isAuthenticated: true,
          status: 'authenticated',
          activeRole: 'Collaborator',
          allowedRoles: ['Collaborator'],
          mentorApproved: false,
        },
      },
    });

    mockNotificationsApi.list.mockRejectedValueOnce(
      Object.assign(new Error('Service unavailable'), { statusCode: 503 }),
    );

    renderWithStore(<NotificationsPage />, { route: '/notifications', store });

    expect(await screen.findByText('Unable to load notifications')).toBeDefined();
    expect(screen.queryByText(/caught up/i)).toBeNull();

    mockNotificationsApi.list.mockResolvedValueOnce([
      { id: 'n-rec', type: 'TASK_APPROVED', title: 'Recovered', message: 'Loaded after retry', readStatus: false },
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByTestId('notif-item-n-rec')).toBeDefined();
  });
});
