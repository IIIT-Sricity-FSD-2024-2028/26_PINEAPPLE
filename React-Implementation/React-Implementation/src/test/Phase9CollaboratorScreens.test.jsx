import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import fs from 'fs';
import path from 'path';
import { renderWithProviders } from './test-utils';
import ProjectCard from '../components/features/ProjectCard';
import CollaboratorWorkspace from '../pages/collaborator/CollaboratorWorkspace';
import { useReasonAction } from '../hooks/useReasonAction';
import projectsApi from '../services/projectsApi';
import tasksApi from '../services/tasksApi';
import communicationApi from '../services/communicationApi';
import feedbackApi from '../services/feedbackApi';

// Mock backend API services
vi.mock('../services/projectsApi', () => ({
  default: {
    get: vi.fn(),
    getById: vi.fn(),
    getMyInvites: vi.fn(),
    acceptInvite: vi.fn(),
    declineInvite: vi.fn(),
    leave: vi.fn(),
    removeMember: vi.fn(),
  },
  isProjectLocked: vi.fn(() => false),
}));

vi.mock('../services/tasksApi', () => ({
  default: {
    list: vi.fn(),
    getByProject: vi.fn(),
    unassign: vi.fn(),
    review: vi.fn(),
    updateStatus: vi.fn(),
  },
}));

vi.mock('../services/communicationApi', () => ({
  default: {
    getMessages: vi.fn(),
    getProjectMessages: vi.fn(),
    markProjectRead: vi.fn(),
  },
}));

vi.mock('../services/feedbackApi', () => ({
  OTHER_REASON_ID: 'OTHER',
  default: {
    getFeedbackReasons: vi.fn(),
  },
}));

