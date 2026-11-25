import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SuperuserConfig from '../pages/admin/SuperuserConfig';
import AdminReports from '../pages/admin/AdminReports';
import ScheduledJobsPanel from '../pages/admin/ScheduledJobsPanel';
import adminApi from '../services/adminApi';
import portalAdminsApi from '../services/portalAdminsApi';
import { AuthContext } from '../context/AuthContext';

vi.mock('../services/adminApi', () => ({
  default: {
    getStats: vi.fn(),
    getConfig: vi.fn(),
    updateConfig: vi.fn(),
    getJobRuns: vi.fn(),
    getJobRun: vi.fn(),
    triggerJobTick: vi.fn(),
    getDisputes: vi.fn(),
    decideDispute: vi.fn(),
    getNeedsReviewSessions: vi.fn(),
    clearSessionReview: vi.fn(),
    getOwnerRejectionPatterns: vi.fn(),
    recordAuditEntry: vi.fn(),
  },
  recordPortalAuditEntry: vi.fn(),
}));

vi.mock('../services/portalAdminsApi', () => ({
  default: {
    list: vi.fn(),
  },
}));

vi.mock('../services/reportsApi', () => {
  const api = {
    getAdminReports: vi.fn().mockResolvedValue([]),
    getReportDetails: vi.fn(),
    updateReportStatus: vi.fn(),
    getOwnerPatterns: vi.fn().mockResolvedValue([]),
  };
  return {
    reportsApi: api,
    default: api,
  };
});

vi.mock('../services/appealsApi', () => {
  const api = {
    getAdminAppeals: vi.fn().mockResolvedValue([]),
    decideAppeal: vi.fn(),
  };
  return {
    appealsApi: api,
    default: api,
  };
});

describe('Phase 23 Frontend: No Snapshot/Integrity Panels, Needs-Review Clear & Hygiene Job Counts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('1. SuperuserConfig omits removed Snapshot and Integrity cards (FIX 1)', async () => {
    sessionStorage.setItem('teamforge.role', 'superuser');
    sessionStorage.setItem('teamforge.portalRole', 'superuser');
    sessionStorage.setItem('teamforge.isSuperUser', 'true');

    portalAdminsApi.list.mockResolvedValue([]);
    adminApi.getStats.mockResolvedValue({ activeAdmins: 1, activeUsers: 5 });
    adminApi.getConfig.mockResolvedValue({
      maxProjectsPerUser: 10,
      maxCollaboratorsPerProject: 20,
      minimumTenure: 5,
      xpPerTaskCompletion: 100,
      maintenanceMode: false,
      platformVersion: '1.4.2',
    });
    adminApi.getJobRuns.mockResolvedValue([]);

    render(
      <MemoryRouter>
        <SuperuserConfig />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(adminApi.getConfig).toHaveBeenCalled();
    });
    expect(screen.queryByTestId('snapshot-card')).toBeNull();
    expect(screen.queryByTestId('integrity-card')).toBeNull();
  });

  it('2. AdminReports surfaces needs_review sessions in Escrow tab and clears flag with mandatory reason', async () => {
    adminApi.getDisputes.mockResolvedValue([]);
    adminApi.getNeedsReviewSessions
      .mockResolvedValueOnce([
        {
          id: 'sess-broken-42',
          projectId: 'proj-42',
          projectName: 'AI Campus Match',
          needsReviewReason: 'Funded session references missing escrow esc-99',
          preReviewStatus: 'active',
        },
      ])
      .mockResolvedValueOnce([]);
    adminApi.clearSessionReview.mockResolvedValue({
      id: 'sess-broken-42',
      status: 'active',
    });

    render(
      <MemoryRouter>
        <AuthContext.Provider
          value={{
            user: { id: 'admin-1', role: 'admin', permissions: ['reports'] },
            role: 'admin',
            isAuthenticated: true,
          }}
        >
          <AdminReports />
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    const escrowTabBtn = screen.getByRole('button', { name: /Escrow Disputes/i });
    fireEvent.click(escrowTabBtn);

    await waitFor(() => {
      expect(screen.getByTestId('needs-review-sessions-section')).toBeTruthy();
      expect(screen.getByTestId('needs-review-row-sess-broken-42')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('clear-review-btn-sess-broken-42'));
    fireEvent.change(screen.getByTestId('clear-review-reason-input'), {
      target: { value: 'short' },
    });
    fireEvent.click(screen.getByTestId('confirm-clear-review-btn'));
    expect(adminApi.clearSessionReview).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId('clear-review-reason-input'), {
      target: { value: 'Verified payment ledger and restored escrow state manually' },
    });
    fireEvent.click(screen.getByTestId('confirm-clear-review-btn'));

    await waitFor(() => {
      expect(adminApi.clearSessionReview).toHaveBeenCalledWith(
        'sess-broken-42',
        'Verified payment ledger and restored escrow state manually',
      );
    });
  });

  it('3. ScheduledJobsPanel displays detailed storageHygiene counts and Dry-run badge in run details', async () => {
    const mockRun = {
      id: 'run-hygiene-1',
      trigger: 'manual',
      status: 'success',
      startedAt: '2026-11-11T10:00:00Z',
      finishedAt: '2026-11-11T10:00:01Z',
      durationMs: 1000,
      jobs: [
        {
          name: 'storageHygiene',
          itemsProcessed: 5,
          errors: [],
          counts: {
            dryRun: true,
            orphanUploadsRemoved: 2,
            expiredExportsRemoved: 1,
            orphanExportsRemoved: 1,
            deletedAccountCvsRemoved: 1,
            projectTombstonesRemoved: 0,
          },
        },
      ],
    };

    adminApi.getJobRuns.mockResolvedValue([mockRun]);
    adminApi.getJobRun.mockResolvedValue(mockRun);

    render(<ScheduledJobsPanel isSuperUser={true} />);

    await waitFor(() => {
      expect(screen.getByText(/run-hygiene-1/i)).toBeTruthy();
    });

    const viewButtons = screen.getAllByRole('button', { name: /view|details|inspect/i });
    fireEvent.click(viewButtons[0]);

    await waitFor(() => {
      const countsBox = screen.getByTestId('job-counts-storageHygiene');
      expect(countsBox).toBeTruthy();
      expect(countsBox.textContent).toContain('Orphan uploads removed: 2');
      expect(countsBox.textContent).toContain('Expired exports removed: 1');
      expect(countsBox.textContent).toContain('Orphan exports removed: 1');
      expect(countsBox.textContent).toContain('Deleted-account CVs removed: 1');
      expect(screen.getByTestId('job-dryrun-badge-storageHygiene')).toBeTruthy();
    });
  });
});
