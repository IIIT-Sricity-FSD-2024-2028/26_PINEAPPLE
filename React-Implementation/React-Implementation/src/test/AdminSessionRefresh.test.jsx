import { StrictMode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '../App';
import { createAppStore } from '../store';
import { setupInterceptors } from '../store/utils/setupInterceptors';
import { logoutAdminPortal } from '../store/thunks/sessionThunks';
import { selectIsAdminAuthenticated } from '../store/selectors/sessionSelectors';
import { setAccessToken } from '../services/apiClient';
import { resetAdminRefreshCoordinator } from '../services/adminTokenManager';

const { mockAdminApi, mockAuthApi, mockPlatformConfigApi } = vi.hoisted(() => ({
  mockAdminApi: {
    login: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn().mockResolvedValue({ success: true, loggedOut: true }),
    getStats: vi.fn().mockResolvedValue({ users: 2, mentors: 1, openReports: 0 }),
    getUsers: vi.fn().mockResolvedValue([]),
    getAuditLog: vi.fn().mockResolvedValue([]),
    getDuplicateUsers: vi.fn().mockResolvedValue({ groups: [] }),
  },
  mockAuthApi: {
    getBootInfo: vi.fn().mockResolvedValue({ bootId: 'boot-1' }),
    refresh: vi.fn().mockResolvedValue(null),
    getMe: vi.fn().mockResolvedValue(null),
    logout: vi.fn().mockResolvedValue({}),
  },
  mockPlatformConfigApi: {
    getPublicConfig: vi.fn().mockResolvedValue({ maintenanceMode: false }),
  },
}));

vi.mock('../services/apiClient', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getAuthMode: () => 'jwt',
  };
});

vi.mock('../services/adminApi', () => ({
  default: mockAdminApi,
  adminApi: mockAdminApi,
}));

vi.mock('../services/authApi', () => ({
  default: mockAuthApi,
  authApi: mockAuthApi,
}));

vi.mock('../services/platformConfigApi', () => ({
  default: mockPlatformConfigApi,
  platformConfigApi: mockPlatformConfigApi,
}));

