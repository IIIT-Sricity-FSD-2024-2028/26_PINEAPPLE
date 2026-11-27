import { Outlet } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import Navbar from "../components/navbar";
import Sidebar from "../components/sidebar";
import UsernameConfirmationBanner from "../components/common/UsernameConfirmationBanner";
import VerifyEmailBanner from "../components/common/VerifyEmailBanner";
import RoleSyncProbe from "../components/common/RoleSyncProbe";
import { toggleSidebar as toggleSidebarAction } from "../store/slices/uiSlice";
import { selectSidebarOpen } from "../store/selectors/uiSelectors";
import {
  selectActiveRole,
  selectAuthLoading,
  selectAuthStatus,
  selectCurrentUser,
} from "../store/selectors/sessionSelectors";
import "./layout.css";

function LayoutContent() {
  const dispatch = useDispatch();
  const isSidebarOpen = useSelector(selectSidebarOpen);
  const status = useSelector(selectAuthStatus);
  const user = useSelector(selectCurrentUser);
  const loading = useSelector(selectAuthLoading);
  const activeRole = useSelector(selectActiveRole);

  if (status === 'signing_out' || status === 'loading' || loading || !user) {
    return (
      <div
        className="layout-loading-screen"
        data-testid="layout-loading-screen"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          fontSize: '1.1rem',
          color: '#666',
        }}
      >
        {status === 'signing_out' ? 'Signing out...' : 'Loading...'}
      </div>
    );
  }

  return (
    <div
      className="app-layout"
      data-testid="page-role"
      data-active-role={activeRole}
    >
      <Navbar onMenuClick={() => dispatch(toggleSidebarAction())} />
      <div className="app-body">
        <Sidebar isOpen={isSidebarOpen} />
        <main className="app-content">
          <UsernameConfirmationBanner />
          <VerifyEmailBanner />
          <Outlet context={{ isSidebarOpen }} />
        </main>
      </div>
      <RoleSyncProbe />
    </div>
  );
}

const Layout = LayoutContent;

export default Layout;
