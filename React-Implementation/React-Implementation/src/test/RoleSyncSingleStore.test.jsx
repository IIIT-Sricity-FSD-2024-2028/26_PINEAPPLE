// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { createAppStore } from '../store';
import {
  ROLE_CANONICAL,
  getHomePathForRole,
} from '../store/utils/roleHelpers';
import {
  setActiveRole,
  setMentorStatus,
  setSession,
} from '../store/slices/sessionSlice';
import {
  selectActiveRole,
  selectAllowedRoles,
  selectHomePath,
} from '../store/selectors/sessionSelectors';
import { sessionReset } from '../store/actions/appActions';
import Navbar from '../components/navbar';
import Sidebar from '../components/sidebar';
import Layout from '../pages/layout';
import OwnerProtectedRoute from '../routes/OwnerProtectedRoute';
import MentorProtectedRoute from '../routes/MentorProtectedRoute';
import RoleSyncProbe from '../components/common/RoleSyncProbe';
import { renderWithStore } from './test-utils';

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

const renderWithReduxRole = (ui, { initialEntries = ['/dashboard'], store: providedStore } = {}) => {
  const activeStore =
    providedStore ||
    createAppStore({
      preloadedState: {
        session: {
          user: mockUser,
          isAuthenticated: true,
          status: 'authenticated',
          activeRole: ROLE_CANONICAL.COLLABORATOR,
          allowedRoles: [
            ROLE_CANONICAL.COLLABORATOR,
            ROLE_CANONICAL.PROJECT_OWNER,
            ROLE_CANONICAL.MENTOR,
          ],
          mentorApproved: true,
        },
      },
    });
  return renderWithStore(ui, {
    store: activeStore,
    route: initialEntries[0] || '/dashboard',
  });
};

