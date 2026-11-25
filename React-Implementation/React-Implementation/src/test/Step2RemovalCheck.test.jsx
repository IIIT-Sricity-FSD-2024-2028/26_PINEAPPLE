import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import OwnedWorkspace from '../pages/owner/OwnedWorkspace';
import projectsApi from '../services/projectsApi';
import tasksApi from '../services/tasksApi';
import joinRequestsApi from '../services/joinRequestsApi';
import communicationApi from '../services/communicationApi';
import usersApi from '../services/usersApi';
import { renderWithProviders } from './test-utils';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ projectId: 'proj-step2' }),
    useNavigate: () => vi.fn(),
  };
});

vi.mock('../services/projectsApi', () => ({
  default: {
    get: vi.fn(),
    list: vi.fn(),
    sendInvite: vi.fn(),
    listInvites: vi.fn(() => Promise.resolve([])),
    cancelInvite: vi.fn(() => Promise.resolve({})),
    getProjectTaskTemplates: vi.fn(() => Promise.resolve({ items: [] })),
    getMembers: vi.fn(),
    getRemovalCheck: vi.fn(),
    removeMember: vi.fn(),
  },
  isProjectLocked: vi.fn(() => false),
}));

vi.mock('../services/tasksApi', () => ({
  default: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
    review: vi.fn(),
    remove: vi.fn(() => Promise.resolve({})),
  },
}));

