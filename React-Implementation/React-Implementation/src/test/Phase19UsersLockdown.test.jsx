import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithStore } from './test-utils';
import VerifyEmailBanner from '../components/common/VerifyEmailBanner';
import Settings from '../pages/settings';
import Login from '../pages/Login';
import AdminLogin from '../pages/admin/AdminLogin';
import AdminUsers from '../pages/admin/AdminUsers';
import usersApi from '../services/usersApi';
import authApi from '../services/authApi';
import adminApi from '../services/adminApi';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../services/apiClient.js', async () => {
  const actual = await vi.importActual('../services/apiClient.js');
  return {
    ...actual,
    getAuthMode: vi.fn(() => 'jwt'),
    setAccessToken: vi.fn(),
  };
});

vi.mock('../services/usersApi', () => ({
  default: {
    getMe: vi.fn(),
    update: vi.fn(),
    checkUsernameAvailable: vi.fn().mockResolvedValue({ available: true }),
    listExports: vi.fn().mockResolvedValue([]),
    getPhoneOtpStatus: vi.fn().mockResolvedValue({ wrongAttempts: 0, lockedSeconds: 0 }),
  },
  usersApi: {
    getMe: vi.fn(),
    update: vi.fn(),
    checkUsernameAvailable: vi.fn().mockResolvedValue({ available: true }),
    listExports: vi.fn().mockResolvedValue([]),
    getPhoneOtpStatus: vi.fn().mockResolvedValue({ wrongAttempts: 0, lockedSeconds: 0 }),
  },
}));

vi.mock('../services/authApi', () => ({
  default: {
    login: vi.fn(),
    signup: vi.fn(),
    resendVerification: vi.fn(),
    resolveIdentifier: vi.fn(),
  },
  authApi: {
    login: vi.fn(),
    signup: vi.fn(),
    resendVerification: vi.fn(),
    resolveIdentifier: vi.fn(),
  },
}));

vi.mock('../services/adminApi', () => ({
  default: {
    login: vi.fn(),
    listUsers: vi.fn(),
    getDuplicateUsers: vi.fn().mockResolvedValue({ groups: [] }),
    getModerationActions: vi.fn().mockResolvedValue([]),
    recordPortalAuditEntry: vi.fn(),
  },
  recordPortalAuditEntry: vi.fn(),
}));

