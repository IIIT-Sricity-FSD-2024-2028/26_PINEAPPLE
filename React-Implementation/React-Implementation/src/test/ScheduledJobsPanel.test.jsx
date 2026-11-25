import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ScheduledJobsPanel from '../pages/admin/ScheduledJobsPanel';
import adminApi from '../services/adminApi';

vi.mock('../services/adminApi', () => ({
  default: {
    getJobRuns: vi.fn(),
    triggerJobTick: vi.fn(),
  },
}));

describe('ScheduledJobsPanel - Phase 7 Frontend Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Empty state: renders empty state when no runs have happened yet', async () => {
    adminApi.getJobRuns.mockResolvedValueOnce([]);

    render(<ScheduledJobsPanel isSuperUser={true} />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeDefined();
    });

    expect(screen.getByText('No scheduled jobs have run yet')).toBeDefined();
    expect(screen.queryByTestId('runs-table')).toBeNull();
  });

  it('2. Panel renders runs and detail drawer with per-job metrics', async () => {
    const mockRuns = [
      {
        id: 'run-101',
        trigger: 'manual',
        startedAt: '2026-11-11T10:00:00.000Z',
        finishedAt: '2026-11-11T10:00:00.045Z',
        durationMs: 45,
        status: 'success',
        jobs: [
          { name: 'closeEmptyProjects', itemsProcessed: 2, errors: [] },
          { name: 'expireMentorRequests', itemsProcessed: 1, errors: [] },
          { name: 'applyDeadlinePenalties', itemsProcessed: 0, errors: [] },
        ],
      },
    ];

    adminApi.getJobRuns.mockResolvedValueOnce(mockRuns);

    render(<ScheduledJobsPanel isSuperUser={true} />);

    await waitFor(() => {
      expect(screen.getByTestId('runs-table')).toBeDefined();
    });

    expect(screen.getByText('run-101')).toBeDefined();
    expect(screen.getByText('manual')).toBeDefined();
    expect(screen.getByText('45ms')).toBeDefined();

    // Open detail drawer
    const viewBtn = screen.getByTestId('view-run-run-101');
    fireEvent.click(viewBtn);

    expect(screen.getByTestId('run-detail-drawer')).toBeDefined();
    expect(screen.getByText('Run Details: run-101')).toBeDefined();
    expect(screen.getByText('closeEmptyProjects')).toBeDefined();
    expect(screen.getByText('2 processed')).toBeDefined();
    expect(screen.getByText('expireMentorRequests')).toBeDefined();
    expect(screen.getByText('1 processed')).toBeDefined();
  });

  it('3. Admin view has NO "Run now" button (read-only)', async () => {
    adminApi.getJobRuns.mockResolvedValueOnce([]);

    render(<ScheduledJobsPanel isSuperUser={false} />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeDefined();
    });

    expect(screen.queryByTestId('run-now-btn')).toBeNull();
  });

  it('4. Super User view has "Run now" button and is disabled while running', async () => {
    const runningRuns = [
      {
        id: 'run-active',
        trigger: 'cron',
        startedAt: '2026-11-11T10:05:00.000Z',
        finishedAt: null,
        durationMs: null,
        status: 'running',
        jobs: [],
      },
    ];

    adminApi.getJobRuns.mockResolvedValueOnce(runningRuns);

    render(<ScheduledJobsPanel isSuperUser={true} />);

    await waitFor(() => {
      expect(screen.getByTestId('run-now-btn')).toBeDefined();
    });

    const runBtn = screen.getByTestId('run-now-btn');
    expect(runBtn.disabled).toBe(true);
    expect(runBtn.textContent).toContain('Running...');
  });

  it('5. Confirm dialog triggers tick and displays 409 conflict message if tick is already in progress', async () => {
    adminApi.getJobRuns.mockResolvedValueOnce([]);
    adminApi.triggerJobTick.mockRejectedValueOnce({
      statusCode: 409,
      code: 'JOB_ALREADY_RUNNING',
      serverMessage: 'A job tick is already in progress.',
    });

    render(<ScheduledJobsPanel isSuperUser={true} />);

    await waitFor(() => {
      expect(screen.getByTestId('run-now-btn')).toBeDefined();
    });

    // Click Run Now
    fireEvent.click(screen.getByTestId('run-now-btn'));

    // Confirm modal should appear
    expect(screen.getByTestId('confirm-tick-modal')).toBeDefined();

    // Click Confirm & Run
    fireEvent.click(screen.getByTestId('confirm-run-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('job-error-banner')).toBeDefined();
    });

    expect(screen.getByTestId('job-error-banner').textContent).toContain('A job tick is already in progress.');
  });
});