describe('sessionSlice Role State & Single-Source Synchronous Role Switching', () => {
  let activeStore;

  beforeEach(() => {
    activeStore = createAppStore({
      preloadedState: {
        session: {
          user: mockUser,
          isAuthenticated: true,
          status: 'authenticated',
          activeRole: ROLE_CANONICAL.COLLABORATOR,
          allowedRoles: [
            ROLE_CANONICAL.COLLABORATOR,
            ROLE_CANONICAL.PROJECT_OWNER,
            ROLE_CANONICAL.MENTOR,
          ],
          mentorApproved: true,
        },
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('1. setActiveRole executes synchronously and maps canonical home paths without storage', () => {
    expect(selectActiveRole(activeStore.getState())).toBe(ROLE_CANONICAL.COLLABORATOR);

    activeStore.dispatch(setActiveRole('Project Owner'));
    expect(getHomePathForRole(selectActiveRole(activeStore.getState()))).toBe('/owner/dashboard');
    expect(selectActiveRole(activeStore.getState())).toBe(ROLE_CANONICAL.PROJECT_OWNER);
    expect(selectHomePath(activeStore.getState())).toBe('/owner/dashboard');

    activeStore.dispatch(setActiveRole('Mentor'));
    expect(selectActiveRole(activeStore.getState())).toBe(ROLE_CANONICAL.MENTOR);
    expect(selectHomePath(activeStore.getState())).toBe('/mentor/projects');

    activeStore.dispatch(setActiveRole('Collaborator'));
    expect(selectActiveRole(activeStore.getState())).toBe(ROLE_CANONICAL.COLLABORATOR);
    expect(selectHomePath(activeStore.getState())).toBe('/dashboard');
  });

  it('2. preserves activeRole on user re-fetch when roles remain allowed (Fix for H5)', () => {
    activeStore.dispatch(setActiveRole('Project Owner'));
    expect(selectActiveRole(activeStore.getState())).toBe('Project Owner');

    const refetchedUser = {
      ...mockUser,
      role: 'Collaborator',
    };
    activeStore.dispatch(setSession({ user: refetchedUser, isAuthenticated: true }));

    expect(selectActiveRole(activeStore.getState())).toBe('Project Owner');
  });

  it('3. Navbar selector displays activeRole, lists allowedRoles, and switches synchronously', () => {
    renderWithReduxRole(<Navbar onMenuClick={vi.fn()} />, { store: activeStore });

    const trigger = screen.getByTestId('role-selector-trigger');
    expect(trigger.getAttribute('data-active-role')).toBe('Collaborator');
    expect(trigger.textContent).toContain('Collaborator');

    fireEvent.click(trigger);

    const ownerOption = screen.getByText('Project Owner');
    act(() => {
      fireEvent.click(ownerOption);
    });

    expect(selectActiveRole(activeStore.getState())).toBe('Project Owner');
    expect(trigger.getAttribute('data-active-role')).toBe('Project Owner');
  });

  it('4. Sidebar renders GLOBAL and exactly ONE role section based purely on activeRole', () => {
    const { unmount } = renderWithReduxRole(<Sidebar isOpen={true} />, { store: activeStore });

    const sidebar = screen.getByTestId('sidebar-role');
    expect(sidebar.getAttribute('data-active-role')).toBe('Collaborator');
    expect(screen.getByText('GLOBAL')).toBeDefined();
    expect(screen.getByText('COLLABORATOR')).toBeDefined();
    expect(screen.queryByText('PROJECT OWNER')).toBeNull();
    expect(screen.queryByText('MENTOR')).toBeNull();

    act(() => {
      activeStore.dispatch(setActiveRole('Project Owner'));
    });

    expect(sidebar.getAttribute('data-active-role')).toBe('Project Owner');
    expect(screen.getByText('GLOBAL')).toBeDefined();
    expect(screen.getByText('PROJECT OWNER')).toBeDefined();
    expect(screen.queryByText('COLLABORATOR')).toBeNull();
    expect(screen.queryByText('MENTOR')).toBeNull();

    act(() => {
      activeStore.dispatch(setActiveRole('Mentor'));
    });

    expect(sidebar.getAttribute('data-active-role')).toBe('Mentor');
    expect(screen.getByText('GLOBAL')).toBeDefined();
    expect(screen.getByText('MENTOR')).toBeDefined();
    expect(screen.queryByText('COLLABORATOR')).toBeNull();
    expect(screen.queryByText('PROJECT OWNER')).toBeNull();

    unmount();
  });

  it('5. Navbar, Sidebar, and Page data-active-role are always in sync', () => {
    renderWithReduxRole(
      <Routes>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<div>Dashboard Content</div>} />
          <Route path="/owner/dashboard" element={<div>Owner Content</div>} />
        </Route>
      </Routes>,
      { initialEntries: ['/dashboard'], store: activeStore },
    );

    const page = screen.getByTestId('page-role');
    const sidebar = screen.getByTestId('sidebar-role');
    const navbar = screen.getByTestId('navbar-role');

    expect(page.getAttribute('data-active-role')).toBe('Collaborator');
    expect(sidebar.getAttribute('data-active-role')).toBe('Collaborator');
    expect(navbar.getAttribute('data-active-role')).toBe('Collaborator');

    act(() => {
      activeStore.dispatch(setActiveRole('Project Owner'));
    });

    expect(page.getAttribute('data-active-role')).toBe('Project Owner');
    expect(sidebar.getAttribute('data-active-role')).toBe('Project Owner');
    expect(navbar.getAttribute('data-active-role')).toBe('Project Owner');
  });

  it('6. Route guard allows access and syncs role on deep-link without bouncing', () => {
    activeStore.dispatch(setActiveRole('Collaborator'));
    expect(selectActiveRole(activeStore.getState())).toBe('Collaborator');

    renderWithReduxRole(
      <Routes>
        <Route element={<OwnerProtectedRoute />}>
          <Route path="/owner/dashboard" element={<div data-testid="owner-page">Owner Page</div>} />
        </Route>
        <Route path="/dashboard" element={<div>Collab Dashboard</div>} />
      </Routes>,
      { initialEntries: ['/owner/dashboard'], store: activeStore },
    );

    expect(screen.getByTestId('owner-page')).toBeDefined();
    expect(selectActiveRole(activeStore.getState())).toBe('Project Owner');
  });

  it('7. MentorProtectedRoute blocks unauthorized user and redirects to /mentor/apply', () => {
    activeStore.dispatch(sessionReset());
    activeStore.dispatch(
      setSession({
        user: { ...mockUser, mentorUnlocked: false },
        isAuthenticated: true,
        activeRole: 'Collaborator',
      }),
    );
    activeStore.dispatch(setMentorStatus({ mentorApproved: false }));
    expect(selectAllowedRoles(activeStore.getState())).not.toContain('Mentor');

    renderWithReduxRole(
      <Routes>
        <Route element={<MentorProtectedRoute />}>
          <Route path="/mentor/projects" element={<div>Mentor Projects</div>} />
        </Route>
        <Route path="/mentor/apply" element={<div data-testid="apply-page">Apply as Mentor</div>} />
      </Routes>,
      { initialEntries: ['/mentor/projects'], store: activeStore },
    );

    expect(screen.getByTestId('apply-page')).toBeDefined();
  });

  it('8. sessionSlice syncs role selector across subscribers without storage events', () => {
    const Consumer = () => {
      const activeRole = useSelector(selectActiveRole);
      return <div data-testid="role-consumer">{activeRole}</div>;
    };

    renderWithReduxRole(<Consumer />, { store: activeStore });
    expect(screen.getByTestId('role-consumer').textContent).toBe('Collaborator');

    act(() => {
      activeStore.dispatch(setActiveRole('Project Owner'));
    });

    expect(selectActiveRole(activeStore.getState())).toBe('Project Owner');
    expect(screen.getByTestId('role-consumer').textContent).toBe('Project Owner');
  });

  it('9. Hides navbar selector when user has only 1 allowed role', () => {
    activeStore.dispatch(
      setSession({
        user: { ...mockUser, mentorUnlocked: false },
        isAuthenticated: true,
        allowedRoles: ['Collaborator'],
        activeRole: 'Collaborator',
      }),
    );

    const { unmount } = renderWithReduxRole(<Navbar onMenuClick={vi.fn()} />, { store: activeStore });
    expect(screen.queryByTestId('navbar-role')).toBeNull();
    unmount();
  });

  it('10. RoleSyncProbe reports console.error on attribute mismatch', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <div>
        <div data-testid="navbar-role" data-active-role="Collaborator" />
        <div data-testid="sidebar-role" data-active-role="Project Owner" />
        <div data-testid="page-role" data-active-role="Collaborator" />
        <RoleSyncProbe />
      </div>,
    );

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('ROLE OUT OF SYNC'),
      );
    });
    consoleErrorSpy.mockRestore();
  });

  it('11. Role switch triggers at most 2 renders per click via useSelector', () => {
    let renderCount = 0;

    const Consumer = () => {
      const activeRole = useSelector(selectActiveRole);
      renderCount += 1;
      return <div data-testid="role-consumer">{activeRole}</div>;
    };

    renderWithReduxRole(<Consumer />, { store: activeStore });
    expect(renderCount).toBe(1);

    act(() => {
      activeStore.dispatch(setActiveRole('Project Owner'));
    });

    expect(renderCount).toBeLessThanOrEqual(2);
    expect(screen.getByTestId('role-consumer').textContent).toBe('Project Owner');
  });
});
