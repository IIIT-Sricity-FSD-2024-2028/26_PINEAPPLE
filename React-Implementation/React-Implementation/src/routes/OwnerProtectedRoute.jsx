import { useEffect } from 'react';
import { useLocation, Navigate, Outlet } from 'react-router-dom';
import { roleStore, useActiveRole, ROLE_CANONICAL } from '../utils/roleStore';

const OwnerProtectedRoute = () => {
  const location = useLocation();
  const { allowedRoles, homePath } = useActiveRole();

  const isOwnerAllowed =
    allowedRoles.includes(ROLE_CANONICAL.PROJECT_OWNER) ||
    allowedRoles.includes('Project Owner') ||
    allowedRoles.includes('admin') ||
    allowedRoles.includes('superuser');

  useEffect(() => {
    if (isOwnerAllowed && location.pathname.startsWith('/owner')) {
      roleStore.setActiveRole(ROLE_CANONICAL.PROJECT_OWNER);
    }
  }, [isOwnerAllowed, location.pathname]);

  if (!isOwnerAllowed) {
    return <Navigate to={homePath || '/dashboard'} replace />;
  }

  return <Outlet />;
};

export default OwnerProtectedRoute;
