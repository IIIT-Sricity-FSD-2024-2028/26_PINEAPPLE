import React, { createContext, useState } from 'react';
import { getCurrentUserRole } from '../services/apiClient';

export const RoleContext = createContext();

export const RoleProvider = ({ children }) => {
  // Initialize with the logic from apiClient
  const [currentRole, setCurrentRole] = useState(getCurrentUserRole());
  
  const availableRoles = ["Collaborator", "Project Owner", "Mentor"];

  const switchRole = (newRole) => {
    if (availableRoles.includes(newRole)) {
      setCurrentRole(newRole);
      // Optional: Save to sessionStorage if needed to persist across reloads
      sessionStorage.setItem("teamforge.role", newRole);
    }
  };

  return (
    <RoleContext.Provider value={{ currentRole, availableRoles, switchRole }}>
      {children}
    </RoleContext.Provider>
  );
};
