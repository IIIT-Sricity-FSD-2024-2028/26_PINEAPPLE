import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Notifications from '../pages/notifications';
import { renderWithStore } from './test-utils';

const { mockAppealsApi, mockAdminApi } = vi.hoisted(() => ({
  mockAppealsApi: {
    getMyAppeals: vi.fn(),
    submitAppeal: vi.fn(),
  },
  mockAdminApi: {
    getMyWarnings: vi.fn(),
  },
}));

vi.mock('../services/appealsApi', () => ({
  default: mockAppealsApi,
  appealsApi: mockAppealsApi,
}));

vi.mock('../services/adminApi', () => ({
  default: mockAdminApi,
  adminApi: mockAdminApi,
}));

describe('Notifications - Warning Appeal Flow', () => {
  const renderNotificationsWithState = (notifications, appeals = [], warnings = []) => {
    mockAppealsApi.getMyAppeals.mockResolvedValue(appeals);
    mockAdminApi.getMyWarnings.mockResolvedValue(warnings);

    return renderWithStore(<Notifications />, {
      preloadedState: {
        notifications: {
          ids: notifications.map((n) => String(n.id)),
          entities: Object.fromEntries(notifications.map((n) => [String(n.id), n])),
          unreadCount: notifications.filter((n) => !n.isRead).length,
          status: 'succeeded',
        },
      },
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "Appeal Warning" button when warning notification is active and within 7 days', async () => {
    const notifications = [
      {
        id: 'notif-1',
        type: 'warning',
        title: 'Warning 1/4',
        message: 'Reason: Inappropriate comment in public forum.',
        createdAt: new Date().toISOString(),
        metadata: { warningId: 'warn-101' },
      },
    ];

    const warnings = [
      {
        id: 'warn-101',
        reason: 'Inappropriate comment in public forum.',
        status: 'active',
        createdAt: new Date().toISOString(),
      },
    ];

    renderNotificationsWithState(notifications, [], warnings);

    expect(await screen.findByTestId('appeal-btn-warn-101')).toBeDefined();
    expect(screen.getByText('Account Warning')).toBeDefined();
  });

  it('opens appeal modal, validates 20 to 1000 chars, and submits explanation', async () => {
    const user = userEvent.setup();
    mockAppealsApi.submitAppeal.mockResolvedValue({ id: 'app-1', status: 'pending' });

    const notifications = [
      {
        id: 'notif-1',
        type: 'warning',
        title: 'Warning 1/4',
        message: 'Reason: Unassigned task left idle.',
        createdAt: new Date().toISOString(),
        metadata: { warningId: 'warn-102' },
      },
    ];

    renderNotificationsWithState(notifications, [], [
      { id: 'warn-102', reason: 'Unassigned task left idle.', status: 'active', createdAt: new Date().toISOString() },
    ]);

    const appealBtn = await screen.findByTestId('appeal-btn-warn-102');
    fireEvent.click(appealBtn);

    // Modal should open
    expect(screen.getByText('Appeal Account Warning')).toBeDefined();
    const explanationInput = screen.getByTestId('appeal-explanation-input');
    const submitBtn = screen.getByTestId('submit-appeal-btn');

    expect(submitBtn.disabled).toBe(true);

    // Under 20 characters
    await user.type(explanationInput, 'Too short reason');
    expect(submitBtn.disabled).toBe(true);

    // Enter valid >= 20 characters
    await user.type(explanationInput, ' - additional context to surpass twenty characters.');
    expect(submitBtn.disabled).toBe(false);

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockAppealsApi.submitAppeal).toHaveBeenCalledWith('warn-102', {
        explanation: expect.stringMatching(/additional context/),
      });
    });
  });

  it('renders appeal status: pending, accepted, or rejected with admin note', async () => {
    const notifications = [
      {
        id: 'notif-pending',
        type: 'warning',
        title: 'Warning 1/4',
        message: 'Reason: Spamming task board.',
        createdAt: new Date().toISOString(),
        metadata: { warningId: 'warn-pending' },
      },
      {
        id: 'notif-accepted',
        type: 'warning',
        title: 'Warning 2/4',
        message: 'Reason: False milestone claim.',
        createdAt: new Date().toISOString(),
        metadata: { warningId: 'warn-accepted' },
      },
    ];

    const appeals = [
      {
        id: 'app-pending',
        warningId: 'warn-pending',
        status: 'pending',
      },
      {
        id: 'app-accepted',
        warningId: 'warn-accepted',
        status: 'accepted',
        adminNote: 'Proof verified by mentor. Warning revoked.',
      },
    ];

    renderNotificationsWithState(notifications, appeals, []);

    expect(await screen.findByTestId('appeal-status-pending')).toBeDefined();
    expect(screen.getByTestId('appeal-status-accepted')).toBeDefined();
    expect(screen.getByText(/Proof verified by mentor\. Warning revoked\./i)).toBeDefined();
  });

  it('shows expired message and hides appeal button when warning is older than 7 days', async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();

    const notifications = [
      {
        id: 'notif-old',
        type: 'warning',
        title: 'Warning 1/4',
        message: 'Reason: Old policy breach.',
        createdAt: eightDaysAgo,
        metadata: { warningId: 'warn-old' },
      },
    ];

    const warnings = [
      {
        id: 'warn-old',
        reason: 'Old policy breach.',
        status: 'active',
        createdAt: eightDaysAgo,
      },
    ];

    renderNotificationsWithState(notifications, [], warnings);

    expect(await screen.findByText(/Appeal window closed/i)).toBeDefined();
    expect(screen.queryByTestId('appeal-btn-warn-old')).toBeNull();
  });
});
