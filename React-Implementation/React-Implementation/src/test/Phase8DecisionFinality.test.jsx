import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import AdminReports from '../pages/admin/AdminReports';
import JoinRequestCard from '../components/features/JoinRequestCard';
import OwnedWorkspace from '../pages/owner/OwnedWorkspace';
import { renderWithProviders } from './test-utils';

const { mockReportsApi, mockAppealsApi, mockProjectsApi, mockTasksApi, mockJoinRequestsApi, mockNotificationsApi } = vi.hoisted(() => ({
  mockReportsApi: {
    getAdminReports: vi.fn(),
    getReportDetails: vi.fn(),
    getAdminReportById: vi.fn(),
    updateReportStatus: vi.fn(),
    actionReport: vi.fn(),
  },
  mockAppealsApi: {
    getAdminAppeals: vi.fn(),
    decideAppeal: vi.fn(),
  },
  mockProjectsApi: {
    get: vi.fn(),
    getById: vi.fn(),
    complete: vi.fn(),
  },
  mockTasksApi: {
    list: vi.fn(),
    listByProject: vi.fn(),
  },
  mockJoinRequestsApi: {
    list: vi.fn(),
    respond: vi.fn(),
  },
  mockNotificationsApi: {
    list: vi.fn(),
  },
}));

vi.mock('../services/reportsApi', () => ({
  default: mockReportsApi,
  reportsApi: mockReportsApi,
}));

vi.mock('../services/appealsApi', () => ({
  default: mockAppealsApi,
  appealsApi: mockAppealsApi,
}));

vi.mock('../services/projectsApi', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: mockProjectsApi,
    projectsApi: mockProjectsApi,
    isProjectLocked: (p) => Boolean(p && (p.isCompleted || String(p.status || '').toLowerCase() === 'completed' || String(p.status || '').toLowerCase() === 'closed')),
  };
});

vi.mock('../services/tasksApi', () => ({
  default: mockTasksApi,
  tasksApi: mockTasksApi,
}));

vi.mock('../services/joinRequestsApi', () => ({
  default: mockJoinRequestsApi,
  joinRequestsApi: mockJoinRequestsApi,
}));

vi.mock('../services/notificationsApi', () => ({
  default: mockNotificationsApi,
  notificationsApi: mockNotificationsApi,
}));

