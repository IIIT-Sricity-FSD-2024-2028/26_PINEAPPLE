import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { renderWithStore } from '../../test/test-utils';
import { toText } from '../../utils/toText';
import {
  mapUserDetailsToViewModel,
  selectUserDetailsView,
} from '../selectors/adminUsersSelectors';
import AdminUserDetails from '../../pages/admin/AdminUserDetails';
import ErrorBoundary from '../../components/common/ErrorBoundary';

const {
  mockAdminApi,
  mockMentorshipApi,
  mockTrustApi,
} = vi.hoisted(() => ({
  mockAdminApi: {
    getUserDetails: vi.fn(),
    getUserReputation: vi.fn(),
    getWarnings: vi.fn(),
    getAdminMentorFeedback: vi.fn(),
    getModerationActions: vi.fn(),
  },
  mockMentorshipApi: {
    getBadges: vi.fn(),
  },
  mockTrustApi: {
    getTrustSummaries: vi.fn(),
  },
}));

vi.mock('../../services/adminApi', () => ({
  default: mockAdminApi,
  adminApi: mockAdminApi,
}));

vi.mock('../../services/mentorshipApi', () => ({
  default: mockMentorshipApi,
  mentorshipApi: mockMentorshipApi,
}));

vi.mock('../../services/trustApi', () => ({
  default: mockTrustApi,
  trustApi: mockTrustApi,
}));

function buildBaseUser(overrides = {}) {
  return {
    id: '4',
    name: 'Rohan Mehta',
    email: 'rohan.mehta@teamforge.io',
    username: 'rohanm',
    role: 'Collaborator',
    university: 'BITS Pilani',
    status: 'Active',
    flags: false,
    flagged: false,
    warnings: 0,
    activeWarningsCount: 0,
    warningHistory: [],
    pendingModerationActions: [],
    projects: [],
    contributions: [],
    skills: ['React'],
    mentorRecommendations: [],
    recentActivity: [],
    xp: 1200,
    rep: 95,
    joinedDate: '2025-01-15T10:00:00.000Z',
    ...overrides,
  };
}

function renderDetailsForUser(user, extraState = {}) {
  const uid = String(user.id);
  mockAdminApi.getUserDetails.mockResolvedValue(user);
  mockAdminApi.getWarnings.mockResolvedValue(user.warningHistory || []);
  mockAdminApi.getUserReputation.mockResolvedValue({ items: [], total: 0 });
  mockAdminApi.getModerationActions.mockResolvedValue([]);
  mockMentorshipApi.getBadges.mockResolvedValue(user.mentorRecommendations || []);

  return renderWithStore(
    <ErrorBoundary isDev={true} pathname={`/admin/users/${uid}`}>
      <Routes>
        <Route path="/admin/users/:id" element={<AdminUserDetails />} />
        <Route path="/admin/users" element={<div data-testid="users-list-route">Users List</div>} />
      </Routes>
    </ErrorBoundary>,
    {
      route: `/admin/users/${uid}`,
      preloadedState: {
        adminUsers: {
          ids: [uid],
          entities: { [uid]: user },
          userDetailsById: { [uid]: user },
          reputationByUserId: extraState.reputationByUserId || {},
          duplicateGroups: extraState.duplicateGroups || [],
        },
        ...(extraState.warnings ? { warnings: extraState.warnings } : {}),
        ...(extraState.sessionFeedback ? { sessionFeedback: extraState.sessionFeedback } : {}),
      },
    },
  );
}

