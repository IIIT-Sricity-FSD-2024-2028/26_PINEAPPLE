import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { renderWithStore } from './test-utils';
import Avatar from '../components/common/Avatar';
import Navbar from '../components/navbar';
import Settings from '../pages/settings';
import { buildMediaUrl } from '../utils/mediaUrl';
import uploadsApi from '../services/uploadsApi';
import usersApi from '../services/usersApi';
import { bootstrapSession } from '../store/thunks/sessionThunks';
import tokenManager from '../services/tokenManager';

vi.mock('../services/apiClient.js', async () => {
  const actual = await vi.importActual('../services/apiClient.js');
  return {
    ...actual,
    getAuthMode: vi.fn(() => 'jwt'),
    setAccessToken: vi.fn(),
    checkServerBoot: vi.fn().mockResolvedValue({ bootId: 'boot-1', restarted: false }),
  };
});

vi.mock('../services/uploadsApi', () => ({
  default: {
    uploadAvatar: vi.fn(),
  },
}));

vi.mock('../services/usersApi', () => ({
  default: {
    get: vi.fn(),
    getMe: vi.fn(),
    update: vi.fn(),
    checkDeletionEligibility: vi.fn().mockResolvedValue({ canDelete: true }),
    listDataExports: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../services/notificationsApi', () => ({
  default: {
    list: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../services/communicationApi', () => ({
  default: {
    getUnreadSummary: vi.fn().mockResolvedValue({ total: 0, byProject: [] }),
  },
}));

function walkSourceFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'test' || entry.name === '__tests__') continue;
      results.push(...walkSourceFiles(full));
    } else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

