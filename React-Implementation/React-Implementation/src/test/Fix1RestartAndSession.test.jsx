import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { useContext, useState } from 'react';
import storage from '../utils/storage';
import {
  apiRequest,
  checkServerBoot,
  resetServerRestartGuard,
  setRestartRedirectHandler,
  setAccessToken,
  SERVER_RESTART_MESSAGE,
} from '../services/apiClient';
import { authApi } from '../services/authApi';
import { AuthProvider, AuthContext } from '../context/AuthContext';
import { useVisibilityPoll } from '../hooks/useVisibilityPoll';
import ErrorBoundary from '../components/common/ErrorBoundary';

vi.mock('../services/apiClient', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getAuthMode: () => 'jwt',
  };
});

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((_auth, cb) => {
    cb(null);
    return () => {};
  }),
  signOut: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/firebase.js', () => ({
  auth: {
    currentUser: null,
  },
}));

describe('FIX 1: Server Restart Detection, Single-Source Auth & Visibility Polling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    setAccessToken(null);
    resetServerRestartGuard();
    setRestartRedirectHandler(null);
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    setRestartRedirectHandler(null);
  });

  it('1. storage.clearAll() removes all app user/admin/session/cache/config keys', () => {
    localStorage.setItem('teamforge.apiBaseUrl', 'http://localhost:3001');
    localStorage.setItem('teamforge.backendUserId', '2');
    localStorage.setItem('teamforge.currentUser', '{"id":"2"}');
    localStorage.setItem('teamforge.userProfile_2', '{"fullName":"Old"}');
    localStorage.setItem('teamforge.bootId', 'boot-old');
    localStorage.setItem('teamforge.role', 'Owner');
    sessionStorage.setItem('teamforge.adminToken', 'tok-admin');
    sessionStorage.setItem('isSuperUser', 'true');

    storage.clearAll();

    expect(localStorage.getItem('teamforge.backendUserId')).toBeNull();
    expect(localStorage.getItem('teamforge.currentUser')).toBeNull();
    expect(localStorage.getItem('teamforge.userProfile_2')).toBeNull();
    expect(localStorage.getItem('teamforge.bootId')).toBeNull();
    expect(localStorage.getItem('teamforge.role')).toBeNull();
    expect(localStorage.getItem('teamforge.apiBaseUrl')).toBeNull();
    expect(sessionStorage.getItem('teamforge.adminToken')).toBeNull();
    expect(sessionStorage.getItem('isSuperUser')).toBeNull();
  });

  it('2. Three concurrent 401 SESSION_INVALID responses clear storage and redirect only ONCE', async () => {
    storage.setBackendUserId('2');
    storage.setBootId('boot-1');
    storage.setRole('Collaborator');
    setAccessToken('stale-jwt');

    const redirectSpy = vi.fn();
    setRestartRedirectHandler(redirectSpy);

    const fetchMock = vi.fn().mockImplementation((url) => {
      if (String(url).includes('/auth/refresh')) {
        return Promise.resolve({
          ok: false,
          status: 401,
          headers: new Headers({ 'X-Boot-Id': 'boot-2' }),
          json: async () => ({ code: 'SESSION_INVALID', message: SERVER_RESTART_MESSAGE }),
        });
      }
      return Promise.resolve({
        ok: false,
        status: 401,
        headers: new Headers({ 'X-Boot-Id': 'boot-2' }),
        json: async () => ({ code: 'SESSION_INVALID', message: SERVER_RESTART_MESSAGE }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const results = await Promise.allSettled([
      apiRequest('/projects', 'GET'),
      apiRequest('/notifications', 'GET'),
      apiRequest('/users/me', 'GET'),
    ]);

    expect(results.every((r) => r.status === 'rejected')).toBe(true);
    expect(redirectSpy).toHaveBeenCalledTimes(1);
    expect(redirectSpy).toHaveBeenCalledWith('/login');
    expect(storage.consumeServerRestartNotice()).toBe(SERVER_RESTART_MESSAGE);
    expect(storage.getBackendUserId()).toBe('');
    expect(storage.getRole()).toBe('');
  });

  it('3. Changed bootId on /health clears stale browser state and redirects once with restart message', async () => {
    storage.setBackendUserId('3');
    storage.setBootId('boot-initial');

    const redirectSpy = vi.fn();
    setRestartRedirectHandler(redirectSpy);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'X-Boot-Id': 'boot-new' }),
        json: async () => ({ status: 'ok', bootId: 'boot-new', startedAt: new Date().toISOString() }),
      }),
    );

    const healthRes = await checkServerBoot();
    expect(healthRes?.restarted).toBe(true);
    expect(redirectSpy).toHaveBeenCalledTimes(1);
    expect(redirectSpy).toHaveBeenCalledWith('/login');
    expect(storage.consumeServerRestartNotice()).toBe(SERVER_RESTART_MESSAGE);
    expect(storage.getBackendUserId()).toBe('');
    expect(storage.getBootId()).toBe('boot-new');
  });

  it('4. AuthContext fetches live user from GET /auth/me (ignoring cached localStorage currentUser) and supports refreshUser()', async () => {
    localStorage.setItem(
      'teamforge.currentUser',
      JSON.stringify({ id: '999', name: 'Stale Cached User', email: 'stale@test.dev' }),
    );
    localStorage.setItem('teamforge.userProfile_2', JSON.stringify({ fullName: 'Stale Profile Copy' }));

    vi.spyOn(authApi, 'refresh').mockResolvedValue({ accessToken: 'fresh-jwt-token' });
    const getMeSpy = vi
      .spyOn(authApi, 'getMe')
      .mockResolvedValueOnce({
        id: '2',
        uid: '2',
        email: 'arjun@teamforge.io',
        name: 'Arjun Live',
        username: 'arjun_live',
        role: 'Collaborator',
        university: 'IIT Bombay',
        profileComplete: true,
      })
      .mockResolvedValueOnce({
        id: '2',
        uid: '2',
        email: 'arjun@teamforge.io',
        name: 'Arjun Updated',
        username: 'arjun_live',
        role: 'Owner',
        university: 'IIT Delhi',
        profileComplete: true,
      });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'X-Boot-Id': 'boot-same' }),
        json: async () => ({ status: 'ok', bootId: 'boot-same', startedAt: new Date().toISOString() }),
      }),
    );

    const Harness = () => {
      const { user, loading, refreshUser } = useContext(AuthContext);
      if (loading) return <div>loading</div>;
      return (
        <div>
          <span data-testid="auth-name">{user?.name || 'none'}</span>
          <span data-testid="auth-uni">{user?.university || 'none'}</span>
          <button type="button" onClick={() => refreshUser()}>
            Refresh
          </button>
        </div>
      );
    };

    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-name').textContent).toBe('Arjun Live');
    });
    expect(screen.getByTestId('auth-uni').textContent).toBe('IIT Bombay');
    expect(getMeSpy).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Refresh'));

    await waitFor(() => {
      expect(screen.getByTestId('auth-name').textContent).toBe('Arjun Updated');
    });
    expect(screen.getByTestId('auth-uni').textContent).toBe('IIT Delhi');
    expect(getMeSpy).toHaveBeenCalledTimes(2);
  });

  it('5. useVisibilityPoll pauses when tab is hidden, stops on unmount, and never doubles on remount', () => {
    vi.useFakeTimers();
    const pollFn = vi.fn();

    const Poller = ({ tickMs = 3000 }) => {
      useVisibilityPoll(pollFn, tickMs, {
        enabled: true,
        immediate: false,
        triggerOnVisible: true,
        visibleCooldownMs: 0,
      });
      return <div>polling</div>;
    };

    const Wrapper = () => {
      const [shown, setShown] = useState(true);
      const [key, setKey] = useState(1);
      return (
        <div>
          <button type="button" onClick={() => setShown((s) => !s)}>
            toggle
          </button>
          <button type="button" onClick={() => setKey((k) => k + 1)}>
            remount
          </button>
          {shown ? <Poller key={key} /> : null}
        </div>
      );
    };

    render(<Wrapper />);

    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(pollFn).toHaveBeenCalledTimes(2);

    // Tab goes hidden -> interval skips firing
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    act(() => {
      vi.advanceTimersByTime(9000);
    });
    expect(pollFn).toHaveBeenCalledTimes(2);

    // Tab becomes visible again -> triggers once and resumes normal cadence
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(pollFn).toHaveBeenCalledTimes(3);

    // Remount does not stack intervals (only 1 call per 3s, not 2)
    fireEvent.click(screen.getByText('remount'));
    pollFn.mockClear();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(pollFn).toHaveBeenCalledTimes(1);

    // Unmount stops all future polling
    fireEvent.click(screen.getByText('toggle'));
    pollFn.mockClear();
    act(() => {
      vi.advanceTimersByTime(12000);
    });
    expect(pollFn).not.toHaveBeenCalled();
  });

  it('6. ErrorBoundary shows "Something went wrong. Reload the page" and "Reload" button on crash', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const Crasher = () => {
      throw new Error('Synthetic render crash');
    };

    render(
      <ErrorBoundary>
        <Crasher />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong. Reload the page')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy();
    consoleErrorSpy.mockRestore();
  });
});
