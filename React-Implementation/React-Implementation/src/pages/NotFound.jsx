import { Link } from 'react-router-dom';

const NotFound = () => {
  return (
    <div
      style={{
        minHeight: '70vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '2rem',
        fontFamily: 'inherit',
      }}
    >
      <h1 style={{ fontSize: '4.5rem', fontWeight: 800, color: '#4f46e5', margin: 0 }}>404</h1>
      <h2 style={{ fontSize: '1.75rem', fontWeight: 600, marginTop: '0.5rem', marginBottom: '1rem', color: 'inherit' }}>
        Page Not Found
      </h2>
      <p style={{ color: '#6b7280', maxWidth: '480px', marginBottom: '2rem', lineHeight: 1.5 }}>
        The page you are looking for might have been moved, renamed, or no longer exists.
      </p>
      <Link
        to="/"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '0.75rem 1.5rem',
          backgroundColor: '#4f46e5',
          color: '#ffffff',
          fontWeight: 500,
          borderRadius: '0.5rem',
          textDecoration: 'none',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}
      >
        Return to Home
      </Link>
    </div>
  );
};

export default NotFound;
