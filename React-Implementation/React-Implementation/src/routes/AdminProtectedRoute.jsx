import { Navigate, Outlet } from 'react-router-dom';

const AdminProtectedRoute = () => {
  // Check if the user has an admin token or portal role
  const role = sessionStorage.getItem('teamforge.portalRole');
  const token = sessionStorage.getItem('teamforge.adminToken');

  if (!role || !token) {
    // Redirect to admin login if they are not authenticated as an admin
    return <Navigate to="/admin/login" replace />;
  }

  // If authenticated, render the child routes (AdminDashboard, etc.)
  return <Outlet />;
};

export default AdminProtectedRoute;
