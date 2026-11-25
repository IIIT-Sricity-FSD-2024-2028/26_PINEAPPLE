import { Navigate, Outlet } from 'react-router-dom';
import storage from '../utils/storage';

const AdminProtectedRoute = () => {
  // Check if the user has an admin token or portal role
  const { portalRole: role, token } = storage.getAdminSession();

  if (!role || !token) {
    // Redirect to the landing page if there is no valid portal session
    return <Navigate to="/" replace />;
  }

  // If authenticated, render the child routes (AdminDashboard, etc.)
  return <Outlet />;
};

export default AdminProtectedRoute;
