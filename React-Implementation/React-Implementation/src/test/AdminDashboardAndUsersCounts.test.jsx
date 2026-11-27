import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import AdminDashboard from '../pages/admin/AdminDashboard';
import AdminUsers from '../pages/admin/AdminUsers';
import adminApi from '../services/adminApi';
import reportsApi from '../services/reportsApi';
import { fetchDashboardStats } from '../store/thunks/adminUsersThunks';
import { createAppStore } from '../store';
import { renderWithStore } from './test-utils';

vi.mock('../services/adminApi', () => ({
  default: {
    getStats: vi.fn(),
    listUsers: vi.fn(),
    getUserCounts: vi.fn(),
    getDuplicateUsers: vi.fn(),
    getAuditLog: vi.fn(),
    getModerationActions: vi.fn(),
    flagUser: vi.fn(),
    warnUser: vi.fn(),
  },
}));

vi.mock('../services/reportsApi', () => ({
  default: {
    getOpenCount: vi.fn(),
  },
}));

vi.mock('../services/trustApi', () => ({
  default: {
    getTrustSummaries: vi.fn().mockResolvedValue([]),
  },
}));

describe('Admin Dashboard & Users Page Unified User Counts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reportsApi.getOpenCount.mockResolvedValue({ count: 0 });
    adminApi.getAuditLog.mockResolvedValue([]);
    adminApi.getModerationActions.mockResolvedValue([]);
    adminApi.getDuplicateUsers.mockResolvedValue({ groups: [] });
  });

  it('1. AdminDashboard renders counts from response and computes User Health bar widths from total (with total=0 guard)', async () => {
    adminApi.getStats.mockResolvedValue({
      totalUsers: 9,
      activeUsers: 8,
      suspendedUsers: 1,
      flaggedUsers: 2,
      warnedUsers: 1,
      flaggedWarned: 2,
      possibleDuplicates: 0,
      pendingApprovals: 0,
      pendingMentorApps: 0,
      auditEvents: 10,
      counts: {
        total: 9,
        active: 8,
        suspended: 1,
        flagged: 2,
        warned: 1,
        possibleDuplicates: 0,
        pendingApprovals: 0,
      },
    });

    const { container } = renderWithStore(<AdminDashboard />, {
      route: '/admin',
      preloadedState: {
        session: {
          adminUid: 'u-admin',
          portalRole: 'admin',
          isSuperUser: false,
          permissions: ['*'],
          initialized: true,
        },
      },
    });

    await waitFor(() => {
      expect(container.querySelector('#admin-health-active-label')?.textContent).toBe('8 / 9');
    });

    expect(document.body.textContent).toContain('Total Users');
    expect(document.body.textContent).toContain('8 active');
    expect(container.querySelector('#admin-action-flagged-sub')?.textContent).toBe('2 flagged');
    expect(container.querySelector('#admin-action-flagged-count')?.textContent).toBe('2');

    expect(container.querySelector('#admin-health-active-fill')?.style.width).toBe(`${Math.round((8 / 9) * 100)}%`);
    expect(container.querySelector('#admin-health-warned-label')?.textContent).toBe('1 / 9');
    expect(container.querySelector('#admin-health-warned-fill')?.style.width).toBe(`${Math.round((1 / 9) * 100)}%`);
    expect(container.querySelector('#admin-health-suspended-label')?.textContent).toBe('1 / 9');
    expect(container.querySelector('#admin-health-suspended-fill')?.style.width).toBe(`${Math.round((1 / 9) * 100)}%`);
  });

  it('1b. AdminDashboard guards total = 0 with 0 / 0 labels and 0% widths (no NaN)', async () => {
    adminApi.getStats.mockResolvedValue({
      totalUsers: 0,
      activeUsers: 0,
      suspendedUsers: 0,
      flaggedUsers: 0,
      warnedUsers: 0,
      flaggedWarned: 0,
      pendingMentorApps: 0,
      auditEvents: 0,
    });

    const { container } = renderWithStore(<AdminDashboard />, {
      route: '/admin',
      preloadedState: {
        session: {
          adminUid: 'u-admin',
          portalRole: 'admin',
          isSuperUser: false,
          permissions: ['*'],
          initialized: true,
        },
      },
    });

    await waitFor(() => {
      expect(container.querySelector('#admin-health-active-label')?.textContent).toBe('0 / 0');
    });
    expect(container.querySelector('#admin-health-active-fill')?.style.width).toBe('0%');
    expect(container.querySelector('#admin-health-warned-fill')?.style.width).toBe('0%');
    expect(container.querySelector('#admin-health-suspended-fill')?.style.width).toBe('0%');
  });

  it('2. AdminUsers filter chips match AdminDashboard numbers identically for shared preloaded/store data without client recomputation', async () => {
    const sharedCounts = {
      total: 9,
      active: 8,
      suspended: 1,
      flagged: 2,
      warned: 1,
      possibleDuplicates: 1,
      pendingApprovals: 1,
    };

    adminApi.getStats.mockResolvedValue({
      totalUsers: sharedCounts.total,
      activeUsers: sharedCounts.active,
      suspendedUsers: sharedCounts.suspended,
      flaggedUsers: sharedCounts.flagged,
      warnedUsers: sharedCounts.warned,
      flaggedWarned: sharedCounts.flagged,
      possibleDuplicates: sharedCounts.possibleDuplicates,
      pendingApprovals: sharedCounts.pendingApprovals,
      counts: sharedCounts,
    });
    adminApi.listUsers.mockResolvedValue([
      // Intentionally return only 1 row to verify chip counts read directly from shared userCounts, NOT entities.length
      { id: '2', name: 'Arjun Sharma', role: 'Collaborator', status: 'Active', xp: 100, rep: 10, projects: 1 },
    ]);
    adminApi.getUserCounts.mockResolvedValue(sharedCounts);

    const store = createAppStore({
      preloadedState: {
        session: {
          adminUid: 'u-admin',
          portalRole: 'admin',
          isSuperUser: false,
          permissions: ['*'],
          initialized: true,
        },
        adminUsers: {
          ids: [],
          entities: {},
          userCounts: sharedCounts,
          dashboardStats: {
            totalUsers: sharedCounts.total,
            activeUsers: sharedCounts.active,
            suspendedUsers: sharedCounts.suspended,
            flaggedUsers: sharedCounts.flagged,
            warnedUsers: sharedCounts.warned,
            flaggedWarned: sharedCounts.flagged,
            possibleDuplicates: sharedCounts.possibleDuplicates,
            pendingApprovals: sharedCounts.pendingApprovals,
            counts: sharedCounts,
          },
        },
      },
    });

    await store.dispatch(fetchDashboardStats());
    const dashRender = renderWithStore(<AdminDashboard />, { store, route: '/admin' });
    await waitFor(() => {
      expect(dashRender.container.querySelector('#admin-health-active-label')?.textContent).toBe('8 / 9');
    });

    renderWithStore(<AdminUsers />, { store, route: '/admin/users' });
    await waitFor(() => {
      const tabTexts = screen.getAllByRole('tab').map((t) => t.textContent);
      expect(tabTexts.some((t) => t.includes('All (9)'))).toBe(true);
      expect(tabTexts.some((t) => t.includes('Active (8)'))).toBe(true);
      expect(tabTexts.some((t) => t.includes('Suspended (1)'))).toBe(true);
      expect(tabTexts.some((t) => t.includes('Flagged (2)'))).toBe(true);
      expect(tabTexts.some((t) => t.includes('Possible duplicates (1)'))).toBe(true);
      expect(tabTexts.some((t) => t.includes('Approvals (1)'))).toBe(true);
    });
  });

  it('3. AdminUsers refetches server counts immediately after flagging a user', async () => {
    adminApi.listUsers.mockResolvedValue([
      { id: '2', name: 'Arjun Sharma', role: 'Collaborator', status: 'Active', flags: false, xp: 100, rep: 10, projects: 1 },
    ]);
    adminApi.getUserCounts
      .mockResolvedValueOnce({
        total: 9,
        active: 9,
        suspended: 0,
        flagged: 0,
        warned: 0,
        possibleDuplicates: 0,
        pendingApprovals: 0,
      })
      .mockResolvedValueOnce({
        total: 9,
        active: 9,
        suspended: 0,
        flagged: 1,
        warned: 0,
        possibleDuplicates: 0,
        pendingApprovals: 0,
      });
    adminApi.flagUser.mockResolvedValue({ id: '2', status: 'Flagged', flags: true });

    renderWithStore(<AdminUsers />, {
      route: '/admin/users',
      preloadedState: {
        session: {
          adminUid: 'u-admin',
          portalRole: 'admin',
          isSuperUser: false,
          permissions: ['*'],
          initialized: true,
        },
      },
    });

    await waitFor(() => {
      expect(screen.getByText('Flagged (0)')).toBeTruthy();
    });

    fireEvent.click(screen.getByLabelText(/Open actions for Arjun Sharma/i));
    fireEvent.click(screen.getByText('Flag account'));

    await waitFor(() => {
      expect(adminApi.flagUser).toHaveBeenCalledWith('2');
      expect(screen.getByText('Flagged (1)')).toBeTruthy();
    });
  });
});
