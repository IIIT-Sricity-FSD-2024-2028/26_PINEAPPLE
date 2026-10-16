import { useContext } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { RoleContext } from '../context/RoleContext';
import { normalizeRole } from '../services/apiClient';

const OwnerProtectedRoute = () => {
  const { currentRole } = useContext(RoleContext);
  const normalized = normalizeRole(currentRole);

  if (normalized !== 'project-owner' && normalized !== 'admin' && normalized !== 'superuser') {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

export default OwnerProtectedRoute;
