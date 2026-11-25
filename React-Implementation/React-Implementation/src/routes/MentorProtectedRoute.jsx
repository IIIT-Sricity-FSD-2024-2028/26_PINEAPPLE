import { useEffect } from 'react';
import { useLocation, Navigate, Outlet } from 'react-router-dom';
import { roleStore, useActiveRole, ROLE_CANONICAL } from '../utils/roleStore';

const MentorProtectedRoute = () => {
  const location = useLocation();
  const { allowedRoles } = useActiveRole();

  const isMentorAllowed =
    allowedRoles.includes(ROLE_CANONICAL.MENTOR) ||
    allowedRoles.includes('Mentor') ||
    allowedRoles.includes('admin') ||
    allowedRoles.includes('superuser');

  useEffect(() => {
    if (isMentorAllowed && location.pathname.startsWith('/mentor') && location.pathname !== '/mentor/apply') {
      roleStore.setActiveRole(ROLE_CANONICAL.MENTOR);
    }
  }, [isMentorAllowed, location.pathname]);

  if (!isMentorAllowed) {
    return <Navigate to="/mentor/apply" replace />;
  }

  return <Outlet />;
};

export default MentorProtectedRoute;
