import { createContext, useState, useContext, useEffect, useRef, useCallback } from 'react';
import { AuthContext } from './AuthContext';
import mentorApplicationsApi from '../services/mentorApplicationsApi';
import { roleStore, useActiveRole, useRole } from '../utils/roleStore';

export { useActiveRole, useRole };
export const ActiveRoleContext = createContext();
export const RoleContext = ActiveRoleContext;

export const RoleProvider = ({ children }) => {
  const { user, refreshToken } = useContext(AuthContext) || {};
  const activeRoleData = useActiveRole();
  const { activeRole, allowedRoles, switchRole, setActiveRole, isMentorApproved } = activeRoleData;

  const [mentorAppStatus, setMentorAppStatus] = useState(() => {
    if (user?.mentorUnlocked || user?.profile?.mentorUnlocked || String(user?.role || '').toLowerCase() === 'mentor') {
      return 'approved';
    }
    return null;
  });

  // Initialise role store when user loads or updates
  useEffect(() => {
    if (user) {
      roleStore.initialise(user, { isMentorApproved: isMentorApproved || mentorAppStatus === 'approved' });
    } else {
      roleStore.reset();
    }
  }, [user, user?.id, user?.role, user?.mentorUnlocked, isMentorApproved, mentorAppStatus]);

  const evaluateMentorStatus = useCallback(async () => {
    if (!user?.id || user?.profileComplete === false) {
      roleStore.setMentorApproved(false);
      setMentorAppStatus(null);
      return { isApproved: false, status: null };
    }

    // Fast check for explicit mentor status
    const isExplicit = Boolean(
      user?.mentorUnlocked ||
      user?.profile?.mentorUnlocked ||
      String(user?.role || '').toLowerCase() === 'mentor'
    );

    if (isExplicit) {
      roleStore.setMentorApproved(true);
      setMentorAppStatus('approved');
      return { isApproved: true, status: 'approved' };
    }

    try {
      let data = null;
      try {
        data = await mentorApplicationsApi.getMyStatus({ userId: user.id });
      } catch (err) {
        // Silently catch network or 404 errors
      }

      if (data && data.status !== undefined) {
        const status = String(data.status || '').toLowerCase();
        const approved = Boolean(data.mentorUnlocked || status === 'approved');
        roleStore.setMentorApproved(approved);
        setMentorAppStatus(status || (approved ? 'approved' : null));
        return { isApproved: approved, status };
      }

      let apps = [];
      try {
        apps = await mentorApplicationsApi.list({ userId: user.id });
      } catch (err) {
        // Silently catch network errors
      }

      const list = Array.isArray(apps) ? apps : [];
      list.sort((a, b) => {
        const timeA = new Date(a.createdAt || a.applicationDate || 0).getTime();
        const timeB = new Date(b.createdAt || b.applicationDate || 0).getTime();
        return timeB - timeA;
      });

      const activeList = list.filter((a) => a.status !== 'superseded');
      const latestApp = activeList[0] || list[0];
      const everApproved = list.some((a) => a.status === 'approved');

      if (latestApp) {
        const status = String(latestApp.status || '').toLowerCase();
        const approved = everApproved || status === 'approved';
        setMentorAppStatus(status);
        roleStore.setMentorApproved(approved);
        return { isApproved: approved, status };
      }

      roleStore.setMentorApproved(everApproved);
      setMentorAppStatus(everApproved ? 'approved' : null);
      return { isApproved: everApproved, status: everApproved ? 'approved' : null };
    } catch {
      return { isApproved: isExplicit, status: isExplicit ? 'approved' : null };
    }
  }, [user?.id, user?.profileComplete, user?.mentorUnlocked, user?.profile?.mentorUnlocked, user?.role]);

  useEffect(() => {
    if (user?.id) {
      evaluateMentorStatus().catch(() => {});
    }

    const handleFocus = () => {
      if (user?.id) evaluateMentorStatus().catch(() => {});
    };

    const handleStatusUpdate = () => {
      if (user?.id) {
        evaluateMentorStatus().catch(() => {});
        if (typeof refreshToken === 'function') {
          refreshToken(true).catch(() => {});
        }
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('teamforge:mentor_status_updated', handleStatusUpdate);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('teamforge:mentor_status_updated', handleStatusUpdate);
    };
  }, [user?.id, evaluateMentorStatus, refreshToken]);

  const refreshMentorStatus = async () => {
    const res = await evaluateMentorStatus();
    if (res?.isApproved && typeof refreshToken === 'function') {
      try {
        await refreshToken(true);
      } catch {
        // silent
      }
    }
    return res;
  };

  const unlockMentor = () => {
    roleStore.setMentorApproved(true);
    setMentorAppStatus('approved');
  };

  const contextValue = {
    currentRole: activeRole,
    activeRole,
    availableRoles: allowedRoles,
    allowedRoles,
    switchRole,
    setActiveRole,
    isMentorApproved,
    mentorAppStatus,
    refreshMentorStatus,
    unlockMentor,
  };

  return (
    <ActiveRoleContext.Provider value={contextValue}>
      {children}
    </ActiveRoleContext.Provider>
  );
};
