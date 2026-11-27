import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from '../routes/ProtectedRoute';
import CompleteProfile from '../pages/CompleteProfile';
import { Provider } from 'react-redux';
import { createAppStore } from '../store';

function TestProtectedComponent() {
  return <div>Protected Dashboard Content</div>;
}

function TestLoginComponent() {
  return <div>Login Page Content</div>;
}

function TestCompleteProfileComponent() {
  return <div>Complete Profile Page Content</div>;
}

describe('Phase 5 - Profile Complete Route Guard Tests', () => {
  it('redirects to /complete-profile when authenticated user has profileComplete: false', () => {
    const authValue = {
      isAuthenticated: true,
      loading: false,
      user: {
        id: 'u-social',
        email: 'social@example.com',
        profileComplete: false,
      },
      updateUser: vi.fn(),
    };

    const store = createAppStore({
      preloadedState: {
        session: {
          ...authValue,
          status: authValue.isAuthenticated ? 'authenticated' : 'signed_out',
        },
      },
    });

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<TestProtectedComponent />} />
            </Route>
            <Route path="/complete-profile" element={<TestCompleteProfileComponent />} />
            <Route path="/login" element={<TestLoginComponent />} />
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    expect(screen.getByText('Complete Profile Page Content')).toBeDefined();
    expect(screen.queryByText('Protected Dashboard Content')).toBeNull();
  });

  it('renders protected route when authenticated user has profileComplete: true', () => {
    const authValue = {
      isAuthenticated: true,
      loading: false,
      user: {
        id: 'u-collab',
        email: 'collab@example.com',
        profileComplete: true,
      },
      updateUser: vi.fn(),
    };

    const store = createAppStore({
      preloadedState: {
        session: {
          ...authValue,
          status: authValue.isAuthenticated ? 'authenticated' : 'signed_out',
        },
      },
    });

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<TestProtectedComponent />} />
            </Route>
            <Route path="/complete-profile" element={<TestCompleteProfileComponent />} />
            <Route path="/login" element={<TestLoginComponent />} />
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    expect(screen.getByText('Protected Dashboard Content')).toBeDefined();
    expect(screen.queryByText('Complete Profile Page Content')).toBeNull();
  });

  it('redirects unauthenticated user to /login', () => {
    const authValue = {
      isAuthenticated: false,
      loading: false,
      user: null,
      updateUser: vi.fn(),
    };

    const store = createAppStore({
      preloadedState: {
        session: {
          ...authValue,
          status: authValue.isAuthenticated ? 'authenticated' : 'signed_out',
        },
      },
    });

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<TestProtectedComponent />} />
            </Route>
            <Route path="/complete-profile" element={<TestCompleteProfileComponent />} />
            <Route path="/login" element={<TestLoginComponent />} />
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    expect(screen.getByText('Login Page Content')).toBeDefined();
    expect(screen.queryByText('Protected Dashboard Content')).toBeNull();
  });

  it('CompleteProfile redirects to /dashboard if user profile is already complete', () => {
    const authValue = {
      isAuthenticated: true,
      loading: false,
      user: {
        id: 'u-complete',
        email: 'complete@example.com',
        profileComplete: true,
      },
      updateUser: vi.fn(),
    };

    const store = createAppStore({
      preloadedState: {
        session: {
          ...authValue,
          status: authValue.isAuthenticated ? 'authenticated' : 'signed_out',
        },
      },
    });

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/complete-profile']}>
          <Routes>
            <Route path="/complete-profile" element={<CompleteProfile />} />
            <Route path="/dashboard" element={<TestProtectedComponent />} />
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    expect(screen.getByText('Protected Dashboard Content')).toBeDefined();
    expect(screen.queryByText(/Complete Your Profile/i)).toBeNull();
  });

  it('CompleteProfile redirects to /login if user is unauthenticated', () => {
    const authValue = {
      isAuthenticated: false,
      loading: false,
      user: null,
      updateUser: vi.fn(),
    };

    const store = createAppStore({
      preloadedState: {
        session: {
          ...authValue,
          status: 'signed_out',
        },
      },
    });

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/complete-profile']}>
          <Routes>
            <Route path="/complete-profile" element={<CompleteProfile />} />
            <Route path="/login" element={<TestLoginComponent />} />
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    expect(screen.getByText('Login Page Content')).toBeDefined();
    expect(screen.queryByText(/Complete Your Profile/i)).toBeNull();
  });
});
