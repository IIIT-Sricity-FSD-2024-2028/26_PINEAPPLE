import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminReports from '../pages/admin/AdminReports';
import { renderWithProviders } from './test-utils';

const { mockReportsApi, mockAppealsApi } = vi.hoisted(() => ({
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
}));

vi.mock('../services/reportsApi', () => ({
  default: mockReportsApi,
  reportsApi: mockReportsApi,
}));

vi.mock('../services/appealsApi', () => ({
  default: mockAppealsApi,
  appealsApi: mockAppealsApi,
}));

describe('AdminReports - Reports and Appeals Management', () => {
  const mockReportsList = [
    {
      id: 'rep-1',
      reportedUserId: 'user-bad-1',
      reportedUserName: 'Malicious User',
      reportedUserUsername: 'baduser',
      reporterId: 'user-reporter-1',
      reporterName: 'Good Collaborator',
      reporterUsername: 'goodcollab',
      reason: 'Harassment',
      status: 'Open',
      createdAt: new Date().toISOString(),
    },
  ];

  const mockReportDetail = {
    id: 'rep-1',
    reportedUserId: 'user-bad-1',
    reportedUserName: 'Malicious User',
    reportedUserUsername: 'baduser',
    reportedUserUniversity: 'MIT',
    reporterId: 'user-reporter-1',
    reporterName: 'Good Collaborator',
    reporterUsername: 'goodcollab',
    reason: 'Harassment',
    details: 'Repeated offensive remarks in group discussion chat channels.',
    status: 'Open',
    priorWarnings: [{ id: 'w-1', reason: 'Earlier warning', status: 'active' }],
    priorReports: [],
    createdAt: new Date().toISOString(),
  };

  const mockAppealsList = [
    {
      id: 'appeal-1',
      userId: 'user-app-1',
      userName: 'Appealing User',
      userUsername: 'appuser',
      warningId: 'w-10',
      warningReason: 'Missed deadline',
      warningCreatedAt: new Date().toISOString(),
      explanation: 'Hospital emergency caused sudden unexpected absence for 48 hours.',
      status: 'pending',
      createdAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockReportsApi.getAdminReports.mockResolvedValue(mockReportsList);
    mockReportsApi.getReportDetails.mockResolvedValue(mockReportDetail);
    mockReportsApi.getAdminReportById.mockResolvedValue(mockReportDetail);
    mockAppealsApi.getAdminAppeals.mockResolvedValue(mockAppealsList);
  });

  it('blocks access when admin lacks "reports" permission', () => {
    sessionStorage.setItem('teamforge.portalRole', 'Admin');
    sessionStorage.setItem('teamforge.isSuperUser', 'false');
    sessionStorage.setItem('teamforge.adminPermissions', JSON.stringify(['users', 'audit']));

    renderWithProviders(<AdminReports />);

    expect(screen.getByText('Access Denied')).toBeDefined();
    expect(screen.getByText(/You do not have the required "reports" permission/i)).toBeDefined();
  });

  it('allows access and renders reports table when permission is present', async () => {
    sessionStorage.setItem('teamforge.portalRole', 'Admin');
    sessionStorage.setItem('teamforge.adminPermissions', JSON.stringify(['reports', 'users']));

    renderWithProviders(<AdminReports />);

    expect(screen.getByText('Reports & Appeals')).toBeDefined();
    expect(screen.getByTestId('tab-user-reports')).toBeDefined();
    expect(screen.getByTestId('tab-appeals')).toBeDefined();

    expect(await screen.findByText('Malicious User')).toBeDefined();
    expect(screen.getByText('@baduser')).toBeDefined();
    expect(screen.getByText('Harassment')).toBeDefined();
  });

  it('opens report details modal and provides a direct "View audit log" link to reported user', async () => {
    sessionStorage.setItem('teamforge.portalRole', 'SuperUser');
    sessionStorage.setItem('teamforge.isSuperUser', 'true');

    renderWithProviders(<AdminReports />);

    const reviewBtn = await screen.findByTestId('review-report-rep-1');
    fireEvent.click(reviewBtn);

    // Wait for report details to load
    await waitFor(() => {
      expect(mockReportsApi.getReportDetails).toHaveBeenCalledWith('rep-1');
    });

    expect(await screen.findByText(/Repeated offensive remarks/i)).toBeDefined();

    // Verify "View audit log" link exists and points to `/admin/audit-log?userId=${reportedUserId}&reportId=rep-1&from=report`
    const auditLink = screen.getByTestId('link-view-audit');
    expect(auditLink).toBeDefined();
    expect(auditLink.getAttribute('href')).toContain('/admin/audit-log?userId=user-bad-1&reportId=rep-1&from=report');
  });

  it('executes Dismiss Report action with written reason (10 to 500 chars)', async () => {
    const user = userEvent.setup();
    mockReportsApi.actionReport.mockResolvedValue({ id: 'rep-1', status: 'Dismissed' });

    sessionStorage.setItem('teamforge.portalRole', 'SuperUser');
    sessionStorage.setItem('teamforge.isSuperUser', 'true');

    renderWithProviders(<AdminReports />);

    const reviewBtn = await screen.findByTestId('review-report-rep-1');
    fireEvent.click(reviewBtn);

    const dismissActionBtn = await screen.findByTestId('action-dismiss-btn');
    fireEvent.click(dismissActionBtn);

    // Dismiss modal should open
    expect(screen.getAllByText('Dismiss Report').length).toBeGreaterThanOrEqual(2);
    const reasonInput = screen.getByTestId('dismiss-reason-input');
    const confirmBtn = screen.getByTestId('confirm-dismiss-btn');

    expect(confirmBtn.disabled).toBe(true);

    // Type < 10 chars
    await user.type(reasonInput, 'Short');
    expect(confirmBtn.disabled).toBe(true);

    // Type >= 10 chars
    const dismissText = 'Evidence does not substantiate policy violation after review.';
    await user.type(reasonInput, dismissText);
    expect(confirmBtn.disabled).toBe(false);

    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockReportsApi.actionReport).toHaveBeenCalledWith('rep-1', {
        action: 'dismiss',
        reason: expect.stringMatching(/Evidence does not substantiate/),
      });
    });
  });

  it('switches to Appeals tab, opens decision modal, and accepts appeal with 10+ character note', async () => {
    const user = userEvent.setup();
    mockAppealsApi.decideAppeal.mockResolvedValue({ id: 'appeal-1', status: 'accepted' });

    sessionStorage.setItem('teamforge.portalRole', 'SuperUser');
    sessionStorage.setItem('teamforge.isSuperUser', 'true');

    renderWithProviders(<AdminReports />);

    const appealsTab = screen.getByTestId('tab-appeals');
    fireEvent.click(appealsTab);

    await waitFor(() => {
      expect(mockAppealsApi.getAdminAppeals).toHaveBeenCalled();
    });

    expect(await screen.findByText('Appealing User')).toBeDefined();
    expect(screen.getByText('Missed deadline')).toBeDefined();

    const decideBtn = screen.getByTestId('review-appeal-appeal-1');
    fireEvent.click(decideBtn);

    // Decision modal opens
    expect(screen.getByText(/Review Appeal: Appealing User/i)).toBeDefined();
    const noteInput = screen.getByTestId('appeal-decision-note-input');
    const submitDecisionBtn = screen.getByTestId('submit-appeal-decision-btn');

    expect(submitDecisionBtn.disabled).toBe(true);

    // Type valid note (>= 10 chars)
    await user.type(noteInput, 'Medical documentation verified with student affairs.');
    expect(submitDecisionBtn.disabled).toBe(false);

    fireEvent.click(submitDecisionBtn);

    await waitFor(() => {
      expect(mockAppealsApi.decideAppeal).toHaveBeenCalledWith('appeal-1', {
        decision: 'accept',
        note: 'Medical documentation verified with student affairs.',
      });
    });
  });
});
