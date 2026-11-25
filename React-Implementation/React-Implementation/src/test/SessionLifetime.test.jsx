import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React, { useContext } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import storage from '../utils/storage.js';
import tokenManager from '../services/tokenManager.js';
import { apiRequest, setAccessToken, clearApiCache, setAuthMode } from '../services/apiClient.js';
import { AuthProvider, AuthContext, useAuth } from '../context/AuthContext.jsx';
import ProtectedRoute from '../routes/ProtectedRoute.jsx';
import { useVisibilityPoll } from '../hooks/useVisibilityPoll.js';

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

describe('Session Lifetime, Silent Refresh & Graceful Logout (7-Day Sessions)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    clearApiCache();
    setAuthMode('jwt');
    setAccessToken(null);
    tokenManager.clear();
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    setAuthMode(null);
  });

  it('1. Token near expiry is refreshed before next request', async () => {
    // Access token expiring in 30 seconds (< 60s window)
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
    expect(storage.getRefreshToken()).toBe('refresh-xyz');
  });

  it('2. A 401 TOKEN_EXPIRED triggers one refresh and one retry', async () => {
    // Start with a non-expired token so pre-flight doesn't proactively refresh it
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
          // Backend answers with 401 TOKEN_EXPIRED
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

  it('4. A failed refresh ends in one graceful logout with session ended notice', async () => {
    tokenManager.setTokens({ accessToken: makeTestJwt(-10), refreshToken: 'invalid-or-expired-ref' });

    const fetchMock = vi.fn().mockImplementation((url) => {
      const urlStr = String(url);
      if (urlStr.includes('/auth/refresh')) {
        return Promise.resolve(createJsonResponse({ code: 'REFRESH_INVALID', message: 'Refresh token has expired.' }, 401));
      }
      return Promise.reject(new Error(`Unexpected url: ${urlStr}`));
    });

    vi.stubGlobal('fetch', fetchMock);

    const logoutEventSpy = vi.fn();
    window.addEventListener('teamforge:force_logout', logoutEventSpy);

    const res = await tokenManager.refresh({ force: true });

    expect(res).toBeNull();
    expect(tokenManager.getAccessToken()).toBeNull();
    expect(storage.getRefreshToken()).toBeFalsy();
    expect(logoutEventSpy).toHaveBeenCalledTimes(1);

    // Single-consumption notice
    storage.setSessionEndedNotice('Your session ended. Please log in again.');
    expect(storage.consumeSessionEndedNotice()).toBe('Your session ended. Please log in again.');
    expect(storage.consumeSessionEndedNotice()).toBe('');

    window.removeEventListener('teamforge:force_logout', logoutEventSpy);
  });

  it('5. During signing_out no page component renders and no console error about null user appears', async () => {
    const errorSpy = vi.spyOn(console, 'error');

    // Component that dereferences user fields without optional chaining
    const StrictUserPage = () => {
      const { user } = useContext(AuthContext);
      return (
        <div data-testid="user-page">
          <span>{user.name}</span>
          <span>{user.id}</span>
        </div>
      );
    };

    let logoutTrigger;
    const ParentControl = () => {
      const { logout, status } = useContext(AuthContext);
      logoutTrigger = logout;
      return (
        <div>
          <span data-testid="auth-status">{status}</span>
          <ProtectedRoute>
            <StrictUserPage />
          </ProtectedRoute>
        </div>
      );
    };

    // Pre-populate authenticated user
    storage.setBackendUserId('2');
    storage.setBootId('boot-test');
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

    render(
      <MemoryRouter initialEntries={['/profile']}>
        <AuthProvider>
          <Routes>
            <Route path="/profile" element={<ParentControl />} />
            <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    // Wait until authenticated and user page rendered
    await screen.findByTestId('user-page');
    expect(screen.getByText('Arjun Sharma')).toBeDefined();

    // Trigger graceful logout
    await act(async () => {
      logoutTrigger({ reason: 'session_expired' });
    });

    // While signing_out, ProtectedRoute replaces user page with loading screen
    expect(screen.queryByTestId('user-page')).toBeNull();

    // Verify no null pointer exceptions logged
    const nullErrors = errorSpy.mock.calls.filter((call) =>
      call.some((arg) => String(arg).includes('Cannot read properties of null') || String(arg).includes('Cannot read property')),
    );
    expect(nullErrors).toHaveLength(0);
  });

  it('6. No poll fires after logout (teamforge:stop_polls)', () => {
    vi.useFakeTimers();
    const pollFn = vi.fn();

    const PollingComponent = () => {
      useVisibilityPoll(pollFn, 2000, {
        enabled: true,
        immediate: false,
        triggerOnVisible: false,
      });
      return <div>polling active</div>;
    };

    render(<PollingComponent />);

    // Advance 2s -> poll fires
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(pollFn).toHaveBeenCalledTimes(1);

    // Dispatch stop_polls event
    act(() => {
      window.dispatchEvent(new CustomEvent('teamforge:stop_polls'));
    });

    // Advance another 10s -> poll should NOT fire again
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(pollFn).toHaveBeenCalledTimes(1);
  });

  it('7. Focus after 20 minute idle renews session without a visible glitch', async () => {
    const expiredToken = makeTestJwt(-100); // already expired
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

    // Trigger focus event simulating user returning to tab after 20 minutes
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(refreshCalled).toBe(true);
    expect(tokenManager.getAccessToken()).toBe(freshToken);
  });
});
