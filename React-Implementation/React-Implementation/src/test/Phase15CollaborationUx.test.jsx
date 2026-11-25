import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor, render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { RoleContext } from '../context/RoleContext';
import { UIProvider } from '../context/UIContext';
import { NotificationContext } from '../context/NotificationContext';
import ProjectsMarketplace from '../pages/collaborator/ProjectsMarketplace';
import AppliedProjects from '../pages/collaborator/AppliedProjects';
import Notifications from '../pages/notifications';
import Help from '../pages/help';
import Navbar from '../components/navbar';
import OwnedWorkspace from '../pages/owner/OwnedWorkspace';

import projectsApi from '../services/projectsApi';
import tasksApi from '../services/tasksApi';
import joinRequestsApi from '../services/joinRequestsApi';
import communicationApi from '../services/communicationApi';
import usersApi from '../services/usersApi';
import appealsApi from '../services/appealsApi';
import adminApi from '../services/adminApi';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ projectId: 'proj-15' }),
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../services/projectsApi', () => ({
  default: {
    list: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    getMatch: vi.fn(),
    listInvites: vi.fn(),
    sendInvite: vi.fn(),
    cancelInvite: vi.fn(),
    getMyInvites: vi.fn(),
    acceptInvite: vi.fn(),
    declineInvite: vi.fn(),
    exportMarkdown: vi.fn(),
    cloneAsDraft: vi.fn(),
  },
  isProjectLocked: vi.fn((p) => {
    if (!p) return false;
    const s = String(p.status || '').toLowerCase();
    return Boolean(p.isCompleted) || s === 'completed' || s === 'closed';
  }),
  isProjectActive: vi.fn(() => true),
}));

vi.mock('../services/tasksApi', () => ({
  default: { list: vi.fn() },
}));

vi.mock('../services/feedbackApi', () => {
  const mockFeedback = {
    getFeedbackReasons: vi.fn().mockResolvedValue({
      actions: {
        DECLINE_INVITATION: {
          actionType: 'DECLINE_INVITATION',
          reasons: [
            { id: 'CURRENTLY_UNAVAILABLE', label: 'Currently Unavailable' },
            { id: 'OTHER', label: 'Other' },
          ],
          requiresExplanationOnOther: true,
          minExplanationLength: 10,
          maxExplanationLength: 500,
        },
      },
    }),
    getReasonsForAction: vi.fn().mockResolvedValue({
      actionType: 'DECLINE_INVITATION',
      reasons: [
        { id: 'CURRENTLY_UNAVAILABLE', label: 'Currently Unavailable' },
        { id: 'OTHER', label: 'Other' },
      ],
      requiresExplanationOnOther: true,
      minExplanationLength: 10,
      maxExplanationLength: 500,
    }),
    recordFeedback: vi.fn().mockResolvedValue({ id: 'fb-1' }),
  };
  return {
    default: mockFeedback,
    feedbackApi: mockFeedback,
    OTHER_REASON_ID: 'OTHER',
  };
});

vi.mock('../services/joinRequestsApi', () => ({
  default: {
    list: vi.fn(),
    create: vi.fn(),
    respond: vi.fn(),
    getMyRequests: vi.fn(),
  },
}));

vi.mock('../services/communicationApi', () => ({
  default: {
    getMessages: vi.fn(),
    sendMessage: vi.fn(),
    getUnread: vi.fn(),
    markProjectRead: vi.fn(() => Promise.resolve({ ok: true })),
  },
}));

vi.mock('../services/usersApi', () => ({
  default: {
    searchUsers: vi.fn(),
    getResponseTime: vi.fn(() => Promise.resolve(null)),
    getProfile: vi.fn(() => Promise.resolve(null)),
    updateProfile: vi.fn(),
  },
}));

vi.mock('../services/appealsApi', () => ({
  default: { getMyAppeals: vi.fn(() => Promise.resolve([])) },
}));

vi.mock('../services/adminApi', () => ({
  default: { getMyWarnings: vi.fn(() => Promise.resolve([])) },
}));

