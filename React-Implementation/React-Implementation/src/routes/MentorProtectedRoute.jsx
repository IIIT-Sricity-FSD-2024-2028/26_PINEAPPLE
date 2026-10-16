import { useContext } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { RoleContext } from '../context/RoleContext';

const MentorProtectedRoute = () => {
  const { isMentorApproved } = useContext(RoleContext);

  if (!isMentorApproved) {
    return <Navigate to="/mentor/apply" replace />;
  }

  return <Outlet />;
};

export default MentorProtectedRoute;
