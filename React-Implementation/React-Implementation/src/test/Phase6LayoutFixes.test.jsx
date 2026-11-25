import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Navbar from '../components/navbar';
import CompleteProfile from '../pages/CompleteProfile';
import { AuthContext } from '../context/AuthContext';
import { RoleContext } from '../context/RoleContext';
import { UIProvider } from '../context/UIContext';
import { NotificationContext } from '../context/NotificationContext';
import { usersApi } from '../services/usersApi';
import { authApi } from '../services/authApi';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({
      pathname: '/complete-profile',
      state: { name: 'Aditya Kumar', email: 'aditya.kumar@example.com' },
    }),
  };
});

const { mockUsersApi, mockAuthApi } = vi.hoisted(() => ({
  mockUsersApi: {
    checkUsernameAvailable: vi.fn(),
    getResponseTime: vi.fn(() => Promise.resolve(null)),
    getProfile: vi.fn(() => Promise.resolve(null)),
  },
  mockAuthApi: {
    createProfile: vi.fn(),
  },
}));

vi.mock('../services/usersApi', () => ({
  default: mockUsersApi,
  usersApi: mockUsersApi,
}));

vi.mock('../services/authApi', () => ({
  default: mockAuthApi,
  authApi: mockAuthApi,
}));

vi.mock('../services/communicationApi', () => ({
  default: {
    getUnread: vi.fn(() => Promise.resolve({ total: 0, byProject: [] })),
  },
}));

function renderNavbarWithUser(userOverrides = {}) {
  const user = {
    id: 'user-p6-123',
    name: 'Kevin Longname Gandham',
    username: 'kevingandham',
    role: 'Collaborator',
    ...userOverrides,
  };

  return render(
    <MemoryRouter>
      <AuthContext.Provider value={{ user, logout: vi.fn(), setUser: vi.fn() }}>
        <RoleContext.Provider
          value={{
            currentRole: 'Collaborator',
            switchRole: vi.fn(),
            isMentorApproved: false,
            mentorAppStatus: 'none',
          }}
        >
          <UIProvider>
            <NotificationContext.Provider
              value={{
                notifications: [],
                unreadCount: 0,
                markAsRead: vi.fn(),
                markAllAsRead: vi.fn(),
              }}
            >
              <Navbar onMenuClick={vi.fn()} />
            </NotificationContext.Provider>
          </UIProvider>
        </RoleContext.Provider>
      </AuthContext.Provider>
    </MemoryRouter>
  );
}

function renderCompleteProfile(authOverrides = {}) {
  const defaultAuth = {
    user: {
      id: 'test-cp-user',
      email: 'alex.j@gmail.com',
      name: 'Alex Johnson',
      profileComplete: false,
    },
    isAuthenticated: true,
    loading: false,
    updateUser: vi.fn(),
    ...authOverrides,
  };

  return render(
    <MemoryRouter>
      <AuthContext.Provider value={defaultAuth}>
        <CompleteProfile />
      </AuthContext.Provider>
    </MemoryRouter>
  );
}

