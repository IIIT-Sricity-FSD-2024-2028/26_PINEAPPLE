import { useEffect } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import { act, screen, fireEvent } from '@testing-library/react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, Route, Routes } from 'react-router-dom';
import { createAppStore } from '../index';
import uiReducer, {
  clearToasts,
  clearWorkingUI,
  closeAllDropdowns,
  closeGlobalModal,
  dismissToast,
  enqueueToast,
  getInitialTheme,
  openGlobalModal,
  resetUISlice,
  setDropdownOpen,
  setMaintenance,
  setResettingBanner,
  setSidebarOpen,
  setTheme,
  toggleSidebar,
  toggleTheme,
} from '../slices/uiSlice';
import {
  selectActiveModal,
  selectHasAnyOpenDropdown,
  selectIsDropdownOpen,
  selectMaintenance,
  selectModalProps,
  selectResettingBanner,
  selectSidebarOpen,
  selectTheme,
  selectToasts,
} from '../selectors/uiSelectors';
import { routeChanged, sessionReset } from '../actions/appActions';
import { RESET_SCOPE, addRouteReset, getPathGroup } from '../utils/routeReset';
import { applyThemeTokens } from '../utils/themeTokens';
import RouteResetListener from '../components/RouteResetListener';
import ToastViewport from '../../components/common/ToastViewport';
import { renderWithStore } from '../../test/test-utils';

const sampleAdapter = createEntityAdapter();
const initialWorking = { searchQuery: '', selectedId: null, error: null };

const sampleSlice = createSlice({
  name: 'sample',
  initialState: sampleAdapter.getInitialState({
    working: initialWorking,
  }),
  reducers: {
    setWorkingSearch(state, action) {
      state.working.searchQuery = action.payload;
    },
  },
  extraReducers: (builder) => {
    addRouteReset(builder, (state) => {
      state.working = { ...initialWorking };
    });
  },
});

const groupScopedSlice = createSlice({
  name: 'groupScoped',
  initialState: { working: { filter: 'open', tab: 'list' } },
  reducers: {
    setFilter(state, action) {
      state.working.filter = action.payload;
    },
  },
  extraReducers: (builder) => {
    addRouteReset(
      builder,
      (state) => {
        state.working = { filter: 'open', tab: 'list' };
      },
      'group',
    );
  },
});

const mockSessionSlice = createSlice({
  name: 'session',
  initialState: { user: null, activeRole: 'collaborator' },
  reducers: {},
});

