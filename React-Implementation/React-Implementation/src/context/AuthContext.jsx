import { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("teamforge.currentUser");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    try {
      return Boolean(localStorage.getItem("teamforge.backendUserId"));
    } catch {
      return false;
    }
  });

  const login = (userData) => {
    const id = userData?.id || "1";
    localStorage.setItem("teamforge.backendUserId", id);
    if (userData) {
      localStorage.setItem("teamforge.currentUser", JSON.stringify(userData));
    }
    // Always start newly logged in user in the Collaborator role
    sessionStorage.setItem("teamforge.role", "Collaborator");
    sessionStorage.removeItem("teamforge.isSuperUser");
    setUser(userData);
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem("teamforge.backendUserId");
    localStorage.removeItem("teamforge.currentUser");
    sessionStorage.removeItem("teamforge.isSuperUser");
    sessionStorage.setItem("teamforge.role", "Collaborator");
    setUser(null);
    setIsAuthenticated(false);
  };

  const updateUser = (updatedData) => {
    setUser((prev) => {
      const next = { ...(prev || {}), ...updatedData };
      localStorage.setItem("teamforge.currentUser", JSON.stringify(next));
      return next;
    });
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};
