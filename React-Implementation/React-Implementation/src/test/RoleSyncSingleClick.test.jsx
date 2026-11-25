import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React, { useContext } from 'react';
import { MemoryRouter, Routes, Route, Outlet } from 'react-router-dom';
import Navbar from '../components/navbar.jsx';
import Sidebar from '../components/sidebar.jsx';
import { AuthContext } from '../context/AuthContext.jsx';
import { RoleProvider, useActiveRole } from '../context/RoleContext.jsx';
import OwnerProtectedRoute from '../routes/OwnerProtectedRoute.jsx';
import storage from '../utils/storage.js';
import { setAuthMode } from '../services/apiClient.js';

function MockLayout() {
  const { currentRole } = useActiveRole();
  return (
    <div>
      <Navbar onMenuClick={() => {}} />
      <Sidebar isOpen={true} />
      <div data-testid="active-role-indicator">{currentRole}</div>
      <Outlet />
    </div>
  );
}

describe('Fix 2: Navbar and Sidebar Role Sync on a Single Click', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    setAuthMode('legacy');
    storage.setRole('Collaborator');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('switches role to Project Owner and updates Navbar, Sidebar, and Route on the FIRST click', async () => {
    const mockUser = {
      id: 'test-user-1',
      uid: 'test-user-1',
      name: 'Test Collaborator',
      email: 'collaborator@teamforge.com',
      role: 'Collaborator',
      profileComplete: true,
      emailVerified: true,
    };

    const mockAuthContext = {
      user: mockUser,
      isAuthenticated: true,
      status: 'authenticated',
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    };

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthContext.Provider value={mockAuthContext}>
          <RoleProvider>
            <Routes>
              <Route element={<MockLayout />}>
                <Route path="/dashboard" element={<div data-testid="collaborator-dashboard">Collaborator Dashboard</div>} />
                <Route element={<OwnerProtectedRoute />}>
                  <Route path="/owner/dashboard" element={<div data-testid="owner-dashboard">Project Owner Dashboard</div>} />
                </Route>
              </Route>
            </Routes>
          </RoleProvider>
        </AuthContext.Provider>
      </MemoryRouter>
    );

    // Initial state: Collaborator
    expect(screen.getByTestId('collaborator-dashboard')).toBeTruthy();
    expect(screen.getByTestId('active-role-indicator').textContent).toBe('Collaborator');
    expect(screen.queryByRole('heading', { name: /PROJECT OWNER/i })).toBeNull();

    // Click the role selector dropdown trigger in navbar
    const roleTrigger = screen.getByTestId('role-selector-trigger');
    fireEvent.click(roleTrigger);

    // Click "Project Owner" role option ONCE
    const projectOwnerOption = screen.getByText('Project Owner', { selector: 'span.role-name' });
    fireEvent.click(projectOwnerOption);

    // 1. The Route must immediately navigate to /owner/dashboard without bouncing back
    await waitFor(() => {
      expect(screen.getByTestId('owner-dashboard')).toBeTruthy();
    });

    // 2. The active role indicator in Navbar / Context must be "Project Owner"
    expect(screen.getByTestId('active-role-indicator').textContent).toBe('Project Owner');

    // 3. The Sidebar section title for "PROJECT OWNER" must now be visible
    expect(screen.getByRole('heading', { name: /PROJECT OWNER/i })).toBeTruthy();

    // 4. Storage must hold Project Owner
    expect(storage.getRole()).toBe('Project Owner');
  });

  it('synchronizes role when another tab updates teamforge.role in localStorage', async () => {
    const mockUser = {
      id: 'test-user-2',
      uid: 'test-user-2',
      name: 'Test Collaborator 2',
      email: 'collab2@teamforge.com',
      role: 'Collaborator',
    };

    const mockAuthContext = {
      user: mockUser,
      isAuthenticated: true,
      status: 'authenticated',
      loading: false,
    };

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthContext.Provider value={mockAuthContext}>
          <RoleProvider>
            <MockLayout />
          </RoleProvider>
        </AuthContext.Provider>
      </MemoryRouter>
    );

    expect(screen.getByTestId('active-role-indicator').textContent).toBe('Collaborator');

    // Simulate storage event from another tab switching to Project Owner
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'teamforge.role',
          newValue: 'Project Owner',
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('active-role-indicator').textContent).toBe('Project Owner');
    });
    expect(screen.getByRole('heading', { name: /PROJECT OWNER/i })).toBeTruthy();
  });
});
