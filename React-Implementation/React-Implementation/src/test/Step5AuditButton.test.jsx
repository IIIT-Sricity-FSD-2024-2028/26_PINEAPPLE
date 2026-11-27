import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import AdminReports from '../pages/admin/AdminReports';
import AuditLog from '../pages/admin/AuditLog';
import { renderWithProviders } from './test-utils';

const { mockReportsApi, mockAdminApi } = vi.hoisted(() => ({
  mockReportsApi: {
    getReports: vi.fn(),
    getAdminReports: vi.fn(),
    getReportDetails: vi.fn(),
    getAdminReportById: vi.fn(),
    getOpenCount: vi.fn().mockResolvedValue({ count: 1 }),
    updateReportStatus: vi.fn(),
    actionReport: vi.fn(),
    getDisputes: vi.fn().mockResolvedValue([]),
  },
  mockAdminApi: {
    getAuditLog: vi.fn(),
    exportAuditLog: vi.fn(),
  },
}));

vi.mock('../services/reportsApi', () => ({
  default: mockReportsApi,
  reportsApi: mockReportsApi,
}));

vi.mock('../services/adminApi', () => ({
  default: mockAdminApi,
  adminApi: mockAdminApi,
}));

vi.mock('../services/appealsApi', () => ({
  default: {
    getAppeals: vi.fn().mockResolvedValue([]),
    getAppealDetails: vi.fn().mockResolvedValue(null),
  },
}));

