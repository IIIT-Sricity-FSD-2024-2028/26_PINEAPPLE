import { signOut as fbSignOut } from 'firebase/auth';
import { auth } from './firebase.js';
import tokenManager from './tokenManager.js';
import {
  notifyAdminSessionRefreshed,
  runSingleFlightAdminRefresh,
  setAdminRefreshRequester,
} from './adminTokenManager.js';
import { navigateWithAppRouter } from '../routes/navigationRef.js';
import {
  dispatchFromInterceptor,
  getStateFromInterceptor,
} from '../store/utils/setupInterceptors.js';
import { setMaintenance, setResettingBanner } from '../store/slices/uiSlice.js';
import {
  setBootId as setBootIdAction,
  setSuspendedInfo,
} from '../store/slices/sessionSlice.js';
import { sessionReset } from '../store/actions/appActions.js';

export const SERVER_RESTART_MESSAGE = 'The server was restarted. Please log in again.';

export { tokenManager };

function resolveApiBaseUrl() {
  const configuredBase =
    typeof window !== "undefined" && typeof window.TEAMFORGE_API_BASE_URL === "string"
      ? window.TEAMFORGE_API_BASE_URL
      : "";
  const envBase = typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL
    ? import.meta.env.VITE_API_BASE_URL
    : "";
  const rawBase = configuredBase || envBase || "http://localhost:3000";
  return String(rawBase).replace(/\/+$/, "");
}

const API_BASE_URL = resolveApiBaseUrl();

let authModeOverride = null;

export function setAuthMode(mode) {
  authModeOverride = mode;
}

export function getAuthMode() {
  if (authModeOverride) return authModeOverride;
  if (typeof window !== 'undefined' && window.__TEAMFORGE_AUTH_MODE__) {
    return window.__TEAMFORGE_AUTH_MODE__;
  }
  const configured = typeof import.meta !== "undefined" && import.meta.env?.VITE_AUTH_MODE;
  if (configured) {
    const mode = String(configured).trim().toLowerCase();
    if (mode === 'firebase' || mode === 'legacy') return mode;
  }
  return 'jwt';
}

