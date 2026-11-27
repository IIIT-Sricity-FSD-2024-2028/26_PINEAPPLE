import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { renderWithStore } from './test-utils';
import Leaderboard from '../pages/leaderboard';
import OwnedWorkspace from '../pages/owner/OwnedWorkspace';
import Profile from '../pages/profile';
import { leaderboardApi } from '../services/leaderboardApi';
import projectsApi from '../services/projectsApi';
import tasksApi from '../services/tasksApi';
import usersApi from '../services/usersApi';

vi.mock('../services/leaderboardApi', () => {
  const api = {
    getLeaderboard: vi.fn(),
  };
  return {
    leaderboardApi: api,
    default: api,
  };
});

vi.mock('../services/projectsApi', () => ({
  default: {
    get: vi.fn(),
    list: vi.fn().mockResolvedValue([]),
    listInvites: vi.fn().mockResolvedValue([]),
    complete: vi.fn(),
  },
  isProjectLocked: vi.fn((proj) => {
    const st = String(proj?.status || '').toLowerCase();
    return Boolean(proj?.isCompleted || st === 'completed' || st === 'closed');
  }),
  isProjectActive: vi.fn(() => true),
  normalizeProject: vi.fn((p) => p),
}));

vi.mock('../services/tasksApi', () => ({
  default: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
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

vi.mock('../services/usersApi', () => ({
  default: {
    getMe: vi.fn(),
    getReputation: vi.fn(),
    searchUsers: vi.fn().mockResolvedValue([]),
    getProfile: vi.fn(),
    getPublicProfile: vi.fn(),
  },
}));

vi.mock('../services/gamificationApi', () => {
  const api = {
    getUserStats: vi.fn().mockResolvedValue(null),
    getLedger: vi.fn().mockResolvedValue([]),
    getUserLedger: vi.fn().mockResolvedValue([]),
  };
  return {
    gamificationApi: api,
    default: api,
  };
});

function renderWithContexts(ui, { route = '/' } = {}) {
  const user = {
    id: '1',
    uid: '1',
    name: 'Priya Patel',
    email: 'priya.patel@teamforge.io',
    role: 'Project Owner',
    emailVerified: true,
    profileComplete: true,
  };
  return renderWithStore(ui, {
    route,
    preloadedState: {
      session: {
        user,
        isAuthenticated: true,
        status: 'authenticated',
        activeRole: 'project-owner',
        allowedRoles: ['project-owner'],
      },
    },
  });
}

describe('Phase 22: Single Reputation Ledger & Completion Reason UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Leaderboard displays live API reputation without falling back to hardcoded scores', async () => {
    leaderboardApi.getLeaderboard.mockResolvedValue([
      { rank: 1, userId: '2', user: 'Arjun Sharma', initials: 'AS', xp: 2450, rep: 87, tasks: 34, projects: 3 },
      { rank: 2, userId: '99', user: 'Dynamic User', initials: 'DU', xp: 500, rep: 142, tasks: 5, projects: 1 },
    ]);

    renderWithContexts(<Leaderboard />);

    await waitFor(() => {
      expect(screen.getByText('Arjun Sharma')).toBeDefined();
      expect(screen.getByText('87')).toBeDefined();
      expect(screen.getByText('142')).toBeDefined();
    });

    // When API rejects, shows error alert instead of stale FALLBACK_LEADERBOARD numbers
    leaderboardApi.getLeaderboard.mockRejectedValueOnce(new Error('Service temporarily unavailable'));
    fireEvent.click(screen.getByRole('button', { name: /Weekly/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
      expect(screen.getByText(/Service temporarily unavailable/i)).toBeDefined();
    });
    expect(screen.queryByText('Rohan Mehta')).toBeNull();
  });

  it('2. OwnedWorkspace displays badgeReason clearly when project completes without a badge', async () => {
    projectsApi.get.mockResolvedValue({
      id: 'proj-22',
      title: 'Fast Test Project',
      ownerId: '1',
      status: 'Open',
      collaborators: [{ id: '2', name: 'Arjun Sharma', role: 'Collaborator' }],
    });
    tasksApi.list.mockResolvedValue([
      { id: 't1', projectId: 'proj-22', title: 'Task 1', status: 'Completed', assigneeId: '2' },
      { id: 't2', projectId: 'proj-22', title: 'Task 2', status: 'Completed', assigneeId: '2' },
      { id: 't3', projectId: 'proj-22', title: 'Task 3', status: 'Completed', assigneeId: '2' },
    ]);
    projectsApi.complete.mockResolvedValue({
      id: 'proj-22',
      status: 'Completed',
      isCompleted: true,
      progress: 100,
      badgeAwarded: false,
      badgeReason: 'No badge: project is under 3 days old',
    });

    renderWithContexts(
      <Routes>
        <Route path="/owner/workspace/:projectId" element={<OwnedWorkspace />} />
      </Routes>,
      { route: '/owner/workspace/proj-22' },
    );

    const publishToolbarBtn = await screen.findByTestId('publish-project-toolbar-btn');
    fireEvent.click(publishToolbarBtn);

    const linkInput = await screen.findByPlaceholderText(/https:\/\/github\.com/i);
    fireEvent.change(linkInput, { target: { value: 'https://github.com/teamforge/demo' } });

    const submitPublish = screen.getByRole('button', { name: /Publish & Complete/i });
    fireEvent.click(submitPublish);

    const statusBanner = await screen.findByTestId('completion-badge-status');
    expect(statusBanner.textContent).toContain('No badge: project is under 3 days old');
  });

  it('3. Profile Reputation Ledger displays "Starting reputation" for seed entries and renders all entry types & dates', async () => {
    usersApi.getMe.mockResolvedValue({
      id: '2',
      name: 'Arjun Sharma',
      profile: { fullName: 'Arjun Sharma', xp: 2700, rep: 97 },
    });
    usersApi.getReputation.mockResolvedValue({
      items: [
        {
          id: 'rep-c1',
          userId: '2',
          type: 'project_completed',
          delta: 15,
          refId: 'proj-22',
          createdAt: '2026-11-11T10:00:00.000Z',
        },
        {
          id: 'rep-s1',
          userId: '2',
          type: 'seed',
          delta: 87,
          refId: 'seed-2',
          reason: 'Seed account reputation',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      page: 1,
      limit: 20,
      total: 2,
      reputation: 102,
    });

    renderWithContexts(<Profile />);

    await waitFor(() => {
      expect(screen.getByText('Starting reputation')).toBeDefined();
      expect(screen.getByTestId('reputation-entry-type-seed')).toBeDefined();
      expect(screen.getByTestId('reputation-entry-type-project_completed')).toBeDefined();
      expect(screen.getByText('+15 Rep')).toBeDefined();
      expect(screen.getByText('+87 Rep')).toBeDefined();
    });
  });
});
