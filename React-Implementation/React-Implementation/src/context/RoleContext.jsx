import { createContext, useState, useContext, useEffect, useRef } from 'react';
import { AuthContext } from './AuthContext';
import mentorApplicationsApi from '../services/mentorApplicationsApi';

export const RoleContext = createContext();

export const RoleProvider = ({ children }) => {
  const { user } = useContext(AuthContext);

  // Initialize with Collaborator default
  const [currentRole, setCurrentRole] = useState(() => {
    try {
      return sessionStorage.getItem("teamforge.role") || "Collaborator";
    } catch {
      return "Collaborator";
    }
  });

  const [isMentorApproved, setIsMentorApproved] = useState(() => {
    if (!user) return false;
    return Boolean(
      user.mentorUnlocked ||
      user.profile?.mentorUnlocked ||
      String(user.role || '').toLowerCase() === 'mentor'
    );
  });
  const [mentorAppStatus, setMentorAppStatus] = useState(null);

  const prevUserIdRef = useRef(user?.id);
  useEffect(() => {
    if (prevUserIdRef.current && user?.id && prevUserIdRef.current !== user.id) {
      setCurrentRole("Collaborator");
      try {
        sessionStorage.setItem("teamforge.role", "Collaborator");
      } catch (err) {
        console.error(err);
      }
    }
    prevUserIdRef.current = user?.id;
  }, [user?.id]);

  useEffect(() => {
    let isMounted = true;

    const checkApproval = async () => {
      if (!user?.id) {
        if (isMounted) {
          setIsMentorApproved(false);
          setMentorAppStatus(null);
        }
        return;
      }

      try {
        const apps = await mentorApplicationsApi.list({ userId: user.id });
        if (!isMounted) return;
        const list = Array.isArray(apps) ? apps : [];
        const myApp = list.find(
          (a) =>
            String(a.userId) === String(user.id) ||
            (user.email && a.email && a.email.toLowerCase() === user.email.toLowerCase())
        );

        if (myApp) {
          const status = String(myApp.status || '').toLowerCase();
          setMentorAppStatus(status);
          if (status === 'approved') {
            setIsMentorApproved(true);
          } else {
            setIsMentorApproved(false);
            if (currentRole === 'Mentor') {
              setCurrentRole('Collaborator');
              sessionStorage.setItem('teamforge.role', 'Collaborator');
            }
          }
        } else {
          // No application on file: user starts with mentorUnlocked = false unless explicitly set
          const isExplicit = Boolean(
            user.mentorUnlocked ||
            user.profile?.mentorUnlocked ||
            String(user.role || '').toLowerCase() === 'mentor'
          );
          setIsMentorApproved(isExplicit);
          setMentorAppStatus(null);
          if (!isExplicit && currentRole === 'Mentor') {
            setCurrentRole('Collaborator');
            sessionStorage.setItem('teamforge.role', 'Collaborator');
          }
        }
      } catch {
        if (!isMounted) return;
        const isExplicit = Boolean(
          user?.mentorUnlocked ||
          user?.profile?.mentorUnlocked ||
          String(user?.role || '').toLowerCase() === 'mentor'
        );
        setIsMentorApproved(isExplicit);
      }
    };

    checkApproval();

    return () => {
      isMounted = false;
    };
  }, [user?.id, user?.email, user?.role, user?.mentorUnlocked, user?.profile?.mentorUnlocked, currentRole]);

  const refreshMentorStatus = async () => {
    if (!user?.id) return;
    try {
      const apps = await mentorApplicationsApi.list({ userId: user.id });
      const list = Array.isArray(apps) ? apps : [];
      const myApp = list.find(
        (a) =>
          String(a.userId) === String(user.id) ||
          (user.email && a.email && a.email.toLowerCase() === user.email.toLowerCase())
      );

      if (myApp) {
        const status = String(myApp.status || '').toLowerCase();
        setMentorAppStatus(status);
        if (status === 'approved') {
          setIsMentorApproved(true);
        } else {
          setIsMentorApproved(false);
        }
      } else {
        const isExplicit = Boolean(
          user.mentorUnlocked ||
          user.profile?.mentorUnlocked ||
          String(user.role || '').toLowerCase() === 'mentor'
        );
        setIsMentorApproved(isExplicit);
        setMentorAppStatus(null);
      }
    } catch (err) {
      console.error('Failed to refresh mentor status:', err);
    }
  };

  const availableRoles = ["Collaborator", "Project Owner", "Mentor"];

  const switchRole = (newRole) => {
    if (newRole === 'Mentor' && !isMentorApproved) {
      return false;
    }
    if (availableRoles.includes(newRole)) {
      setCurrentRole(newRole);
      try {
        sessionStorage.setItem("teamforge.role", newRole);
      } catch (err) {
        console.error(err);
      }
      return true;
    }
    return false;
  };

  const unlockMentor = () => {
    setIsMentorApproved(true);
    setMentorAppStatus('approved');
  };

  return (
    <RoleContext.Provider
      value={{
        currentRole,
        availableRoles,
        switchRole,
        isMentorApproved,
        mentorAppStatus,
        refreshMentorStatus,
        unlockMentor,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
};