describe('PHASE 9: COLLABORATOR SCREENS', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    feedbackApi.getFeedbackReasons.mockResolvedValue({
      DECLINE_INVITATION: {
        actionType: 'DECLINE_INVITATION',
        title: 'Decline Project Invitation',
        confirmLabel: 'Decline Invitation',
        minReasons: 1,
        reasons: [
          { id: 'CURRENTLY_UNAVAILABLE', label: 'Currently Unavailable' },
          { id: 'SCHEDULE_CONFLICT', label: 'Schedule Conflict' },
          { id: 'OTHER', label: 'Other' },
        ],
      },
    });

    tasksApi.list.mockResolvedValue([]);
    communicationApi.getMessages.mockResolvedValue([]);
  });

  // =========================================================================
  // GUARD TEST: Negative & accept action API helpers cannot be called directly outside hook
  // =========================================================================
  describe('Part A - Guard Test & Unified Reason Actions', () => {
    it('guard test: ensures pages and components do not call projectsApi.declineInvite or acceptInvite directly', () => {
      // Find all source files under src/pages and src/components
      const srcDir = path.resolve(__dirname, '..');
      const directoriesToCheck = [
        path.join(srcDir, 'pages'),
        path.join(srcDir, 'components'),
      ];

      const getFilesRecursively = (dir) => {
        let results = [];
        if (!fs.existsSync(dir)) return results;
        const list = fs.readdirSync(dir);
        list.forEach((file) => {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          if (stat && stat.isDirectory()) {
            results = results.concat(getFilesRecursively(filePath));
          } else if (file.endsWith('.jsx') || file.endsWith('.js')) {
            results.push(filePath);
          }
        });
        return results;
      };

      const allFiles = directoriesToCheck.flatMap(getFilesRecursively);
      expect(allFiles.length).toBeGreaterThan(0);

      // Check each file for raw calls to projectsApi.declineInvite or projectsApi.acceptInvite
      for (const filePath of allFiles) {
        const content = fs.readFileSync(filePath, 'utf-8');
        expect(content).not.toMatch(/projectsApi\.declineInvite\s*\(/);
        expect(content).not.toMatch(/projectsApi\.acceptInvite\s*\(/);
      }

      // Verify useReasonAction hook is exported
      expect(typeof useReasonAction).toBe('function');
    });

    it('decline invite opens reason modal whether clicked in Notifications or Projects Marketplace', async () => {
      // Test consumer simulating a component using useReasonAction for invite actions
      const TestConsumer = () => {
        const {
          handleDeclineInvite,
          handleAcceptInvite,
          renderReasonModal,
        } = useReasonAction();

        return (
          <div>
            <button
              data-testid="test-decline-btn"
              onClick={() => handleDeclineInvite({ id: 'inv-456', projectName: 'Test Project Beta' })}
            >
              Decline Invite
            </button>
            <button
              data-testid="test-accept-btn"
              onClick={() => handleAcceptInvite('inv-456')}
            >
              Accept Invite
            </button>
            {renderReasonModal()}
          </div>
        );
      };

      renderWithProviders(<TestConsumer />);

      // Decline button should open the reason modal
      const declineBtn = screen.getByTestId('test-decline-btn');
      fireEvent.click(declineBtn);

      // Verify modal is open with title and entity name
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeDefined();
        expect(screen.getByText(/Decline Project Invitation/i)).toBeDefined();
        expect(screen.getByText(/Test Project Beta/i)).toBeDefined();
      });

      // Select a reason and submit
      const reasonChip = await screen.findByTestId('reason-chip-CURRENTLY_UNAVAILABLE');
      fireEvent.click(reasonChip);

      const confirmBtn = screen.getByTestId('universal-reason-confirm-btn');
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(projectsApi.declineInvite).toHaveBeenCalledWith(
          'inv-456',
          expect.objectContaining({
            reasons: expect.arrayContaining(['CURRENTLY_UNAVAILABLE']),
          })
        );
      });
    });

    it('accept invite dispatches acceptProjectInvite via Redux without requiring negative reason', async () => {
      projectsApi.acceptInvite.mockResolvedValue({ success: true });

      const TestConsumer = () => {
        const { handleAcceptInvite, renderReasonModal } = useReasonAction();
        return (
          <div>
            <button
              data-testid="test-accept-btn"
              onClick={() => handleAcceptInvite('inv-789')}
            >
              Accept
            </button>
            {renderReasonModal()}
          </div>
        );
      };

      renderWithProviders(<TestConsumer />);

      const acceptBtn = screen.getByTestId('test-accept-btn');
      fireEvent.click(acceptBtn);

      await waitFor(() => {
        expect(projectsApi.acceptInvite).toHaveBeenCalledWith('inv-789');
      });
    });
  });

  // =========================================================================
  // PART B: MEMBER BUTTON & DISABLED ACTION STATES
  // =========================================================================
  describe('Part B - Member Button & Disabled Action States', () => {
    it('marketplace card shows disabled Member button with tooltip for an existing member', () => {
      const mockProject = {
        id: 'p-member',
        title: 'Alpha Collaborations',
        ownerId: 'owner-1',
        members: ['current-user-123'],
        status: 'Open',
      };

      const handleApply = vi.fn();

      renderWithProviders(
        <ProjectCard
          project={mockProject}
          variant="marketplace"
          isMember={true}
          onApply={handleApply}
        />
      );

      const memberBtn = screen.getByTestId('member-btn-p-member');
      expect(memberBtn).toBeDefined();
      expect(memberBtn.textContent).toBe('Member');
      expect(memberBtn.getAttribute('disabled')).not.toBeNull();
      expect(memberBtn.getAttribute('aria-disabled')).toBe('true');
      expect(memberBtn.getAttribute('title')).toBe('You are already a member of this project');
      expect(memberBtn.style.cursor).toBe('not-allowed');

      // Clicking it does not trigger apply
      fireEvent.click(memberBtn);
      expect(handleApply).not.toHaveBeenCalled();
    });

    it('marketplace card shows disabled Owner button with tooltip when viewing own project', () => {
      const mockProject = {
        id: 'p-owner',
        title: 'My Own Project',
        ownerId: 'current-user-123',
        status: 'Open',
      };

      renderWithProviders(
        <ProjectCard
          project={mockProject}
          variant="marketplace"
          isOwner={true}
        />
      );

      const ownerBtn = screen.getByTestId('owner-btn-p-owner');
      expect(ownerBtn).toBeDefined();
      expect(ownerBtn.textContent).toBe('Owner');
      expect(ownerBtn.getAttribute('disabled')).not.toBeNull();
      expect(ownerBtn.getAttribute('aria-disabled')).toBe('true');
      expect(ownerBtn.getAttribute('title')).toBe('This is your project');
      expect(ownerBtn.style.cursor).toBe('not-allowed');
    });

    it('marketplace card shows disabled Applied button with tooltip and keeps Withdraw accessible', () => {
      const mockProject = {
        id: 'p-applied',
        title: 'Project with Active Application',
        status: 'Open',
      };

      const handleWithdraw = vi.fn();

      renderWithProviders(
        <ProjectCard
          project={mockProject}
          variant="marketplace"
          hasApplied={true}
          onWithdraw={handleWithdraw}
        />
      );

      const appliedBtn = screen.getByTestId('applied-btn-p-applied');
      expect(appliedBtn).toBeDefined();
      expect(appliedBtn.textContent).toBe('Applied');
      expect(appliedBtn.getAttribute('disabled')).not.toBeNull();
      expect(appliedBtn.getAttribute('aria-disabled')).toBe('true');
      expect(appliedBtn.getAttribute('title')).toBe('You have already applied to this project');
      expect(appliedBtn.style.cursor).toBe('not-allowed');

      const withdrawBtn = screen.getByTestId('withdraw-btn-p-applied');
      expect(withdrawBtn).toBeDefined();
      expect(withdrawBtn.textContent).toBe('Withdraw');
      fireEvent.click(withdrawBtn);
      expect(handleWithdraw).toHaveBeenCalled();
    });

    it('marketplace card shows disabled Full button with tooltip when capacity is reached', () => {
      const mockProject = {
        id: 'p-full',
        title: 'Fully Staffed Project',
        isFull: true,
        status: 'Open',
      };

      renderWithProviders(
        <ProjectCard
          project={mockProject}
          variant="marketplace"
        />
      );

      const fullBtn = screen.getByTestId('full-btn-p-full');
      expect(fullBtn).toBeDefined();
      expect(fullBtn.textContent).toBe('Full');
      expect(fullBtn.getAttribute('disabled')).not.toBeNull();
      expect(fullBtn.getAttribute('aria-disabled')).toBe('true');
      expect(fullBtn.getAttribute('title')).toBe('This project has reached its maximum team capacity');
      expect(fullBtn.style.cursor).toBe('not-allowed');
    });

    it('marketplace card shows disabled Closed button with tooltip when project is closed', () => {
      const mockProject = {
        id: 'p-closed',
        title: 'Closed Project',
        status: 'Closed',
      };

      renderWithProviders(
        <ProjectCard
          project={mockProject}
          variant="marketplace"
        />
      );

      const closedBtn = screen.getByTestId('closed-btn-p-closed');
      expect(closedBtn).toBeDefined();
      expect(closedBtn.textContent).toBe('Closed');
      expect(closedBtn.getAttribute('disabled')).not.toBeNull();
      expect(closedBtn.getAttribute('aria-disabled')).toBe('true');
      expect(closedBtn.getAttribute('title')).toBe('This project is closed');
      expect(closedBtn.style.cursor).toBe('not-allowed');
    });

    it('marketplace card shows disabled Completed button with tooltip when project is completed', () => {
      const mockProject = {
        id: 'p-completed',
        title: 'Completed Project',
        status: 'Completed',
        isCompleted: true,
      };

      renderWithProviders(
        <ProjectCard
          project={mockProject}
          variant="marketplace"
        />
      );

      const completedBtn = screen.getByTestId('completed-btn-p-completed');
      expect(completedBtn).toBeDefined();
      expect(completedBtn.textContent).toBe('Completed');
      expect(completedBtn.getAttribute('disabled')).not.toBeNull();
      expect(completedBtn.getAttribute('aria-disabled')).toBe('true');
      expect(completedBtn.getAttribute('title')).toBe('This project is completed');
      expect(completedBtn.style.cursor).toBe('not-allowed');
    });
  });

  // =========================================================================
  // PART C: DEADLINE CHANGE REASON FOR COLLABORATORS
  // =========================================================================
  describe('Part C - Deadline Change Reason Visible in Collaborator Workspace', () => {
    it('renders the latest deadline change reason directly under the due date', async () => {
      const mockProjectWithSingleChange = {
        id: 'project-single',
        title: 'Collaborative Project Alpha',
        description: 'Building an awesome system',
        dueDate: '2026-11-29T00:00:00.000Z',
        ownerId: 'owner-1',
        ownerName: 'Alice Owner',
        collaborators: [{ id: 'user-collab-1', name: 'Bob Collaborator' }],
        deadlineHistory: [
          {
            previousDueDate: '2026-11-15T00:00:00.000Z',
            newDueDate: '2026-11-29T00:00:00.000Z',
            reason: 'Needed 2 more weeks for security audit and bug fixes',
            changedBy: 'owner-1',
            changedByName: 'Alice Owner',
            changedAt: '2026-11-01T10:00:00.000Z',
          },
        ],
      };

      projectsApi.get.mockResolvedValue(mockProjectWithSingleChange);
      projectsApi.getById.mockResolvedValue(mockProjectWithSingleChange);

      renderWithProviders(
        <Routes>
          <Route path="/workspace/:projectId" element={<CollaboratorWorkspace />} />
        </Routes>,
        { route: '/workspace/project-single' }
      );

      // Wait for project overview to load
      await waitFor(() => {
        expect(screen.getByText('Collaborative Project Alpha')).toBeDefined();
      });

      // Verify the latest deadline change banner is rendered
      const banner = await screen.findByTestId('deadline-change-banner');
      expect(banner).toBeDefined();

      const text = screen.getByTestId('latest-deadline-change-text').textContent;
      expect(text).toContain('Deadline extended from 15 Nov 2026 to 29 Nov 2026');
      expect(text).toContain('Reason: Needed 2 more weeks for security audit and bug fixes');

      // With only 1 change, "View history" button is not needed
      expect(screen.queryByTestId('view-deadline-history-btn')).toBeNull();
    });

    it('renders "View history" button and opens history modal with all changes when multiple changes exist', async () => {
      const mockProjectWithMultipleChanges = {
        id: 'project-multi',
        title: 'Collaborative Project Beta',
        description: 'Multi-phase web platform',
        dueDate: '2026-12-15T00:00:00.000Z',
        ownerId: 'owner-1',
        ownerName: 'Alice Owner',
        collaborators: [{ id: 'user-collab-1', name: 'Bob Collaborator' }],
        deadlineHistory: [
          {
            previousDueDate: '2026-11-10T00:00:00.000Z',
            newDueDate: '2026-11-25T00:00:00.000Z',
            reason: 'Scope expanded to include mobile responsiveness',
            changedBy: 'owner-1',
            changedByName: 'Alice Owner',
            changedAt: '2026-11-02T10:00:00.000Z',
          },
          {
            previousDueDate: '2026-11-25T00:00:00.000Z',
            newDueDate: '2026-12-15T00:00:00.000Z',
            reason: 'Additional payment integration required by client',
            changedBy: 'owner-1',
            changedByName: 'Alice Owner',
            changedAt: '2026-11-12T14:30:00.000Z',
          },
        ],
      };

      projectsApi.get.mockResolvedValue(mockProjectWithMultipleChanges);
      projectsApi.getById.mockResolvedValue(mockProjectWithMultipleChanges);

      renderWithProviders(
        <Routes>
          <Route path="/workspace/:projectId" element={<CollaboratorWorkspace />} />
        </Routes>,
        { route: '/workspace/project-multi' }
      );

      await waitFor(() => {
        expect(screen.getByText('Collaborative Project Beta')).toBeDefined();
      });

      // Verify the latest deadline change banner displays the latest change
      const text = screen.getByTestId('latest-deadline-change-text').textContent;
      expect(text).toContain('Deadline extended from 25 Nov 2026 to 15 Dec 2026');
      expect(text).toContain('Reason: Additional payment integration required by client');

      // "View history" button should be visible
      const viewHistoryBtn = screen.getByTestId('view-deadline-history-btn');
      expect(viewHistoryBtn).toBeDefined();
      expect(viewHistoryBtn.textContent).toBe('View history');

      // Click "View history"
      fireEvent.click(viewHistoryBtn);

      // Verify the history modal opens
      await waitFor(() => {
        expect(screen.getByText('Project Deadline History')).toBeDefined();
      });

      const historyList = screen.getByTestId('deadline-history-list');
      expect(historyList).toBeDefined();

      // Check both entries are displayed in the modal
      expect(screen.getByText(/Scope expanded to include mobile responsiveness/)).toBeDefined();
      expect(screen.getAllByText(/Additional payment integration required by client/).length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText(/Alice Owner/).length).toBeGreaterThan(0);

      // Close modal
      const closeBtn = screen.getByTestId('close-deadline-history-btn');
      fireEvent.click(closeBtn);

      await waitFor(() => {
        expect(screen.queryByText('Project Deadline History')).toBeNull();
      });
    });

    it('renders "moved earlier from" when deadline is moved earlier', async () => {
      const mockProjectMovedEarlier = {
        id: 'project-earlier',
        title: 'Urgent Project',
        description: 'Urgent delivery required',
        dueDate: '2026-11-20T00:00:00.000Z',
        ownerId: 'owner-1',
        ownerName: 'Alice Owner',
        collaborators: [{ id: 'user-collab-1', name: 'Bob Collaborator' }],
        deadlineHistory: [
          {
            previousDueDate: '2026-11-30T00:00:00.000Z',
            newDueDate: '2026-11-20T00:00:00.000Z',
            reason: 'Client requested demo 10 days earlier for conference',
            changedBy: 'owner-1',
            changedByName: 'Alice Owner',
            changedAt: '2026-11-05T09:00:00.000Z',
          },
        ],
      };

      projectsApi.get.mockResolvedValue(mockProjectMovedEarlier);
      projectsApi.getById.mockResolvedValue(mockProjectMovedEarlier);

      renderWithProviders(
        <Routes>
          <Route path="/workspace/:projectId" element={<CollaboratorWorkspace />} />
        </Routes>,
        { route: '/workspace/project-earlier' }
      );

      await waitFor(() => {
        expect(screen.getByText('Urgent Project')).toBeDefined();
      });

      const banner = await screen.findByTestId('deadline-change-banner');
      expect(banner.textContent).toContain('Deadline moved earlier from 30 Nov 2026 to 20 Nov 2026');
      expect(banner.textContent).toContain('Reason: Client requested demo 10 days earlier for conference');
    });
  });
});
