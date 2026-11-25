import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import SuperuserConfig from '../pages/admin/SuperuserConfig';
import AdminLogin from '../pages/admin/AdminLogin';
import App from '../App';
import adminApi from '../services/adminApi';

vi.mock('../services/apiClient.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getAuthMode: () => 'jwt',
    setAccessToken: vi.fn(),
  };
});

vi.mock('../services/firebase.js', () => ({
  auth: {},
}));

vi.mock('../services/portalAdminsApi', () => ({
  default: {
    list: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../services/adminApi', () => ({
  default: {
    getStats: vi.fn().mockResolvedValue({ activeAdmins: 1, activeUsers: 5 }),
    getConfig: vi.fn().mockResolvedValue({
      maxProjectsPerUser: 10,
      maxCollaboratorsPerProject: 20,
      minimumTenure: 5,
      xpPerTaskCompletion: 100,
      maintenanceMode: false,
      platformVersion: '1.4.2',
    }),
    updateConfig: vi.fn(),
    getSnapshotInfo: vi.fn().mockResolvedValue({ savedAt: null, sizeBytes: null }),
    createSnapshot: vi.fn(),
    getSystemIntegrity: vi.fn().mockResolvedValue(null),
    getDemoResetStatus: vi.fn(),
    resetDemoData: vi.fn(),
    getJobRuns: vi.fn().mockResolvedValue([]),
    getPublicConfig: vi.fn().mockResolvedValue({ maintenanceMode: false }),
    recordAuditEntry: vi.fn().mockResolvedValue({}),
  },
  recordPortalAuditEntry: vi.fn(),
}));

function renderSuperuserConfig() {
  return render(
    <MemoryRouter initialEntries={['/admin/config']}>
      <Routes>
        <Route path="/admin/config" element={<SuperuserConfig />} />
        <Route path="/admin/login" element={<AdminLogin />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Demo Reset Feature Frontend Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    sessionStorage.setItem('teamforge.role', 'superuser');
    sessionStorage.setItem('teamforge.portalRole', 'superuser');
    sessionStorage.setItem('teamforge.isSuperUser', 'true');
    sessionStorage.setItem('teamforge.adminToken', 'fake-admin-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Hides Demo data card when disabled (ALLOW_DEMO_RESET=false)', async () => {
    adminApi.getDemoResetStatus.mockResolvedValueOnce({ enabled: false, lastResetAt: null });

    renderSuperuserConfig();

    await waitFor(() => {
      expect(adminApi.getDemoResetStatus).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByTestId('demo-reset-card')).toBeNull();
  });

  it('2. Opens dialog, keeps confirm disabled until RESET is typed, shows errors, then clears session & redirects with notice on success', async () => {
    adminApi.getDemoResetStatus.mockResolvedValue({
      enabled: true,
      lastResetAt: '2026-11-12T10:00:00.000Z',
    });

    adminApi.resetDemoData
      .mockRejectedValueOnce({
        statusCode: 409,
        code: 'RESET_IN_PROGRESS',
        serverMessage: 'A demo data reset is already in progress.',
      })
      .mockResolvedValueOnce({
        resetAt: '2026-11-12T12:00:00.000Z',
        counts: { users: 9, projects: 8, tasks: 8 },
      });

    renderSuperuserConfig();

    const card = await screen.findByTestId('demo-reset-card');
    expect(card).toBeTruthy();

    fireEvent.click(screen.getByTestId('demo-reset-open-btn'));

    const modal = await screen.findByTestId('demo-reset-modal');
    expect(modal.textContent).toContain('Reset to mock data?');
    expect(modal.textContent).toContain('Everyone — including you — will be logged out');

    const submitBtn = screen.getByTestId('demo-reset-submit-btn');
    const confirmInput = screen.getByTestId('demo-reset-confirm-input');
    expect(submitBtn.disabled).toBe(true);

    fireEvent.change(confirmInput, { target: { value: 'reset' } });
    expect(submitBtn.disabled).toBe(true);

    fireEvent.change(confirmInput, { target: { value: 'RESET' } });
    expect(submitBtn.disabled).toBe(false);

    // 1st click triggers 409 error displayed inside dialog
    fireEvent.click(submitBtn);
    const errBox = await screen.findByTestId('demo-reset-error');
    expect(errBox.textContent).toContain('already in progress');

    // 2nd click succeeds -> clears session, redirects to /admin/login, displays notice
    fireEvent.click(screen.getByTestId('demo-reset-submit-btn'));

    await waitFor(() => {
      expect(adminApi.resetDemoData).toHaveBeenCalledWith('RESET');
      expect(sessionStorage.getItem('teamforge.adminToken')).toBeNull();
      expect(sessionStorage.getItem('teamforge.isSuperUser')).toBeNull();
      expect(screen.getByTestId('demo-reset-login-notice').textContent).toContain(
        'Demo data restored. Please log in again.',
      );
    });
  });

  it('3. App displays friendly retrying banner on 503 MAINTENANCE event and clears when retry finishes', async () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );

    act(() => {
      window.dispatchEvent(
        new CustomEvent('teamforge:maintenance', {
          detail: {
            code: 'MAINTENANCE',
            message: 'The system is being reset, retrying...',
            retryAfterSeconds: 2,
            active: true,
          },
        }),
      );
    });

    const banner = await screen.findByTestId('maintenance-retrying-banner');
    expect(banner.textContent).toContain('The system is being reset, retrying...');

    act(() => {
      window.dispatchEvent(
        new CustomEvent('teamforge:maintenance', {
          detail: { code: 'MAINTENANCE', active: false },
        }),
      );
    });

    expect(screen.queryByTestId('maintenance-retrying-banner')).toBeNull();
  });
});
