import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { onAuthStateChanged, signOut as fbSignOut } from 'firebase/auth';
import { auth } from '../services/firebase.js';
import { authApi } from '../services/authApi.js';
import {
  setAccessToken,
  getAuthMode,
  checkServerBoot,
  resetServerRestartGuard,
} from '../services/apiClient.js';
import tokenManager from '../services/tokenManager.js';
import { recordPortalAuditEntry } from '../services/adminApi.js';
import storage from '../utils/storage.js';
import { roleStore } from '../utils/roleStore.js';

export const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

function mapMeToUser(me, fbUser = null, tokenResult = null) {
  if (!me || (!me.uid && !me.id && !fbUser)) return null;
  const uid = me.uid || me.id || fbUser?.uid;
  const profile = me.profile || {};
  const role = me.role || tokenResult?.claims?.role || 'Collaborator';
  return {
    id: uid,
    uid,
    email: me.email || fbUser?.email || '',
    name: me.name || profile.fullName || fbUser?.displayName || '',
    username: me.username || profile.username || '',
    avatar: me.avatar || profile.avatar || '',
    university: me.university || profile.university || '',
    bio: me.bio || profile.bio || '',
    skills: me.skills || profile.skills || [],
    profile,
    xp: me.xp,
    phone: me.phone,
    phoneVerified: Boolean(me.phoneVerified),
    role,
    permissions: me.permissions || [],
    claims: me.claims || tokenResult?.claims || {},
    mentorUnlocked: Boolean(me.mentorUnlocked || profile.mentorUnlocked || String(role).toLowerCase() === 'mentor'),
    profileComplete: me.profileComplete !== false,
    needsUsernameConfirmation: Boolean(me.needsUsernameConfirmation),
    emailVerified:
      typeof me.emailVerified === 'boolean'
        ? me.emailVerified
        : fbUser
          ? Boolean(fbUser.emailVerified)
          : true,
    hasPassword: typeof me.hasPassword === 'boolean' ? me.hasPassword : undefined,
  };
}

