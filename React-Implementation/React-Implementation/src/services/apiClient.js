import { signOut as fbSignOut } from 'firebase/auth';
import { auth } from './firebase.js';
import storage from '../utils/storage.js';
import { roleStore } from '../utils/roleStore.js';
import tokenManager from './tokenManager.js';

export const SERVER_RESTART_MESSAGE = 'The server was restarted. Please log in again.';

export { tokenManager };

function resolveApiBaseUrl() {
  const configuredBase =
    typeof window !== "undefined" && typeof window.TEAMFORGE_API_BASE_URL === "string"
      ? window.TEAMFORGE_API_BASE_URL
      : "";
  const storedBase = storage.getApiBaseUrl();
  const envBase = typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL
    ? import.meta.env.VITE_API_BASE_URL
    : "";
  const rawBase = configuredBase || storedBase || envBase || "http://localhost:3000";
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

// In-memory access token storage (never written to localStorage/sessionStorage)
let inMemoryAccessToken = null;
let refreshTokenPromise = null;
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

function hasActiveAppSession() {
  if (tokenManager.getAccessToken() || inMemoryAccessToken) return true;
  if (tokenManager.hasRefreshToken()) return true;
  if (storage.hasStoredSessionKeys()) return true;
  try {
    if (getAuthMode() === 'firebase' && auth?.currentUser) return true;
  } catch {
    // ignore firebase probe error
  }
  return false;
}

export function handleServerRestart(nextBootId = null, reason = 'server_restarted') {
  if (restartRedirectInFlight) return;
  restartRedirectInFlight = true;

  clearApiCache();
  inMemoryAccessToken = null;
  storage.clearAll();
  if (nextBootId) {
    storage.setBootId(nextBootId);
  }
  storage.setServerRestartNotice(SERVER_RESTART_MESSAGE);

  if (typeof window !== 'undefined') {
    try {
      if (getAuthMode() === 'firebase' && auth?.currentUser) {
        fbSignOut(auth).catch(() => {});
      }
    } catch {
      // ignore firebase signout errors
    }

    window.dispatchEvent(
      new CustomEvent('teamforge:session_invalid', {
        detail: { reason, message: SERVER_RESTART_MESSAGE, bootId: nextBootId || null },
      }),
    );

    if (customRestartRedirectHandler) {
      customRestartRedirectHandler('/login');
    } else if (window.location.pathname !== '/login') {
      window.location.assign('/login');
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
  // They simply sync the stored boot ID and let the authentication flow proceed cleanly on the first try.
  if (options.isPublicAuth) {
    storage.setBootId(responseBootId);
    return { restarted: false, bootId: responseBootId };
  }

  const storedBootId = storage.getBootId();
  if (storedBootId && storedBootId !== responseBootId) {
    const hadSession = options.assumeSession || hasActiveAppSession();
    if (hadSession) {
      handleServerRestart(responseBootId, 'boot_id_changed');
      const err = new Error(SERVER_RESTART_MESSAGE);
      err.statusCode = 401;
      err.code = 'SESSION_INVALID';
      return { restarted: true, bootId: responseBootId, error: err };
    }
  }
  storage.setBootId(responseBootId);
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

    // Synchronize boot ID without wiping session during health checks
    storage.setBootId(bootId);
    return { ...data, bootId, restarted: false };
  } catch {
    return null;
  }
}

async function getFreshToken(forceRefresh = false, isPortal = false) {
  const mode = getAuthMode();
  if (mode === 'legacy') return null;

  const adminSession = storage.getAdminSession();
  const adminToken = adminSession.token;
  const isCleanAdminToken = adminToken && adminToken !== 'mock_admin_token';

  const isAdminLocation =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');

  // If in admin portal or performing portal operation, prioritize the portal admin token
  if ((isPortal || isAdminLocation) && isCleanAdminToken) {
    return adminToken;
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

// In-memory GET request cache and in-flight promise deduplication
const apiGetCache = new Map();
const inFlightRequests = new Map();
const DEFAULT_CACHE_TTL_MS = 20000; // 20 seconds TTL for read endpoints

function clearApiCache(prefix = "") {
  if (!prefix) {
    apiGetCache.clear();
    return;
  }
  for (const key of apiGetCache.keys()) {
    if (key.includes(prefix)) {
      apiGetCache.delete(key);
    }
  }
}

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
          console.log('[apiClient] Response body was not JSON, using default error message:', err);
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
              storage.clearUserSessionKeys();
              storage.clearAdminSession();
              inMemoryAccessToken = null;
              tokenManager.clear();
              if (typeof window !== 'undefined') {
                try {
                  sessionStorage.setItem('teamforge_suspended_info', JSON.stringify(errorData));
                } catch {
                  // ignore
                }
                if (customRestartRedirectHandler) {
                  customRestartRedirectHandler('/suspended');
                } else if (window.location.pathname !== '/suspended') {
                  window.location.assign('/suspended');
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
            storage.clearUserSessionKeys();
            storage.clearAdminSession();
            inMemoryAccessToken = null;
            if (!window.location.pathname.startsWith('/admin') && window.location.pathname !== '/login') {
              window.location.href = '/login?suspended=1';
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
            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent('teamforge:maintenance', {
                  detail: {
                    code: 'MAINTENANCE',
                    message: 'The system is being reset, retrying...',
                    retryAfterSeconds,
                    active: true,
                  },
                }),
              );
            }
            const delayMs = Math.min(Math.max(retryAfterSeconds, 1), 10) * 1000;
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            const retriedResult = await executeApiRequest(path, method, body, {
              ...options,
              _maintenanceRetried: true,
            });
            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent('teamforge:maintenance', {
                  detail: { code: 'MAINTENANCE', active: false },
                }),
              );
            }
            return retriedResult;
          }

          if (typeof window !== "undefined" && (isMaintenanceReset || !window.location.pathname.startsWith('/admin'))) {
            window.dispatchEvent(
              new CustomEvent('teamforge:maintenance', {
                detail: {
                  code: errorData?.code || 'SERVICE_UNAVAILABLE',
                  message: isMaintenanceReset ? 'The system is being reset, retrying...' : errorMessage,
                  retryAfterSeconds,
                  active: true,
                },
              }),
            );
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
        console.log('[apiClient] DELETE response parsing notice, returning fallback message:', err);
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
  const isGet = method === "GET";
  const shouldCache = isGet && !options.skipCache;
  const cacheKey = `${path}:${options.role || ""}:${options.userId || ""}`;

  if (shouldCache) {
    const cached = apiGetCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < (options.ttl || DEFAULT_CACHE_TTL_MS)) {
      return JSON.parse(JSON.stringify(cached.data));
    }

    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey);
    }

    const reqPromise = executeApiRequest(path, method, body, options)
      .then((data) => {
        apiGetCache.set(cacheKey, {
          timestamp: Date.now(),
          data,
          ttl: options.ttl || DEFAULT_CACHE_TTL_MS,
        });
        return data;
      })
      .finally(() => {
        inFlightRequests.delete(cacheKey);
      });

    inFlightRequests.set(cacheKey, reqPromise);
    return reqPromise;
  }

  // Mutation: execute and invalidate cache so subsequent reads see latest data
  const result = await executeApiRequest(path, method, body, options);
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    clearApiCache();
  }
  return result;
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
      console.log('[apiClient] Error parsing download failure response JSON, falling back to statusText:', err);
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
    const adminSession = storage.getAdminSession();
    if (adminSession.isSuperUser) {
      return "Super User";
    }
    if (adminSession.portalRole) {
      return adminSession.portalRole;
    }
    const storedRole = roleStore.getActiveRole();
    if (storedRole) {
      return storedRole;
    }
    return "Collaborator";
  } catch (err) {
    console.warn('[apiClient] Error reading role from storage:', err);
    return "Collaborator";
  }
}

function getCurrentUserId() {
  try {
    return storage.getBackendUserId() || "";
  } catch (err) {
    console.warn('[apiClient] Error reading user ID from storage:', err);
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
  clearApiCache,
  getCurrentUserRole,
  getCurrentUserId,
  normalizeRole,
};

// Re-export domain-specific APIs for convenience and backward-compatibility
export * from "./usersApi.js";
export * from "./projectsApi.js";
export * from "./tasksApi.js";
export * from "./joinRequestsApi.js";
export * from "./mentorApplicationsApi.js";
export * from "./mentorRequestsApi.js";
export * from "./supportApi.js";
export * from "./adminApi.js";
export * from "./portalAdminsApi.js";
export * from "./notificationsApi.js";
export * from "./leaderboardApi.js";
export * from "./mentorMarketplaceApi.js";
export * from "./mentorshipApi.js";
export * from "./authApi.js";

export default apiRequest;
