import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { createAppStore } from '../index';
import { routeChanged, sessionReset } from '../actions/appActions';
import profilesReducer, {
  setAll as setAllProfiles,
  addOne as addOneProfile,
  updateOne as updateOneProfile,
  removeOne as removeOneProfile,
  upsertTrustSummaries,
} from '../slices/profilesSlice';
import reputationReducer, {
  setAll as setAllReputation,
  addOne as addOneReputation,
  updateOne as updateOneReputation,
  removeOne as removeOneReputation,
  setReputationFilters,
} from '../slices/reputationSlice';
import gamificationReducer, {
  setAll as setAllGamification,
  addOne as addOneGamification,
  updateOne as updateOneGamification,
  removeOne as removeOneGamification,
  setLeaderboardFilters,
} from '../slices/gamificationSlice';
import settingsReducer, {
  setAll as setAllSettings,
  addOne as addOneSetting,
  updateOne as updateOneSetting,
  removeOne as removeOneSetting,
} from '../slices/settingsSlice';
import { setSession, userUpdated } from '../slices/sessionSlice';
import {
  fetchMyProfile,
  fetchPublicProfile,
  fetchTrustSummaries,
  searchUsers,
} from '../thunks/profilesThunks';
import {
  fetchMyReputation,
  fetchMyTrust,
  fetchUserTrust,
} from '../thunks/reputationThunks';
import {
  fetchGamificationLedger,
  fetchGamificationStats,
  fetchLeaderboard,
  fetchUserBadges,
  issueMentorBadge,
} from '../thunks/gamificationThunks';
import {
  checkAccountDeletionEligibility,
  deleteMyAccount,
  saveProfileSettings,
  verifyEmailWithToken,
} from '../thunks/settingsThunks';
import {
  selectOwnProfile,
  selectSafeTrustSummaryById,
  selectTrustSummaryById,
} from '../selectors/profilesSelectors';
import { selectLeaderboardForTab } from '../selectors/gamificationSelectors';
import { renderWithStore } from '../../test/test-utils';
import Leaderboard from '../../pages/leaderboard';
import UserTrustCard from '../../components/features/UserTrustCard';
import Settings from '../../pages/settings';
import Navbar from '../../components/navbar';
import VerifyEmailBanner from '../../components/common/VerifyEmailBanner';
import usersApi from '../../services/usersApi';
import trustApi from '../../services/trustApi';
import leaderboardApi from '../../services/leaderboardApi';
import gamificationApi from '../../services/gamificationApi';
import mentorshipApi from '../../services/mentorshipApi';
import authApi from '../../services/authApi';

vi.mock('../../services/usersApi', () => {
  const api = {
    getMe: vi.fn(),
    getPublicProfile: vi.fn(),
    update: vi.fn(),
    updateUsername: vi.fn(),
    checkUsernameAvailable: vi.fn().mockResolvedValue({ available: true }),
    listExports: vi.fn().mockResolvedValue([]),
    requestExport: vi.fn(),
    downloadExport: vi.fn(),
    getReputation: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    checkDeletionEligibility: vi.fn().mockResolvedValue({ canDelete: true, taskBlockers: [], obligations: [] }),
    deleteMyAccount: vi.fn(),
    searchUsers: vi.fn().mockResolvedValue([]),
    getPhoneOtpStatus: vi.fn().mockResolvedValue({ wrongAttempts: 0, locked: false }),
    deletePhone: vi.fn(),
    verifyPhone: vi.fn(),
    recordFailedOtpAttempt: vi.fn(),
  };
  return { default: api, usersApi: api };
});

vi.mock('../../services/trustApi', () => {
  const api = {
    getMyTrust: vi.fn(),
    getUserTrust: vi.fn(),
    getTrustSummaries: vi.fn().mockResolvedValue([]),
  };
  return { default: api, trustApi: api };
});

vi.mock('../../services/leaderboardApi', () => {
  const api = {
    getLeaderboard: vi.fn().mockResolvedValue([]),
    getUserRank: vi.fn(),
  };
  return { default: api, leaderboardApi: api };
});

