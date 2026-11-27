import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, act } from '@testing-library/react';
import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import tokenManager from '../services/tokenManager.js';
import { apiRequest, setAccessToken, setAuthMode } from '../services/apiClient.js';
import { store } from '../store';
import { sessionReset } from '../store/actions/appActions.js';
import { consumeNotice, setBootId, setNotice, setSessionStatus } from '../store/slices/sessionSlice.js';
import {
  selectAuthStatus,
  selectCurrentUser,
  selectSessionNotices,
} from '../store/selectors/sessionSelectors.js';
import { bootstrapSession, logoutSessionUser } from '../store/thunks/sessionThunks.js';
import ProtectedRoute from '../routes/ProtectedRoute.jsx';
import { useVisibilityPoll } from '../hooks/useVisibilityPoll.js';
import { renderWithStore } from './test-utils.jsx';

function base64UrlEncode(str) {
  const b64 = typeof btoa !== 'undefined'
    ? btoa(str)
    : Buffer.from(str).toString('base64');
  return b64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function makeTestJwt(expInSecondsFromNow) {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const nowSec = Math.floor(Date.now() / 1000);
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: '2',
      exp: nowSec + expInSecondsFromNow,
      iat: nowSec,
      role: 'collaborator',
    }),
  );
  return `${header}.${payload}.mock_sig`;
}

function createJsonResponse(data, status = 200, headers = {}) {
  const jsonStr = JSON.stringify(data);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: async () => data,
    text: async () => jsonStr,
    clone() {
      return createJsonResponse(data, status, headers);
    },
  };
}

