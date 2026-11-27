import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { renderWithStore } from './test-utils';
import Settings from '../pages/settings';
import NotificationsPage from '../pages/notifications';
import Navbar from '../components/navbar';
import usersApi from '../services/usersApi';
import notificationsApi from '../services/notificationsApi';

vi.mock('../services/usersApi', () => ({
  default: {
    getMe: vi.fn(),
    checkDeletionEligibility: vi.fn().mockResolvedValue({ canDelete: true }),
    listExports: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../services/notificationsApi', () => ({
  default: {
    list: vi.fn().mockResolvedValue([]),
    markAsRead: vi.fn().mockResolvedValue({ id: 'g-1', readStatus: true }),
    markAllAsRead: vi.fn().mockResolvedValue({ updated: 1 }),
    getUnreadCount: vi.fn().mockResolvedValue({ count: 1, unreadCount: 1 }),
    remove: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../services/communicationApi', () => ({
  default: {
    getUnreadSummary: vi.fn().mockResolvedValue({ total: 0, byProject: [] }),
  },
}));

const DIGEST_WORD_RE = new RegExp('dig' + 'est', 'i');
const UTC_OFFSET_RE = new RegExp('utcOffset' + 'Minutes');

function walkSourceFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'test' || entry.name === '__tests__') continue;
      results.push(...walkSourceFiles(full));
    } else if (/\.(js|jsx|ts|tsx|css)$/i.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

describe('Notification Digest Removal Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Settings page renders without the Notification digest card or any digest controls while keeping Profile, Appearance, and Your data', async () => {
    const user = {
      id: '1',
      name: 'Priya Patel',
      username: 'priyapatel',
      email: 'priya.patel@teamforge.io',
      role: 'Collaborator',
      emailVerified: true,
      profile: { fullName: 'Priya Patel', username: 'priyapatel', bio: 'Lead', skills: ['React'] },
    };
    usersApi.getMe.mockResolvedValue(user);

    const { container } = renderWithStore(<Settings />, {
      preloadedState: {
        session: { user, isAuthenticated: true, status: 'authenticated', initialized: true },
        ui: { theme: 'light' },
      },
    });

    await screen.findByText('Profile Information');
    expect(screen.getByText('Appearance')).toBeDefined();
    expect(screen.getByTestId('settings-your-data-card')).toBeDefined();

    expect(screen.queryByTestId('settings-digest-card')).toBeNull();
    expect(screen.queryByTestId('digest-enabled-toggle')).toBeNull();
    expect(screen.queryByTestId('digest-hour-select')).toBeNull();
    expect(screen.queryByTestId('save-digest-btn')).toBeNull();
    expect(screen.queryByText(/Notification digest/i)).toBeNull();
    expect(screen.queryByText(/Enable daily notification digest/i)).toBeNull();
    expect(screen.queryByText(/Save Digest Settings/i)).toBeNull();
    expect(screen.queryByText(/Delivery hour/i)).toBeNull();
    expect(container.textContent).not.toMatch(DIGEST_WORD_RE);
  });

  it('NotificationsPage and Navbar bell still display unread count, notifications, and expandable grouped notices', async () => {
    const groupedNotif = {
      id: 'g-1',
      type: 'TASK_RELEASED',
      title: '8 tasks released',
      message: '8 tasks released in Project Atlas',
      isRead: false,
      readStatus: false,
      createdAt: '2026-11-26T10:00:00.000Z',
      count: 8,
      items: Array.from({ length: 8 }, (_, idx) => ({
        label: `Atlas Task ${idx + 1}`,
        link: '/workspace/proj-1',
      })),
    };

    const user = {
      id: '1',
      name: 'Priya Patel',
      username: 'priyapatel',
      email: 'priya.patel@teamforge.io',
      role: 'Collaborator',
    };

    notificationsApi.list.mockResolvedValue([groupedNotif]);

    renderWithStore(
      <>
        <Navbar />
        <NotificationsPage />
      </>,
      {
        preloadedState: {
          session: { user, isAuthenticated: true, status: 'authenticated', initialized: true },
          notifications: {
            ids: ['g-1'],
            entities: { 'g-1': groupedNotif },
            unreadCount: 1,
            status: 'succeeded',
            working: {
              readFilter: 'all',
              filterType: 'all',
              selectedNotificationId: null,
              expandedGroupIds: {},
              isMarkingAllRead: false,
              markAllError: null,
            },
            optimisticSnapshots: {},
          },
        },
      },
    );

    expect(await screen.findByText('8 tasks released')).toBeDefined();
    expect(screen.getByTestId('notif-group-count-g-1').textContent).toBe('(8)');

    fireEvent.click(screen.getByTestId('notif-group-toggle-g-1'));
    const list = await screen.findByTestId('notif-group-list-g-1');
    expect(list.textContent).toContain('Atlas Task 1');
    expect(list.textContent).toContain('Atlas Task 8');

    fireEvent.click(screen.getByTestId('notif-item-g-1'));
    await waitFor(() => {
      expect(notificationsApi.markAsRead).toHaveBeenCalled();
      expect(notificationsApi.markAsRead.mock.calls[0][0]).toBe('g-1');
    });
  });

  it('source scan: zero occurrences of the digest word or utcOffsetMinutes in FE src (including comments)', () => {
    const srcRoot = path.resolve(process.cwd(), 'src');
    const files = walkSourceFiles(srcRoot);
    const hits = [];

    for (const file of files) {
      const rel = path.relative(srcRoot, file).replace(/\\/g, '/');
      const content = fs.readFileSync(file, 'utf8');
      if (DIGEST_WORD_RE.test(content) || UTC_OFFSET_RE.test(content)) {
        hits.push(rel);
      }
    }

    expect(hits).toEqual([]);
  });
});
