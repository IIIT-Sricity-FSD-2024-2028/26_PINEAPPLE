import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import AdminUserDetails from '../pages/admin/AdminUserDetails';
import { renderWithProviders } from './test-utils';
import adminApi from '../services/adminApi';

vi.mock('../services/adminApi', () => ({
  default: {
    getUserDetails: vi.fn(),
    warnUser: vi.fn(),
    suspendUser: vi.fn(),
    reactivateUser: vi.fn(),
    flagUser: vi.fn(),
    updateUserStatus: vi.fn(),
  },
}));

vi.mock('../services/mentorshipApi', () => ({
  default: {
    getBadges: vi.fn().mockResolvedValue([]),
  },
}));

const mockUser = {
  id: '2',
  name: 'Arjun Sharma',
  email: 'arjun.sharma@teamforge.io',
  username: 'arjunsharma',
  university: 'IIT Delhi',
  role: 'Collaborator',
  status: 'Warned',
  rep: 80,
  xp: 350,
  activeWarningsCount: 2,
  warnings: [
    {
      reason: 'Disruptive behavior in comments',
      issuedAt: '2026-11-08T10:00:00.000Z',
      issuedBy: 'Admin',
      active: true,
    },
    {
      reason: 'Unacceptable language during standup',
      issuedAt: '2026-11-09T14:30:00.000Z',
      issuedBy: 'Admin',
      active: true,
    },
  ],
  projects: [],
  contributions: [],
  mentorRecommendations: [],
  recentActivity: [],
};

const renderComponent = () => {
  return renderWithProviders(
    <Routes>
      <Route path="/admin/users/:id" element={<AdminUserDetails />} />
    </Routes>,
    { route: '/admin/users/2' }
  );
};

describe('AdminUserDetails - Phase 1 Moderation Core', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminApi.getUserDetails.mockResolvedValue(mockUser);
  });

  it('renders user details, reputation, and displays active warnings as N/4', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Arjun Sharma')).toBeDefined();
    });

    // Check N/4 warnings badge in hero and StatCard
    expect(screen.getByText('2/4 Warnings')).toBeDefined();
    expect(screen.getByText('2/4')).toBeDefined();
    expect(screen.getByText('80 Rep')).toBeDefined();

    // Check warning history list
    expect(screen.getByText(/Warning History \(2\)/)).toBeDefined();
    expect(screen.getByText(/Disruptive behavior in comments/)).toBeDefined();
    expect(screen.getByText(/Unacceptable language during standup/)).toBeDefined();
  });

  it('validates written explanation (>= 10 chars) for warning action', async () => {
    const user = userEvent.setup();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Issue Warning')).toBeDefined();
    });

    // Click "Issue Warning" to open modal
    await user.click(screen.getByText('Issue Warning'));

    const textarea = screen.getByPlaceholderText(/Enter written explanation/);
    expect(textarea).toBeDefined();

    const confirmBtn = screen.getByRole('button', { name: 'Confirm Warning' });
    expect(confirmBtn.hasAttribute('disabled')).toBe(true);

    // Type short explanation (< 10 chars)
    await user.type(textarea, 'bad msg');
    expect(confirmBtn.hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(/Explanation must be at least 10 characters \(7\/10\)/)).toBeDefined();

    // Type sufficient explanation (>= 10 chars)
    await user.type(textarea, ' repeated violations');
    expect(confirmBtn.hasAttribute('disabled')).toBe(false);

    // Submit warning
    adminApi.warnUser.mockResolvedValue({ success: true });
    await user.click(confirmBtn);

    expect(adminApi.warnUser).toHaveBeenCalledWith('2', {
      reason: 'bad msg repeated violations',
    });
  });

  it('handles suspend action with >= 10 chars explanation and switches button to reactivate', async () => {
    const user = userEvent.setup();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Suspend User')).toBeDefined();
    });

    // Click "Suspend User"
    await user.click(screen.getByText('Suspend User'));

    const textarea = screen.getByPlaceholderText(/Enter written explanation/);
    const confirmBtn = screen.getByRole('button', { name: 'Confirm Suspension' });
    expect(confirmBtn.hasAttribute('disabled')).toBe(true);

    await user.type(textarea, 'Suspended due to repeated policy breaches');
    expect(confirmBtn.hasAttribute('disabled')).toBe(false);

    adminApi.suspendUser.mockResolvedValue({ success: true });
    adminApi.getUserDetails.mockResolvedValue({
      ...mockUser,
      status: 'Suspended',
    });

    await user.click(confirmBtn);

    expect(adminApi.suspendUser).toHaveBeenCalledWith('2', {
      reason: 'Suspended due to repeated policy breaches',
    });

    // Verify UI updates to show Reactivate User
    await waitFor(() => {
      expect(screen.getByText('Reactivate User')).toBeDefined();
    });
  });

  it('handles reactivate action with >= 10 chars explanation and resets active warnings', async () => {
    adminApi.getUserDetails.mockResolvedValue({
      ...mockUser,
      status: 'Suspended',
    });

    const user = userEvent.setup();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Reactivate User')).toBeDefined();
    });

    await user.click(screen.getByText('Reactivate User'));

    const textarea = screen.getByPlaceholderText(/Enter written explanation/);
    const confirmBtn = screen.getByRole('button', { name: 'Confirm Reactivation' });
    expect(confirmBtn.hasAttribute('disabled')).toBe(true);

    await user.type(textarea, 'Reactivation approved after review of conduct');
    expect(confirmBtn.hasAttribute('disabled')).toBe(false);

    adminApi.reactivateUser.mockResolvedValue({ success: true });
    adminApi.getUserDetails.mockResolvedValue({
      ...mockUser,
      status: 'Active',
      activeWarningsCount: 0,
    });

    await user.click(confirmBtn);

    expect(adminApi.reactivateUser).toHaveBeenCalledWith('2', {
      reason: 'Reactivation approved after review of conduct',
    });

    await waitFor(() => {
      expect(screen.getByText('Suspend User')).toBeDefined();
    });
  });
});