describe('Step 5 Frontend: Fix View Audit Log Button in Report Review Dialog & Audit Filter Chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('1. Button closes dialog and navigates in the same tab to /admin/audit-log with userId, reportId, from=report without window.open', async () => {
    mockReportsApi.getAdminReports.mockResolvedValue([
      {
        id: 'rep-42',
        reason: 'Harassment',
        details: 'Offensive language used in channels',
        status: 'Open',
        type: 'user',
        reportedUserId: 'bad-user-99',
        reportedUserName: 'ToxicUser',
        reportedUserUsername: 'toxic_user',
        reporterId: 'user-1',
        reporterName: 'GoodUser',
        createdAt: '2026-11-20T10:00:00.000Z',
      },
    ]);

    mockReportsApi.getReportDetails.mockResolvedValue({
      id: 'rep-42',
      reason: 'Harassment',
      details: 'Offensive language used in channels',
      status: 'Open',
      type: 'user',
      reportedUserId: 'bad-user-99',
      reportedUser: {
        id: 'bad-user-99',
        name: 'ToxicUser',
        username: 'toxic_user',
        university: 'Engineering College',
      },
      reporter: {
        id: 'user-1',
        name: 'GoodUser',
      },
      createdAt: '2026-11-20T10:00:00.000Z',
    });

    mockAdminApi.getAuditLog.mockResolvedValue([]);
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    renderWithProviders(
      <Routes>
        <Route path="/admin/reports" element={<AdminReports />} />
        <Route path="/admin/audit-log" element={<AuditLog />} />
      </Routes>,
      {
        route: '/admin/reports',
        preloadedState: {
          session: {
            portalRole: 'Admin',
            isSuperUser: false,
            permissions: ['reports', 'audit'],
            isAuthenticated: true,
            initialized: true,
          },
        },
      },
    );

    const reviewBtn = await screen.findByTestId('review-report-rep-42');
    fireEvent.click(reviewBtn);

    await waitFor(() => {
      expect(mockReportsApi.getReportDetails).toHaveBeenCalledWith('rep-42');
    });

    const auditBtn = await screen.findByTestId('link-view-audit');
    expect(auditBtn).toBeDefined();
    expect(auditBtn.tagName.toLowerCase()).toBe('button');
    expect(auditBtn.getAttribute('target')).toBeNull();

    fireEvent.click(auditBtn);

    await waitFor(() => {
      expect(screen.queryByText(/Report Review: Harassment/i)).toBeNull();
      expect(mockAdminApi.getAuditLog).toHaveBeenCalledWith({
        userId: 'bad-user-99',
        reportId: 'rep-42',
      });
    });
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it('2. Admin without audit permission sees disabled button with tooltip', async () => {
    // Admin with only reports permission (lacks audit)
    sessionStorage.setItem('teamforge.portalRole', 'Admin');
    sessionStorage.setItem('teamforge.adminPermissions', JSON.stringify(['reports']));

    mockReportsApi.getAdminReports.mockResolvedValue([
      {
        id: 'rep-42',
        reason: 'Harassment',
        status: 'Open',
        reportedUserId: 'bad-user-99',
        reportedUserName: 'ToxicUser',
        createdAt: '2026-11-20T10:00:00.000Z',
      },
    ]);

    mockReportsApi.getReportDetails.mockResolvedValue({
      id: 'rep-42',
      reason: 'Harassment',
      status: 'Open',
      reportedUserId: 'bad-user-99',
      reportedUser: { id: 'bad-user-99', name: 'ToxicUser' },
      createdAt: '2026-11-20T10:00:00.000Z',
    });

    renderWithProviders(<AdminReports />, {
      route: '/admin/reports',
      preloadedState: {
        session: {
          portalRole: 'Admin',
          isSuperUser: false,
          permissions: ['reports'],
          isAuthenticated: true,
          initialized: true,
        },
      },
    });

    const reviewBtn = await screen.findByTestId('review-report-rep-42');
    fireEvent.click(reviewBtn);

    const auditBtn = await screen.findByTestId('link-view-audit');
    expect(auditBtn.tagName.toLowerCase()).toBe('button');
    expect(auditBtn.hasAttribute('disabled')).toBe(true);
    expect(auditBtn.getAttribute('title')).toBe('You need the audit log permission');
  });

  it('3. Audit Log page applies URL parameters, passes userId and reportId to api, and renders filter chips', async () => {
    sessionStorage.setItem('teamforge.portalRole', 'SuperUser');
    sessionStorage.setItem('teamforge.isSuperUser', 'true');

    mockAdminApi.getAuditLog.mockResolvedValue([
      {
        id: 'audit-1',
        action: 'user-warned',
        actor: 'admin-1',
        target: 'bad-user-99',
        entityType: 'user',
        entityId: 'bad-user-99',
        details: { userId: 'bad-user-99', reportId: 'rep-42' },
        timestamp: '2026-11-20T10:05:00.000Z',
      },
    ]);

    renderWithProviders(<AuditLog />, {
      route: '/admin/audit-log?userId=bad-user-99&reportId=rep-42&from=report',
      preloadedState: {
        session: {
          portalRole: 'SuperUser',
          isSuperUser: true,
          permissions: ['*'],
          isAuthenticated: true,
          initialized: true,
        },
      },
    });

    await waitFor(() => {
      expect(mockAdminApi.getAuditLog).toHaveBeenCalledWith({
        userId: 'bad-user-99',
        reportId: 'rep-42',
      });
    });

    // Check chips
    expect(screen.getByTestId('active-filter-chips')).toBeDefined();
    expect(screen.getByTestId('chip-userId')).toBeDefined();
    expect(screen.getByTestId('chip-reportId')).toBeDefined();
    expect(screen.getByText('bad-user-99')).toBeDefined();
    expect(screen.getByText('rep-42')).toBeDefined();

    // Check count
    const countEl = screen.getByTestId('audit-result-count');
    expect(countEl.textContent).toContain('1 event shown');
  });

  it('4. Removing a chip updates the URL; Clear all removes all active filters', async () => {
    sessionStorage.setItem('teamforge.portalRole', 'SuperUser');
    sessionStorage.setItem('teamforge.isSuperUser', 'true');

    mockAdminApi.getAuditLog.mockResolvedValue([]);

    renderWithProviders(<AuditLog />, {
      route: '/admin/audit-log?userId=bad-user-99&reportId=rep-42&from=report',
      preloadedState: {
        session: {
          portalRole: 'SuperUser',
          isSuperUser: true,
          permissions: ['*'],
          isAuthenticated: true,
          initialized: true,
        },
      },
    });

    await waitFor(() => {
      expect(mockAdminApi.getAuditLog).toHaveBeenCalled();
    });

    // Click remove-chip-userId
    const removeUserBtn = screen.getByTestId('remove-chip-userId');
    fireEvent.click(removeUserBtn);

    // After removing userId, reportId chip remains
    await waitFor(() => {
      expect(screen.queryByTestId('chip-userId')).toBeNull();
      expect(screen.getByTestId('chip-reportId')).toBeDefined();
    });

    // Click Clear all
    const clearAllBtn = screen.getByTestId('clear-all-filters-btn');
    fireEvent.click(clearAllBtn);

    await waitFor(() => {
      expect(screen.queryByTestId('active-filter-chips')).toBeNull();
    });
  });

  it('5. Audit Log displays customized empty state when filtering by userId', async () => {
    sessionStorage.setItem('teamforge.portalRole', 'SuperUser');
    sessionStorage.setItem('teamforge.isSuperUser', 'true');

    mockAdminApi.getAuditLog.mockResolvedValue([]);

    renderWithProviders(<AuditLog />, {
      route: '/admin/audit-log?userId=clean-user-123',
      preloadedState: {
        session: {
          portalRole: 'SuperUser',
          isSuperUser: true,
          permissions: ['*'],
          isAuthenticated: true,
          initialized: true,
        },
      },
    });

    await waitFor(() => {
      expect(mockAdminApi.getAuditLog).toHaveBeenCalledWith({ userId: 'clean-user-123' });
    });

    expect(await screen.findByText('No audit entries for this user.')).toBeDefined();
  });
});
