import React, { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check localStorage (teamforge.backendUserId) or validate token here
    const userId = localStorage.getItem("teamforge.backendUserId");
    if (userId) {
      setIsAuthenticated(true);
      // Optional: Fetch user profile logic here using usersApi
    }
  }, []);

  const login = (userData) => {
    localStorage.setItem("teamforge.backendUserId", userData.id || "1");
    setUser(userData);
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem("teamforge.backendUserId");
    sessionStorage.removeItem("teamforge.isSuperUser");
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
