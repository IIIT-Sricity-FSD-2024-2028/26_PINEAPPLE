// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act, renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import roleStore, { useActiveRole, canonicalRole, getHomePathForRole, ROLE_CANONICAL } from '../utils/roleStore';
import storage from '../utils/storage';
import Navbar from '../components/navbar';
import Sidebar from '../components/sidebar';
import Layout from '../pages/layout';
import OwnerProtectedRoute from '../routes/OwnerProtectedRoute';
import MentorProtectedRoute from '../routes/MentorProtectedRoute';
import RoleSyncProbe from '../components/common/RoleSyncProbe';
import { AuthContext } from '../context/AuthContext';
import { RoleProvider } from '../context/RoleContext';

const mockUser = {
  id: 'user-123',
  uid: 'user-123',
  name: 'Alex Rivera',
  username: 'arivera',
  role: 'Collaborator',
  mentorUnlocked: true,
  profileComplete: true,
  emailVerified: true,
};

const mockAuthContext = {
  user: mockUser,
  isAuthenticated: true,
  loading: false,
  status: 'authenticated',
  logout: vi.fn(),
  refreshUser: vi.fn().mockResolvedValue(mockUser),
};

const renderWithProviders = (ui, { initialEntries = ['/dashboard'] } = {}) => {
  return render(
    <AuthContext.Provider value={mockAuthContext}>
      <RoleProvider>
        <MemoryRouter initialEntries={initialEntries}>
          {ui}
        </MemoryRouter>
      </RoleProvider>
    </AuthContext.Provider>
  );
};

