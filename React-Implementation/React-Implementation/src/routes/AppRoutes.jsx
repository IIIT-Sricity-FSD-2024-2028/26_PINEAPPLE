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
