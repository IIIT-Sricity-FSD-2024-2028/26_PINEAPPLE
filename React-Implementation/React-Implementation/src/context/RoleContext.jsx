import React, { createContext, useState, useEffect, useContext } from 'react';
import { AuthContext } from './AuthContext';
import { getCurrentUserRole } from '../services/apiClient';

export const RoleContext = createContext();

export const RoleProvider = ({ children }) => {
  const { user } = useContext(AuthContext);

  // Initialize with Collaborator default
  const [currentRole, setCurrentRole] = useState(() => {
    try {
      return sessionStorage.getItem("teamforge.role") || "Collaborator";
    } catch {
      return "Collaborator";
    }
  });

  // Whenever the authenticated user changes (login or logout), reset active role to Collaborator
  useEffect(() => {
    setCurrentRole("Collaborator");
    try {
      sessionStorage.setItem("teamforge.role", "Collaborator");
    } catch (err) {
      console.error(err);
    }
  }, [user?.id]);
  
  const availableRoles = ["Collaborator", "Project Owner", "Mentor"];

  const switchRole = (newRole) => {
    if (availableRoles.includes(newRole)) {
      setCurrentRole(newRole);
      try {
        sessionStorage.setItem("teamforge.role", newRole);
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <RoleContext.Provider value={{ currentRole, availableRoles, switchRole }}>
      {children}
    </RoleContext.Provider>
  );
};
