import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { renderWithStore } from './test-utils';

import AdminProjects from '../pages/admin/AdminProjects';
import AdminProjectDetails from '../pages/admin/AdminProjectDetails';
import Settings from '../pages/settings';
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

describe('Phase 18 Frontend Tests: Soft Delete, Data Export & Account Deletion', () => {
  const ownerUser = {
    id: '1',
    name: 'Priya Patel',
    username: 'priyapatel',
    email: 'priya.patel@teamforge.io',
    role: 'Project Owner',
  };

  beforeEach(() => {
    vi.clearAllMocks();
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

    renderWithStore(
      <DeleteProjectDialog
        isOpen={true}
        projectId="proj-del-1"
        projectTitle="Escrow Locked Alpha"
        onClose={onClose}
        onSuccess={onSuccess}
      />,
      {
        preloadedState: {
          session: {
            user: ownerUser,
            isAuthenticated: true,
            status: 'authenticated',
          },
        },
      },
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

    renderWithStore(<AdminProjects />);

    const deletedTab = await screen.findByRole('tab', { name: /Deleted/i });
    fireEvent.click(deletedTab);

    expect(await screen.findByText('Deleted Horizon')).toBeTruthy();
    const restoreBtn = screen.getByTestId('admin-restore-btn-proj-soft-2');
    fireEvent.click(restoreBtn);

    await waitFor(() => {
      expect(projectsApi.restore).toHaveBeenCalledWith('proj-soft-2');
    });

    projectsApi.get.mockResolvedValue(deletedProj);
    renderWithStore(
      <Routes>
        <Route path="/admin/projects/:id" element={<AdminProjectDetails />} />
      </Routes>,
      { route: '/admin/projects/proj-soft-2' },
    );

    const detailRestore = await screen.findByTestId('admin-restore-project-btn');
    fireEvent.click(detailRestore);
    await waitFor(() => {
      expect(projectsApi.restore).toHaveBeenCalledTimes(2);
    });
  });

  it('3. Settings JSON export download and account deletion with open obligations', async () => {
    usersApi.getMe.mockResolvedValue(ownerUser);
    usersApi.listExports.mockResolvedValue([]);
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

    const { store } = renderWithStore(<Settings />, {
      preloadedState: {
        session: {
          user: ownerUser,
          isAuthenticated: true,
          status: 'authenticated',
        },
        ui: { theme: 'light' },
      },
    });

    // Data Export card
    fireEvent.click(await screen.findByTestId('request-export-btn'));
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
      expect(store.getState().session.user).toBeNull();
      expect(mockNavigate).toHaveBeenCalledWith(
        '/',
        expect.objectContaining({
          replace: true,
          state: { accountDeletedMessage: 'Your account was deleted.' },
        }),
      );
    });
  });

  it('4. ChatBox & TaskCard display "Deleted user" with neutral avatar', async () => {
    renderWithStore(
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
  });
});
