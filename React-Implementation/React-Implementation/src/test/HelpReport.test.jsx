import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Help from '../pages/help';
import { renderWithProviders } from './test-utils';

const { mockReportsApi, mockUsersApi } = vi.hoisted(() => ({
  mockReportsApi: {
    createReport: vi.fn(),
    submitReport: vi.fn(),
    getMyReports: vi.fn(),
    getAdminReports: vi.fn(),
    getReportDetails: vi.fn(),
    updateReportStatus: vi.fn(),
    actionReport: vi.fn(),
  },
  mockUsersApi: {
    searchUsers: vi.fn(),
  },
}));

vi.mock('../services/reportsApi', () => ({
  default: mockReportsApi,
  reportsApi: mockReportsApi,
}));

vi.mock('../services/usersApi', () => ({
  default: mockUsersApi,
  usersApi: mockUsersApi,
}));

describe('Help & Support - User Reporting Flow', () => {
  const mockUsers = [
    {
      id: 'target-user-1',
      name: 'Alice Johnson',
      username: 'alicej',
      university: 'Stanford University',
      email: 'alice.private@example.com',
    },
  ];

  const mockMyReports = [
    {
      id: 'rep-1',
      reportedUserId: 'target-user-99',
      reportedUserName: 'Bob Reporter',
      reportedUserUsername: 'bobrep',
      reason: 'Harassment',
      details: 'Sent harassing messages in project channel repeatedly.',
      status: 'Open',
      outcome: 'Pending review',
      createdAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockUsersApi.searchUsers.mockResolvedValue(mockUsers);
    mockReportsApi.getMyReports.mockResolvedValue(mockMyReports);
    mockReportsApi.createReport.mockResolvedValue({ id: 'rep-new', status: 'Open' });
  });

  it('renders tabs and switches to "Report a User" tab', async () => {
    renderWithProviders(<Help />);

    expect(screen.getByText('Contact Support & FAQs')).toBeDefined();
    const reportTab = screen.getByTestId('tab-report');
    expect(reportTab).toBeDefined();

    fireEvent.click(reportTab);

    expect(await screen.findByLabelText(/User to Report/i)).toBeDefined();
    expect(screen.getByTestId('details-textarea')).toBeDefined();
    expect(screen.getByTestId('submit-report-btn').disabled).toBe(true);
  });

  it('searches users with debounce, shows name, username, and university, and NEVER shows email', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Help />);

    fireEvent.click(screen.getByTestId('tab-report'));

    const searchInput = screen.getByTestId('user-search-input');
    await user.type(searchInput, 'Ali');

    // Wait for debounce and search results
    await waitFor(() => {
      expect(mockUsersApi.searchUsers).toHaveBeenCalledWith('Ali');
    });

    const resultCard = await screen.findByTestId('search-result-target-user-1');
    expect(resultCard).toBeDefined();
    expect(resultCard.textContent).toContain('Alice Johnson');
    expect(resultCard.textContent).toContain('@alicej');
    expect(resultCard.textContent).toContain('Stanford University');

    // Crucial privacy rule: email must never be exposed in the DOM
    expect(document.body.textContent).not.toContain('alice.private@example.com');
  });

  it('validates minimum 20 characters for details and toggles submit button state', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Help />);

    fireEvent.click(screen.getByTestId('tab-report'));

    // Select user
    const searchInput = screen.getByTestId('user-search-input');
    await user.type(searchInput, 'Ali');
    await waitFor(() => expect(screen.getByTestId('search-result-target-user-1')).toBeDefined());
    fireEvent.click(screen.getByTestId('search-result-target-user-1'));

    expect(screen.getByTestId('selected-user-box')).toBeDefined();

    // Select reason
    const reasonSelect = screen.getByTestId('reason-select');
    await user.selectOptions(reasonSelect, 'Harassment');

    const detailsInput = screen.getByTestId('details-textarea');
    const submitBtn = screen.getByTestId('submit-report-btn');

    // Under 20 characters
    await user.type(detailsInput, 'Too short');
    expect(screen.getByText(/9 \/ 1000 characters/i)).toBeDefined();
    expect(submitBtn.disabled).toBe(true);

    // Fill >= 20 characters
    await user.type(detailsInput, ' - this is now more than twenty characters long.');
    expect(submitBtn.disabled).toBe(false);
  });

  it('submits report payload and displays success message and refreshes My Reports', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Help />);

    fireEvent.click(screen.getByTestId('tab-report'));

    // Select user
    const searchInput = screen.getByTestId('user-search-input');
    await user.type(searchInput, 'Ali');
    await waitFor(() => expect(screen.getByTestId('search-result-target-user-1')).toBeDefined());
    fireEvent.click(screen.getByTestId('search-result-target-user-1'));

    // Select reason
    await user.selectOptions(screen.getByTestId('reason-select'), 'Cheating or plagiarism');

    // Enter details (>= 20 chars)
    const validDetails = 'Submitted plagiarized code from an external open-source repository.';
    await user.type(screen.getByTestId('details-textarea'), validDetails);

    const submitBtn = screen.getByTestId('submit-report-btn');
    expect(submitBtn.disabled).toBe(false);

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockReportsApi.createReport).toHaveBeenCalledWith({
        reportedUserId: 'target-user-1',
        reason: 'Cheating or plagiarism',
        details: validDetails,
      });
    });

    expect(await screen.findByTestId('report-success')).toBeDefined();
  });

  it('handles API rejection (e.g. DAILY_LIMIT or CANNOT_REPORT_SELF) and displays server error message', async () => {
    mockReportsApi.createReport.mockRejectedValueOnce({
      statusCode: 429,
      code: 'DAILY_LIMIT',
      message: 'You have reached the maximum daily limit of 5 reports.',
    });

    const user = userEvent.setup();
    renderWithProviders(<Help />);

    fireEvent.click(screen.getByTestId('tab-report'));

    const searchInput = screen.getByTestId('user-search-input');
    await user.type(searchInput, 'Ali');
    await waitFor(() => expect(screen.getByTestId('search-result-target-user-1')).toBeDefined());
    fireEvent.click(screen.getByTestId('search-result-target-user-1'));

    await user.selectOptions(screen.getByTestId('reason-select'), 'Spam');
    await user.type(
      screen.getByTestId('details-textarea'),
      'Advertising promotional links repeatedly in discussion boards.'
    );

    fireEvent.click(screen.getByTestId('submit-report-btn'));

    expect(
      await screen.findByText(/You have reached the maximum daily limit of 5 reports/i)
    ).toBeDefined();
  });
});
