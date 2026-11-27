import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import { createAppStore } from '../store';
import { setSession } from '../store/slices/sessionSlice';
import { updateOne } from '../store/slices/projectsSlice';
import { removeProjectMember } from '../store/thunks/projectsThunks';
import { renderWithStore } from './test-utils';
import OwnedWorkspace from '../pages/owner/OwnedWorkspace';

import projectsApi from '../services/projectsApi';
import usersApi from '../services/usersApi';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ projectId: 'proj-full-1' }),
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
    listLeaveRequests: vi.fn(),
    getRemovalCheck: vi.fn(),
    removeMember: vi.fn(),
  },
  isProjectLocked: vi.fn((p) => {
    if (!p) return false;
    const s = String(p.status || '').toLowerCase();
    return Boolean(p.isCompleted) || s === 'completed' || s === 'closed';
  }),
  isProjectActive: vi.fn(() => true),
}));

vi.mock('../services/tasksApi', () => ({
  default: { list: vi.fn(() => Promise.resolve([])) },
}));

vi.mock('../services/joinRequestsApi', () => ({
  default: {
    list: vi.fn(() => Promise.resolve([])),
    create: vi.fn(),
    respond: vi.fn(),
    getMyRequests: vi.fn(() => Promise.resolve([])),
  },
}));

vi.mock('../services/communicationApi', () => ({
  default: {
    getMessages: vi.fn(() => Promise.resolve([])),
    sendMessage: vi.fn(),
    getUnread: vi.fn(() => Promise.resolve({ total: 0, byProject: [] })),
    markProjectRead: vi.fn(() => Promise.resolve({ ok: true })),
  },
}));

vi.mock('../services/usersApi', () => ({
  default: {
    searchUsers: vi.fn(() => Promise.resolve([])),
    getResponseTime: vi.fn(() => Promise.resolve(null)),
    getProfile: vi.fn(() => Promise.resolve(null)),
    getTrustSummary: vi.fn(() => Promise.resolve(null)),
  },
}));

vi.mock('../services/profilesApi', () => ({
  default: {
    searchUsers: vi.fn(() => Promise.resolve([])),
    getTrustSummaries: vi.fn(() => Promise.resolve({})),
    getPublicProfile: vi.fn(() => Promise.resolve(null)),
  },
}));

vi.mock('../services/feedbackApi', () => {
  const mockFeedback = {
    getFeedbackReasons: vi.fn().mockResolvedValue({ actions: {} }),
    getReasonsForAction: vi.fn().mockResolvedValue({ reasons: [] }),
    recordFeedback: vi.fn().mockResolvedValue({ id: 'fb-1' }),
  };
  return {
    default: mockFeedback,
    feedbackApi: mockFeedback,
    OTHER_REASON_ID: 'OTHER',
  };
});

vi.mock('../services/mentorMarketplaceApi', () => ({
  default: {
    getProjectAbandonmentReview: vi.fn(() => Promise.resolve(null)),
  },
}));

function makeFullProject(overrides = {}) {
  return {
    id: 'proj-full-1',
    title: 'Capacity Guard App',
    description: 'Verifying full team invite UI gating.',
    ownerId: '1',
    owner: 'Priya Patel',
    mentorId: '99',
    mentor: 'Neha Gupta',
    status: 'Open',
    dueDate: '2027-05-01T00:00:00.000Z',
    teamSize: 3,
    maxCollaborators: 3,
    isFull: true,
    collaborators: [
      { id: '2', name: 'Arjun Sharma', role: 'Collaborator' },
      { id: '3', name: 'Kiran Bose', role: 'Collaborator' },
      { id: '4', name: 'Rohan Mehta', role: 'Collaborator' },
    ],
    members: [
      { id: '1', userId: '1', name: 'Priya Patel', role: 'Owner' },
      { id: '99', userId: '99', name: 'Neha Gupta', role: 'Mentor' },
      { id: '2', userId: '2', name: 'Arjun Sharma', role: 'Collaborator' },
      { id: '3', userId: '3', name: 'Kiran Bose', role: 'Collaborator' },
      { id: '4', userId: '4', name: 'Rohan Mehta', role: 'Collaborator' },
    ],
    ...overrides,
  };
}

function renderOwnerWorkspace(store = createAppStore()) {
  store.dispatch(
    setSession({
      user: { id: '1', name: 'Priya Patel', username: 'priyapatel', role: 'Project Owner' },
      isAuthenticated: true,
      activeRole: 'Project Owner',
      allowedRoles: ['Project Owner', 'Collaborator'],
    }),
  );
  return { store, ...renderWithStore(<OwnedWorkspace />, { store }) };
}

