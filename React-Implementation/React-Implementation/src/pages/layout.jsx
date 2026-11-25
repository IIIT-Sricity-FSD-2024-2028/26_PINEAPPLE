import { useState, useContext } from "react";
import { Outlet } from "react-router-dom";
import Navbar from "../components/navbar";
import Sidebar from "../components/sidebar";
import UsernameConfirmationBanner from "../components/common/UsernameConfirmationBanner";
import VerifyEmailBanner from "../components/common/VerifyEmailBanner";
import RoleSyncProbe from "../components/common/RoleSyncProbe";
import { AuthContext } from "../context/AuthContext";
import { useActiveRole } from "../utils/roleStore";
import "./layout.css";

function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { status, user, loading } = useContext(AuthContext) || {};
  const { activeRole } = useActiveRole();

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

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
      <Navbar onMenuClick={toggleSidebar} />
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

export default Layout;
