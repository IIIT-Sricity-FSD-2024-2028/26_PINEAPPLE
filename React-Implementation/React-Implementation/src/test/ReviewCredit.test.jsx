import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from './test-utils';
import OwnedWorkspace from '../pages/owner/OwnedWorkspace';
import TaskCard from '../components/features/TaskCard';
import projectsApi from '../services/projectsApi';
import tasksApi from '../services/tasksApi';
import joinRequestsApi from '../services/joinRequestsApi';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ projectId: 'proj-rc', id: 'proj-rc' }),
    useNavigate: () => vi.fn(),
  };
});

vi.mock('../services/projectsApi', () => ({
  default: {
    get: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
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
    unassign: vi.fn(),
  },
}));

vi.mock('../services/joinRequestsApi', () => ({
  default: {
    list: vi.fn(),
  },
}));

vi.mock('../services/communicationApi', () => ({
  default: {
    getMessages: vi.fn().mockResolvedValue([]),
    sendMessage: vi.fn().mockResolvedValue({}),
  },
}));

describe('Review Time Credit & Mandatory Project Deadline Cascade Tests', () => {
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const now = Date.now();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. TaskCard Review Credit Badge & Deadline History', () => {
    it('renders the review credit badge with duration and tooltip on TaskCard', () => {
      const taskWithCredit = {
        id: 'task-credit-1',
        title: 'Implement OAuth Integration',
        status: 'To Do',
        dueDate: new Date(now + 10 * ONE_DAY).toISOString(),
        dueDateHistory: [
          {
            previousDueDate: new Date(now + 7 * ONE_DAY).toISOString(),
            newDueDate: new Date(now + 10 * ONE_DAY).toISOString(),
            creditMs: 3 * ONE_DAY,
            reason: 'REVIEW_CREDIT',
            at: new Date(now - 1 * ONE_DAY).toISOString(),
            extendedProject: false,
          },
        ],
      };

      renderWithProviders(<TaskCard task={taskWithCredit} userRole="Collaborator" />);

      const badge = screen.getByTestId('task-review-credit-badge-task-credit-1');
      expect(badge).toBeDefined();
      expect(badge.textContent).toContain('Deadline extended +3d (Review credit)');
      expect(badge.getAttribute('title')).toContain('Previous:');
      expect(badge.getAttribute('title')).toContain('New:');
    });

    it('renders collapsible deadline history on TaskCard', () => {
      const taskWithHistory = {
        id: 'task-credit-2',
        title: 'Database Sharding Plan',
        status: 'In Progress',
        dueDate: new Date(now + 12 * ONE_DAY).toISOString(),
        dueDateHistory: [
          {
            previousDueDate: new Date(now + 8 * ONE_DAY).toISOString(),
            newDueDate: new Date(now + 12 * ONE_DAY).toISOString(),
            creditMs: 4 * ONE_DAY,
            reason: 'REVIEW_CREDIT',
            at: new Date(now - 2 * ONE_DAY).toISOString(),
            extendedProject: true,
          },
        ],
      };

      renderWithProviders(<TaskCard task={taskWithHistory} userRole="Project Owner" />);

      const toggleBtn = screen.getByTestId('task-due-history-toggle-task-credit-2');
      expect(toggleBtn).toBeDefined();
      expect(toggleBtn.textContent).toContain('Deadline history (1)');

      // Expand history
      fireEvent.click(toggleBtn);
      const historyList = screen.getByTestId('task-due-history-task-credit-2');
      expect(historyList).toBeDefined();
      expect(historyList.textContent).toContain('Review time credit');
      expect(historyList.textContent).toContain('Project deadline extended');
    });
  });

  describe('2. Owner Rejection Modal Review Duration & Project Cascade', () => {
    it('displays review duration banner and prompts for project extension when task deadline exceeds project deadline', async () => {
      const subTime = new Date(now - 3 * ONE_DAY).toISOString(); // submitted 3 days ago
      const projectDueDate = new Date(now + 5 * ONE_DAY).toISOString(); // project due in 5 days
      const taskDueDate = new Date(now + 3 * ONE_DAY).toISOString(); // task due in 3 days -> 3d credit moves to +6 days (> project due!)

      const mockProject = {
        id: 'proj-rc',
        title: 'Review Cascade Test Project',
        description: 'Comprehensive project description exceeding one hundred characters requirement for robust testing.',
        ownerId: '1',
        ownerName: 'Owner User',
        status: 'In Progress',
        dueDate: projectDueDate,
        collaborators: [{ id: '2', name: 'Arjun Sharma', role: 'Collaborator' }],
      };

      const mockTasks = [
        {
          id: 'task-rc-1',
          projectId: 'proj-rc',
          title: 'Implement Search Endpoint',
          status: 'In Review',
          assigneeId: '2',
          assigneeName: 'Arjun Sharma',
          submittedAt: subTime,
          inReviewSince: subTime,
          dueDate: taskDueDate,
        },
      ];

      projectsApi.get.mockResolvedValue(mockProject);
      tasksApi.list.mockResolvedValue(mockTasks);
      joinRequestsApi.list.mockResolvedValue([]);
      tasksApi.review.mockResolvedValue({
        id: 'task-rc-1',
        status: 'To Do',
        dueDate: new Date(now + 6 * ONE_DAY).toISOString(),
      });

      renderWithProviders(<OwnedWorkspace />, {
        authUser: { id: '1', name: 'Owner User', role: 'Project Owner' },
      });

      // Switch to Tasks tab
      const tasksTabBtn = await screen.findByRole('tab', { name: /Tasks/i });
      fireEvent.click(tasksTabBtn);

      // Wait for tasks to load
      await waitFor(() => {
        expect(screen.getByText('Implement Search Endpoint')).toBeDefined();
      });

      // Click "Reject" button on In Review task
      const rejectBtn = screen.getByRole('button', { name: /Reject/i });
      fireEvent.click(rejectBtn);

      // Verify task rejection modal opened
      await waitFor(() => {
        expect(screen.getByTestId('task-reject-modal')).toBeDefined();
      });

      // Verify computed review duration banner
      const durationBanner = screen.getByTestId('task-review-duration-banner');
      expect(durationBanner).toBeDefined();
      expect(durationBanner.textContent).toContain('Review duration:');
      expect(durationBanner.textContent).toContain('3 days');

      // Verify warning that review credit exceeds project deadline
      const warningBanner = screen.getByTestId('project-deadline-cascade-warning');
      expect(warningBanner).toBeDefined();
      expect(warningBanner.textContent).toContain('exceeds project deadline');

      // Verify required Project Deadline Extension section is rendered
      const extSection = screen.getByTestId('extend-project-deadline-section');
      expect(extSection).toBeDefined();

      const reasonInput = screen.getByTestId('task-reject-reason-input');
      const projectDateInput = screen.getByTestId('extended-project-due-input');
      const projectReasonInput = screen.getByTestId('project-extension-reason-input');
      const confirmBtn = screen.getByTestId('confirm-task-reject-btn');

      // Type task rejection reason
      fireEvent.change(reasonInput, {
        target: { value: 'Please add unit test assertions for empty keyword search.' },
      });

      // Button should still be disabled because project deadline & reason are missing
      expect(confirmBtn.hasAttribute('disabled')).toBe(true);

      // Fill in valid project extension date & reason
      const futureDateStr = new Date(now + 10 * ONE_DAY).toISOString().split('T')[0];
      fireEvent.change(projectDateInput, { target: { value: futureDateStr } });
      fireEvent.change(projectReasonInput, {
        target: { value: 'Extending project deadline due to review waiting time on search.' },
      });

      // Now confirm button should be enabled
      expect(confirmBtn.hasAttribute('disabled')).toBe(false);

      // Click Send Back for Revision
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(tasksApi.review).toHaveBeenCalledWith('task-rc-1', expect.objectContaining({
          decision: 'reject',
          reason: 'Please add unit test assertions for empty keyword search.',
          extendedProjectDueDate: expect.any(String),
          projectReason: 'Extending project deadline due to review waiting time on search.',
        }));
      });
    });
  });
});
