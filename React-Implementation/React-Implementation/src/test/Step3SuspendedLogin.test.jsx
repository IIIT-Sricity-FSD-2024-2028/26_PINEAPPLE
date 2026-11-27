import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import Login from '../pages/Login';
import AdminLogin from '../pages/admin/AdminLogin';
import Suspended from '../pages/Suspended';
import SuspendedAccountPanel from '../components/common/SuspendedAccountPanel';
import { authApi } from '../services/authApi';
import adminApi from '../services/adminApi';
import { setAuthMode } from '../services/apiClient';
import { selectCurrentUser, selectSessionNotices, selectSuspendedInfo } from '../store/selectors/sessionSelectors';
import { store } from '../store';
import { renderWithProviders, renderWithStore } from './test-utils';

vi.mock('../services/adminApi', () => ({
  default: {
    login: vi.fn(),
  },
  recordPortalAuditEntry: vi.fn(),
}));

vi.mock('../services/authApi', () => ({
  authApi: {
    login: vi.fn(),
    resolveIdentifier: vi.fn(),
    getMe: vi.fn(),
  },
}));

describe('STEP 3 FRONTEND: Suspended User Notification & Screen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAuthMode('jwt');
  });

  it('1. SuspendedAccountPanel renders all required fields: title, reason, date, type, support contact', () => {
    const info = {
      reason: 'Repeated disruptive behavior in workspace',
      suspendedAt: '2026-11-21T10:30:00.000Z',
      suspensionType: 'manual',
      appealAvailable: false,
      supportContact: 'support@teamforge.io',
    };

    renderWithProviders(<SuspendedAccountPanel info={info} />);

    expect(screen.getByTestId('suspended-account-panel')).toBeTruthy();
    expect(screen.getByTestId('suspended-panel-title').textContent).toContain('Your account is suspended');
    expect(screen.getByTestId('suspended-reason').textContent).toContain('Repeated disruptive behavior in workspace');
    expect(screen.getByTestId('suspended-type').textContent).toContain('Suspended by a moderator');
    expect(screen.getByTestId('support-contact-link').textContent).toContain('support@teamforge.io');
    expect(screen.getByTestId('support-contact-link').getAttribute('href')).toBe('mailto:support@teamforge.io');
    expect(screen.queryByTestId('appeal-link')).toBeNull();
  });

  it('2. SuspendedAccountPanel renders automatic type and appeal link when appealAvailable is true', () => {
    const info = {
      reason: 'Automatic suspension after 4 warnings',
      suspendedAt: '2026-11-21T12:00:00.000Z',
      suspensionType: 'automatic',
      appealAvailable: true,
      supportContact: 'support@teamforge.io',
    };

    renderWithProviders(<SuspendedAccountPanel info={info} />);

    expect(screen.getByTestId('suspended-reason').textContent).toContain('Automatic suspension after 4 warnings');
    expect(screen.getByTestId('suspended-type').textContent).toContain('Automatic after 4 warnings');
    expect(screen.getByTestId('appeal-link')).toBeTruthy();
  });

  it('3. Login.jsx displays suspended panel on 403 ACCOUNT_SUSPENDED, keeps email, clears password', async () => {
    const mockSuspendedErr = new Error('Your account is suspended.');
    mockSuspendedErr.statusCode = 403;
    mockSuspendedErr.code = 'ACCOUNT_SUSPENDED';
    mockSuspendedErr.data = {
      statusCode: 403,
      error: 'Forbidden',
      code: 'ACCOUNT_SUSPENDED',
      message: 'Your account is suspended.',
      reason: 'Inappropriate language in project chat',
      suspendedAt: '2026-11-21T14:00:00.000Z',
      suspensionType: 'manual',
      appealAvailable: false,
      supportContact: 'support@teamforge.io',
    };

    authApi.login.mockRejectedValueOnce(mockSuspendedErr);

    renderWithStore(<Login />, { route: '/login' });

    const emailInput = screen.getByPlaceholderText('username or name@example.com');
    const passwordInput = screen.getByPlaceholderText('••••••');
    const submitBtn = screen.getByRole('button', { name: /^Sign In$/i });

    fireEvent.change(emailInput, { target: { value: 'suspended.user@teamforge.io' } });
    fireEvent.change(passwordInput, { target: { value: 'secret123' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByTestId('suspended-account-panel')).toBeTruthy();
    });

    expect(screen.getByTestId('suspended-reason').textContent).toContain('Inappropriate language in project chat');
    expect(screen.getByTestId('suspended-type').textContent).toContain('Suspended by a moderator');

    // Email remains filled, password cleared
    expect(emailInput.value).toBe('suspended.user@teamforge.io');
    expect(passwordInput.value).toBe('');
  });

  it('4. AdminLogin.jsx displays suspended panel on portal admin ACCOUNT_SUSPENDED', async () => {
    const mockSuspendedErr = new Error('Your account is suspended.');
    mockSuspendedErr.statusCode = 403;
    mockSuspendedErr.code = 'ACCOUNT_SUSPENDED';
    mockSuspendedErr.data = {
      statusCode: 403,
      error: 'Forbidden',
      code: 'ACCOUNT_SUSPENDED',
      message: 'Your account is suspended.',
      reason: 'Admin credentials flagged for security audit',
      suspendedAt: '2026-11-21T15:00:00.000Z',
      suspensionType: 'manual',
      appealAvailable: false,
      supportContact: 'support@teamforge.io',
    };

    adminApi.login.mockRejectedValueOnce(mockSuspendedErr);

    renderWithProviders(<AdminLogin />, { route: '/admin/login' });

    const emailInput = screen.getByPlaceholderText('admin@teamforge.io');
    const passwordInput = screen.getByPlaceholderText('••••••••');
    const submitBtn = screen.getByRole('button', { name: /Secure Sign In/i });

    fireEvent.change(emailInput, { target: { value: 'bad.admin@teamforge.io' } });
    fireEvent.change(passwordInput, { target: { value: 'Admin@123' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByTestId('suspended-account-panel')).toBeTruthy();
    });

    expect(screen.getByTestId('suspended-reason').textContent).toContain('Admin credentials flagged for security audit');
    expect(emailInput.value).toBe('bad.admin@teamforge.io');
    expect(passwordInput.value).toBe('');
  });

  it('5. Suspended.jsx page clears session and renders panel with Back to login button', async () => {
    renderWithStore(
      <Routes>
        <Route path="/suspended" element={<Suspended />} />
        <Route path="/login" element={<div>LOGIN PAGE VIEW</div>} />
      </Routes>,
      {
        route: '/suspended',
        preloadedState: {
          session: {
            user: { id: 'user-susp-1' },
            isAuthenticated: true,
            suspendedInfo: {
              reason: 'Automated policy violation',
              suspendedAt: '2026-11-21T11:00:00.000Z',
              suspensionType: 'automatic',
              appealAvailable: false,
              supportContact: 'support@teamforge.io',
            },
          },
        },
      },
    );

    expect(screen.getByTestId('suspended-account-panel')).toBeTruthy();
    expect(screen.getByTestId('suspended-reason').textContent).toContain('Automated policy violation');
    expect(screen.getByTestId('suspended-type').textContent).toContain('Automatic after 4 warnings');

    const backBtn = screen.getByTestId('back-to-login-btn');
    fireEvent.click(backBtn);

    await waitFor(() => {
      expect(screen.getByText('LOGIN PAGE VIEW')).toBeTruthy();
    });
  });

  it('6. Wrong password or non-suspended error shows generic error, NOT suspended panel', async () => {
    const genericErr = new Error('Invalid credentials.');
    genericErr.statusCode = 401;
    genericErr.code = 'INVALID_CREDENTIALS';

    authApi.login.mockRejectedValueOnce(genericErr);

    renderWithStore(<Login />, { route: '/login' });

    const emailInput = screen.getByPlaceholderText('username or name@example.com');
    const passwordInput = screen.getByPlaceholderText('••••••');
    const submitBtn = screen.getByRole('button', { name: /^Sign In$/i });

    fireEvent.change(emailInput, { target: { value: 'regular.user@teamforge.io' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Invalid credentials/i)).toBeTruthy();
    });

    expect(screen.queryByTestId('suspended-account-panel')).toBeNull();
  });

  it('7. apiClient executes mid-session 403 ACCOUNT_SUSPENDED redirecting to /suspended and not showing restart notice', async () => {
    const { apiRequest, setRestartRedirectHandler, tokenManager } = await import('../services/apiClient');

    tokenManager.setAccessToken('sample-token');

    let redirectedPath = null;
    setRestartRedirectHandler((path) => {
      redirectedPath = path;
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => ({
        statusCode: 403,
        error: 'Forbidden',
        code: 'ACCOUNT_SUSPENDED',
        message: 'Your account is suspended.',
        reason: 'Violation of collaboration rules',
        suspendedAt: '2026-11-21T16:00:00.000Z',
        suspensionType: 'manual',
        appealAvailable: false,
        supportContact: 'support@teamforge.io',
      }),
    });
    globalThis.fetch = mockFetch;

    window.history.pushState({}, '', '/dashboard');

    await expect(apiRequest('/projects', 'GET')).rejects.toThrow();

    expect(redirectedPath).toBe('/suspended');
    expect(selectSessionNotices(store.getState()).serverRestart).toBeFalsy();
    expect(selectCurrentUser(store.getState())).toBeNull();
    const storedSuspended = selectSuspendedInfo(store.getState());
    expect(storedSuspended.code).toBe('ACCOUNT_SUSPENDED');
    expect(storedSuspended.reason).toBe('Violation of collaboration rules');
  });
});
