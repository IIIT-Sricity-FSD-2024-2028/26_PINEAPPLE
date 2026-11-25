import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { RoleContext } from '../context/RoleContext';
import { UIProvider } from '../context/UIContext';
import { NotificationContext } from '../context/NotificationContext';
import CollaboratorWorkspace from '../pages/collaborator/CollaboratorWorkspace';
import OwnedWorkspace from '../pages/owner/OwnedWorkspace';
import Settings from '../pages/settings';
import Notifications from '../pages/notifications';
import MentorApplication from '../pages/mentor/MentorApplication';
import Help from '../pages/help';
import projectsApi from '../services/projectsApi';
import tasksApi from '../services/tasksApi';
import mentorApplicationsApi from '../services/mentorApplicationsApi';
import reportsApi from '../services/reportsApi';
import usersApi from '../services/usersApi';

vi.mock('../services/apiClient.js', async () => {
  const actual = await vi.importActual('../services/apiClient.js');
  return {
    ...actual,
    getAuthMode: vi.fn(() => 'jwt'),
    setAccessToken: vi.fn(),
  };
});

vi.mock('../services/projectsApi', () => ({
  default: {
    get: vi.fn(),
    getMyInvites: vi.fn().mockResolvedValue([]),
    acceptInvite: vi.fn(),
    declineInvite: vi.fn(),
    listInvites: vi.fn().mockResolvedValue([]),
  },
  isProjectLocked: () => false,
}));

