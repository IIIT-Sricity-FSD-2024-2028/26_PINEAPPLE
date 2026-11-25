import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { UIProvider } from '../context/UIContext';
import { NotificationContext } from '../context/NotificationContext';

import MyProjects from '../pages/owner/MyProjects';
import AdminProjects from '../pages/admin/AdminProjects';
import AdminProjectDetails from '../pages/admin/AdminProjectDetails';
import Settings from '../pages/settings';
import NotificationsPage from '../pages/notifications';
import ChatBox from '../components/features/ChatBox';
import TaskCard from '../components/features/TaskCard';
import DeleteProjectDialog from '../components/features/DeleteProjectDialog';

import projectsApi from '../services/projectsApi';
import usersApi from '../services/usersApi';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../services/apiClient.js', async () => {
  const actual = await vi.importActual('../services/apiClient.js');
  return {
    ...actual,
    getAuthMode: vi.fn(() => 'jwt'),
    setAccessToken: vi.fn(),
  };
});

vi.mock('../services/projectsApi', () => {
  const api = {
    list: vi.fn(),
    get: vi.fn(),
    softDelete: vi.fn(),
    checkDeletion: vi.fn(),
    restore: vi.fn(),
    close: vi.fn(),
    getMyInvites: vi.fn().mockResolvedValue([]),
  };
  return {
    default: api,
    isProjectLocked: (p) => Boolean(p?.isCompleted || String(p?.status || '').toLowerCase() === 'completed'),
    isProjectActive: (p) => !p?.isCompleted && !['completed', 'closed'].includes(String(p?.status || '').toLowerCase()),
  };
});

vi.mock('../services/usersApi', () => ({
  default: {
    getMe: vi.fn(),
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    requestExport: vi.fn(),
    listExports: vi.fn(),
    downloadExport: vi.fn(),
    deleteMyAccount: vi.fn(),
    checkUsernameAvailable: vi.fn().mockResolvedValue({ available: true }),
    getPhoneOtpStatus: vi.fn().mockResolvedValue({ wrongAttempts: 0, lockedSeconds: 0 }),
  },
}));

