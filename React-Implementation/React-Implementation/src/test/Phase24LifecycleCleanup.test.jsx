import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { UIProvider } from '../context/UIContext';
import { NotificationContext } from '../context/NotificationContext';
import Settings from '../pages/settings';
import AppliedProjects from '../pages/collaborator/AppliedProjects';
import OwnedWorkspace from '../pages/owner/OwnedWorkspace';
import usersApi from '../services/usersApi';
import projectsApi from '../services/projectsApi';
import joinRequestsApi from '../services/joinRequestsApi';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ projectId: 'proj-p24', id: 'proj-p24' }),
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

vi.mock('../services/usersApi', () => ({
  default: {
    getMe: vi.fn(),
    getSettings: vi.fn().mockResolvedValue({ digestEnabled: true, digestHour: 9 }),
    updateSettings: vi.fn(),
    requestExport: vi.fn(),
    listExports: vi.fn().mockResolvedValue([]),
    downloadExport: vi.fn(),
    deleteMyAccount: vi.fn(),
    checkUsernameAvailable: vi.fn().mockResolvedValue({ available: true }),
    getPhoneOtpStatus: vi.fn().mockResolvedValue({ wrongAttempts: 0, lockedSeconds: 0 }),
  },
}));

vi.mock('../services/projectsApi', () => ({
  default: {
    get: vi.fn(),
    list: vi.fn().mockResolvedValue([]),
    update: vi.fn(),
    getMyInvites: vi.fn().mockResolvedValue([]),
    getProjectInvites: vi.fn().mockResolvedValue([]),
  },
  isProjectLocked: () => false,
  isProjectActive: () => true,
  normalizeProject: (p) => p,
}));