export const AuthProvider = ({ children }) => {
  const mode = getAuthMode();

  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(mode === 'legacy' ? 'authenticated' : 'loading');
  const [loading, setLoading] = useState(mode !== 'legacy');

  const bcRef = useRef(null);
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const refreshUser = useCallback(async () => {
    if (mode === 'legacy') {
      const legacyId = storage.getBackendUserId();
      if (!legacyId) {
        setUser(null);
        setStatus('signed_out');
        return null;
      }
      try {
        const me = await authApi.getMe();
        const mapped = mapMeToUser(me);
        if (mapped) {
          setUser(mapped);
          setStatus('authenticated');
          return mapped;
        }
      } catch (err) {
        console.warn('[AuthContext] Failed loading legacy /auth/me:', err);
      }
      return null;
    }

    if (mode === 'firebase' && auth.currentUser) {
      try {
        const token = await auth.currentUser.getIdToken();
        setAccessToken(token);
      } catch (err) {
        console.warn('[AuthContext] Failed obtaining Firebase token for refreshUser:', err);
      }
    }

    const me = await authApi.getMe();
    const mapped = mapMeToUser(me, mode === 'firebase' ? auth.currentUser : null);
    setUser(mapped);
    if (mapped) {
      setStatus('authenticated');
    }
    return mapped;
  }, [mode]);

  useEffect(() => {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('teamforge_auth');
      bcRef.current = bc;
      bc.onmessage = (event) => {
        if (event.data?.type === 'LOGOUT') {
          setAccessToken(null);
          storage.clearUserSessionKeys();
          setUser(null);
        }
      };
      return () => {
        bc.close();
      };
    }
    return undefined;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleSessionInvalid = () => {
      setAccessToken(null);
      setUser(null);
      setStatus('signed_out');
      setLoading(false);
    };
    window.addEventListener('teamforge:session_invalid', handleSessionInvalid);
    return () => {
      window.removeEventListener('teamforge:session_invalid', handleSessionInvalid);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    if (mode === 'legacy') {
      Promise.resolve().then(() => {
        if (isMounted) {
          setStatus(user ? 'authenticated' : (storage.getBackendUserId() ? 'authenticated' : 'signed_out'));
          setLoading(false);
        }
      });
      return () => {
        isMounted = false;
      };
    }

    if (mode === 'firebase') {
      let unsubscribe = () => {};
      (async () => {
        const bootInfo = await checkServerBoot();
        if (!isMounted || bootInfo?.restarted) {
          if (isMounted) {
            setUser(null);
            setStatus('signed_out');
            setLoading(false);
          }
          return;
        }
        unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
          if (!isMounted) return;
          if (fbUser) {
            try {
              const token = await fbUser.getIdToken();
              setAccessToken(token);
              const tokenResult = await fbUser.getIdTokenResult();
              const me = await authApi.getMe().catch(() => null);
              if (!isMounted) return;
              if (me) {
                setUser(mapMeToUser(me, fbUser, tokenResult));
                setStatus('authenticated');
              } else {
                const fallback = mapMeToUser(null, fbUser, tokenResult);
                setUser(fallback);
                setStatus(fallback ? 'authenticated' : 'signed_out');
              }
            } catch (e) {
              console.warn('[AuthContext] Error loading Firebase session from /auth/me:', e);
              if (isMounted) {
                setUser(null);
                setStatus('signed_out');
              }
            }
          } else {
            setAccessToken(null);
            setUser(null);
            setStatus('signed_out');
          }
          if (isMounted) setLoading(false);
        });
      })();

      return () => {
        isMounted = false;
        unsubscribe();
      };
    }

    if (mode === 'jwt') {
      (async () => {
        try {
          const bootInfo = await checkServerBoot();
          if (!isMounted || bootInfo?.restarted) {
            if (isMounted) {
              setUser(null);
              setStatus('signed_out');
            }
            return;
          }
          let res = await tokenManager.refresh();
          if (!res) {
            try {
              const refreshRes = await authApi.refresh();
              res = refreshRes?.accessToken || null;
            } catch {
              // fallback silent
            }
          }
          if (!isMounted) return;
          if (res) {
            setAccessToken(res);
            try {
              const me = await authApi.getMe();
              if (isMounted && (me?.uid || me?.id)) {
                setUser(mapMeToUser(me));
                setStatus('authenticated');
              } else if (isMounted) {
                setUser(null);
                setStatus('signed_out');
              }
            } catch (err) {
              console.warn('[AuthContext] Error retrieving /auth/me profile:', err);
              if (isMounted) {
                setUser(null);
                setStatus('signed_out');
              }
            }
          } else if (isMounted) {
            setUser(null);
            setStatus('signed_out');
          }
        } catch (err) {
          console.warn('[AuthContext] Refresh session failed on mount:', err);
          if (isMounted) {
            setUser(null);
            setStatus('signed_out');
          }
        } finally {
          if (isMounted) setLoading(false);
        }
      })();

      // Initialize proactive silent refresh listeners for focus and visibility change
      tokenManager.initListeners();

      // Proactive renew interval: check every 60s, renew if near expiry (survives quiet tabs, never skips when hidden)
      const refreshInterval = setInterval(() => {
        if (tokenManager.hasRefreshToken() && tokenManager.isNearExpiry(120)) {
          tokenManager
            .refresh()
            .then((tok) => {
              if (tok && isMounted) {
                setAccessToken(tok);
              }
            })
            .catch((err) => {
              console.warn('[AuthContext] Proactive token refresh error:', err);
            });
        }
      }, 60 * 1000);

      return () => {
        isMounted = false;
        clearInterval(refreshInterval);
      };
    }

    return undefined;
  }, [mode]);

  // Reload live user from GET /auth/me on tab focus / visibility return so emailVerified & profile stay synced
  useEffect(() => {
    if (mode === 'legacy' || typeof window === 'undefined') return undefined;
    let lastFocusRefresh = 0;
    const handleVisibilitySync = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (!userRef.current) return;
      const now = Date.now();
      if (now - lastFocusRefresh > 2000) {
        lastFocusRefresh = now;
        refreshUser().catch(() => {});
      }
    };
    window.addEventListener('focus', handleVisibilitySync);
    document.addEventListener('visibilitychange', handleVisibilitySync);
    return () => {
      window.removeEventListener('focus', handleVisibilitySync);
      document.removeEventListener('visibilitychange', handleVisibilitySync);
    };
  }, [mode, refreshUser]);

  const login = useCallback(async (userDataOrCredentials) => {
    resetServerRestartGuard();
    setLoading(true);
    setStatus('loading');

    try {
      if (mode === 'jwt') {
        let res;
        // Accept either an existing auth response (e.g. from social signup) or credentials
        if (userDataOrCredentials && userDataOrCredentials.accessToken) {
          res = userDataOrCredentials;
        } else {
          res = await authApi.login(userDataOrCredentials);
        }

        tokenManager.setTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
        setAccessToken(res.accessToken);

        // Clear any leftover restart or session notice now that authentication succeeded
        storage.consumeServerRestartNotice();
        storage.consumeSessionEndedNotice();

        let mapped = null;
        try {
          mapped = await refreshUser();
        } catch {
          // Fallback to login payload if /auth/me not mocked in isolated unit test
        }

        if (!mapped) {
          mapped = mapMeToUser({
            uid: res.user?.id,
            id: res.user?.id,
            email: res.user?.email,
            name: res.user?.name || res.user?.username || '',
            username: res.user?.username || '',
            role: res.user?.role || 'Collaborator',
            claims: { role: res.user?.role },
            profileComplete: res.user?.profileComplete !== false,
            needsUsernameConfirmation: Boolean(res.user?.usernameAutoGenerated || res.user?.needsUsernameConfirmation),
            emailVerified: res.user?.emailVerified !== false,
          });
        }

        setUser(mapped);
        setStatus('authenticated');
        setLoading(false);
        return mapped;
      }

      if (mode === 'firebase') {
        storage.consumeServerRestartNotice();
        storage.consumeSessionEndedNotice();
        if (userDataOrCredentials?.id) {
          setUser(userDataOrCredentials);
          setStatus('authenticated');
        }
        setLoading(false);
        return userDataOrCredentials;
      }

      const id = userDataOrCredentials?.id ? String(userDataOrCredentials.id) : '';
      if (id) {
        storage.setBackendUserId(id);
      }
      roleStore.initialise(userDataOrCredentials);
      storage.consumeServerRestartNotice();
      storage.consumeSessionEndedNotice();
      setUser(userDataOrCredentials);
      setStatus('authenticated');
      setLoading(false);
      return userDataOrCredentials;
    } catch (err) {
      setLoading(false);
      setStatus('signed_out');
      throw err;
    }
  }, [mode, refreshUser]);

  const signup = useCallback(async (payload) => {
    resetServerRestartGuard();
    setLoading(true);
    setStatus('loading');

    try {
      if (mode === 'jwt') {
        const res = await authApi.signup(payload);
        tokenManager.setTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
        setAccessToken(res.accessToken);

        storage.consumeServerRestartNotice();
        storage.consumeSessionEndedNotice();

        let mapped = null;
        try {
          mapped = await refreshUser();
        } catch {
          // Fallback if /auth/me not available in isolated test
        }

        if (!mapped) {
          mapped = mapMeToUser({
            uid: res.user?.id,
            id: res.user?.id,
            email: res.user?.email,
            name: res.user?.name || '',
            username: res.user?.username || '',
            role: res.user?.role || 'Collaborator',
            profileComplete: res.user?.profileComplete !== false,
            needsUsernameConfirmation: false,
            emailVerified: res.user?.emailVerified !== false,
          });
        }

        setUser(fallbackUser => mapped);
        setStatus('authenticated');
        setLoading(false);
        return mapped;
      }

      setLoading(false);
      return null;
    } catch (err) {
      setLoading(false);
      setStatus('signed_out');
      throw err;
    }
  }, [mode, refreshUser]);

  const logout = useCallback(
    async (options = {}) => {
      const { reason = 'user_initiated', message = null } = options;
      setStatus('signing_out');

      // 1. Stop every poll, scheduled refresh, and listener
      tokenManager.clear();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('teamforge:stop_polls'));
      }

      if (userRef.current) {
        recordPortalAuditEntry({
          action: 'logout',
          actor: userRef.current.name || userRef.current.username || 'User',
          target: 'User Logout',
          event: `User "${userRef.current.name || userRef.current.username || 'User'}" logged out`,
        });
      }

      const currentRefreshToken = storage.getRefreshToken();
      if (mode === 'firebase') {
        try {
          await fbSignOut(auth);
        } catch (e) {
          console.warn('Firebase signout failed:', e);
        }
      } else if (mode === 'jwt') {
        try {
          await authApi.logout(currentRefreshToken);
        } catch {
          console.warn('JWT logout failed, proceeding to clear local state');
        }
        setAccessToken(null);
      }

      if (bcRef.current) {
        try {
          bcRef.current.postMessage({ type: 'LOGOUT' });
        } catch {
          console.warn('Failed to broadcast logout message to other tabs');
        }
      }

      try {
        storage.clearUserSessionKeys();
        storage.clearAdminSession();
        roleStore.reset();
        if (message) {
          storage.setSessionEndedNotice(message);
        } else if (reason === 'session_expired' || reason === 'session_ended') {
          storage.setSessionEndedNotice('Your session ended. Please log in again.');
        }
      } catch (err) {
        console.warn('[AuthContext] Error cleaning up local session keys on logout:', err);
      }

      setUser(null);
      setStatus('signed_out');
    },
    [mode],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleForceLogout = (e) => {
      logout({
        reason: e?.detail?.reason || 'session_expired',
        message: e?.detail?.message || 'Your session ended. Please log in again.',
      });
    };
    window.addEventListener('teamforge:force_logout', handleForceLogout);
    return () => {
      window.removeEventListener('teamforge:force_logout', handleForceLogout);
    };
  }, [logout]);

  const updateUser = useCallback((updatedData) => {
    setUser((prev) => ({ ...(prev || {}), ...updatedData }));
  }, []);

  const refreshToken = useCallback(async (force = true) => {
    if (mode === 'firebase') {
      if (auth.currentUser) {
        const token = await auth.currentUser.getIdToken(force);
        setAccessToken(token);
        await refreshUser().catch(() => {});
        return token;
      }
    } else if (mode === 'jwt') {
      const res = await tokenManager.refresh({ force });
      if (res) {
        setAccessToken(res);
        await refreshUser().catch(() => {});
        return res;
      }
    }
    return null;
  }, [mode, refreshUser]);

  const isAuthenticated = Boolean(user?.id) && status !== 'signing_out' && status !== 'signed_out';
  const effectiveLoading = status === 'loading' || loading;

  return (
    <AuthContext.Provider
      value={{
        user,
        status,
        isAuthenticated,
        loading: effectiveLoading,
        login,
        signup,
        logout,
        updateUser,
        refreshUser,
        refreshToken,
        authMode: mode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
