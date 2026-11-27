import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import { Route, Routes, useNavigate } from 'react-router-dom';
import { createAppStore } from '..';
import { routeChanged, sessionReset } from '../actions/appActions';
import { RouteResetListener } from '../components/RouteResetListener';
import { renderWithStore } from '../../test/test-utils';

import mentorProfilesReducer, {
  setAll as setAllProfiles,
  addOne as addOneProfile,
  updateOne as updateOneProfile,
  removeOne as removeOneProfile,
  setMentorSearchQuery,
  createInitialMentorProfilesState,
} from '../slices/mentorProfilesSlice';
import mentorApplicationsReducer, {
  setAll as setAllApps,
  addOne as addOneApp,
  updateOne as updateOneApp,
  removeOne as removeOneApp,
  setMentorAppSubmitError,
  createInitialMentorApplicationsState,
} from '../slices/mentorApplicationsSlice';
import mentorSessionsReducer, {
  setAll as setAllSessions,
  addOne as addOneSession,
  updateOne as updateOneSession,
  removeOne as removeOneSession,
  setMentoredFilter,
  openSessionDeclineModal,
  createInitialMentorSessionsState,
} from '../slices/mentorSessionsSlice';
import abandonmentReviewsReducer, {
  setAll as setAllAbandonment,
  addOne as addOneAbandonment,
  updateOne as updateOneAbandonment,
  removeOne as removeOneAbandonment,
  openReportMentorModal,
  createInitialAbandonmentState,
} from '../slices/abandonmentReviewsSlice';
import sessionFeedbackReducer, {
  setAll as setAllFeedback,
  addOne as addOneFeedback,
  updateOne as updateOneFeedback,
  removeOne as removeOneFeedback,
  openSessionFeedbackModal,
  createInitialSessionFeedbackState,
} from '../slices/sessionFeedbackSlice';

import {
  fetchMyMentorProfile,
  saveMentorProfile,
  toggleMentorAvailability,
} from '../thunks/mentorProfilesThunks';
import {
  fetchMyMentorApplicationStatus,
  submitMentorApplication,
} from '../thunks/mentorApplicationsThunks';
import { bookMentorSession } from '../thunks/mentorSessionsThunks';
import {
  confirmAbandonmentReview,
  fetchMyAbandonmentReviews,
  openAbandonmentReview,
} from '../thunks/abandonmentReviewsThunks';
import {
  fetchAdminMentorFeedback,
  submitSessionFeedback,
} from '../thunks/sessionFeedbackThunks';

import {
  selectAllDirectoryMentors,
  selectMyMentorProfile,
} from '../selectors/mentorProfilesSelectors';
import {
  selectFilteredMentoredProjects,
  selectMentoredFilter,
  selectMentoredProjectsCounts,
  selectMySessions,
} from '../selectors/mentorSessionsSelectors';
import { selectToasts } from '../selectors/uiSelectors';

import MyMentorProfile from '../../pages/mentor/MyMentorProfile';
import MentoredProjects from '../../pages/mentor/MentoredProjects';
import MentorRequests from '../../pages/mentor/MentorRequests';
import MentorsDirectory from '../../pages/owner/MentorsDirectory';

const {
  mockMentorMarketplaceApi,
  mockMentorApplicationsApi,
  mockProjectsApi,
  mockFeedbackApi,
  mockAdminApi,
  mockUploadsApi,
  mockTrustApi,
} = vi.hoisted(() => ({
  mockMentorMarketplaceApi: {
    listMentors: vi.fn(),
    getMentor: vi.fn(),
    myProfile: vi.fn(),
    myStats: vi.fn(),
    createProfile: vi.fn(),
    updateProfile: vi.fn(),
    updateAvailability: vi.fn(),
    confirmMentorRole: vi.fn(),
    bookSession: vi.fn(),
    cancelPayment: vi.fn().mockResolvedValue({}),
    mySessions: vi.fn(),
    mentorSessions: vi.fn(),
    getMentoredProjects: vi.fn(),
    acceptSession: vi.fn(),
    declineSession: vi.fn(),
    cancelSession: vi.fn(),
    completeSession: vi.fn(),
    getProjectAbandonmentReview: vi.fn(),
    openAbandonmentReview: vi.fn(),
    getMyAbandonmentReviews: vi.fn(),
    confirmAbandonmentReview: vi.fn(),
    submitSessionFeedback: vi.fn(),
    getAdminMentorFeedback: vi.fn(),
  },
  mockMentorApplicationsApi: {
    getMyStatus: vi.fn(),
    list: vi.fn(),
    create: vi.fn(),
    getDigiLockerStatus: vi.fn(),
    pullDigiLockerDocuments: vi.fn(),
  },
  mockProjectsApi: {
    list: vi.fn(),
  },
  mockFeedbackApi: {
    getFeedbackReasons: vi.fn(),
  },
  mockAdminApi: {
    getPublicConfig: vi.fn(),
  },
  mockUploadsApi: {
    uploadCv: vi.fn(),
  },
  mockTrustApi: {
    getTrustSummaries: vi.fn(),
  },
}));

