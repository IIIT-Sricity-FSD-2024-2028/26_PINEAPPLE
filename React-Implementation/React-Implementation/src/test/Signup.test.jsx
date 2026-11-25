import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Signup from '../pages/Signup';
import { AuthContext } from '../context/AuthContext';
import usersApi from '../services/usersApi';

vi.mock('../services/apiClient', () => ({
  getAuthMode: () => 'jwt',
  setAccessToken: vi.fn(),
}));

vi.mock('../services/usersApi', () => ({
  default: {
    checkUsernameAvailable: vi.fn(),
  },
}));

vi.mock('../services/authApi', () => ({
  default: {
    signup: vi.fn(),
    createProfile: vi.fn(),
  },
}));

vi.mock('../services/firebase.js', () => ({
  auth: {},
  googleProvider: {},
  githubProvider: {},
}));

vi.mock('../services/adminApi', () => ({
  recordPortalAuditEntry: vi.fn(),
}));

function renderSignup(signupMock) {
  return render(
    <AuthContext.Provider value={{ login: vi.fn(), signup: signupMock }}>
      <MemoryRouter initialEntries={['/signup']}>
        <Routes>
          <Route path="/signup" element={<Signup />} />
          <Route path="/complete-profile" element={<div>Complete Profile Step 2</div>} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('Signup page without username field', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders only email, password, and confirm password (no username field)', () => {
    renderSignup(vi.fn());

    expect(screen.queryByPlaceholderText(/johndoe/i)).toBeNull();
    expect(screen.queryByText(/^Username$/i)).toBeNull();
    expect(screen.getByPlaceholderText(/name@example\.com/i)).toBeTruthy();
    expect(document.querySelectorAll('input[type="password"]').length).toBe(2);
  });

  it('submits email and password without username and redirects to /complete-profile', async () => {
    const signupMock = vi.fn().mockResolvedValueOnce({
      id: 'u-new',
      email: 'new.student@example.com',
      name: 'new.student',
      username: '',
      profileComplete: false,
    });

    renderSignup(signupMock);

    fireEvent.change(screen.getByPlaceholderText(/name@example\.com/i), {
      target: { value: 'new.student@example.com' },
    });
    const pwInputs = document.querySelectorAll('input[type="password"]');
    fireEvent.change(pwInputs[0], { target: { value: 'Password123!' } });
    fireEvent.change(pwInputs[1], { target: { value: 'Password123!' } });
    fireEvent.click(screen.getByRole('button', { name: /^Sign Up$/i }));

    await waitFor(() => {
      expect(signupMock).toHaveBeenCalledWith({
        email: 'new.student@example.com',
        password: 'Password123!',
        role: 'Collaborator',
      });
      expect(usersApi.checkUsernameAvailable).not.toHaveBeenCalled();
      expect(screen.getByText('Complete Profile Step 2')).toBeTruthy();
    });
  });

  it('validates password match and minimum length', async () => {
    const signupMock = vi.fn();
    renderSignup(signupMock);

    fireEvent.change(screen.getByPlaceholderText(/name@example\.com/i), {
      target: { value: 'student@example.com' },
    });
    const pwInputs = document.querySelectorAll('input[type="password"]');
    fireEvent.change(pwInputs[0], { target: { value: 'Password123!' } });
    fireEvent.change(pwInputs[1], { target: { value: 'Different123!' } });
    fireEvent.click(screen.getByRole('button', { name: /^Sign Up$/i }));

    expect(screen.getByText("Passwords don't match!")).toBeTruthy();
    expect(signupMock).not.toHaveBeenCalled();
  });
});
