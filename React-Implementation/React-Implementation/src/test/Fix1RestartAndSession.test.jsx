import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  apiRequest,
  checkServerBoot,
  resetServerRestartGuard,
  setRestartRedirectHandler,
  setAccessToken,
  SERVER_RESTART_MESSAGE,
} from '../services/apiClient';
import { authApi } from '../services/authApi';
import { store } from '../store';
import { sessionReset } from '../store/actions/appActions';
import {
  consumeNotice,
  setActiveRole,
  setBootId,
  setSession,
} from '../store/slices/sessionSlice';
import {
  selectActiveRole,
  selectAuthLoading,
  selectBootId,
  selectCurrentUser,
  selectSessionNotices,
} from '../store/selectors/sessionSelectors';
import { bootstrapSession, refreshSessionUser } from '../store/thunks/sessionThunks';
import { useVisibilityPoll } from '../hooks/useVisibilityPoll';
import ErrorBoundary from '../components/common/ErrorBoundary';
import { renderWithStore } from './test-utils';

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
    setAccessToken(null);
    resetServerRestartGuard();
    setRestartRedirectHandler(null);
    store.dispatch(sessionReset());
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    setRestartRedirectHandler(null);
  });

  it('1. sessionReset() clears user/admin/role session state cleanly in memory with zero browser storage', () => {
    store.dispatch(
      setSession({
        user: { id: '2', name: 'Test' },
        isAuthenticated: true,
        activeRole: 'Project Owner',
        portalRole: 'admin',
        adminToken: 'tok-admin',
      }),
    );

    store.dispatch(sessionReset());

    expect(selectCurrentUser(store.getState())).toBeNull();
    expect(selectActiveRole(store.getState())).toBe('Collaborator');
    expect(store.getState().session.adminToken).toBeNull();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('2. Three concurrent 401 SESSION_INVALID responses clear Redux session and redirect only ONCE', async () => {
    store.dispatch(
      setSession({
        user: { id: '2', name: 'Tester' },
        isAuthenticated: true,
        activeRole: 'Collaborator',
      }),
    );
    store.dispatch(setBootId('boot-1'));
    store.dispatch(setActiveRole('Project Owner'));
    setAccessToken('stale-jwt');

    const redirectSpy = vi.fn();
    setRestartRedirectHandler(redirectSpy);

    const fetchMock = vi.fn().mockImplementation(() => {
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
    expect(selectSessionNotices(store.getState()).serverRestart).toBe(SERVER_RESTART_MESSAGE);
    store.dispatch(consumeNotice('serverRestart'));
    expect(selectSessionNotices(store.getState()).serverRestart).toBe('');
    expect(selectCurrentUser(store.getState())).toBeNull();
  });

  it('3. Changed bootId on /health clears stale Redux session and redirects once with restart message', async () => {
    store.dispatch(setSession({ user: { id: '3', name: 'Tester' }, isAuthenticated: true }));
    store.dispatch(setBootId('boot-initial'));

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
    expect(selectSessionNotices(store.getState()).serverRestart).toBe(SERVER_RESTART_MESSAGE);
    expect(selectCurrentUser(store.getState())).toBeNull();
    expect(selectBootId(store.getState())).toBe('boot-new');
  });

  it('4. bootstrapSession + refreshSessionUser fetch live user from GET /auth/me into Redux sessionSlice', async () => {
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
      const dispatch = useDispatch();
      const user = useSelector(selectCurrentUser);
      const loading = useSelector(selectAuthLoading);

      useEffect(() => {
        dispatch(bootstrapSession());
      }, [dispatch]);

      if (loading && !user) return <div>loading</div>;
      return (
        <div>
          <span data-testid="auth-name">{user?.name || 'none'}</span>
          <span data-testid="auth-uni">{user?.university || 'none'}</span>
          <button type="button" onClick={() => dispatch(refreshSessionUser())}>
            Refresh
          </button>
        </div>
      );
    };

    renderWithStore(<Harness />, { store });

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

    renderWithStore(<Wrapper />);

    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(pollFn).toHaveBeenCalledTimes(2);

    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    act(() => {
      vi.advanceTimersByTime(9000);
    });
    expect(pollFn).toHaveBeenCalledTimes(2);

    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(pollFn).toHaveBeenCalledTimes(3);

    fireEvent.click(screen.getByText('remount'));
    pollFn.mockClear();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(pollFn).toHaveBeenCalledTimes(1);

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

    renderWithStore(
      <ErrorBoundary>
        <Crasher />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong. Reload the page')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy();
    consoleErrorSpy.mockRestore();
  });
});