describe('OwnerInviteFullProject - OwnedWorkspace Members Tab Gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectsApi.listInvites.mockResolvedValue([]);
    projectsApi.listLeaveRequests.mockResolvedValue([]);
    projectsApi.getRemovalCheck.mockResolvedValue({ canRemove: true, blockers: [] });
    usersApi.searchUsers.mockResolvedValue([
      { id: '8', name: 'Vikram Nair', username: 'vikramnair', university: 'IIT Madras' },
    ]);
  });

  it('1. Full state disables invite box, user picker, and Send Invite button, shows note with seat count and opens settings on Edit settings click', async () => {
    projectsApi.get.mockResolvedValue(makeFullProject());
    renderOwnerWorkspace();

    const membersTab = await screen.findByRole('tab', { name: /Members/i });
    fireEvent.click(membersTab);

    const searchInput = await screen.findByTestId('invite-search-input');
    const sendBtn = screen.getByTestId('send-invite-btn');
    expect(searchInput.disabled).toBe(true);
    expect(sendBtn.disabled).toBe(true);

    // Picker must not search or allow selecting users while full
    fireEvent.change(searchInput, { target: { value: 'vikram' } });
    expect(usersApi.searchUsers).not.toHaveBeenCalled();
    expect(screen.queryByTestId('invite-search-results')).toBeNull();

    const fullNote = screen.getByTestId('invite-full-note');
    expect(fullNote.textContent).toContain(
      'Team is full (3 of 3). Increase the collaborator limit in project settings, or remove a collaborator, to invite more people.',
    );

    const editLink = screen.getByTestId('invite-full-edit-settings-link');
    expect(editLink.textContent).toBe('Edit settings');
    fireEvent.click(editLink);

    expect(await screen.findByText('Edit Project Settings')).toBeTruthy();
  });

  it('2. Not full (including owner and mentor present) enables invite box and user picker', async () => {
    projectsApi.get.mockResolvedValue(
      makeFullProject({
        teamSize: 3,
        maxCollaborators: 3,
        isFull: false,
        collaborators: [
          { id: '2', name: 'Arjun Sharma', role: 'Collaborator' },
          { id: '3', name: 'Kiran Bose', role: 'Collaborator' },
        ],
        members: [
          { id: '1', userId: '1', name: 'Priya Patel', role: 'Owner' },
          { id: '99', userId: '99', name: 'Neha Gupta', role: 'Mentor' },
          { id: '2', userId: '2', name: 'Arjun Sharma', role: 'Collaborator' },
          { id: '3', userId: '3', name: 'Kiran Bose', role: 'Collaborator' },
        ],
      }),
    );

    renderOwnerWorkspace();

    const membersTab = await screen.findByRole('tab', { name: /Members/i });
    fireEvent.click(membersTab);

    const searchInput = await screen.findByTestId('invite-search-input');
    expect(searchInput.disabled).toBe(false);
    expect(screen.queryByTestId('invite-full-note')).toBeNull();

    fireEvent.change(searchInput, { target: { value: 'vikramnair' } });
    expect(screen.getByTestId('send-invite-btn').disabled).toBe(false);
  });

  it('3. Raising the limit via store update enables the invite box immediately without reload', async () => {
    projectsApi.get.mockResolvedValue(makeFullProject());
    const { store } = renderOwnerWorkspace();

    const membersTab = await screen.findByRole('tab', { name: /Members/i });
    fireEvent.click(membersTab);

    const searchInput = await screen.findByTestId('invite-search-input');
    expect(searchInput.disabled).toBe(true);
    expect(screen.getByTestId('invite-full-note')).toBeTruthy();

    await act(async () => {
      store.dispatch(
        updateOne({
          id: 'proj-full-1',
          changes: { teamSize: 4 },
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('invite-search-input').disabled).toBe(false);
      expect(screen.queryByTestId('invite-full-note')).toBeNull();
    });

    fireEvent.change(screen.getByTestId('invite-search-input'), {
      target: { value: 'vikramnair' },
    });
    expect(screen.getByTestId('send-invite-btn').disabled).toBe(false);
  });

  it('4. Removing a collaborator in store enables the invite box immediately without reload', async () => {
    projectsApi.get.mockResolvedValue(makeFullProject());
    projectsApi.removeMember.mockResolvedValue({ success: true });
    const { store } = renderOwnerWorkspace();

    const membersTab = await screen.findByRole('tab', { name: /Members/i });
    fireEvent.click(membersTab);
    expect((await screen.findByTestId('invite-search-input')).disabled).toBe(true);

    // Fulfill removal in store without calling projectsApi.get
    await act(async () => {
      store.dispatch({
        type: removeProjectMember.fulfilled.type,
        payload: {
          projectId: 'proj-full-1',
          memberId: '4',
          memberName: 'Rohan Mehta',
          reason: 'Freed up seat',
          res: { success: true },
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('invite-search-input').disabled).toBe(false);
      expect(screen.queryByTestId('invite-full-note')).toBeNull();
    });
  });

  it('5. Stale screen receiving 409 PROJECT_FULL from server displays server error message', async () => {
    // Store initially believes project has a free slot (2 of 3)
    projectsApi.get.mockResolvedValue(
      makeFullProject({
        teamSize: 3,
        maxCollaborators: 3,
        isFull: false,
        collaborators: [
          { id: '2', name: 'Arjun Sharma', role: 'Collaborator' },
          { id: '3', name: 'Kiran Bose', role: 'Collaborator' },
        ],
        members: [
          { id: '1', userId: '1', name: 'Priya Patel', role: 'Owner' },
          { id: '2', userId: '2', name: 'Arjun Sharma', role: 'Collaborator' },
          { id: '3', userId: '3', name: 'Kiran Bose', role: 'Collaborator' },
        ],
      }),
    );

    const serverMsg =
      'Your team is full. Increase the collaborator limit in project settings, or remove a collaborator, to invite more people.';
    const err409 = new Error(serverMsg);
    err409.statusCode = 409;
    err409.code = 'PROJECT_FULL';
    err409.serverMessage = serverMsg;
    projectsApi.sendInvite.mockRejectedValueOnce(err409);

    renderOwnerWorkspace();

    const membersTab = await screen.findByRole('tab', { name: /Members/i });
    fireEvent.click(membersTab);

    const searchInput = await screen.findByTestId('invite-search-input');
    fireEvent.change(searchInput, { target: { value: 'vikramnair' } });
    fireEvent.click(screen.getByTestId('send-invite-btn'));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(serverMsg);
  });
});