vi.mock('../services/tasksApi', () => ({
  default: {
    list: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../services/adminApi', () => ({
  default: {
    getProjectEscrow: vi.fn().mockResolvedValue(null),
    getMyWarnings: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../services/appealsApi', () => ({
  default: {
    getMyAppeals: vi.fn().mockResolvedValue([]),
  },
}));

describe('Phase 18 Frontend Tests: Soft Delete, Data Export, Account Deletion & Notification Digest', () => {
  const ownerUser = {
    id: '1',
    name: 'Priya Patel',
    username: 'priyapatel',
    email: 'priya.patel@teamforge.io',
    role: 'Project Owner',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('teamforge.backendUserId', '1');
  });

  it('1. Owner delete project confirmation shows escrow 409 error and removes project on success', async () => {
    projectsApi.checkDeletion.mockResolvedValue({
      allowed: true,
      blockers: [],
      impact: { activeCollaborators: 0, openTasks: 0, pendingRequests: 0, pendingInvites: 0, pendingSessionsToRefund: 0 },
      requiresReason: false,
      noticeHours: 0,
      mode: 'instant',
    });
    projectsApi.softDelete
      .mockRejectedValueOnce({
        status: 409,
        code: 'PROJECT_HAS_ACTIVE_ESCROW',
        serverMessage: 'Close projects with an active mentor session or held escrow before deleting.',
      })
      .mockResolvedValueOnce({ id: 'proj-del-1', deletedAt: '2026-11-11T10:00:00.000Z' });

    const onSuccess = vi.fn();
    const onClose = vi.fn();

    render(
      <MemoryRouter>
        <AuthContext.Provider value={{ user: ownerUser, updateUser: vi.fn() }}>
          <UIProvider>
            <DeleteProjectDialog
              isOpen={true}
              projectId="proj-del-1"
              projectTitle="Escrow Locked Alpha"
              onClose={onClose}
              onSuccess={onSuccess}
            />
          </UIProvider>
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    const titleInput = await screen.findByTestId('delete-project-confirm-title-input');
    fireEvent.change(titleInput, { target: { value: 'Escrow Locked Alpha' } });

    const confirmBtn = await screen.findByTestId('confirm-delete-project-btn');
    fireEvent.click(confirmBtn);

    const errBanner = await screen.findByTestId('delete-project-submit-error');
    expect(errBanner.textContent).toContain('active mentor session or held escrow');

    fireEvent.click(confirmBtn);
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('2. AdminProjects Deleted tab lists soft-deleted projects and AdminProjectDetails restores within 30d', async () => {
    const deletedProj = {
      id: 'proj-soft-2',
      title: 'Deleted Horizon',
      ownerId: '1',
      owner: 'Priya Patel',
      status: 'Closed',
      deletedAt: '2026-11-10T09:00:00.000Z',
    };
    projectsApi.list.mockImplementation(({ status } = {}) => {
      if (status === 'deleted') return Promise.resolve([deletedProj]);
      return Promise.resolve([{ id: 'proj-live-1', title: 'Live Project', ownerId: '1', status: 'Open', progress: 40 }]);
    });
    projectsApi.restore.mockResolvedValue({ project: { ...deletedProj, deletedAt: undefined } });

    render(
      <MemoryRouter>
        <UIProvider>
          <AdminProjects />
        </UIProvider>
      </MemoryRouter>,
    );

    const deletedTab = await screen.findByRole('tab', { name: /Deleted/i });
    fireEvent.click(deletedTab);

    expect(await screen.findByText('Deleted Horizon')).toBeTruthy();
    const restoreBtn = screen.getByTestId('admin-restore-btn-proj-soft-2');
    fireEvent.click(restoreBtn);

    await waitFor(() => {
      expect(projectsApi.restore).toHaveBeenCalledWith('proj-soft-2');
    });

    projectsApi.get.mockResolvedValue(deletedProj);
    render(
      <MemoryRouter initialEntries={['/admin/projects/proj-soft-2']}>
        <Routes>
          <Route path="/admin/projects/:id" element={<AdminProjectDetails />} />
        </Routes>
      </MemoryRouter>,
    );

    const detailRestore = await screen.findByTestId('admin-restore-project-btn');
    fireEvent.click(detailRestore);
    await waitFor(() => {
      expect(projectsApi.restore).toHaveBeenCalledTimes(2);
    });
  });

  it('3. Settings digest preferences, JSON export download, and account deletion with open obligations', async () => {
    const mockLogout = vi.fn();
    usersApi.getMe.mockResolvedValue(ownerUser);
    usersApi.getSettings.mockResolvedValue({ digestEnabled: true, digestHour: 9, utcOffsetMinutes: 330 });
    usersApi.listExports.mockResolvedValue([]);
    usersApi.updateSettings.mockResolvedValue({ digestEnabled: false, digestHour: 18, utcOffsetMinutes: 330 });
    usersApi.requestExport.mockResolvedValue({
      exportId: 'exp_ui_123',
      status: 'ready',
      expiresAt: '2026-11-12T10:00:00.000Z',
    });
    usersApi.downloadExport.mockResolvedValue({
      text: JSON.stringify({ profile: ownerUser }),
      filename: 'teamforge-export-exp_ui_123.json',
    });
    usersApi.deleteMyAccount
      .mockRejectedValueOnce({
        status: 409,
        code: 'ACCOUNT_HAS_OPEN_OBLIGATIONS',
        serverMessage: 'You still have unfinished owned projects.',
        obligations: [{ id: 'p-9', title: 'Unfinished Alpha', status: 'Open', reason: 'Owned project "Unfinished Alpha" is still Open.' }],
      })
      .mockResolvedValueOnce({ success: true });

    render(
      <MemoryRouter>
        <AuthContext.Provider value={{ user: ownerUser, updateUser: vi.fn(), logout: mockLogout }}>
          <UIProvider>
            <Settings />
          </UIProvider>
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    // Digest controls
    const digestToggle = await screen.findByTestId('digest-enabled-toggle');
    expect(digestToggle.checked).toBe(true);
    fireEvent.change(screen.getByTestId('digest-hour-select'), { target: { value: '18' } });
    fireEvent.click(digestToggle);
    fireEvent.click(screen.getByTestId('save-digest-btn'));
    await waitFor(() => {
      expect(usersApi.updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({ digestEnabled: false, digestHour: 18 }),
      );
    });

    // Data Export card
    fireEvent.click(screen.getByTestId('request-export-btn'));
    const dlLink = await screen.findByTestId('download-export-link');
    expect(screen.getByTestId('export-status-box').textContent).toContain('ready');
    fireEvent.click(dlLink);
    await waitFor(() => {
      expect(usersApi.downloadExport).toHaveBeenCalledWith('exp_ui_123');
    });

    // Account Deletion card (passwordless + confirmation modal)
    expect(screen.queryByTestId('delete-account-password')).toBeNull();
    const deleteBtn = screen.getByTestId('delete-account-btn');
    expect(deleteBtn.disabled).toBe(true);

    fireEvent.change(screen.getByTestId('delete-account-username'), { target: { value: 'priyapatel' } });
    expect(deleteBtn.disabled).toBe(false);
    fireEvent.click(deleteBtn);

    // Confirmation dialog opens; click Cancel does nothing
    const modal = await screen.findByTestId('delete-confirm-modal');
    expect(modal.textContent).toContain('Delete your account?');
    fireEvent.click(screen.getByTestId('delete-confirm-cancel-btn'));
    expect(usersApi.deleteMyAccount).not.toHaveBeenCalled();

    // Open confirm modal again -> confirm -> 409 shows obligations list
    fireEvent.click(screen.getByTestId('delete-account-btn'));
    fireEvent.click(await screen.findByTestId('delete-confirm-submit-btn'));

    const obList = await screen.findByTestId('delete-obligations-list');
    expect(obList.textContent).toContain('Unfinished Alpha');

    // Retry confirm -> 200 clears session & redirects home with notice
    fireEvent.click(screen.getByTestId('delete-account-btn'));
    fireEvent.click(await screen.findByTestId('delete-confirm-submit-btn'));
    await waitFor(() => {
      expect(usersApi.deleteMyAccount).toHaveBeenLastCalledWith({ username: 'priyapatel' });
      expect(mockLogout).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith(
        '/',
        expect.objectContaining({
          replace: true,
          state: { accountDeletedMessage: 'Your account was deleted.' },
        }),
      );
    });
  });

  it('4. ChatBox & TaskCard display "Deleted user" with neutral avatar, and NotificationsPage expands digest items', async () => {
    render(
      <div>
        <ChatBox
          currentUserId="1"
          currentUserName="Priya Patel"
          onSendMessage={vi.fn()}
          messages={[
            {
              id: 'm-1',
              senderId: 'old-user',
              senderName: 'Deleted user',
              senderIsDeleted: true,
              content: 'Preserved technical note',
              timestamp: '2026-11-11T09:00:00.000Z',
            },
          ]}
        />
        <TaskCard
          task={{
            id: 't-del-1',
            title: 'Archived Feature Task',
            status: 'Completed',
            assigneeId: 'old-user',
            assigneeName: 'Deleted user',
            assigneeIsDeleted: true,
          }}
        />
      </div>,
    );

    expect(screen.getAllByText(/Deleted user/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Preserved technical note')).toBeTruthy();

    const digestNotif = {
      id: 'notif-digest-1',
      type: 'DAILY_DIGEST',
      title: 'Daily Notification Digest',
      message: 'Daily digest (9 events, 2 updates): 8 tasks released from Project X • 1 new comment',
      isRead: false,
      createdAt: '2026-11-11T09:00:00.000Z',
      metadata: {
        isDigest: true,
        items: [
          { key: 'k1', summary: '8 tasks released from Project X', link: '/projects/p1' },
          { key: 'k2', summary: 'New comment on Task Alpha', link: '/projects/p2' },
        ],
      },
    };

    render(
      <MemoryRouter>
        <NotificationContext.Provider
          value={{
            notifications: [digestNotif],
            unreadCount: 1,
            markAsRead: vi.fn(),
            markAllAsRead: vi.fn(),
          }}
        >
          <NotificationsPage />
        </NotificationContext.Provider>
      </MemoryRouter>,
    );

    const expandBtn = await screen.findByTestId('notif-digest-toggle-notif-digest-1');
    fireEvent.click(expandBtn);

    const digestList = await screen.findByTestId('notif-digest-list-notif-digest-1');
    expect(digestList.textContent).toContain('8 tasks released from Project X');
    expect(digestList.textContent).toContain('New comment on Task Alpha');
  });
});