vi.mock('../../services/gamificationApi', () => {
  const api = {
    getUserLedger: vi.fn().mockResolvedValue([]),
    getUserStats: vi.fn().mockResolvedValue(null),
    getLeaderboard: vi.fn().mockResolvedValue([]),
  };
  return { default: api, gamificationApi: api };
});

vi.mock('../../services/mentorshipApi', () => {
  const api = {
    getBadges: vi.fn().mockResolvedValue([]),
    issueBadge: vi.fn(),
  };
  return { default: api, mentorshipApi: api };
});

vi.mock('../../services/authApi', () => {
  const api = {
    verifyEmail: vi.fn(),
    resendVerification: vi.fn(),
  };
  return { default: api, authApi: api };
});

describe('Phase 12 Redux Conversion: Profile, Settings, Reputation & Gamification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Four Explicit CRUD Reducers & Route-Leave Reset per Slice', () => {
    it('profilesSlice supports setAll/addOne/updateOne/removeOne and clears only working on routeChanged', () => {
      let state = profilesReducer(
        undefined,
        setAllProfiles([{ id: 'u1', name: 'Alice' }]),
      );
      expect(state.ids).toEqual(['u1']);

      state = profilesReducer(state, addOneProfile({ id: 'u2', name: 'Bob' }));
      expect(state.ids).toEqual(['u1', 'u2']);

      state = profilesReducer(
        state,
        updateOneProfile({ id: 'u2', changes: { name: 'Bob Updated' } }),
      );
      expect(state.entities.u2.name).toBe('Bob Updated');

      state = profilesReducer(
        state,
        upsertTrustSummaries([{ userId: 'u1', xp: 500, label: 'Reliable', band: 'Good standing' }]),
      );
      state = profilesReducer(state, searchUsers.fulfilled({ query: 'al', items: [{ id: 'u1' }] }, 'r1', 'al'));
      expect(state.working.searchResults).toHaveLength(1);

      state = profilesReducer(state, routeChanged({ pathname: '/dashboard' }));
      expect(state.working.searchResults).toEqual([]);
      expect(state.entities.u1.name).toBe('Alice');
      expect(state.trustByUserId.u1.xp).toBe(500);

      state = profilesReducer(state, removeOneProfile('u1'));
      expect(state.ids).toEqual(['u2']);

      state = profilesReducer(state, sessionReset());
      expect(state.ids).toEqual([]);
      expect(state.trustByUserId).toEqual({});
    });

    it('reputationSlice supports CRUD reducers and clears filters on routeChanged while keeping entries', () => {
      let state = reputationReducer(
        undefined,
        setAllReputation([{ id: 'r1', type: 'task_approved', xp: 50 }]),
      );
      expect(state.ids).toEqual(['r1']);

      state = reputationReducer(state, addOneReputation({ id: 'r2', type: 'warning', delta: -10 }));
      expect(state.total).toBe(2);

      state = reputationReducer(
        state,
        updateOneReputation({ id: 'r2', changes: { delta: -5 } }),
      );
      expect(state.entities.r2.delta).toBe(-5);

      state = reputationReducer(
        state,
        setReputationFilters({ page: 3, typeFilter: 'warning', groupFilter: 'standing' }),
      );
      expect(state.working.page).toBe(3);

      state = reputationReducer(state, routeChanged({ pathname: '/settings' }));
      expect(state.working.page).toBe(1);
      expect(state.working.typeFilter).toBe('all');
      expect(state.ids).toEqual(['r1', 'r2']);

      state = reputationReducer(state, removeOneReputation('r1'));
      expect(state.ids).toEqual(['r2']);
    });

    it('gamificationSlice supports CRUD reducers and resets working filters on routeChanged', () => {
      let state = gamificationReducer(
        undefined,
        setAllGamification([{ userId: 'u1', user: 'Alice', xp: 1000, onTimeRate: 90, band: 'Good standing' }]),
      );
      state = gamificationReducer(
        state,
        addOneGamification({ userId: 'u2', user: 'Bob', xp: 500, onTimeRate: 99, band: 'Fair standing' }),
      );
      state = gamificationReducer(
        state,
        updateOneGamification({ id: 'u2', changes: { xp: 750 } }),
      );
      expect(state.entities.u2.xp).toBe(750);

      state = gamificationReducer(
        state,
        setLeaderboardFilters({ activeTab: 'reliable', searchQuery: 'bob' }),
      );
      expect(state.working.activeTab).toBe('reliable');

      state = gamificationReducer(state, routeChanged({ pathname: '/profile' }));
      expect(state.working.activeTab).toBe('xp');
      expect(state.working.searchQuery).toBe('');
      expect(state.ids).toEqual(['u1', 'u2']);

      state = gamificationReducer(state, removeOneGamification('u1'));
      expect(state.ids).toEqual(['u2']);
    });

    it('settingsSlice supports CRUD reducers and preserves deletionCheck across routeChanged', () => {
      let state = settingsReducer(
        undefined,
        setAllSettings([{ id: 'me', theme: 'light' }]),
      );
      state = settingsReducer(
        state,
        addOneSetting({ id: 'u2', theme: 'light' }),
      );
      state = settingsReducer(
        state,
        updateOneSetting({ id: 'me', changes: { theme: 'dark' } }),
      );
      expect(state.entities.me.theme).toBe('dark');

      state = settingsReducer(
        state,
        checkAccountDeletionEligibility.fulfilled(
          { canDelete: false, taskBlockers: [{ taskId: 't1' }], obligations: [] },
          'req1',
        ),
      );
      state = settingsReducer(
        state,
        deleteMyAccount.rejected(
          { message: 'Blocked' },
          'req2',
          { username: 'u' },
          { message: 'Blocked', obligations: [{ id: 'o1' }], taskBlockers: [] },
        ),
      );
      expect(state.working.deleteError).toBe('Blocked');

      state = settingsReducer(state, routeChanged({ pathname: '/dashboard' }));
      expect(state.working.deleteError).toBe('');
      expect(state.deletionCheck.canDelete).toBe(false);

      state = settingsReducer(state, removeOneSetting('u2'));
      expect(state.ids).toEqual(['me']);
    });
  });

  describe('2. Thunks Across Profiles, Reputation, Gamification & Settings', () => {
    it('fetchTrustSummaries caches summaries by userId and skips duplicate requests unless forced', async () => {
      const store = createAppStore();
      trustApi.getTrustSummaries.mockResolvedValueOnce([
        { userId: 'u1', xp: 400, label: 'Rising', band: 'Good standing' },
        { userId: 'u2', xp: 900, label: 'Reliable', band: 'Good standing' },
      ]);

      await store.dispatch(fetchTrustSummaries(['u1', 'u2']));
      expect(trustApi.getTrustSummaries).toHaveBeenCalledTimes(1);
      expect(selectTrustSummaryById(store.getState(), 'u1').xp).toBe(400);

      // Subsequent dispatch for same ids does NOT hit API again
      await store.dispatch(fetchTrustSummaries(['u1', 'u2']));
      expect(trustApi.getTrustSummaries).toHaveBeenCalledTimes(1);

      // Force refresh calls API again
      trustApi.getTrustSummaries.mockResolvedValueOnce([
        { userId: 'u1', xp: 450, label: 'Rising', band: 'Good standing' },
      ]);
      await store.dispatch(fetchTrustSummaries({ ids: ['u1'], force: true }));
      expect(trustApi.getTrustSummaries).toHaveBeenCalledTimes(2);
      expect(selectTrustSummaryById(store.getState(), 'u1').xp).toBe(450);
    });

    it('profiles, reputation, gamification & settings thunks populate slices correctly', async () => {
      const store = createAppStore();
      usersApi.getMe.mockResolvedValueOnce({ id: 'me-1', name: 'Priya', email: 'p@tf.io' });
      usersApi.getPublicProfile.mockResolvedValueOnce({ id: 'peer-1', name: 'Rohan' });
      usersApi.getReputation.mockResolvedValueOnce({ items: [{ id: 'rep-1', type: 'seed', delta: 100 }], total: 1 });
      trustApi.getMyTrust.mockResolvedValueOnce({ userId: 'me-1', xp: 1000, reputation: 98, label: 'Reliable', band: 'Good standing' });
      trustApi.getUserTrust.mockResolvedValueOnce({ userId: 'peer-1', xp: 600, label: 'Rising', band: 'Good standing' });
      gamificationApi.getUserLedger.mockResolvedValueOnce([{ id: 'xp-1', xp: 50 }]);
      gamificationApi.getUserStats.mockResolvedValueOnce({ xp: 1000 });
      mentorshipApi.getBadges.mockResolvedValueOnce([{ id: 'b-1', badgeName: 'System Architect' }]);
      mentorshipApi.issueBadge.mockResolvedValueOnce({ id: 'b-2', userId: 'me-1', badgeName: 'Top Mentor' });
      usersApi.update.mockResolvedValueOnce({ id: 'me-1', name: 'Priya Updated', profile: { fullName: 'Priya Updated' } });
      leaderboardApi.getLeaderboard.mockResolvedValueOnce([
        { userId: 'me-1', user: 'Priya', xp: 1000, onTimeRate: 95, band: 'Good standing' },
      ]);

      await Promise.all([
        store.dispatch(fetchMyProfile()),
        store.dispatch(fetchPublicProfile('peer-1')),
        store.dispatch(fetchMyReputation({ page: 1, limit: 20, type: 'all' })),
        store.dispatch(fetchMyTrust()),
        store.dispatch(fetchUserTrust('peer-1')),
        store.dispatch(fetchGamificationLedger('me-1')),
        store.dispatch(fetchGamificationStats({ userId: 'me-1' })),
        store.dispatch(fetchUserBadges('me-1')),
        store.dispatch(fetchLeaderboard({ period: 'alltime', tab: 'xp' })),
      ]);

      expect(selectOwnProfile(store.getState()).name).toBe('Priya');
      expect(store.getState().profiles.entities['peer-1'].name).toBe('Rohan');
      expect(store.getState().reputation.myTrust.reputation).toBe(98);
      expect(store.getState().gamification.badgesByUserId['me-1']).toHaveLength(1);
      expect(store.getState().gamification.ids).toEqual(['me-1']);

      await store.dispatch(
        saveProfileSettings({
          userId: 'me-1',
          payload: { name: 'Priya Updated' },
          sessionPatch: { name: 'Priya Updated' },
        }),
      );
      expect(selectOwnProfile(store.getState()).name).toBe('Priya Updated');

      await store.dispatch(issueMentorBadge({ payload: { userId: 'me-1' } }));
      expect(store.getState().gamification.badgesByUserId['me-1']).toHaveLength(2);
    });
  });

  describe('3. Screen & Component Requirements (Phase 12)', () => {
    it('Leaderboard tabs sort from stored data without re-fetching', async () => {
      leaderboardApi.getLeaderboard.mockResolvedValueOnce([
        { userId: 'u1', user: 'Top XP', xp: 3000, onTimeRate: 70, band: 'Low standing', tasks: 10, projects: 2 },
        { userId: 'u2', user: 'Most Reliable', xp: 1000, onTimeRate: 99, band: 'Fair standing', tasks: 12, projects: 2 },
        { userId: 'u3', user: 'Best Standing', xp: 1500, onTimeRate: 85, band: 'Good standing', tasks: 8, projects: 1 },
      ]);

      const { store } = renderWithStore(
        <Leaderboard />,
        {
          preloadedState: {
            session: {
              activeRole: 'collaborator',
              allowedRoles: ['collaborator'],
            },
          },
        },
      );

      expect(await screen.findByText('Top XP')).toBeTruthy();
      expect(leaderboardApi.getLeaderboard).toHaveBeenCalledTimes(1);

      // Default 'xp' tab puts Top XP first
      expect(selectLeaderboardForTab(store.getState(), { tab: 'xp' }).map((r) => r.userId)).toEqual([
        'u1',
        'u3',
        'u2',
      ]);

      // Clicking "Most Reliable" sorts stored data without extra API call
      fireEvent.click(screen.getByRole('button', { name: /Most Reliable/i }));
      await waitFor(() => {
        const rows = Array.from(document.querySelectorAll('tbody tr'));
        expect(rows[0].textContent).toContain('Most Reliable');
      });
      expect(leaderboardApi.getLeaderboard).toHaveBeenCalledTimes(1);

      // Clicking "Highest Standing" sorts stored data without extra API call
      fireEvent.click(screen.getByRole('button', { name: /Highest Standing/i }));
      await waitFor(() => {
        const rows = Array.from(document.querySelectorAll('tbody tr'));
        expect(rows[0].textContent).toContain('Best Standing');
      });
      expect(leaderboardApi.getLeaderboard).toHaveBeenCalledTimes(1);
    });

    it('UserTrustCard reads store by userId and hides private fields for non-self and non-admin viewers', () => {
      const store = createAppStore({
        preloadedState: {
          profiles: {
            ids: [],
            entities: {},
            ownProfileId: null,
            trustByUserId: {
              'target-1': {
                userId: 'target-1',
                xp: 2100,
                label: 'Trusted contributor',
                band: 'Low standing',
                reputation: 48,
                needsAttention: true,
                trackRecord: { tasksApproved: 14, projectsCompleted: 3, onTimeRate: 92 },
              },
            },
            responseTimeByUserId: {},
            status: 'idle',
            trustStatus: 'succeeded',
            error: null,
            lastFetchedAt: null,
            working: { loadingPublicProfileId: null, searchingUsers: false, searchQuery: '', searchResults: [] },
          },
        },
      });

      expect(selectSafeTrustSummaryById(store.getState(), 'target-1', { isSelf: false, isAdminViewer: false }).reputation).toBeUndefined();
      expect(selectSafeTrustSummaryById(store.getState(), 'target-1', { isSelf: true, isAdminViewer: false }).reputation).toBe(48);

      const { rerender } = renderWithStore(
        <UserTrustCard userId="target-1" variant="expanded" isSelf={false} isAdminViewer={false} />,
        { store },
      );

      expect(screen.getByText('2,100 XP')).toBeTruthy();
      expect(screen.queryByText(/Conduct Score/i)).toBeNull();
      expect(screen.queryByText(/48 \/ 100/)).toBeNull();
      expect(screen.queryByText(/Needs attention/i)).toBeNull();

      rerender(
        <UserTrustCard userId="target-1" variant="expanded" isSelf={false} isAdminViewer={true} />,
      );
      expect(screen.getByText(/Conduct Score:/i)).toBeTruthy();
      expect(screen.getByText(/48 \/ 100/)).toBeTruthy();
      expect(screen.getByText('Needs attention')).toBeTruthy();
    });

    it('Account deletion check lists blockers from server response and disables Delete even when username matches', async () => {
      const mockUser = {
        id: 'u-block',
        name: 'Blocked User',
        username: 'blockeduser',
        email: 'blocked@tf.io',
        emailVerified: true,
      };
      usersApi.getMe.mockResolvedValue(mockUser);
      usersApi.checkDeletionEligibility.mockResolvedValue({
        canDelete: false,
        taskBlockers: [
          {
            taskId: 't-open-1',
            taskTitle: 'Finish API integration',
            status: 'In Progress',
            projectId: 'p-1',
            projectTitle: 'Alpha Platform',
          },
        ],
        obligations: [
          {
            id: 'ob-1',
            type: 'Owned Project',
            title: 'Alpha Platform',
            status: 'Open',
            reason: 'Owned project "Alpha Platform" is still Open.',
          },
        ],
      });

      renderWithStore(
        <Settings />,
        {
          preloadedState: {
            session: {
              user: mockUser,
              isAuthenticated: true,
              status: 'authenticated',
            },
            ui: {
              theme: 'light',
            },
          },
        },
      );

      const warning = await screen.findByTestId('deletion-blockers-warning');
      expect(warning.textContent).toContain('Finish API integration');
      expect(warning.textContent).toContain('Alpha Platform');

      fireEvent.change(screen.getByTestId('delete-account-username'), {
        target: { value: 'blockeduser' },
      });
      const deleteBtn = screen.getByTestId('delete-account-btn');
      expect(deleteBtn.disabled).toBe(true);
    });

    it('Saving settings updates navbar name via sessionSlice userUpdated without DOM events', async () => {
      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');
      const initialUser = {
        id: 'u-nav-1',
        name: 'Old Name',
        username: 'oldname',
        email: 'nav@tf.io',
        emailVerified: true,
        role: 'Collaborator',
        allowedRoles: ['Collaborator'],
        profile: { fullName: 'Old Name', username: 'oldname', skills: ['React'] },
      };

      usersApi.getMe.mockResolvedValue(initialUser);
      usersApi.update.mockResolvedValue({
        ...initialUser,
        name: 'New Awesome Name',
        profile: { ...initialUser.profile, fullName: 'New Awesome Name' },
      });

      const store = createAppStore();
      store.dispatch(
        setSession({
          user: initialUser,
          isAuthenticated: true,
          activeRole: 'Collaborator',
          allowedRoles: ['Collaborator'],
        }),
      );

      renderWithStore(
        <>
          <Navbar onMenuClick={vi.fn()} />
          <Settings />
        </>,
        { store },
      );

      expect((await screen.findAllByText('Old Name')).length).toBeGreaterThanOrEqual(1);

      const fullNameInput = await screen.findByLabelText(/Full Name/i);
      fireEvent.change(fullNameInput, { target: { value: 'New Awesome Name' } });
      fireEvent.click(document.querySelector('#save-profile-btn'));

      await waitFor(() => {
        expect(store.getState().session.user.name).toBe('New Awesome Name');
        expect(screen.getAllByText('New Awesome Name').length).toBeGreaterThanOrEqual(1);
      });

      // Verify no legacy teamforge:user_updated custom DOM event was dispatched
      const userUpdatedEvents = dispatchEventSpy.mock.calls.filter(
        ([evt]) => evt?.type === 'teamforge:user_updated',
      );
      expect(userUpdatedEvents).toHaveLength(0);
    });

    it('VerifyEmailBanner disappears immediately when sessionSlice marks user verified', async () => {
      const store = createAppStore();
      store.dispatch(
        setSession({
          user: {
            id: 'u-ver-1',
            email: 'verify@tf.io',
            emailVerified: false,
          },
          isAuthenticated: true,
        }),
      );

      renderWithStore(<VerifyEmailBanner />, { store });
      expect(screen.getByTestId('verify-email-banner')).toBeTruthy();

      authApi.verifyEmail.mockResolvedValueOnce({
        verified: true,
        user: { id: 'u-ver-1', emailVerified: true },
      });
      await act(async () => {
        await store.dispatch(verifyEmailWithToken('valid-token-123'));
      });

      await waitFor(() => {
        expect(screen.queryByTestId('verify-email-banner')).toBeNull();
      });

      // Also confirm direct userUpdated({ emailVerified: false / true }) controls visibility
      act(() => {
        store.dispatch(userUpdated({ emailVerified: false }));
      });
      expect(await screen.findByTestId('verify-email-banner')).toBeTruthy();
      act(() => {
        store.dispatch(userUpdated({ emailVerified: true }));
      });
      await waitFor(() => {
        expect(screen.queryByTestId('verify-email-banner')).toBeNull();
      });
    });
  });
});
