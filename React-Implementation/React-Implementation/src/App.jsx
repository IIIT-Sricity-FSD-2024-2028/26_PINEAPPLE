import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AppRoutes from "./routes/AppRoutes";
import { setAppNavigate } from "./routes/navigationRef";
import ErrorBoundary from "./components/common/ErrorBoundary";
import ToastViewport from "./components/common/ToastViewport";
import RouteResetListener from "./store/components/RouteResetListener";
import { applyThemeTokens } from "./store/utils/themeTokens";
import { setMaintenance } from "./store/slices/uiSlice";
import { resetSlice as resetNotificationsSlice } from "./store/slices/notificationsSlice";
import {
  selectTheme,
  selectMaintenance,
  selectResettingBanner,
} from "./store/selectors/uiSelectors";
import {
  selectCurrentUser,
  selectIsAdminAuthenticated,
} from "./store/selectors/sessionSelectors";
import { selectAllNotifications } from "./store/selectors/notificationsSelectors";
import {
  bootstrapSession,
  evaluateMentorStatus,
  getCurrentAuthMode,
  refreshSessionUser,
  registerRestartRedirectHandler,
  restoreAdminSession,
} from "./store/thunks/sessionThunks";
import { fetchPublicConfig } from "./store/thunks/platformConfigThunks";
import { fetchNotifications } from "./store/thunks/notificationsThunks";
import { useNotificationPolling } from "./hooks/useNotificationPolling";

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
          <Link
            to="/admin/login"
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
          </Link>
        </div>
      </div>
    </div>
  );
}

function App() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useSelector(selectTheme);
  const maintenanceState = useSelector(selectMaintenance);
  const resettingState = useSelector(selectResettingBanner);
  const user = useSelector(selectCurrentUser);
  const isAdminAuthenticated = useSelector(selectIsAdminAuthenticated);
  const adminBootstrapStatus = useSelector(
    (state) => state?.session?.adminBootstrapStatus || 'idle',
  );
  const notifications = useSelector(selectAllNotifications);

  const maintenance = maintenanceState.active;
  const maintenanceMsg = maintenanceState.message;
  const resettingBanner = resettingState.active ? resettingState.message : '';

  const userId = user?.id ?? null;
  const profileComplete = user?.profileComplete;
  const isNotificationsEnabled = Boolean(userId && profileComplete !== false);
  const prevUserIdRef = useRef(userId);
  const prevMentorApprovedRef = useRef(false);

  const isAdminRoute =
    location.pathname === '/admin' || location.pathname.startsWith('/admin/');
  const initialAdminScopeRef = useRef(isAdminRoute);

  useEffect(() => {
    setAppNavigate(navigate);
    registerRestartRedirectHandler((path) => navigate(path, { replace: true }));
    return () => {
      setAppNavigate(null);
      registerRestartRedirectHandler(null);
    };
  }, [navigate]);

  // Bootstrap authentication & session state on mount based on initial route scope
  useEffect(() => {
    if (initialAdminScopeRef.current) {
      dispatch(restoreAdminSession());
    } else {
      dispatch(bootstrapSession());
    }
  }, [dispatch]);

  // Reload live user profile on tab focus/visibility return when authenticated
  useEffect(() => {
    if (!userId || typeof document === 'undefined') return undefined;
    const handleVisibility = () => {
      if (!document.hidden) {
        dispatch(refreshSessionUser());
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [dispatch, userId]);

  // Single store-driven effect applying CSS theme variables to document.documentElement
  useEffect(() => {
    applyThemeTokens(theme);
  }, [theme]);

  useEffect(() => {
    if (!isAdminRoute) {
      dispatch(fetchPublicConfig())
        .unwrap()
        .then((cfg) => {
          if (cfg && cfg.maintenanceMode) {
            dispatch(setMaintenance({ active: true, message: '' }));
          }
        })
        .catch(() => {});
    }
  }, [isAdminRoute, dispatch]);

  useEffect(() => {
    if (prevUserIdRef.current && !userId) {
      dispatch(resetNotificationsSlice());
    }
    prevUserIdRef.current = userId;

    if (!isNotificationsEnabled) return;
    dispatch(fetchNotifications({ userId }));
  }, [dispatch, isNotificationsEnabled, userId]);

  useNotificationPolling(dispatch, {
    userId,
    enabled: isNotificationsEnabled,
    intervalMs: 300000,
    immediate: false,
  });

  useEffect(() => {
    const hasMentorApproval = notifications.some((n) => {
      const type = String(n.type || '').toUpperCase();
      const title = String(n.title || '');
      return (
        type === 'MENTOR_APPLICATION_APPROVED' ||
        title.includes('Mentor Application Approved')
      );
    });
    if (hasMentorApproval && !prevMentorApprovedRef.current) {
      dispatch(evaluateMentorStatus());
    }
    prevMentorApprovedRef.current = hasMentorApproval;
  }, [dispatch, notifications]);

  if (maintenance && !isAdminRoute) {
    return <MaintenanceScreen message={maintenanceMsg} />;
  }

  return (
    <ErrorBoundary>
      <RouteResetListener />
      <ToastViewport />
      {resettingBanner && (
        <div
          role="status"
          data-testid="maintenance-retrying-banner"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            background: '#fef3c7',
            color: '#92400e',
            borderBottom: '1px solid #f59e0b',
            padding: '10px 20px',
            textAlign: 'center',
            fontWeight: 600,
            fontSize: '0.92rem',
          }}
        >
          ⏳ {resettingBanner}
        </div>
      )}
      <AppRoutes
        awaitingAdminRestore={
          isAdminRoute &&
          !isAdminAuthenticated &&
          getCurrentAuthMode() !== 'legacy' &&
          adminBootstrapStatus !== 'done'
        }
      />
    </ErrorBoundary>
  );
}

export default App;