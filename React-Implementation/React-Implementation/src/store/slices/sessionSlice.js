import { createSlice } from '@reduxjs/toolkit';
import { sessionReset } from '../actions/appActions';
import {
  ROLE_CANONICAL,
  canonicalRole,
  computeAllowedRoles,
} from '../utils/roleHelpers';

/**
 * Session, Auth, Roles & RBAC Slice (`sessionSlice`)
 * ==================================================
 * Single in-memory source of truth for:
 * - User identity, auth status/loading/errors, access/refresh tokens (Decision D4/D5)
 * - Active & allowed workspace roles + mentor unlock status
 * - Portal admin credentials, permissions & Super User flags
 * - Server boot ID, suspension payload & one-time auth notices
 *
 * Route-Leave Reset (Reading B — Decision D3):
 * - STAYS across `routeChanged`: all session, role & permission state persists
 *   across navigation so guards/sidebars/theme stay consistent.
 * - Resets auth & session fields on `sessionReset`, optionally preserving post-reset
 *   notices (`serverRestart`, `sessionEnded`, `accountDeleted`) and `bootId`.
 */
export function createInitialSessionState() {
  return {
    user: null,
    accessToken: null,
    isAuthenticated: false,
    status: 'idle', // 'idle' | 'loading' | 'authenticated' | 'signing_out' | 'signed_out'
    loading: false,
    error: null,
    activeRole: ROLE_CANONICAL.COLLABORATOR,
    allowedRoles: [ROLE_CANONICAL.COLLABORATOR, ROLE_CANONICAL.PROJECT_OWNER],
    mentorApproved: false,
    mentorAppStatus: null,
    adminUid: '',
    adminEmail: '',
    adminName: '',
    portalRole: null,
    isSuperUser: null,
    permissions: null,
    adminToken: null,
    adminBootstrapStatus: 'idle', // 'idle' | 'loading' | 'done'
    bootId: null,
    suspendedInfo: null,
    notices: {
      sessionEnded: '',
      serverRestart: '',
      accountDeleted: '',
    },
    initialized: false,
  };
}

function resetPreservingEphemera(prevState, actionPayload = {}) {
  const fresh = createInitialSessionState();
  const payload = actionPayload && typeof actionPayload === 'object' ? actionPayload : {};
  const preserveBootId = payload.bootId !== undefined ? payload.bootId : prevState?.bootId || null;
  return {
    ...fresh,
    status: 'signed_out',
    bootId: preserveBootId,
    suspendedInfo:
      payload.suspendedInfo !== undefined
        ? payload.suspendedInfo
        : prevState?.suspendedInfo || null,
    notices: {
      ...fresh.notices,
      ...(prevState?.notices || {}),
      ...(payload.notices || {}),
    },
  };
}