vi.mock('../../services/mentorMarketplaceApi', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: mockMentorMarketplaceApi,
  };
});

vi.mock('../../services/mentorApplicationsApi', () => ({
  default: mockMentorApplicationsApi,
}));

vi.mock('../../services/projectsApi', () => ({
  default: mockProjectsApi,
  isProjectLocked: vi.fn((p) => p?.isCompleted || p?.status === 'Completed' || p?.status === 'Closed'),
  isProjectActive: vi.fn((p) => !p?.isCompleted && p?.status !== 'Completed' && p?.status !== 'Closed'),
}));

vi.mock('../../services/feedbackApi', () => ({
  default: mockFeedbackApi,
  feedbackApi: mockFeedbackApi,
  OTHER_REASON_ID: 'OTHER',
}));

vi.mock('../../services/adminApi', () => ({
  default: mockAdminApi,
}));

vi.mock('../../services/uploadsApi', () => ({
  default: mockUploadsApi,
}));

vi.mock('../../services/trustApi', () => ({
  default: mockTrustApi,
}));

function RouteTestHarness() {
  const navigate = useNavigate();
  return (
    <div>
      <RouteResetListener />
      <Routes>
        <Route
          path="/mentor/projects"
          element={
            <div>
              <MentoredProjects />
              <button
                type="button"
                data-testid="nav-away-btn"
                onClick={() => navigate('/mentor/earnings')}
              >
                Go Earnings
              </button>
            </div>
          }
        />
        <Route path="/mentor/earnings" element={<div data-testid="earnings-view" />} />
      </Routes>
    </div>
  );
}

