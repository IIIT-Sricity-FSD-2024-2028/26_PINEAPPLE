const LOCAL_KEYS = {
  BOOT_ID: 'teamforge.bootId',
  BACKEND_USER_ID: 'teamforge.backendUserId',
  CURRENT_USER: 'teamforge.currentUser',
  USER_PROFILE: 'teamforge.userProfile',
  USER_PROFILE_PREFIX: 'teamforge.userProfile_',
  NOTIFICATIONS: 'teamforge.notifications',
  NOTIFICATION_SETTINGS: 'teamforge.notificationSettings',
  PRIVACY_SETTINGS: 'teamforge.privacySettings',
  PLATFORM_CONFIG: 'teamforge.platformConfig',
  ROLE: 'teamforge.role',
  THEME: 'teamforge.theme',
  API_BASE_URL: 'teamforge.apiBaseUrl',
  REFRESH_TOKEN: 'teamforge.refreshToken',
  INVITES: 'teamforge.invites',
  LEGACY_INVITES: 'invites',
  RUNTIME_INVITES: 'runtime.invites',
};

const SESSION_KEYS = {
  ROLE: 'teamforge.role',
  ADMIN_TOKEN: 'teamforge.adminToken',
  PORTAL_ROLE: 'teamforge.portalRole',
  IS_SUPER_USER: 'teamforge.isSuperUser',
  ADMIN_EMAIL: 'teamforge.adminEmail',
  ADMIN_NAME: 'teamforge.adminName',
  ADMIN_PERMISSIONS: 'teamforge.adminPermissions',
  UID: 'teamforge.uid',
  USER_ID: 'teamforge.userId',
  DEMO_RESET_NOTICE: 'teamforge.demoResetNotice',
  SERVER_RESTART_NOTICE: 'teamforge.serverRestartNotice',
  ACCOUNT_DELETED_NOTICE: 'teamforge.accountDeletedNotice',
  SESSION_ENDED_NOTICE: 'teamforge.sessionEndedNotice',
  LEGACY_ROLE: 'role',
  LEGACY_ADMIN_TOKEN: 'adminToken',
  LEGACY_PORTAL_ROLE: 'portalRole',
  LEGACY_IS_SUPER_USER: 'isSuperUser',
  LEGACY_ADMIN_PERMISSIONS: 'adminPermissions',
  LEGACY_USER_ID: 'userId',
};

function safeLocal() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function safeSession() {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null;
  } catch {
    return null;
  }
}

function removeKeysWithPrefix(store, prefix) {
  if (!store || typeof store.length !== 'number') return;
  const toRemove = [];
  for (let i = 0; i < store.length; i += 1) {
    const key = store.key(i);
    if (key && key.startsWith(prefix)) {
      toRemove.push(key);
    }
  }
  for (const key of toRemove) {
    store.removeItem(key);
  }
}

