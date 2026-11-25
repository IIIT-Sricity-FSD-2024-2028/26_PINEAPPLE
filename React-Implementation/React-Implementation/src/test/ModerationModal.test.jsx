import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ModerationModal from '../components/common/ModerationModal';
import { renderWithProviders } from './test-utils';
import { adminApi } from '../services/adminApi';

vi.mock('../services/adminApi', () => ({
  adminApi: {
    warnUser: vi.fn(),
    suspendUser: vi.fn(),
    reactivateUser: vi.fn(),
  },
}));

describe('ModerationModal Component Tests', () => {
  const mockUser = {
    id: '2',
    name: 'Arjun Sharma',
    username: 'arjunsharma',
    email: 'arjun.sharma@teamforge.io',
    activeWarningsCount: 1,
  };

  const defaultProps = {
    isOpen: true,
    actionType: 'warn',
    targetUser: mockUser,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with target user info and title for warning action', () => {
    renderWithProviders(<ModerationModal {...defaultProps} />);

    expect(screen.getByText(/Issue Warning to Arjun Sharma/i)).toBeDefined();
    expect(screen.getAllByText(/Arjun Sharma/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/1\/4/i)).toBeDefined();
    expect(screen.getByPlaceholderText(/Explain the reason for this action/i)).toBeDefined();
  });

  it('live character counter updates and disables submit button when under 10 characters', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ModerationModal {...defaultProps} />);

    const submitBtn = screen.getByRole('button', { name: /Confirm Warning/i });
    expect(submitBtn.hasAttribute('disabled')).toBe(true);

    const input = screen.getByPlaceholderText(/Explain the reason for this action/i);
    await user.type(input, 'Short'); // 5 chars

    expect(screen.getByText(/5\/500 characters/i)).toBeDefined();
    expect(screen.getByText(/min 10 characters required/i)).toBeDefined();
    expect(submitBtn.hasAttribute('disabled')).toBe(true);

    await user.type(input, ' explanation'); // 17 chars
    expect(screen.getByText(/17\/500 characters/i)).toBeDefined();
    expect(submitBtn.hasAttribute('disabled')).toBe(false);
  });

  it('submits valid warning, invokes adminApi.warnUser, and displays success result feedback', async () => {
    adminApi.warnUser.mockResolvedValueOnce({
      warning: { id: 'w-1', status: 'active' },
      activeCount: 2,
      autoSuspended: false,
    });

    const user = userEvent.setup();
    renderWithProviders(<ModerationModal {...defaultProps} />);

    const input = screen.getByPlaceholderText(/Explain the reason for this action/i);
    await user.type(input, 'Valid reason for issuing an official warning');

    const submitBtn = screen.getByRole('button', { name: /Confirm Warning/i });
    expect(submitBtn.hasAttribute('disabled')).toBe(false);
    await user.click(submitBtn);

    await waitFor(() => {
      expect(adminApi.warnUser).toHaveBeenCalledWith('2', {
        reason: 'Valid reason for issuing an official warning',
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/Warning 2\/4 sent/i)).toBeDefined();
    });
  });

  it('shows server error message when API call fails', async () => {
    adminApi.warnUser.mockRejectedValueOnce({
      response: {
        data: {
          code: 'CANNOT_MODERATE_SELF',
          message: 'You cannot moderate your own account.',
        },
      },
    });

    const user = userEvent.setup();
    renderWithProviders(<ModerationModal {...defaultProps} />);

    const input = screen.getByPlaceholderText(/Explain the reason for this action/i);
    await user.type(input, 'Trying to warn own account');

    const submitBtn = screen.getByRole('button', { name: /Confirm Warning/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/You cannot moderate your own account/i)).toBeDefined();
    });
  });

  it('renders suspension action style and calls suspendUser', async () => {
    adminApi.suspendUser.mockResolvedValueOnce({
      status: 'suspended',
    });

    const user = userEvent.setup();
    renderWithProviders(<ModerationModal {...defaultProps} actionType="suspend" />);

    expect(screen.getByText(/Suspend Account: Arjun Sharma/i)).toBeDefined();
    const submitBtn = screen.getByRole('button', { name: /Suspend User/i });

    const input = screen.getByPlaceholderText(/Explain the reason for this action/i);
    await user.type(input, 'Suspension due to repeated violations');
    await user.click(submitBtn);

    await waitFor(() => {
      expect(adminApi.suspendUser).toHaveBeenCalledWith('2', {
        reason: 'Suspension due to repeated violations',
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/User suspended successfully/i)).toBeDefined();
    });
  });
});