vi.mock('../services/mentorMarketplaceApi', () => ({
  default: {
    getProjectAbandonmentReview: vi.fn(() => Promise.resolve(null)),
  },
}));

vi.mock('../services/reportsApi', () => ({
  default: { submitReport: vi.fn(), getMyReports: vi.fn(() => Promise.resolve([])) },
}));

function renderWithAuth(ui, { user = { id: '2', name: 'Arjun Sharma', username: 'arjunsharma', role: 'Collaborator' }, role = 'Collaborator', route = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthContext.Provider value={{ user, logout: vi.fn(), setUser: vi.fn() }}>
        <RoleContext.Provider value={{ currentRole: role, switchRole: vi.fn(), isMentorApproved: false, mentorAppStatus: 'none' }}>
          <UIProvider>
            <NotificationContext.Provider value={{ notifications: [], unreadCount: 0, markAsRead: vi.fn(), markAllAsRead: vi.fn() }}>
              {ui}
            </NotificationContext.Provider>
          </UIProvider>
        </RoleContext.Provider>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe('Phase 15: Collaboration UX Frontend Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockReset();
    projectsApi.list.mockResolvedValue([]);
    projectsApi.getMyInvites.mockResolvedValue([]);
    projectsApi.listInvites.mockResolvedValue([]);
    tasksApi.list.mockResolvedValue([]);
    joinRequestsApi.list.mockResolvedValue([]);
    joinRequestsApi.getMyRequests.mockResolvedValue([]);
    communicationApi.getMessages.mockResolvedValue([]);
    communicationApi.getUnread.mockResolvedValue({ total: 0, byProject: [] });
    appealsApi.getMyAppeals.mockResolvedValue([]);
    adminApi.getMyWarnings.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('1. ProjectsMarketplace shows skill-match hint bar (non-blocking) and lists projects on 409 ACTIVE_PROJECT_CAP', async () => {
    projectsApi.list.mockResolvedValue([
      {
        id: 'p-match',
        title: 'AI Edge Cloud',
        description: 'Distributed edge scheduling with React and Kubernetes.',
        ownerId: '1',
        owner: 'Priya Patel',
        skills: ['React', 'Kubernetes'],
        status: 'Open',
        maxCollaborators: 5,
        collaborators: [],
      },
    ]);
    projectsApi.getMatch.mockResolvedValue({
      percent: 50,
      shared: ['React'],
      missing: ['Kubernetes'],
    });
    const capError = new Error('Cap reached');
    capError.code = 'ACTIVE_PROJECT_CAP';
    capError.serverMessage = 'You are already an active member of 3 projects (maximum 3).';
    capError.projects = [
      { id: 'act-1', title: 'Alpha Engine', status: 'Open' },
      { id: 'act-2', title: 'Beta Analytics', status: 'In Progress' },
      { id: 'act-3', title: 'Gamma Portal', status: 'Open' },
    ];
    joinRequestsApi.create.mockRejectedValue(capError);

    renderWithAuth(<ProjectsMarketplace />);

    const cardTitle = await screen.findByText('AI Edge Cloud');
    fireEvent.click(cardTitle);

    const matchBox = await screen.findByTestId('apply-skill-match');
    expect(matchBox.textContent).toContain('Skill Match: 50%');
    expect(matchBox.textContent).toContain('This is a hint, you can still apply');
    expect(screen.getByTestId('apply-missing-skills').textContent).toContain('Kubernetes');

    // Submit even with 50% match -> triggers apply -> shows active cap project list
    const submitBtn = screen.getByRole('button', { name: 'Apply to Project' });
    fireEvent.click(submitBtn);

    const capList = await screen.findByTestId('active-cap-projects-list');
    expect(capList.textContent).toContain('Alpha Engine');
    expect(capList.textContent).toContain('Beta Analytics');
    expect(capList.textContent).toContain('Gamma Portal');
  });

  it('2. AppliedProjects renders Similar projects suggestions on rejected requests', async () => {
    joinRequestsApi.getMyRequests.mockResolvedValue([
      {
        id: 'jr-rej1',
        projectId: 'p-old',
        projectTitle: 'Rust Core',
        status: 'Rejected',
        rejectionReason: 'Looking for systems Rust experience.',
        requestsUsed: 1,
        requestsLeft: 1,
        suggestedProjects: [
          { id: 'sug-1', title: 'Open React AI', percent: 100 },
          { id: 'sug-2', title: 'Python Ops', percent: 50 },
        ],
      },
    ]);

    renderWithAuth(<AppliedProjects />);

    const box = await screen.findByTestId('rejection-suggestions-jr-rej1');
    expect(box.textContent).toContain('Similar projects');
    expect(box.textContent).toContain('Open React AI (100%)');

    fireEvent.click(screen.getByTestId('suggestion-apply-sug-1'));
    expect(mockNavigate).toHaveBeenCalledWith('/projects?apply=sug-1');
  });

  it('3. Notifications renders direct project invitations and handles Accept/Decline & ACTIVE_PROJECT_CAP', async () => {
    projectsApi.getMyInvites.mockResolvedValue([
      {
        id: 'inv-1',
        projectId: 'p-10',
        projectTitle: 'Design Ops Hub',
        invitedByName: 'Priya Patel',
        projectSkills: ['React', 'Figma'],
        status: 'pending',
      },
    ]);
    const capError = new Error('Cap reached');
    capError.code = 'ACTIVE_PROJECT_CAP';
    capError.serverMessage = 'Active project limit reached.';
    capError.projects = [{ id: 'a1', title: 'Current Project 1', status: 'Open' }];
    projectsApi.acceptInvite.mockRejectedValueOnce(capError);
    projectsApi.declineInvite.mockResolvedValue({ invite: { id: 'inv-1', status: 'declined' } });

    renderWithAuth(<Notifications />);

    const invitesSection = await screen.findByTestId('my-invites-section');
    expect(invitesSection.textContent).toContain('Design Ops Hub');

    fireEvent.click(screen.getByTestId('accept-invite-btn-inv-1'));
    const capList = await screen.findByTestId('invite-cap-projects-list');
    expect(capList.textContent).toContain('Current Project 1');

    fireEvent.click(screen.getByTestId('decline-invite-btn-inv-1'));
    const chip = await screen.findByTestId('reason-chip-CURRENTLY_UNAVAILABLE');
    fireEvent.click(chip);
    fireEvent.click(screen.getByTestId('universal-reason-confirm-btn'));
    await waitFor(() => {
      expect(projectsApi.declineInvite).toHaveBeenCalledWith(
        'inv-1',
        expect.objectContaining({
          feedback: expect.objectContaining({
            reasons: expect.arrayContaining(['CURRENTLY_UNAVAILABLE']),
          }),
        }),
      );
    });
  });

  it('4. Navbar shows unread chat badge capped at 99+ and pauses 60s poll when document.hidden is true', async () => {
    communicationApi.getUnread
      .mockResolvedValueOnce({
        total: 3,
        byProject: [{ projectId: 'proj-1', projectTitle: 'AI Planner', unreadCount: 3 }],
      })
      .mockResolvedValueOnce({
        total: 125,
        byProject: [{ projectId: 'proj-1', projectTitle: 'AI Planner', unreadCount: 125 }],
      });

    renderWithAuth(<Navbar onMenuClick={vi.fn()} />);

    const badge = await screen.findByTestId('navbar-chat-badge');
    expect(badge.textContent).toBe('3');

    // Trigger refresh event -> shows 99+ cap
    act(() => {
      window.dispatchEvent(new CustomEvent('teamforge:chat_read'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('navbar-chat-badge').textContent).toBe('99+');
    });

    // Verify poll interval skips while tab is hidden
    vi.useFakeTimers();
    const callsBeforeHidden = communicationApi.getUnread.mock.calls.length;
    const origHiddenDesc = Object.getOwnPropertyDescriptor(document, 'hidden');
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(65000);
    });

    expect(communicationApi.getUnread.mock.calls.length).toBe(callsBeforeHidden);

    if (origHiddenDesc) {
      Object.defineProperty(document, 'hidden', origHiddenDesc);
    } else {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    }
  });

  it('5. Help user search highlights matched substring from ranked results', async () => {
    usersApi.searchUsers.mockResolvedValue([
      { id: '2', name: 'Arjun Sharma', username: 'arjunsharma', university: 'IIT Delhi' },
    ]);

    renderWithAuth(<Help />, {
      user: { id: '1', name: 'Priya Patel', username: 'priyapatel', role: 'Project Owner' },
      role: 'Project Owner',
    });
    fireEvent.click(screen.getByTestId('tab-report'));

    const searchInput = screen.getByPlaceholderText(/search/i);
    fireEvent.change(searchInput, { target: { value: 'arjun' } });

    const marks = await screen.findAllByTestId('search-highlight', {}, { timeout: 2000 });
    expect(marks.length).toBeGreaterThanOrEqual(1);
    expect(marks[0].textContent.toLowerCase()).toBe('arjun');
  });

  it('6. OwnedWorkspace invites collaborator with highlighted search and cancels pending invites', async () => {
    projectsApi.get.mockResolvedValue({
      id: 'proj-15',
      title: 'TeamForge Next',
      description: 'Building collaboration UX.',
      ownerId: '1',
      owner: 'Priya Patel',
      status: 'Open',
      collaborators: [],
    });
    projectsApi.listInvites.mockResolvedValue([
      { id: 'inv-old', projectId: 'proj-15', invitedUserId: '3', invitedUsername: 'kiranbose', invitedUserName: 'Kiran Bose', status: 'pending' },
    ]);
    usersApi.searchUsers.mockResolvedValue([
      { id: '2', name: 'Arjun Sharma', username: 'arjunsharma', university: 'IIT Delhi' },
    ]);
    projectsApi.sendInvite.mockResolvedValue({
      id: 'inv-new',
      projectId: 'proj-15',
      invitedUserId: '2',
      invitedUsername: 'arjunsharma',
      invitedUserName: 'Arjun Sharma',
      status: 'pending',
    });
    projectsApi.cancelInvite.mockResolvedValue({ invite: { id: 'inv-old', status: 'cancelled' } });

    renderWithAuth(<OwnedWorkspace />, {
      user: { id: '1', name: 'Priya Patel', role: 'Project Owner' },
      role: 'Project Owner',
    });

    const membersTab = await screen.findByRole('tab', { name: /Members/i });
    fireEvent.click(membersTab);

    const searchInput = await screen.findByTestId('invite-search-input');
    fireEvent.change(searchInput, { target: { value: 'arjun' } });

    const dropdown = await screen.findByTestId('invite-search-results');
    expect(dropdown.textContent).toContain('@arjunsharma');
    expect(screen.getAllByTestId('search-highlight').length).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getByTestId('invite-search-result-arjunsharma'));
    fireEvent.click(screen.getByTestId('send-invite-btn'));

    await waitFor(() => {
      expect(projectsApi.sendInvite).toHaveBeenCalledWith('proj-15', 'arjunsharma');
    });

    fireEvent.click(screen.getByTestId('cancel-invite-btn-inv-old'));
    await waitFor(() => {
      expect(projectsApi.cancelInvite).toHaveBeenCalledWith('proj-15', 'inv-old');
    });
  });

  it('7. OwnedWorkspace renders locked/completed banner and no clone, export, or draft publish buttons', async () => {
    projectsApi.get.mockResolvedValue({
      id: 'proj-15',
      title: 'Finished Showcase',
      description: 'Completed capstone.',
      ownerId: '1',
      owner: 'Priya Patel',
      status: 'Closed',
      collaborators: [],
    });

    renderWithAuth(<OwnedWorkspace />, {
      user: { id: '1', name: 'Priya Patel', role: 'Project Owner' },
      role: 'Project Owner',
    });

    expect(await screen.findByText(/🔒 Completed \(Read-only\)/i)).toBeTruthy();
    expect(screen.queryByTestId('export-markdown-btn')).toBeNull();
    expect(screen.queryByTestId('clone-draft-btn')).toBeNull();
    expect(screen.queryByTestId('draft-status-badge')).toBeNull();
    expect(screen.queryByTestId('publish-draft-btn')).toBeNull();
  });
});