export const storage = {
  KEYS: { LOCAL: LOCAL_KEYS, SESSION: SESSION_KEYS },

  getBootId() {
    return safeLocal()?.getItem(LOCAL_KEYS.BOOT_ID) || null;
  },

  setBootId(bootId) {
    const ls = safeLocal();
    if (!ls) return;
    if (bootId) ls.setItem(LOCAL_KEYS.BOOT_ID, String(bootId));
    else ls.removeItem(LOCAL_KEYS.BOOT_ID);
  },

  getApiBaseUrl() {
    return safeLocal()?.getItem(LOCAL_KEYS.API_BASE_URL) || '';
  },

  getTheme() {
    return safeLocal()?.getItem(LOCAL_KEYS.THEME) || 'light';
  },

  setTheme(mode) {
    safeLocal()?.setItem(LOCAL_KEYS.THEME, mode === 'dark' ? 'dark' : 'light');
  },

  getRole() {
    const ss = safeSession();
    const ls = safeLocal();
    return ss?.getItem(SESSION_KEYS.ROLE) || ls?.getItem(LOCAL_KEYS.ROLE) || '';
  },

  setRole(role) {
    const ss = safeSession();
    const ls = safeLocal();
    if (role) {
      ss?.setItem(SESSION_KEYS.ROLE, String(role));
      ls?.setItem(LOCAL_KEYS.ROLE, String(role));
    } else {
      ss?.removeItem(SESSION_KEYS.ROLE);
      ls?.removeItem(LOCAL_KEYS.ROLE);
    }
  },

  getBackendUserId() {
    return safeLocal()?.getItem(LOCAL_KEYS.BACKEND_USER_ID) || '';
  },

  setBackendUserId(id) {
    const ls = safeLocal();
    if (!ls) return;
    if (id) ls.setItem(LOCAL_KEYS.BACKEND_USER_ID, String(id));
    else ls.removeItem(LOCAL_KEYS.BACKEND_USER_ID);
  },

  getPlatformConfig() {
    try {
      const raw = safeLocal()?.getItem(LOCAL_KEYS.PLATFORM_CONFIG);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  setPlatformConfig(cfg) {
    const ls = safeLocal();
    if (!ls) return;
    if (cfg && typeof cfg === 'object') {
      ls.setItem(LOCAL_KEYS.PLATFORM_CONFIG, JSON.stringify(cfg));
    } else {
      ls.removeItem(LOCAL_KEYS.PLATFORM_CONFIG);
    }
  },

  getAdminSession() {
    const ss = safeSession();
    if (!ss) {
      return {
        token: null,
        portalRole: null,
        isSuperUser: false,
        email: '',
        name: '',
        permissions: null,
        uid: '',
      };
    }
    const token = ss.getItem(SESSION_KEYS.ADMIN_TOKEN) || ss.getItem(SESSION_KEYS.LEGACY_ADMIN_TOKEN) || null;
    const portalRole = ss.getItem(SESSION_KEYS.PORTAL_ROLE) || ss.getItem(SESSION_KEYS.LEGACY_PORTAL_ROLE) || null;
    const isSuperUserFlag =
      ss.getItem(SESSION_KEYS.IS_SUPER_USER) === 'true' ||
      ss.getItem(SESSION_KEYS.LEGACY_IS_SUPER_USER) === 'true';
    const role = ss.getItem(SESSION_KEYS.ROLE) || '';
    const isSuperUser =
      isSuperUserFlag ||
      portalRole?.toLowerCase() === 'superuser' ||
      portalRole?.toLowerCase() === 'super user' ||
      role?.toLowerCase() === 'superuser' ||
      role?.toLowerCase() === 'super user';

    let permissions = null;
    const rawPerms = ss.getItem(SESSION_KEYS.ADMIN_PERMISSIONS) || ss.getItem(SESSION_KEYS.LEGACY_ADMIN_PERMISSIONS);
    if (rawPerms) {
      try {
        permissions = JSON.parse(rawPerms);
      } catch {
        permissions = null;
      }
    }

    return {
      token,
      portalRole,
      isSuperUser,
      role,
      email: ss.getItem(SESSION_KEYS.ADMIN_EMAIL) || '',
      name: ss.getItem(SESSION_KEYS.ADMIN_NAME) || '',
      permissions,
      uid:
        ss.getItem(SESSION_KEYS.UID) ||
        ss.getItem(SESSION_KEYS.USER_ID) ||
        ss.getItem(SESSION_KEYS.LEGACY_USER_ID) ||
        '',
    };
  },

  setAdminSession({ token, portalRole, email, name, permissions, isSuperUser } = {}) {
    const ss = safeSession();
    if (!ss) return;
    if (token !== undefined) ss.setItem(SESSION_KEYS.ADMIN_TOKEN, String(token));
    if (portalRole !== undefined) ss.setItem(SESSION_KEYS.PORTAL_ROLE, String(portalRole));
    if (email !== undefined) ss.setItem(SESSION_KEYS.ADMIN_EMAIL, String(email));
    if (name !== undefined) ss.setItem(SESSION_KEYS.ADMIN_NAME, String(name));
    if (permissions !== undefined) ss.setItem(SESSION_KEYS.ADMIN_PERMISSIONS, JSON.stringify(permissions));
    if (isSuperUser !== undefined) {
      if (isSuperUser) ss.setItem(SESSION_KEYS.IS_SUPER_USER, 'true');
      else ss.removeItem(SESSION_KEYS.IS_SUPER_USER);
    }
  },

  clearAdminSession() {
    const ss = safeSession();
    if (!ss) return;
    [
      SESSION_KEYS.PORTAL_ROLE,
      SESSION_KEYS.ADMIN_TOKEN,
      SESSION_KEYS.IS_SUPER_USER,
      SESSION_KEYS.ADMIN_PERMISSIONS,
      SESSION_KEYS.ADMIN_EMAIL,
      SESSION_KEYS.ADMIN_NAME,
      SESSION_KEYS.UID,
      SESSION_KEYS.USER_ID,
      SESSION_KEYS.LEGACY_PORTAL_ROLE,
      SESSION_KEYS.LEGACY_ADMIN_TOKEN,
      SESSION_KEYS.LEGACY_IS_SUPER_USER,
      SESSION_KEYS.LEGACY_ADMIN_PERMISSIONS,
      SESSION_KEYS.LEGACY_USER_ID,
    ].forEach((k) => ss.removeItem(k));
  },

  hasStoredSessionKeys() {
    const ls = safeLocal();
    const ss = safeSession();
    return Boolean(
      ls?.getItem(LOCAL_KEYS.BACKEND_USER_ID) ||
      ls?.getItem(LOCAL_KEYS.CURRENT_USER) ||
      ss?.getItem(SESSION_KEYS.ADMIN_TOKEN) ||
      ss?.getItem(SESSION_KEYS.LEGACY_ADMIN_TOKEN) ||
      ss?.getItem(SESSION_KEYS.PORTAL_ROLE),
    );
  },

  setDemoResetNotice(msg) {
    safeSession()?.setItem(SESSION_KEYS.DEMO_RESET_NOTICE, msg);
  },

  consumeDemoResetNotice() {
    const ss = safeSession();
    if (!ss) return '';
    const msg = ss.getItem(SESSION_KEYS.DEMO_RESET_NOTICE) || '';
    if (msg) ss.removeItem(SESSION_KEYS.DEMO_RESET_NOTICE);
    return msg;
  },

  setServerRestartNotice(msg) {
    safeSession()?.setItem(SESSION_KEYS.SERVER_RESTART_NOTICE, msg);
  },

  consumeServerRestartNotice() {
    const ss = safeSession();
    if (!ss) return '';
    const msg = ss.getItem(SESSION_KEYS.SERVER_RESTART_NOTICE) || '';
    if (msg) ss.removeItem(SESSION_KEYS.SERVER_RESTART_NOTICE);
    return msg;
  },

  setAccountDeletedNotice(msg) {
    safeSession()?.setItem(SESSION_KEYS.ACCOUNT_DELETED_NOTICE, msg);
  },

  consumeAccountDeletedNotice() {
    const ss = safeSession();
    if (!ss) return '';
    const msg = ss.getItem(SESSION_KEYS.ACCOUNT_DELETED_NOTICE) || '';
    if (msg) ss.removeItem(SESSION_KEYS.ACCOUNT_DELETED_NOTICE);
    return msg;
  },

  getRefreshToken() {
    return safeLocal()?.getItem(LOCAL_KEYS.REFRESH_TOKEN) || '';
  },

  setRefreshToken(token) {
    const ls = safeLocal();
    if (!ls) return;
    if (!token) {
      ls.removeItem(LOCAL_KEYS.REFRESH_TOKEN);
    } else {
      ls.setItem(LOCAL_KEYS.REFRESH_TOKEN, token);
    }
  },

  clearRefreshToken() {
    safeLocal()?.removeItem(LOCAL_KEYS.REFRESH_TOKEN);
  },

  setSessionEndedNotice(msg) {
    safeSession()?.setItem(SESSION_KEYS.SESSION_ENDED_NOTICE, msg);
  },

  consumeSessionEndedNotice() {
    const ss = safeSession();
    if (!ss) return '';
    const msg = ss.getItem(SESSION_KEYS.SESSION_ENDED_NOTICE) || '';
    if (msg) ss.removeItem(SESSION_KEYS.SESSION_ENDED_NOTICE);
    return msg;
  },

  clearLegacyInviteKeys() {
    const ls = safeLocal();
    if (!ls) return;
    ls.removeItem(LOCAL_KEYS.INVITES);
    ls.removeItem(LOCAL_KEYS.RUNTIME_INVITES);
    ls.removeItem(LOCAL_KEYS.LEGACY_INVITES);
  },

  clearUserSessionKeys() {
    const ls = safeLocal();
    const ss = safeSession();
    if (ls) {
      [
        LOCAL_KEYS.BACKEND_USER_ID,
        LOCAL_KEYS.CURRENT_USER,
        LOCAL_KEYS.USER_PROFILE,
        LOCAL_KEYS.NOTIFICATIONS,
        LOCAL_KEYS.NOTIFICATION_SETTINGS,
        LOCAL_KEYS.PRIVACY_SETTINGS,
        LOCAL_KEYS.ROLE,
        LOCAL_KEYS.REFRESH_TOKEN,
        LOCAL_KEYS.INVITES,
        LOCAL_KEYS.LEGACY_INVITES,
        LOCAL_KEYS.RUNTIME_INVITES,
      ].forEach((k) => ls.removeItem(k));
      removeKeysWithPrefix(ls, LOCAL_KEYS.USER_PROFILE_PREFIX);
    }
    if (ss) {
      ss.removeItem(SESSION_KEYS.IS_SUPER_USER);
      ss.removeItem(SESSION_KEYS.ROLE);
    }
  },

  clearAll() {
    const ls = safeLocal();
    const ss = safeSession();
    if (ls) {
      removeKeysWithPrefix(ls, 'teamforge.');
      [LOCAL_KEYS.LEGACY_INVITES, LOCAL_KEYS.RUNTIME_INVITES].forEach((k) => ls.removeItem(k));
    }
    if (ss) {
      removeKeysWithPrefix(ss, 'teamforge.');
      [
        SESSION_KEYS.LEGACY_ROLE,
        SESSION_KEYS.LEGACY_ADMIN_TOKEN,
        SESSION_KEYS.LEGACY_PORTAL_ROLE,
        SESSION_KEYS.LEGACY_IS_SUPER_USER,
        SESSION_KEYS.LEGACY_ADMIN_PERMISSIONS,
        SESSION_KEYS.LEGACY_USER_ID,
      ].forEach((k) => ss.removeItem(k));
    }
  },
};

export default storage;