const sessionSlice = createSlice({
  name: 'session',
  initialState: createInitialSessionState(),
  reducers: {
    setSession: (state, action) => {
      const payload = action.payload || {};
      if (payload.user !== undefined) state.user = payload.user;
      if (payload.accessToken !== undefined) state.accessToken = payload.accessToken;
      if (payload.isAuthenticated !== undefined) {
        state.isAuthenticated = Boolean(payload.isAuthenticated);
      } else if (payload.user !== undefined) {
        state.isAuthenticated = Boolean(payload.user?.id || payload.user?.uid);
      }
      if (payload.status !== undefined) {
        state.status = payload.status;
      } else if (state.isAuthenticated) {
        state.status = 'authenticated';
      }
      if (payload.loading !== undefined) {
        state.loading = Boolean(payload.loading);
      } else if (payload.status === 'authenticated' || state.isAuthenticated) {
        state.loading = false;
      }
      if (payload.error !== undefined) state.error = payload.error;

      if (payload.mentorApproved !== undefined) {
        state.mentorApproved = Boolean(payload.mentorApproved);
      } else if (state.user) {
        state.mentorApproved = Boolean(
          state.mentorApproved ||
            state.user?.mentorUnlocked ||
            state.user?.profile?.mentorUnlocked ||
            canonicalRole(state.user?.role) === ROLE_CANONICAL.MENTOR,
        );
      }
      if (payload.mentorAppStatus !== undefined) {
        state.mentorAppStatus = payload.mentorAppStatus;
      } else if (state.mentorApproved) {
        state.mentorAppStatus = 'approved';
      }

      if (payload.allowedRoles !== undefined) {
        state.allowedRoles = Array.isArray(payload.allowedRoles)
          ? payload.allowedRoles
          : [];
      } else if (state.user) {
        state.allowedRoles = computeAllowedRoles(state.user, state.mentorApproved);
      }

      if (payload.activeRole !== undefined) {
        const candidate = canonicalRole(payload.activeRole);
        state.activeRole =
          state.allowedRoles.length === 0 || state.allowedRoles.includes(candidate)
            ? candidate
            : state.allowedRoles[0] || ROLE_CANONICAL.COLLABORATOR;
      } else if (state.user && !state.initialized) {
        const defaultRole = canonicalRole(state.user?.role);
        state.activeRole = state.allowedRoles.includes(defaultRole)
          ? defaultRole
          : ROLE_CANONICAL.COLLABORATOR;
      } else if (
        state.allowedRoles.length > 0 &&
        !state.allowedRoles.includes(state.activeRole)
      ) {
        state.activeRole = state.allowedRoles[0];
      }

      if (payload.adminUid !== undefined) state.adminUid = String(payload.adminUid || '');
      if (payload.portalRole !== undefined) state.portalRole = payload.portalRole;
      if (payload.isSuperUser !== undefined) state.isSuperUser = payload.isSuperUser;
      if (payload.permissions !== undefined) {
        state.permissions = Array.isArray(payload.permissions)
          ? payload.permissions
          : payload.permissions;
      }
      if (payload.adminToken !== undefined) state.adminToken = payload.adminToken;
      state.initialized = true;
    },
    setAdminSession: (state, action) => {
      const payload = action.payload || {};
      state.adminUid = String(payload.uid || payload.adminUid || payload.id || '');
      if (payload.email !== undefined) state.adminEmail = String(payload.email || '');
      if (payload.name !== undefined) state.adminName = String(payload.name || '');
      state.portalRole = payload.portalRole || payload.role || null;
      const roleLower = String(state.portalRole || '').toLowerCase();
      state.isSuperUser = Boolean(
        payload.isSuperUser ||
          roleLower === 'superuser' ||
          roleLower === 'super user',
      );
      state.permissions = Array.isArray(payload.permissions)
        ? payload.permissions
        : null;
      if (payload.token !== undefined) state.adminToken = payload.token;
      if (payload.adminToken !== undefined) state.adminToken = payload.adminToken;
      state.adminBootstrapStatus = 'done';
      state.initialized = true;
    },
    setAdminBootstrapStatus: (state, action) => {
      state.adminBootstrapStatus = action.payload || 'idle';
      if (action.payload === 'done') {
        state.initialized = true;
      }
    },
    clearAdminSession: (state) => {
      state.adminUid = '';
      state.adminEmail = '';
      state.adminName = '';
      state.portalRole = null;
      state.isSuperUser = null;
      state.permissions = null;
      state.adminToken = null;
    },
    clearSession: (state, action) => resetPreservingEphemera(state, action.payload),
    userUpdated: (state, action) => {
      const payload = action.payload;
      if (!payload || typeof payload !== 'object') return;
      const prevUser = state.user && typeof state.user === 'object' ? state.user : {};
      const nextProfile =
        payload.profile && typeof payload.profile === 'object'
          ? {
              ...(prevUser.profile && typeof prevUser.profile === 'object'
                ? prevUser.profile
                : {}),
              ...payload.profile,
            }
          : prevUser.profile;
      state.user = {
        ...prevUser,
        ...payload,
        ...(nextProfile !== undefined ? { profile: nextProfile } : {}),
      };
      if (payload.activeRole !== undefined) {
        state.activeRole = canonicalRole(payload.activeRole);
      }
      if (Array.isArray(payload.allowedRoles)) {
        state.allowedRoles = payload.allowedRoles;
      }
      if (state.user?.id || state.user?.uid) {
        state.initialized = true;
      }
    },
    setActiveRole: (state, action) => {
      const next = canonicalRole(action.payload);
      if (
        next &&
        (state.allowedRoles.length === 0 || state.allowedRoles.includes(next))
      ) {
        state.activeRole = next;
        state.initialized = true;
      }
    },
    setMentorStatus: (state, action) => {
      const { isApproved, status } = action.payload || {};
      if (isApproved !== undefined) {
        state.mentorApproved = Boolean(isApproved);
      }
      if (status !== undefined) {
        state.mentorAppStatus = status;
      }
      state.allowedRoles = computeAllowedRoles(state.user, state.mentorApproved);
      if (!state.allowedRoles.includes(state.activeRole)) {
        state.activeRole = ROLE_CANONICAL.COLLABORATOR;
      }
    },
    setSessionStatus: (state, action) => {
      const { status, loading, error } = action.payload || {};
      if (status !== undefined) state.status = status;
      if (loading !== undefined) state.loading = Boolean(loading);
      if (error !== undefined) state.error = error;
    },
    setAccessTokenState: (state, action) => {
      state.accessToken = action.payload || null;
    },
    setBootId: (state, action) => {
      state.bootId = action.payload ? String(action.payload) : null;
    },
    setSuspendedInfo: (state, action) => {
      state.suspendedInfo = action.payload || null;
    },
    clearSuspendedInfo: (state) => {
      state.suspendedInfo = null;
    },
    setNotice: (state, action) => {
      const { key, message } = action.payload || {};
      if (key && Object.prototype.hasOwnProperty.call(state.notices, key)) {
        state.notices[key] = message ? String(message) : '';
      }
    },
    consumeNotice: (state, action) => {
      const key = action.payload;
      if (key && Object.prototype.hasOwnProperty.call(state.notices, key)) {
        state.notices[key] = '';
      }
    },
  },
  extraReducers: (builder) => {
    builder.addCase(sessionReset, (state, action) =>
      resetPreservingEphemera(state, action.payload),
    );
  },
});

export const {
  setSession,
  setAdminSession,
  setAdminBootstrapStatus,
  clearAdminSession,
  clearSession,
  userUpdated,
  setActiveRole,
  setMentorStatus,
  setSessionStatus,
  setAccessTokenState,
  setBootId,
  setSuspendedInfo,
  clearSuspendedInfo,
  setNotice,
  consumeNotice,
} = sessionSlice.actions;

export default sessionSlice.reducer;