describe('Phase 8: Mentor Marketplace (5 Slices, Thunks, Screens, Reading B)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFeedbackApi.getFeedbackReasons.mockResolvedValue({
      actions: {
        MENTOR_DECLINE_ASSIGNMENT: {
          reasons: [
            { id: 'AT_CAPACITY', label: 'At Full Capacity' },
            { id: 'DOMAIN_MISMATCH', label: 'Domain Mismatch' },
          ],
        },
      },
    });
    mockProjectsApi.list.mockResolvedValue([]);
    mockTrustApi.getTrustSummaries.mockResolvedValue([]);
    mockMentorMarketplaceApi.getMyAbandonmentReviews.mockResolvedValue([]);
  });

  describe('1. CRUD Reducers & Reading B Route-Leave Reset Across All 5 Slices', () => {
    it('supports setAll/addOne/updateOne/removeOne on all 5 mentor slices and clears working state while preserving sessions', () => {
      // 1) mentorProfilesSlice
      let pState = createInitialMentorProfilesState();
      pState = mentorProfilesReducer(
        pState,
        setAllProfiles([{ id: 'mp-1', name: 'Dr. Rao', sessionPrice: 1200 }]),
      );
      pState = mentorProfilesReducer(
        pState,
        addOneProfile({ id: 'mp-2', name: 'Dr. Nair', sessionPrice: 900 }),
      );
      pState = mentorProfilesReducer(
        pState,
        updateOneProfile({ id: 'mp-1', changes: { sessionPrice: 1500 } }),
      );
      pState = mentorProfilesReducer(pState, removeOneProfile('mp-2'));
      pState = mentorProfilesReducer(pState, setMentorSearchQuery('architect'));
      pState = mentorProfilesReducer(
        pState,
        routeChanged({ from: '/owner/mentors', to: '/dashboard', group: 'dashboard' }),
      );
      expect(selectAllDirectoryMentors({ mentorProfiles: pState })).toHaveLength(1);
      expect(pState.entities['mp-1'].sessionPrice).toBe(1500);
      expect(pState.working.searchQuery).toBe('');

      // 2) mentorApplicationsSlice
      let aState = createInitialMentorApplicationsState();
      aState = mentorApplicationsReducer(
        aState,
        setAllApps([{ id: 'app-1', status: 'pending' }]),
      );
      aState = mentorApplicationsReducer(
        aState,
        addOneApp({ id: 'app-2', status: 'rejected' }),
      );
      aState = mentorApplicationsReducer(
        aState,
        updateOneApp({ id: 'app-1', changes: { status: 'approved' } }),
      );
      aState = mentorApplicationsReducer(aState, removeOneApp('app-2'));
      aState = mentorApplicationsReducer(aState, setMentorAppSubmitError('Temporary error'));
      aState = mentorApplicationsReducer(
        aState,
        routeChanged({ from: '/mentor/apply', to: '/dashboard', group: 'dashboard' }),
      );
      expect(aState.entities['app-1'].status).toBe('approved');
      expect(aState.ids).toEqual(['app-1']);
      expect(aState.working.submitError).toBe('');

      // 3) mentorSessionsSlice (filters & modals clear on routeChanged, sessions STAY!)
      let sState = createInitialMentorSessionsState();
      sState = mentorSessionsReducer(
        sState,
        setAllSessions([{ id: 's-1', status: 'escrow_funded', agreedPrice: 1000 }]),
      );
      sState = mentorSessionsReducer(
        sState,
        addOneSession({ id: 's-2', status: 'active', agreedPrice: 2000 }),
      );
      sState = mentorSessionsReducer(
        sState,
        updateOneSession({ id: 's-1', changes: { status: 'active' } }),
      );
      sState = mentorSessionsReducer(sState, removeOneSession('s-2'));
      sState = mentorSessionsReducer(sState, setMentoredFilter('completed'));
      sState = mentorSessionsReducer(sState, openSessionDeclineModal('s-1'));
      sState = mentorSessionsReducer(
        sState,
        routeChanged({ from: '/mentor/requests', to: '/mentor/projects', group: 'mentor' }),
      );
      expect(selectMySessions({ mentorSessions: sState })).toHaveLength(1);
      expect(sState.entities['s-1'].status).toBe('active');
      expect(selectMentoredFilter({ mentorSessions: sState })).toBe('all');
      expect(sState.working.declineModalOpen).toBe(false);

      // 4) abandonmentReviewsSlice
      let abState = createInitialAbandonmentState();
      abState = abandonmentReviewsReducer(
        abState,
        setAllAbandonment([{ id: 'rev-1', projectId: 'p1', status: 'open' }]),
      );
      abState = abandonmentReviewsReducer(
        abState,
        addOneAbandonment({ id: 'rev-2', projectId: 'p2', status: 'open' }),
      );
      abState = abandonmentReviewsReducer(
        abState,
        updateOneAbandonment({ id: 'rev-1', changes: { status: 'confirmed' } }),
      );
      abState = abandonmentReviewsReducer(abState, removeOneAbandonment('rev-2'));
      abState = abandonmentReviewsReducer(abState, openReportMentorModal());
      abState = abandonmentReviewsReducer(
        abState,
        routeChanged({ from: '/owner/workspace/p1', to: '/dashboard', group: 'dashboard' }),
      );
      expect(abState.entities['rev-1'].status).toBe('confirmed');
      expect(abState.working.reportModalOpen).toBe(false);

      // 5) sessionFeedbackSlice
      let fbState = createInitialSessionFeedbackState();
      fbState = sessionFeedbackReducer(
        fbState,
        setAllFeedback([{ id: 'fb-1', sessionId: 's-1', rating: 5 }]),
      );
      fbState = sessionFeedbackReducer(
        fbState,
        addOneFeedback({ id: 'fb-2', sessionId: 's-2', rating: 4 }),
      );
      fbState = sessionFeedbackReducer(
        fbState,
        updateOneFeedback({ id: 'fb-1', changes: { rating: 4 } }),
      );
      fbState = sessionFeedbackReducer(fbState, removeOneFeedback('fb-2'));
      fbState = sessionFeedbackReducer(fbState, openSessionFeedbackModal('s-1'));
      fbState = sessionFeedbackReducer(
        fbState,
        routeChanged({ from: '/owner/mentors', to: '/dashboard', group: 'dashboard' }),
      );
      expect(fbState.entities['fb-1'].rating).toBe(4);
      expect(fbState.working.targetSessionId).toBeNull();

      // sessionReset wipes persisted session state too
      sState = mentorSessionsReducer(sState, sessionReset());
      expect(selectMySessions({ mentorSessions: sState })).toEqual([]);
    });
  });

  describe('2. Thunks & Cross-Slice Sync', () => {
    it('dispatches profile, application, session, abandonment, and feedback thunks cleanly', async () => {
      const store = createAppStore();

      mockMentorMarketplaceApi.myProfile.mockRejectedValueOnce({ statusCode: 404, message: 'Not found' });
      await store.dispatch(fetchMyMentorProfile({ userId: 'm-1', force: true }));
      expect(selectMyMentorProfile(store.getState())).toBeNull();

      mockMentorMarketplaceApi.createProfile.mockResolvedValueOnce({
        id: 'mp-new',
        userId: 'm-1',
        name: 'Kiran Bose',
        sessionPrice: 117,
        isAvailable: true,
      });
      mockMentorMarketplaceApi.updateAvailability.mockResolvedValueOnce({ isAvailable: true });
      await store.dispatch(
        saveMentorProfile({
          payload: { name: 'Kiran Bose', sessionPrice: 117, isAvailable: true },
          isUpdate: false,
          userId: 'm-1',
        }),
      );
      expect(selectMyMentorProfile(store.getState()).sessionPrice).toBe(117);

      // Optimistic availability rollback on rejection
      mockMentorMarketplaceApi.updateAvailability.mockRejectedValueOnce({ statusCode: 500, message: 'Unavailable update failed' });
      await store.dispatch(toggleMentorAvailability({ isAvailable: false, userId: 'm-1' }));
      expect(selectMyMentorProfile(store.getState()).isAvailable).toBe(true);

      // Mentor application status + submit
      mockMentorApplicationsApi.getMyStatus.mockResolvedValueOnce({ status: 'none', application: null });
      await store.dispatch(fetchMyMentorApplicationStatus({ userId: 'u-2' }));
      expect(store.getState().mentorApplications.myStatusData.status).toBe('none');

      mockMentorApplicationsApi.create.mockResolvedValueOnce({ id: 'app-9', status: 'pending' });
      await store.dispatch(
        submitMentorApplication({ payload: { userId: 'u-2', name: 'Alice' }, verifiedCount: 1 }),
      );
      expect(store.getState().mentorApplications.myStatusData.status).toBe('pending');

      // Session booking -> fetchMySessions -> submitSessionFeedback cross-slice mark
      mockMentorMarketplaceApi.bookSession.mockResolvedValueOnce({
        session: { id: 'sess-5', projectId: 'p1', status: 'payment_pending', agreedPrice: 117 },
        paymentIntent: { id: 'pi-5' },
      });
      mockMentorMarketplaceApi.mySessions.mockResolvedValueOnce([
        { id: 'sess-5', projectId: 'p1', status: 'completed', hasFeedback: false, agreedPrice: 117 },
      ]);
      await store.dispatch(bookMentorSession({ payload: { mentorId: 'mp-new', projectId: 'p1' } }));
      expect(store.getState().mentorSessions.activeCheckout.session.id).toBe('sess-5');

      mockMentorMarketplaceApi.submitSessionFeedback.mockResolvedValueOnce({
        id: 'fb-5',
        sessionId: 'sess-5',
        rating: 5,
      });
      await store.dispatch(submitSessionFeedback({ sessionId: 'sess-5', payload: { rating: 5 } }));
      expect(store.getState().mentorSessions.entities['sess-5'].hasFeedback).toBe(true);

      // Admin mentor feedback summary
      mockMentorMarketplaceApi.getAdminMentorFeedback.mockResolvedValueOnce({
        averageRating: 5,
        totalFeedbackCount: 1,
        feedback: [{ id: 'fb-5', rating: 5 }],
        abandonmentHistory: [],
      });
      await store.dispatch(fetchAdminMentorFeedback({ mentorId: 'm-1' }));
      expect(store.getState().sessionFeedback.adminSummaryByMentorId['m-1'].totalFeedbackCount).toBe(1);

      // Abandonment open + confirm
      mockMentorMarketplaceApi.openAbandonmentReview.mockResolvedValueOnce({ id: 'rev-8', status: 'open' });
      mockMentorMarketplaceApi.getProjectAbandonmentReview.mockResolvedValueOnce({ id: 'rev-8', status: 'open', projectId: 'p1' });
      await store.dispatch(openAbandonmentReview({ projectId: 'p1' }));
      expect(store.getState().abandonmentReviews.byProjectInfo['p1'].status).toBe('open');

      mockMentorMarketplaceApi.getMyAbandonmentReviews.mockResolvedValueOnce([{ id: 'rev-8', projectId: 'p1', status: 'open' }]);
      await store.dispatch(fetchMyAbandonmentReviews({ force: true }));
      mockMentorMarketplaceApi.confirmAbandonmentReview.mockResolvedValueOnce({ id: 'rev-8', status: 'confirmed' });
      await store.dispatch(confirmAbandonmentReview('rev-8'));
      expect(store.getState().abandonmentReviews.myOpenReviewIds).toEqual([]);
    });
  });

  describe('3. Screen Integration Tests (Prompt Checklist)', () => {
    it('Mentored Projects shows stored server All/Active/Completed tabs, matching counts, completed item, and route-leave reset', async () => {
      const store = createAppStore();
      mockMentorMarketplaceApi.getMentoredProjects.mockResolvedValue({
        items: [
          { projectId: 'p-act', id: 'p-act', title: 'Active Rover', status: 'In Progress', tab: 'active' },
          { projectId: 'p-cmp', id: 'p-cmp', title: 'Finished AI', status: 'Completed', isCompleted: true, tab: 'completed' },
        ],
        counts: { all: 2, active: 1, completed: 1 },
      });
      mockMentorMarketplaceApi.getMyAbandonmentReviews.mockResolvedValue([
        { id: 'rev-open', projectId: 'p-act', projectTitle: 'Active Rover', status: 'open' },
      ]);
      mockMentorMarketplaceApi.confirmAbandonmentReview.mockResolvedValue({ id: 'rev-open', status: 'confirmed' });

      store.dispatch({
        type: 'session/setSession',
        payload: {
          user: { id: 'm-1', name: 'Dr. Rao', role: 'Mentor' },
          isAuthenticated: true,
          activeRole: 'Mentor',
          allowedRoles: ['Mentor'],
        },
      });
      renderWithStore(
        <RouteTestHarness />,
        { store, route: '/mentor/projects' },
      );

      await waitFor(() => {
        expect(screen.getByText('Finished AI')).toBeTruthy();
        expect(screen.getAllByText('Active Rover').length).toBeGreaterThanOrEqual(1);
      });

      const counts = selectMentoredProjectsCounts(store.getState());
      expect(counts).toEqual({ all: 2, active: 1, completed: 1 });
      expect(screen.getByRole('tab', { name: /All/i }).textContent).toContain('2');
      expect(screen.getByRole('tab', { name: /Active/i }).textContent).toContain('1');
      expect(screen.getByRole('tab', { name: /Completed/i }).textContent).toContain('1');

      // Confirm abandonment banner from MentoredProjects
      fireEvent.click(screen.getByTestId('mentor-confirm-active-btn-rev-open'));
      await waitFor(() => {
        expect(mockMentorMarketplaceApi.confirmAbandonmentReview).toHaveBeenCalledWith('rev-open');
        expect(screen.queryByTestId('mentor-confirm-active-btn-rev-open')).toBeNull();
      });

      // Switch to Completed tab -> shows Finished AI cleanly (Active Rover card removed)
      fireEvent.click(screen.getByRole('tab', { name: /Completed/i }));
      expect(selectMentoredFilter(store.getState())).toBe('completed');
      expect(screen.getByText('Finished AI')).toBeTruthy();
      expect(screen.queryByText('Active Rover')).toBeNull();

      // Route change resets filter back to 'all' while keeping mentored projects in store
      fireEvent.click(screen.getByTestId('nav-away-btn'));
      await waitFor(() => expect(screen.getByTestId('earnings-view')).toBeTruthy());
      expect(selectMentoredFilter(store.getState())).toBe('all');
      expect(selectFilteredMentoredProjects(store.getState())).toHaveLength(2);
    });

    it('MentorRequests Decline opens modal, selects reason tag, and dispatches declineMentorSession with tags & reason', async () => {
      const store = createAppStore();
      mockMentorMarketplaceApi.mentorSessions.mockResolvedValue([
        {
          id: 'sess-req-1',
          projectId: 'p-1',
          projectName: 'Cloud Mesh',
          ownerName: 'Priya',
          agreedPrice: 1500,
          status: 'escrow_funded',
          createdAt: '2026-11-01T10:00:00.000Z',
        },
      ]);
      mockMentorMarketplaceApi.declineSession.mockResolvedValue({
        id: 'sess-req-1',
        status: 'refunded',
        declineReason: 'Schedule is full this semester for mentorship.',
        declinedBy: 'mentor',
      });

      renderWithStore(<MentorRequests />, { store });

      await waitFor(() => expect(screen.getByText('Cloud Mesh')).toBeTruthy());
      fireEvent.click(screen.getByRole('button', { name: /Decline/i }));

      await waitFor(() => expect(screen.getByTestId('reason-chip-DOMAIN_MISMATCH')).toBeTruthy());
      fireEvent.click(screen.getByTestId('reason-chip-DOMAIN_MISMATCH'));
      fireEvent.change(screen.getByLabelText(/Decline Reason/i), {
        target: { value: 'Schedule is full this semester for mentorship.' },
      });
      fireEvent.click(screen.getByRole('button', { name: /Confirm Decline & Refund/i }));

      await waitFor(() => {
        expect(mockMentorMarketplaceApi.declineSession).toHaveBeenCalledWith(
          'sess-req-1',
          expect.objectContaining({
            reasons: ['DOMAIN_MISMATCH'],
            reason: 'Schedule is full this semester for mentorship.',
          }),
        );
        expect(screen.getByText(/Declined \(Refunded\)/i)).toBeTruthy();
      });
    });

    it('MyMentorProfile keeps 117 price keystrokes local, dispatches number 117 on save, and reads toast from uiSlice', async () => {
      const store = createAppStore();
      const baseProfile = {
        id: 'mp-1',
        userId: 'm-1',
        name: 'Neha Gupta',
        title: 'Staff Engineer',
        bio: 'Architecture mentor',
        skills: ['React', 'Node'],
        experienceYears: 6,
        sessionPrice: 1500,
        isAvailable: true,
        maxActiveMentees: 3,
      };
      mockMentorMarketplaceApi.myProfile.mockResolvedValue(baseProfile);
      mockMentorMarketplaceApi.updateProfile.mockResolvedValue({ ...baseProfile, sessionPrice: 117 });
      mockMentorMarketplaceApi.updateAvailability.mockResolvedValue({ isAvailable: true });

      store.dispatch({
        type: 'session/setSession',
        payload: {
          user: { id: 'm-1', name: 'Neha Gupta', role: 'Mentor' },
          isAuthenticated: true,
          activeRole: 'Mentor',
          allowedRoles: ['Mentor'],
        },
      });
      renderWithStore(
        <MyMentorProfile />,
        { store },
      );

      const priceInput = await screen.findByLabelText(/Price \(INR\)/i);
      fireEvent.change(priceInput, { target: { value: '117' } });
      expect(priceInput.value).toBe('117');
      // Still 1500 in store until Save is clicked
      expect(selectMyMentorProfile(store.getState()).sessionPrice).toBe(1500);

      fireEvent.click(screen.getByTestId('save-mentor-profile-btn'));

      await waitFor(() => {
        expect(mockMentorMarketplaceApi.updateProfile).toHaveBeenCalledWith(
          expect.objectContaining({ sessionPrice: 117 }),
          undefined,
          'm-1',
        );
        expect(selectMyMentorProfile(store.getState()).sessionPrice).toBe(117);
        const uiToasts = selectToasts(store.getState());
        expect(uiToasts.some((t) => t.message === 'Mentor profile saved')).toBe(true);
        expect(screen.getByTestId('toast').textContent).toContain('Mentor profile saved');
      });
    });

    it('MentorsDirectory books session via thunk up to payment step and submits post-session feedback', async () => {
      const store = createAppStore();
      mockMentorMarketplaceApi.listMentors.mockResolvedValue([
        {
          id: 'mp-9',
          userId: 'm-9',
          name: 'Dr. Roy',
          title: 'Systems Architect',
          bio: 'Distributed systems guidance',
          skills: ['Go', 'Kafka'],
          experienceYears: 8,
          sessionPrice: 1000,
          isAvailable: true,
          maxActiveMentees: 3,
          activeMenteesCount: 0,
        },
      ]);
      mockProjectsApi.list.mockResolvedValue([
        { id: 'proj-own-1', title: 'Event Streamer', ownerId: 'owner-1', status: 'Open' },
      ]);
      mockMentorMarketplaceApi.mySessions
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 'sess-booked-1',
            mentorId: 'mp-9',
            projectId: 'proj-own-1',
            agreedPrice: 1000,
            status: 'payment_pending',
          },
        ])
        .mockResolvedValue([
          {
            id: 'sess-booked-1',
            mentorId: 'mp-9',
            projectId: 'proj-own-1',
            agreedPrice: 1000,
            status: 'completed',
            hasFeedback: false,
          },
        ]);
      mockMentorMarketplaceApi.bookSession.mockResolvedValueOnce({
        session: {
          id: 'sess-booked-1',
          mentorId: 'mp-9',
          projectId: 'proj-own-1',
          agreedPrice: 1000,
          status: 'payment_pending',
        },
        paymentIntent: { id: 'pi-1', payeeVpa: 'teamforge@demo' },
      });

      store.dispatch({
        type: 'session/setSession',
        payload: {
          user: { id: 'owner-1', name: 'Priya', role: 'Project Owner' },
          isAuthenticated: true,
          activeRole: 'Project Owner',
          allowedRoles: ['Project Owner'],
        },
      });
      renderWithStore(
        <MentorsDirectory />,
        { store },
      );

      await waitFor(() => expect(screen.getByText('Dr. Roy')).toBeTruthy());
      fireEvent.click(screen.getByRole('button', { name: /Book with Escrow/i }));
      await waitFor(() => expect(screen.getByRole('button', { name: /Proceed to Payment/i })).toBeTruthy());
      fireEvent.click(screen.getByRole('button', { name: /Proceed to Payment/i }));

      await waitFor(() => {
        expect(mockMentorMarketplaceApi.bookSession).toHaveBeenCalledWith(
          expect.objectContaining({ mentorId: 'mp-9', projectId: 'proj-own-1' }),
        );
        expect(screen.getByText(/Demo payment: no real money is charged/i)).toBeTruthy();
      });

      // Close payment modal, wait for async cancelPayment + mySessions refetch, then submit feedback on completed session
      fireEvent.click(screen.getByRole('button', { name: /Close modal|×/i }));
      await waitFor(() => {
        expect(mockMentorMarketplaceApi.cancelPayment).toHaveBeenCalledWith('sess-booked-1');
      });
      act(() => {
        store.dispatch(updateOneSession({ id: 'sess-booked-1', changes: { status: 'completed', hasFeedback: false } }));
      });
      fireEvent.click(screen.getByRole('tab', { name: /Booking History/i }));
      fireEvent.click(await screen.findByTestId('rate-session-btn-sess-booked-1'));
      mockMentorMarketplaceApi.submitSessionFeedback.mockResolvedValueOnce({
        id: 'fb-99',
        sessionId: 'sess-booked-1',
        rating: 5,
      });
      fireEvent.click(screen.getByTestId('submit-session-feedback-btn'));

      await waitFor(() => {
        expect(mockMentorMarketplaceApi.submitSessionFeedback).toHaveBeenCalledWith(
          'sess-booked-1',
          { rating: 5, comment: undefined },
        );
        expect(screen.getByText('Rated')).toBeTruthy();
      });
    });
  });
});
