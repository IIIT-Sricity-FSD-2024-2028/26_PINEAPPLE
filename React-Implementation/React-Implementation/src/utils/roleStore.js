import { useSyncExternalStore } from 'react';
import storage from './storage.js';

export const ROLE_CANONICAL = {
  COLLABORATOR: 'Collaborator',
  PROJECT_OWNER: 'Project Owner',
  MENTOR: 'Mentor',
};

export const ROLE_HOMES = {
  [ROLE_CANONICAL.COLLABORATOR]: '/dashboard',
  [ROLE_CANONICAL.PROJECT_OWNER]: '/owner/dashboard',
  [ROLE_CANONICAL.MENTOR]: '/mentor/projects',
};

export function canonicalRole(role) {
  if (!role) return ROLE_CANONICAL.COLLABORATOR;
  const str = String(role).trim().toLowerCase().replace(/[_\s-]+/g, '');
  if (str === 'projectowner' || str === 'owner') return ROLE_CANONICAL.PROJECT_OWNER;
  if (str === 'mentor') return ROLE_CANONICAL.MENTOR;
  if (str === 'collaborator' || str === 'collab' || str === 'member') return ROLE_CANONICAL.COLLABORATOR;
  if (str === 'admin' || str === 'administrator' || str === 'superuser') return role;
  return role;
}

export function getHomePathForRole(role) {
  const canonical = canonicalRole(role);
  return ROLE_HOMES[canonical] || '/dashboard';
}

// Initial state
const initialStoredRole = canonicalRole(storage.getRole());
const initialActiveRole = [
  ROLE_CANONICAL.COLLABORATOR,
  ROLE_CANONICAL.PROJECT_OWNER,
  ROLE_CANONICAL.MENTOR,
].includes(initialStoredRole)
  ? initialStoredRole
  : ROLE_CANONICAL.COLLABORATOR;

let state = {
  status: 'loading',
  allowedRoles: [ROLE_CANONICAL.COLLABORATOR, ROLE_CANONICAL.PROJECT_OWNER],
  activeRole: initialActiveRole,
};

const listeners = new Set();

function emitChange() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (err) {
      console.error('[roleStore] Listener error:', err);
    }
  });
}

function syncBackendRole(role) {
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('teamforge:role_switched', { detail: { role } })
      );
    }
    // Background fire-and-forget call to authApi if available
    import('../services/authApi.js')
      .then(({ authApi }) => {
        if (typeof authApi?.switchRole === 'function') {
          return authApi.switchRole(role).catch(() => {});
        }
        return null;
      })
      .catch(() => {});
  } catch (err) {
    console.warn('[roleStore] Background sync error:', err);
  }
}

