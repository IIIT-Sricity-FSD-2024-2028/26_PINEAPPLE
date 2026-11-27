import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, Navigate, Outlet } from 'react-router-dom';
import { setActiveRole } from '../store/slices/sessionSlice';
import { ROLE_CANONICAL } from '../store/utils/roleHelpers';
import {
  selectAllowedRoles,
  selectHomePath,
} from '../store/selectors/sessionSelectors';

const OwnerProtectedRouteContent = () => {
  const location = useLocation();
  const dispatch = useDispatch();
  const allowedRoles = useSelector(selectAllowedRoles);
  const homePath = useSelector(selectHomePath);

  const isOwnerAllowed =
    allowedRoles.includes(ROLE_CANONICAL.PROJECT_OWNER) ||
    allowedRoles.includes('Project Owner') ||
    allowedRoles.includes('admin') ||
    allowedRoles.includes('superuser');

  useEffect(() => {
    if (isOwnerAllowed && location.pathname.startsWith('/owner')) {
      dispatch(setActiveRole(ROLE_CANONICAL.PROJECT_OWNER));
    }
  }, [dispatch, isOwnerAllowed, location.pathname]);

  if (!isOwnerAllowed) {
    return <Navigate to={homePath || '/dashboard'} replace />;
  }

  return <Outlet />;
};

const OwnerProtectedRoute = OwnerProtectedRouteContent;

export default OwnerProtectedRoute;