describe('AdminUserDetails ViewModel, toText & Crash Prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('toText helper', () => {
    it('formats strings, objects with displayName, objects without known keys, null, and undefined cleanly', () => {
      expect(toText('Active')).toBe('Active');
      expect(toText({ id: 'u-1', displayName: 'Priya Patel' })).toBe('Priya Patel');
      expect(toText({ userId: '4', message: 'Suspended account' })).toBe('Suspended account');
      expect(toText({ unknownA: 123, nested: { foo: 'bar' } })).toBe('—');
      expect(toText(null)).toBe('—');
      expect(toText(undefined)).toBe('—');
      expect(toText(null, '')).toBe('');
    });
  });

  describe('mapUserDetailsToViewModel / selectUserDetailsView', () => {
    it('maps active, warned, suspended manual, suspended automatic, pending_second_approval, reactivated, and deleted/anonymised states cleanly', () => {
      const activeVm = mapUserDetailsToViewModel(buildBaseUser());
      expect(activeVm.status).toBe('Active');
      expect(activeVm.suspension).toBeNull();
      expect(activeVm.actions).toEqual({
        canWarn: true,
        canSuspend: true,
        canReactivate: false,
        canToggleFlag: true,
      });

      const warnedVm = mapUserDetailsToViewModel(
        buildBaseUser({
          status: 'Warned',
          activeWarningsCount: 2,
          warningHistory: [
            { id: 'w1', reason: 'Late response', issuedBy: 'u-admin', moderatorName: 'Default Admin', status: 'active' },
          ],
        }),
      );
      expect(warnedVm.isWarned).toBe(true);
      expect(warnedVm.activeWarningsCount).toBe(2);
      expect(warnedVm.warnings[0].issuedByName).toBe('Default Admin');

      const manualSuspVm = mapUserDetailsToViewModel(
        buildBaseUser({
          status: 'Suspended',
          suspension: {
            reason: 'Policy violation in project chat',
            type: 'manual',
            suspendedAt: '2026-11-27T12:00:00.000Z',
            suspendedByName: 'Priya Admin',
            appealStatus: 'pending',
          },
        }),
      );
      expect(manualSuspVm.isSuspended).toBe(true);
      expect(manualSuspVm.suspension.typeLabel).toBe('Manual');
      expect(manualSuspVm.suspension.suspendedByName).toBe('Priya Admin');
      expect(manualSuspVm.suspension.appealStatusLabel).toBe('Pending');
      expect(manualSuspVm.actions).toEqual({
        canWarn: false,
        canSuspend: false,
        canReactivate: true,
        canToggleFlag: true,
      });

      const autoSuspVm = mapUserDetailsToViewModel(
        buildBaseUser({
          status: 'Suspended',
          suspension: {
            reason: 'Automatic suspension after 4 warnings',
            type: 'automatic',
            suspendedAt: '2026-11-27T13:00:00.000Z',
            suspendedBy: 'system',
          },
        }),
      );
      expect(autoSuspVm.suspension.typeLabel).toBe('Automatic after 4 warnings');
      expect(autoSuspVm.suspension.suspendedByName).toBe('System');
      expect(autoSuspVm.suspension.appealStatusLabel).toBe('');

      const pendingVm = mapUserDetailsToViewModel(
        buildBaseUser({
          pendingModerationActions: [
            { id: 'pma-1', status: 'pending', reason: 'Escalated review', requestedByName: 'Admin One' },
          ],
        }),
      );
      expect(pendingVm.hasPendingSecondApproval).toBe(true);
      expect(pendingVm.actions.canSuspend).toBe(false);

      const reactivatedVm = mapUserDetailsToViewModel(
        buildBaseUser({
          status: 'Active',
          activeWarningsCount: 0,
          reactivationReason: 'Appeal approved after verification',
          reactivatedAt: '2026-11-27T14:00:00.000Z',
          warningHistory: [{ id: 'w1', reason: 'Old warning', status: 'cleared' }],
        }),
      );
      expect(reactivatedVm.isSuspended).toBe(false);
      expect(reactivatedVm.suspension).toBeNull();
      expect(reactivatedVm.reactivation.reason).toBe('Appeal approved after verification');
      expect(reactivatedVm.warnings[0].badgeLabel).toBe('Cleared');

      const deletedVm = mapUserDetailsToViewModel(
        buildBaseUser({ isDeleted: true, name: 'Deleted User', status: 'Active' }),
      );
      expect(deletedVm.isDeleted).toBe(true);
      expect(deletedVm.status).toBe('Deleted');
      expect(deletedVm.actions).toEqual({
        canWarn: false,
        canSuspend: false,
        canReactivate: false,
        canToggleFlag: false,
      });

      // Selector integration check
      const selected = selectUserDetailsView('4')({
        adminUsers: {
          userDetailsById: { '4': buildBaseUser({ status: 'Suspended', suspensionReason: 'Manual reason' }) },
          reputationByUserId: {},
          working: {},
          duplicateGroups: [],
        },
      });
      expect(selected.isSuspended).toBe(true);
      expect(selected.suspension.reason).toBe('Manual reason');
    });
  });

  describe('AdminUserDetails Component States & Maximal Nested Fixture', () => {
    it('renders active, warned, suspended manual, suspended automatic, pending second approval, reactivated, and deleted users without "[object Object]"', () => {
      const cases = [
        {
          label: 'active',
          user: buildBaseUser({ status: 'Active' }),
          expectText: ['Active', 'Issue Warning', 'Suspend User'],
        },
        {
          label: 'warned',
          user: buildBaseUser({
            status: 'Warned',
            activeWarningsCount: 1,
            warningHistory: [{ id: 'w1', reason: 'Spam messages', status: 'active', moderatorName: 'Admin One' }],
          }),
          expectText: ['Warned', '1/4 Warnings', 'Spam messages', 'Admin One'],
        },
        {
          label: 'suspended manual',
          user: buildBaseUser({
            status: 'Suspended',
            suspension: {
              reason: 'Repeated harassment in chat',
              type: 'manual',
              suspendedAt: '2026-11-27T10:30:00.000Z',
              suspendedByName: 'Priya Admin',
              appealStatus: 'pending',
            },
          }),
          expectText: ['Suspended', 'Manual', 'Repeated harassment in chat', 'Priya Admin', 'Appeal: Pending', 'Reactivate User'],
          notExpectText: ['Issue Warning', 'Suspend User'],
        },
        {
          label: 'suspended automatic',
          user: buildBaseUser({
            status: 'Suspended',
            activeWarningsCount: 4,
            suspension: {
              reason: 'Automatic suspension after 4 warnings',
              type: 'automatic',
              suspendedAt: '2026-11-27T11:30:00.000Z',
              suspendedByName: 'System',
            },
          }),
          expectText: ['Suspended', 'Automatic after 4 warnings', 'System', 'Reactivate User'],
        },
        {
          label: 'pending second approval',
          user: buildBaseUser({
            pendingModerationActions: [
              { id: 'pma-1', status: 'pending', reason: 'High rep suspension', requestedByName: 'Admin One' },
            ],
          }),
          expectText: ['Pending Second Approval', 'Admin One'],
          notExpectText: ['Suspend User'],
        },
        {
          label: 'reactivated',
          user: buildBaseUser({
            status: 'Active',
            activeWarningsCount: 0,
            reactivationReason: 'Cleared on appeal',
            reactivatedAt: '2026-11-27T12:00:00.000Z',
            warningHistory: [{ id: 'w-old', reason: 'Past incident', status: 'cleared' }],
          }),
          expectText: ['Account Reactivated', 'Cleared on appeal', 'Cleared'],
        },
        {
          label: 'deleted / anonymised',
          user: buildBaseUser({ isDeleted: true, name: 'Anonymised User', email: 'deleted@anon.local', status: 'Anonymised' }),
          expectText: ['Deleted', 'Anonymised User'],
          notExpectText: ['Issue Warning', 'Suspend User', 'Reactivate User'],
        },
      ];

      for (const tc of cases) {
        const { unmount } = renderDetailsForUser(tc.user);
        expect(document.body.textContent).not.toContain('[object Object]');
        expect(screen.queryByText(/Something went wrong/i)).toBeNull();
        for (const txt of tc.expectText) {
          expect(document.body.textContent).toContain(txt);
        }
        for (const absentTxt of tc.notExpectText || []) {
          expect(document.body.textContent).not.toContain(absentTxt);
        }
        unmount();
      }
    });

    it('renders the maximal nested-object fixture cleanly with zero React invalid-child errors', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const maximalUser = buildBaseUser({
        id: '4',
        role: { id: 'r-mentor', displayName: 'Mentor' },
        status: { userId: '4', status: 'Suspended', reason: 'Nested status object' },
        mentorStatus: { label: 'Approved Mentor' },
        suspension: {
          reason: { message: 'Manual suspension after report decision' },
          type: 'manual',
          suspendedAt: '2026-11-27T10:15:00.000Z',
          suspendedBy: { id: 'adm-7', displayName: 'Moderator Ananya' },
          appealStatus: { label: 'pending' },
        },
        warningHistory: [
          {
            id: 'w-nested',
            reason: { message: 'Posted disallowed external link' },
            issuedBy: { id: 'adm-7', displayName: 'Moderator Ananya' },
            status: 'active',
            createdAt: '2026-11-26T09:00:00.000Z',
          },
        ],
        recentActivity: [
          {
            id: 'aud-1',
            action: 'user-suspended',
            event: {
              userId: '4',
              targetUserId: '4',
              actorId: 'u-superuser',
              message: 'Admin Super User suspended user 4. Reason: Manual suspension after report decision',
            },
            timestamp: '2026-11-27T10:15:00.000Z',
          },
          {
            id: 'aud-2',
            action: 'user-auto-suspended',
            event: {
              userId: '4',
              targetUserId: '4',
              message: 'User 4 suspended automatically after reaching 4 warnings.',
            },
            timestamp: '2026-11-27T10:10:00.000Z',
          },
        ],
        pendingModerationActions: [
          {
            id: 'pma-nested',
            status: 'pending',
            reason: { message: 'Second review needed' },
            requestedBy: { id: 'adm-8', displayName: 'Admin Vikram' },
            expiresAt: '2026-11-30T10:15:00.000Z',
          },
        ],
        skills: [{ name: 'TypeScript' }, 'React'],
        projects: [
          { id: 'p-1', title: { title: 'Platform Core' }, role: 'Owner', difficulty: 'Hard', status: { label: 'Closed' }, progress: 100 },
        ],
        contributions: [
          { id: 't-1', title: { name: 'Fix Auth' }, projectName: { title: 'Platform Core' }, priority: 'High', status: 'Approved', awardedXp: 50 },
        ],
        mentorRecommendations: [
          { id: 'rec-1', badgeName: { label: 'Top Mentor' }, mentorName: { displayName: 'Priya Patel' }, projectTitle: 'Platform Core', comment: { message: 'Great work' } },
        ],
      });

      renderDetailsForUser(maximalUser, {
        duplicateGroups: [{ id: 'dup-1', users: [{ id: '4' }, { id: '99' }] }],
        reputationByUserId: {
          4: {
            total: 1,
            items: [{ id: 'rep-1', type: 'warning', reason: { message: 'Penalty applied' }, delta: -10, createdAt: '2026-11-26T09:00:00.000Z' }],
          },
        },
        sessionFeedback: {
          adminSummaryByMentorId: {
            4: {
              averageRating: 4.9,
              totalFeedbackCount: 1,
              feedback: [{ id: 'fb-1', ownerName: { displayName: 'Arjun Sharma' }, rating: 5, comment: { text: 'Helpful session' } }],
              abandonmentHistory: [],
            },
          },
        },
      });

      expect(screen.queryByText(/Something went wrong/i)).toBeNull();
      expect(screen.getByTestId('user-suspension-panel')).toBeDefined();
      expect(screen.getByTestId('suspension-by').textContent).toBe('Moderator Ananya');
      expect(screen.getByTestId('suspension-reason').textContent).toBe('Manual suspension after report decision');
      expect(document.body.textContent).toContain('Admin Super User suspended user 4');
      expect(document.body.textContent).toContain('Possible Duplicate');
      expect(document.body.textContent).not.toContain('[object Object]');

      const reactChildErrors = consoleErrorSpy.mock.calls.filter((call) =>
        call.some((arg) => String(arg || '').includes('not valid as a React child')),
      );
      expect(reactChildErrors).toEqual([]);
    });
  });

  describe('ErrorBoundary dev vs prod & admin Back to Users', () => {
    function BombComponent() {
      throw new Error('Objects are not valid as a React child (found: object with keys {userId})');
    }

    it('shows collapsed technical details + full message + component name + Back to Users in development on admin routes', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      renderWithStore(
        <ErrorBoundary isDev={true} pathname="/admin/users/4">
          <BombComponent />
        </ErrorBoundary>,
      );

      expect(screen.getByText('Something went wrong. Reload the page')).toBeDefined();
      expect(screen.getByRole('button', { name: 'Back to Users' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Go Back' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Reload' })).toBeDefined();

      const details = screen.getByTestId('error-boundary-details');
      expect(details.open).toBe(false);
      expect(details.textContent).toContain('Objects are not valid as a React child');
      expect(details.textContent).toContain('BombComponent');
    });

    it('hides error message and component details in production mode', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      renderWithStore(
        <ErrorBoundary isDev={false} pathname="/dashboard">
          <BombComponent />
        </ErrorBoundary>,
      );

      expect(screen.getByText('Something went wrong. Reload the page')).toBeDefined();
      expect(screen.queryByTestId('error-boundary-details')).toBeNull();
      expect(screen.queryByText(/Objects are not valid/)).toBeNull();
      expect(screen.queryByRole('button', { name: 'Back to Users' })).toBeNull();
    });
  });
});