export const roleStore = {
  getSnapshot() {
    return state;
  },

  getServerSnapshot() {
    return state;
  },

  subscribe(listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  getActiveRole() {
    return state.activeRole;
  },

  getAllowedRoles() {
    return state.allowedRoles;
  },

  getStatus() {
    return state.status;
  },

  getHomePath(role) {
    return getHomePathForRole(role || state.activeRole);
  },

  initialise(user, options = {}) {
    const allowed = [ROLE_CANONICAL.COLLABORATOR, ROLE_CANONICAL.PROJECT_OWNER];

    const isMentor = Boolean(
      options.isMentorApproved ||
      user?.mentorUnlocked ||
      user?.profile?.mentorUnlocked ||
      String(user?.role || '').toLowerCase() === 'mentor'
    );

    if (isMentor && !allowed.includes(ROLE_CANONICAL.MENTOR)) {
      allowed.push(ROLE_CANONICAL.MENTOR);
    }

    // Preserve active role if it's currently allowed
    let nextActiveRole = state.activeRole;
    if (state.status === 'ready' && allowed.includes(state.activeRole)) {
      nextActiveRole = state.activeRole;
    } else {
      // Otherwise check stored preference
      const stored = canonicalRole(storage.getRole());
      if (stored && allowed.includes(stored)) {
        nextActiveRole = stored;
      } else if (user?.role && allowed.includes(canonicalRole(user.role))) {
        nextActiveRole = canonicalRole(user.role);
      } else {
        nextActiveRole = ROLE_CANONICAL.COLLABORATOR;
      }
    }

    const rolesChanged =
      state.allowedRoles.length !== allowed.length ||
      !state.allowedRoles.every((r) => allowed.includes(r));
    const activeChanged = state.activeRole !== nextActiveRole;
    const statusChanged = state.status !== 'ready';

    if (rolesChanged || activeChanged || statusChanged) {
      state = {
        status: 'ready',
        allowedRoles: allowed,
        activeRole: nextActiveRole,
      };
      try {
        storage.setRole(nextActiveRole);
      } catch (err) {
        console.error('[roleStore] Error writing role to storage:', err);
      }
      emitChange();
    }
  },

  setMentorApproved(isApproved = true) {
    const allowed = [...state.allowedRoles];
    if (isApproved && !allowed.includes(ROLE_CANONICAL.MENTOR)) {
      allowed.push(ROLE_CANONICAL.MENTOR);
    } else if (!isApproved && allowed.includes(ROLE_CANONICAL.MENTOR)) {
      const idx = allowed.indexOf(ROLE_CANONICAL.MENTOR);
      allowed.splice(idx, 1);
    }

    let nextActiveRole = state.activeRole;
    if (!allowed.includes(state.activeRole)) {
      nextActiveRole = ROLE_CANONICAL.COLLABORATOR;
      try {
        storage.setRole(ROLE_CANONICAL.COLLABORATOR);
      } catch (err) {
        console.error('[roleStore] Error resetting storage role:', err);
      }
    }

    if (
      allowed.length !== state.allowedRoles.length ||
      nextActiveRole !== state.activeRole
    ) {
      state = {
        ...state,
        allowedRoles: allowed,
        activeRole: nextActiveRole,
      };
      emitChange();
    }
  },

  switchRole(targetRole) {
    const canonical = canonicalRole(targetRole);

    if (!state.allowedRoles.includes(canonical)) {
      console.warn(
        `[roleStore] Role "${targetRole}" (${canonical}) is not in allowedRoles:`,
        state.allowedRoles
      );
      return null;
    }

    if (state.activeRole !== canonical) {
      state = {
        ...state,
        activeRole: canonical,
      };
      try {
        storage.setRole(canonical);
      } catch (err) {
        console.error('[roleStore] Error writing role to storage:', err);
      }
      emitChange();
      syncBackendRole(canonical);
    }

    return getHomePathForRole(canonical);
  },

  setActiveRole(targetRole) {
    const canonical = canonicalRole(targetRole);

    if (!state.allowedRoles.includes(canonical)) {
      return false;
    }

    if (state.activeRole === canonical) {
      return true;
    }

    state = {
      ...state,
      activeRole: canonical,
    };
    try {
      storage.setRole(canonical);
    } catch (err) {
      console.error('[roleStore] Error writing role to storage:', err);
    }
    emitChange();
    syncBackendRole(canonical);
    return true;
  },

  reset() {
    state = {
      status: 'ready',
      allowedRoles: [ROLE_CANONICAL.COLLABORATOR, ROLE_CANONICAL.PROJECT_OWNER],
      activeRole: ROLE_CANONICAL.COLLABORATOR,
    };
    try {
      storage.setRole(ROLE_CANONICAL.COLLABORATOR);
    } catch (err) {
      console.error('[roleStore] Error clearing role in storage:', err);
    }
    emitChange();
  },
};

// Listen for multi-tab storage updates
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'teamforge.role' || e.key === 'role') {
      const newRole = canonicalRole(e.newValue);
      if (
        newRole &&
        state.allowedRoles.includes(newRole) &&
        newRole !== state.activeRole
      ) {
        state = { ...state, activeRole: newRole };
        emitChange();
      }
    }
  });
}

export function useActiveRole() {
  const snapshot = useSyncExternalStore(
    roleStore.subscribe,
    roleStore.getSnapshot,
    roleStore.getServerSnapshot
  );

  return {
    activeRole: snapshot.activeRole,
    currentRole: snapshot.activeRole, // backward compatibility
    allowedRoles: snapshot.allowedRoles,
    availableRoles: snapshot.allowedRoles, // backward compatibility
    status: snapshot.status,
    switchRole: roleStore.switchRole,
    setActiveRole: roleStore.setActiveRole,
    isMentorApproved: snapshot.allowedRoles.includes(ROLE_CANONICAL.MENTOR),
    homePath: roleStore.getHomePath(snapshot.activeRole),
  };
}

export const useRole = useActiveRole;
export default roleStore;