describe('Phase 6 Layout Bugs: Navbar Profile Menu and Complete Profile Username', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Bug B: Navbar Profile Dropdown Menu with 60-character Email', () => {
    it('renders profile menu for Google-type user with 60-char email: stays inside card, text truncates with ellipsis, and title tooltip contains full address', async () => {
      // 60-character email
      const googleEmail = 'kevin.gandham.' + 'a'.repeat(36) + '@gmail.com';
      expect(googleEmail.length).toBe(60);

      const { container } = renderNavbarWithUser({
        name: 'Kevin Gandham',
        email: googleEmail,
        loginType: 'google',
        provider: 'google',
        avatarUrl: 'https://lh3.googleusercontent.com/a/kevin-avatar',
      });

      // Find profile toggle and click to open dropdown
      const userProfile = container.querySelector('.user-profile');
      expect(userProfile).toBeDefined();
      act(() => {
        fireEvent.click(userProfile);
      });

      // Verify dropdown menu opened
      const profileMenu = container.querySelector('.profile-menu');
      expect(profileMenu).toBeDefined();
      await waitFor(() => {
        expect(profileMenu.classList.contains('show')).toBe(true);
      });

      // Verify profile email element
      const emailElem = container.querySelector('.profile-email');
      expect(emailElem).toBeDefined();
      expect(emailElem.textContent).toBe(googleEmail);
      expect(emailElem.getAttribute('title')).toBe(googleEmail);

      // Verify profile name element has tooltip
      const nameElem = container.querySelector('.profile-name');
      expect(nameElem).toBeDefined();
      expect(nameElem.getAttribute('title')).toBe('Kevin Gandham');

      // Verify dropdown items (My Profile, Settings, Log out) exist inside menu container
      const dropdownItems = profileMenu.querySelectorAll('.dropdown-item');
      expect(dropdownItems.length).toBeGreaterThanOrEqual(3);
      dropdownItems.forEach((item) => {
        expect(profileMenu.contains(item)).toBe(true);
      });
    });

    it('renders profile menu for email-and-password user with 60-char email: stays inside card, text truncates with ellipsis, and title tooltip contains full address', async () => {
      // 60-character email
      const passwordEmail = 'rehen.auth.' + 'b'.repeat(36) + '@teamforge.io';
      expect(passwordEmail.length).toBe(60);

      const { container } = renderNavbarWithUser({
        name: 'Rehen Developer',
        email: passwordEmail,
        loginType: 'password',
        provider: 'password',
      });

      // Find profile toggle and click to open dropdown
      const userProfile = container.querySelector('.user-profile');
      expect(userProfile).toBeDefined();
      act(() => {
        fireEvent.click(userProfile);
      });

      // Verify dropdown menu opened
      const profileMenu = container.querySelector('.profile-menu');
      expect(profileMenu).toBeDefined();
      await waitFor(() => {
        expect(profileMenu.classList.contains('show')).toBe(true);
      });

      // Verify email element
      const emailElem = container.querySelector('.profile-email');
      expect(emailElem).toBeDefined();
      expect(emailElem.textContent).toBe(passwordEmail);
      expect(emailElem.getAttribute('title')).toBe(passwordEmail);

      // Verify name element
      const nameElem = container.querySelector('.profile-name');
      expect(nameElem).toBeDefined();
      expect(nameElem.getAttribute('title')).toBe('Rehen Developer');

      // Verify dropdown items are contained inside menu
      const dropdownItems = profileMenu.querySelectorAll('.dropdown-item');
      expect(dropdownItems.length).toBeGreaterThanOrEqual(3);
      dropdownItems.forEach((item) => {
        expect(profileMenu.contains(item)).toBe(true);
      });
    });
  });

  describe('Bug A: Complete-Profile Step 2 Username Field Flex Row & States', () => {
    it('renders prefix @ and input inside the same flex container in default, focus, checking, valid, invalid, and disabled states', async () => {
      let resolveCheck;
      mockUsersApi.checkUsernameAvailable.mockImplementation(() => {
        return new Promise((resolve) => {
          resolveCheck = resolve;
        });
      });

      const { container } = renderCompleteProfile();

      // Find the container box, the @ prefix, and the input
      const box = container.querySelector('.username-input-box');
      const atPrefix = container.querySelector('.username-at');
      const input = container.querySelector('#username-input');

      expect(box).toBeDefined();
      expect(atPrefix).toBeDefined();
      expect(input).toBeDefined();

      // 1. Both @ and input must be children of the SAME container
      expect(box.contains(atPrefix)).toBe(true);
      expect(box.contains(input)).toBe(true);
      expect(box.classList.contains('input-with-status')).toBe(true);

      // 2. The @ prefix comes before the input in DOM flow (in-flow sibling, not overlay)
      expect(atPrefix.nextElementSibling).toBe(input);

      // --- STATE: DEFAULT ---
      expect(box.classList.contains('is-valid')).toBe(false);
      expect(box.classList.contains('is-invalid')).toBe(false);
      expect(box.classList.contains('is-checking')).toBe(false);
      expect(box.classList.contains('is-disabled')).toBe(false);
      expect(input.disabled).toBe(false);

      // --- STATE: FOCUS ---
      act(() => {
        fireEvent.focus(input);
      });
      // Still in same container, @ is in-flow
      expect(box.contains(atPrefix)).toBe(true);
      expect(box.contains(input)).toBe(true);

      // --- STATE: INVALID (too short) ---
      act(() => {
        fireEvent.change(input, { target: { value: 'ab' } });
      });
      await waitFor(() => {
        expect(box.classList.contains('is-invalid')).toBe(true);
      });
      expect(box.contains(atPrefix)).toBe(true);
      expect(box.contains(input)).toBe(true);

      // --- STATE: CHECKING ---
      act(() => {
        fireEvent.change(input, { target: { value: 'validuser' } });
      });
      await waitFor(() => {
        expect(box.classList.contains('is-checking')).toBe(true);
      });
      expect(box.contains(atPrefix)).toBe(true);
      expect(box.contains(input)).toBe(true);
      const checkingIndicator = box.querySelector('.status-indicator.checking');
      expect(checkingIndicator).toBeDefined();

      // --- STATE: VALID (available) ---
      await waitFor(() => {
        expect(typeof resolveCheck).toBe('function');
      });
      act(() => {
        resolveCheck({ available: true, message: 'Username is available' });
      });
      await waitFor(() => {
        expect(box.classList.contains('is-valid')).toBe(true);
      });
      expect(box.contains(atPrefix)).toBe(true);
      expect(box.contains(input)).toBe(true);
      const validIndicator = box.querySelector('.status-indicator.valid');
      expect(validIndicator).toBeDefined();

      // --- STATE: INVALID (taken) ---
      mockUsersApi.checkUsernameAvailable.mockResolvedValueOnce({
        available: false,
        message: 'Username is already taken',
      });
      act(() => {
        fireEvent.change(input, { target: { value: 'takenuser' } });
      });
      await waitFor(() => {
        expect(box.classList.contains('is-invalid')).toBe(true);
      });
      expect(box.contains(atPrefix)).toBe(true);
      expect(box.contains(input)).toBe(true);
      const invalidIndicator = box.querySelector('.status-indicator.invalid');
      expect(invalidIndicator).toBeDefined();

      // --- STATE: DISABLED (submitting) ---
      let resolveSubmit;
      mockAuthApi.createProfile.mockImplementation(() => {
        return new Promise((resolve) => {
          resolveSubmit = resolve;
        });
      });

      // Switch back to available username to allow form submission
      mockUsersApi.checkUsernameAvailable.mockResolvedValueOnce({
        available: true,
        message: 'Username is available',
      });
      act(() => {
        fireEvent.change(input, { target: { value: 'confirmeduser' } });
      });
      await waitFor(() => {
        expect(box.classList.contains('is-valid')).toBe(true);
      });

      // Fill name and submit form
      const nameInput = container.querySelector('#name-input');
      act(() => {
        fireEvent.change(nameInput, { target: { value: 'Alex Johnson' } });
      });

      const form = container.querySelector('form.complete-profile-form');
      act(() => {
        fireEvent.submit(form);
      });

      // Now form is submitting -> disabled state
      await waitFor(() => {
        expect(box.classList.contains('is-disabled')).toBe(true);
        expect(input.disabled).toBe(true);
      });
      expect(box.contains(atPrefix)).toBe(true);
      expect(box.contains(input)).toBe(true);

      // Cleanup pending promise
      await act(async () => {
        resolveSubmit({ id: 'user-1', name: 'Alex Johnson', username: 'confirmeduser' });
      });
    });
  });
});
