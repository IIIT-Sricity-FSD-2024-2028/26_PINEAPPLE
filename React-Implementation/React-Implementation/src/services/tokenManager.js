import {
  dispatchFromInterceptor,
  getStateFromInterceptor,
} from '../store/utils/setupInterceptors.js';
import { navigateWithAppRouter } from '../routes/navigationRef.js';
import { sessionReset } from '../store/actions/appActions.js';
import {
  setAccessTokenState,
  setBootId as setBootIdAction,
  setSuspendedInfo,
} from '../store/slices/sessionSlice.js';

let inMemoryAccessToken = null;
let inMemoryRefreshToken = null;
let inMemoryBootId = null;
let tokenExpiresAtMs = null;
let singleFlightRefreshPromise = null;
let isRefreshScheduled = false;

function decodeJwtExp(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const base64Url = parts[1];
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    const parsed = JSON.parse(jsonPayload);
    if (parsed && typeof parsed.exp === 'number') {
      return parsed.exp * 1000;
    }
  } catch {
    // If decoding fails, return null
  }
  return null;
}

export const tokenManager = {
  getAccessToken() {
    return inMemoryAccessToken;
  },

  setAccessToken(token) {
    inMemoryAccessToken = token || null;
    if (inMemoryAccessToken) {
      tokenExpiresAtMs = decodeJwtExp(inMemoryAccessToken);
    } else {
      tokenExpiresAtMs = null;
    }
  },

  getRefreshToken() {
    return inMemoryRefreshToken;
  },

  setTokens({ accessToken, refreshToken }) {
    this.setAccessToken(accessToken);
    if (refreshToken !== undefined) {
      inMemoryRefreshToken = refreshToken || null;
    }
  },

  getBootId() {
    return getStateFromInterceptor()?.session?.bootId || inMemoryBootId;
  },

  setBootId(bootId) {
    inMemoryBootId = bootId ? String(bootId) : null;
    dispatchFromInterceptor(setBootIdAction(inMemoryBootId));
  },

  getExpiresAt() {
    return tokenExpiresAtMs;
  },

  isNearExpiry(windowSeconds = 60) {
    if (!inMemoryAccessToken) return true;
    if (!tokenExpiresAtMs) return false;
    const now = Date.now();
    return now + windowSeconds * 1000 >= tokenExpiresAtMs;
  },

  hasRefreshToken() {
    return Boolean(inMemoryRefreshToken);
  },

  async refresh(options = {}) {
    const { force = false, apiBaseUrl = 'http://localhost:3000' } = options;

    if (!force && !this.isNearExpiry(60) && inMemoryAccessToken) {
      return inMemoryAccessToken;
    }

    if (singleFlightRefreshPromise) {
      return singleFlightRefreshPromise;
    }

    singleFlightRefreshPromise = (async () => {
      try {
        const storedRefreshToken = inMemoryRefreshToken;
        const sessionState = getStateFromInterceptor()?.session;
        const hadPriorSession = Boolean(
          storedRefreshToken ||
            inMemoryAccessToken ||
            sessionState?.isAuthenticated,
        );
        const envBase =
          typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL
            ? import.meta.env.VITE_API_BASE_URL
            : '';
        const base = (
          typeof window !== 'undefined' && window.TEAMFORGE_API_BASE_URL
            ? window.TEAMFORGE_API_BASE_URL
            : envBase || apiBaseUrl
        ).replace(/\/+$/, '');

        const res = await fetch(`${base}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            refreshToken: storedRefreshToken || undefined,
          }),
        });

        const bootHeader = res.headers?.get?.('x-boot-id') || res.headers?.get?.('X-Boot-Id');
        const knownBootId = this.getBootId();
        if (bootHeader && knownBootId && bootHeader !== knownBootId) {
          this.setBootId(bootHeader);
          if (hadPriorSession) {
            dispatchFromInterceptor(
              sessionReset({
                bootId: bootHeader,
                notices: {
                  serverRestart: 'The server was restarted. Please log in again.',
                },
              }),
            );
            this.clear();
          }
          return null;
        }

        if (res.ok) {
          const data = await res.json();
          const newAccessToken = data.accessToken || null;
          const newRefreshToken = data.refreshToken || storedRefreshToken;
          this.setTokens({ accessToken: newAccessToken, refreshToken: newRefreshToken });
          dispatchFromInterceptor(setAccessTokenState(newAccessToken));
          return newAccessToken;
        }

        if (res.status === 403) {
          const errData = await res.json().catch(() => null);
          if (errData?.code === 'ACCOUNT_SUSPENDED') {
            dispatchFromInterceptor(setSuspendedInfo(errData));
            dispatchFromInterceptor(sessionReset({ suspendedInfo: errData }));
            if (
              typeof window !== 'undefined' &&
              window.location.pathname !== '/suspended' &&
              window.location.pathname !== '/login'
            ) {
              navigateWithAppRouter('/suspended', { replace: true });
            }
          }
          this.clear();
          return null;
        }

        if (res.status === 401) {
          const errData = await res.json().catch(() => null);
          if (hadPriorSession) {
            const notices =
              errData?.code === 'SESSION_INVALID'
                ? {
                    serverRestart:
                      errData.message || 'The server was restarted. Please log in again.',
                  }
                : {
                    sessionEnded: 'Your session ended. Please log in again.',
                  };
            dispatchFromInterceptor(sessionReset({ notices }));
            this.clear();
          }
          return null;
        }

        return null;
      } catch (err) {
        console.warn('[tokenManager] Silent refresh network/unexpected error:', err?.message || err);
        return null;
      } finally {
        singleFlightRefreshPromise = null;
      }
    })();

    return singleFlightRefreshPromise;
  },

  clear() {
    inMemoryAccessToken = null;
    inMemoryRefreshToken = null;
    tokenExpiresAtMs = null;
    singleFlightRefreshPromise = null;
  },

  initListeners() {
    if (isRefreshScheduled || typeof window === 'undefined') return;
    isRefreshScheduled = true;

    const handleCheckAndRenew = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (this.hasRefreshToken() && this.isNearExpiry(60)) {
        this.refresh().catch(() => {});
      }
    };

    window.addEventListener('focus', handleCheckAndRenew);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleCheckAndRenew);
    }
  },
};

export default tokenManager;