vi.mock('../services/reportsApi', () => ({
  default: {
    getOpenCount: vi.fn().mockResolvedValue({ count: 0 }),
  },
  reportsApi: {
    getOpenCount: vi.fn().mockResolvedValue({ count: 0 }),
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

describe('Admin Session Refresh & Persistence Across Page Refresh', () => {
  const origFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    resetAdminRefreshCoordinator();
    setAccessToken(null);
    mockAdminApi.logout.mockResolvedValue({ success: true, loggedOut: true });
    mockAdminApi.getUsers.mockResolvedValue([]);
    mockAdminApi.getDuplicateUsers.mockResolvedValue({ groups: [] });
    mockAdminApi.getStats.mockResolvedValue({ users: 2, mentors: 1, openReports: 0 });
    mockPlatformConfigApi.getPublicConfig.mockResolvedValue({ maintenanceMode: false });
  });

  afterEach(() => {
    resetAdminRefreshCoordinator();
    globalThis.fetch = origFetch;
  });

  it('1. Startup on /admin/users?filter=suspended calls restoreAdminSession, shows loading screen without login flash, and stays on /admin/users', async () => {
    let resolveRefresh;
    mockAdminApi.refresh.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve;
        }),
    );

    const store = createAppStore();
    setupInterceptors(store);

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/admin/users?filter=suspended']}>
          <LocationEcho />
          <App />
        </MemoryRouter>
      </Provider>,
    );

    // Loading state prevents any flash of /admin/login
    expect(await screen.findByTestId('auth-loading-screen')).toBeTruthy();
    await waitFor(() => {
      expect(mockAdminApi.refresh).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByTestId('location-echo').textContent).toBe('/admin/users?filter=suspended');
    expect(screen.queryByRole('button', { name: /Secure Sign In/i })).toBeNull();
    expect(mockAuthApi.refresh).not.toHaveBeenCalled();

    resolveRefresh({
      token: 'fresh-admin-jwt',
      role: 'admin',
      permissions: ['*'],
      name: 'Default Admin',
      email: 'admin@teamforge.io',
      admin: {
        id: 'u-admin',
        email: 'admin@teamforge.io',
        name: 'Default Admin',
        role: 'admin',
        permissions: ['*'],
      },
    });

    await waitFor(() => {
      expect(selectIsAdminAuthenticated(store.getState())).toBe(true);
      expect(screen.queryByTestId('auth-loading-screen')).toBeNull();
      expect(screen.getByTestId('location-echo').textContent).toBe('/admin/users?filter=suspended');
    });
    expect(mockAdminApi.refresh).toHaveBeenCalledTimes(1);
    expect(mockAuthApi.refresh).not.toHaveBeenCalled();
  });

  it('2. StrictMode double-mount deduplicates startup admin refresh into a single HTTP request', async () => {
    mockAdminApi.refresh.mockResolvedValue({
      token: 'su-jwt-1',
      role: 'superuser',
      permissions: ['*'],
      name: 'Super User',
      email: 'superuser@teamforge.io',
    });

    const store = createAppStore();
    setupInterceptors(store);

    render(
      <StrictMode>
        <Provider store={store}>
          <MemoryRouter initialEntries={['/admin/su-config']}>
            <LocationEcho />
            <App />
          </MemoryRouter>
        </Provider>
      </StrictMode>,
    );

    await waitFor(() => {
      expect(selectIsAdminAuthenticated(store.getState())).toBe(true);
    });
    expect(mockAdminApi.refresh).toHaveBeenCalledTimes(1);
  });

  it('3. Failed startup restore on /admin/users redirects to /admin/login?next=... with zero legacy refresh message and returns after login', async () => {
    mockAdminApi.refresh.mockRejectedValue(Object.assign(new Error('Unauthorized'), { statusCode: 401 }));
    mockAdminApi.login.mockResolvedValue({
      token: 'su-logged-jwt',
      role: 'superuser',
      permissions: ['*'],
      name: 'Super User',
      email: 'superuser@teamforge.io',
      admin: {
        id: 'u-superuser',
        email: 'superuser@teamforge.io',
        name: 'Super User',
        role: 'superuser',
        permissions: ['*'],
      },
    });

    const store = createAppStore();
    setupInterceptors(store);

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/admin/users?filter=suspended']}>
          <LocationEcho />
          <App />
        </MemoryRouter>
      </Provider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('location-echo').textContent).toBe(
        '/admin/login?next=%2Fadmin%2Fusers%3Ffilter%3Dsuspended',
      );
    });
    expect(screen.queryByTestId('admin-login-notice')).toBeNull();
    expect(document.body.textContent).not.toContain('Your session ended when the page was refreshed');

    fireEvent.change(screen.getByLabelText(/Admin Email/i), {
      target: { value: 'superuser@teamforge.io' },
    });
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: 'Super@123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Secure Sign In/i }));

    await waitFor(() => {
      expect(screen.getByTestId('location-echo').textContent).toBe('/admin/users?filter=suspended');
    });
  });

  it('4. Startup on non-admin /dashboard calls user bootstrapSession only and never /admin/auth/refresh', async () => {
    const fetchUrls = [];
    globalThis.fetch = vi.fn(async (url) => {
      fetchUrls.push(String(url));
      if (String(url).endsWith('/health')) {
        return new Response(JSON.stringify({ status: 'ok', bootId: 'boot-1' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'X-Boot-Id': 'boot-1' },
        });
      }
      return new Response(JSON.stringify({ code: 'REFRESH_INVALID' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const store = createAppStore();
    setupInterceptors(store);

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/dashboard']}>
          <LocationEcho />
          <App />
        </MemoryRouter>
      </Provider>,
    );

    await waitFor(() => {
      expect(fetchUrls.some((u) => u.endsWith('/health'))).toBe(true);
    });
    expect(fetchUrls.some((u) => u.includes('/admin/auth/refresh'))).toBe(false);
    expect(mockAdminApi.refresh).not.toHaveBeenCalled();
  });

  it('5. Mid-session 401 on /admin/* triggers single-flight POST /admin/auth/refresh, updates Redux token, and retries once', async () => {
    const { apiRequest } = await import('../services/apiClient');
    const store = createAppStore({
      preloadedState: {
        session: {
          portalRole: 'admin',
          isSuperUser: false,
          permissions: ['users'],
          adminUid: 'u-admin',
          adminToken: 'expired-admin-jwt',
          initialized: true,
        },
      },
    });
    setupInterceptors(store);

    const calls = [];
    globalThis.fetch = vi.fn(async (url, init) => {
      calls.push({ url, auth: init?.headers?.Authorization });
      if (String(url).endsWith('/admin/auth/refresh')) {
        return new Response(
          JSON.stringify({
            token: 'rotated-admin-jwt',
            role: 'admin',
            permissions: ['users', 'audit'],
            name: 'Default Admin',
            email: 'admin@teamforge.io',
            admin: {
              id: 'u-admin',
              email: 'admin@teamforge.io',
              name: 'Default Admin',
              role: 'admin',
              permissions: ['users', 'audit'],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (calls.filter((c) => String(c.url).endsWith('/admin/users')).length === 1) {
        return new Response(
          JSON.stringify({ code: 'TOKEN_EXPIRED', message: 'Access token expired' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify([{ id: '2', name: 'Arjun' }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const data = await apiRequest('/admin/users', 'GET', null, { role: 'admin' });
    expect(data).toEqual([{ id: '2', name: 'Arjun' }]);
    expect(calls.filter((c) => String(c.url).endsWith('/admin/auth/refresh'))).toHaveLength(1);
    expect(calls.filter((c) => String(c.url).endsWith('/admin/users')).map((c) => c.auth)).toEqual([
      'Bearer expired-admin-jwt',
      'Bearer rotated-admin-jwt',
    ]);
    expect(store.getState().session.adminToken).toBe('rotated-admin-jwt');
    expect(store.getState().session.permissions).toEqual(['users', 'audit']);
  });

  it('6. logoutAdminPortal calls adminApi.logout() and clears in-memory admin session', async () => {
    const store = createAppStore({
      preloadedState: {
        session: {
          portalRole: 'admin',
          isSuperUser: false,
          permissions: ['*'],
          adminUid: 'u-admin',
          adminToken: 'active-admin-jwt',
          initialized: true,
        },
      },
    });
    setupInterceptors(store);

    await store.dispatch(logoutAdminPortal());
    expect(mockAdminApi.logout).toHaveBeenCalledTimes(1);
    expect(selectIsAdminAuthenticated(store.getState())).toBe(false);
    expect(store.getState().session.adminToken).toBeNull();
  });
});
