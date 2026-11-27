import { useSelector } from 'react-redux';
import { Navigate, Outlet } from 'react-router-dom';
import { getCurrentAuthMode } from '../store/thunks/sessionThunks';
import {
  selectAuthLoading,
  selectAuthStatus,
  selectCurrentUser,
  selectIsAuthenticated,
} from '../store/selectors/sessionSelectors';

const ProtectedRouteContent = ({ children }) => {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const user = useSelector(selectCurrentUser);
  const loading = useSelector(selectAuthLoading);
  const status = useSelector(selectAuthStatus);
  const initialized = useSelector((state) => Boolean(state?.session?.initialized));
  const authMode = getCurrentAuthMode();

  if (
    loading ||
    status === 'loading' ||
    status === 'signing_out' ||
    (status === 'idle' && !initialized && authMode !== 'legacy')
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

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user?.profileComplete === false) {
    return <Navigate to="/complete-profile" replace />;
  }

  return children ? children : <Outlet />;
};

const ProtectedRoute = ProtectedRouteContent;

export default ProtectedRoute;
