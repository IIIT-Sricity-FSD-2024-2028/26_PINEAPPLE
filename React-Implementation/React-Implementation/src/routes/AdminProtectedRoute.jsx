import { useSelector } from 'react-redux';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getCurrentAuthMode } from '../store/thunks/sessionThunks';
import {
  selectAuthLoading,
  selectAuthStatus,
  selectIsAdminAuthenticated,
} from '../store/selectors/sessionSelectors';

const AdminProtectedRouteContent = ({ awaitingAdminRestore = false }) => {
  const isAdminAuthenticated = useSelector(selectIsAdminAuthenticated);
  const loading = useSelector(selectAuthLoading);
  const status = useSelector(selectAuthStatus);
  const adminBootstrapStatus = useSelector(
    (state) => state?.session?.adminBootstrapStatus || 'idle',
  );
  const location = useLocation();
  const authMode = getCurrentAuthMode();

  if (
    !isAdminAuthenticated &&
    authMode !== 'legacy' &&
    (loading ||
      status === 'loading' ||
      status === 'signing_out' ||
      adminBootstrapStatus === 'loading' ||
      awaitingAdminRestore)
  ) {
    return (
      <div
        data-testid="auth-loading-screen"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '60vh',
          fontSize: '1.1rem',
          color: '#666',
        }}
      >
        {status === 'signing_out' ? 'Signing out...' : 'Authenticating...'}
      </div>
    );
  }

  if (!isAdminAuthenticated) {
    const requestedPath = `${location.pathname || ''}${location.search || ''}${location.hash || ''}`;
    const hasAdminSubpath =
      requestedPath.startsWith('/admin/') &&
      !requestedPath.startsWith('/admin/login');
    const loginTarget = hasAdminSubpath
      ? `/admin/login?next=${encodeURIComponent(requestedPath)}`
      : '/admin/login';

    return <Navigate to={loginTarget} replace />;
  }

  return <Outlet />;
};

const AdminProtectedRoute = AdminProtectedRouteContent;

export default AdminProtectedRoute;
