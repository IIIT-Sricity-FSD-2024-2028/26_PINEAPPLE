import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithStore } from './test-utils.jsx';
import CollaboratorWorkspace from '../pages/collaborator/CollaboratorWorkspace.jsx';
import OwnedWorkspace from '../pages/owner/OwnedWorkspace.jsx';
import Settings from '../pages/settings.jsx';
import projectsApi from '../services/projectsApi.js';
import usersApi from '../services/usersApi.js';
import tasksApi from '../services/tasksApi.js';
import communicationApi from '../services/communicationApi.js';
import joinRequestsApi from '../services/joinRequestsApi.js';
import feedbackApi from '../services/feedbackApi.js';

describe('FEATURE: Leave Request with Owner Approval and Account Deletion Guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockUser = {
    id: 'user-collab-1',
    uid: 'user-collab-1',
    name: 'Alice Collab',
    username: 'alice_collab',
    email: 'alice@example.com',
    role: 'Collaborator',
    profileComplete: true,
    emailVerified: true,
  };

  it('collaborator sees Leave requested and can withdraw when pending request exists', async () => {
    vi.spyOn(projectsApi, 'get').mockResolvedValue({
      id: 'proj-1',
      title: 'Project Alpha',
      ownerId: 'owner-1',
      status: 'In Progress',
      members: [{ id: 'user-collab-1', role: 'Collaborator' }],
    });
    vi.spyOn(tasksApi, 'list').mockResolvedValue([]);
    vi.spyOn(communicationApi, 'getMessages').mockResolvedValue([]);
    vi.spyOn(feedbackApi, 'getFeedbackReasons').mockResolvedValue({
      actions: {
        LEAVE_PROJECT: {
          actionType: 'LEAVE_PROJECT',
          title: 'Leave Project',
          reasons: [{ id: 'TOO_BUSY', label: 'Too busy' }],
        },
      },
    });

    // Mock pending leave request
    vi.spyOn(projectsApi, 'getMyLeaveRequest').mockResolvedValue({
      id: 'lr-123',
      projectId: 'proj-1',
      userId: 'user-collab-1',
      status: 'pending',
      reasons: ['Too busy'],
      explanation: 'Cannot commit enough time',
    });
    vi.spyOn(projectsApi, 'withdrawLeaveRequest').mockResolvedValue({ success: true });

    renderWithStore(
      <Routes>
        <Route path="/collaborator/workspace/:projectId" element={<CollaboratorWorkspace />} />
      </Routes>,
      {
        route: '/collaborator/workspace/proj-1',
        preloadedState: {
          session: {
            user: mockUser,
            isAuthenticated: true,
            status: 'authenticated',
            activeRole: 'Collaborator',
            allowedRoles: ['Collaborator'],
          },
        },
      },
    );

    // Verify "Leave requested" disabled button and "Withdraw request" button
    await waitFor(() => {
      expect(screen.getByTestId('leave-requested-btn')).toBeTruthy();
      expect(screen.getByTestId('withdraw-leave-btn')).toBeTruthy();
      expect(screen.getByTestId('collab-pending-leave-banner')).toBeTruthy();
    });

    // Click withdraw
    fireEvent.click(screen.getByTestId('withdraw-leave-btn'));

    await waitFor(() => {
      expect(projectsApi.withdrawLeaveRequest).toHaveBeenCalledWith('proj-1');
      // After withdrawal, banner is removed and Leave Project button returns
      expect(screen.queryByTestId('collab-pending-leave-banner')).toBeNull();
      expect(screen.getByTestId('leave-project-btn')).toBeTruthy();
    });
  });

  it('owner can see pending leave requests with task summary and approve/reject', async () => {
    const mockOwnerUser = {
      id: 'owner-1',
      uid: 'owner-1',
      name: 'Bob Owner',
      username: 'bob_owner',
      email: 'bob@example.com',
      role: 'Owner',
    };

    vi.spyOn(projectsApi, 'get').mockResolvedValue({
      id: 'proj-1',
      title: 'Project Alpha',
      ownerId: 'owner-1',
      status: 'In Progress',
      members: [
        { id: 'owner-1', userId: 'owner-1', name: 'Bob Owner', role: 'Owner' },
        { id: 'user-collab-1', userId: 'user-collab-1', name: 'Alice Collab', role: 'Collaborator' },
      ],
    });
    vi.spyOn(tasksApi, 'list').mockResolvedValue([]);
    vi.spyOn(joinRequestsApi, 'list').mockResolvedValue([]);
    vi.spyOn(communicationApi, 'getMessages').mockResolvedValue([]);
    vi.spyOn(projectsApi, 'listInvites').mockResolvedValue([]);
    vi.spyOn(feedbackApi, 'getFeedbackReasons').mockResolvedValue({
      actions: {
        REJECT_LEAVE_REQUEST: {
          actionType: 'REJECT_LEAVE_REQUEST',
          title: 'Reject Leave Request',
          reasons: [{ id: 'TASKS_IN_PROGRESS', label: 'Tasks Currently In Progress' }],
          explanationRequired: true,
          explanationMin: 10,
        },
      },
    });

    vi.spyOn(projectsApi, 'listLeaveRequests').mockResolvedValue([
      {
        id: 'lr-123',
        projectId: 'proj-1',
        userId: 'user-collab-1',
        userName: 'Alice Collab',
        status: 'pending',
        reasons: ['Workload'],
        explanation: 'I need to step down due to exams',
        createdAt: new Date().toISOString(),
        taskSummary: {
          open: 1,
          inProgress: 2,
          inReview: 1,
          approved: 3,
        },
      },
    ]);

    vi.spyOn(projectsApi, 'approveLeaveRequest').mockResolvedValue({ success: true });
    vi.spyOn(projectsApi, 'rejectLeaveRequest').mockResolvedValue({ success: true });

    renderWithStore(
      <Routes>
        <Route path="/owner/workspace/:projectId" element={<OwnedWorkspace />} />
      </Routes>,
      {
        route: '/owner/workspace/proj-1?tab=members',
        preloadedState: {
          session: {
            user: mockOwnerUser,
            isAuthenticated: true,
            status: 'authenticated',
            activeRole: 'Project Owner',
            allowedRoles: ['Project Owner'],
          },
        },
      },
    );

    // Verify Leave Requests section on members tab
    await waitFor(() => {
      expect(screen.getByTestId('leave-requests-section')).toBeTruthy();
      const leaveCard = screen.getByTestId('leave-request-card-lr-123');
      expect(leaveCard).toBeTruthy();
      expect(leaveCard.textContent).toContain('In Progress: 2');
      expect(screen.getByTestId('approve-leave-btn-lr-123')).toBeTruthy();
      expect(screen.getByTestId('reject-leave-btn-lr-123')).toBeTruthy();
    });

    // Test approve action
    fireEvent.click(screen.getByTestId('approve-leave-btn-lr-123'));
    await waitFor(() => {
      expect(projectsApi.approveLeaveRequest).toHaveBeenCalledWith('lr-123', 'proj-1');
    });
  });

  it('settings screen disables delete account button and shows task blockers when user has active tasks', async () => {
    vi.spyOn(usersApi, 'getMe').mockResolvedValue(mockUser);
    vi.spyOn(usersApi, 'checkDeletionEligibility').mockResolvedValue({
      canDelete: false,
      taskBlockers: [
        {
          taskId: 'task-101',
          taskTitle: 'Build Authentication',
          projectId: 'proj-1',
          projectTitle: 'Project Alpha',
          status: 'In Progress',
        },
      ],
      obligations: [],
    });

    renderWithStore(
      <Routes>
        <Route path="/settings" element={<Settings />} />
      </Routes>,
      {
        route: '/settings',
        preloadedState: {
          session: {
            user: mockUser,
            isAuthenticated: true,
            status: 'authenticated',
          },
        },
      },
    );

    // Wait for deletion check banner to appear
    await waitFor(() => {
      expect(screen.getByTestId('deletion-blockers-warning')).toBeTruthy();
      expect(screen.getByTestId('deletion-task-blockers-list')).toBeTruthy();
      expect(screen.getByText(/Build Authentication/i)).toBeTruthy();
      expect(screen.getByText(/Project Alpha/i)).toBeTruthy();
    });

    // Type the correct username
    const usernameInput = screen.getByTestId('delete-account-username');
    fireEvent.change(usernameInput, { target: { value: 'alice_collab' } });

    // The delete button should still be disabled because of active task blockers!
    const deleteBtn = screen.getByTestId('delete-account-btn');
    expect(deleteBtn.disabled).toBe(true);
  });
});
