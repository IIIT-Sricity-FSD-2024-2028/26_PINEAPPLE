import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import UserTrustCard from '../components/features/UserTrustCard';
import { getTrustLabelConfig, getStandingBandConfig } from '../utils/trustConfig';
import Leaderboard from '../pages/leaderboard';
import { leaderboardApi } from '../services/leaderboardApi';
import { renderWithProviders } from './test-utils';

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

describe('UserTrustCard & Trust UI Component Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Compact Variant Rendering & Privacy Safeguards', () => {
    it('renders compact trust card with trust label, standing band, formatted XP, and stats for peer viewers', () => {
      const summary = {
        userId: 'collab-1',
        xp: 1240,
        label: 'Trusted contributor',
        band: 'Good standing',
        trackRecord: {
          tasksApproved: 12,
          projectsCompleted: 3,
          onTimeRate: 88,
          firstPassRate: 90,
          activeProjects: 1,
        },
      };

      renderWithProviders(
        <UserTrustCard summary={summary} variant="compact" />
      );

      // Visible to peer:
      expect(screen.getByText('Trusted contributor')).toBeDefined();
      expect(screen.getByText('Good standing')).toBeDefined();
      expect(screen.getByText('1,240 XP')).toBeDefined();
      expect(screen.getByText('12')).toBeDefined();
      expect(screen.getByText('88% on time')).toBeDefined();
      expect(screen.getByText('3')).toBeDefined();

      // FORBIDDEN PRIVATE FIELDS: Must NEVER show up for peer
      expect(screen.queryByText(/Conduct:/i)).toBeNull();
      expect(screen.queryByText(/Needs attention/i)).toBeNull();
      expect(screen.queryByText(/warnings/i)).toBeNull();
      expect(screen.queryByText(/suspension/i)).toBeNull();
    });

    it('renders "Not enough data" when rates are null due to < 3 verified tasks', () => {
      const summary = {
        userId: 'newbie-1',
        xp: 80,
        label: 'New member',
        band: 'Good standing',
        trackRecord: {
          tasksApproved: 1,
          projectsCompleted: 0,
          onTimeRate: null,
          firstPassRate: null,
          activeProjects: 1,
        },
      };

      renderWithProviders(
        <UserTrustCard summary={summary} variant="compact" />
      );

      expect(screen.getByText('New member')).toBeDefined();
      expect(screen.getByText('Not enough data')).toBeDefined();
    });

    it('displays exact conduct score and "Needs attention" flag to administrators when rep < 60', () => {
      const summary = {
        userId: 'troubled-1',
        xp: 350,
        label: 'Rising',
        band: 'Low standing',
        reputation: 50,
        needsAttention: true,
        ledgerLink: '/admin/users/troubled-1/reputation',
        trackRecord: {
          tasksApproved: 4,
          projectsCompleted: 0,
          onTimeRate: 60,
          activeProjects: 1,
        },
      };

      renderWithProviders(
        <UserTrustCard
          summary={summary}
          variant="compact"
          isAdminViewer={true}
        />
      );

      // Admin sees exact conduct score & warning flag
      expect(screen.getByText('Conduct: 50/100')).toBeDefined();
      expect(screen.getByText('Needs attention')).toBeDefined();
      expect(screen.getByText('Low standing')).toBeDefined();
    });
  });

  describe('2. Expanded Variant Rendering (Profile Page)', () => {
    it('renders expanded card with badges, Member since, XP, and Conduct Score tooltip WITHOUT the Track Record block', () => {
      const summary = {
        userId: 'self-1',
        xp: 2450,
        label: 'Trusted contributor',
        band: 'Good standing',
        reputation: 92,
        ledgerLink: '/users/me/reputation',
        trackRecord: {
          tasksApproved: 18,
          projectsCompleted: 4,
          onTimeRate: 94,
          activeThisWeek: true,
          memberSince: '2025-02-15T00:00:00.000Z',
        },
      };

      renderWithProviders(
        <UserTrustCard
          summary={summary}
          variant="expanded"
          isSelf={true}
        />
      );

      expect(screen.getByText('Trusted contributor')).toBeDefined();
      expect(screen.getByText('Good standing')).toBeDefined();
      expect(screen.getByText('Active this week')).toBeDefined();
      expect(screen.getByText(/Member since/i)).toBeDefined();
      expect(screen.getByText('2,450 XP')).toBeDefined();

      // Conduct score display for self
      expect(screen.getByText('92 / 100')).toBeDefined();
      expect(screen.queryByText(/View reputation ledger/i)).toBeNull();

      // Track Record heading and all five tiles MUST NOT render
      expect(screen.queryByText(/Track Record/i)).toBeNull();
      expect(screen.queryByText(/^Tasks Approved$/i)).toBeNull();
      expect(screen.queryByText(/^On-Time Rate$/i)).toBeNull();
      expect(screen.queryByText(/^First-Pass Rate$/i)).toBeNull();
      expect(screen.queryByText(/^Projects Completed$/i)).toBeNull();
      expect(screen.queryByText(/^Active Projects$/i)).toBeNull();

      // Tooltip toggle check
      const helpBtn = screen.getByRole('button', { name: /How does Conduct Score work\?/i });
      fireEvent.click(helpBtn);
      expect(screen.getByText(/Starts at 100. Reduced only by conduct penalties/i)).toBeDefined();
    });

    it('contains no "TRACK RECORD" text anywhere in frontend src files (excluding tests)', () => {
      const currentDir = path.dirname(fileURLToPath(import.meta.url));
      const srcDir = path.resolve(currentDir, '..');
      const offenders = [];
      const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (entry.name === 'test' || entry.name === 'node_modules') continue;
            walk(full);
          } else if (/\.(jsx?|tsx?|css)$/i.test(entry.name)) {
            const content = fs.readFileSync(full, 'utf8');
            if (/track\s+record/i.test(content)) {
              offenders.push(path.relative(srcDir, full));
            }
          }
        }
      };
      walk(srcDir);
      expect(offenders).toEqual([]);
    });
  });

  describe('3. Visual Config Functions', () => {
    it('returns appropriate visual config for all 5 trust labels', () => {
      const trusted = getTrustLabelConfig('Trusted contributor');
      expect(trusted.variant).toBe('success');
      expect(trusted.icon).toBe('★');

      const reliable = getTrustLabelConfig('Reliable');
      expect(reliable.variant).toBe('primary');

      const rising = getTrustLabelConfig('Rising');
      expect(rising.variant).toBe('info');

      const newMember = getTrustLabelConfig('New member');
      expect(newMember.icon).toBe('🌱');

      const started = getTrustLabelConfig('Getting started');
      expect(started.variant).toBe('secondary');
    });

    it('returns appropriate visual config for all 3 standing bands', () => {
      expect(getStandingBandConfig('Good standing').variant).toBe('success');
      expect(getStandingBandConfig('Fair standing').variant).toBe('warning');
      expect(getStandingBandConfig('Low standing').variant).toBe('danger');
    });
  });

  describe('4. Leaderboard View Integration (No Rank, Tab Switching)', () => {
    it('renders leaderboard tabs without any rank column or medals', async () => {
      leaderboardApi.getLeaderboard.mockResolvedValue([
        {
          userId: 'u1',
          user: 'Alice Smith',
          xp: 1500,
          tasks: 15,
          projects: 3,
          band: 'Good standing',
          trustLabel: 'Trusted contributor',
          onTimeRate: 90,
        },
        {
          userId: 'u2',
          user: 'Bob Jones',
          xp: 1200,
          tasks: 10,
          projects: 2,
          band: 'Fair standing',
          trustLabel: 'Reliable',
          onTimeRate: 85,
        },
      ]);

      renderWithProviders(<Leaderboard />);

      // Verify tabs exist
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Top by XP/i })).toBeDefined();
        expect(screen.getByRole('button', { name: /Most Reliable/i })).toBeDefined();
        expect(screen.getByRole('button', { name: /Highest Standing/i })).toBeDefined();
      });

      // Table headers: Contributor, XP, Standing, Tasks, Projects (NO Rank header)
      expect(screen.queryByText(/^Rank$/i)).toBeNull();
      expect(screen.queryByText(/🥇/)).toBeNull();
      expect(screen.queryByText(/🥈/)).toBeNull();
      expect(screen.queryByText(/🥉/)).toBeNull();

      // Contributors rendered
      expect(await screen.findByText('Alice Smith')).toBeDefined();
      expect(screen.getByText('1,500 XP')).toBeDefined();
      expect(screen.getByText('Bob Jones')).toBeDefined();
      expect(screen.getByText('1,200 XP')).toBeDefined();
    });
  });
});