function normalizeRole(role) {
  const normalized = String(role || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");
  if (["project-owner", "owner", "projectowner"].includes(normalized)) {
    return "project-owner";
  }
  if (
    [
      "admin",
      "administrator",
      "portal-admin",
      "portaladmin",
      "super-admin",
      "finance-admin",
    ].includes(normalized)
  ) {
    return "admin";
  }
  if (["superuser", "super-user"].includes(normalized)) {
    return "superuser";
  }
  if (["mentor"].includes(normalized)) {
    return "mentor";
  }
  if (["collaborator", "collab", "member"].includes(normalized)) {
    return "collaborator";
  }
  if (["user"].includes(normalized)) {
    return "user";
  }
  return normalized;
}

// In-memory access token storage (never written to browser storage)
let inMemoryAccessToken = null;
let inMemoryBootId = null;
let restartRedirectInFlight = false;
let customRestartRedirectHandler = null;

export function setRestartRedirectHandler(handler) {
  customRestartRedirectHandler = typeof handler === 'function' ? handler : null;
}

export function resetServerRestartGuard() {
  restartRedirectInFlight = false;
}

export function setAccessToken(token) {
  inMemoryAccessToken = token || null;
  tokenManager.setAccessToken(token);
  if (token) {
    restartRedirectInFlight = false;
  }
}

export function getAccessToken() {
  return tokenManager.getAccessToken() || inMemoryAccessToken;
}

function getKnownBootId() {
  return getStateFromInterceptor()?.session?.bootId || inMemoryBootId || null;
}

function storeBootId(bootId) {
  inMemoryBootId = bootId ? String(bootId) : null;
  tokenManager.setBootId(inMemoryBootId);
  dispatchFromInterceptor(setBootIdAction(inMemoryBootId));
}

function hasActiveAppSession() {
  if (tokenManager.getAccessToken() || inMemoryAccessToken) return true;
  if (tokenManager.hasRefreshToken()) return true;
  const session = getStateFromInterceptor()?.session;
  if (session?.isAuthenticated || session?.portalRole) return true;
  try {
    if (getAuthMode() === 'firebase' && auth?.currentUser) return true;
  } catch {
    // ignore firebase probe error
  }
  return false;
}

export function handleServerRestart(nextBootId = null) {
  if (restartRedirectInFlight) return;
  restartRedirectInFlight = true;

  inMemoryAccessToken = null;
  tokenManager.clear();
  if (nextBootId) {
    inMemoryBootId = String(nextBootId);
    tokenManager.setBootId(inMemoryBootId);
  }
  dispatchFromInterceptor(
    sessionReset({
      bootId: nextBootId ? String(nextBootId) : inMemoryBootId,
      notices: { serverRestart: SERVER_RESTART_MESSAGE },
    }),
  );

  if (typeof window !== 'undefined') {
    try {
      if (getAuthMode() === 'firebase' && auth?.currentUser) {
        fbSignOut(auth).catch(() => {});
      }
    } catch {
      // ignore firebase signout errors
    }

    if (customRestartRedirectHandler) {
      customRestartRedirectHandler('/login');
    } else if (window.location.pathname !== '/login') {
      navigateWithAppRouter('/login', { replace: true });
    }
  }
}

function inspectBootHeader(response, options = {}) {
  const responseBootId =
    response?.headers?.get?.('X-Boot-Id') ||
    response?.headers?.get?.('x-boot-id') ||
    null;
  if (!responseBootId) return { restarted: false, bootId: null };

  // Public auth endpoints (/auth/login, /auth/signup, etc.) must NEVER trigger restart cleanup.
  if (options.isPublicAuth) {
    storeBootId(responseBootId);
    return { restarted: false, bootId: responseBootId };
  }

  const knownBootId = getKnownBootId();
  if (knownBootId && knownBootId !== responseBootId) {
    const hadSession = options.assumeSession || hasActiveAppSession();
    if (hadSession) {
      handleServerRestart(responseBootId);
      const err = new Error(SERVER_RESTART_MESSAGE);
      err.statusCode = 401;
      err.code = 'SESSION_INVALID';
      return { restarted: true, bootId: responseBootId, error: err };
    }
  }
  storeBootId(responseBootId);
  return { restarted: false, bootId: responseBootId };
}

export async function checkServerBoot() {
  try {
    const res = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      credentials: 'include',
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    const bootId =
      data?.bootId ||
      res.headers?.get?.('X-Boot-Id') ||
      res.headers?.get?.('x-boot-id') ||
      null;
    if (!bootId) return data;

    const knownBootId = getKnownBootId();
    if (knownBootId && knownBootId !== bootId && hasActiveAppSession()) {
      handleServerRestart(bootId);
      return { ...data, bootId, restarted: true };
    }

    storeBootId(bootId);
    return { ...data, bootId, restarted: false };
  } catch {
    return null;
  }
}

setAdminRefreshRequester(() => executeApiRequest('/admin/auth/refresh', 'POST', {}));

async function getFreshToken(forceRefresh = false, isPortal = false) {
  const mode = getAuthMode();
  if (mode === 'legacy') return null;

  const session = getStateFromInterceptor()?.session;
  const adminToken = session?.adminToken;
  const isCleanAdminToken = adminToken && adminToken !== 'mock_admin_token';

  const isAdminLocation =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');

  if ((isPortal || isAdminLocation) && isCleanAdminToken && !forceRefresh) {
    return adminToken;
  }

  if (isPortal || isAdminLocation) {
    if (forceRefresh) {
      try {
        const refreshed = await runSingleFlightAdminRefresh();
        if (refreshed?.token) {
          notifyAdminSessionRefreshed(refreshed);
          return refreshed.token;
        }
        notifyAdminSessionRefreshed({ error: new Error('Admin session refresh returned no token') });
      } catch (err) {
        notifyAdminSessionRefreshed({ error: err });
      }
    }
    return null;
  }

  if (mode === 'firebase') {
    try {
      if (!auth.currentUser && typeof auth.authStateReady === 'function') {
        await auth.authStateReady();
      }
      if (auth.currentUser) {
        return await auth.currentUser.getIdToken(forceRefresh);
      }
    } catch (e) {
      console.warn('[apiClient] Firebase getIdToken failed:', e?.message);
    }
    if (isCleanAdminToken) {
      return adminToken;
    }
    return null;
  }

  // JWT mode: if forced refresh, near expiry, or no token in memory, attempt silent refresh via tokenManager
  if (!isAdminLocation) {
    const currentToken = tokenManager.getAccessToken() || inMemoryAccessToken;
    if (forceRefresh || !currentToken || tokenManager.isNearExpiry(60)) {
      if (forceRefresh || hasActiveAppSession() || tokenManager.hasRefreshToken()) {
        const refreshed = await tokenManager.refresh({ force: forceRefresh, apiBaseUrl: API_BASE_URL });
        if (refreshed) {
          inMemoryAccessToken = refreshed;
          restartRedirectInFlight = false;
          return refreshed;
        }
      }
    }
  }

  // Fallback to portal admin token if available
  if (isCleanAdminToken) {
    return adminToken;
  }

  return tokenManager.getAccessToken() || inMemoryAccessToken;
}

const defaultHeaders = (role, userId, userEmail) => {
  const mode = getAuthMode();
  const headers = {
    "Content-Type": "application/json",
  };

  // Attach legacy headers ONLY under legacy mode
  if (mode === 'legacy') {
    const resolvedRole = role || getCurrentUserRole();
    const resolvedUserId = userId || getCurrentUserId();
    headers["x-user-role"] = normalizeRole(resolvedRole);
    if (resolvedUserId) {
      headers["x-user-id"] = resolvedUserId;
    }
    if (userEmail) {
      headers["x-user-email"] = userEmail;
    }
  }

  return headers;
};

async function executeApiRequest(path, method, body = null, options = {}) {
  const url = `${API_BASE_URL}${path}`;
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const headers = defaultHeaders(options.role, options.userId, options.userEmail);
  if (options.headers && typeof options.headers === 'object') {
    Object.assign(headers, options.headers);
  }
  if (isFormData) {
    delete headers["Content-Type"];
  }

  const isPortal =
    (typeof window !== "undefined" && window.location.pathname.startsWith('/admin')) ||
    path.startsWith('/admin') ||
    path.startsWith('/portal-admins') ||
    (options.role && ['admin', 'superuser'].includes(normalizeRole(options.role)));

  // Attach fresh token in JWT or Firebase mode (skip for unauthenticated auth endpoints)
  const isPublicAuth =
    path === '/health' ||
    path.startsWith('/admin/login') ||
    path.startsWith('/admin/auth/refresh') ||
    path.startsWith('/admin/auth/logout') ||
    path.startsWith('/auth/login') ||
    path.startsWith('/auth/refresh') ||
    path.startsWith('/auth/signup') ||
    path.startsWith('/auth/resolve-identifier') ||
    path.startsWith('/auth/forgot-password') ||
    path.startsWith('/auth/reset-password') ||
    path.startsWith('/auth/verify-email') ||
    path.startsWith('/auth/resend-verification');
  const mode = getAuthMode();
  if (mode !== 'legacy' && !isPublicAuth) {
    const token = await getFreshToken(false, isPortal);
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    } else if (!isPortal && !hasActiveAppSession() && !tokenManager.hasRefreshToken()) {
      // Policy: No request is sent while the user is not authenticated.
      const unauthErr = new Error("Authentication required. Please log in again.");
      unauthErr.statusCode = 401;
      unauthErr.code = 'UNAUTHENTICATED';
      throw unauthErr;
    }
  }

  const config = {
    method,
    headers,
    credentials: 'include',
  };

  if (body && ["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    config.body = isFormData ? body : JSON.stringify(body);
  }

  try {
    const response = await fetch(url, config);
    const bootCheck = inspectBootHeader(response, { isPublicAuth });
    if (bootCheck.restarted) {
      throw bootCheck.error;
    }

    let prefetchedErrorData;
    if (response.status === 401) {
      try {
        const readable = typeof response.clone === 'function' ? response.clone() : response;
        prefetchedErrorData = await readable.json();
      } catch {
        prefetchedErrorData = null;
      }
      if (prefetchedErrorData?.code === 'SESSION_INVALID' && !isPublicAuth) {
        handleServerRestart(bootCheck.bootId, 'session_invalid');
        const err = new Error(prefetchedErrorData.message || SERVER_RESTART_MESSAGE);
        err.statusCode = 401;
        err.code = 'SESSION_INVALID';
        err.data = prefetchedErrorData;
        throw err;
      }

      // Automatic silent refresh on 401 (retry once) when not SESSION_INVALID
      if (!options._retry && mode !== 'legacy' && !isPublicAuth && prefetchedErrorData?.code !== 'SESSION_INVALID') {
        const freshToken = await getFreshToken(true, isPortal);
        if (freshToken) {
          return executeApiRequest(path, method, body, { ...options, _retry: true });
        }
      }
    }

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      let errorData = prefetchedErrorData !== undefined ? prefetchedErrorData : null;

      if (prefetchedErrorData === undefined) {
        try {
          errorData = await response.json();
          errorMessage = errorData?.message || errorMessage;
        } catch (err) {
          console.debug('[apiClient] Response body was not JSON, using default error message:', err);
        }
      } else if (errorData?.message) {
        errorMessage = errorData.message;
      }

      // Handle specific HTTP status codes
      let err;
      switch (response.status) {
        case 400:
          err = new Error(`Validation Error: ${errorMessage}`);
          break;
        case 401:
          err = new Error(errorMessage || "Authentication required. Please log in again.");
          break;
        case 403: {
          if (errorData?.code === 'ACCOUNT_SUSPENDED') {
            const isLoginRequest = path.startsWith('/auth/login') || path.startsWith('/admin/login');
            const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
            const isAuthOrSuspendedPage = ['/login', '/admin/login', '/suspended'].includes(currentPath);

            if (!isLoginRequest && !isAuthOrSuspendedPage) {
              inMemoryAccessToken = null;
              tokenManager.clear();
              dispatchFromInterceptor(setSuspendedInfo(errorData));
              dispatchFromInterceptor(sessionReset({ suspendedInfo: errorData }));
              if (typeof window !== 'undefined') {
                if (customRestartRedirectHandler) {
                  customRestartRedirectHandler('/suspended');
                } else if (window.location.pathname !== '/suspended') {
                  navigateWithAppRouter('/suspended', { replace: true });
                }
              }
            }
            err = new Error(errorMessage || 'Your account is suspended.');
            break;
          }

          if (
            typeof window !== "undefined" &&
            errorMessage &&
            (errorMessage.toLowerCase().includes('suspended') ||
              errorMessage.toLowerCase().includes('banned'))
          ) {
            inMemoryAccessToken = null;
            tokenManager.clear();
            dispatchFromInterceptor(sessionReset());
            if (!window.location.pathname.startsWith('/admin') && window.location.pathname !== '/login') {
              if (customRestartRedirectHandler) {
                customRestartRedirectHandler('/login?suspended=1');
              } else {
                navigateWithAppRouter('/login?suspended=1', { replace: true });
              }
            }
          }
          err = new Error(errorMessage ? `Access Forbidden: ${errorMessage}` : "Access Forbidden");
          break;
        }
        case 404:
          err = new Error(`Resource not found: ${errorMessage}`);
          break;
        case 409:
          err = new Error(`Conflict: ${errorMessage}`);
          break;
        case 422:
          err = new Error(`Validation failed: ${errorMessage}`);
          break;
        case 429:
          err = new Error(`Rate limit exceeded: ${errorMessage}`);
          break;
        case 500:
          err = new Error(
            errorMessage && errorMessage !== 'Internal Server Error'
              ? errorMessage
              : "Server error. Please try again later.",
          );
          break;
        case 503: {
          const isMaintenanceReset =
            errorData?.code === 'MAINTENANCE' || Boolean(response.headers?.get?.('Retry-After'));
          const headerRetry = Number(response.headers?.get?.('Retry-After'));
          const retryAfterSeconds =
            Number.isFinite(headerRetry) && headerRetry > 0
              ? headerRetry
              : Number(errorData?.retryAfterSeconds) > 0
                ? Number(errorData.retryAfterSeconds)
                : 5;

          if (isMaintenanceReset && !options._maintenanceRetried) {
            dispatchFromInterceptor(
              setResettingBanner({
                active: true,
                message: 'The system is being reset, retrying...',
              }),
            );
            const delayMs = Math.min(Math.max(retryAfterSeconds, 1), 10) * 1000;
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            const retriedResult = await executeApiRequest(path, method, body, {
              ...options,
              _maintenanceRetried: true,
            });
            dispatchFromInterceptor(
              setResettingBanner({ active: false, message: '' }),
            );
            return retriedResult;
          }

          if (typeof window !== "undefined" && (isMaintenanceReset || !window.location.pathname.startsWith('/admin'))) {
            if (isMaintenanceReset) {
              dispatchFromInterceptor(
                setResettingBanner({
                  active: true,
                  message: 'The system is being reset, retrying...',
                }),
              );
            } else {
              dispatchFromInterceptor(
                setMaintenance({
                  active: true,
                  message: errorMessage,
                }),
              );
            }
          }
          err = new Error(
            isMaintenanceReset ? 'The system is being reset, retrying...' : `Service Unavailable: ${errorMessage}`,
          );
          break;
        }
        default:
          err = new Error(errorMessage);
          break;
      }
      err.serverMessage = errorMessage;
      err.statusCode = response.status;
      if (errorData && typeof errorData === 'object') {
        err.data = errorData;
        if (errorData.code) err.code = errorData.code;
        if (errorData.field) err.field = errorData.field;
        if (errorData.conflictingRange) err.conflictingRange = errorData.conflictingRange;
        if (errorData.conflictStart) err.conflictStart = errorData.conflictStart;
        if (errorData.conflictEnd) err.conflictEnd = errorData.conflictEnd;
        if (Array.isArray(errorData.rejectedFields)) err.rejectedFields = errorData.rejectedFields;
        if (errorData.retryAt) err.retryAt = errorData.retryAt;
        if (errorData.retryAfter !== undefined) err.retryAfter = errorData.retryAfter;
        if (errorData.retryAfterSeconds !== undefined) err.retryAfterSeconds = errorData.retryAfterSeconds;
        if (errorData.cooldownSeconds !== undefined) err.cooldownSeconds = errorData.cooldownSeconds;
        if (errorData.wrongAttempts !== undefined) err.wrongAttempts = errorData.wrongAttempts;
        if (errorData.attemptsRemaining !== undefined) err.attemptsRemaining = errorData.attemptsRemaining;
        if (errorData.currentCount !== undefined) err.currentCount = errorData.currentCount;
        if (errorData.maxAllowed !== undefined) err.maxAllowed = errorData.maxAllowed;
        if (Array.isArray(errorData.projects)) err.projects = errorData.projects;
        if (errorData.project) err.project = errorData.project;
        if (Array.isArray(errorData.blockers)) err.blockers = errorData.blockers;
        if (Array.isArray(errorData.obligations)) err.obligations = errorData.obligations;
        if (errorData.reason !== undefined) err.reason = errorData.reason;
        if (errorData.suspendedAt !== undefined) err.suspendedAt = errorData.suspendedAt;
        if (errorData.suspensionType !== undefined) err.suspensionType = errorData.suspensionType;
        if (errorData.appealAvailable !== undefined) err.appealAvailable = errorData.appealAvailable;
        if (errorData.supportContact !== undefined) err.supportContact = errorData.supportContact;
      }
      throw err;
    }

    // For DELETE requests or 204 No Content, safely parse response
    if (method === "DELETE" || response.status === 204) {
      try {
        const text = await response.text();
        return text ? JSON.parse(text) : { message: "Deleted successfully" };
      } catch (err) {
        console.debug('[apiClient] DELETE response parsing notice, returning fallback message:', err);
        return { message: "Deleted successfully" };
      }
    }

    if (typeof response.text === 'function') {
      const text = await response.text();
      return text ? JSON.parse(text) : {};
    }
    if (typeof response.json === 'function') {
      return await response.json();
    }
    return {};
  } catch (error) {
    if (
      !error.statusCode &&
      !error.serverMessage &&
      error instanceof TypeError &&
      (error.message.includes("fetch") ||
        error.message.includes("NetworkError") ||
        error.message.includes("Failed to fetch") ||
        error.message.includes("Load failed") ||
        error.message.includes("network"))
    ) {
      const netErr = new Error(
        "Network error. Please check your connection and try again.",
        { cause: error },
      );
      netErr.isNetworkError = true;
      netErr.code = 'NETWORK_ERROR';
      throw netErr;
    }
    throw error;
  }
}

