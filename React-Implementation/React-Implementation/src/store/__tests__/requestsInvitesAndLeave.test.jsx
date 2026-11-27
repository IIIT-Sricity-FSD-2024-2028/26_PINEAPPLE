import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Link, Route, Routes } from 'react-router-dom';
import { createAppStore } from '../index';
import joinRequestsReducer, {
  addOne as addJoinRequestOne,
  createInitialJoinRequestsState,
  removeOne as removeJoinRequestOne,
  setAll as setAllJoinRequests,
  setMembersSubSection,
  setRequestStatusFilter,
  updateOne as updateJoinRequestOne,
} from '../slices/joinRequestsSlice';
import projectInvitesReducer, {
  addOne as addInviteOne,
  createInitialProjectInvitesState,
  removeOne as removeInviteOne,
  setAll as setAllInvites,
  updateOne as updateInviteOne,
} from '../slices/projectInvitesSlice';
import leaveRequestsReducer, {
  addOne as addLeaveOne,
  createInitialLeaveRequestsState,
  removeOne as removeLeaveOne,
  setAll as setAllLeaves,
  setLeaveCooldownMessage,
  updateOne as updateLeaveOne,
} from '../slices/leaveRequestsSlice';
import projectsReducer, {
  setAll as setAllProjects,
} from '../slices/projectsSlice';
import actionFeedbackReducer, {
  createInitialActionFeedbackState,
} from '../slices/actionFeedbackSlice';
import { fetchFeedbackReasons } from '../thunks/feedbackThunks';
import {
  selectAllJoinRequests,
  selectCombinedProjectRequests,
  selectFilteredCombinedProjectRequests,
  selectIsJoinRequestResponding,
  selectJoinRequestsWorking,
  selectMyJoinRequests,
} from '../selectors/joinRequestsSelectors';
import {
  selectInvitesWorking,
  selectMyPendingInvites,
  selectProjectInvitesByProjectId,
} from '../selectors/invitesSelectors';
import {
  selectLeaveCooldownForProject,
  selectLeaveRequestsWorking,
  selectMyLeaveRequestForProject,
  selectPendingLeaveRequestsByProjectId,
} from '../selectors/leaveRequestsSelectors';
import {
  createJoinRequest,
  deleteJoinRequest,
  fetchJoinRequests,
  fetchMyJoinRequests,
  respondJoinRequest,
} from '../thunks/joinRequestsThunks';
import {
  acceptProjectInvite,
  cancelProjectInvite,
  declineProjectInvite,
  fetchMyInvites,
  fetchProjectInvites,
  sendProjectInvite,
} from '../thunks/invitesThunks';
import {
  approveLeaveRequest,
  createLeaveRequest,
  fetchMyLeaveRequest,
  fetchProjectLeaveRequests,
  rejectLeaveRequest,
  withdrawLeaveRequest,
} from '../thunks/leaveRequestsThunks';
import { routeChanged } from '../actions/appActions';
import RouteResetListener from '../components/RouteResetListener';
import JoinRequestCard from '../../components/features/JoinRequestCard';
import ProjectsMarketplace from '../../pages/collaborator/ProjectsMarketplace';
import Notifications from '../../pages/notifications';
import { renderWithStore } from '../../test/test-utils';

