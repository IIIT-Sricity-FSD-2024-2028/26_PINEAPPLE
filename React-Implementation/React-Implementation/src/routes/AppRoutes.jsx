import { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";

import ProtectedRoute from "./ProtectedRoute";
import AdminProtectedRoute from "./AdminProtectedRoute";
import MentorProtectedRoute from "./MentorProtectedRoute";
import OwnerProtectedRoute from "./OwnerProtectedRoute";

// Public pages
const LandingPage = lazy(() => import("../pages/landingpage"));
const Login = lazy(() => import("../pages/Login"));
const Signup = lazy(() => import("../pages/Signup"));
const CompleteProfile = lazy(() => import("../pages/CompleteProfile"));
const ForgotPassword = lazy(() => import("../pages/ForgotPassword"));
const ResetPassword = lazy(() => import("../pages/ResetPassword"));
const VerifyEmail = lazy(() => import("../pages/VerifyEmail"));
const Suspended = lazy(() => import("../pages/Suspended"));
const NotFound = lazy(() => import("../pages/NotFound"));

// Admin pages
const AdminLogin = lazy(() => import("../pages/admin/AdminLogin"));
const AdminLayout = lazy(() => import("../pages/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("../pages/admin/AdminDashboard"));
const AdminUsers = lazy(() => import("../pages/admin/AdminUsers"));
const AdminUserDetails = lazy(() => import("../pages/admin/AdminUserDetails"));
const AdminProjects = lazy(() => import("../pages/admin/AdminProjects"));
const AdminProjectDetails = lazy(() => import("../pages/admin/AdminProjectDetails"));
const AdminMentorApps = lazy(() => import("../pages/admin/AdminMentorApps"));
const MentorRevenue = lazy(() => import("../pages/admin/MentorRevenue"));
const AuditLog = lazy(() => import("../pages/admin/AuditLog"));
const AdminReports = lazy(() => import("../pages/admin/AdminReports"));
const AdminSupport = lazy(() => import("../pages/admin/AdminSupport"));
const SuperuserAdmins = lazy(() => import("../pages/admin/SuperuserAdmins"));
const SuperuserConfig = lazy(() => import("../pages/admin/SuperuserConfig"));
const AdminNotFound = lazy(() => import("../pages/admin/AdminNotFound"));

// Protected Shared pages
const Layout = lazy(() => import("../pages/layout"));
const Dashboard = lazy(() => import("../pages/dashboard"));
const Help = lazy(() => import("../pages/help"));
const Leaderboard = lazy(() => import("../pages/leaderboard"));
const Notifications = lazy(() => import("../pages/notifications"));
const Profile = lazy(() => import("../pages/profile"));
const Settings = lazy(() => import("../pages/settings"));

// Collaborator pages
const ProjectsMarketplace = lazy(() => import("../pages/collaborator/ProjectsMarketplace"));
const AppliedProjects = lazy(() => import("../pages/collaborator/AppliedProjects"));
const MyWork = lazy(() => import("../pages/collaborator/MyWork"));
const CollaboratorWorkspace = lazy(() => import("../pages/collaborator/CollaboratorWorkspace"));

// Owner pages
const CreateProject = lazy(() => import("../pages/owner/CreateProject"));
const MyProjects = lazy(() => import("../pages/owner/MyProjects"));
const MentorsDirectory = lazy(() => import("../pages/owner/MentorsDirectory"));
const OwnedWorkspace = lazy(() => import("../pages/owner/OwnedWorkspace"));
const OwnerDashboard = lazy(() => import("../pages/owner/OwnerDashboard"));

// Mentor pages
const MentorApplication = lazy(() => import("../pages/mentor/MentorApplication"));
const MentoredProjects = lazy(() => import("../pages/mentor/MentoredProjects"));
const MentorRequests = lazy(() => import("../pages/mentor/MentorRequests"));
const MentorEarnings = lazy(() => import("../pages/mentor/MentorEarnings"));
const MyMentorProfile = lazy(() => import("../pages/mentor/MyMentorProfile"));
const MentorProjectWorkspace = lazy(() => import("../pages/mentor/MentorProjectWorkspace"));

function RouteLoadingFallback() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div
        style={{
          width: "36px",
          height: "36px",
          border: "3px solid rgba(99, 102, 241, 0.2)",
          borderTopColor: "#6366f1",
          borderRadius: "50%",
          animation: "tf-route-spin 0.8s linear infinite",
        }}
      />
      <style>{`@keyframes tf-route-spin { to { transform: rotate(360deg); } }`}</style>
      <span style={{ fontSize: "14px", color: "#64748b", fontWeight: 500 }}>
        Loading...
      </span>
    </div>
  );
}

const AppRoutes = ({ awaitingAdminRestore = false } = {}) => {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        {/* Public pages */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/complete-profile" element={<CompleteProfile />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/suspended" element={<Suspended />} />

        {/* Admin Pages (Login is public, Dashboard is protected) */}
        <Route path="/admin/login" element={<AdminLogin />} />

        <Route element={<AdminProtectedRoute awaitingAdminRestore={awaitingAdminRestore} />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="users/:id" element={<AdminUserDetails />} />
            <Route path="projects" element={<AdminProjects />} />
            <Route path="projects/:id" element={<AdminProjectDetails />} />
            <Route path="mentor-apps" element={<AdminMentorApps />} />
            <Route path="mentor-revenue" element={<MentorRevenue />} />
            <Route path="audit" element={<AuditLog />} />
            <Route path="audit-log" element={<AuditLog />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="support" element={<AdminSupport />} />
            <Route path="su-admins" element={<SuperuserAdmins />} />
            <Route path="su-config" element={<SuperuserConfig />} />
            <Route path="*" element={<AdminNotFound />} />
          </Route>
        </Route>

        {/* Protected pages */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            {/* Collaborator Role Routes */}
            <Route path="/projects" element={<ProjectsMarketplace />} />
            <Route path="/applied-projects" element={<AppliedProjects />} />
            <Route path="/my-work" element={<MyWork />} />
            <Route path="/workspace/:projectId" element={<CollaboratorWorkspace />} />

            {/* Project Owner Role Routes (Guarded for owners) */}
            <Route element={<OwnerProtectedRoute />}>
              <Route path="/create-project" element={<CreateProject />} />
              <Route path="/my-projects" element={<MyProjects />} />
              <Route path="/owner/mentors" element={<MentorsDirectory />} />
              <Route path="/owner/workspace/:projectId" element={<OwnedWorkspace />} />
              <Route path="/owner/dashboard" element={<OwnerDashboard />} />
            </Route>

            {/* Mentor Application Route (Open for pending/new mentors) */}
            <Route path="/mentor/apply" element={<MentorApplication />} />

            {/* Mentor Role Routes (Locked until admin approval) */}
            <Route element={<MentorProtectedRoute />}>
              <Route path="/mentor/projects" element={<MentoredProjects />} />
              <Route path="/mentor/requests" element={<MentorRequests />} />
              <Route path="/mentor/earnings" element={<MentorEarnings />} />
              <Route path="/mentor/profile" element={<MyMentorProfile />} />
              <Route path="/mentor/workspace/:projectId" element={<MentorProjectWorkspace />} />
            </Route>

            {/* Shared / Global Routes */}
            <Route path="/help" element={<Help />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Route>

        {/* Global 404 Catch-All Route */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;