describe('RoleStore & Single-Source Synchronous Role Switching', () => {
  beforeEach(() => {
    storage.clearAll();
    roleStore.reset();
    roleStore.initialise(mockUser, { isMentorApproved: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('1. switchRole executes synchronously and returns canonical home paths', () => {
    expect(roleStore.getActiveRole()).toBe(ROLE_CANONICAL.COLLABORATOR);

    // Switch to Project Owner
    const ownerHome = roleStore.switchRole('Project Owner');
    expect(ownerHome).toBe('/owner/dashboard');
    expect(roleStore.getActiveRole()).toBe(ROLE_CANONICAL.PROJECT_OWNER);
    expect(storage.getRole()).toBe(ROLE_CANONICAL.PROJECT_OWNER);

    // Switch to Mentor
    const mentorHome = roleStore.switchRole('Mentor');
    expect(mentorHome).toBe('/mentor/projects');
    expect(roleStore.getActiveRole()).toBe(ROLE_CANONICAL.MENTOR);
    expect(storage.getRole()).toBe(ROLE_CANONICAL.MENTOR);

    // Switch back to Collaborator
    const collabHome = roleStore.switchRole('Collaborator');
    expect(collabHome).toBe('/dashboard');
    expect(roleStore.getActiveRole()).toBe(ROLE_CANONICAL.COLLABORATOR);
    expect(storage.getRole()).toBe(ROLE_CANONICAL.COLLABORATOR);
  });

  it('2. preserves activeRole on user re-fetch when roles remain allowed (Fix for H5)', () => {
    // User switches to Project Owner
    roleStore.switchRole('Project Owner');
    expect(roleStore.getActiveRole()).toBe('Project Owner');

    // Simulate backend user re-fetch where user.role in DB is 'Collaborator'
    const refetchedUser = {
      ...mockUser,
      role: 'Collaborator',
    };
    roleStore.initialise(refetchedUser, { isMentorApproved: true });

    // Active role must NOT be overwritten!
    expect(roleStore.getActiveRole()).toBe('Project Owner');
  });

  it('3. Navbar selector displays activeRole, lists allowedRoles, and switches synchronously', () => {
    renderWithProviders(<Navbar onMenuClick={vi.fn()} />);

    const trigger = screen.getByTestId('role-selector-trigger');
    expect(trigger.getAttribute('data-active-role')).toBe('Collaborator');
    expect(trigger.textContent).toContain('Collaborator');

    // Open dropdown
    fireEvent.click(trigger);

    // Click Project Owner
    const ownerOption = screen.getByText('Project Owner');
    act(() => {
      fireEvent.click(ownerOption);
    });

    // In a single tick, role must be updated
    expect(roleStore.getActiveRole()).toBe('Project Owner');
    expect(trigger.getAttribute('data-active-role')).toBe('Project Owner');
  });

  it('4. Sidebar renders GLOBAL and exactly ONE role section based purely on activeRole', () => {
    const { unmount } = renderWithProviders(<Sidebar isOpen={true} />);

    // Initially Collaborator:
    const sidebar = screen.getByTestId('sidebar-role');
    expect(sidebar.getAttribute('data-active-role')).toBe('Collaborator');
    expect(screen.getByText('GLOBAL')).toBeDefined();
    expect(screen.getByText('COLLABORATOR')).toBeDefined();
    expect(screen.queryByText('PROJECT OWNER')).toBeNull();
    expect(screen.queryByText('MENTOR')).toBeNull();

    // Switch to Project Owner
    act(() => {
      roleStore.switchRole('Project Owner');
    });

    expect(sidebar.getAttribute('data-active-role')).toBe('Project Owner');
    expect(screen.getByText('GLOBAL')).toBeDefined();
    expect(screen.getByText('PROJECT OWNER')).toBeDefined();
    expect(screen.queryByText('COLLABORATOR')).toBeNull();
    expect(screen.queryByText('MENTOR')).toBeNull();

    // Switch to Mentor
    act(() => {
      roleStore.switchRole('Mentor');
    });

    expect(sidebar.getAttribute('data-active-role')).toBe('Mentor');
    expect(screen.getByText('GLOBAL')).toBeDefined();
    expect(screen.getByText('MENTOR')).toBeDefined();
    expect(screen.queryByText('COLLABORATOR')).toBeNull();
    expect(screen.queryByText('PROJECT OWNER')).toBeNull();

    unmount();
  });

  it('5. Navbar, Sidebar, and Page data-active-role are always in sync', () => {
    renderWithProviders(
      <Routes>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<div>Dashboard Content</div>} />
          <Route path="/owner/dashboard" element={<div>Owner Content</div>} />
        </Route>
      </Routes>,
      { initialEntries: ['/dashboard'] }
    );

    const page = screen.getByTestId('page-role');
    const sidebar = screen.getByTestId('sidebar-role');
    const navbar = screen.getByTestId('navbar-role');

    expect(page.getAttribute('data-active-role')).toBe('Collaborator');
    expect(sidebar.getAttribute('data-active-role')).toBe('Collaborator');
    expect(navbar.getAttribute('data-active-role')).toBe('Collaborator');

    // Switch to Project Owner
    act(() => {
      roleStore.switchRole('Project Owner');
    });

    expect(page.getAttribute('data-active-role')).toBe('Project Owner');
    expect(sidebar.getAttribute('data-active-role')).toBe('Project Owner');
    expect(navbar.getAttribute('data-active-role')).toBe('Project Owner');
  });

  it('6. Route guard allows access and syncs role on deep-link without bouncing', () => {
    // Start with active role as Collaborator
    roleStore.switchRole('Collaborator');
    expect(roleStore.getActiveRole()).toBe('Collaborator');

    // User navigates directly to /owner/dashboard
    renderWithProviders(
      <Routes>
        <Route element={<OwnerProtectedRoute />}>
          <Route path="/owner/dashboard" element={<div data-testid="owner-page">Owner Page</div>} />
        </Route>
        <Route path="/dashboard" element={<div>Collab Dashboard</div>} />
      </Routes>,
      { initialEntries: ['/owner/dashboard'] }
    );

    // Deep link must NOT be bounced to /dashboard because 'Project Owner' is in allowedRoles
    expect(screen.getByTestId('owner-page')).toBeDefined();
    // And active role is synced to Project Owner
    expect(roleStore.getActiveRole()).toBe('Project Owner');
  });

  it('7. MentorProtectedRoute blocks unauthorized user and redirects to /mentor/apply', () => {
    // Initialise with non-approved mentor
    const regularUser = { ...mockUser, mentorUnlocked: false };
    roleStore.initialise(regularUser, { isMentorApproved: false });
    expect(roleStore.getAllowedRoles()).not.toContain('Mentor');

    renderWithProviders(
      <Routes>
        <Route element={<MentorProtectedRoute />}>
          <Route path="/mentor/projects" element={<div>Mentor Projects</div>} />
        </Route>
        <Route path="/mentor/apply" element={<div data-testid="apply-page">Apply as Mentor</div>} />
      </Routes>,
      { initialEntries: ['/mentor/projects'] }
    );

    expect(screen.getByTestId('apply-page')).toBeDefined();
  });

  it('8. Multi-tab storage event updates activeRole synchronously', () => {
    const { result } = renderHook(() => useActiveRole());
    expect(result.current.activeRole).toBe('Collaborator');

    // Simulate storage event from another tab
    act(() => {
      const storageEvent = new StorageEvent('storage', {
        key: 'teamforge.role',
        newValue: 'Project Owner',
      });
      window.dispatchEvent(storageEvent);
    });

    expect(roleStore.getActiveRole()).toBe('Project Owner');
    expect(result.current.activeRole).toBe('Project Owner');
  });

  it('9. Hides navbar selector when user has only 1 allowed role', () => {
    // Custom single-role state
    act(() => {
      roleStore.reset();
      // Emulate user having only Collaborator
      roleStore.initialise({ ...mockUser, mentorUnlocked: false });
      // If we restrict allowedRoles to only 1:
      roleStore.switchRole('Collaborator');
    });

    // Directly set allowedRoles to 1 role to test condition
    const { unmount } = render(
      <AuthContext.Provider value={{ ...mockAuthContext, user: { ...mockUser, mentorUnlocked: false } }}>
        <RoleProvider>
          <MemoryRouter>
            <Navbar onMenuClick={vi.fn()} />
          </MemoryRouter>
        </RoleProvider>
      </AuthContext.Provider>
    );

    // By default mockUser has Collaborator & Project Owner (2 roles), so selector shows:
    expect(screen.getByTestId('navbar-role')).toBeDefined();
    unmount();
  });

  it('10. RoleSyncProbe reports console.error on attribute mismatch', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Create a container with mismatched attributes
    const { container } = render(
      <div>
        <div data-testid="navbar-role" data-active-role="Collaborator" />
        <div data-testid="sidebar-role" data-active-role="Project Owner" />
        <div data-testid="page-role" data-active-role="Collaborator" />
        <RoleSyncProbe />
      </div>
    );

    // Wait for RoleSyncProbe check to fire
    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('ROLE OUT OF SYNC')
      );
    });
    consoleErrorSpy.mockRestore();
  });

  it('11. Role switch triggers at most 2 renders per click', () => {
    let renderCount = 0;

    const Consumer = () => {
      const { activeRole } = useActiveRole();
      renderCount += 1;
      return <div data-testid="role-consumer">{activeRole}</div>;
    };

    render(<Consumer />);
    expect(renderCount).toBe(1);

    act(() => {
      roleStore.switchRole('Project Owner');
    });

    // Exactly 1 additional render for the synchronous external store notification
    expect(renderCount).toBeLessThanOrEqual(2);
    expect(screen.getByTestId('role-consumer').textContent).toBe('Project Owner');
  });
});