describe('Phase 19 Frontend: Users Controller Lockdown & UI Contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Profile edit sends only allow-listed fields and displays verify banner after email change', async () => {
    const initialUser = {
      id: '2',
      name: 'Arjun Sharma',
      username: 'arjunsharma',
      email: 'arjun.sharma@teamforge.io',
      emailVerified: true,
      university: 'IIT Delhi',
      bio: 'Full-stack engineer focused on collaboration tools.',
      skills: ['React', 'Node.js'],
      profile: {
        fullName: 'Arjun Sharma',
        username: 'arjunsharma',
        bio: 'Full-stack engineer focused on collaboration tools.',
        university: 'IIT Delhi',
        skills: ['React', 'Node.js'],
      },
    };

    usersApi.getMe.mockResolvedValue(initialUser);
    usersApi.update.mockResolvedValue({
      ...initialUser,
      email: 'arjun.new@teamforge.io',
      emailVerified: false,
    });

    const { container, store } = renderWithStore(
      <>
        <VerifyEmailBanner />
        <Settings />
      </>,
      {
        preloadedState: {
          session: {
            user: initialUser,
            isAuthenticated: true,
            status: 'authenticated',
          },
          ui: { theme: 'light' },
        },
      },
    );

    const emailInput = await screen.findByLabelText(/Email Address/i);
    expect(emailInput).toBeTruthy();

    fireEvent.change(emailInput, { target: { value: 'arjun.new@teamforge.io' } });
    fireEvent.click(container.querySelector('#save-profile-btn'));

    await waitFor(() => {
      expect(usersApi.update).toHaveBeenCalledTimes(1);
    });

    const [calledId, sentPayload] = usersApi.update.mock.calls[0];
    expect(calledId).toBe('2');
    expect(sentPayload.email).toBe('arjun.new@teamforge.io');
    expect(sentPayload.role).toBeUndefined();
    expect(sentPayload.status).toBeUndefined();
    expect(sentPayload.emailVerified).toBeUndefined();
    expect(sentPayload.xp).toBeUndefined();
    expect(sentPayload.phone).toBeUndefined();
    expect(sentPayload.phoneVerified).toBeUndefined();

    expect(await screen.findByTestId('email-verify-notice')).toBeTruthy();
    expect(screen.getByTestId('email-verify-notice').textContent).toContain('Check your new email to verify it');
    expect(store.getState().session.user).toEqual(
      expect.objectContaining({
        email: 'arjun.new@teamforge.io',
        emailVerified: false,
      }),
    );

    // VerifyEmailBanner automatically reflects emailVerified: false from Redux store!
    expect(await screen.findByTestId('verify-email-banner')).toBeTruthy();

    expect(screen.getByTestId('verify-email-banner')).toBeTruthy();
  });

  it('2. Profile edit surfaces FIELD_NOT_ALLOWED and NOT_YOUR_ACCOUNT messages from backend', async () => {
    const initialUser = {
      id: '2',
      name: 'Arjun Sharma',
      username: 'arjunsharma',
      email: 'arjun.sharma@teamforge.io',
      emailVerified: true,
      profile: {
        fullName: 'Arjun Sharma',
        username: 'arjunsharma',
      },
    };
    usersApi.getMe.mockResolvedValue(initialUser);
    usersApi.update
      .mockRejectedValueOnce({
        statusCode: 400,
        code: 'FIELD_NOT_ALLOWED',
        message: 'Field(s) not allowed: role',
      })
      .mockRejectedValueOnce({
        statusCode: 403,
        code: 'NOT_YOUR_ACCOUNT',
        message: 'You can only update your own account.',
      });

    const { container: errContainer } = renderWithStore(<Settings />, {
      preloadedState: {
        session: {
          user: initialUser,
          isAuthenticated: true,
          status: 'authenticated',
        },
        ui: { theme: 'light' },
      },
    });

    const saveBtn = await waitFor(() => {
      const btn = errContainer.querySelector('#save-profile-btn');
      if (!btn) throw new Error('still loading');
      return btn;
    });
    fireEvent.click(saveBtn);

    const errBanner1 = await screen.findByTestId('profile-error-banner');
    expect(errBanner1.textContent).toContain('Field(s) not allowed: role');

    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(screen.getByTestId('profile-error-banner').textContent).toContain('You can only update your own account.');
    });
  });

  it('3. User Login & Admin Login render TOO_MANY_ATTEMPTS countdown and generic invalid-credentials text', async () => {
    authApi.login
      .mockRejectedValueOnce({
        statusCode: 429,
        code: 'TOO_MANY_ATTEMPTS',
        retryAfterSeconds: 600,
        message: 'Too many failed login attempts.',
      })
      .mockRejectedValueOnce({
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid credentials',
      });

    renderWithStore(<Login />);

    fireEvent.change(screen.getByPlaceholderText(/username or name@example\.com/i), {
      target: { value: 'arjun@teamforge.io' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••'), {
      target: { value: 'badpass123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Too many failed login attempts.*10m 00s/i)).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));
    await waitFor(() => {
      expect(screen.getByText(/Invalid credentials\. Please check your username\/email and password\./i)).toBeTruthy();
    });

    adminApi.login.mockRejectedValueOnce({
      statusCode: 429,
      code: 'TOO_MANY_ATTEMPTS',
      retryAfterSeconds: 305,
      message: 'Too many failed attempts.',
    });

    const { container: adminContainer } = renderWithStore(<AdminLogin />);

    fireEvent.change(screen.getByPlaceholderText('admin@teamforge.io'), {
      target: { value: 'admin@teamforge.io' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'wrongadmin' },
    });
    fireEvent.click(adminContainer.querySelector('button[type="submit"]'));

    await waitFor(() => {
      expect(screen.getByText(/Too many failed login attempts.*5m 05s/i)).toBeTruthy();
    });
  });

  it('4. AdminUsers continues working via adminApi.listUsers() (/admin/users)', async () => {
    adminApi.listUsers.mockResolvedValue([
      { id: '2', name: 'Arjun Sharma', email: 'arjun@teamforge.io', role: 'Collaborator', status: 'Active', xp: 2450, rep: 87 },
    ]);

    renderWithStore(<AdminUsers />);

    await waitFor(() => {
      expect(adminApi.listUsers).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Arjun Sharma')).toBeTruthy();
    });
  });

  it('5. No non-admin screen or service exposes closed GET /users, GET /users/:id, POST /users, or POST /users/login callers', () => {
    expect(usersApi.list).toBeUndefined();
    expect(usersApi.get).toBeUndefined();
    expect(usersApi.create).toBeUndefined();
    expect(usersApi.remove).toBeUndefined();

    const testDir = path.dirname(fileURLToPath(import.meta.url));
    const srcRoot = path.resolve(testDir, '..');
    const walk = (dir) => {
      const results = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'test') continue;
          results.push(...walk(full));
        } else if (/\.(js|jsx)$/.test(entry.name)) {
          results.push(full);
        }
      }
      return results;
    };

    const files = walk(srcRoot);
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      expect(content, `${file} must not call usersApi.list`).not.toMatch(/\busersApi\.list\s*\(/);
      expect(content, `${file} must not call usersApi.get(`).not.toMatch(/\busersApi\.get\s*\(/);
      expect(content, `${file} must not call usersApi.create(`).not.toMatch(/\busersApi\.create\s*\(/);
      expect(content, `${file} must not call usersApi.remove(`).not.toMatch(/\busersApi\.remove\s*\(/);
      expect(content, `${file} must not call /users/login`).not.toMatch(/\/users\/login/);
    }
  });
});
