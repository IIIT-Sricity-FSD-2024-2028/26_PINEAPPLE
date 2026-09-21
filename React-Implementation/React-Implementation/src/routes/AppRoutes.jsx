import { Routes, Route } from "react-router-dom";

import LandingPage from "../pages/landingpage";
import Login from "../pages/Auth/login";
import Signup from "../pages/Auth/sinup";
import Layout from "../pages/layout";
import Dashboard from "../pages/dashboard";
import Help from "../pages/help";
import Leaderboard from "../pages/leaderboard";
import Notifications from "../pages/notifications";
import Profile from "../pages/profile";
import Settings from "../pages/settings";

const AppRoutes = () => {
  return (
    <Routes>
      {/* Public pages */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route element={<Layout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/help" element={<Help />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
};

export default AppRoutes;
