import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Login from '../pages/Login.jsx';
import { Provider } from 'react-redux';
import { store } from '../store/index.js';
import { setBootId } from '../store/slices/sessionSlice.js';
import { selectBootId } from '../store/selectors/sessionSelectors.js';
import tokenManager from '../services/tokenManager.js';
import { setAuthMode } from '../services/apiClient.js';

describe('Fix 1: Login on first attempt after server restart / bootId change', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAuthMode('jwt');
    tokenManager.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setAuthMode(null);
  });

  it('logs in successfully on the first attempt when server restarted (new boot ID)', async () => {
    // Simulate user having an old boot ID in Redux session state from before restart
    store.dispatch(setBootId('old-server-boot-id-1234'));

    const newBootId = 'new-server-boot-id-5678';
    const fakeToken = 'header.payload.signature';

    const fetchMock = vi.fn().mockImplementation((url) => {
      const urlStr = String(url);
      if (urlStr.includes('/auth/refresh')) {
        return Promise.resolve({
          ok: false,
          status: 401,
          headers: new Headers({
            'Content-Type': 'application/json',
            'X-Boot-Id': newBootId,
          }),
          json: async () => ({ message: 'No refresh token' }),
          clone() {
            return this;
          },
        });
      }
      if (urlStr.includes('/auth/login')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({
            'Content-Type': 'application/json',
            'X-Boot-Id': newBootId,
          }),
          json: async () => ({
            accessToken: fakeToken,
            refreshToken: 'refresh-token-123',
            user: {
              id: 'user-1',
              email: 'test@teamforge.com',
              name: 'Test User',
              role: 'Collaborator',
              profileComplete: true,
            },
          }),
          clone() {
            return this;
          },
        });
      }
      if (urlStr.includes('/auth/me')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({
            'Content-Type': 'application/json',
            'X-Boot-Id': newBootId,
          }),
          json: async () => ({
            id: 'user-1',
            email: 'test@teamforge.com',
            name: 'Test User',
            role: 'Collaborator',
            profileComplete: true,
          }),
          clone() {
            return this;
          },
        });
      }
      if (urlStr.includes('/health')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({
            'Content-Type': 'application/json',
            'X-Boot-Id': newBootId,
          }),
          json: async () => ({ status: 'ok', bootId: newBootId }),
        });
      }
      return Promise.reject(new Error(`Unhandled URL: ${urlStr}`));
    });

    vi.stubGlobal('fetch', fetchMock);

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<div data-testid="dashboard-page">Welcome to Dashboard</div>} />
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    // Fill in credentials using placeholder text
    const emailInput = screen.getByPlaceholderText(/username or name@example\.com/i);
    const passwordInput = screen.getByPlaceholderText(/••••••/);
    const signInButton = screen.getByRole('button', { name: /^sign in$/i });

    fireEvent.change(emailInput, { target: { value: 'test@teamforge.com' } });
    fireEvent.change(passwordInput, { target: { value: 'ValidPassword123!' } });

    // Click submit ONCE
    fireEvent.click(signInButton);

    // It should navigate to /dashboard ON FIRST ATTEMPT
    await waitFor(() => {
      expect(screen.getByTestId('dashboard-page')).toBeTruthy();
    });

    // Boot ID must now be updated to newBootId in sessionSlice
    expect(selectBootId(store.getState())).toBe(newBootId);
    // Tokens must be saved in memory tokenManager
    expect(tokenManager.getAccessToken()).toBe(fakeToken);
  });
});