vi.mock('../services/joinRequestsApi', () => ({
  default: {
    list: vi.fn(),
    respond: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('../services/communicationApi', () => ({
  default: {
    getMessages: vi.fn(),
    markProjectRead: vi.fn(),
  },
}));

vi.mock('../services/usersApi', () => ({
  default: {
    searchUsers: vi.fn(),
    getResponseTime: vi.fn(),
  },
}));

describe('Step 2 Frontend: Owner Cannot Remove Collaborator With Task In Review', () => {
  const mockProject = {
    id: 'proj-step2',
    title: 'Autonomous Drone Navigation',
    description: 'An advanced multi-rotor path planning and flight stabilization platform.',
    ownerId: 'user-1',
    owner: { id: 'user-1', name: 'Priya Patel', username: 'priyapatel' },
    status: 'In Progress',
    requiredSkills: ['Python', 'C++'],
    collaborators: [
      { id: 'collab-1', userId: 'collab-1', name: 'Arjun Sharma', role: 'Collaborator' },
      { id: 'collab-2', userId: 'collab-2', name: 'Neha Gupta', role: 'Collaborator' },
    ],
    members: [
      { userId: 'user-1', name: 'Priya Patel', role: 'Owner' },
      { userId: 'collab-1', name: 'Arjun Sharma', role: 'Collaborator' },
      { userId: 'collab-2', name: 'Neha Gupta', role: 'Collaborator' },
    ],
    maxCollaborators: 5,
  };

  const mockTasks = [
    {
      id: 'task-1',
      projectId: 'proj-step2',
      title: 'GPS Waypoint Tracking',
      status: 'In Review',
      assigneeId: 'collab-1',
      assignee: 'Arjun Sharma',
      assigneeName: 'Arjun Sharma',
    },
    {
      id: 'task-2',
      projectId: 'proj-step2',
      title: 'Telemetry Dashboard',
      status: 'To Do',
      assigneeId: 'collab-2',
      assignee: 'Neha Gupta',
      assigneeName: 'Neha Gupta',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    projectsApi.get.mockResolvedValue(mockProject);
    projectsApi.getMembers.mockResolvedValue(mockProject.members);
    tasksApi.list.mockResolvedValue(mockTasks);
    joinRequestsApi.list.mockResolvedValue([]);
    communicationApi.getMessages.mockResolvedValue([]);
    usersApi.getResponseTime.mockResolvedValue({ medianHours: 12 });

    // Collab 1 is blocked with In Review task
    // Collab 2 is allowed
    projectsApi.getRemovalCheck.mockImplementation((projId, userId) => {
      if (String(userId) === 'collab-1') {
        return Promise.resolve({
          allowed: false,
          blockers: [{ taskId: 'task-1', title: 'GPS Waypoint Tracking', submittedAt: '2026-11-20T10:00:00Z' }],
          tasksToRelease: [],
          tasksKept: [],
        });
      }
      return Promise.resolve({
        allowed: true,
        blockers: [],
        tasksToRelease: [{ taskId: 'task-2', title: 'Telemetry Dashboard', status: 'To Do' }],
        tasksKept: [],
      });
    });
  });

  it('1. button disabled with tooltip when blocked, enabled when allowed', async () => {
    renderWithProviders(<OwnedWorkspace />, {
      user: { id: 'user-1', name: 'Priya Patel', role: 'Project Owner' },
    });

    await waitFor(() => {
      expect(screen.getByText('Autonomous Drone Navigation')).toBeDefined();
    });

    // Switch to Members tab
    const membersTabBtn = screen.getByRole('tab', { name: /members/i });
    fireEvent.click(membersTabBtn);

    await waitFor(() => {
      expect(screen.getByTestId('remove-member-btn-collab-1')).toBeDefined();
      expect(screen.getByTestId('remove-member-btn-collab-2')).toBeDefined();
    });

    const removeBtn1 = screen.getByTestId('remove-member-btn-collab-1');
    const removeBtn2 = screen.getByTestId('remove-member-btn-collab-2');

    // Collab 1 is blocked: disabled, tooltip, cursor not-allowed
    expect(removeBtn1.disabled).toBe(true);
    expect(removeBtn1.getAttribute('title')).toBe('1 submitted task(s) waiting for your review');
    expect(removeBtn1.style.cursor).toBe('not-allowed');

    // Collab 2 is allowed: enabled
    expect(removeBtn2.disabled).toBe(false);
    expect(removeBtn2.style.cursor).toBe('pointer');
  });

  it('2. clicking "Review tasks" jumps to Tasks tab filtered to those tasks', async () => {
    renderWithProviders(<OwnedWorkspace />, {
      user: { id: 'user-1', name: 'Priya Patel', role: 'Project Owner' },
    });

    await waitFor(() => {
      expect(screen.getByText('Autonomous Drone Navigation')).toBeDefined();
    });

    // Switch to Members tab
    fireEvent.click(screen.getByRole('tab', { name: /members/i }));

    await waitFor(() => {
      expect(screen.getByTestId('review-tasks-link-collab-1')).toBeDefined();
    });

    const reviewLink = screen.getByTestId('review-tasks-link-collab-1');
    fireEvent.click(reviewLink);

    // Should switch to Tasks tab and show filter banner
    await waitFor(() => {
      expect(screen.getByTestId('task-filter-banner')).toBeDefined();
      expect(screen.getByText(/showing submitted task\(s\) waiting for review/i)).toBeDefined();
      expect(screen.getByText('GPS Waypoint Tracking')).toBeDefined();
    });
  });

  it('3. 409 response in dialog displays blockers', async () => {
    projectsApi.removeMember.mockRejectedValue({
      statusCode: 409,
      code: 'MEMBER_HAS_TASKS_IN_REVIEW',
      serverMessage:
        'Review these submitted tasks first: approve them or send them back with feedback. Then you can remove this member.',
      blockers: [{ taskId: 'task-99', title: 'Late In Review Deliverable', submittedAt: '2026-11-21T09:00:00Z' }],
    });

    renderWithProviders(<OwnedWorkspace />, {
      user: { id: 'user-1', name: 'Priya Patel', role: 'Project Owner' },
    });

    await waitFor(() => {
      expect(screen.getByText('Autonomous Drone Navigation')).toBeDefined();
    });

    // Switch to Members tab
    fireEvent.click(screen.getByRole('tab', { name: /members/i }));

    await waitFor(() => {
      expect(screen.getByTestId('remove-member-btn-collab-2')).toBeDefined();
    });

    // Click remove on allowed Collab 2
    fireEvent.click(screen.getByTestId('remove-member-btn-collab-2'));

    // Reason dialog appears
    await waitFor(() => {
      expect(screen.getByLabelText(/reason for removal/i)).toBeDefined();
    });

    // Enter valid reason
    fireEvent.change(screen.getByLabelText(/reason for removal/i), {
      target: { value: 'Member is no longer actively contributing to the project tasks.' },
    });

    // Click confirm remove
    fireEvent.click(screen.getByRole('button', { name: /confirm remove/i }));

    // 409 Blockers container appears
    await waitFor(() => {
      const blockersContainer = screen.getByTestId('removal-blockers-container');
      expect(blockersContainer).toBeDefined();
      expect(within(blockersContainer).getByText(/review these submitted tasks first/i)).toBeDefined();
      expect(within(blockersContainer).getByText('Late In Review Deliverable')).toBeDefined();
    });
  });

  it('4. approving a task enables Remove', async () => {
    // Initial state: Collab 1 is blocked
    let collab1Blocked = true;
    projectsApi.getRemovalCheck.mockImplementation((projId, userId) => {
      if (String(userId) === 'collab-1' && collab1Blocked) {
        return Promise.resolve({
          allowed: false,
          blockers: [{ taskId: 'task-1', title: 'GPS Waypoint Tracking' }],
          tasksToRelease: [],
          tasksKept: [],
        });
      }
      return Promise.resolve({
        allowed: true,
        blockers: [],
        tasksToRelease: [],
        tasksKept: [{ taskId: 'task-1', title: 'GPS Waypoint Tracking', status: 'Completed' }],
      });
    });

    tasksApi.review.mockResolvedValue({ id: 'task-1', status: 'Completed' });

    renderWithProviders(<OwnedWorkspace />, {
      user: { id: 'user-1', name: 'Priya Patel', role: 'Project Owner' },
    });

    await waitFor(() => {
      expect(screen.getByText('Autonomous Drone Navigation')).toBeDefined();
    });

    // Check members tab initially: Collab 1 is blocked
    fireEvent.click(screen.getByRole('tab', { name: /members/i }));
    await waitFor(() => {
      expect(screen.getByTestId('remove-member-btn-collab-1').disabled).toBe(true);
    });

    // Now switch to Tasks tab and approve task-1
    fireEvent.click(screen.getByRole('tab', { name: /tasks/i }));
    await waitFor(() => {
      expect(screen.getByText('GPS Waypoint Tracking')).toBeDefined();
    });

    // Find Approve button for task-1
    collab1Blocked = false; // Task approved
    const approveBtn = screen.getByRole('button', { name: /^approve$/i });
    fireEvent.click(approveBtn);

    // Switch back to Members tab
    fireEvent.click(screen.getByRole('tab', { name: /members/i }));

    // Collab 1 should now be enabled
    await waitFor(() => {
      const removeBtn1 = screen.getByTestId('remove-member-btn-collab-1');
      expect(removeBtn1.disabled).toBe(false);
    });
  });
});
