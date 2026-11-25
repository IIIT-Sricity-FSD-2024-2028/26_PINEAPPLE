import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthContext } from '../context/AuthContext';
import { NotificationContext } from '../context/NotificationContext';
import { renderWithProviders } from './test-utils';
import MyProjects from '../pages/owner/MyProjects';
import OwnedWorkspace from '../pages/owner/OwnedWorkspace';
import AppliedProjects from '../pages/collaborator/AppliedProjects';
import CollaboratorWorkspace from '../pages/collaborator/CollaboratorWorkspace';
import AdminProjectDetails from '../pages/admin/AdminProjectDetails';
import Notifications from '../pages/notifications';
import projectsApi from '../services/projectsApi';
import tasksApi from '../services/tasksApi';
import joinRequestsApi from '../services/joinRequestsApi';
import communicationApi from '../services/communicationApi';
import appealsApi from '../services/appealsApi';
import adminApi from '../services/adminApi';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ projectId: 'proj-12', id: 'proj-12' }),
    useNavigate: () => vi.fn(),
  };
});

vi.mock('../services/projectsApi', () => ({
  default: {
    get: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    releaseMemberTasks: vi.fn(),
    requestClose: vi.fn(),
    close: vi.fn(),
  },
  isProjectLocked: vi.fn((proj) => {
    const st = String(proj?.status || '').toLowerCase();
    return Boolean(proj?.isCompleted || st === 'completed' || st === 'closed');
  }),
  normalizeProject: vi.fn((p) => p),
}));

vi.mock('../services/tasksApi', () => ({
  default: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
  },
}));

