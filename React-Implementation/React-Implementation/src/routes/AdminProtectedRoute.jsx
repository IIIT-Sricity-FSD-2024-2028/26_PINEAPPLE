import { Navigate, Outlet } from 'react-router-dom';

const AdminProtectedRoute = () => {
  // Check if the user has an admin token or portal role
  const role = sessionStorage.getItem('teamforge.portalRole') || sessionStorage.getItem('portalRole');
  const token = sessionStorage.getItem('teamforge.adminToken') || sessionStorage.getItem('adminToken');

  if (!role || !token) {
    // Redirect to the landing page if there is no valid portal session
    return <Navigate to="/" replace />;
  }

  // If authenticated, render the child routes (AdminDashboard, etc.)
  return <Outlet />;
};

export default AdminProtectedRoute;
