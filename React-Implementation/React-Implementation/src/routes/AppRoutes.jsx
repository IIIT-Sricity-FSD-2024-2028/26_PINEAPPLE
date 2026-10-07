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
import ProtectedRoute from "./ProtectedRoute";

const AppRoutes = () => {
  return (
    <Routes>
      {/* Public pages */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      
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
