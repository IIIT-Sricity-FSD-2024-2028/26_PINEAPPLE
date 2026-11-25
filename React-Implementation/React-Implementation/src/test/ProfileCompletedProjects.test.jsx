import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, render, waitFor, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import Profile from '../pages/profile';
import { AuthContext } from '../context/AuthContext';
import usersApi from '../services/usersApi';
import projectsApi from '../services/projectsApi';
import tasksApi from '../services/tasksApi';
import joinRequestsApi from '../services/joinRequestsApi';
import mentorshipApi from '../services/mentorshipApi';
import gamificationApi from '../services/gamificationApi';
import trustApi from '../services/trustApi';

describe('Profile: Completed Projects & Collaborator Task Guard', () => {
  const OWNER_USER = {
    id: 'owner-1',
    uid: 'owner-1',
    name: 'Alice Owner',
    email: 'alice@example.com',
    role: 'ProjectOwner',
  };

  const COLLAB_USER_QUALIFIED = {
    id: 'collab-1',
    uid: 'collab-1',
    name: 'Bob Qualified',
    email: 'bob@example.com',
    role: 'Collaborator',
  };

  const COLLAB_USER_ZERO_TASKS = {
    id: 'collab-2',
    uid: 'collab-2',
    name: 'Charlie ZeroTasks',
    email: 'charlie@example.com',
    role: 'Collaborator',
  };

  const MOCK_PROJECTS = [
    // 1. Completed Project with deliverable link
    {
      id: 'proj-comp-1',
      title: 'Decentralized Identity Protocol',
      name: 'Decentralized Identity Protocol',
      status: 'completed',
      isCompleted: true,
      ownerId: 'owner-1',
      owner: { id: 'owner-1', name: 'Alice Owner' },
      collaborators: [
        { id: 'collab-1', name: 'Bob Qualified' },
        { id: 'collab-2', name: 'Charlie ZeroTasks' },
      ],
      finalLink: 'https://github.com/teamforge/identity-protocol',
      completedAt: '2026-03-15T12:00:00.000Z',
    },
    // 2. Active in-progress project
    {
      id: 'proj-act-2',
      title: 'Quantum Simulator',
      name: 'Quantum Simulator',
      status: 'in-progress',
      isCompleted: false,
      ownerId: 'owner-1',
      owner: { id: 'owner-1', name: 'Alice Owner' },
      collaborators: [{ id: 'collab-1', name: 'Bob Qualified' }],
    },
    // 3. Soft-deleted completed project
    {
      id: 'proj-del-3',
      title: 'Deleted Legacy App',
      name: 'Deleted Legacy App',
      status: 'completed',
      isCompleted: true,
      deletedAt: '2026-03-01T00:00:00.000Z',
      ownerId: 'owner-1',
      collaborators: [{ id: 'collab-1', name: 'Bob Qualified' }],
      finalLink: 'https://github.com/teamforge/deleted-archive',
    },
  ];

  // Tasks for proj-comp-1 and proj-act-2
  const MOCK_TASKS = [
    // Completed task by collab-1 on proj-comp-1
    {
      id: 'task-1',
      projectId: 'proj-comp-1',
      title: 'Build cryptographic proofs',
      status: 'completed',
      assigneeId: 'collab-1',
      assignee: 'Bob Qualified',
    },
    // In-progress task by collab-2 on proj-comp-1 (NOT completed)
    {
      id: 'task-2',
      projectId: 'proj-comp-1',
      title: 'Write test suite',
      status: 'in-progress',
      assigneeId: 'collab-2',
      assignee: 'Charlie ZeroTasks',
    },
    // In-progress task by collab-1 on proj-act-2
    {
      id: 'task-3',
      projectId: 'proj-act-2',
      title: 'Setup simulation engine',
      status: 'in-progress',
      assigneeId: 'collab-1',
      assignee: 'Bob Qualified',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(joinRequestsApi, 'list').mockResolvedValue([]);
    vi.spyOn(mentorshipApi, 'getBadges').mockResolvedValue([]);
    vi.spyOn(gamificationApi, 'getUserLedger').mockResolvedValue([]);
    vi.spyOn(trustApi, 'getMyTrust').mockResolvedValue(null);
  });

  it('fetches projects with { status: "all" } and renders completed project with title, role ("Owner · Project Owner"), and Final Link for Owner', async () => {
    const listSpy = vi.spyOn(projectsApi, 'list').mockResolvedValue(MOCK_PROJECTS);
    vi.spyOn(tasksApi, 'listForProjects').mockResolvedValue(MOCK_TASKS);
    vi.spyOn(usersApi, 'getMe').mockResolvedValue(OWNER_USER);
    vi.spyOn(usersApi, 'getReputation').mockResolvedValue({ items: [], total: 0 });

    render(
      <AuthContext.Provider value={{ user: OWNER_USER, isAuthenticated: true }}>
        <MemoryRouter initialEntries={['/profile']}>
          <Profile />
        </MemoryRouter>
      </AuthContext.Provider>
    );

    // 1. Confirm projectsApi.list was called with { status: 'all' }
    await waitFor(() => {
      expect(listSpy).toHaveBeenCalledWith(expect.objectContaining({ status: 'all' }));
    });

    // 2. Completed project title appears in Completed Projects card
    await waitFor(() => {
      const completedCard = screen.getByText('Completed Projects').closest('.prof-glass-card');
      expect(within(completedCard).getByText('Decentralized Identity Protocol')).toBeDefined();
    });

    const completedCard = screen.getByText('Completed Projects').closest('.prof-glass-card');

    // 3. Role description appears as "Owner · Project Owner"
    expect(within(completedCard).getByText(/Owner · Project Owner/i)).toBeDefined();

    // 4. Clickable Final Link appears and points to deliverable URL
    const finalLink = within(completedCard).getByRole('link', { name: /Final Link/i });
    expect(finalLink).toBeDefined();
    expect(finalLink.getAttribute('href')).toBe('https://github.com/teamforge/identity-protocol');

    // 5. Soft-deleted project does not appear
    expect(within(completedCard).queryByText('Deleted Legacy App')).toBeNull();

    // 6. Stats projects accurately counts active (1) + completed (1) = 2
    expect(screen.getByText('2')).toBeDefined();
  });

  it('renders completed project for Collaborator with at least 1 completed task', async () => {
    vi.spyOn(projectsApi, 'list').mockResolvedValue(MOCK_PROJECTS);
    vi.spyOn(tasksApi, 'listForProjects').mockResolvedValue(MOCK_TASKS);
    vi.spyOn(usersApi, 'getMe').mockResolvedValue(COLLAB_USER_QUALIFIED);
    vi.spyOn(usersApi, 'getReputation').mockResolvedValue({ items: [], total: 0 });

    render(
      <AuthContext.Provider value={{ user: COLLAB_USER_QUALIFIED, isAuthenticated: true }}>
        <MemoryRouter initialEntries={['/profile']}>
          <Profile />
        </MemoryRouter>
      </AuthContext.Provider>
    );

    await waitFor(() => {
      const completedCard = screen.getByText('Completed Projects').closest('.prof-glass-card');
      expect(within(completedCard).getByText('Decentralized Identity Protocol')).toBeDefined();
    });

    const completedCard = screen.getByText('Completed Projects').closest('.prof-glass-card');
    expect(within(completedCard).getByText(/Collaborator · Contributor/i)).toBeDefined();
    const finalLink = within(completedCard).getByRole('link', { name: /Final Link/i });
    expect(finalLink).toBeDefined();
    expect(finalLink.getAttribute('href')).toBe('https://github.com/teamforge/identity-protocol');
  });

  it('omits completed project for Collaborator with 0 completed tasks (displays "No completed projects available.")', async () => {
    vi.spyOn(projectsApi, 'list').mockResolvedValue(MOCK_PROJECTS);
    vi.spyOn(tasksApi, 'listForProjects').mockResolvedValue(MOCK_TASKS);
    vi.spyOn(usersApi, 'getMe').mockResolvedValue(COLLAB_USER_ZERO_TASKS);
    vi.spyOn(usersApi, 'getReputation').mockResolvedValue({ items: [], total: 0 });

    render(
      <AuthContext.Provider value={{ user: COLLAB_USER_ZERO_TASKS, isAuthenticated: true }}>
        <MemoryRouter initialEntries={['/profile']}>
          <Profile />
        </MemoryRouter>
      </AuthContext.Provider>
    );

    await waitFor(() => {
      const completedCard = screen.getByText('Completed Projects').closest('.prof-glass-card');
      expect(within(completedCard).getByText('No completed projects available.')).toBeDefined();
    });

    const completedCard = screen.getByText('Completed Projects').closest('.prof-glass-card');
    expect(within(completedCard).queryByText('Decentralized Identity Protocol')).toBeNull();
  });
});