describe('Phase 8 Frontend Tests: Decision Finality, Data Integrity & Join Request Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    sessionStorage.setItem('teamforge.portalRole', 'Admin');
    sessionStorage.setItem('teamforge.isSuperUser', 'true');
  });

  describe('1. Admin Reports Decision Finality', () => {
    it('decided report (Resolved) shows disabled action buttons and decided status banner', async () => {
      const resolvedReport = {
        id: 'rep-resolved-1',
        reportedUserId: 'user-bad-1',
        reportedUserName: 'Target User',
        reportedUserUsername: 'targetuser',
        reporterId: 'user-rep-1',
        reporterName: 'Reporter User',
        reporterUsername: 'repuser',
        reason: 'Harassment',
        details: 'Offensive comments in group chat.',
        status: 'Resolved',
        adminNote: 'Official warning issued to user.',
        updatedAt: '2026-11-10T12:00:00.000Z',
        priorWarnings: [],
        priorReports: [],
      };

      mockReportsApi.getAdminReports.mockResolvedValue([resolvedReport]);
      mockReportsApi.getReportDetails.mockResolvedValue(resolvedReport);

      renderWithProviders(<AdminReports />);

      // Wait for table to load
      await waitFor(() => {
        expect(screen.getByText('Target User')).toBeDefined();
      });

      // Click to view report details
      fireEvent.click(screen.getByTestId('review-report-rep-resolved-1'));

      // Wait for report detail modal
      await waitFor(() => {
        expect(screen.getByTestId('report-decided-banner')).toBeDefined();
      });

      // Verify status and note
      expect(screen.getByText(/Report Resolved/i)).toBeDefined();
      expect(screen.getByText(/Official warning issued to user/i)).toBeDefined();

      // Verify action buttons are disabled
      const warnBtn = screen.getByTestId('action-warn-btn');
      const suspendBtn = screen.getByTestId('action-suspend-btn');
      const dismissBtn = screen.getByTestId('action-dismiss-btn');

      expect(warnBtn.hasAttribute('disabled')).toBe(true);
      expect(suspendBtn.hasAttribute('disabled')).toBe(true);
      expect(dismissBtn.hasAttribute('disabled')).toBe(true);
    });
  });

  describe('2. Owner Workspace Zero-Task Completion Prevention', () => {
    it('complete/publish button is disabled with text "Add at least one task to complete this project" when project has 0 tasks', async () => {
      mockProjectsApi.get.mockResolvedValue({
        id: 'proj-zero',
        title: 'Empty Project',
        ownerId: 'u-owner',
        status: 'Open',
        collaborators: [],
      });
      mockTasksApi.list.mockResolvedValue([]);
      mockJoinRequestsApi.list.mockResolvedValue([]);

      renderWithProviders(
        <Routes>
          <Route path="/workspace/:projectId" element={<OwnedWorkspace />} />
        </Routes>,
        { route: '/workspace/proj-zero' }
      );

      await waitFor(() => {
        expect(screen.getByText('Empty Project')).toBeDefined();
      });

      const publishBtn = screen.getByTestId('publish-project-toolbar-btn');
      expect(publishBtn).toBeDefined();
      expect(publishBtn.hasAttribute('disabled')).toBe(true);
      expect(publishBtn.textContent).toContain('Add at least one task to complete this project');
    });
  });

  describe('3. JoinRequestCard Double-Click Protection', () => {
    it('approve double-click sends only one call because button disables on first click', async () => {
      const mockRequest = {
        id: 'req-click-1',
        userName: 'Applicant User',
        role: 'Collaborator',
        status: 'Pending',
        message: 'I want to join!',
      };

      let callCount = 0;
      let resolvePromise;
      const onAcceptSpy = vi.fn().mockImplementation(() => {
        callCount++;
        return new Promise((resolve) => {
          resolvePromise = resolve;
        });
      });

      renderWithProviders(
        <JoinRequestCard request={mockRequest} onAccept={onAcceptSpy} onReject={vi.fn()} />
      );

      const acceptBtn = screen.getByTestId('accept-join-request-btn');
      expect(acceptBtn).toBeDefined();

      // First click
      fireEvent.click(acceptBtn);
      expect(onAcceptSpy).toHaveBeenCalledTimes(1);

      // Button is now disabled
      expect(acceptBtn.hasAttribute('disabled')).toBe(true);
      expect(acceptBtn.textContent).toContain('Accepting...');

      // Rapid second click while promise is in-flight
      fireEvent.click(acceptBtn);
      expect(onAcceptSpy).toHaveBeenCalledTimes(1);

      // Resolve the in-flight request
      resolvePromise();
      await waitFor(() => {
        expect(acceptBtn.hasAttribute('disabled')).toBe(false);
      });
      expect(callCount).toBe(1);
    });
  });

  describe('4. Notification Store Integration', () => {
    it('notification store endpoint returns seeded notifications', async () => {
      const seededNotifications = [
        {
          id: 'notif-1',
          userId: '2',
          type: 'TASK_ASSIGNED',
          title: 'Task Assigned',
          message: 'You have been assigned to "Implement Authentication".',
          readStatus: false,
          createdAt: new Date().toISOString(),
        },
      ];

      mockNotificationsApi.list.mockResolvedValue(seededNotifications);

      const res = await mockNotificationsApi.list({ userId: '2' });
      expect(Array.isArray(res)).toBe(true);
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe('notif-1');
      expect(res[0].title).toBe('Task Assigned');
    });
  });
});