vi.mock('../services/apiClient.js', async (importOriginal) => {
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

describe('Session Lifetime, Silent Refresh & Graceful Logout (In-Memory Redux)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAuthMode('jwt');
    setAccessToken(null);
    tokenManager.clear();
    store.dispatch(sessionReset());
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    setAuthMode(null);
  });

  it('1. Token near expiry is refreshed before next request (in-memory only)', async () => {
    const nearExpiryToken = makeTestJwt(30);
    const freshToken = makeTestJwt(900);
    setAccessToken(nearExpiryToken);
    tokenManager.setTokens({ accessToken: nearExpiryToken, refreshToken: 'refresh-abc' });

    expect(tokenManager.isNearExpiry(60)).toBe(true);

    const callOrder = [];
    const fetchMock = vi.fn().mockImplementation((url, options) => {
      const urlStr = String(url);
      if (urlStr.includes('/auth/refresh')) {
        callOrder.push('refresh');
        return Promise.resolve(createJsonResponse({ accessToken: freshToken, refreshToken: 'refresh-xyz' }));
      }
      if (urlStr.includes('/projects')) {
        callOrder.push('projects');
        const authHeader = options?.headers?.['Authorization'] || options?.headers?.['authorization'];
        return Promise.resolve(createJsonResponse({ projects: [{ id: 'p1', title: 'Test Project' }], authUsed: authHeader }));
      }
      return Promise.reject(new Error(`Unexpected url: ${urlStr}`));
    });

    vi.stubGlobal('fetch', fetchMock);

    const result = await apiRequest('/projects', 'GET');

    expect(callOrder).toEqual(['refresh', 'projects']);
    expect(result.authUsed).toBe(`Bearer ${freshToken}`);
    expect(tokenManager.getAccessToken()).toBe(freshToken);
    expect(tokenManager.getRefreshToken()).toBe('refresh-xyz');
  });

  it('2. A 401 TOKEN_EXPIRED triggers one refresh and one retry', async () => {
    const initialToken = makeTestJwt(900);
    const freshToken = makeTestJwt(900);
    setAccessToken(initialToken);
    tokenManager.setTokens({ accessToken: initialToken, refreshToken: 'refresh-valid' });

    let projectCalls = 0;
    const fetchMock = vi.fn().mockImplementation((url) => {
      const urlStr = String(url);
      if (urlStr.includes('/tasks')) {
        projectCalls++;
        if (projectCalls === 1) {
          return Promise.resolve(createJsonResponse({ code: 'TOKEN_EXPIRED', message: 'Access token has expired.' }, 401));
        }
        return Promise.resolve(createJsonResponse({ success: true, retryWorked: true }, 200));
      }
      if (urlStr.includes('/auth/refresh')) {
        return Promise.resolve(createJsonResponse({ accessToken: freshToken, refreshToken: 'refresh-rotated' }, 200));
      }
      return Promise.reject(new Error(`Unexpected url: ${urlStr}`));
    });

    vi.stubGlobal('fetch', fetchMock);

    const result = await apiRequest('/tasks', 'GET');

    expect(projectCalls).toBe(2);
    expect(result.retryWorked).toBe(true);
    expect(tokenManager.getAccessToken()).toBe(freshToken);
  });

  it('3. Ten parallel requests cause only one refresh (single-flight deduplication)', async () => {
    tokenManager.setTokens({ accessToken: null, refreshToken: 'refresh-parallel' });
    const freshToken = makeTestJwt(900);

    let refreshFetchCount = 0;
    const fetchMock = vi.fn().mockImplementation((url) => {
      const urlStr = String(url);
      if (urlStr.includes('/auth/refresh')) {
        refreshFetchCount++;
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(createJsonResponse({ accessToken: freshToken, refreshToken: 'refresh-new' }));
          }, 30);
        });
      }
      return Promise.reject(new Error(`Unexpected url: ${urlStr}`));
    });

    vi.stubGlobal('fetch', fetchMock);

    const promises = Array.from({ length: 10 }, () => tokenManager.refresh({ force: true }));
    const results = await Promise.all(promises);

    expect(refreshFetchCount).toBe(1);
    expect(results).toHaveLength(10);
    results.forEach((token) => expect(token).toBe(freshToken));
  });

  it('4. A failed refresh ends in one graceful Redux sessionReset with sessionEnded notice', async () => {
    tokenManager.setTokens({ accessToken: makeTestJwt(-10), refreshToken: 'invalid-or-expired-ref' });

    const fetchMock = vi.fn().mockImplementation((url) => {
      const urlStr = String(url);
      if (urlStr.includes('/auth/refresh')) {
        return Promise.resolve(createJsonResponse({ code: 'REFRESH_INVALID', message: 'Refresh token has expired.' }, 401));
      }
      return Promise.reject(new Error(`Unexpected url: ${urlStr}`));
    });

    vi.stubGlobal('fetch', fetchMock);

    const res = await tokenManager.refresh({ force: true });

    expect(res).toBeNull();
    expect(tokenManager.getAccessToken()).toBeNull();
    expect(tokenManager.getRefreshToken()).toBeNull();
    expect(selectCurrentUser(store.getState())).toBeNull();
    expect(selectSessionNotices(store.getState()).sessionEnded).toBeTruthy();

    store.dispatch(setNotice({ key: 'sessionEnded', message: 'Your session ended. Please log in again.' }));
    expect(selectSessionNotices(store.getState()).sessionEnded).toBe('Your session ended. Please log in again.');
    store.dispatch(consumeNotice('sessionEnded'));
    expect(selectSessionNotices(store.getState()).sessionEnded).toBe('');
  });

  it('5. During signing_out no page component renders and no console error about null user appears', async () => {
    const errorSpy = vi.spyOn(console, 'error');

    const StrictUserPage = () => {
      const user = useSelector(selectCurrentUser);
      return (
        <div data-testid="user-page">
          <span>{user.name}</span>
          <span>{user.id}</span>
        </div>
      );
    };

    let logoutTrigger;
    const ParentControl = () => {
      const dispatch = useDispatch();
      const status = useSelector(selectAuthStatus);
      logoutTrigger = (opts) => dispatch(logoutSessionUser(opts));

      useEffect(() => {
        dispatch(bootstrapSession());
      }, [dispatch]);

      return (
        <div>
          <span data-testid="auth-status">{status}</span>
          <ProtectedRoute>
            <StrictUserPage />
          </ProtectedRoute>
        </div>
      );
    };

    store.dispatch(setBootId('boot-test'));
    store.dispatch(setSessionStatus({ status: 'loading', loading: true }));
    const validToken = makeTestJwt(900);
    setAccessToken(validToken);
    tokenManager.setTokens({ accessToken: validToken, refreshToken: 'ref-ok' });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url) => {
        const urlStr = String(url);
        if (urlStr.includes('/health')) {
          return Promise.resolve(
            createJsonResponse({ status: 'ok', bootId: 'boot-test' }, 200, { 'x-boot-id': 'boot-test' }),
          );
        }
        if (urlStr.includes('/auth/refresh')) {
          return Promise.resolve(
            createJsonResponse({ accessToken: validToken, refreshToken: 'ref-ok' }, 200, { 'x-boot-id': 'boot-test' }),
          );
        }
        if (urlStr.includes('/auth/me')) {
          return Promise.resolve(
            createJsonResponse({ id: '2', uid: '2', name: 'Arjun Sharma', role: 'collaborator', email: 'arjun@teamforge.io' }, 200, { 'x-boot-id': 'boot-test' }),
          );
        }
        return Promise.resolve(createJsonResponse({}));
      }),
    );

    renderWithStore(
      <Routes>
        <Route path="/profile" element={<ParentControl />} />
        <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
      </Routes>,
      { route: '/profile', store },
    );

    await screen.findByTestId('user-page');
    expect(screen.getByText('Arjun Sharma')).toBeDefined();

    await act(async () => {
      logoutTrigger({ reason: 'session_expired' });
    });

    expect(screen.queryByTestId('user-page')).toBeNull();

    const nullErrors = errorSpy.mock.calls.filter((call) =>
      call.some((arg) => String(arg).includes('Cannot read properties of null') || String(arg).includes('Cannot read property')),
    );
    expect(nullErrors).toHaveLength(0);
  });

  it('6. No poll fires after logout / enabled=false (without DOM events)', () => {
    vi.useFakeTimers();
    const pollFn = vi.fn();

    const PollingComponent = ({ active }) => {
      useVisibilityPoll(pollFn, 2000, {
        enabled: active,
        immediate: false,
        triggerOnVisible: false,
      });
      return <div>polling</div>;
    };

    const { rerender } = renderWithStore(<PollingComponent active={true} />);

    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(pollFn).toHaveBeenCalledTimes(3);

    rerender(<PollingComponent active={false} />);

    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(pollFn).toHaveBeenCalledTimes(3);
  });

  it('7. Focus after 20 minute idle renews session without a visible glitch', async () => {
    const expiredToken = makeTestJwt(-100);
    const freshToken = makeTestJwt(900);
    setAccessToken(expiredToken);
    tokenManager.setTokens({ accessToken: expiredToken, refreshToken: 'ref-idle' });

    let refreshCalled = false;
    const fetchMock = vi.fn().mockImplementation((url) => {
      const urlStr = String(url);
      if (urlStr.includes('/auth/refresh')) {
        refreshCalled = true;
        return Promise.resolve(createJsonResponse({ accessToken: freshToken, refreshToken: 'ref-new-idle' }));
      }
      return Promise.reject(new Error(`Unexpected url: ${urlStr}`));
    });

    vi.stubGlobal('fetch', fetchMock);

    tokenManager.initListeners();

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(refreshCalled).toBe(true);
    expect(tokenManager.getAccessToken()).toBe(freshToken);
  });
});
