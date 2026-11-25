import { useContext } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, user, loading, status } = useContext(AuthContext);

  if (loading || status === 'loading' || status === 'signing_out') {
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

  // Behavior: If not authenticated, redirect to Login
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // If authenticated but profile is incomplete, force complete-profile step
  if (user?.profileComplete === false) {
    return <Navigate to="/complete-profile" replace />;
  }

  // Otherwise, render the protected child routes or children
  return children ? children : <Outlet />;
};

export default ProtectedRoute;
