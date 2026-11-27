import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import {
  formatDateTime,
  formatCountdown,
  formatMemberSince,
  formatRelativeTime,
  getTimeZoneAbbr,
} from '../utils/dateFormatter';
import SuperuserConfig from '../pages/admin/SuperuserConfig';
import adminApi from '../services/adminApi';
import usersApi from '../services/usersApi';
import portalAdminsApi from '../services/portalAdminsApi';
import Profile from '../pages/profile';
import { renderWithStore } from './test-utils';

vi.mock('../services/adminApi', () => ({
  default: {
    getStats: vi.fn(),
    getConfig: vi.fn(),
    updateConfig: vi.fn(),
    getJobRuns: vi.fn(),
    getJobRun: vi.fn(),
    triggerJobTick: vi.fn(),
    getUserDetails: vi.fn(),
    getUserReputation: vi.fn(),
  },
  recordPortalAuditEntry: vi.fn(),
}));

vi.mock('../services/portalAdminsApi', () => ({
  default: {
    list: vi.fn(),
  },
}));

vi.mock('../services/usersApi', () => ({
  default: {
    get: vi.fn(),
    getMe: vi.fn(),
    getReputation: vi.fn(),
  },
}));

vi.mock('../services/projectsApi', () => ({
  default: {
    list: vi.fn().mockResolvedValue([]),
  },
  isProjectActive: vi.fn().mockReturnValue(true),
  isProjectLocked: vi.fn().mockReturnValue(false),
}));

