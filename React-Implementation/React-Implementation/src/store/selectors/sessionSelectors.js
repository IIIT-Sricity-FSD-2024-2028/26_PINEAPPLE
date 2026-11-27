import { getHomePathForRole } from '../utils/roleHelpers';

const EMPTY_ROLES = [];
const EMPTY_NOTICES = {};

export const selectSession = (state) => state?.session;

export const selectCurrentUser = (state) => state?.session?.user || null;

export const selectEmailVerified = (state) =>
  state?.session?.user?.emailVerified;

export const selectNeedsUsernameConfirmation = (state) =>
  Boolean(state?.session?.user?.needsUsernameConfirmation);

export const selectIsAuthenticated = (state) =>
  Boolean(state?.session?.isAuthenticated && state?.session?.user);

export const selectAuthStatus = (state) => state?.session?.status || 'idle';

export const selectAuthLoading = (state) => Boolean(state?.session?.loading);

export const selectAuthError = (state) => state?.session?.error || null;

export const selectActiveRole = (state) =>
  state?.session?.activeRole || 'Collaborator';

export const selectAllowedRoles = (state) =>
  state?.session?.allowedRoles || EMPTY_ROLES;

export const selectHomePath = (state) =>
  getHomePathForRole(selectActiveRole(state));

export const selectIsMentorApproved = (state) =>
  Boolean(state?.session?.mentorApproved);

export const selectMentorAppStatus = (state) =>
  state?.session?.mentorAppStatus || null;

export const selectBootId = (state) => state?.session?.bootId || null;

export const selectSuspendedInfo = (state) =>
  state?.session?.suspendedInfo || null;

export const selectSessionNotices = (state) =>
  state?.session?.notices || EMPTY_NOTICES;

export const selectIsAdminAuthenticated = (state) =>
  Boolean(state?.session?.portalRole && (state?.session?.adminToken || state?.session?.isSuperUser !== null));

export const selectAdminToken = (state) => state?.session?.adminToken || null;

export const selectIsSessionConfigured = (state) => {
  const s = state?.session;
  if (!s) return false;
  return Boolean(
    s.initialized ||
      s.isSuperUser !== null ||
      Array.isArray(s.permissions) ||
      s.portalRole,
  );
};

export const selectIsSuperUser = (state) => {
  const s = state?.session;
  if (!s) return false;
  const roleLower = String(s.portalRole || s.activeRole || '').toLowerCase();
  return Boolean(
    s.isSuperUser || roleLower === 'superuser' || roleLower === 'super user',
  );
};

export const selectAdminPermissions = (state) =>
  Array.isArray(state?.session?.permissions) ? state.session.permissions : null;

export const selectCurrentAdminUid = (state) =>
  state?.session?.adminUid || state?.session?.user?.id || '';

const SUPERUSER_ONLY_SECTIONS = new Set([
  'superuser',
  'jobs_tick',
  'config_write',
]);

/**
 * Computes whether the current portal admin session can access a given admin section.
 * Accepts either `selectCanAccess('reports')(state)` curried selector form or direct helper `canAccess(sessionState, 'reports')`.
 */
export function canAccess(sessionOrRootState, sectionKey) {
  const session =
    sessionOrRootState &&
    Object.prototype.hasOwnProperty.call(sessionOrRootState, 'session')
      ? sessionOrRootState.session
      : sessionOrRootState;

  if (!session) return true;

  const isConfigured = Boolean(
    session.initialized ||
      session.isSuperUser !== null ||
      Array.isArray(session.permissions) ||
      session.portalRole,
  );

  const roleLower = String(session.portalRole || session.activeRole || '').toLowerCase();
  const isSuper = Boolean(
    session.isSuperUser || roleLower === 'superuser' || roleLower === 'super user',
  );
  if (isSuper) return true;

  if (SUPERUSER_ONLY_SECTIONS.has(sectionKey)) {
    return isConfigured ? false : false;
  }

  const perms = Array.isArray(session.permissions) ? session.permissions : null;
  if (!perms) return true;
  if (perms.includes('*')) return true;
  return perms.includes(sectionKey);
}

export const selectCanAccess = (sectionKey) => (state) =>
  canAccess(state?.session, sectionKey);