describe('Phase 2: uiSlice, theme tokens, toasts & route-leave reset', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = '';
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    vi.restoreAllMocks();
  });

  it('uiSlice reducers manage theme, sidebar, toasts, dropdowns, modals, banners, and sessionReset', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    expect(getInitialTheme()).toBe('light');

    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    expect(getInitialTheme()).toBe('light');

    let state = uiReducer(undefined, setTheme('dark'));
    expect(state.theme).toBe('dark');
    state = uiReducer(state, toggleTheme());
    expect(state.theme).toBe('light');

    state = uiReducer(state, setSidebarOpen(false));
    expect(state.sidebarOpen).toBe(false);
    state = uiReducer(state, toggleSidebar());
    expect(state.sidebarOpen).toBe(true);

    state = uiReducer(
      state,
      enqueueToast({ id: 't1', message: 'Saved draft', type: 'success' }),
    );
    state = uiReducer(state, enqueueToast('Second alert'));
    expect(state.toasts).toHaveLength(2);

    state = uiReducer(state, dismissToast('t1'));
    expect(state.toasts).toHaveLength(1);
    expect(state.toasts[0].message).toBe('Second alert');

    state = uiReducer(state, clearToasts());
    expect(state.toasts).toEqual([]);

    state = uiReducer(
      state,
      setDropdownOpen({ name: 'roleMenu', isOpen: true }),
    );
    expect(selectHasAnyOpenDropdown({ ui: state })).toBe(true);
    expect(selectIsDropdownOpen('roleMenu')({ ui: state })).toBe(true);
    state = uiReducer(state, closeAllDropdowns());
    expect(selectHasAnyOpenDropdown({ ui: state })).toBe(false);

    state = uiReducer(
      state,
      openGlobalModal({ modal: 'confirmDelete', props: { id: 'p1' } }),
    );
    expect(selectActiveModal({ ui: state })).toBe('confirmDelete');
    expect(selectModalProps({ ui: state })).toEqual({ id: 'p1' });
    state = uiReducer(state, closeGlobalModal());
    expect(selectActiveModal({ ui: state })).toBeNull();

    state = uiReducer(
      state,
      setMaintenance({ active: true, message: 'Server updating' }),
    );
    state = uiReducer(
      state,
      setResettingBanner({ active: true, message: 'Resetting demo' }),
    );
    expect(selectMaintenance({ ui: state })).toEqual({
      active: true,
      message: 'Server updating',
    });
    expect(selectResettingBanner({ ui: state })).toEqual({
      active: true,
      message: 'Resetting demo',
    });

    state = uiReducer(
      state,
      setDropdownOpen({ name: 'profileMenu', isOpen: true }),
    );
    state = uiReducer(state, openGlobalModal('inviteModal'));
    state = uiReducer(state, clearWorkingUI());
    expect(selectActiveModal({ ui: state })).toBeNull();
    expect(selectHasAnyOpenDropdown({ ui: state })).toBe(false);

    state = uiReducer(state, setTheme('dark'));
    state = uiReducer(state, enqueueToast({ id: 'persist-t', message: 'Keep' }));
    state = uiReducer(state, sessionReset());
    expect(state.theme).toBe('dark');
    expect(state.sidebarOpen).toBe(true);
    expect(state.toasts).toEqual([]);

    state = uiReducer(state, resetUISlice());
    expect(state.theme).toBe('dark');
  });

  it('route change clears open modals, dropdowns, and slice working state while preserving theme, toasts, sidebarOpen, session, and entities', () => {
    expect(RESET_SCOPE).toBe('page');

    function ProjectsPage() {
      const theme = useSelector(selectTheme);
      const sidebarOpen = useSelector(selectSidebarOpen);
      const toasts = useSelector(selectToasts);
      const activeModal = useSelector(selectActiveModal);
      const anyDropdown = useSelector(selectHasAnyOpenDropdown);
      const query = useSelector((s) => s.sample.working.searchQuery);
      const count = useSelector((s) => s.sample.ids.length);
      const userEmail = useSelector((s) => s.session.user?.email);

      return (
        <div>
          <span data-testid="state-dump">
            {`${theme}|${sidebarOpen}|${toasts.length}|${activeModal}|${anyDropdown}|${query}|${count}|${userEmail}`}
          </span>
          <Link to="/projects?tab=invites">Same Path Query</Link>
          <Link to="/dashboard">Leave To Dashboard</Link>
        </div>
      );
    }

    function DashboardPage() {
      const theme = useSelector(selectTheme);
      const sidebarOpen = useSelector(selectSidebarOpen);
      const toasts = useSelector(selectToasts);
      const activeModal = useSelector(selectActiveModal);
      const anyDropdown = useSelector(selectHasAnyOpenDropdown);
      const query = useSelector((s) => s.sample.working.searchQuery);
      const count = useSelector((s) => s.sample.ids.length);
      const userEmail = useSelector((s) => s.session.user?.email);

      return (
        <div data-testid="after-nav-dump">
          {`${theme}|${sidebarOpen}|${toasts.length}|${activeModal}|${anyDropdown}|${query}|${count}|${userEmail}`}
        </div>
      );
    }

    renderWithStore(
      <>
        <RouteResetListener />
        <Routes>
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
        </Routes>
      </>,
      {
        route: '/projects',
        extraReducers: {
          sample: sampleSlice.reducer,
          session: mockSessionSlice.reducer,
        },
        preloadedState: {
          ui: {
            theme: 'dark',
            sidebarOpen: false,
            toasts: [{ id: 't1', message: 'Still here', type: 'info', durationMs: 3500 }],
            openDropdowns: { roleMenu: true, profileMenu: false, chatUnreadMenu: true },
            activeModal: 'deleteProjectModal',
            modalProps: { projectId: 'p1' },
            maintenance: { active: false, message: '' },
            resettingBanner: { active: false, message: '' },
          },
          session: {
            user: { id: 'u1', email: 'student@teamforge.dev' },
            activeRole: 'owner',
          },
          sample: {
            ids: ['p1'],
            entities: { p1: { id: 'p1', title: 'Alpha' } },
            working: { searchQuery: 'redux', selectedId: 'p1', error: null },
          },
        },
      },
    );

    expect(screen.getByTestId('state-dump').textContent).toBe(
      'dark|false|1|deleteProjectModal|true|redux|1|student@teamforge.dev',
    );

    // Query-only change ignores routeChanged completely
    fireEvent.click(screen.getByText('Same Path Query'));
    expect(screen.getByTestId('state-dump').textContent).toBe(
      'dark|false|1|deleteProjectModal|true|redux|1|student@teamforge.dev',
    );

    // Path change clears modals, dropdowns, and working state while keeping theme, toasts, sidebarOpen, session, entities
    fireEvent.click(screen.getByText('Leave To Dashboard'));
    expect(screen.getByTestId('after-nav-dump').textContent).toBe(
      'dark|false|1|null|false||1|student@teamforge.dev',
    );
  });

  it('RESET_SCOPE = "group" keeps working state within same first path segment and clears across groups', () => {
    expect(getPathGroup('/admin/users')).toBe('admin');
    expect(getPathGroup('/admin/reports')).toBe('admin');
    expect(getPathGroup('/dashboard')).toBe('dashboard');

    const store = createAppStore({
      extraReducers: {
        groupScoped: groupScopedSlice.reducer,
      },
    });

    store.dispatch(groupScopedSlice.actions.setFilter('closed'));
    expect(store.getState().groupScoped.working.filter).toBe('closed');

    // Same group ('admin' -> 'admin'): addRouteReset(..., 'group') keeps working state
    store.dispatch(
      routeChanged({
        from: '/admin/users',
        to: '/admin/reports',
        group: 'admin',
        fromGroup: 'admin',
      }),
    );
    expect(store.getState().groupScoped.working.filter).toBe('closed');

    // Also test global ui working clear when routeChanged carries scope: 'group'
    store.dispatch(setDropdownOpen({ name: 'roleMenu', isOpen: true }));
    store.dispatch(
      routeChanged({
        from: '/admin/users',
        to: '/admin/reports',
        group: 'admin',
        fromGroup: 'admin',
        scope: 'group',
      }),
    );
    expect(selectHasAnyOpenDropdown(store.getState())).toBe(true);

    // Different group ('admin' -> 'dashboard'): resets both
    store.dispatch(
      routeChanged({
        from: '/admin/reports',
        to: '/dashboard',
        group: 'dashboard',
        fromGroup: 'admin',
        scope: 'group',
      }),
    );
    expect(store.getState().groupScoped.working.filter).toBe('open');
    expect(selectHasAnyOpenDropdown(store.getState())).toBe(false);
  });

  it('ToastViewport renders dispatched toast once without DOM events and dismisses cleanly', () => {
    const { store } = renderWithStore(<ToastViewport />);

    fireEvent(
      window,
      new CustomEvent('teamforge:toast', { detail: { message: 'Legacy ignored' } }),
    );
    expect(screen.queryByText('Legacy ignored')).toBeNull();

    act(() => {
      store.dispatch(
        enqueueToast({ id: 'toast-1', message: 'Profile synced via Redux', type: 'success' }),
      );
    });

    expect(screen.getAllByText('Profile synced via Redux')).toHaveLength(1);
    expect(screen.getByTestId('global-toast-viewport')).not.toBeNull();

    fireEvent.click(screen.getByLabelText('Dismiss notification'));
    expect(screen.queryByText('Profile synced via Redux')).toBeNull();
    expect(selectToasts(store.getState())).toEqual([]);
  });

  it('theme toggles via uiSlice, applies tokens to documentElement, survives navigation, and resets to light on fresh store', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });

    function ThemeHarness() {
      const dispatch = useDispatch();
      const theme = useSelector(selectTheme);
      useEffect(() => {
        applyThemeTokens(theme);
      }, [theme]);

      return (
        <div>
          <span data-testid="current-theme">{theme}</span>
          <button type="button" onClick={() => dispatch(toggleTheme())}>
            Toggle Theme
          </button>
          <Link to="/next">Go Next</Link>
        </div>
      );
    }

    renderWithStore(
      <>
        <RouteResetListener />
        <Routes>
          <Route path="/start" element={<ThemeHarness />} />
          <Route path="/next" element={<ThemeHarness />} />
        </Routes>
      </>,
      {
        route: '/start',
        preloadedState: {
          ui: {
            theme: getInitialTheme(),
            sidebarOpen: true,
            toasts: [],
            openDropdowns: { roleMenu: false, profileMenu: false, chatUnreadMenu: false },
            activeModal: null,
            modalProps: null,
            maintenance: { active: false, message: '' },
            resettingBanner: { active: false, message: '' },
          },
        },
      },
    );

    expect(screen.getByTestId('current-theme').textContent).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    fireEvent.click(screen.getByText('Toggle Theme'));
    expect(screen.getByTestId('current-theme').textContent).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');

    // Theme survives navigation
    fireEvent.click(screen.getByText('Go Next'));
    expect(screen.getByTestId('current-theme').textContent).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    // Never stored in browser storage
    expect(localStorage.getItem('teamforge.theme')).toBeNull();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);

    // Simulating full page reload (fresh store defaults to light even when OS prefers dark)
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    const reloadedStoreLight = createAppStore();
    expect(selectTheme(reloadedStoreLight.getState())).toBe('light');
    expect(getInitialTheme()).toBe('light');
  });
});