vi.mock('../services/joinRequestsApi', () => ({
  default: {
    list: vi.fn(),
    getMyRequests: vi.fn(),
    remove: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('../services/communicationApi', () => ({
  default: {
    getMessages: vi.fn(),
    sendMessage: vi.fn(),
  },
}));

vi.mock('../services/appealsApi', () => ({
  default: {
    getMyAppeals: vi.fn(),
  },
}));

vi.mock('../services/adminApi', () => ({
  default: {
    getMyWarnings: vi.fn(),
  },
}));

const renderWithUser = (ui, user) =>
  renderWithProviders(
    <AuthContext.Provider value={{ user, loading: false, isAuthenticated: true }}>
      {ui}
    </AuthContext.Provider>,
  );

describe('Phase 12 - Stuck Projects, Requests & Inactivity Frontend UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    communicationApi.getMessages.mockResolvedValue([]);
    appealsApi.getMyAppeals.mockResolvedValue([]);
    adminApi.getMyWarnings.mockResolvedValue([]);
  });

  it('1. Owner MyProjects shows 48-hour zombie countdown banner when paused with pending requests', async () => {
    const graceIso = new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString();
    projectsApi.list.mockResolvedValue([
      {
        id: 'proj-12',
        title: 'Zombie Alpha',
        description: 'Needs request decision',
        status: 'Open',
        ownerId: '1',
        ownerName: 'Priya Patel',
        pausedAt: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString(),
        pendingReviewGraceExpiresAt: graceIso,
        pendingRequestsCount: 2,
        collaborators: [],
        skills: ['React'],
      },
    ]);

    renderWithUser(<MyProjects />, { id: '1', name: 'Priya Patel', role: 'Project Owner' });

    const banner = await screen.findByTestId('myprojects-zombie-banner-proj-12');
    expect(banner).toBeDefined();
    expect(banner.textContent).toContain('48-Hour Countdown Running');
    expect(banner.textContent).toContain('Zombie Alpha');
    expect(banner.textContent).toMatch(/\d+h\s+\d+m/);
  });

  it('2. OwnedWorkspace shows 48h countdown, inactive collaborator badge, and Release Tasks modal preserving In Review tasks', async () => {
    const now = Date.now();
    projectsApi.get.mockResolvedValue({
      id: 'proj-12',
      title: 'Workspace Project',
      description: 'Testing workspace banners and member task release',
      status: 'Open',
      ownerId: '1',
      owner: { id: '1', name: 'Priya Patel' },
      pausedAt: new Date(now - 10 * 60 * 60 * 1000).toISOString(),
      pendingReviewGraceExpiresAt: new Date(now + 38 * 60 * 60 * 1000).toISOString(),
      collaborators: [
        {
          id: '2',
          name: 'Arjun Sharma',
          role: 'Collaborator',
          lastActivityAt: new Date(now - 9 * 24 * 60 * 60 * 1000).toISOString(),
          inactiveDays: 9,
          isInactive: true,
        },
      ],
    });
    joinRequestsApi.list.mockResolvedValue([
      { id: 'jr-1', projectId: 'proj-12', userId: '7', userName: 'Neha', status: 'Pending' },
    ]);
    tasksApi.list.mockResolvedValue([
      { id: 't-todo', projectId: 'proj-12', title: 'Setup API Schema', status: 'To Do', assigneeId: '2', assigneeName: 'Arjun Sharma' },
      { id: 't-prog', projectId: 'proj-12', title: 'Build Worker Queue', status: 'In Progress', assigneeId: '2', assigneeName: 'Arjun Sharma' },
      { id: 't-rev', projectId: 'proj-12', title: 'Submitted Security Audit', status: 'In Review', assigneeId: '2', assigneeName: 'Arjun Sharma' },
    ]);
    projectsApi.releaseMemberTasks.mockResolvedValue({
      released: 2,
      taskIds: ['t-todo', 't-prog'],
      tasks: [],
    });

    renderWithUser(<OwnedWorkspace />, { id: '1', name: 'Priya Patel', role: 'Project Owner' });

    const wsBanner = await screen.findByTestId('workspace-zombie-banner');
    expect(wsBanner.textContent).toContain('Decide on pending requests within');

    // Switch to Members tab
    const membersTab = screen.getByRole('tab', { name: /Members/i });
    fireEvent.click(membersTab);

    const inactiveBadge = await screen.findByText(/No activity for 9\s+days/);
    expect(inactiveBadge).toBeDefined();

    const releaseBtn = screen.getByTestId('release-tasks-btn-2');
    fireEvent.click(releaseBtn);

    const modalBody = await screen.findByTestId('release-tasks-modal-body');
    expect(modalBody.textContent).toContain('Setup API Schema');
    expect(modalBody.textContent).toContain('Build Worker Queue');
    expect(modalBody.textContent).not.toContain('Submitted Security Audit');
    expect(modalBody.textContent).toContain('In Review');

    const confirmBtn = screen.getByTestId('confirm-release-tasks-btn');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(projectsApi.releaseMemberTasks).toHaveBeenCalledWith('proj-12', '2');
    });
  });

  it('3. AppliedProjects shows System Closed reason, restored slot counter, and early-withdraw slot confirmation copy', async () => {
    const now = Date.now();
    projectsApi.list.mockResolvedValue([
      { id: 'proj-a', title: 'Timed Out Project' },
      { id: 'proj-b', title: 'Fresh Early Withdraw' },
      { id: 'proj-c', title: 'Viewed Late Withdraw' },
    ]);
    joinRequestsApi.getMyRequests.mockResolvedValue([
      {
        id: 'req-sys',
        projectId: 'proj-a',
        status: 'system_closed',
        closureReason: 'No owner response',
        countedTowardLimit: false,
        requestsUsed: 0,
        requestsLeft: 2,
        sentAt: new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'req-early',
        projectId: 'proj-b',
        status: 'Pending',
        sentAt: new Date(now - 30 * 60 * 1000).toISOString(),
        viewedAt: null,
        earlyWithdrawEligible: true,
        requestsUsed: 1,
        requestsLeft: 1,
      },
      {
        id: 'req-late',
        projectId: 'proj-c',
        status: 'Pending',
        sentAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
        viewedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
        earlyWithdrawEligible: false,
        requestsUsed: 1,
        requestsLeft: 1,
      },
    ]);

    renderWithUser(<AppliedProjects />, { id: '7', name: 'Neha', role: 'Collaborator' });

    expect(await screen.findByText('System Closed')).toBeDefined();
    expect(screen.getByText('Closed because the owner did not respond')).toBeDefined();
    expect(screen.getByText('2/2 requests left (slot restored)')).toBeDefined();

    // Open withdraw dialog for unviewed <2h request -> slot will be returned
    const deleteButtons = screen.getAllByRole('button', { name: 'Delete Request' });
    fireEvent.click(deleteButtons[0]);
    const earlyNotice = await screen.findByTestId('withdraw-slot-notice');
    expect(earlyNotice.textContent).toContain('Your request slot will be returned');

    // Close modal via Cancel and open withdraw dialog for viewed/late request -> slot NOT returned
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(deleteButtons[1]);
    const lateNotice = await screen.findByTestId('withdraw-slot-notice');
    expect(lateNotice.textContent).toContain('Your request slot will NOT be returned');
  });

  it('4. CollaboratorWorkspace shows abandoned-owner banner and calls requestClose on Ask admin to close', async () => {
    projectsApi.get.mockResolvedValue({
      id: 'proj-12',
      title: 'Abandoned Project',
      description: 'Owner gone for 30+ days',
      status: 'Open',
      ownerId: '1',
      owner: { id: '1', name: 'Priya Patel' },
      ownerInactive14dNotifiedAt: '2026-10-25T12:00:00.000Z',
      ownerInactive30d: true,
      collaborators: [{ id: '2', name: 'Arjun Sharma', role: 'Collaborator' }],
    });
    tasksApi.list.mockResolvedValue([]);
    projectsApi.requestClose.mockResolvedValue({
      success: true,
      ticketId: 'sup-99',
      project: { id: 'proj-12', closeRequestedAt: '2026-11-11T12:00:00.000Z' },
    });

    renderWithUser(<CollaboratorWorkspace />, { id: '2', name: 'Arjun Sharma', role: 'Collaborator' });

    const banner = await screen.findByTestId('abandoned-owner-banner');
    expect(banner.textContent).toContain('Owner inactive for 30+ days');

    const askBtn = screen.getByTestId('ask-admin-close-btn');
    fireEvent.click(askBtn);

    await waitFor(() => {
      expect(projectsApi.requestClose).toHaveBeenCalledWith('proj-12', {});
    });
    expect(await screen.findByTestId('close-request-status')).toBeDefined();
  });

  it('5. AdminProjectDetails shows Owner inactive close action & Notifications renders clickable project links', async () => {
    projectsApi.get.mockResolvedValue({
      id: 'proj-12',
      title: 'Admin Review Project',
      description: 'Flagged for 30-day owner inactivity',
      status: 'Open',
      ownerId: '1',
      owner: 'Priya Patel',
      ownerInactive30d: true,
      closeRequestedAt: '2026-11-11T12:00:00.000Z',
      collaborators: [],
    });
    tasksApi.list.mockResolvedValue([]);
    projectsApi.close.mockResolvedValue({
      id: 'proj-12',
      title: 'Admin Review Project',
      status: 'Closed',
      closureReason: 'Owner inactive',
    });

    renderWithUser(<AdminProjectDetails />, { id: 'u-admin', name: 'Admin', role: 'Admin' });

    const adminCloseBtn = await screen.findByTestId('admin-close-project-btn');
    expect(adminCloseBtn.textContent).toContain('Close Project (Owner inactive)');
    fireEvent.click(adminCloseBtn);

    await waitFor(() => {
      expect(projectsApi.close).toHaveBeenCalledWith('proj-12', 'Owner inactive');
    });
    const reasonEl = await screen.findByTestId('admin-closure-reason');
    expect(reasonEl.textContent).toContain('Owner inactive');

    renderWithProviders(
      <NotificationContext.Provider
        value={{
          notifications: [
            {
              id: 'n-12',
              title: 'Inactivity Notice',
              message: 'You have had no task activity in Workspace Project.',
              link: '/collaborator/workspace/proj-12',
              referenceId: 'proj-12',
              isRead: false,
            },
          ],
          unreadCount: 1,
          markAsRead: vi.fn(),
          markAllAsRead: vi.fn(),
        }}
      >
        <Notifications />
      </NotificationContext.Provider>,
    );

    const notifLink = await screen.findByTestId('notif-link-n-12');
    expect(notifLink.getAttribute('href')).toBe('/collaborator/workspace/proj-12');
  });
});
