import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext, AuthProvider } from '../context/AuthContext';
import { UIProvider } from '../context/UIContext';
import Settings from '../pages/settings';
import Profile from '../pages/profile';
import VerifyEmail from '../pages/VerifyEmail';
import VerifyEmailBanner from '../components/common/VerifyEmailBanner';
import usersApi from '../services/usersApi';
import authApi from '../services/authApi';

vi.mock('../services/apiClient.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getAuthMode: () => 'jwt',
    setAccessToken: vi.fn(),
    checkServerBoot: vi.fn().mockResolvedValue({ bootId: 'boot-fix2', restarted: false }),
  };
});

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((_auth, cb) => {
    cb(null);
    return () => {};
  }),
  signOut: vi.fn().mockResolvedValue(undefined),
  RecaptchaVerifier: vi.fn(),
  signInWithPhoneNumber: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock('../services/firebase.js', () => ({
  auth: { currentUser: null },
  phoneVerifyAuth: { signOut: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../services/usersApi', () => ({
  default: {
    getMe: vi.fn(),
    update: vi.fn(),
    getSettings: vi.fn().mockResolvedValue({ digestEnabled: true, digestHour: 9 }),
    updateSettings: vi.fn(),
    listExports: vi.fn().mockResolvedValue([]),
    getReputation: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    getBadges: vi.fn().mockResolvedValue([]),
    checkUsernameAvailable: vi.fn().mockResolvedValue({ available: true }),
    getPhoneOtpStatus: vi.fn().mockResolvedValue({ wrongAttempts: 0, lockedSeconds: 0 }),
  },
}));

vi.mock('../services/projectsApi', () => ({
  default: {
    list: vi.fn().mockResolvedValue([]),
  },
  isProjectActive: () => true,
  isProjectLocked: () => false,
}));

vi.mock('../services/tasksApi', () => ({
  default: { list: vi.fn().mockResolvedValue([]) },
}));

vi.mock('../services/joinRequestsApi', () => ({
  default: { list: vi.fn().mockResolvedValue([]) },
}));

vi.mock('../services/mentorshipApi', () => ({
  default: { getBadges: vi.fn().mockResolvedValue([]) },
}));

vi.mock('../services/gamificationApi', () => ({
  default: {
    getStats: vi.fn().mockResolvedValue({ xp: 100, rep: 90 }),
    getLedger: vi.fn().mockResolvedValue([]),
    getUserLedger: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../services/authApi', () => {
  const shared = {
    refresh: vi.fn(),
    getMe: vi.fn(),
    verifyEmail: vi.fn(),
    resendVerification: vi.fn(),
  };
  return {
    authApi: shared,
    default: shared,
  };
});

describe('FIX 2: Immutable Username & Single-Source Email Verification Banner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Settings and Profile have NO editable username input outside step 2; Settings shows lock note and saves without username in payload', async () => {
    const sampleUser = {
      id: '2',
      name: 'Arjun Sharma',
      username: 'arjun_locked',
      email: 'arjun@teamforge.io',
      role: 'Collaborator',
      university: 'IIT Bombay',
      emailVerified: true,
      profile: {
        fullName: 'Arjun Sharma',
        username: 'arjun_locked',
        bio: 'Building distributed systems cleanly.',
        university: 'IIT Bombay',
        skills: ['React'],
      },
    };
    usersApi.getMe.mockResolvedValue(sampleUser);
    usersApi.update.mockResolvedValue(sampleUser);

    const { unmount } = render(
      <MemoryRouter>
        <AuthContext.Provider value={{ user: sampleUser, isAuthenticated: true, updateUser: vi.fn(), refreshUser: vi.fn().mockResolvedValue(sampleUser) }}>
          <UIProvider>
            <Settings />
          </UIProvider>
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    const readonlyDisplay = await screen.findByTestId('username-readonly-display');
    expect(readonlyDisplay.textContent).toContain('arjun_locked');
    expect(screen.getByTestId('username-readonly-note').textContent).toContain("Your username can't be changed");
    expect(screen.queryByText(/Unique handle/i)).toBeNull();
    expect(document.querySelector('input[name="username"]')).toBeNull();

    // Save profile and verify username is absent from top-level and profile payload
    const saveBtn = screen.getByRole('button', { name: /Save Changes|Save Profile/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(usersApi.update).toHaveBeenCalled();
    });
    const [, sentPayload] = usersApi.update.mock.calls[0];
    expect(sentPayload.username).toBeUndefined();
    expect(sentPayload.profile?.username).toBeUndefined();
    unmount();

    // Also render Profile and verify zero editable username inputs exist
    render(
      <MemoryRouter>
        <AuthContext.Provider value={{ user: sampleUser, isAuthenticated: true }}>
          <Profile />
        </AuthContext.Provider>
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(usersApi.getMe).toHaveBeenCalled();
    });
    expect(document.querySelector('input[name="username"]')).toBeNull();
    expect(screen.queryByText(/Unique handle/i)).toBeNull();
  });

  it('2. VerifyEmailBanner shows only when emailVerified is false and hides when true', () => {
    const { rerender } = render(
      <AuthContext.Provider value={{ user: { id: '2', email: 'a@b.com', emailVerified: false }, isAuthenticated: true, refreshUser: vi.fn() }}>
        <VerifyEmailBanner />
      </AuthContext.Provider>,
    );
    expect(screen.getByTestId('verify-email-banner')).toBeTruthy();

    rerender(
      <AuthContext.Provider value={{ user: { id: '2', email: 'a@b.com', emailVerified: true }, isAuthenticated: true, refreshUser: vi.fn() }}>
        <VerifyEmailBanner />
      </AuthContext.Provider>,
    );
    expect(screen.queryByTestId('verify-email-banner')).toBeNull();
  });

  it('3. After VerifyEmail succeeds, AuthContext refreshes user and VerifyEmailBanner disappears without manual reload', async () => {
    authApi.refresh.mockResolvedValue({ accessToken: 'tok-v' });
    authApi.getMe
      .mockResolvedValueOnce({
        id: '10',
        uid: '10',
        email: 'verifynew@example.com',
        name: 'Verify New',
        username: 'verifynew',
        role: 'Collaborator',
        emailVerified: false,
        profileComplete: true,
      })
      .mockResolvedValueOnce({
        id: '10',
        uid: '10',
        email: 'verifynew@example.com',
        name: 'Verify New',
        username: 'verifynew',
        role: 'Collaborator',
        emailVerified: true,
        profileComplete: true,
      });
    authApi.verifyEmail.mockResolvedValueOnce({
      verified: true,
      message: 'Email address verified successfully.',
      user: { id: '10', emailVerified: true },
    });

    render(
      <MemoryRouter initialEntries={['/verify-email?token=tok123']}>
        <AuthProvider>
          <VerifyEmailBanner />
          <Routes>
            <Route path="/verify-email" element={<VerifyEmail />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('verify-email-result-msg').textContent).toContain('verified');
    });

    await waitFor(() => {
      expect(screen.queryByTestId('verify-email-banner')).toBeNull();
    });
  });

  it('4. Resend 409 EMAIL_ALREADY_VERIFIED refreshes user and hides the banner without showing both prompt and already-verified text', async () => {
    authApi.refresh.mockResolvedValue({ accessToken: 'tok-v' });
    authApi.getMe
      .mockResolvedValueOnce({
        id: '11',
        uid: '11',
        email: 'stale@example.com',
        name: 'Stale Banner',
        username: 'stale_user',
        role: 'Collaborator',
        emailVerified: false,
        profileComplete: true,
      })
      .mockResolvedValueOnce({
        id: '11',
        uid: '11',
        email: 'stale@example.com',
        name: 'Stale Banner',
        username: 'stale_user',
        role: 'Collaborator',
        emailVerified: true,
        profileComplete: true,
      });

    authApi.resendVerification.mockRejectedValueOnce({
      statusCode: 409,
      code: 'EMAIL_ALREADY_VERIFIED',
      message: 'Your email address is already verified.',
    });

    render(
      <AuthProvider>
        <VerifyEmailBanner />
      </AuthProvider>,
    );

    const resendBtn = await screen.findByTestId('resend-verification-btn');
    fireEvent.click(resendBtn);

    await waitFor(() => {
      expect(authApi.resendVerification).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId('verify-email-banner')).toBeNull();
    });
    expect(screen.queryByText(/already verified/i)).toBeNull();
  });

  it('5. Tab focus / visibilitychange reloads live user from GET /auth/me and hides banner automatically', async () => {
    authApi.refresh.mockResolvedValue({ accessToken: 'tok-focus' });
    authApi.getMe
      .mockResolvedValueOnce({
        id: '12',
        uid: '12',
        email: 'tab@example.com',
        name: 'Tab Sync',
        username: 'tabsync',
        role: 'Collaborator',
        emailVerified: false,
        profileComplete: true,
      })
      .mockResolvedValueOnce({
        id: '12',
        uid: '12',
        email: 'tab@example.com',
        name: 'Tab Sync',
        username: 'tabsync',
        role: 'Collaborator',
        emailVerified: true,
        profileComplete: true,
      });

    const Consumer = () => {
      const { user } = useContext(AuthContext);
      return (
        <div>
          <span data-testid="verified-state">{String(user?.emailVerified)}</span>
          <VerifyEmailBanner />
        </div>
      );
    };

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('verified-state').textContent).toBe('false');
      expect(screen.getByTestId('verify-email-banner')).toBeTruthy();
    });

    // Simulate user returning to this tab after verifying in another tab
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('verified-state').textContent).toBe('true');
      expect(screen.queryByTestId('verify-email-banner')).toBeNull();
    });
  });
});
