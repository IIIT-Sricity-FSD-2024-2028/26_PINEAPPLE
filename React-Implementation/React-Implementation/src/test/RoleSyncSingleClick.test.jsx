import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import { Routes, Route, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Navbar from '../components/navbar.jsx';
import Sidebar from '../components/sidebar.jsx';
import OwnerProtectedRoute from '../routes/OwnerProtectedRoute.jsx';
import { selectActiveRole } from '../store/selectors/sessionSelectors.js';
import { setActiveRole } from '../store/slices/sessionSlice.js';
import { renderWithStore } from './test-utils.jsx';

function MockLayout() {
  const currentRole = useSelector(selectActiveRole);
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

    const { store } = renderWithStore(
      <Routes>
        <Route element={<MockLayout />}>
          <Route path="/dashboard" element={<div data-testid="collaborator-dashboard">Collaborator Dashboard</div>} />
          <Route element={<OwnerProtectedRoute />}>
            <Route path="/owner/dashboard" element={<div data-testid="owner-dashboard">Project Owner Dashboard</div>} />
          </Route>
        </Route>
      </Routes>,
      {
        route: '/dashboard',
        preloadedState: {
          session: {
            user: mockUser,
            isAuthenticated: true,
            status: 'authenticated',
            activeRole: 'Collaborator',
            allowedRoles: ['Collaborator', 'Project Owner'],
            initialized: true,
          },
        },
      }
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

    // 2. The active role indicator in Navbar / Redux store must be "Project Owner"
    expect(screen.getByTestId('active-role-indicator').textContent).toBe('Project Owner');

    // 3. The Sidebar section title for "PROJECT OWNER" must now be visible
    expect(screen.getByRole('heading', { name: /PROJECT OWNER/i })).toBeTruthy();

    // 4. Store must hold Project Owner (without touching browser storage)
    expect(selectActiveRole(store.getState())).toBe('Project Owner');
  });

  it('synchronizes Navbar and Sidebar immediately when setActiveRole is dispatched to the store', async () => {
    const mockUser = {
      id: 'test-user-2',
      uid: 'test-user-2',
      name: 'Test Collaborator 2',
      email: 'collab2@teamforge.com',
      role: 'Collaborator',
    };

    const { store } = renderWithStore(<MockLayout />, {
      route: '/dashboard',
      preloadedState: {
        session: {
          user: mockUser,
          isAuthenticated: true,
          status: 'authenticated',
          activeRole: 'Collaborator',
          allowedRoles: ['Collaborator', 'Project Owner'],
          initialized: true,
        },
      },
    });

    expect(screen.getByTestId('active-role-indicator').textContent).toBe('Collaborator');

    act(() => {
      store.dispatch(setActiveRole('Project Owner'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('active-role-indicator').textContent).toBe('Project Owner');
    });
    expect(screen.getByRole('heading', { name: /PROJECT OWNER/i })).toBeTruthy();
  });
});
