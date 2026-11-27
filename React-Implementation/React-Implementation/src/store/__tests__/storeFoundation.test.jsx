import { describe, it, expect, afterEach } from 'vitest';
import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import { screen, fireEvent } from '@testing-library/react';
import { useSelector } from 'react-redux';
import { Link, Route, Routes } from 'react-router-dom';
import { createAppStore } from '../index';
import {
  routeChanged,
  resetRouteGroup,
  sessionReset,
} from '../actions/appActions';
import { RESET_SCOPE } from '../utils/routeReset';
import { normalizeThunkError } from '../utils/thunkError';
import { getRouteGroup } from '../middleware/routeResetListener';
import {
  setupInterceptors,
  dispatchFromInterceptor,
  getStateFromInterceptor,
} from '../utils/setupInterceptors';
import RouteResetListener from '../components/RouteResetListener';
import { renderWithStore } from '../../test/test-utils';

// Sample slice verifying Reading B (clear working state, keep entities) & Reading A (group reset)
const demoAdapter = createEntityAdapter();
const initialDemoWorking = { searchQuery: '', selectedId: null, error: null };
const demoSelectors = demoAdapter.getSelectors((state) => state.demo);

const demoSlice = createSlice({
  name: 'demo',
  initialState: demoAdapter.getInitialState({
    fetchStatus: 'idle',
    working: initialDemoWorking,
  }),
  reducers: {
    setAll(state, action) {
      demoAdapter.setAll(state, action.payload);
    },
    setSearchQuery(state, action) {
      state.working.searchQuery = action.payload;
    },
    clearWorkingState(state) {
      state.working = initialDemoWorking;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(routeChanged, (state) => {
        state.working = initialDemoWorking;
      })
      .addCase(resetRouteGroup, (state, action) => {
        if (action.payload?.leftGroup === 'projects') {
          return demoSlice.getInitialState();
        }
        return state;
      })
      .addCase(sessionReset, () => demoSlice.getInitialState());
  },
});

describe('Phase 0 Store Foundation', () => {
  let cleanupInterceptor = null;

  afterEach(() => {
    if (cleanupInterceptor) {
      cleanupInterceptor();
      cleanupInterceptor = null;
    }
  });

  it('creates an isolated Redux store with Reading B (page) as default scope', () => {
    expect(RESET_SCOPE).toBe('page');
    const store = createAppStore();
    expect(store.getState()).toHaveProperty('ui');
    expect(store.getState().ui.theme).toMatch(/^(light|dark)$/);
  });

  it('normalizes apiClient and HttpExceptionFilter errors cleanly via normalizeThunkError', () => {
    const rawErr = new Error('Validation Error: Due date cannot be after project due date');
    rawErr.statusCode = 400;
    rawErr.serverMessage = 'Due date cannot be after project due date';
    rawErr.code = 'DUE_DATE_AFTER_PROJECT';
    rawErr.field = 'dueDate';
    rawErr.blockers = [{ id: 't-1' }];
    rawErr.data = {
      statusCode: 400,
      error: 'Bad Request',
      code: 'DUE_DATE_AFTER_PROJECT',
      message: ['Due date cannot be after project due date'],
    };

    expect(normalizeThunkError(rawErr)).toEqual({
      statusCode: 400,
      error: 'Bad Request',
      code: 'DUE_DATE_AFTER_PROJECT',
      message: 'Due date cannot be after project due date',
      field: 'dueDate',
      blockers: [{ id: 't-1' }],
    });

    const netErr = new Error('Network error');
    netErr.isNetworkError = true;
    expect(normalizeThunkError(netErr)).toEqual({
      statusCode: 0,
      error: 'Error',
      code: 'NETWORK_ERROR',
      message: 'Network error',
      field: null,
    });
  });

  it('binds interceptors safely without circular imports and cleans up', () => {
    const store = createAppStore({
      extraReducers: { demo: demoSlice.reducer },
    });
    cleanupInterceptor = setupInterceptors(store);

    dispatchFromInterceptor(demoSlice.actions.setSearchQuery('react'));
    expect(getStateFromInterceptor().demo.working.searchQuery).toBe('react');

    cleanupInterceptor();
    cleanupInterceptor = null;
    expect(getStateFromInterceptor()).toBeUndefined();
  });

  it('maps pathnames to first-segment route groups and supports group reset toggle', () => {
    expect(getRouteGroup('/admin/users')).toBe('admin');
    expect(getRouteGroup('/owner/workspace/p1?tab=chat')).toBe('owner');
    expect(getRouteGroup('/my-projects')).toBe('my-projects');
    expect(getRouteGroup('/projects')).toBe('projects');
    expect(getRouteGroup('/mentor/requests')).toBe('mentor');
    expect(getRouteGroup('/dashboard')).toBe('dashboard');

    const storeGroup = createAppStore({
      extraReducers: { demo: demoSlice.reducer },
      routeResetScope: 'group',
    });
    storeGroup.dispatch(demoSlice.actions.setAll([{ id: 'p1', title: 'Alpha' }]));
    storeGroup.dispatch(demoSlice.actions.setSearchQuery('filter'));

    // Leaving projects group -> group reset resets full slice via listener middleware
    storeGroup.dispatch(routeChanged({ from: '/projects', to: '/dashboard', scope: 'group' }));
    expect(storeGroup.getState().demo.ids).toEqual([]);
    expect(storeGroup.getState().demo.working.searchQuery).toBe('');
  });

  it('dispatches routeChanged via RouteResetListener on pathname change, keeping entities and ignoring query-only changes', () => {
    function ProjectsView() {
      const items = useSelector(demoSelectors.selectAll);
      const query = useSelector((s) => s.demo.working.searchQuery);
      return (
        <div>
          <span data-testid="proj-count">{items.length}</span>
          <span data-testid="search-query">{query}</span>
          <Link to="/projects?tab=invites">Switch Query Tab</Link>
          <Link to="/dashboard">Go Dashboard</Link>
        </div>
      );
    }

    function DashboardView() {
      const items = useSelector(demoSelectors.selectAll);
      const query = useSelector((s) => s.demo.working.searchQuery);
      return (
        <div>
          <span data-testid="dash-proj-count">{items.length}</span>
          <span data-testid="dash-search-query">{query}</span>
        </div>
      );
    }

    renderWithStore(
      <>
        <RouteResetListener />
        <Routes>
          <Route path="/projects" element={<ProjectsView />} />
          <Route path="/dashboard" element={<DashboardView />} />
        </Routes>
      </>,
      {
        route: '/projects',
        extraReducers: { demo: demoSlice.reducer },
        preloadedState: {
          demo: {
            ids: ['p1'],
            entities: { p1: { id: 'p1', title: 'TeamForge UI' } },
            fetchStatus: 'succeeded',
            working: { searchQuery: 'redux', selectedId: 'p1', error: null },
          },
        },
      },
    );

    expect(screen.getByTestId('proj-count').textContent).toBe('1');
    expect(screen.getByTestId('search-query').textContent).toBe('redux');

    // Query-param-only change must NOT clear working state
    fireEvent.click(screen.getByText('Switch Query Tab'));
    expect(screen.getByTestId('search-query').textContent).toBe('redux');

    // Real pathname navigation clears working state (Reading B) while keeping loaded entities
    fireEvent.click(screen.getByText('Go Dashboard'));
    expect(screen.getByTestId('dash-search-query').textContent).toBe('');
    expect(screen.getByTestId('dash-proj-count').textContent).toBe('1');
  });
});
