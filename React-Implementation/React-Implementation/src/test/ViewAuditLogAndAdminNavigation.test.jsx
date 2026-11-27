import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import { Routes, Route, useLocation } from 'react-router-dom';
import fs from 'node:fs';
import path from 'node:path';
import AdminReports from '../pages/admin/AdminReports';
import AuditLog from '../pages/admin/AuditLog';
import AdminLogin from '../pages/admin/AdminLogin';
import AppRoutes from '../routes/AppRoutes';
import AdminProtectedRoute from '../routes/AdminProtectedRoute';
import AdminLayout from '../pages/admin/AdminLayout';
import AdminNotFound from '../pages/admin/AdminNotFound';
import { sanitizeAdminNextPath } from '../routes/adminNavigation';
import { renderWithProviders } from './test-utils';

const { mockReportsApi, mockAdminApi, mockPortalAdminsApi } = vi.hoisted(() => ({
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
    login: vi.fn(),
    getStats: vi.fn().mockResolvedValue({}),
    getDashboard: vi.fn().mockResolvedValue({}),
    recordPortalAuditEntry: vi.fn(),
  },
  mockPortalAdminsApi: {
    login: vi.fn(),
  },
}));

vi.mock('../services/apiClient', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getAuthMode: () => 'jwt',
  };
});

vi.mock('../services/reportsApi', () => ({
  default: mockReportsApi,
  reportsApi: mockReportsApi,
}));

vi.mock('../services/adminApi', () => ({
  default: mockAdminApi,
  adminApi: mockAdminApi,
}));

vi.mock('../services/portalAdminsApi', () => ({
  default: mockPortalAdminsApi,
  portalAdminsApi: mockPortalAdminsApi,
}));

vi.mock('../services/appealsApi', () => ({
  default: {
    getAppeals: vi.fn().mockResolvedValue([]),
    getAdminAppeals: vi.fn().mockResolvedValue([]),
    getAppealDetails: vi.fn().mockResolvedValue(null),
  },
}));

function LocationEcho() {
  const loc = useLocation();
  return (
    <div data-testid="location-echo">
      {`${loc.pathname}${loc.search}`}
    </div>
  );
}