describe('Avatar Persistence & Canonical Display Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tokenManager.clear();
  });

  it('buildMediaUrl resolves relative /uploads paths, external URLs, cache-busters, and ignores non-URLs', () => {
    expect(buildMediaUrl(null)).toBeNull();
    expect(buildMediaUrl('')).toBeNull();
    expect(buildMediaUrl('A')).toBeNull();
    expect(buildMediaUrl('👧')).toBeNull();

    const resolved = buildMediaUrl('/uploads/abc-123.png', '2026-11-26T10:00:00.000Z');
    expect(resolved).toMatch(/^https?:\/\/.+\/uploads\/abc-123\.png\?v=2026-11-26T10%3A00%3A00\.000Z$/);

    expect(buildMediaUrl('https://lh3.googleusercontent.com/a/photo')).toBe(
      'https://lh3.googleusercontent.com/a/photo',
    );
  });

  it('Avatar component renders image when src resolves, falls back to initials on error, and resets error on src change', () => {
    const { rerender } = renderWithStore(
      <Avatar name="Arjun Sharma" src="/uploads/avatar-1.png" version="v1" size="md" />,
    );

    const img1 = screen.getByRole('img', { name: /Arjun Sharma/i });
    expect(img1.getAttribute('src')).toContain('/uploads/avatar-1.png?v=v1');

    fireEvent.error(img1);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('AS')).toBeDefined();

    rerender(<Avatar name="Arjun Sharma" src="/uploads/avatar-2.png" version="v2" size="md" />);
    const img2 = screen.getByRole('img', { name: /Arjun Sharma/i });
    expect(img2.getAttribute('src')).toContain('/uploads/avatar-2.png?v=v2');
  });

  it('choosing an image in Settings immediately uploads it, updates Redux store & Navbar, and persists across session restore', async () => {
    const initialUser = {
      id: '2',
      uid: '2',
      name: 'Arjun Sharma',
      username: 'arjun',
      email: 'arjun.sharma@teamforge.io',
      role: 'Collaborator',
      avatarUrl: null,
      profileComplete: true,
      emailVerified: true,
      profile: { fullName: 'Arjun Sharma', bio: '', skills: [] },
    };

    const uploadedPath = '/uploads/9c2e8a0f-avatar.png';
    const updatedServerUser = {
      ...initialUser,
      avatarUrl: uploadedPath,
      avatar: uploadedPath,
      updatedAt: '2026-11-26T11:00:00.000Z',
      profile: { ...initialUser.profile, avatarUrl: uploadedPath, avatar: uploadedPath },
    };

    usersApi.getMe.mockResolvedValue(initialUser);
    uploadsApi.uploadAvatar.mockResolvedValue({
      filename: '9c2e8a0f-avatar.png',
      url: uploadedPath,
      avatarUrl: uploadedPath,
      user: updatedServerUser,
    });

    const { store } = renderWithStore(
      <>
        <Navbar />
        <Settings />
      </>,
      {
        preloadedState: {
          session: {
            user: initialUser,
            isAuthenticated: true,
            status: 'authenticated',
            loading: false,
            initialized: true,
          },
        },
      },
    );

    const fileInput = await screen.findByLabelText(/Choose Image/i);
    const pngFile = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'photo.png', {
      type: 'image/png',
    });

    fireEvent.change(fileInput, { target: { files: [pngFile] } });

    await waitFor(() => {
      expect(uploadsApi.uploadAvatar).toHaveBeenCalledTimes(1);
    });
    expect(uploadsApi.uploadAvatar).toHaveBeenCalledWith(pngFile);

    await waitFor(() => {
      const storeUser = store.getState().session.user;
      expect(storeUser.avatarUrl).toBe(uploadedPath);
      expect(String(storeUser.avatarUrl)).not.toMatch(/^blob:/);
    });

    const imgsAfterUpload = screen.getAllByRole('img', { name: /Arjun Sharma/i });
    expect(imgsAfterUpload.length).toBeGreaterThanOrEqual(2);
    for (const img of imgsAfterUpload) {
      expect(img.getAttribute('src')).toContain(uploadedPath);
      expect(img.getAttribute('src')).not.toMatch(/^blob:/);
    }

    // Simulate page refresh (bootstrapSession calling /auth/refresh + /auth/me)
    tokenManager.setTokens({ accessToken: 'tok-fresh', refreshToken: 'ref-fresh' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url) => {
        const u = String(url);
        if (u.includes('/auth/refresh')) {
          return Promise.resolve(
            new Response(JSON.stringify({ accessToken: 'tok-fresh', refreshToken: 'ref-fresh' }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        }
        if (u.includes('/auth/me')) {
          return Promise.resolve(
            new Response(JSON.stringify(updatedServerUser), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        }
        return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
      }),
    );

    usersApi.getMe.mockResolvedValue(updatedServerUser);
    await store.dispatch(bootstrapSession());

    expect(store.getState().session.user.avatarUrl).toBe(uploadedPath);
    const imgsAfterRefresh = screen.getAllByRole('img', { name: /Arjun Sharma/i });
    expect(imgsAfterRefresh.length).toBeGreaterThanOrEqual(2);
    for (const img of imgsAfterRefresh) {
      expect(img.getAttribute('src')).toContain(uploadedPath);
    }
  });

  it('source scan: no ad-hoc avatar <img> outside Avatar.jsx and no blob: URL saved to Redux store', () => {
    const srcRoot = path.resolve(process.cwd(), 'src');
    const files = walkSourceFiles(srcRoot);
    const disallowedImgFiles = [];

    for (const file of files) {
      const rel = path.relative(srcRoot, file).replace(/\\/g, '/');
      if (rel === 'components/common/Avatar.jsx') continue;
      const content = fs.readFileSync(file, 'utf8');
      if (/<img\b/i.test(content)) {
        // Non-avatar illustration / landing showcase pages only
        const allowedNonAvatarPages = new Set([
          'pages/Login.jsx',
          'pages/Signup.jsx',
          'pages/ForgotPassword.jsx',
          'pages/ResetPassword.jsx',
          'pages/landingpage.jsx',
        ]);
        if (!allowedNonAvatarPages.has(rel)) {
          disallowedImgFiles.push(rel);
        }
      }
      if (
        (rel === 'store/slices/sessionSlice.js' ||
          rel === 'store/slices/settingsSlice.js' ||
          rel === 'store/thunks/sessionThunks.js' ||
          rel === 'store/thunks/settingsThunks.js') &&
        /createObjectURL/.test(content)
      ) {
        throw new Error(`Redux store file ${rel} must never reference URL.createObjectURL`);
      }
    }

    expect(disallowedImgFiles).toEqual([]);
  });
});