const {
  mockJoinRequestsApi,
  mockProjectsApi,
  mockTasksApi,
  mockNotificationsApi,
  mockAppealsApi,
  mockAdminApi,
  mockUsersApi,
  mockFeedbackApi,
} = vi.hoisted(() => ({
  mockJoinRequestsApi: {
    list: vi.fn(),
    get: vi.fn(),
    getMyRequests: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    respond: vi.fn(),
    remove: vi.fn(),
  },
  mockProjectsApi: {
    list: vi.fn(),
    get: vi.fn(),
    getMyWork: vi.fn(),
    getMatch: vi.fn(),
    listInvites: vi.fn(),
    sendInvite: vi.fn(),
    cancelInvite: vi.fn(),
    getMyInvites: vi.fn(),
    acceptInvite: vi.fn(),
    declineInvite: vi.fn(),
    listLeaveRequests: vi.fn(),
    getMyLeaveRequest: vi.fn(),
    submitLeaveRequest: vi.fn(),
    withdrawLeaveRequest: vi.fn(),
    approveLeaveRequest: vi.fn(),
    rejectLeaveRequest: vi.fn(),
  },
  mockTasksApi: {
    list: vi.fn(),
  },
  mockNotificationsApi: {
    list: vi.fn(),
    getUnreadCount: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    remove: vi.fn(),
  },
  mockAppealsApi: {
    getMyAppeals: vi.fn(),
  },
  mockAdminApi: {
    getMyWarnings: vi.fn(),
  },
  mockUsersApi: {
    getResponseTime: vi.fn(),
  },
  mockFeedbackApi: {
    getFeedbackReasons: vi.fn(),
    getEntityFeedback: vi.fn(),
  },
}));

vi.mock('../../services/joinRequestsApi', () => ({
  default: mockJoinRequestsApi,
  joinRequestsApi: mockJoinRequestsApi,
}));

vi.mock('../../services/projectsApi', () => ({
  default: mockProjectsApi,
  projectsApi: mockProjectsApi,
  isProjectLocked: (p) =>
    Boolean(
      p?.isCompleted ||
        p?.deletionScheduledAt ||
        ['completed', 'closed', 'deleted'].includes(
          String(p?.status || '').toLowerCase(),
        ),
    ),
}));

vi.mock('../../services/tasksApi', () => ({
  default: mockTasksApi,
  tasksApi: mockTasksApi,
}));

vi.mock('../../services/notificationsApi', () => ({
  default: mockNotificationsApi,
  notificationsApi: mockNotificationsApi,
}));

vi.mock('../../services/appealsApi', () => ({
  default: mockAppealsApi,
}));

vi.mock('../../services/adminApi', () => ({
  default: mockAdminApi,
}));

vi.mock('../../services/usersApi', () => ({
  default: mockUsersApi,
}));

vi.mock('../../services/feedbackApi', () => ({
  default: mockFeedbackApi,
  feedbackApi: mockFeedbackApi,
  OTHER_REASON_ID: 'OTHER',
}));