describe('View Audit Log SPA Navigation, Admin ?next= Guards, Refresh Message & 404', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReportsApi.getAdminReports.mockResolvedValue([
      {
        id: 'rep-701',
        reason: 'Harassment',
        details: 'Abusive messages inside project workspace chat.',
        status: 'Open',
        type: 'chat_message',
        reportedUserId: 'user-88',
        reportedUserName: 'Rohan Dev',
        reportedUserUsername: 'rohandev',
        reporterId: 'user-1',
        reporterName: 'Priya Patel',
        createdAt: '2026-11-26T10:00:00.000Z',
      },
    ]);
    mockReportsApi.getReportDetails.mockResolvedValue({
      id: 'rep-701',
      reason: 'Harassment',
      details: 'Abusive messages inside project workspace chat.',
      status: 'Open',
      type: 'chat_message',
      reportedUserId: 'user-88',
      reportedUser: { id: 'user-88', name: 'Rohan Dev', username: 'rohandev' },
      reporter: { id: 'user-1', name: 'Priya Patel' },
      createdAt: '2026-11-26T10:00:00.000Z',
    });
    mockAdminApi.getAuditLog.mockResolvedValue([
      {
        id: 'aud-701',
        action: 'report-created',
        actor: 'Priya Patel',
        target: 'user-88',
        details: { userId: 'user-88', reportId: 'rep-701' },
        timestamp: '2026-11-26T10:05:00.000Z',
      },
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Clicking View audit log closes dialog, navigates via router without window.open or location mutation, and Back to report reopens the report', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const assignSpy = vi.fn();
    const hrefBefore = window.location.href;

    renderWithProviders(
      <>
        <LocationEcho />
        <Routes>
          <Route path="/admin/reports" element={<AdminReports />} />
          <Route path="/admin/audit-log" element={<AuditLog />} />
        </Routes>
      </>,
      {
        route: '/admin/reports',
        preloadedState: {
          session: {
            portalRole: 'SuperUser',
            isSuperUser: true,
            permissions: ['*'],
            isAuthenticated: true,
            initialized: true,
          },
        },
      },
    );

    fireEvent.click(await screen.findByTestId('review-report-rep-701'));
    const auditBtn = await screen.findByTestId('link-view-audit');
    expect(auditBtn.tagName.toLowerCase()).toBe('button');

    fireEvent.click(auditBtn);

    await waitFor(() => {
      expect(screen.getByTestId('location-echo').textContent).toBe(
        '/admin/audit-log?userId=user-88&reportId=rep-701&from=report',
      );
      expect(screen.queryByText(/Report Review: Harassment/i)).toBeNull();
    });

    expect(openSpy).not.toHaveBeenCalled();
    expect(assignSpy).not.toHaveBeenCalled();
    expect(window.location.href).toBe(hrefBefore);

    await waitFor(() => {
      expect(mockAdminApi.getAuditLog).toHaveBeenCalledWith({
        userId: 'user-88',
        reportId: 'rep-701',
      });
    });

    expect(screen.getByTestId('chip-userId')).toBeDefined();
    expect(screen.getByTestId('chip-reportId')).toBeDefined();
    expect(screen.getByTestId('clear-all-filters-btn')).toBeDefined();

    // Click "Back to report" -> returns to /admin/reports?open=rep-701 and reopens report dialog
    mockReportsApi.getReportDetails.mockClear();
    fireEvent.click(screen.getByTestId('back-to-report-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('location-echo').textContent).toBe('/admin/reports?open=rep-701');
      expect(mockReportsApi.getReportDetails).toHaveBeenCalledWith('rep-701');
    });
    expect(await screen.findByText(/Report Review: Harassment/i)).toBeDefined();
  });

  it('2. Admin without audit permission sees disabled View audit log button with tooltip', async () => {
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

    fireEvent.click(await screen.findByTestId('review-report-rep-701'));
    const btn = await screen.findByTestId('link-view-audit');
    expect(btn.tagName.toLowerCase()).toBe('button');
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute('title')).toBe('You need the audit log permission');
  });

  it('3. Unauthenticated visit to /admin/audit-log goes to /admin/login?next=... and returns to /admin/audit-log after login', async () => {
    mockAdminApi.login.mockResolvedValue({
      uid: 'su-1',
      id: 'su-1',
      token: 'portal-tok',
      role: 'superuser',
      permissions: ['*'],
      name: 'Super User',
    });

    renderWithProviders(
      <>
        <LocationEcho />
        <Routes>
          <Route path="/" element={<div data-testid="landing-stub">Landing</div>} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route element={<AdminProtectedRoute />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route path="audit-log" element={<AuditLog />} />
            </Route>
          </Route>
        </Routes>
      </>,
      {
        route: '/admin/audit-log?userId=user-88&reportId=rep-701&from=report',
      },
    );

    await waitFor(() => {
      expect(screen.getByTestId('location-echo').textContent).toBe(
        '/admin/login?next=%2Fadmin%2Faudit-log%3FuserId%3Duser-88%26reportId%3Drep-701%26from%3Dreport',
      );
      expect(screen.queryByTestId('landing-stub')).toBeNull();
    });

    fireEvent.change(screen.getByLabelText(/Admin Email/i), {
      target: { value: 'superuser@teamforge.io' },
    });
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: 'Super@123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Secure Sign In/i }));

    await waitFor(() => {
      expect(screen.getByTestId('location-echo').textContent).toBe(
        '/admin/audit-log?userId=user-88&reportId=rep-701&from=report',
      );
    });
  });

  it('4. Unauthenticated redirect on browser reload preserves ?next= without legacy refresh-logout notice', async () => {
    const origGetEntries = performance.getEntriesByType;
    performance.getEntriesByType = vi.fn((type) =>
      type === 'navigation' ? [{ type: 'reload' }] : [],
    );

    try {
      renderWithProviders(
        <>
          <LocationEcho />
          <Routes>
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route element={<AdminProtectedRoute />}>
              <Route path="/admin" element={<AdminLayout />}>
                <Route path="audit-log" element={<AuditLog />} />
              </Route>
            </Route>
          </Routes>
        </>,
        {
          route: '/admin/audit-log?userId=user-88',
        },
      );

      await waitFor(() => {
        expect(screen.getByTestId('location-echo').textContent).toBe(
          '/admin/login?next=%2Fadmin%2Faudit-log%3FuserId%3Duser-88',
        );
      });
      expect(screen.queryByTestId('admin-login-notice')).toBeNull();
    } finally {
      performance.getEntriesByType = origGetEntries;
    }
  });

  it('5. next values outside /admin/ are ignored and fallback to /admin after login', async () => {
    expect(sanitizeAdminNextPath('/dashboard')).toBe('/admin');
    expect(sanitizeAdminNextPath('https://evil.example/admin/audit-log')).toBe('/admin');
    expect(sanitizeAdminNextPath('//evil.example/admin/audit-log')).toBe('/admin');
    expect(sanitizeAdminNextPath('/admin/login')).toBe('/admin');
    expect(sanitizeAdminNextPath('/admin/audit-log?userId=2')).toBe('/admin/audit-log?userId=2');

    mockAdminApi.login.mockResolvedValue({
      uid: 'su-1',
      id: 'su-1',
      token: 'portal-tok',
      role: 'superuser',
      permissions: ['*'],
      name: 'Super User',
    });

    renderWithProviders(
      <>
        <LocationEcho />
        <Routes>
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<div data-testid="admin-home">Admin Home</div>} />
          <Route path="/dashboard" element={<div data-testid="user-dash">User Dash</div>} />
        </Routes>
      </>,
      {
        route: '/admin/login?next=%2Fdashboard',
      },
    );

    fireEvent.change(screen.getByLabelText(/Admin Email/i), {
      target: { value: 'superuser@teamforge.io' },
    });
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: 'Super@123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Secure Sign In/i }));

    await waitFor(() => {
      expect(screen.getByTestId('location-echo').textContent).toBe('/admin');
    });
    expect(screen.queryByTestId('user-dash')).toBeNull();
  });

  it('6. Unknown /admin/* path shows Admin Page not found with link to /admin dashboard', async () => {
    await act(async () => {
      renderWithProviders(
        <>
          <LocationEcho />
          <AppRoutes />
        </>,
        {
          route: '/admin/unknown-subpage',
          preloadedState: {
            session: {
              portalRole: 'SuperUser',
              isSuperUser: true,
              permissions: ['*'],
              isAuthenticated: true,
              initialized: true,
            },
          },
        },
      );
    });

    const notFound = await screen.findByTestId('admin-not-found');
    expect(notFound.textContent).toMatch(/Page not found/i);
    const backLink = screen.getByTestId('admin-not-found-dashboard-link');
    expect(backLink.getAttribute('href')).toBe('/admin');

    // Also render AdminNotFound directly inside AdminLayout to verify clean wiring
    renderWithProviders(
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="*" element={<AdminNotFound />} />
        </Route>
      </Routes>,
      {
        route: '/admin/does-not-exist',
        preloadedState: {
          session: {
            portalRole: 'SuperUser',
            isSuperUser: true,
            permissions: ['*'],
            isAuthenticated: true,
            initialized: true,
          },
        },
      },
    );
    expect(screen.getAllByTestId('admin-not-found').length).toBeGreaterThanOrEqual(1);
  });

  it('7. Source scan: zero internal routes used in <a href>, window.open, or window.location assignments across src/', () => {
    const srcDir = path.resolve(process.cwd(), 'src');
    const files = [];
    (function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (['node_modules', 'dist', 'test', '__tests__'].includes(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(js|jsx|ts|tsx)$/i.test(entry.name) && !/\.test\./.test(entry.name)) {
          files.push(full);
        }
      }
    })(srcDir);

    const anchorInternalRe = /<a\b[^>]*\bhref\s*=\s*[{"'`]+\s*\/(?!\/)/i;
    const targetBlankInternalRe = /target\s*=\s*['"]_blank['"]/i;
    const windowOpenRe = /\bwindow\.open\s*\(/;
    const windowLocationMutRe = /\b(?:window|document)\.location(?:\.(?:href|assign|replace)|)\s*(?:=|\()/;

    const offenders = [];
    for (const file of files) {
      const rel = path.relative(srcDir, file).replace(/\\/g, '/');
      if (rel === 'components/common/SafeLink.jsx') continue;

      const content = fs.readFileSync(file, 'utf8');
      if (anchorInternalRe.test(content)) {
        offenders.push(`${rel}: internal <a href="/...">`);
      }
      if (targetBlankInternalRe.test(content)) {
        offenders.push(`${rel}: target="_blank"`);
      }
      if (windowOpenRe.test(content)) {
        offenders.push(`${rel}: window.open(`);
      }
      if (windowLocationMutRe.test(content)) {
        offenders.push(`${rel}: window.location assignment`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
