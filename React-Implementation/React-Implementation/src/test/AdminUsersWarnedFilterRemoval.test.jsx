import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminUsers from '../pages/admin/AdminUsers';
import adminApi from '../services/adminApi';
import trustApi from '../services/trustApi';
import storage from '../utils/storage';

vi.mock('../services/adminApi', () => ({
  default: {
    listUsers: vi.fn(),
    getDuplicateUsers: vi.fn(),
    getModerationActions: vi.fn(),
    warnUser: vi.fn(),
    suspendUser: vi.fn(),
    reactivateUser: vi.fn(),
    flagUser: vi.fn(),
    updateUserStatus: vi.fn(),
  },
}));

vi.mock('../services/trustApi', () => ({
  default: {
    getTrustSummaries: vi.fn().mockResolvedValue([]),
    getTrustSummary: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('../utils/storage', () => ({
  default: {
    getAdminSession: vi.fn(() => ({ uid: 'admin-super', role: 'admin', isSuperUser: true })),
    getRole: vi.fn(() => 'admin'),
    getPortalRole: vi.fn(() => 'admin'),
  },
}));

const mockUsers = [
  { id: '1', name: 'Alice Active', role: 'Collaborator', status: 'Active', warnings: 0, flags: false, xp: 100, rep: 50 },
  { id: '2', name: 'Bob Warned', role: 'Collaborator', status: 'Warned', warnings: 2, flags: false, xp: 200, rep: 40 },
  { id: '3', name: 'Charlie Suspended', role: 'Collaborator', status: 'Suspended', warnings: 4, flags: false, xp: 0, rep: 10 },
  { id: '4', name: 'David Flagged', role: 'Collaborator', status: 'Flagged', flags: true, warnings: 0, xp: 50, rep: 20 },
];

describe('AdminUsers: Warned Filter Chip Removal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminApi.listUsers.mockResolvedValue([...mockUsers]);
    adminApi.getDuplicateUsers.mockResolvedValue({ groups: [{ id: 'dup-1', users: ['1', '2'] }] });
    adminApi.getModerationActions.mockResolvedValue([
      { id: 'act-1', targetUserId: '3', actionType: 'suspend', status: 'pending', requestedBy: 'other-admin' },
    ]);
  });

  it('renders exactly the 6 filter tabs: All, Active, Suspended, Flagged, Possible duplicates, Approvals (no Warned chip)', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/users']}>
        <AdminUsers />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Alice Active')).toBeTruthy();
    });

    const tabs = screen.getAllByRole('tab');
    const tabTexts = tabs.map((t) => t.textContent);

    // Verify exactly 6 tabs are rendered
    expect(tabs).toHaveLength(6);

    // Verify each expected tab exists with correct counts
    expect(tabTexts.some((t) => t.includes('All (4)'))).toBe(true);
    expect(tabTexts.some((t) => t.includes('Active (1)'))).toBe(true);
    expect(tabTexts.some((t) => t.includes('Suspended (1)'))).toBe(true);
    expect(tabTexts.some((t) => t.includes('Flagged (1)'))).toBe(true);
    expect(tabTexts.some((t) => t.includes('Possible duplicates (1)'))).toBe(true);
    expect(tabTexts.some((t) => t.includes('Approvals (1)'))).toBe(true);

    // Crucial: The text "Warned" does NOT appear as a filter tab
    expect(tabTexts.some((t) => t.toLowerCase().startsWith('warned'))).toBe(false);
  });

  it('filters correctly using remaining chips and counts remain unchanged', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/users']}>
        <AdminUsers />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Alice Active')).toBeTruthy();
      expect(screen.getByText('Bob Warned')).toBeTruthy();
      expect(screen.getByText('Charlie Suspended')).toBeTruthy();
      expect(screen.getByText('David Flagged')).toBeTruthy();
    });

    // Click Active filter -> only Alice Active
    const activeTab = screen.getByRole('tab', { name: /Active \(1\)/i });
    fireEvent.click(activeTab);

    expect(screen.getByText('Alice Active')).toBeTruthy();
    expect(screen.queryByText('Bob Warned')).toBeNull();
    expect(screen.queryByText('Charlie Suspended')).toBeNull();
    expect(screen.queryByText('David Flagged')).toBeNull();

    // Click Suspended filter -> only Charlie Suspended
    const suspendedTab = screen.getByRole('tab', { name: /Suspended \(1\)/i });
    fireEvent.click(suspendedTab);

    expect(screen.queryByText('Alice Active')).toBeNull();
    expect(screen.getByText('Charlie Suspended')).toBeTruthy();

    // Click Flagged filter -> only David Flagged
    const flaggedTab = screen.getByRole('tab', { name: /Flagged \(1\)/i });
    fireEvent.click(flaggedTab);

    expect(screen.queryByText('Alice Active')).toBeNull();
    expect(screen.getByText('David Flagged')).toBeTruthy();
  });

  it('opening the page with ?filter=warned falls back to All without showing empty list', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/users?filter=warned']}>
        <AdminUsers />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Alice Active')).toBeTruthy();
    });

    // All tab should be active
    const allTab = screen.getByRole('tab', { name: /All \(4\)/i });
    expect(allTab.getAttribute('aria-selected')).toBe('true');

    // All 4 users are displayed
    expect(screen.getByText('Alice Active')).toBeTruthy();
    expect(screen.getByText('Bob Warned')).toBeTruthy();
    expect(screen.getByText('Charlie Suspended')).toBeTruthy();
    expect(screen.getByText('David Flagged')).toBeTruthy();
  });

  it('switching tabs updates searchParams and removes filter query param when All is selected', async () => {
    let testLocation;
    const LocationWatcher = () => {
      const { useLocation } = require('react-router-dom');
      testLocation = useLocation();
      return null;
    };

    render(
      <MemoryRouter initialEntries={['/admin/users?filter=warned']}>
        <AdminUsers />
        <LocationWatcher />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Alice Active')).toBeTruthy();
    });

    // Switch to Suspended tab
    const suspendedTab = screen.getByRole('tab', { name: /Suspended \(1\)/i });
    fireEvent.click(suspendedTab);

    expect(testLocation.search).toContain('filter=suspended');

    // Switch back to All tab
    const allTab = screen.getByRole('tab', { name: /All \(4\)/i });
    fireEvent.click(allTab);

    expect(testLocation.search).not.toContain('filter=');
  });

  it('row displays Warned badge and Warn user action continues to work', async () => {
    adminApi.warnUser.mockResolvedValueOnce({ id: 'w-1', status: 'Warned' });

    render(
      <MemoryRouter initialEntries={['/admin/users']}>
        <AdminUsers />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Bob Warned')).toBeTruthy();
    });

    // The user row displays the Warned badge (2/4)
    expect(screen.getByText(/Warned \(2\/4\)/i)).toBeTruthy();

    // Open dropdown menu for Alice Active
    const openMenuBtn = screen.getByLabelText(/Open actions for Alice Active/i);
    fireEvent.click(openMenuBtn);

    // Click Warn user for Alice Active
    const warnButtons = screen.getAllByText('Warn user');
    fireEvent.click(warnButtons[0]);

    // Modal opens
    expect(screen.getByText(/Issue Warning to Alice Active/i)).toBeTruthy();

    // Confirm Warning button is disabled when explanation < 10 chars
    const confirmBtn = screen.getByRole('button', { name: /Confirm Warning/i });
    expect(confirmBtn.disabled).toBe(true);

    const input = screen.getByLabelText(/Written Explanation/i);
    fireEvent.change(input, { target: { value: 'Too short' } });
    expect(confirmBtn.disabled).toBe(true);
    expect(screen.getByText(/Explanation must be at least 10 characters/i)).toBeTruthy();

    // Enter valid explanation >= 10 chars
    fireEvent.change(input, { target: { value: 'Inappropriate language in project chat.' } });
    expect(confirmBtn.disabled).toBe(false);
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(adminApi.warnUser).toHaveBeenCalledWith('1', {
        reason: 'Inappropriate language in project chat.',
      });
    });
  });
});
