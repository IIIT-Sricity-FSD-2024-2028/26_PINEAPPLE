import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import DeleteProjectDialog from '../components/features/DeleteProjectDialog';
import ProjectTombstone from '../pages/ProjectTombstone';
import projectsApi from '../services/projectsApi';
import { isProjectLocked } from '../utils/projectStatus';
import { renderWithStore } from './test-utils';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Enhanced Project Deletion Frontend Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. isProjectLocked utility tests
  // =========================================================================
  describe('isProjectLocked utility', () => {
    it('returns true when deletionScheduledAt is present', () => {
      const proj = { id: 'p1', status: 'Open', deletionScheduledAt: '2026-11-16T10:00:00.000Z' };
      expect(isProjectLocked(proj)).toBe(true);
    });

    it('returns true when isCompleted is true or status is completed/closed/deleted/deletion_scheduled', () => {
      expect(isProjectLocked({ isCompleted: true })).toBe(true);
      expect(isProjectLocked({ status: 'Completed' })).toBe(true);
      expect(isProjectLocked({ status: 'closed' })).toBe(true);
      expect(isProjectLocked({ status: 'deleted' })).toBe(true);
      expect(isProjectLocked({ status: 'deletion_scheduled' })).toBe(true);
    });

    it('returns false for normal active/open projects without deletionScheduledAt', () => {
      expect(isProjectLocked({ status: 'Open' })).toBe(false);
      expect(isProjectLocked({ status: 'In Progress' })).toBe(false);
      expect(isProjectLocked(null)).toBe(false);
    });
  });

  // =========================================================================
  // 2. DeleteProjectDialog component tests
  // =========================================================================
  describe('DeleteProjectDialog Component', () => {
    it('evaluates deletion check on open and displays blockers when dependencies exist', async () => {
      const checkSpy = vi.spyOn(projectsApi, 'checkDeletion').mockResolvedValueOnce({
        allowed: false,
        blockers: [
          {
            code: 'PROJECT_HAS_HISTORY',
            message: 'Projects with recorded work cannot be deleted; close the project instead.',
            count: 1,
          },
          {
            code: 'TASKS_IN_REVIEW',
            message: 'Cannot delete: 2 tasks currently in review.',
            count: 2,
          },
        ],
        impact: { activeCollaborators: 2 },
        requiresReason: true,
        noticeHours: 48,
        mode: 'scheduled',
      });

      const onReviewTasks = vi.fn();
      const onCloseProject = vi.fn();

      renderWithStore(
        <DeleteProjectDialog
          isOpen={true}
          projectId="proj-100"
          projectTitle="Blocked Project"
          onClose={() => {}}
          onReviewTasks={onReviewTasks}
          onCloseProject={onCloseProject}
        />,
      );

      // Loading state shown initially
      expect(screen.getByTestId('delete-dialog-loading')).toBeDefined();

      // Blockers container displayed
      await waitFor(() => {
        expect(screen.getByTestId('delete-dialog-blockers')).toBeDefined();
      });

      expect(checkSpy).toHaveBeenCalledWith('proj-100');
      expect(screen.getByText(/Cannot delete: 2 tasks currently in review/i)).toBeDefined();

      // Action buttons rendered
      const reviewBtn = screen.getByText('Review tasks');
      fireEvent.click(reviewBtn);
      expect(onReviewTasks).toHaveBeenCalled();

      // Delete confirmation button is not rendered when blockers exist
      expect(screen.queryByTestId('confirm-delete-project-btn')).toBeNull();
    });

    it('allows deletion with 48h notice, title confirmation, and reason selection when collaborators are active', async () => {
      vi.spyOn(projectsApi, 'checkDeletion').mockResolvedValueOnce({
        allowed: true,
        blockers: [],
        impact: {
          activeCollaborators: 3,
          openTasks: 2,
          pendingRequests: 1,
          pendingInvites: 1,
          pendingSessionsToRefund: 0,
        },
        requiresReason: true,
        noticeHours: 48,
        mode: 'scheduled',
      });

      const softDeleteSpy = vi.spyOn(projectsApi, 'softDelete').mockResolvedValueOnce({
        id: 'proj-200',
        mode: 'scheduled',
        deletionScheduledAt: '2026-11-16T12:00:00.000Z',
      });

      const onSuccess = vi.fn();
      const onClose = vi.fn();

      renderWithStore(
        <DeleteProjectDialog
          isOpen={true}
          projectId="proj-200"
          projectTitle="Scheduled Project Alpha"
          onClose={onClose}
          onSuccess={onSuccess}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId('delete-impact-summary')).toBeDefined();
      });

      // Impact summary verifies 3 collaborators lose access and 2 tasks released
      expect(screen.getByText(/3/)).toBeDefined();
      expect(screen.getByText(/active collaborator\(s\) will lose access/i)).toBeDefined();
      expect(screen.getByText(/2/)).toBeDefined();
      expect(screen.getByText(/open task\(s\) will be released/i)).toBeDefined();

      // Notice period notice shown
      expect(screen.getByTestId('scheduled-deletion-notice')).toBeDefined();

      // Confirm button is disabled initially
      const confirmBtn = screen.getByTestId('confirm-delete-project-btn');
      expect(confirmBtn).toHaveProperty('disabled', true);
      expect(confirmBtn.textContent).toContain('Schedule deletion (48h notice)');

      // Select a reason
      const reasonChip = screen.getByText('Change in project direction');
      fireEvent.click(reasonChip);

      // Still disabled because title does not match
      expect(confirmBtn).toHaveProperty('disabled', true);

      // Type title with typo / mismatch
      const titleInput = screen.getByTestId('delete-project-confirm-title-input');
      fireEvent.change(titleInput, { target: { value: 'Wrong Title' } });
      expect(screen.getByText(/Title does not match/i)).toBeDefined();
      expect(confirmBtn).toHaveProperty('disabled', true);

      // Type exact title (case-sensitive)
      fireEvent.change(titleInput, { target: { value: 'Scheduled Project Alpha' } });
      expect(screen.getByText(/✓ Title matches/i)).toBeDefined();

      // Confirm button is now enabled
      expect(confirmBtn).toHaveProperty('disabled', false);

      // Click to submit
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(softDeleteSpy).toHaveBeenCalledWith('proj-200', {
          confirmTitle: 'Scheduled Project Alpha',
          mode: 'scheduled',
          reasons: ['CHANGE_IN_PROJECT_DIRECTION'],
        });
        expect(onSuccess).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('enforces 3 deletions per 24 hours rate limit error message (429 PROJECT_DELETE_LIMIT)', async () => {
      vi.spyOn(projectsApi, 'checkDeletion').mockResolvedValueOnce({
        allowed: true,
        blockers: [],
        impact: { activeCollaborators: 0, openTasks: 0, pendingRequests: 0, pendingInvites: 0 },
        requiresReason: false,
        noticeHours: 0,
        mode: 'immediate',
      });

      vi.spyOn(projectsApi, 'softDelete').mockRejectedValueOnce({
        statusCode: 429,
        code: 'PROJECT_DELETE_LIMIT',
        message: 'Rate limit exceeded.',
      });

      renderWithStore(
        <DeleteProjectDialog
          isOpen={true}
          projectId="proj-limit"
          projectTitle="Immediate Delete"
          onClose={() => {}}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId('delete-project-confirm-title-input')).toBeDefined();
      });

      const titleInput = screen.getByTestId('delete-project-confirm-title-input');
      fireEvent.change(titleInput, { target: { value: 'Immediate Delete' } });

      const confirmBtn = screen.getByTestId('confirm-delete-project-btn');
      expect(confirmBtn.textContent).toContain('Delete project');
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        const errorAlert = screen.getByTestId('delete-project-submit-error');
        expect(errorAlert.textContent).toContain('deletion limit of 3 projects per 24 hours');
      });
    });

    it('admin mode provides immediate override and enforces 10-500 char explanation', async () => {
      vi.spyOn(projectsApi, 'checkDeletion').mockResolvedValueOnce({
        allowed: true,
        blockers: [],
        impact: { activeCollaborators: 1, openTasks: 0, pendingRequests: 0, pendingInvites: 0 },
        requiresReason: true,
        noticeHours: 48,
        mode: 'scheduled',
      });

      const softDeleteSpy = vi.spyOn(projectsApi, 'softDelete').mockResolvedValueOnce({
        id: 'proj-admin-override',
        mode: 'immediate',
        deletedAt: '2026-11-14T12:00:00.000Z',
      });

      renderWithStore(
        <DeleteProjectDialog
          isOpen={true}
          projectId="proj-admin-override"
          projectTitle="Admin Project"
          isAdmin={true}
          onClose={() => {}}
          onSuccess={() => {}}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText(/Admin Deletion Mode/i)).toBeDefined();
      });

      // Switch to immediate override
      const immediateRadio = screen.getByLabelText(/Delete immediately \(Admin override\)/i);
      fireEvent.click(immediateRadio);

      // Select reason
      const reasonChip = screen.getByText('Lack of resources');
      fireEvent.click(reasonChip);

      // Type title
      const titleInput = screen.getByTestId('delete-project-confirm-title-input');
      fireEvent.change(titleInput, { target: { value: 'Admin Project' } });

      // Explanation is required for admin (min 10 chars)
      const confirmBtn = screen.getByTestId('confirm-delete-project-btn');
      expect(confirmBtn).toHaveProperty('disabled', true);

      const explanationInput = screen.getByTestId('delete-project-explanation-input');
      fireEvent.change(explanationInput, { target: { value: 'Short' } });
      expect(confirmBtn).toHaveProperty('disabled', true);

      // Valid explanation >= 10 chars
      fireEvent.change(explanationInput, { target: { value: 'Administrative decision to terminate project.' } });
      expect(confirmBtn).toHaveProperty('disabled', false);

      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(softDeleteSpy).toHaveBeenCalledWith('proj-admin-override', {
          confirmTitle: 'Admin Project',
          mode: 'immediate',
          reasons: ['LACK_OF_RESOURCES'],
          explanation: 'Administrative decision to terminate project.',
        });
      });
    });
  });

  // =========================================================================
  // 3. ProjectTombstone component tests
  // =========================================================================
  describe('ProjectTombstone Component', () => {
    it('renders tombstone details for 410 PROJECT_DELETED with date, reasons, explanation and actions', () => {
      const tombstoneProject = {
        id: 'proj-tombstone-1',
        title: 'Sunset Platform App',
        deletedAt: '2026-11-14T10:00:00.000Z',
        reasons: ['CHANGE_IN_PROJECT_DIRECTION', 'LACK_OF_RESOURCES'],
        explanation: 'Initiative concluded by platform leadership.',
      };

      const onNavigate = vi.fn();

      renderWithStore(
        <ProjectTombstone project={tombstoneProject} onNavigate={onNavigate} />,
      );

      expect(screen.getByTestId('project-tombstone')).toBeDefined();
      expect(screen.getByText('Project Deleted')).toBeDefined();
      expect(screen.getByText('Sunset Platform App')).toBeDefined();
      expect(screen.getByText('Change in project direction')).toBeDefined();
      expect(screen.getByText('Lack of resources')).toBeDefined();
      expect(screen.getByText(/"Initiative concluded by platform leadership\."/)).toBeDefined();

      const browseBtn = screen.getByTestId('tombstone-browse-btn');
      fireEvent.click(browseBtn);
      expect(onNavigate).toHaveBeenCalledWith('/projects');

      const myWorkBtn = screen.getByTestId('tombstone-mywork-btn');
      fireEvent.click(myWorkBtn);
      expect(onNavigate).toHaveBeenCalledWith('/my-work');
    });
  });
});
