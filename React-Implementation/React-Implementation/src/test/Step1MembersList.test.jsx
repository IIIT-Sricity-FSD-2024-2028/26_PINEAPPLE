import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import OwnedWorkspace from '../pages/owner/OwnedWorkspace';
import projectsApi from '../services/projectsApi';
import tasksApi from '../services/tasksApi';
import joinRequestsApi from '../services/joinRequestsApi';
import communicationApi from '../services/communicationApi';
import usersApi from '../services/usersApi';
import { renderWithProviders } from './test-utils';
import { formatPaymentError as formatBookingError } from '../store/thunks/paymentsThunks';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ projectId: 'proj-step1' }),
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

describe('Step 1 Frontend: One Role Per Person In Project Members List', () => {
  const mockProjectWithMembers = {
    id: 'proj-step1',
    title: 'Autonomous Swarm System',
    description: 'A robotics project coordinating multiple autonomous aerial agents in field operations.',
    ownerId: 'user-1',
    owner: { id: 'user-1', name: 'Priya Patel', username: 'priyapatel' },
    status: 'Open',
    requiredSkills: ['ROS', 'Python'],
    mentorId: 'user-3',
    mentor: 'Kiran Bose',
    collaborators: [{ id: 'user-2', name: 'Arjun Sharma', username: 'arjunsharma', role: 'Collaborator' }],
    members: [
      {
        userId: 'user-1',
        name: 'Priya Patel',
        username: 'priyapatel',
        role: 'Owner',
        joinedAt: '2026-10-01T00:00:00Z',
      },
      {
        userId: 'user-2',
        name: 'Arjun Sharma',
        username: 'arjunsharma',
        role: 'Collaborator',
        joinedAt: '2026-10-05T00:00:00Z',
      },
      {
        userId: 'user-3',
        name: 'Kiran Bose',
        username: 'kiranbose',
        role: 'Mentor',
        joinedAt: '2026-10-10T00:00:00Z',
      },
    ],
    memberCount: 3,
    approvedCollaboratorCount: 1,
    dueDate: '2026-12-30T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    projectsApi.get.mockResolvedValue(mockProjectWithMembers);
    tasksApi.list.mockResolvedValue([]);
    joinRequestsApi.list.mockResolvedValue([]);
    projectsApi.listInvites.mockResolvedValue([]);
    communicationApi.getMessages.mockResolvedValue([]);
    usersApi.searchUsers.mockResolvedValue([]);
  });

  it('renders API members list directly; count equals rows returned (Project Members 3)', async () => {
    renderWithProviders(<OwnedWorkspace />);

    await waitFor(() => {
      expect(screen.getByText('Autonomous Swarm System')).toBeDefined();
    });

    // Switch to Members tab
    const membersTab = screen.getByRole('tab', { name: /Members/i });
    fireEvent.click(membersTab);

    await waitFor(() => {
      expect(screen.getByText(/Project Members \(3\)/i)).toBeDefined();
    });

    // Verify all 3 members are displayed
    expect(screen.getAllByText('Priya Patel').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Arjun Sharma').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Kiran Bose').length).toBeGreaterThanOrEqual(1);
  });

  it('enforces role-based action buttons: Remove only on collaborator, Report inactive mentor only on mentor, owner has neither', async () => {
    renderWithProviders(<OwnedWorkspace />);

    await waitFor(() => {
      expect(screen.getByText('Autonomous Swarm System')).toBeDefined();
    });

    // Switch to Members tab
    const membersTab = screen.getByRole('tab', { name: /Members/i });
    fireEvent.click(membersTab);

    await waitFor(() => {
      expect(screen.getByText(/Project Members \(3\)/i)).toBeDefined();
    });

    // Remove button should appear for Collaborator (Arjun Sharma)
    const removeButtons = screen.getAllByRole('button', { name: /Remove/i });
    expect(removeButtons).toHaveLength(1);

    // Report inactive mentor should appear only for Mentor (Kiran Bose)
    const reportMentorButtons = screen.getAllByRole('button', { name: /Report inactive mentor/i });
    expect(reportMentorButtons).toHaveLength(1);
  });

  it('formatBookingError formats MENTOR_IS_PROJECT_MEMBER correctly', () => {
    const errorWithCode = {
      code: 'MENTOR_IS_PROJECT_MEMBER',
      message: 'A project owner or active collaborator cannot be booked as mentor on the same project.',
    };
    expect(formatBookingError(errorWithCode)).toBe(
      'A project owner or active collaborator cannot be booked as mentor on the same project.',
    );
  });
});