vi.mock('../services/tasksApi', () => ({
  default: {
    list: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../services/joinRequestsApi', () => ({
  default: {
    list: vi.fn().mockResolvedValue([]),
    getMyRequests: vi.fn().mockResolvedValue([]),
    updateStatus: vi.fn(),
    withdraw: vi.fn(),
  },
}));

vi.mock('../services/communicationApi', () => ({
  default: {
    getMessages: vi.fn().mockResolvedValue([]),
    sendMessage: vi.fn(),
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

describe('Phase 24 Frontend Tests: Deletion Re-Auth Code Flow & Lifecycle Cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('teamforge.backendUserId', 'u-social-24');
  });

  const renderWithContext = (ui, user, extraAuth = {}) =>
    render(
      <MemoryRouter>
        <UIProvider>
          <AuthContext.Provider value={{ user, loading: false, isAuthenticated: true, ...extraAuth }}>
            <NotificationContext.Provider value={{ notifications: [], unreadCount: 0, markAsRead: vi.fn() }}>
              {ui}
            </NotificationContext.Provider>
          </AuthContext.Provider>
        </UIProvider>
      </MemoryRouter>,
    );

  it('1. Passwordless deletion: Delete disabled until username matches, dialog Cancel aborts, server mismatch/obligations render, confirm deletes & redirects', async () => {
    const socialUser = {
      id: 'u-social-24',
      name: 'Social User',
      username: 'social24',
      email: 'social24@test.local',
      role: 'Collaborator',
      hasPassword: false,
    };
    const mockLogout = vi.fn();

    usersApi.getMe.mockResolvedValue({ ...socialUser, hasPassword: false });
    usersApi.deleteMyAccount
      .mockRejectedValueOnce({
        status: 400,
        code: 'USERNAME_MISMATCH',
        serverMessage: 'Typed username does not match your account username.',
      })
      .mockResolvedValueOnce({ success: true });

    renderWithContext(<Settings />, socialUser, { logout: mockLogout });

    const usernameInput = await screen.findByTestId('delete-account-username');
    // Never renders password input, code box, or socialConfirmed checkbox
    expect(screen.queryByTestId('delete-account-password')).toBeNull();
    expect(screen.queryByTestId('delete-account-social-code-box')).toBeNull();
    expect(screen.queryByTestId('delete-account-social-confirm')).toBeNull();
    expect(screen.queryByTestId('delete-account-code')).toBeNull();

    const deleteBtn = screen.getByTestId('delete-account-btn');
    expect(deleteBtn.disabled).toBe(true);

    // Non-matching username keeps Delete disabled
    fireEvent.change(usernameInput, { target: { value: 'wronguser' } });
    expect(deleteBtn.disabled).toBe(true);

    // Matching username (case-insensitive) enables Delete
    fireEvent.change(usernameInput, { target: { value: 'SOCIAL24' } });
    await waitFor(() => {
      expect(deleteBtn.disabled).toBe(false);
    });

    // Click Delete opens confirmation modal; Cancel closes without calling API
    fireEvent.click(deleteBtn);
    const modal = await screen.findByTestId('delete-confirm-modal');
    expect(modal.textContent).toContain('Delete your account?');
    expect(modal.textContent).toContain('Deleted user');
    expect(modal.textContent).toContain('cannot be undone');
    fireEvent.click(screen.getByTestId('delete-confirm-cancel-btn'));
    expect(usersApi.deleteMyAccount).not.toHaveBeenCalled();

    // First confirm hits simulated server mismatch error -> shown inline
    fireEvent.click(deleteBtn);
    fireEvent.click(await screen.findByTestId('delete-confirm-submit-btn'));
    const errBanner = await screen.findByTestId('delete-account-error');
    expect(errBanner.textContent).toContain('Typed username does not match');

    // Second confirm succeeds cleanly without password/code/socialConfirmed -> logs out & redirects home
    fireEvent.click(deleteBtn);
    fireEvent.click(await screen.findByTestId('delete-confirm-submit-btn'));

    await waitFor(() => {
      expect(usersApi.deleteMyAccount).toHaveBeenLastCalledWith({
        username: 'SOCIAL24',
      });
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

  it('2. Password account also renders NO password input, checkbox, or code input (username confirmation + modal only)', async () => {
    const pwUser = {
      id: 'u-pw-24',
      name: 'Password User',
      username: 'pwuser24',
      email: 'pw24@test.local',
      role: 'Collaborator',
      hasPassword: true,
    };
    usersApi.getMe.mockResolvedValue({ ...pwUser, hasPassword: true });

    renderWithContext(<Settings />, pwUser, { logout: vi.fn() });

    await screen.findByTestId('delete-account-username');
    expect(screen.queryByTestId('delete-account-password')).toBeNull();
    expect(screen.queryByTestId('delete-account-social-confirm')).toBeNull();
    expect(screen.queryByTestId('delete-account-code')).toBeNull();
  });

  it('3. AppliedProjects displays "Closed because the project was deleted" on system_closed requests & OwnedWorkspace updates seat count cleanly', async () => {
    const collabUser = {
      id: 'u-app-24',
      name: 'Applicant User',
      username: 'app24',
      role: 'Collaborator',
    };
    joinRequestsApi.getMyRequests.mockResolvedValue([
      {
        id: 'req-del-proj',
        projectId: 'proj-gone',
        projectTitle: 'Soft Deleted Project',
        status: 'system_closed',
        closureReason: 'Closed because the project was deleted',
        createdAt: '2026-11-10T10:00:00.000Z',
      },
    ]);

    renderWithContext(<AppliedProjects />, collabUser);
    await waitFor(() => {
      expect(screen.getByText(/Closed because the project was deleted/i)).toBeTruthy();
    });

    // OwnedWorkspace shows updated empty collaborator count (0 active collaborators after deleted account released)
    const ownerUser = { id: 'u-own-24', name: 'Owner User', username: 'owner24', role: 'Project Owner' };
    projectsApi.get.mockResolvedValue({
      id: 'proj-p24',
      title: 'Team Capacity After Release',
      description: 'Project with released collaborator seat',
      ownerId: 'u-own-24',
      owner: 'Owner User',
      status: 'Open',
      teamSize: 2,
      maxCollaborators: 1,
      collaborators: [],
    });
    joinRequestsApi.list.mockResolvedValue([
      {
        id: 'req-released',
        projectId: 'proj-p24',
        userId: 'u-deleted',
        userName: 'Deleted user',
        status: 'left',
      },
    ]);

    renderWithContext(<OwnedWorkspace />, ownerUser);
    const membersTabBtn = await screen.findByText(/Team & Requests|Members/i);
    fireEvent.click(membersTabBtn);
    await waitFor(() => {
      expect(screen.getByText(/Project Members \(1\)/i)).toBeTruthy(); // Owner only; deleted collaborator freed!
    });
  });
});
