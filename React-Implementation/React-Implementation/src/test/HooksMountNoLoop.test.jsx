import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import Leaderboard from '../pages/leaderboard';
import Settings from '../pages/settings';
import Help from '../pages/help';
import { leaderboardApi } from '../services/leaderboardApi';
import usersApi from '../services/usersApi';
import supportApi from '../services/supportApi';
import reportsApi from '../services/reportsApi';
import { userUpdated } from '../store/slices/sessionSlice';
import { renderWithStore } from './test-utils';

vi.mock('../services/leaderboardApi', () => ({
  leaderboardApi: {
    getLeaderboard: vi.fn(),
    getUserRank: vi.fn(),
  },
  default: {
    getLeaderboard: vi.fn(),
    getUserRank: vi.fn(),
  },
}));

vi.mock('../services/usersApi', () => ({
  default: {
    getMe: vi.fn(),
    listExports: vi.fn(),
    requestExport: vi.fn(),
    downloadExport: vi.fn(),
    checkUsernameAvailable: vi.fn().mockResolvedValue({ available: true }),
    getPhoneOtpStatus: vi.fn().mockResolvedValue({ wrongAttempts: 0, lockedSeconds: 0 }),
    getDeletionEligibility: vi.fn().mockResolvedValue({ canDelete: true, obligations: [], taskBlockers: [] }),
  },
}));

vi.mock('../services/supportApi', () => ({
  default: {
    listMyTickets: vi.fn(),
    getMyTicket: vi.fn(),
    createTicket: vi.fn(),
    replyMyTicket: vi.fn(),
  },
}));

vi.mock('../services/reportsApi', () => ({
  default: {
    listMyReports: vi.fn(),
    submitReport: vi.fn(),
  },
}));

describe('Hooks Mount & No-Loop Regression Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Leaderboard fetches once on mount and does not refetch or loop when switching tabs', async () => {
    leaderboardApi.getLeaderboard.mockResolvedValue([
      {
        userId: 'u-1',
        user: 'Alice Smith',
        xp: 1200,
        tasks: 12,
        projects: 2,
        band: 'Good standing',
        trustLabel: 'Trusted contributor',
        onTimeRate: 95,
      },
    ]);

    renderWithStore(<Leaderboard />, {
      preloadedState: {
        session: {
          status: 'authenticated',
          user: { id: 'u-1', name: 'Alice Smith', role: 'Collaborator' },
          activeRole: 'collaborator',
          allowedRoles: ['collaborator'],
        },
      },
    });

    await waitFor(() => {
      expect(leaderboardApi.getLeaderboard).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText('Alice Smith')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /Most Reliable/i }));
    fireEvent.click(screen.getByRole('button', { name: /Highest Standing/i }));
    fireEvent.click(screen.getByRole('button', { name: /Top by XP/i }));

    expect(leaderboardApi.getLeaderboard).toHaveBeenCalledTimes(1);
  });

  it('Settings hydrates once on mount and does not loop when session user updates', async () => {
    const initialUser = {
      id: 'u-set-1',
      name: 'Maya Rao',
      username: 'mayarao',
      email: 'maya@example.com',
      role: 'Collaborator',
    };
    usersApi.getMe.mockResolvedValue(initialUser);
    usersApi.listExports.mockResolvedValue([]);

    const { store } = renderWithStore(<Settings />, {
      preloadedState: {
        session: {
          status: 'authenticated',
          user: initialUser,
          activeRole: 'collaborator',
          allowedRoles: ['collaborator'],
        },
      },
    });

    await waitFor(() => {
      expect(usersApi.getMe).toHaveBeenCalledTimes(1);
      expect(usersApi.listExports).toHaveBeenCalledTimes(1);
    });

    act(() => {
      store.dispatch(userUpdated({ ...initialUser, bio: 'Updated bio without re-hydrating' }));
    });

    await waitFor(() => {
      expect(usersApi.getMe).toHaveBeenCalledTimes(1);
      expect(usersApi.listExports).toHaveBeenCalledTimes(1);
    });
  });

  it('Help fetches ticket detail once on mount for ?ticket= query without looping', async () => {
    supportApi.listMyTickets.mockResolvedValue([
      { id: 'tk-1', subject: 'Need help with invite', status: 'open', category: 'Help Inquiry', replies: [] },
    ]);
    supportApi.getMyTicket.mockResolvedValue({
      id: 'tk-1',
      subject: 'Need help with invite',
      status: 'open',
      category: 'Help Inquiry',
      message: 'Details here',
      replies: [],
    });
    reportsApi.listMyReports.mockResolvedValue([]);

    renderWithStore(<Help />, {
      route: '/help?tab=tickets&ticket=tk-1',
      preloadedState: {
        session: {
          status: 'authenticated',
          user: { id: 'u-help-1', name: 'Sam Lee', role: 'Collaborator' },
          activeRole: 'collaborator',
          allowedRoles: ['collaborator'],
        },
      },
    });

    await waitFor(() => {
      expect(supportApi.getMyTicket).toHaveBeenCalledTimes(1);
      expect(supportApi.listMyTickets).toHaveBeenCalledTimes(1);
    });
    expect(supportApi.getMyTicket).toHaveBeenCalledWith('tk-1');
  });
});
