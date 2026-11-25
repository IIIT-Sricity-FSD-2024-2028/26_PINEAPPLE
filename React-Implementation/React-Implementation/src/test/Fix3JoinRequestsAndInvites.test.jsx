import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import OwnedWorkspace from '../pages/owner/OwnedWorkspace';
import ProjectCard from '../components/features/ProjectCard';
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
    useParams: () => ({ projectId: 'proj-fix3' }),
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
  },
  isProjectLocked: vi.fn(() => false),
}));

vi.mock('../services/tasksApi', () => ({
  default: {
    list: vi.fn(),
    create: vi.fn(),
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

describe('FIX 3 Frontend: Join Requests, Workspace Sections & Project Cards', () => {
  const mockProject = {
    id: 'proj-fix3',
    title: 'Autonomous Drone Navigation',
    description: 'Computer vision and ROS flight control system.',
    owner: 'Priya Patel',
    ownerId: '1',
    collaborators: [],
    status: 'Open',
    pendingRequestsCount: 1,
  };

  const mockRequests = [
    {
      id: 'req-pending-1',
      userId: 'user-3',
      applicantName: 'Kiran Bose',
      username: 'kiranbose',
      role: 'Collaborator',
      status: 'pending',
      message: 'Excited to contribute to autonomous perception.',
      skillMatch: { percent: 85, shared: ['Python'], missing: [] },
      createdAt: '2026-11-13T05:00:00Z',
    },
    {
      id: 'req-approved-1',
      userId: 'user-4',
      applicantName: 'Sneha Roy',
      username: 'sneharoy',
      role: 'Collaborator',
      status: 'approved',
      message: 'Ready to contribute.',
      createdAt: '2026-11-12T05:00:00Z',
    },
    {
      id: 'req-rejected-1',
      userId: 'user-5',
      applicantName: 'Amit Verma',
      username: 'amitverma',
      role: 'Collaborator',
      status: 'rejected',
      rejectionReason: 'Need more senior C++ experience.',
      createdAt: '2026-11-11T05:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    projectsApi.get.mockResolvedValue(mockProject);
    tasksApi.list.mockResolvedValue([]);
    joinRequestsApi.list.mockResolvedValue(mockRequests);
    communicationApi.getMessages.mockResolvedValue([]);
    projectsApi.listInvites.mockResolvedValue([]);
    usersApi.searchUsers.mockResolvedValue([]);
  });

  it('1. Owner Members tab displays pending count badge on tab and has two sections: Requests and Team', async () => {
    renderWithProviders(<OwnedWorkspace />);

    await waitFor(() => {
      expect(screen.getByText('Autonomous Drone Navigation')).toBeDefined();
    });

    // Check tab badge: Members tab displays count badge when pending requests exist
    const membersTab = screen.getByRole('tab', { name: /Members/i });
    expect(membersTab.textContent).toContain('Members');
    expect(membersTab.textContent).toContain('1'); // 1 pending request

    fireEvent.click(membersTab);

    // Both Requests section and Team section are present
    await waitFor(() => {
      expect(screen.getByTestId('requests-section')).toBeDefined();
      expect(screen.getByTestId('team-section')).toBeDefined();
    });

    // Requests section shows applicant details and action buttons
    expect(screen.getByText('Kiran Bose')).toBeDefined();
    expect(screen.getByText('@kiranbose')).toBeDefined();
    expect(screen.getByText(/85% Skill Match/)).toBeDefined();
    expect(screen.getByTestId('accept-join-request-btn')).toBeDefined();
    expect(screen.getByTestId('reject-join-request-btn')).toBeDefined();
  });

  it('2. Filter status pills on Requests section filter between All, Pending, Approved, and Rejected', async () => {
    renderWithProviders(<OwnedWorkspace />);

    await waitFor(() => {
      expect(screen.getByText('Autonomous Drone Navigation')).toBeDefined();
    });

    const membersTab = screen.getByRole('tab', { name: /Members/i });
    fireEvent.click(membersTab);

    await waitFor(() => {
      expect(screen.getByTestId('requests-section')).toBeDefined();
    });

    // Initially "all" shows all requests
    expect(screen.getByText('Kiran Bose')).toBeDefined();
    expect(screen.getByText('Sneha Roy')).toBeDefined();
    expect(screen.getByText('Amit Verma')).toBeDefined();

    // Click "Pending" filter tab
    const pendingPill = screen.getByRole('tab', { name: /Pending/i });
    fireEvent.click(pendingPill);

    expect(screen.getByText('Kiran Bose')).toBeDefined();
    expect(screen.queryByText('Sneha Roy')).toBeNull();
    expect(screen.queryByText('Amit Verma')).toBeNull();

    // Click "Approved" filter tab
    const approvedPill = screen.getByRole('tab', { name: /Approved/i });
    fireEvent.click(approvedPill);

    expect(screen.queryByText('Kiran Bose')).toBeNull();
    expect(screen.getByText('Sneha Roy')).toBeDefined();
  });

  it('3. Owner direct invite picker shows "Applied: review application" for users with pending application', async () => {
    usersApi.searchUsers.mockResolvedValue([
      { id: 'user-3', username: 'kiranbose', name: 'Kiran Bose', university: 'IIT Delhi' },
      { id: 'user-99', username: 'dev_new', name: 'New Developer', university: 'BITS Pilani' },
    ]);

    renderWithProviders(<OwnedWorkspace />);

    await waitFor(() => {
      expect(screen.getByText('Autonomous Drone Navigation')).toBeDefined();
    });

    const membersTab = screen.getByRole('tab', { name: /Members/i });
    fireEvent.click(membersTab);

    const searchInput = screen.getByTestId('invite-search-input');
    fireEvent.change(searchInput, { target: { value: 'dev' } });

    await waitFor(() => {
      expect(screen.getByTestId('invite-search-results')).toBeDefined();
    });

    // User with pending application shows "Applied: review application"
    expect(screen.getByTestId('applied-review-btn-kiranbose')).toBeDefined();
    expect(screen.getByTestId('applied-review-btn-kiranbose').textContent).toContain('Applied: review application');

    // New user shows standard "Invite" button
    expect(screen.getByTestId('invite-user-btn-dev_new')).toBeDefined();
    expect(screen.getByTestId('invite-user-btn-dev_new').textContent).toBe('Invite');
  });

  it('4. ProjectCard owner variant displays "N pending requests" linking to the requests section', () => {
    const ownerProject = {
      id: 'proj-fix3',
      title: 'Robotics Control Platform',
      description: 'Distributed robotics control system.',
      owner: 'Priya Patel',
      pendingRequestsCount: 3,
    };

    renderWithProviders(<ProjectCard project={ownerProject} variant="owner" />);

    const pendingLink = screen.getByTestId('pending-requests-link-proj-fix3');
    expect(pendingLink).toBeDefined();
    expect(pendingLink.textContent).toContain('3 pending requests');
  });

  it('5. ProjectCard marketplace variant renders correct button states: Apply, Applied with Withdraw, Invited: respond, and Not accepting requests', () => {
    // State 1: Open / can apply
    const { unmount: unmount1 } = renderWithProviders(
      <ProjectCard
        project={{ id: 'p1', title: 'Open Project', myRequestStatus: { state: 'none' } }}
        variant="marketplace"
      />
    );
    expect(screen.getByTestId('apply-btn-p1')).toBeDefined();
    expect(screen.getByTestId('apply-btn-p1').textContent).toBe('Apply');
    unmount1();

    // State 2: Pending application -> shows "Applied" and "Withdraw"
    const onWithdrawMock = vi.fn();
    const { unmount: unmount2 } = renderWithProviders(
      <ProjectCard
        project={{ id: 'p2', title: 'Pending Project', myRequestStatus: { state: 'pending' } }}
        variant="marketplace"
        onWithdraw={onWithdrawMock}
      />
    );
    expect(screen.getByTestId('applied-btn-p2')).toBeDefined();
    expect(screen.getByTestId('applied-btn-p2').textContent).toBe('Applied');
    const withdrawBtn = screen.getByTestId('withdraw-btn-p2');
    expect(withdrawBtn).toBeDefined();
    fireEvent.click(withdrawBtn);
    expect(onWithdrawMock).toHaveBeenCalledWith('p2');
    unmount2();

    // State 3: Owner invited user -> shows "Invited: respond" with Accept and Decline buttons
    const { unmount: unmount3 } = renderWithProviders(
      <ProjectCard
        project={{ id: 'p3', title: 'Invited Project', myRequestStatus: { state: 'invited', inviteId: 'inv-123' } }}
        variant="marketplace"
      />
    );
    expect(screen.getByText('Invited: respond')).toBeDefined();
    expect(screen.getByTestId('accept-invite-btn-p3')).toBeDefined();
    expect(screen.getByTestId('decline-invite-btn-p3')).toBeDefined();
    unmount3();

    // State 4: Completed -> shows "Completed" disabled
    const { unmount: unmount4 } = renderWithProviders(
      <ProjectCard
        project={{ id: 'p4', title: 'Completed Project', status: 'Completed', isCompleted: true }}
        variant="marketplace"
      />
    );
    const completedBtn = screen.getByTestId('completed-btn-p4');
    expect(completedBtn).toBeDefined();
    expect(completedBtn.textContent).toBe('Completed');
    expect(completedBtn.hasAttribute('disabled')).toBe(true);
    expect(completedBtn.getAttribute('title')).toBe('This project is completed');
    unmount4();
  });
});
