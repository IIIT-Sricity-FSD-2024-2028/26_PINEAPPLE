import { Routes, Route } from "react-router-dom";

import LandingPage from "../pages/landingpage";
import Login from "../pages/Login";
import Signup from "../pages/Signup";
import Layout from "../pages/layout";
import Dashboard from "../pages/dashboard";
import Help from "../pages/help";
import Leaderboard from "../pages/leaderboard";
import Notifications from "../pages/notifications";
import Profile from "../pages/profile";
import Settings from "../pages/settings";
import ProjectsMarketplace from "../pages/collaborator/ProjectsMarketplace";
import AppliedProjects from "../pages/collaborator/AppliedProjects";
import MyWork from "../pages/collaborator/MyWork";
import CollaboratorWorkspace from "../pages/collaborator/CollaboratorWorkspace";
import CreateProject from "../pages/owner/CreateProject";
import MyProjects from "../pages/owner/MyProjects";
import MentorsDirectory from "../pages/owner/MentorsDirectory";
import OwnedWorkspace from "../pages/owner/OwnedWorkspace";
import OwnerDashboard from "../pages/owner/OwnerDashboard";
import AdminLogin from "../pages/admin/AdminLogin";
import AdminDashboard from "../pages/admin/AdminDashboard";
import AdminLayout from "../pages/admin/AdminLayout";
import AdminUsers from "../pages/admin/AdminUsers";
import ProtectedRoute from "./ProtectedRoute";
import AdminProtectedRoute from "./AdminProtectedRoute";

const AppRoutes = () => {
  return (
    <Routes>
      {/* Public pages */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      
      {/* Admin Pages (Login is public, Dashboard is protected) */}
      <Route path="/admin/login" element={<AdminLogin />} />
      
      <Route element={<AdminProtectedRoute />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="projects" element={<div className="admin-page"><h1>Projects Placeholder</h1></div>} />
          <Route path="mentor-apps" element={<div className="admin-page"><h1>Mentor Applications Placeholder</h1></div>} />
          <Route path="mentor-revenue" element={<div className="admin-page"><h1>Revenue & Escrow Placeholder</h1></div>} />
          <Route path="audit" element={<div className="admin-page"><h1>Audit Log Placeholder</h1></div>} />
          <Route path="su-admins" element={<div className="admin-page"><h1>Manage Admins Placeholder</h1></div>} />
          <Route path="su-config" element={<div className="admin-page"><h1>Platform Config Placeholder</h1></div>} />
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

          {/* Project Owner Role Routes */}
          <Route path="/create-project" element={<CreateProject />} />
          <Route path="/my-projects" element={<MyProjects />} />
          <Route path="/mentors" element={<MentorsDirectory />} />
          <Route path="/owner/workspace/:projectId" element={<OwnedWorkspace />} />
          <Route path="/owner/dashboard" element={<OwnerDashboard />} />

          {/* Shared / Global Routes */}
          <Route path="/help" element={<Help />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Route>
    </Routes>
  );
};

export default AppRoutes;