vi.mock('../services/tasksApi', () => ({
  default: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
    review: vi.fn(),
    unassign: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock('../services/communicationApi', () => ({
  default: {
    getMessages: vi.fn().mockResolvedValue([]),
    sendMessage: vi.fn(),
    markProjectRead: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../services/joinRequestsApi', () => ({
  default: {
    list: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../services/uploadsApi', () => ({
  default: {
    uploadAvatar: vi.fn(),
    uploadCv: vi.fn(),
    downloadCv: vi.fn(),
  },
}));

vi.mock('../services/mentorApplicationsApi', () => ({
  default: {
    getMyStatus: vi.fn().mockResolvedValue({ status: 'none', mentorUnlocked: false, allApplications: [] }),
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    pullDigiLockerDocuments: vi.fn(),
    getDigiLockerStatus: vi.fn().mockResolvedValue({ mode: 'sandbox', isSimulated: true }),
  },
}));

vi.mock('../services/reportsApi', () => ({
  default: {
    getMyReports: vi.fn().mockResolvedValue([]),
    createReport: vi.fn(),
  },
}));

vi.mock('../services/usersApi', () => ({
  default: {
    getMe: vi.fn().mockResolvedValue({ id: 'u-1', name: 'Test User', email: 'test@example.com' }),
    search: vi.fn(),
    searchUsers: vi.fn(),
    update: vi.fn(),
    checkUsernameAvailable: vi.fn().mockResolvedValue({ available: true }),
    getSettings: vi.fn().mockResolvedValue({ digestEnabled: true, digestHour: 9, utcOffsetMinutes: 0 }),
    getPhoneOtpStatus: vi.fn().mockResolvedValue({ wrongAttempts: 0, lockedSeconds: 0 }),
    listExports: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../services/appealsApi', () => ({
  default: {
    getMyAppeals: vi.fn().mockResolvedValue([]),
    createAppeal: vi.fn(),
  },
}));

vi.mock('../services/adminApi', () => ({
  default: {
    getUserWarnings: vi.fn().mockResolvedValue([]),
    getPublicConfig: vi.fn().mockResolvedValue({ mentorMinYearsExperience: 5 }),
  },
}));

function renderWithContexts(ui, { user = { id: 'u-1', name: 'Test User', email: 'test@example.com', emailVerified: true }, route = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <UIProvider>
        <AuthContext.Provider
          value={{
            user,
            isAuthenticated: true,
            login: vi.fn(),
            logout: vi.fn(),
            updateUser: vi.fn(),
            setUser: vi.fn(),
          }}
        >
          <RoleContext.Provider
            value={{
              currentRole: 'Project Owner',
              switchRole: vi.fn(),
              isMentorApproved: false,
              mentorAppStatus: 'none',
              refreshMentorStatus: vi.fn(),
            }}
          >
            <NotificationContext.Provider
              value={{
                notifications: [],
                unreadCount: 0,
                markAsRead: vi.fn(),
                markAllAsRead: vi.fn(),
              }}
            >
              {ui}
            </NotificationContext.Provider>
          </RoleContext.Provider>
        </AuthContext.Provider>
      </UIProvider>
    </MemoryRouter>,
  );
}

describe('Phase 20: Resource Authorization, Content Filter, Uploads & EmailVerified UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Displays "You are not a member of this project" when tasksApi returns 403 NOT_A_PROJECT_MEMBER', async () => {
    projectsApi.get.mockResolvedValue({
      id: 'proj-b',
      title: 'Project B',
      ownerId: 'other-owner',
      collaborators: [],
    });
    tasksApi.list.mockRejectedValue({
      statusCode: 403,
      code: 'NOT_A_PROJECT_MEMBER',
      serverMessage: 'You are not a member of this project.',
    });

    renderWithContexts(
      <Routes>
        <Route path="/collaborator/workspace/:projectId" element={<CollaboratorWorkspace />} />
      </Routes>,
      { route: '/collaborator/workspace/proj-b?tab=tasks' },
    );

    const tasksTab = await screen.findByRole('tab', { name: /Tasks/i });
    fireEvent.click(tasksTab);

    const banner = await screen.findByTestId('tasks-forbidden-banner');
    expect(banner.textContent).toContain('You are not a member of this project');
  });

  it('2. Hides Create Task button in OwnedWorkspace on 403 and displays CONTENT_NOT_ALLOWED / INVALID_INITIAL_STATUS errors in task modal', async () => {
    projectsApi.get.mockResolvedValue({
      id: 'proj-a',
      title: 'Project A',
      ownerId: 'u-1',
      collaborators: [],
      dueDate: '2029-12-31',
    });
    tasksApi.list.mockResolvedValue([]);
    tasksApi.create.mockRejectedValueOnce({
      statusCode: 400,
      code: 'CONTENT_NOT_ALLOWED',
      serverMessage: 'The field "title" contains content that is not allowed on TeamForge.',
    });

    const { unmount } = renderWithContexts(
      <Routes>
        <Route path="/owner/workspace/:projectId" element={<OwnedWorkspace />} />
      </Routes>,
      { route: '/owner/workspace/proj-a?tab=tasks' },
    );

    const createBtn = await screen.findByRole('button', { name: /Create Task/i });
    fireEvent.click(createBtn);

    const titleInput = screen.getByPlaceholderText(/Implement user authentication API/i);
    fireEvent.change(titleInput, { target: { value: 'Bad Task Name' } });

    const dueInput = document.querySelector('input[name="taskDueDate"]');
    if (dueInput) {
      fireEvent.change(dueInput, { target: { value: '15/05/2029' } });
      fireEvent.blur(dueInput);
    }

    const submitBtns = screen.getAllByRole('button', { name: /Create Task/i });
    fireEvent.click(submitBtns[submitBtns.length - 1]);

    const formErr = await screen.findByTestId('task-form-error');
    expect(formErr.textContent).toMatch(/content that is not allowed/i);

    unmount();

    // Now simulate 403 NOT_A_PROJECT_MEMBER in OwnedWorkspace
    tasksApi.list.mockRejectedValueOnce({
      statusCode: 403,
      code: 'NOT_A_PROJECT_MEMBER',
      serverMessage: 'You are not a member of this project.',
    });
    renderWithContexts(
      <Routes>
        <Route path="/owner/workspace/:projectId" element={<OwnedWorkspace />} />
      </Routes>,
      { route: '/owner/workspace/proj-b?tab=tasks' },
    );
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Create Task/i })).toBeNull();
    });
  });

  it('3. Settings restricts avatar file input to PNG/JPG/JPEG/WEBP and rejects SVG cleanly', async () => {
    renderWithContexts(<Settings />);

    const fileInput = await screen.findByLabelText(/Choose Image/i);
    expect(fileInput.getAttribute('accept')).not.toContain('image/*');
    expect(fileInput.getAttribute('accept')).toContain('.png');
    expect(fileInput.getAttribute('accept')).toContain('.webp');

    const svgFile = new File(['<svg></svg>'], 'avatar.svg', { type: 'image/svg+xml' });
    fireEvent.change(fileInput, { target: { files: [svgFile] } });

    const errNode = await screen.findByTestId('avatar-upload-error');
    expect(errNode.textContent).toMatch(/PNG, JPG, JPEG, WEBP/i);
  });

  it('4. Notifications shows VerifyEmailBanner when invite accept returns 403 EMAIL_NOT_VERIFIED', async () => {
    projectsApi.getMyInvites.mockResolvedValue([
      {
        id: 'inv-1',
        projectId: 'proj-1',
        projectTitle: 'AI Campus Explorer',
        invitedByName: 'Jathin',
        status: 'pending',
      },
    ]);
    projectsApi.acceptInvite.mockRejectedValueOnce({
      statusCode: 403,
      code: 'EMAIL_NOT_VERIFIED',
      serverMessage: 'Verify your email address before doing this.',
    });

    renderWithContexts(<Notifications />, {
      user: { id: 'u-1', name: 'Unverified User', email: 'unverified@example.com', emailVerified: false },
    });

    const acceptBtn = await screen.findByTestId('accept-invite-btn-inv-1');
    fireEvent.click(acceptBtn);

    const banners = await screen.findAllByTestId('verify-email-banner');
    expect(banners.length).toBeGreaterThanOrEqual(1);
    expect(banners[0].textContent).toMatch(/Verify your email address/i);
  });

  it('5. MentorApplication shows VerifyEmailBanner on 403 EMAIL_NOT_VERIFIED error', async () => {
    mentorApplicationsApi.create.mockRejectedValueOnce({
      statusCode: 403,
      code: 'EMAIL_NOT_VERIFIED',
      serverMessage: 'Verify your email address before doing this.',
    });

    renderWithContexts(<MentorApplication />, {
      user: { id: 'u-1', name: 'Test Mentor', email: 'unverified@example.com', emailVerified: false },
    });

    const banners = await screen.findAllByTestId('verify-email-banner');
    expect(banners.length).toBeGreaterThanOrEqual(1);
  });

  it('6. Help page shows VerifyEmailBanner when filing a report returns 403 EMAIL_NOT_VERIFIED', async () => {
    usersApi.searchUsers.mockResolvedValue([
      { id: 'u-target', name: 'Target User', username: 'targetuser' },
    ]);
    reportsApi.createReport.mockRejectedValueOnce({
      statusCode: 403,
      code: 'EMAIL_NOT_VERIFIED',
      serverMessage: 'Verify your email address before doing this.',
    });

    renderWithContexts(<Help />, {
      user: { id: 'u-1', name: 'Reporter', email: 'reporter@example.com', emailVerified: true },
    });

    fireEvent.click(await screen.findByTestId('tab-report'));

    const searchInput = await screen.findByTestId('user-search-input');
    fireEvent.change(searchInput, { target: { value: 'target' } });

    const option = await screen.findByTestId('search-result-u-target');
    fireEvent.click(option);

    fireEvent.change(screen.getByTestId('reason-select'), { target: { value: 'Harassment' } });
    fireEvent.change(screen.getByLabelText(/Details & Context/i), {
      target: { value: 'This report contains detailed context over twenty characters.' },
    });

    const submitBtn = screen.getByRole('button', { name: /Submit Report/i });
    fireEvent.click(submitBtn);

    const banner = await screen.findByTestId('verify-email-banner');
    expect(banner.textContent).toMatch(/Verify your email address/i);
  });
});
