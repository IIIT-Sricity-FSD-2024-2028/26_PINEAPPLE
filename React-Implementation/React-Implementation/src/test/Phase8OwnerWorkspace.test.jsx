import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import OwnedWorkspace from '../pages/owner/OwnedWorkspace';
import joinRequestsApi from '../services/joinRequestsApi';
import projectsApi from '../services/projectsApi';
import tasksApi from '../services/tasksApi';
import communicationApi from '../services/communicationApi';
import usersApi from '../services/usersApi';
import { renderWithProviders } from './test-utils';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ projectId: 'proj-p8' }),
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
  },
  isProjectLocked: vi.fn(() => false),
}));

vi.mock('../services/tasksApi', () => ({
  default: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
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

describe('Phase 8: Owner Workspace (Request Filters, Invitations & Task Deletion)', () => {
  const mockProject = {
    id: 'proj-p8',
    title: 'Autonomous Multi-Agent Robotics',
    description: 'Robotics project with collaborative swarm agents.',
    ownerId: 'user-owner',
    owner: { id: 'user-owner', name: 'Priya Patel', username: 'priyapatel' },
    status: 'Open',
    requiredSkills: ['ROS', 'Python'],
    collaborators: [{ id: 'user-3', name: 'Kiran Bose', role: 'Collaborator' }],
    dueDate: '2026-12-30T00:00:00Z',
  };

  const mockRequests = [
    {
      id: 'req-pending-1',
      userId: 'user-2',
      applicantName: 'Arjun Sharma',
      username: 'arjunsharma',
      role: 'Collaborator',
      status: 'Pending',
      type: 'Applied',
      filterGroup: 'Pending',
      message: 'I have experience in trajectory optimization.',
      date: '2026-11-13T10:00:00Z',
    },
    {
      id: 'req-approved-1',
      userId: 'user-3',
      applicantName: 'Kiran Bose',
      username: 'kiranbose',
      role: 'Collaborator',
      status: 'Approved',
      type: 'Applied',
      filterGroup: 'Approved',
      message: 'Ready to contribute.',
      date: '2026-11-11T10:00:00Z',
    },
    {
      id: 'req-rejected-1',
      userId: 'user-4',
      applicantName: 'Vikram Seth',
      username: 'vikramseth',
      role: 'Collaborator',
      status: 'Rejected',
      type: 'Applied',
      filterGroup: 'Rejected',
      message: 'Looking to join.',
      date: '2026-11-09T10:00:00Z',
    },
  ];

  const mockInvites = [
    {
      id: 'inv-pending-1',
      projectId: 'proj-p8',
      invitedUserId: 'user-5',
      invitedUserName: 'Divya Nair',
      invitedUsername: 'divyanair',
      status: 'pending',
      type: 'Invited',
      filterGroup: 'Pending',
      message: 'Invitation to lead vision processing.',
      createdAt: '2026-11-14T08:00:00Z',
    },
    {
      id: 'inv-accepted-1',
      projectId: 'proj-p8',
      invitedUserId: 'user-6',
      invitedUserName: 'Rohan Gupta',
      invitedUsername: 'rohangupta',
      status: 'accepted',
      type: 'Invited',
      filterGroup: 'Approved',
      message: 'Invitation to lead simulation tests.',
      createdAt: '2026-11-10T08:00:00Z',
    },
    {
      id: 'inv-declined-1',
      projectId: 'proj-p8',
      invitedUserId: 'user-7',
      invitedUserName: 'Meera Iyer',
      invitedUsername: 'meeraiyer',
      status: 'declined',
      type: 'Invited',
      filterGroup: 'Rejected',
      message: 'Invitation for hardware design.',
      createdAt: '2026-11-08T08:00:00Z',
    },
    {
      id: 'inv-cancelled-1',
      projectId: 'proj-p8',
      invitedUserId: 'user-8',
      invitedUserName: 'Sameer Joshi',
      invitedUsername: 'sameerjoshi',
      status: 'cancelled',
      type: 'Invited',
      filterGroup: 'All',
      message: 'Invitation cancelled by owner.',
      createdAt: '2026-11-07T08:00:00Z',
    },
  ];

  const mockTasks = [
    {
      id: 'task-unassigned-1',
      projectId: 'proj-p8',
      title: 'Design obstacle avoidance mesh',
      status: 'To Do',
      priority: 'High',
      assigneeId: null,
      assigneeName: 'Unassigned',
      assignee: 'Unassigned',
      dueDate: '2026-12-01T00:00:00Z',
    },
    {
      id: 'task-assigned-1',
      projectId: 'proj-p8',
      title: 'Implement Kalman Filter',
      status: 'In Progress',
      priority: 'Medium',
      assigneeId: 'user-3',
      assigneeName: 'Kiran Bose',
      assignee: 'Kiran Bose',
      dueDate: '2026-12-05T00:00:00Z',
    },
    {
      id: 'task-completed-1',
      projectId: 'proj-p8',
      title: 'Initialize repository structure',
      status: 'Completed',
      priority: 'Low',
      assigneeId: null,
      assigneeName: 'Unassigned',
      dueDate: '2026-11-10T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    projectsApi.get.mockResolvedValue(mockProject);
    tasksApi.list.mockResolvedValue(mockTasks);
    joinRequestsApi.list.mockResolvedValue(mockRequests);
    projectsApi.listInvites.mockResolvedValue(mockInvites);
    communicationApi.getMessages.mockResolvedValue([]);
    usersApi.searchUsers.mockResolvedValue([]);
  });

  describe('Part A: Join Request Filters & Unified List', () => {
    it('1. Filter chips are strictly All, Pending, Approved, Rejected and counts derive from the combined array', async () => {
      renderWithProviders(<OwnedWorkspace />);

      await waitFor(() => {
        expect(screen.getByText('Autonomous Multi-Agent Robotics')).toBeDefined();
      });

      // Switch to Members tab
      const membersTab = screen.getByRole('tab', { name: /Members/i });
      expect(membersTab.textContent).toContain('2'); // 1 pending application + 1 pending invite = 2
      fireEvent.click(membersTab);

      await waitFor(() => {
        expect(screen.getByTestId('requests-section')).toBeDefined();
      });

      // Filter chips must be strictly: All, Pending, Approved, Rejected
      const requestsSection = screen.getByTestId('requests-section');
      expect(requestsSection.textContent).toContain('All');
      expect(requestsSection.textContent).toContain('Pending');
      expect(requestsSection.textContent).toContain('Approved');
      expect(requestsSection.textContent).toContain('Rejected');
      expect(requestsSection.textContent).not.toContain('Withdrawn');
      expect(requestsSection.textContent).not.toContain('System Closed');

      // Verify chip counts in requests section: All (7), Pending (2), Approved (2), Rejected (2)
      expect(requestsSection.textContent).toContain('All(7)');
      expect(requestsSection.textContent).toContain('Pending(2)');
      expect(requestsSection.textContent).toContain('Approved(2)');
      expect(requestsSection.textContent).toContain('Rejected(2)');
    });

    it('2. Pending filter shows pending applications + pending invitations with tag and Cancel action', async () => {
      renderWithProviders(<OwnedWorkspace />);

      const membersTab = await screen.findByRole('tab', { name: /Members/i });
      fireEvent.click(membersTab);

      const pendingChip = await screen.findByRole('tab', { name: /Pending/i });
      fireEvent.click(pendingChip);

      // Verify 2 pending items are rendered
      await waitFor(() => {
        expect(screen.getByText('Arjun Sharma')).toBeDefined();
        expect(screen.getByText('Divya Nair')).toBeDefined();
      });

      // Check type tags
      const typeTags = screen.getAllByTestId('item-type-tag');
      const tagTexts = typeTags.map((t) => t.textContent);
      expect(tagTexts).toContain('Applied');
      expect(tagTexts).toContain('Invited');

      // The invited pending row has Cancel invite button
      const cancelBtn = screen.getByTestId('cancel-invite-btn-inv-pending-1');
      expect(cancelBtn).toBeDefined();

      fireEvent.click(cancelBtn);
      await waitFor(() => {
        expect(projectsApi.cancelInvite).toHaveBeenCalledWith('proj-p8', 'inv-pending-1');
      });
    });

    it('3. Approved filter shows approved applications + accepted invitations', async () => {
      renderWithProviders(<OwnedWorkspace />);

      const membersTab = await screen.findByRole('tab', { name: /Members/i });
      fireEvent.click(membersTab);

      const approvedChip = await screen.findByRole('tab', { name: /Approved/i });
      fireEvent.click(approvedChip);

      const requestsSection = await screen.findByTestId('requests-section');
      await waitFor(() => {
        expect(requestsSection.textContent).toContain('Kiran Bose');
        expect(requestsSection.textContent).toContain('Rohan Gupta');
      });
      expect(requestsSection.textContent).not.toContain('Arjun Sharma');
      expect(requestsSection.textContent).not.toContain('Divya Nair');
    });

    it('4. Rejected filter shows rejected applications + declined invitations', async () => {
      renderWithProviders(<OwnedWorkspace />);

      const membersTab = await screen.findByRole('tab', { name: /Members/i });
      fireEvent.click(membersTab);

      const rejectedChip = await screen.findByRole('tab', { name: /Rejected/i });
      fireEvent.click(rejectedChip);

      const requestsSection = await screen.findByTestId('requests-section');
      await waitFor(() => {
        expect(requestsSection.textContent).toContain('Vikram Seth');
        expect(requestsSection.textContent).toContain('Meera Iyer');
      });
      expect(requestsSection.textContent).not.toContain('Arjun Sharma');
    });

    it('5. Empty state names the active filter when no items exist', async () => {
      // Mock empty requests and invites
      joinRequestsApi.list.mockResolvedValue([]);
      projectsApi.listInvites.mockResolvedValue([]);

      renderWithProviders(<OwnedWorkspace />);

      const membersTab = await screen.findByRole('tab', { name: /Members/i });
      fireEvent.click(membersTab);

      const pendingChip = await screen.findByRole('tab', { name: /Pending/i });
      fireEvent.click(pendingChip);

      await waitFor(() => {
        expect(screen.getAllByText(/No pending items/i).length).toBeGreaterThanOrEqual(1);
      });

      const rejectedChip = screen.getByRole('tab', { name: /Rejected/i });
      fireEvent.click(rejectedChip);

      await waitFor(() => {
        expect(screen.getAllByText(/No rejected items/i).length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('Part B: Task Deletion Enforcement', () => {
    it('6. Delete button is rendered only for unassigned tasks and removed upon clicking Delete', async () => {
      renderWithProviders(<OwnedWorkspace />);

      await waitFor(() => {
        expect(screen.getByText('Autonomous Multi-Agent Robotics')).toBeDefined();
      });

      // Switch to Tasks tab
      const tasksTab = screen.getByRole('tab', { name: /Tasks/i });
      fireEvent.click(tasksTab);

      await waitFor(() => {
        expect(screen.getByText('Design obstacle avoidance mesh')).toBeDefined();
        expect(screen.getByText('Implement Kalman Filter')).toBeDefined();
      });

      // task-unassigned-1 is unassigned: Delete button must be present
      const deleteBtn = screen.getByTestId('delete-task-btn-task-unassigned-1');
      expect(deleteBtn).toBeDefined();

      // task-assigned-1 is assigned: Delete button must NOT be rendered
      expect(screen.queryByTestId('delete-task-btn-task-assigned-1')).toBeNull();

      // task-completed-1 is completed: Delete button must NOT be rendered
      expect(screen.queryByTestId('delete-task-btn-task-completed-1')).toBeNull();

      // Clicking Delete calls tasksApi.remove and removes task from the UI
      fireEvent.click(deleteBtn);

      await waitFor(() => {
        expect(tasksApi.remove).toHaveBeenCalledWith('task-unassigned-1', 'Project Owner');
      });

      // Task disappears without page reload
      await waitFor(() => {
        expect(screen.queryByText('Design obstacle avoidance mesh')).toBeNull();
      });
    });
  });
});
