import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithStore } from './test-utils';
import OwnedWorkspace from '../pages/owner/OwnedWorkspace';
import CollaboratorWorkspace from '../pages/collaborator/CollaboratorWorkspace';
import AdminProjectDetails from '../pages/admin/AdminProjectDetails';
import TaskCard from '../components/features/TaskCard';
import projectsApi from '../services/projectsApi';
import tasksApi from '../services/tasksApi';
import joinRequestsApi from '../services/joinRequestsApi';
import communicationApi from '../services/communicationApi';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ projectId: 'proj-13', id: 'proj-13' }),
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
    getMessages: vi.fn(),
    sendMessage: vi.fn(),
  },
}));

const renderWithUser = (ui, user) =>
  renderWithStore(ui, {
    preloadedState: {
      session: {
        user,
        loading: false,
        isAuthenticated: true,
        status: 'authenticated',
      },
    },
  });

describe('Phase 13 - Task Review, Feedback, Waiting Badges & Drop Task Frontend UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    communicationApi.getMessages.mockResolvedValue([]);
    joinRequestsApi.list.mockResolvedValue([]);
  });

  it('1. OwnedWorkspace reject modal enforces 10-500 char reason with live counter, disabled submit, and server error display', async () => {
    const now = Date.now();
    projectsApi.get.mockResolvedValue({
      id: 'proj-13',
      title: 'Review Flow Project',
      description: 'Testing owner reject modal validation',
      status: 'Open',
      ownerId: '1',
      owner: { id: '1', name: 'Priya Patel' },
      collaborators: [{ id: '2', name: 'Arjun Sharma', role: 'Collaborator' }],
    });
    tasksApi.list.mockResolvedValue([
      {
        id: 't-rev-1',
        projectId: 'proj-13',
        title: 'API Rate Limiter',
        status: 'In Review',
        assigneeId: '2',
        assigneeName: 'Arjun Sharma',
        inReviewSince: new Date(now - 4 * 24 * 60 * 60 * 1000).toISOString(),
        dueDate: '2027-05-01T00:00:00.000Z',
        proofLink: 'https://github.com/org/repo/pull/5',
      },
    ]);
    tasksApi.review.mockRejectedValueOnce({ serverMessage: 'REASON_REQUIRED from server check' });
    tasksApi.review.mockResolvedValueOnce({
      id: 't-rev-1',
      status: 'To Do',
      rejectionReason: 'Please add Redis fallback tests.',
    });

    renderWithUser(<OwnedWorkspace />, { id: '1', name: 'Priya Patel', role: 'Project Owner' });

    const tasksTab = await screen.findByRole('tab', { name: /Tasks/i });
    fireEvent.click(tasksTab);

    // Waiting 4 days badge with warning tier
    const waitBadge = await screen.findByTestId('task-waiting-badge-t-rev-1');
    expect(waitBadge.textContent).toContain('Waiting 4 days');
    expect(waitBadge.getAttribute('data-waiting-level')).toBe('warning');

    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    expect(await screen.findByTestId('task-reject-modal')).toBeDefined();

    const submitBtn = screen.getByTestId('confirm-task-reject-btn');
    const textarea = screen.getByTestId('task-reject-reason-input');
    expect(submitBtn.hasAttribute('disabled')).toBe(true);

    // 9 characters keeps button disabled
    fireEvent.change(textarea, { target: { value: 'Too short' } });
    expect(screen.getByTestId('task-reject-counter').textContent).toContain('9 / 500');
    expect(submitBtn.hasAttribute('disabled')).toBe(true);

    // 10+ characters enables submit and surfaces server error on failure
    fireEvent.change(textarea, { target: { value: 'Please add Redis fallback tests.' } });
    expect(submitBtn.hasAttribute('disabled')).toBe(false);
    fireEvent.click(submitBtn);

    const serverErr = await screen.findByTestId('task-reject-error');
    expect(serverErr.textContent).toContain('REASON_REQUIRED from server check');

    // Second click succeeds
    fireEvent.click(submitBtn);
    await waitFor(() => {
      expect(tasksApi.review).toHaveBeenCalledWith('t-rev-1', {
        decision: 'reject',
        reason: 'Please add Redis fallback tests.',
      });
    });
  });

  it('2. TaskCard displays collaborator Changes requested box, collapsible history, waiting color levels, and Auto-approved label', () => {
    const now = Date.now();
    renderWithUser(
      <div>
        <TaskCard
          userRole="Collaborator"
          currentUserId="2"
          currentUserName="Arjun Sharma"
          task={{
            id: 't-c1',
            title: 'Fix UI Forms',
            status: 'To Do',
            assigneeId: '2',
            assigneeName: 'Arjun Sharma',
            dueDate: new Date(now + 5 * 24 * 60 * 60 * 1000).toISOString(),
            rejectionReason: 'Missing field-level ARIA attributes.',
            rejectionHistory: [
              { reason: 'First feedback entry', at: '2026-11-05T10:00:00.000Z', by: '1' },
              { reason: 'Missing field-level ARIA attributes.', at: '2026-11-09T10:00:00.000Z', by: '1' },
            ],
          }}
        />
        <TaskCard
          userRole="Project Owner"
          task={{
            id: 't-o7',
            title: 'Long Waiting Review',
            status: 'In Review',
            assigneeId: '2',
            assigneeName: 'Arjun Sharma',
            inReviewSince: new Date(now - 7 * 24 * 60 * 60 * 1000 - 60000).toISOString(),
          }}
        />
        <TaskCard
          userRole="Project Owner"
          task={{
            id: 't-auto',
            title: 'Auto Approved Deliverable',
            status: 'Completed',
            assigneeId: '2',
            assigneeName: 'Arjun Sharma',
            autoApproved: true,
          }}
        />
      </div>,
      { id: '2', name: 'Arjun Sharma', role: 'Collaborator' },
    );

    const changesBox = screen.getByTestId('task-changes-requested-t-c1');
    expect(changesBox.textContent).toContain('Changes requested');
    expect(changesBox.textContent).toContain('Missing field-level ARIA attributes.');

    // Read-only due date indicator for collaborator
    expect(screen.getByTestId('task-due-date-t-c1').getAttribute('data-readonly-due')).toBe('true');

    // Toggle revision history
    const toggleBtn = screen.getByTestId('task-rejection-history-toggle-t-c1');
    expect(screen.queryByTestId('task-rejection-history-t-c1')).toBeNull();
    fireEvent.click(toggleBtn);
    const historyList = screen.getByTestId('task-rejection-history-t-c1');
    expect(historyList.textContent).toContain('First feedback entry');

    // Waiting >= 7 days critical tier
    const criticalBadge = screen.getByTestId('task-waiting-badge-t-o7');
    expect(criticalBadge.textContent).toContain('Waiting 7 days');
    expect(criticalBadge.getAttribute('data-waiting-level')).toBe('critical');

    // Auto-approved label
    expect(screen.getByTestId('task-auto-approved-badge-t-auto').textContent).toContain(
      'Auto-approved after 7 days',
    );
  });

  it('3. CollaboratorWorkspace Drop Task dialog requires reason within 24h of dueDate and allows immediate drop outside 24h', async () => {
    const now = Date.now();
    projectsApi.get.mockResolvedValue({
      id: 'proj-13',
      title: 'Drop Rules Project',
      description: 'Testing collaborator unassign modal',
      status: 'Open',
      ownerId: '1',
      owner: { id: '1', name: 'Priya Patel' },
      collaborators: [{ id: '2', name: 'Arjun Sharma', role: 'Collaborator' }],
    });
    tasksApi.list.mockResolvedValue([
      {
        id: 't-late',
        projectId: 'proj-13',
        title: 'Urgent Migration',
        status: 'In Progress',
        assigneeId: '2',
        assigneeName: 'Arjun Sharma',
        dueDate: new Date(now + 6 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 't-early',
        projectId: 'proj-13',
        title: 'Later Cleanup',
        status: 'To Do',
        assigneeId: '2',
        assigneeName: 'Arjun Sharma',
        dueDate: new Date(now + 72 * 60 * 60 * 1000).toISOString(),
      },
    ]);
    tasksApi.unassign.mockResolvedValue({
      status: 'To Do',
      assignee: 'Unassigned',
      assigneeId: '',
    });

    renderWithUser(<CollaboratorWorkspace />, { id: '2', name: 'Arjun Sharma', role: 'Collaborator' });

    fireEvent.click(await screen.findByRole('tab', { name: /Tasks/i }));

    // Late task -> reason required
    fireEvent.click(await screen.findByTestId('task-unassign-btn-t-late'));
    expect(await screen.findByTestId('late-unassign-notice')).toBeDefined();
    const confirmDropBtn = screen.getByTestId('confirm-task-unassign-btn');
    expect(confirmDropBtn.hasAttribute('disabled')).toBe(true);

    fireEvent.change(screen.getByTestId('task-unassign-reason-input'), {
      target: { value: 'Blocking production outage on another module.' },
    });
    expect(confirmDropBtn.hasAttribute('disabled')).toBe(false);
    fireEvent.click(confirmDropBtn);

    await waitFor(() => {
      expect(tasksApi.unassign).toHaveBeenCalledWith('t-late', expect.objectContaining({
        reason: 'Blocking production outage on another module.',
      }));
    });

    // Early task -> reason now required under Fix 4
    fireEvent.click(screen.getByTestId('task-unassign-btn-t-early'));
    expect(await screen.findByTestId('early-unassign-notice')).toBeDefined();
    const earlyConfirm = screen.getByTestId('confirm-task-unassign-btn');
    expect(earlyConfirm.hasAttribute('disabled')).toBe(true);

    fireEvent.change(screen.getByTestId('task-unassign-reason-input'), {
      target: { value: 'Scheduling conflict with upcoming examination.' },
    });
    expect(earlyConfirm.hasAttribute('disabled')).toBe(false);
    fireEvent.click(earlyConfirm);

    await waitFor(() => {
      expect(tasksApi.unassign).toHaveBeenCalledWith('t-early', expect.objectContaining({
        reason: 'Scheduling conflict with upcoming examination.',
      }));
    });
  });

  it('4. AdminProjectDetails shows Auto-approved after 7 days badge in Tasks table', async () => {
    projectsApi.get.mockResolvedValue({
      id: 'proj-13',
      title: 'Admin Audit Project',
      description: 'Verify admin visibility of autoApproved label',
      status: 'Open',
      ownerId: '1',
      owner: 'Priya Patel',
      collaborators: [],
    });
    tasksApi.list.mockResolvedValue([
      {
        id: 't-admin-auto',
        title: 'Timeout Approved Task',
        status: 'Completed',
        assignee: 'Arjun Sharma',
        autoApproved: true,
        dueDate: '2027-05-01T00:00:00.000Z',
      },
    ]);

    renderWithUser(<AdminProjectDetails />, { id: 'u-admin', name: 'Admin', role: 'Admin' });
    expect(await screen.findByText('Auto-approved after 7 days')).toBeDefined();
  });
});
