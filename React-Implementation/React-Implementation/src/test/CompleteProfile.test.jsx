import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import CompleteProfile from '../pages/CompleteProfile';
import { usersApi } from '../services/usersApi';
import { authApi } from '../services/authApi';
import { AuthContext } from '../context/AuthContext';
import { MemoryRouter } from 'react-router-dom';
import { render } from '@testing-library/react';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({
      state: { name: 'Alex Johnson', email: 'alex.j@gmail.com' },
    }),
  };
});

vi.mock('../services/usersApi', () => ({
  usersApi: {
    checkUsernameAvailable: vi.fn(),
  },
  default: {
    checkUsernameAvailable: vi.fn(),
  },
}));

vi.mock('../services/authApi', () => ({
  authApi: {
    createProfile: vi.fn(),
  },
  default: {
    createProfile: vi.fn(),
  },
}));

function renderCompleteProfile(authContextValue = {}) {
  const defaultAuth = {
    user: { id: 'test-user-123', email: 'alex.j@gmail.com', profileComplete: false },
    isAuthenticated: true,
    loading: false,
    updateUser: vi.fn(),
    ...authContextValue,
  };

  return {
    ...render(
      <MemoryRouter>
        <AuthContext.Provider value={defaultAuth}>
          <CompleteProfile />
        </AuthContext.Provider>
      </MemoryRouter>
    ),
    auth: defaultAuth,
  };
}

describe('Phase 5 - CompleteProfile Component Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders complete profile form with prefilled name and empty username', () => {
    renderCompleteProfile();

    expect(screen.getByText(/Complete Your Profile/i)).toBeDefined();
    const nameInput = screen.getByLabelText(/Full Name/i);
    expect(nameInput.value).toBe('Alex Johnson');

    const usernameInput = screen.getByPlaceholderText(/unique_username/i);
    expect(usernameInput.value).toBe('');

    const submitBtn = screen.getByRole('button', { name: /Complete Profile & Continue/i });
    expect(submitBtn.disabled).toBe(true);
  });

  it('displays validation error when username format is invalid', async () => {
    renderCompleteProfile();

    const usernameInput = screen.getByPlaceholderText(/unique_username/i);
    fireEvent.change(usernameInput, { target: { value: 'ab' } });

    await waitFor(() => {
      expect(screen.getByText(/Username must be 3-30 characters/i)).toBeDefined();
    });

    const submitBtn = screen.getByRole('button', { name: /Complete Profile & Continue/i });
    expect(submitBtn.disabled).toBe(true);
  });

  it('checks username availability with debounce and shows taken error', async () => {
    usersApi.checkUsernameAvailable.mockResolvedValueOnce({ available: false });

    renderCompleteProfile();

    const usernameInput = screen.getByPlaceholderText(/unique_username/i);
    fireEvent.change(usernameInput, { target: { value: 'alexjohnson' } });

    await waitFor(() => {
      expect(usersApi.checkUsernameAvailable).toHaveBeenCalledWith('alexjohnson');
    });

    await waitFor(() => {
      expect(screen.getByText(/This username is already taken/i)).toBeDefined();
    });

    const submitBtn = screen.getByRole('button', { name: /Complete Profile & Continue/i });
    expect(submitBtn.disabled).toBe(true);
  });

  it('enables submit button when username is available and submits profile', async () => {
    usersApi.checkUsernameAvailable.mockResolvedValueOnce({ available: true });
    authApi.createProfile.mockResolvedValueOnce({
      id: 'test-user-123',
      name: 'Alex Johnson',
      username: 'alex_j',
      role: 'Collaborator',
      profileComplete: true,
    });

    const { auth } = renderCompleteProfile();

    const usernameInput = screen.getByPlaceholderText(/unique_username/i);
    fireEvent.change(usernameInput, { target: { value: 'alex_j' } });

    const universityInput = screen.getByLabelText(/University \/ Institution/i);
    fireEvent.change(universityInput, { target: { value: 'MIT' } });

    await waitFor(() => {
      expect(screen.getByText(/Username is available/i)).toBeDefined();
    });

    const submitBtn = screen.getByRole('button', { name: /Complete Profile & Continue/i });
    expect(submitBtn.disabled).toBe(false);

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(authApi.createProfile).toHaveBeenCalledWith({
        name: 'Alex Johnson',
        username: 'alex_j',
        university: 'MIT',
        role: 'Collaborator',
      });
      expect(auth.updateUser).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'alex_j',
          profileComplete: true,
        })
      );
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
    });
  });

  it('displays error banner if backend rejects username with 409 conflict', async () => {
    usersApi.checkUsernameAvailable.mockResolvedValueOnce({ available: true });
    authApi.createProfile.mockRejectedValueOnce({
      status: 409,
      message: 'This username is already taken.',
    });

    renderCompleteProfile();

    const usernameInput = screen.getByPlaceholderText(/unique_username/i);
    fireEvent.change(usernameInput, { target: { value: 'alex_j' } });

    await waitFor(() => {
      expect(screen.getByText(/Username is available/i)).toBeDefined();
    });

    const submitBtn = screen.getByRole('button', { name: /Complete Profile & Continue/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Please choose another/i)).toBeDefined();
    });
  });
});
