import storage from '../utils/storage.js';

let inMemoryAccessToken = null;
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
      return parsed.exp * 1000; // convert to ms
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
    return storage.getRefreshToken();
  },

  setTokens({ accessToken, refreshToken }) {
    this.setAccessToken(accessToken);
    if (refreshToken !== undefined) {
      storage.setRefreshToken(refreshToken);
    }
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
    return Boolean(storage.getRefreshToken());
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
        const storedRefreshToken = storage.getRefreshToken();
        const hadPriorSession = this.hasRefreshToken() || Boolean(inMemoryAccessToken) || storage.hasStoredSessionKeys();
        const base = (
          typeof window !== 'undefined' && window.TEAMFORGE_API_BASE_URL
            ? window.TEAMFORGE_API_BASE_URL
            : storage.getApiBaseUrl() || apiBaseUrl
        ).replace(/\/+$/, '');

        const res = await fetch(`${base}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            refreshToken: storedRefreshToken || undefined,
          }),
        });

        // Inspect boot header if server restarted
        const bootHeader = res.headers?.get?.('x-boot-id') || res.headers?.get?.('X-Boot-Id');
        const storedBootId = storage.getBootId();
        if (bootHeader && storedBootId && bootHeader !== storedBootId) {
          storage.setBootId(bootHeader);
          if (hadPriorSession) {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('teamforge:session_invalid', {
                  detail: {
                    code: 'SESSION_INVALID',
                    message: 'The server was restarted. Please log in again.',
                  },
                }),
              );
            }
            this.clear();
          }
          return null;
        }

        if (res.ok) {
          const data = await res.json();
          const newAccessToken = data.accessToken || null;
          const newRefreshToken = data.refreshToken || storedRefreshToken;
          this.setTokens({ accessToken: newAccessToken, refreshToken: newRefreshToken });
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('teamforge:token_refreshed', { detail: data }));
          }
          return newAccessToken;
        }

        if (res.status === 403) {
          const errData = await res.json().catch(() => null);
          if (errData?.code === 'ACCOUNT_SUSPENDED') {
            if (typeof window !== 'undefined') {
              try {
                sessionStorage.setItem('teamforge_suspended_info', JSON.stringify(errData));
              } catch {
                // ignore
              }
              window.dispatchEvent(
                new CustomEvent('teamforge:account_suspended', {
                  detail: errData,
                }),
              );
              if (window.location.pathname !== '/suspended' && window.location.pathname !== '/login') {
                window.location.assign('/suspended');
              }
            }
          }
          this.clear();
          return null;
        }

        if (res.status === 401) {
          const errData = await res.json().catch(() => null);
          if (errData?.code === 'SESSION_INVALID') {
            if (hadPriorSession && typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('teamforge:session_invalid', {
                  detail: {
                    code: 'SESSION_INVALID',
                    message: errData.message || 'The server was restarted. Please log in again.',
                  },
                }),
              );
            }
          } else {
            // Expired or invalid refresh token -> trigger graceful logout ONLY if user had an existing session
            if (hadPriorSession && typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('teamforge:force_logout', {
                  detail: {
                    reason: 'session_expired',
                    message: 'Your session ended. Please log in again.',
                  },
                }),
              );
            }
          }
          if (hadPriorSession) {
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
    tokenExpiresAtMs = null;
    singleFlightRefreshPromise = null;
    storage.clearRefreshToken();
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
    document.addEventListener('visibilitychange', handleCheckAndRenew);
  },
};

export default tokenManager;
