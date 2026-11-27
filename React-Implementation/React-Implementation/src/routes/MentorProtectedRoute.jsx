import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, Navigate, Outlet } from 'react-router-dom';
import { setActiveRole } from '../store/slices/sessionSlice';
import { ROLE_CANONICAL } from '../store/utils/roleHelpers';
import { selectAllowedRoles } from '../store/selectors/sessionSelectors';

const MentorProtectedRouteContent = () => {
  const location = useLocation();
  const dispatch = useDispatch();
  const allowedRoles = useSelector(selectAllowedRoles);

  const isMentorAllowed =
    allowedRoles.includes(ROLE_CANONICAL.MENTOR) ||
    allowedRoles.includes('Mentor') ||
    allowedRoles.includes('admin') ||
    allowedRoles.includes('superuser');

  useEffect(() => {
    if (
      isMentorAllowed &&
      location.pathname.startsWith('/mentor') &&
      location.pathname !== '/mentor/apply'
    ) {
      dispatch(setActiveRole(ROLE_CANONICAL.MENTOR));
    }
  }, [dispatch, isMentorAllowed, location.pathname]);

  if (!isMentorAllowed) {
    return <Navigate to="/mentor/apply" replace />;
  }

  return <Outlet />;
};

const MentorProtectedRoute = MentorProtectedRouteContent;

export default MentorProtectedRoute;
