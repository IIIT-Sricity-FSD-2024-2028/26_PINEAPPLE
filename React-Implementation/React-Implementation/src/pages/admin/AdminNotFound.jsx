import { Link } from 'react-router-dom';

const AdminNotFound = () => {
  return (
    <div
      data-testid="admin-not-found"
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '2rem',
      }}
    >
      <div style={{ fontSize: '3.5rem', fontWeight: 800, color: '#4f46e5', lineHeight: 1 }}>
        404
      </div>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginTop: '0.75rem', marginBottom: '0.5rem' }}>
        Page not found
      </h1>
      <p style={{ color: '#64748b', maxWidth: '460px', marginBottom: '1.5rem', lineHeight: 1.5 }}>
        The admin portal page you requested does not exist or has been moved.
      </p>
      <Link
        to="/admin"
        data-testid="admin-not-found-dashboard-link"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '0.65rem 1.25rem',
          backgroundColor: '#4f46e5',
          color: '#ffffff',
          fontWeight: 600,
          borderRadius: '0.5rem',
          textDecoration: 'none',
        }}
      >
        Back to Admin Dashboard
      </Link>
    </div>
  );
};

export default AdminNotFound;