vi.mock('../services/tasksApi', () => ({
  default: {
    list: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../services/joinRequestsApi', () => ({
  default: {
    list: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../services/mentorshipApi', () => ({
  default: {
    getBadges: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../services/gamificationApi', () => ({
  default: {
    getUserLedger: vi.fn().mockResolvedValue([]),
  },
}));

describe('Phase 10: Platform Durability & Local Time Zone UI', () => {
  describe('1. Shared Date Formatter (dateFormatter.js)', () => {
    it('formatDateTime formats in viewer local timezone with timezone abbreviation', () => {
      // Test deterministic date: 2026-11-12T13:00:00.000Z
      const testIso = '2026-11-12T13:00:00.000Z';
      const formatted = formatDateTime(testIso);
      expect(formatted).toBeDefined();
      expect(typeof formatted).toBe('string');

      // Month name
      expect(formatted).toMatch(/Nov/);
      // Day
      expect(formatted).toMatch(/\d{1,2}/);
      // AM or PM
      expect(formatted).toMatch(/(AM|PM)/);
      // Has timezone abbreviation (e.g. IST, UTC, GMT, etc.)
      const tzAbbr = getTimeZoneAbbr(new Date(testIso));
      if (tzAbbr) {
        expect(formatted).toContain(tzAbbr);
      }
    });

    it('formatCountdown returns "Overdue" when target date is in the past', () => {
      const past = new Date(Date.now() - 3600000 * 24).toISOString();
      expect(formatCountdown(past)).toBe('Overdue');
    });

    it('formatCountdown formats remaining days and hours', () => {
      const now = new Date('2026-11-10T12:00:00.000Z');
      // Target: 2 days and 5 hours later
      const target = new Date('2026-11-12T17:00:00.000Z');
      const result = formatCountdown(target, now);
      expect(result).toBe('2d 5h remaining');
    });

    it('formatCountdown formats remaining hours and minutes when less than 24 hours', () => {
      const now = new Date('2026-11-10T12:00:00.000Z');
      const target = new Date('2026-11-10T15:30:00.000Z');
      const result = formatCountdown(target, now);
      expect(result).toBe('3h 30m remaining');
    });

    it('formatMemberSince preserves standard format and "Unknown" fallback', () => {
      expect(formatMemberSince(null)).toBe('Unknown');
      expect(formatMemberSince('')).toBe('Unknown');
      expect(formatMemberSince('N/A')).toBe('Unknown');
      expect(formatMemberSince('Unknown Date')).toBe('Unknown');
      expect(formatMemberSince('2026-10-26T00:00:00.000Z')).toContain('2026');
    });

    it('formatRelativeTime formats seconds, minutes, hours, and days cleanly', () => {
      expect(formatRelativeTime(null)).toBe('');
      expect(formatRelativeTime(new Date(Date.now() - 15 * 1000).toISOString())).toBe('Just now');
      expect(formatRelativeTime(new Date(Date.now() - 5 * 60 * 1000).toISOString())).toBe('5m ago');
      expect(formatRelativeTime(new Date(Date.now() - 3 * 3600 * 1000).toISOString())).toBe('3h ago');
      expect(formatRelativeTime(new Date(Date.now() - 4 * 86400 * 1000).toISOString())).toBe('4d ago');
    });
  });

  describe('2. SuperuserConfig In-Memory Only (No Snapshot Card)', () => {
    beforeEach(() => {
      adminApi.getStats.mockResolvedValue({ activeAdmins: 2, totalUsers: 15 });
      adminApi.getConfig.mockResolvedValue({
        maxProjectsPerUser: 10,
        maxCollaboratorsPerProject: 20,
        platformVersion: '1.4.2',
      });
      adminApi.getJobRuns.mockResolvedValue([]);
      portalAdminsApi.list.mockResolvedValue([]);
    });

    it('does not render any Snapshot card or Save snapshot button (FIX 1)', async () => {
      renderWithStore(<SuperuserConfig />, {
        preloadedState: {
          session: {
            isSuperUser: true,
            portalRole: 'superuser',
            permissions: ['*'],
          },
        },
      });

      await waitFor(() => {
        expect(adminApi.getConfig).toHaveBeenCalled();
      });

      expect(screen.queryByTestId('snapshot-card')).toBeNull();
      expect(screen.queryByText(/Save snapshot now/i)).toBeNull();
    });
  });

  describe('3. Reputation Ledger Pagination & Type Filter (profile.jsx)', () => {
    const mockAuthUser = {
      id: '2',
      name: 'Arjun Sharma',
      email: 'arjun@teamforge.io',
      role: 'Collaborator',
    };

    beforeEach(() => {
      usersApi.getMe.mockResolvedValue({
        id: '2',
        name: 'Arjun Sharma',
        profile: { fullName: 'Arjun Sharma', xp: 2450, rep: 87 },
      });

      usersApi.getReputation.mockResolvedValue({
        items: [
          {
            id: 'rep-1',
            userId: '2',
            type: 'task_approved',
            delta: 8,
            refId: 'task-1',
            createdAt: '2026-11-10T10:00:00.000Z',
          },
          {
            id: 'rep-2',
            userId: '2',
            type: 'warning',
            delta: -10,
            refId: 'warn-1',
            createdAt: '2026-11-09T14:30:00.000Z',
          },
        ],
        page: 1,
        limit: 20,
        total: 2,
      });
    });

    it('renders Reputation Ledger with Type filter and paginated entries', async () => {
      renderWithStore(<Profile />, {
        preloadedState: {
          session: {
            user: mockAuthUser,
            isAuthenticated: true,
            status: 'authenticated',
          },
        },
      });

      await waitFor(() => {
        expect(screen.getByTestId('reputation-type-filter')).toBeDefined();
      });

      // Type filter options exist
      const select = screen.getByTestId('reputation-type-filter');
      expect(select.innerHTML).toContain('All');
      expect(select.innerHTML).toContain('Task approved');
      expect(select.innerHTML).toContain('Warning penalty');
      expect(select.innerHTML).toContain('Appeal accepted');
      expect(select.innerHTML).toContain('Deadline penalty');
      expect(select.innerHTML).toContain('Seed');

      // Table displays reputation delta
      await waitFor(() => {
        expect(screen.getByText('+8 Rep')).toBeDefined();
        expect(screen.getByText('-10 Rep')).toBeDefined();
      });

      // Changing filter queries api with new type
      fireEvent.change(select, { target: { value: 'warning' } });
      expect(usersApi.getReputation).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'warning', page: 1 })
      );
    });
  });
});
