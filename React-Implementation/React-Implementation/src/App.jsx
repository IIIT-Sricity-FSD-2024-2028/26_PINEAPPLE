import { useState, useEffect } from "react";
import AppRoutes from "./routes/AppRoutes";
import { AuthProvider } from "./context/AuthContext";
import { RoleProvider } from "./context/RoleContext";
import { UIProvider } from "./context/UIContext";
import { NotificationProvider } from "./context/NotificationContext";
import ErrorBoundary from "./components/common/ErrorBoundary";
import adminApi from "./services/adminApi";

function MaintenanceScreen({ message }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f8fafc',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      padding: '24px',
    }}>
      <div style={{
        maxWidth: '520px',
        width: '100%',
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        padding: '40px',
        textAlign: 'center',
        border: '1px solid #e2e8f0',
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          backgroundColor: '#fef3c7',
          color: '#d97706',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '32px',
          margin: '0 auto 20px',
        }}>
          🔧
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>
          Platform Under Maintenance
        </h1>
        <p style={{ fontSize: '15px', color: '#64748b', lineHeight: '1.6', marginBottom: '28px' }}>
          {message || 'TeamForge is currently undergoing scheduled platform upgrades and maintenance. Standard user access is temporarily disabled.'}
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              backgroundColor: '#f1f5f9',
              color: '#334155',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Check Status
          </button>
          <a
            href="/admin/login"
            style={{
              padding: '10px 20px',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            Portal Login &rarr;
          </a>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [maintenance, setMaintenance] = useState(false);
  const [maintenanceMsg, setMaintenanceMsg] = useState('');

  const isAdminRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');

  useEffect(() => {
    const handleMaintenanceEvent = (e) => {
      if (!window.location.pathname.startsWith('/admin')) {
        setMaintenance(true);
        if (e.detail?.message) setMaintenanceMsg(e.detail.message);
      }
    };
    window.addEventListener('teamforge:maintenance', handleMaintenanceEvent);

    if (!isAdminRoute) {
      adminApi.getPublicConfig()
        .then((cfg) => {
          if (cfg && cfg.maintenanceMode) {
            setMaintenance(true);
          }
        })
        .catch(() => {});
    }

    return () => window.removeEventListener('teamforge:maintenance', handleMaintenanceEvent);
  }, [isAdminRoute]);

  if (maintenance && !isAdminRoute) {
    return <MaintenanceScreen message={maintenanceMsg} />;
  }

  return (
    <ErrorBoundary>
      <AuthProvider>
        <RoleProvider>
          <UIProvider>
            <NotificationProvider>
              <AppRoutes />
            </NotificationProvider>
          </UIProvider>
        </RoleProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;