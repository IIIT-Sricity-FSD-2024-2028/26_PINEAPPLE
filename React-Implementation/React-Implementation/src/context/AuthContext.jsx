import { createContext, useState, useEffect } from 'react';
import { recordPortalAuditEntry } from '../services/adminApi';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  useEffect(() => {
    try {
      if (typeof localStorage === 'undefined') return;
      if (localStorage.getItem('teamforge.inviteCleanupDone_v1')) return;

      // 1. Remove obsolete invite storage keys
      localStorage.removeItem('teamforge.invites');
      localStorage.removeItem('runtime.invites');
      localStorage.removeItem('invites');

      // 2. Strip legacy invite keys from stored projects if any
      const projectKeys = ['teamforge.projects', 'runtime.projects', 'teamforge.mock_projects'];
      for (const key of projectKeys) {
        const stored = localStorage.getItem(key);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
              let changed = false;
              const cleaned = parsed.map((p) => {
                if (p && (p.invites || p.pendingInvites || p.projectInvites)) {
                  changed = true;
                  const copy = { ...p };
                  delete copy.invites;
                  delete copy.pendingInvites;
                  delete copy.projectInvites;
                  return copy;
                }
                return p;
              });
              if (changed) {
                localStorage.setItem(key, JSON.stringify(cleaned));
              }
            }
          } catch {
            /* ignore parse errors */
          }
        }
      }

      // 3. Mark leftover invite notifications as read if stored locally
      const notifKeys = ['teamforge.notifications', 'runtime.notifications'];
      for (const key of notifKeys) {
        const stored = localStorage.getItem(key);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
              let changed = false;
              const cleaned = parsed.map((n) => {
                const type = String(n?.type || '').toUpperCase();
                const text = String(n?.text || n?.message || '').toLowerCase();
                if (type === 'INVITE' || type === 'PROJECT_INVITE' || text.includes('invited')) {
                  changed = true;
                  return { ...n, isRead: true, read: true, readStatus: true };
                }
                return n;
              });
              if (changed) {
                localStorage.setItem(key, JSON.stringify(cleaned));
              }
            }
          } catch {
            /* ignore parse errors */
          }
        }
      }

      localStorage.setItem('teamforge.inviteCleanupDone_v1', 'true');
    } catch (e) {
      console.warn('Invite cleanup error:', e);
    }
  }, []);

  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("teamforge.currentUser");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    try {
      return Boolean(localStorage.getItem("teamforge.backendUserId"));
    } catch {
      return false;
    }
  });

  const login = (userData) => {
    // Clear any leftover un-scoped storage from previous sessions
    try {
      localStorage.removeItem("teamforge.userProfile");
      localStorage.removeItem("teamforge.notificationSettings");
      localStorage.removeItem("teamforge.privacySettings");
      localStorage.removeItem("teamforge.notifications");
    } catch {
      /* ignore */
    }

    const id = userData?.id ? String(userData.id) : "";
    if (id) {
      localStorage.setItem("teamforge.backendUserId", id);
    } else {
      localStorage.removeItem("teamforge.backendUserId");
    }

    if (userData) {
      localStorage.setItem("teamforge.currentUser", JSON.stringify(userData));
    }
    // Always start newly logged in user in the Collaborator role
    sessionStorage.setItem("teamforge.role", "Collaborator");
    sessionStorage.removeItem("teamforge.isSuperUser");
    setUser(userData);
    setIsAuthenticated(Boolean(id));
  };

  const logout = () => {
    if (user) {
      recordPortalAuditEntry({
        action: 'logout',
        actor: user.name || user.username || 'User',
        target: 'User Logout',
        event: `User "${user.name || user.username || 'User'}" logged out`,
      });
    }

    try {
      localStorage.removeItem("teamforge.backendUserId");
      localStorage.removeItem("teamforge.currentUser");
      localStorage.removeItem("teamforge.userProfile");
      localStorage.removeItem("teamforge.notificationSettings");
      localStorage.removeItem("teamforge.privacySettings");
      localStorage.removeItem("teamforge.notifications");
      sessionStorage.removeItem("teamforge.isSuperUser");
      sessionStorage.setItem("teamforge.role", "Collaborator");
    } catch {
      /* ignore */
    }
    setUser(null);
    setIsAuthenticated(false);
  };

  const updateUser = (updatedData) => {
    setUser((prev) => {
      const next = { ...(prev || {}), ...updatedData };
      localStorage.setItem("teamforge.currentUser", JSON.stringify(next));
      return next;
    });
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};