describe('Phase 6: Join Requests, Project Invitations & Leave Requests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProjectsApi.list.mockResolvedValue([]);
    mockProjectsApi.get.mockResolvedValue({ id: 'p1', title: 'P1' });
    mockProjectsApi.getMyInvites.mockResolvedValue([]);
    mockProjectsApi.listInvites.mockResolvedValue([]);
    mockJoinRequestsApi.list.mockResolvedValue([]);
    mockJoinRequestsApi.getMyRequests.mockResolvedValue([]);
    mockNotificationsApi.list.mockResolvedValue([]);
    mockNotificationsApi.getUnreadCount.mockResolvedValue({ count: 0 });
    mockAppealsApi.getMyAppeals.mockResolvedValue([]);
    mockAdminApi.getMyWarnings.mockResolvedValue([]);
    mockUsersApi.getResponseTime.mockResolvedValue(null);
    mockFeedbackApi.getFeedbackReasons.mockResolvedValue({
      actions: {
        DECLINE_INVITATION: {
          actionType: 'DECLINE_INVITATION',
          title: 'Decline Project Invitation',
          reasons: [{ id: 'NO_CAPACITY', label: 'No availability right now' }],
          minReasons: 1,
          explanationRequired: false,
        },
      },
    });
  });

  describe('1. Named CRUD Reducers Across All 3 Slices', () => {
    it('supports setAll, addOne, updateOne, and removeOne on joinRequestsSlice', () => {
      let state = createInitialJoinRequestsState();
      const r1 = { id: 'jr-1', projectId: 'p1', status: 'Pending', applicantName: 'Asha' };
      const r2 = { id: 'jr-2', projectId: 'p1', status: 'Approved', applicantName: 'Rohan' };

      state = joinRequestsReducer(state, setAllJoinRequests([r1, r2]));
      expect(state.ids).toEqual(['jr-1', 'jr-2']);

      const r3 = { id: 'jr-3', projectId: 'p1', status: 'Rejected', applicantName: 'Neha' };
      state = joinRequestsReducer(state, addJoinRequestOne(r3));
      expect(state.entities['jr-3'].applicantName).toBe('Neha');

      state = joinRequestsReducer(
        state,
        updateJoinRequestOne({ id: 'jr-1', changes: { status: 'Approved' } }),
      );
      expect(state.entities['jr-1'].status).toBe('Approved');

      state = joinRequestsReducer(state, removeJoinRequestOne('jr-2'));
      expect(state.entities['jr-2']).toBeUndefined();
      expect(selectAllJoinRequests({ joinRequests: state })).toHaveLength(2);
    });

    it('supports setAll, addOne, updateOne, and removeOne on projectInvitesSlice', () => {
      let state = createInitialProjectInvitesState();
      const i1 = { id: 'inv-1', projectId: 'p1', invitedUsername: 'dev1', status: 'pending' };
      state = projectInvitesReducer(state, setAllInvites([i1]));
      expect(state.ids).toEqual(['inv-1']);

      const i2 = { id: 'inv-2', projectId: 'p1', invitedUsername: 'dev2', status: 'pending' };
      state = projectInvitesReducer(state, addInviteOne(i2));
      expect(state.inviteIdsByProject.p1).toEqual(['inv-2', 'inv-1']);

      state = projectInvitesReducer(
        state,
        updateInviteOne({ id: 'inv-2', changes: { status: 'accepted' } }),
      );
      expect(state.entities['inv-2'].status).toBe('accepted');

      state = projectInvitesReducer(state, removeInviteOne('inv-1'));
      expect(state.entities['inv-1']).toBeUndefined();
      expect(state.inviteIdsByProject.p1).toEqual(['inv-2']);
    });

    it('supports setAll, addOne, updateOne, and removeOne on leaveRequestsSlice', () => {
      let state = createInitialLeaveRequestsState();
      const l1 = { id: 'lr-1', projectId: 'p1', userId: 'u2', status: 'pending' };
      state = leaveRequestsReducer(state, setAllLeaves([l1]));
      expect(state.ids).toEqual(['lr-1']);

      const l2 = { id: 'lr-2', projectId: 'p1', userId: 'u3', status: 'pending' };
      state = leaveRequestsReducer(state, addLeaveOne(l2));
      expect(state.leaveRequestIdsByProject.p1).toEqual(['lr-2', 'lr-1']);

      state = leaveRequestsReducer(
        state,
        updateLeaveOne({ id: 'lr-1', changes: { status: 'approved' } }),
      );
      expect(state.entities['lr-1'].status).toBe('approved');

      state = leaveRequestsReducer(state, removeLeaveOne('lr-2'));
      expect(state.entities['lr-2']).toBeUndefined();
      expect(state.leaveRequestIdsByProject.p1).toEqual(['lr-1']);
    });
  });

  describe('2. Combined Owner Requests, Invites & 409/Double-Click Safety', () => {
    it('shows invitations under Pending and combined counts equal combined list lengths', async () => {
      const store = createAppStore();
      mockJoinRequestsApi.list.mockResolvedValueOnce({
        items: [
          { id: 'jr-p', projectId: 'p1', type: 'Applied', filterGroup: 'Pending', status: 'Pending', applicantName: 'Arjun' },
          { id: 'jr-a', projectId: 'p1', type: 'Applied', filterGroup: 'Approved', status: 'Approved', applicantName: 'Kiran' },
          { id: 'jr-r', projectId: 'p1', type: 'Applied', filterGroup: 'Rejected', status: 'Rejected', applicantName: 'Meera' },
        ],
        counts: { all: 3, pending: 1, approved: 1, rejected: 1 },
      });
      mockProjectsApi.listInvites.mockResolvedValueOnce([
        { id: 'inv-p', projectId: 'p1', invitedUserId: 'u8', invitedUsername: 'divya', invitedUserName: 'Divya', status: 'pending', createdAt: '2026-11-22T10:00:00Z' },
        { id: 'inv-c', projectId: 'p1', invitedUserId: 'u9', invitedUsername: 'sameer', status: 'cancelled', createdAt: '2026-11-20T10:00:00Z' },
      ]);

      await store.dispatch(fetchJoinRequests({ projectId: 'p1' }));
      await store.dispatch(fetchProjectInvites({ projectId: 'p1' }));

      const combined = selectCombinedProjectRequests(store.getState(), 'p1');
      expect(combined.items).toHaveLength(5);
      expect(combined.counts).toEqual({ all: 5, pending: 2, approved: 1, rejected: 1 });
      expect(combined.pendingItems.map((x) => x.id)).toContain('inv-p');
      expect(
        combined.pendingItems.find((x) => x.id === 'inv-p').type,
      ).toBe('Invited');

      store.dispatch(setRequestStatusFilter('pending'));
      const pendingOnly = selectFilteredCombinedProjectRequests(store.getState(), 'p1');
      expect(pendingOnly).toHaveLength(2);
      expect(pendingOnly.map((x) => x.id)).toEqual(
        expect.arrayContaining(['jr-p', 'inv-p']),
      );
    });

    it('sends only one request on rapid double-click Approve (button disabled from slice status)', async () => {
      let resolveApprove;
      mockJoinRequestsApi.respond.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveApprove = resolve;
          }),
      );

      const pendingReq = {
        id: 'jr-double-1',
        projectId: 'p1',
        userId: 'u-app',
        type: 'Applied',
        applicantName: 'Ananya',
        status: 'Pending',
      };

      const store = createAppStore({
        preloadedState: {
          joinRequests: joinRequestsReducer(undefined, setAllJoinRequests([pendingReq])),
        },
      });

      const handleAccept = (id) =>
        store.dispatch(respondJoinRequest({ id, status: 'Approved', projectId: 'p1' }));

      renderWithStore(
        <JoinRequestCard request={pendingReq} onAccept={handleAccept} />,
        { store },
      );

      const approveBtn = screen.getByTestId('accept-join-request-btn');
      fireEvent.click(approveBtn);
      fireEvent.click(approveBtn);

      expect(mockJoinRequestsApi.respond).toHaveBeenCalledTimes(1);
      expect(selectIsJoinRequestResponding(store.getState(), 'jr-double-1')).toBe(true);
      expect(approveBtn.hasAttribute('disabled')).toBe(true);

      resolveApprove({ id: 'jr-double-1', projectId: 'p1', status: 'Approved' });

      await waitFor(() => {
        expect(selectIsJoinRequestResponding(store.getState(), 'jr-double-1')).toBe(false);
        expect(store.getState().joinRequests.entities['jr-double-1'].status).toBe('Approved');
      });
    });

    it('leaves request unchanged and surfaces error on 409 response', async () => {
      const pendingReq = {
        id: 'jr-409',
        projectId: 'p1',
        userId: 'u2',
        status: 'Pending',
        filterGroup: 'Pending',
      };
      const store = createAppStore({
        preloadedState: {
          joinRequests: joinRequestsReducer(undefined, setAllJoinRequests([pendingReq])),
        },
      });

      mockJoinRequestsApi.respond.mockRejectedValueOnce({
        statusCode: 409,
        code: 'PROJECT_FULL',
        serverMessage: 'Project has reached its collaborator capacity.',
      });

      const res = await store.dispatch(
        respondJoinRequest({ id: 'jr-409', status: 'Approved', projectId: 'p1' }),
      );

      expect(res.meta.requestStatus).toBe('rejected');
      expect(store.getState().joinRequests.entities['jr-409'].status).toBe('Pending');
      expect(selectJoinRequestsWorking(store.getState()).respondError.message).toBe(
        'Project has reached its collaborator capacity.',
      );
      expect(selectJoinRequestsWorking(store.getState()).respondError.statusCode).toBe(409);

      // 409 on invite accept also leaves invite unchanged & stores error
      const pendingInv = { id: 'inv-409', projectId: 'p2', status: 'pending' };
      const invStore = createAppStore({
        preloadedState: {
          projectInvites: projectInvitesReducer(undefined, setAllInvites([pendingInv])),
        },
      });
      mockProjectsApi.acceptInvite.mockRejectedValueOnce({
        statusCode: 409,
        code: 'ACTIVE_PROJECT_CAP',
        serverMessage: 'Active project cap reached (max 3).',
      });
      const invRes = await invStore.dispatch(
        acceptProjectInvite({ inviteId: 'inv-409', projectId: 'p2' }),
      );
      expect(invRes.meta.requestStatus).toBe('rejected');
      expect(invStore.getState().projectInvites.entities['inv-409'].status).toBe('pending');
      expect(selectInvitesWorking(invStore.getState()).actionError.message).toBe(
        'Active project cap reached (max 3).',
      );
    });

    it('handles createJoinRequest, deleteJoinRequest, send/cancel invites and refetches counts', async () => {
      const store = createAppStore();

      mockJoinRequestsApi.create.mockResolvedValueOnce({
        id: 'jr-new',
        projectId: 'p1',
        status: 'Pending',
      });
      await store.dispatch(createJoinRequest({ payload: { projectId: 'p1', message: 'Hi!' } }));
      expect(store.getState().joinRequests.entities['jr-new'].status).toBe('Pending');

      mockProjectsApi.sendInvite.mockResolvedValueOnce({
        id: 'inv-sent',
        projectId: 'p1',
        invitedUsername: 'kiran',
        status: 'pending',
      });
      await store.dispatch(sendProjectInvite({ projectId: 'p1', username: 'kiran' }));
      expect(selectProjectInvitesByProjectId(store.getState(), 'p1')).toHaveLength(1);
      expect(mockProjectsApi.get).toHaveBeenCalledWith('p1');

      mockProjectsApi.cancelInvite.mockResolvedValueOnce({});
      await store.dispatch(cancelProjectInvite({ projectId: 'p1', inviteId: 'inv-sent' }));
      expect(store.getState().projectInvites.entities['inv-sent'].status).toBe('cancelled');

      mockProjectsApi.sendInvite.mockResolvedValueOnce({
        id: 'inv-dec',
        projectId: 'p1',
        invitedUsername: 'neha',
        status: 'pending',
      });
      await store.dispatch(sendProjectInvite({ projectId: 'p1', username: 'neha' }));
      mockProjectsApi.declineInvite.mockResolvedValueOnce({ success: true });
      await store.dispatch(
        declineProjectInvite({
          inviteId: 'inv-dec',
          payload: { reasons: ['NO_CAPACITY'] },
        }),
      );
      expect(store.getState().projectInvites.entities['inv-dec'].status).toBe('declined');

      mockJoinRequestsApi.remove.mockResolvedValueOnce({ slotRestored: true });
      await store.dispatch(deleteJoinRequest({ id: 'jr-new', projectId: 'p1' }));
      expect(store.getState().joinRequests.entities['jr-new']).toBeUndefined();
    });
  });

  describe('3. Unified Decline Invite Flow Across Notifications & ProjectsMarketplace', () => {
    it('opens the same UniversalReasonModal and dispatches declineProjectInvite from both screens', async () => {
      mockProjectsApi.getMyInvites.mockResolvedValue([
        {
          id: 'inv-shared-1',
          projectId: 'p-market',
          projectTitle: 'Shared Neural Search',
          invitedByName: 'Priya',
          status: 'pending',
        },
      ]);
      mockProjectsApi.list.mockResolvedValue([
        {
          id: 'p-market',
          title: 'Shared Neural Search',
          owner: 'Priya',
          ownerId: 'owner-1',
          status: 'Open',
          skills: ['React'],
        },
      ]);
      mockProjectsApi.declineInvite.mockResolvedValue({ success: true });

      const preloadedFeedback = actionFeedbackReducer(
        createInitialActionFeedbackState(),
        fetchFeedbackReasons.fulfilled(
          {
            actions: {
              DECLINE_INVITATION: {
                actionType: 'DECLINE_INVITATION',
                title: 'Decline Project Invitation',
                minReasons: 1,
                explanationRequired: false,
                reasons: [{ id: 'NO_CAPACITY', label: 'No availability right now' }],
              },
            },
          },
          'req-1',
        ),
      );

      // 1) Decline from ProjectsMarketplace
      const storeMarket = createAppStore({
        preloadedState: {
          session: {
            user: { id: 'u-collab', name: 'Asha' },
            isAuthenticated: true,
            status: 'authenticated',
          },
          actionFeedback: preloadedFeedback,
        },
      });
      const { unmount } = renderWithStore(
        <ProjectsMarketplace />,
        { store: storeMarket },
      );

      const declineMarketBtn = await screen.findByTestId('decline-invite-btn-p-market');
      fireEvent.click(declineMarketBtn);

      await waitFor(() => {
        expect(screen.getByTestId('universal-reason-modal')).toBeTruthy();
      });
      fireEvent.click(screen.getByTestId('reason-chip-NO_CAPACITY'));
      fireEvent.click(screen.getByTestId('universal-reason-confirm-btn'));

      await waitFor(() => {
        expect(mockProjectsApi.declineInvite).toHaveBeenCalledWith(
          'inv-shared-1',
          expect.objectContaining({ reasons: ['NO_CAPACITY'] }),
        );
      });
      unmount();

      // 2) Decline from Notifications
      vi.clearAllMocks();
      mockProjectsApi.getMyInvites.mockResolvedValue([
        {
          id: 'inv-shared-1',
          projectId: 'p-market',
          projectTitle: 'Shared Neural Search',
          invitedByName: 'Priya',
          status: 'pending',
        },
      ]);
      mockNotificationsApi.list.mockResolvedValue([]);
      mockNotificationsApi.getUnreadCount.mockResolvedValue({ count: 0 });
      mockAppealsApi.getMyAppeals.mockResolvedValue([]);
      mockAdminApi.getMyWarnings.mockResolvedValue([]);
      mockProjectsApi.declineInvite.mockResolvedValue({ success: true });

      const storeNotif = createAppStore({
        preloadedState: { actionFeedback: preloadedFeedback },
      });
      renderWithStore(
        <Notifications />,
        { store: storeNotif },
      );

      const declineNotifBtn = await screen.findByTestId('decline-invite-btn-inv-shared-1');
      fireEvent.click(declineNotifBtn);

      await waitFor(() => {
        expect(screen.getByTestId('universal-reason-modal')).toBeTruthy();
      });
      fireEvent.click(screen.getByTestId('reason-chip-NO_CAPACITY'));
      fireEvent.click(screen.getByTestId('universal-reason-confirm-btn'));

      await waitFor(() => {
        expect(mockProjectsApi.declineInvite).toHaveBeenCalledWith(
          'inv-shared-1',
          expect.objectContaining({ reasons: ['NO_CAPACITY'] }),
        );
      });
    });

    it('renders state-driven disabled buttons (Applied, Member) directly from preloaded store', () => {
      const store = createAppStore({
        preloadedState: {
          projects: projectsReducer(
            undefined,
            setAllProjects([
              { id: 'p-applied', title: 'Applied Proj', ownerId: 'o1', status: 'Open', skills: [] },
              { id: 'p-member', title: 'Member Proj', ownerId: 'o2', collaborators: ['u1'], status: 'Open', skills: [] },
              { id: 'p-other1', title: 'Extra Proj 1', ownerId: 'o3', status: 'Open', skills: [] },
            ]),
          ),
          joinRequests: {
            ...createInitialJoinRequestsState(),
            ids: ['jr-app-1'],
            entities: {
              'jr-app-1': { id: 'jr-app-1', projectId: 'p-applied', status: 'Pending' },
            },
            myRequestIds: ['jr-app-1'],
            myLastFetchedAt: new Date().toISOString(),
          },
          projectInvites: {
            ...createInitialProjectInvitesState(),
            myLastFetchedAt: new Date().toISOString(),
          },
        },
      });

      // Ensure projects also populate marketplaceIds
      store.dispatch({
        type: 'projects/fetchProjects/fulfilled',
        payload: {
          view: 'marketplace',
          items: [
            { id: 'p-other1', title: 'Extra Proj 1', ownerId: 'o3', status: 'Open', skills: [] },
            { id: 'p-other2', title: 'Extra Proj 2', ownerId: 'o4', status: 'Open', skills: [] },
            { id: 'p-applied', title: 'Applied Proj', ownerId: 'o1', status: 'Open', skills: [] },
            { id: 'p-member', title: 'Member Proj', ownerId: 'o2', collaborators: ['u1'], status: 'Open', skills: [] },
          ],
        },
      });

      store.dispatch({
        type: 'session/setSession',
        payload: { user: { id: 'u1', name: 'Asha' }, isAuthenticated: true },
      });
      renderWithStore(
        <ProjectsMarketplace />,
        { store },
      );

      expect(screen.getByTestId('applied-btn-p-applied').hasAttribute('disabled')).toBe(true);
      expect(screen.getByTestId('withdraw-btn-p-applied')).toBeTruthy();
      expect(screen.getByTestId('member-btn-p-member').hasAttribute('disabled')).toBe(true);
      expect(selectMyJoinRequests(store.getState())).toHaveLength(1);
    });
  });

  describe('4. Leave Requests Lifecycle & Route-Leave Reset', () => {
    it('supports submit, mine, withdraw, owner approve/reject, and 409 cooldown message', async () => {
      const store = createAppStore();

      mockProjectsApi.submitLeaveRequest.mockResolvedValueOnce({
        id: 'lr-1',
        projectId: 'p1',
        status: 'pending',
      });
      await store.dispatch(
        createLeaveRequest({ projectId: 'p1', payload: { reasons: ['SCHEDULE'], explanation: 'Exams next week.' } }),
      );
      expect(selectMyLeaveRequestForProject(store.getState(), 'p1').status).toBe('pending');

      mockProjectsApi.listLeaveRequests.mockResolvedValueOnce([
        { id: 'lr-1', projectId: 'p1', userId: 'u2', status: 'pending' },
      ]);
      await store.dispatch(fetchProjectLeaveRequests({ projectId: 'p1' }));
      expect(selectPendingLeaveRequestsByProjectId(store.getState(), 'p1')).toHaveLength(1);

      mockProjectsApi.approveLeaveRequest.mockResolvedValueOnce({ success: true });
      await store.dispatch(approveLeaveRequest({ requestId: 'lr-1', projectId: 'p1' }));
      expect(selectPendingLeaveRequestsByProjectId(store.getState(), 'p1')).toHaveLength(0);

      mockProjectsApi.submitLeaveRequest.mockRejectedValueOnce({
        statusCode: 409,
        code: 'LEAVE_REQUEST_COOLDOWN',
        serverMessage: 'Wait 24h before submitting another leave request.',
      });
      await store.dispatch(createLeaveRequest({ projectId: 'p2', payload: {} }));
      expect(selectLeaveCooldownForProject(store.getState(), 'p2')).toContain('24h');

      mockProjectsApi.getMyLeaveRequest.mockResolvedValueOnce({
        id: 'lr-mine',
        projectId: 'p3',
        status: 'pending',
      });
      await store.dispatch(fetchMyLeaveRequest({ projectId: 'p3' }));
      expect(selectMyLeaveRequestForProject(store.getState(), 'p3').id).toBe('lr-mine');

      mockProjectsApi.withdrawLeaveRequest.mockResolvedValueOnce({});
      await store.dispatch(withdrawLeaveRequest({ projectId: 'p3' }));
      expect(selectMyLeaveRequestForProject(store.getState(), 'p3')).toBeNull();

      mockProjectsApi.listLeaveRequests.mockResolvedValueOnce([
        { id: 'lr-rj', projectId: 'p3', userId: 'u4', status: 'pending' },
      ]);
      await store.dispatch(fetchProjectLeaveRequests({ projectId: 'p3', force: true }));
      mockProjectsApi.rejectLeaveRequest.mockResolvedValueOnce({ success: true });
      await store.dispatch(
        rejectLeaveRequest({ requestId: 'lr-rj', payload: { explanation: 'Finish handoff.' }, projectId: 'p3' }),
      );
      expect(selectPendingLeaveRequestsByProjectId(store.getState(), 'p3')).toHaveLength(0);
    });

    it('clears filter chips, selection, and working errors on routeChanged while keeping entities', () => {
      const store = createAppStore({
        preloadedState: {
          joinRequests: joinRequestsReducer(
            undefined,
            setAllJoinRequests([{ id: 'jr-keep', projectId: 'p1', status: 'Pending' }]),
          ),
          projectInvites: projectInvitesReducer(
            undefined,
            setAllInvites([{ id: 'inv-keep', projectId: 'p1', status: 'pending' }]),
          ),
          leaveRequests: leaveRequestsReducer(
            undefined,
            setLeaveCooldownMessage({ projectId: 'p1', message: 'Cooldown active' }),
          ),
        },
      });

      store.dispatch(setRequestStatusFilter('pending'));
      store.dispatch(setMembersSubSection('requests'));

      renderWithStore(
        <>
          <RouteResetListener />
          <Link to="/projects">Browse Projects</Link>
          <Routes>
            <Route path="/owner/workspace/p1" element={<div>Owner Workspace</div>} />
            <Route path="/projects" element={<div>Marketplace</div>} />
          </Routes>
        </>,
        { store, route: '/owner/workspace/p1' },
      );

      expect(selectJoinRequestsWorking(store.getState()).requestStatusFilter).toBe('pending');
      expect(selectJoinRequestsWorking(store.getState()).membersSubSection).toBe('requests');
      expect(selectLeaveCooldownForProject(store.getState(), 'p1')).toBe('Cooldown active');

      fireEvent.click(screen.getByRole('link', { name: 'Browse Projects' }));

      expect(selectJoinRequestsWorking(store.getState()).requestStatusFilter).toBe('all');
      expect(selectJoinRequestsWorking(store.getState()).membersSubSection).toBe('all');
      expect(selectLeaveRequestsWorking(store.getState()).cooldownMessageByProject).toEqual({});
      expect(selectAllJoinRequests(store.getState())).toHaveLength(1);
      expect(selectMyPendingInvites(store.getState())).toHaveLength(0);
      expect(store.getState().projectInvites.entities['inv-keep'].status).toBe('pending');
    });

    it('respects fetchMyInvites & fetchMyJoinRequests condition deduplication and force refresh', async () => {
      const store = createAppStore();
      mockProjectsApi.getMyInvites.mockResolvedValue([{ id: 'inv-1', status: 'pending' }]);
      mockJoinRequestsApi.getMyRequests.mockResolvedValue([{ id: 'jr-1', status: 'Pending' }]);

      await store.dispatch(fetchMyInvites());
      await store.dispatch(fetchMyInvites());
      expect(mockProjectsApi.getMyInvites).toHaveBeenCalledTimes(1);

      await store.dispatch(fetchMyInvites({ force: true }));
      expect(mockProjectsApi.getMyInvites).toHaveBeenCalledTimes(2);

      await store.dispatch(fetchMyJoinRequests({ userId: 'u1' }));
      await store.dispatch(fetchMyJoinRequests({ userId: 'u1' }));
      expect(mockJoinRequestsApi.getMyRequests).toHaveBeenCalledTimes(1);

      store.dispatch(routeChanged({ from: '/a', to: '/b', group: 'b' }));
      await store.dispatch(fetchMyJoinRequests({ userId: 'u1', force: true }));
      expect(mockJoinRequestsApi.getMyRequests).toHaveBeenCalledTimes(2);
    });
  });
});