async function apiRequest(path, method, body = null, options = {}) {
  return executeApiRequest(path, method, body, options);
}

// Get current user role (fallback for display / legacy headers)

async function fetchDownloadResponse(path, options = {}) {
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = defaultHeaders(options.role, options.userId, options.userEmail);
  delete headers["Content-Type"];

  const mode = getAuthMode();
  if (mode !== 'legacy') {
    const token = await getFreshToken(false);
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const response = await fetch(url, {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  const bootCheck = inspectBootHeader(response);
  if (bootCheck.restarted) {
    throw bootCheck.error;
  }

  if (!response.ok) {
    let msg = `HTTP ${response.status}: ${response.statusText}`;
    let errorData = null;
    try {
      errorData = await response.json();
      if (errorData?.message) msg = errorData.message;
    } catch (err) {
      console.debug('[apiClient] Error parsing download failure response JSON, falling back to statusText:', err);
    }
    if (response.status === 401 && errorData?.code === 'SESSION_INVALID') {
      handleServerRestart(bootCheck.bootId, 'session_invalid');
    }
    const err = new Error(msg);
    err.statusCode = response.status;
    if (errorData && typeof errorData === 'object') {
      err.code = errorData.code;
      err.data = errorData;
    }
    throw err;
  }

  return response;
}

async function apiDownload(path, options = {}) {
  const response = await fetchDownloadResponse(path, options);
  return await response.blob();
}

async function apiDownloadText(path, options = {}) {
  const response = await fetchDownloadResponse(path, options);
  const disposition = response.headers?.get?.('content-disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/i);
  return {
    text: await response.text(),
    filename: match ? match[1] : null,
  };
}

function getCurrentUserRole() {
  try {
    const session = getStateFromInterceptor()?.session;
    if (session?.isSuperUser) {
      return "Super User";
    }
    if (session?.portalRole) {
      return session.portalRole;
    }
    if (session?.activeRole) {
      return session.activeRole;
    }
    return "Collaborator";
  } catch {
    return "Collaborator";
  }
}

function getCurrentUserId() {
  try {
    const session = getStateFromInterceptor()?.session;
    return session?.user?.id || session?.user?.uid || session?.adminUid || "";
  } catch {
    return "";
  }
}

// Export core HTTP client & auth helpers
export {
  resolveApiBaseUrl,
  API_BASE_URL,
  defaultHeaders,
  apiRequest,
  apiDownload,
  apiDownloadText,
  getCurrentUserRole,
  getCurrentUserId,
  normalizeRole,
};

export default apiRequest;
