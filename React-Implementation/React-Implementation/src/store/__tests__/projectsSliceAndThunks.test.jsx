import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Link, Route, Routes } from 'react-router-dom';
import { createAppStore } from '../index';
import projectsReducer, {
  addOne,
  clearWorkingState,
  removeOne,
  resetSlice,
  setAll,
  setSearchQuery,
  updateOne,
} from '../slices/projectsSlice';
import {
  selectAllProjects,
  selectMarketplaceProjects,
  selectMyProjects,
  selectMyWorkCompletedProjects,
  selectMyWorkOngoingProjects,
  selectProjectById,
  selectProjectMembersById,
  selectProjectSummaryCounts,
  selectProjectTombstoneById,
  selectProjectsError,
  selectProjectsWorking,
} from '../selectors/projectsSelectors';
import {
  cancelProjectDeletion,
  changeProjectDeadline,
  checkProjectDeletion,
  completeProject,
  createProject,
  deleteProject,
  fetchMyProjectLeaveRequest,
  fetchMyProjects,
  fetchMyWork,
  fetchProjectById,
  fetchProjectMatch,
  fetchProjectMembers,
  fetchProjects,
  fetchProjectTaskTemplates,
  fetchRemovalCheck,
  fetchTaskTemplatesByCategory,
  removeProjectMember,
  requestCloseProject,
  submitProjectLeaveRequest,
  updateProject,
  withdrawProjectLeaveRequest,
} from '../thunks/projectsThunks';
import { routeChanged } from '../actions/appActions';
import RouteResetListener from '../components/RouteResetListener';
import ProjectsMarketplace from '../../pages/collaborator/ProjectsMarketplace';
import MyProjects from '../../pages/owner/MyProjects';
import MyWork from '../../pages/collaborator/MyWork';
import CreateProject from '../../pages/owner/CreateProject';
import { renderWithStore } from '../../test/test-utils';

const {
  mockProjectsApi,
  mockTasksApi,
  mockJoinRequestsApi,
  mockUsersApi,
  mockAdminApi,
} = vi.hoisted(() => ({
  mockProjectsApi: {
    list: vi.fn(),
    getMyWork: vi.fn(),
    get: vi.fn(),
    getMembers: vi.fn(),
    getMatch: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    changeDeadline: vi.fn(),
    complete: vi.fn(),
    checkDeletion: vi.fn(),
    softDelete: vi.fn(),
    cancelDeletion: vi.fn(),
    getRemovalCheck: vi.fn(),
    removeMember: vi.fn(),
    releaseMemberTasks: vi.fn(),
    getMyLeaveRequest: vi.fn(),
    submitLeaveRequest: vi.fn(),
    withdrawLeaveRequest: vi.fn(),
    requestClose: vi.fn(),
    getTaskTemplatesByCategory: vi.fn(),
    getProjectTaskTemplates: vi.fn(),
    applyProjectTaskTemplates: vi.fn(),
    getMyInvites: vi.fn(),
  },
  mockTasksApi: {
    listForProjects: vi.fn(),
    list: vi.fn(),
  },
  mockJoinRequestsApi: {
    getMyRequests: vi.fn(),
    list: vi.fn(),
  },
  mockUsersApi: {
    getResponseTime: vi.fn(),
  },
  mockAdminApi: {
    getPublicConfig: vi.fn(),
  },
}));

vi.mock('../../services/projectsApi', () => ({
  default: mockProjectsApi,
  isProjectLocked: (p) =>
    Boolean(
      p?.isCompleted ||
        p?.deletionScheduledAt ||
        ['completed', 'closed', 'deleted', 'deletion_scheduled'].includes(
          String(p?.status || '').toLowerCase(),
        ),
    ),
  isProjectActive: (p) =>
    Boolean(
      p &&
        !p.isCompleted &&
        !['completed', 'closed', 'cancelled', 'archived'].includes(
          String(p.status || '').toLowerCase(),
        ),
    ),
}));

vi.mock('../../services/tasksApi', () => ({ default: mockTasksApi }));
vi.mock('../../services/joinRequestsApi', () => ({ default: mockJoinRequestsApi }));
vi.mock('../../services/usersApi', () => ({ default: mockUsersApi }));
vi.mock('../../services/adminApi', () => ({ default: mockAdminApi }));

describe('Phase 4: projectsSlice (Reference Implementation), Thunks, Selectors & Screens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProjectsApi.list.mockResolvedValue([]);
    mockProjectsApi.getMyWork.mockResolvedValue({
      ongoing: [],
      completed: [],
      ongoingCount: 0,
      completedCount: 0,
    });
    mockProjectsApi.getMyInvites.mockResolvedValue([]);
    mockTasksApi.listForProjects.mockResolvedValue([]);
    mockTasksApi.list.mockResolvedValue([]);
    mockJoinRequestsApi.getMyRequests.mockResolvedValue([]);
    mockJoinRequestsApi.list.mockResolvedValue([]);
    mockUsersApi.getResponseTime.mockResolvedValue(null);
    mockAdminApi.getPublicConfig.mockResolvedValue({ maxCollaboratorsPerProject: 20 });
  });

  it('supports the 4 synchronous CRUD reducers, merges without duplicates, and resets working state on routeChanged while keeping entities', () => {
    let state = projectsReducer(
      undefined,
      setAll([
        { id: 'p1', title: 'Alpha', status: 'Open' },
        { id: 'p2', title: 'Beta', status: 'In Progress' },
      ]),
    );
    expect(selectAllProjects({ projects: state })).toHaveLength(2);
    expect(state.marketplaceIds).toEqual(['p1', 'p2']);

    state = projectsReducer(
      state,
      addOne({ id: 'p3', title: 'Gamma', ownerId: 'u1', status: 'Open' }),
    );
    expect(selectAllProjects({ projects: state })).toHaveLength(3);
    expect(state.myProjectIds).toContain('p3');

    state = projectsReducer(
      state,
      updateOne({ id: 'p1', changes: { title: 'Alpha V2' } }),
    );
    expect(selectProjectById({ projects: state }, 'p1').title).toBe('Alpha V2');

    // Merge detail response for p1 without duplicating p1 or wiping members
    state = projectsReducer(
      state,
      fetchProjectById.fulfilled(
        {
          id: 'p1',
          project: {
            id: 'p1',
            title: 'Alpha V2 Detail',
            members: [{ id: 'm1', name: 'Amina' }],
            deadlineHistory: [{ reason: 'Scope update' }],
          },
        },
        'req-1',
        { id: 'p1' },
      ),
    );
    state = projectsReducer(
      state,
      fetchProjects.fulfilled(
        {
          items: [{ id: 'p1', title: 'Alpha V2 From List', status: 'Open' }],
          view: 'marketplace',
        },
        'req-2',
        {},
      ),
    );
    expect(selectAllProjects({ projects: state })).toHaveLength(3);
    const mergedP1 = selectProjectById({ projects: state }, 'p1');
    expect(mergedP1.title).toBe('Alpha V2 From List');
    expect(mergedP1.members).toEqual([{ id: 'm1', name: 'Amina' }]);
    expect(mergedP1.deadlineHistory).toEqual([{ reason: 'Scope update' }]);

    // routeChanged clears working search/filters while keeping entities
    state = projectsReducer(state, setSearchQuery('robotics'));
    state = projectsReducer(
      state,
      routeChanged({ from: '/projects', to: '/dashboard', group: 'dashboard' }),
    );
    expect(selectProjectsWorking({ projects: state }).searchQuery).toBe('');
    expect(selectAllProjects({ projects: state })).toHaveLength(3);

    // removeOne removes entity & clears id from lists
    state = projectsReducer(state, removeOne('p3'));
    expect(selectProjectById({ projects: state }, 'p3')).toBeUndefined();
    expect(state.myProjectIds).not.toContain('p3');

    state = projectsReducer(state, clearWorkingState());
    state = projectsReducer(state, resetSlice());
    expect(selectAllProjects({ projects: state })).toEqual([]);
  });

  it('selectors return stored view ID lists in exact server order', () => {
    const store = createAppStore({
      preloadedState: {
        projects: {
          ids: ['p1', 'p2', 'p3'],
          entities: {
            p1: { id: 'p1', title: 'First' },
            p2: { id: 'p2', title: 'Second' },
            p3: { id: 'p3', title: 'Third' },
          },
          marketplaceIds: ['p3', 'p1'],
          myProjectIds: ['p2', 'p3'],
          myWorkOngoingIds: ['p1'],
          myWorkCompletedIds: ['p2'],
        },
      },
    });

    expect(selectMarketplaceProjects(store.getState()).map((p) => p.id)).toEqual([
      'p3',
      'p1',
    ]);
    expect(selectMyProjects(store.getState()).map((p) => p.id)).toEqual([
      'p2',
      'p3',
    ]);
    expect(selectMyWorkOngoingProjects(store.getState()).map((p) => p.id)).toEqual([
      'p1',
    ]);
    expect(selectMyWorkCompletedProjects(store.getState()).map((p) => p.id)).toEqual([
      'p2',
    ]);
  });

  it('thunks handle pending/fulfilled/rejected, condition & force, and delete removes project from every list', async () => {
    const store = createAppStore();

    // fetchProjects condition + force
    mockProjectsApi.list.mockResolvedValueOnce([
      { id: 'p2', title: 'Ordered Second', status: 'Open' },
      { id: 'p1', title: 'Ordered First', status: 'Open' },
    ]);
    const pReq = store.dispatch(fetchProjects({ view: 'marketplace' }));
    expect(store.getState().projects.status).toBe('loading');
    await pReq;
    expect(selectMarketplaceProjects(store.getState()).map((p) => p.id)).toEqual([
      'p2',
      'p1',
    ]);

    // Condition skips fresh fetch
    await store.dispatch(fetchProjects({ view: 'marketplace' }));
    expect(mockProjectsApi.list).toHaveBeenCalledTimes(1);

    // force: true overrides freshness
    mockProjectsApi.list.mockResolvedValueOnce([
      { id: 'p1', title: 'Ordered First', status: 'Open' },
    ]);
    await store.dispatch(fetchProjects({ view: 'marketplace', force: true }));
    expect(mockProjectsApi.list).toHaveBeenCalledTimes(2);

    // Rejected fetchProjects records normalized error
    mockProjectsApi.list.mockRejectedValueOnce(
      Object.assign(new Error('Down'), { statusCode: 500 }),
    );
    await store.dispatch(fetchProjects({ view: 'marketplace', force: true }));
    expect(store.getState().projects.status).toBe('failed');
    expect(selectProjectsError(store.getState())?.statusCode).toBe(500);

    // fetchMyWork + fetchMyProjects populate all view lists without duplicates
    mockProjectsApi.list.mockResolvedValueOnce([
      { id: 'p1', title: 'Owned & Shared', ownerId: 'u1', status: 'Open' },
    ]);
    await store.dispatch(fetchMyProjects({ ownerId: 'u1', ownerName: 'Owner', force: true }));
    expect(selectMyProjects(store.getState()).map((p) => p.id)).toEqual(['p1']);

    mockProjectsApi.getMyWork.mockResolvedValueOnce({
      ongoing: [{ id: 'p1', title: 'Owned & Shared', status: 'In Progress' }],
      completed: [{ id: 'p4', title: 'Done One', status: 'Completed', isCompleted: true }],
      ongoingCount: 1,
      completedCount: 1,
    });
    await store.dispatch(fetchMyWork({ userId: 'u1', force: true }));
    expect(selectProjectSummaryCounts(store.getState()).myWorkCompletedCount).toBe(1);

    // fetchProjectById 410 tombstone & normal fulfilled
    mockProjectsApi.get.mockRejectedValueOnce(
      Object.assign(new Error('Gone'), {
        statusCode: 410,
        code: 'PROJECT_DELETED',
        project: { id: 'p-gone', title: 'Removed' },
      }),
    );
    await store.dispatch(fetchProjectById({ id: 'p-gone', force: true }));
    expect(selectProjectTombstoneById(store.getState(), 'p-gone').title).toBe('Removed');

    // fetchProjectMembers & fetchProjectMatch
    mockProjectsApi.getMembers.mockResolvedValueOnce([{ id: 'm1', name: 'Bob' }]);
    await store.dispatch(fetchProjectMembers({ id: 'p1' }));
    expect(selectProjectMembersById(store.getState(), 'p1')).toHaveLength(1);

    mockProjectsApi.getMatch.mockResolvedValueOnce({ percent: 85, missing: [] });
    await store.dispatch(fetchProjectMatch({ id: 'p1' }));
    expect(store.getState().projects.skillMatchById.p1.percent).toBe(85);

    // createProject, updateProject, changeProjectDeadline, completeProject
    mockProjectsApi.create.mockResolvedValueOnce({ id: 'p-new', title: 'Created' });
    await store.dispatch(createProject({ payload: { title: 'Created' } }));
    expect(selectMyProjects(store.getState()).map((p) => p.id)).toContain('p-new');

    mockProjectsApi.update.mockResolvedValueOnce({ id: 'p1', title: 'Updated P1' });
    mockProjectsApi.get.mockResolvedValueOnce({ id: 'p1', title: 'Updated P1' });
    await store.dispatch(updateProject({ id: 'p1', payload: { title: 'Updated P1' } }));
    expect(selectProjectById(store.getState(), 'p1').title).toBe('Updated P1');

    mockProjectsApi.changeDeadline.mockResolvedValueOnce({
      dueDate: '2027-01-15T00:00:00.000Z',
      deadlineHistory: [{ reason: 'Holiday buffer' }],
    });
    mockProjectsApi.get.mockResolvedValueOnce({
      id: 'p1',
      dueDate: '2027-01-15T00:00:00.000Z',
      deadlineHistory: [{ reason: 'Holiday buffer' }],
    });
    await store.dispatch(changeProjectDeadline({ id: 'p1', payload: { reason: 'Holiday buffer' } }));
    expect(selectProjectById(store.getState(), 'p1').deadlineHistory).toHaveLength(1);

    mockProjectsApi.complete.mockResolvedValueOnce({ badgeAwarded: true });
    await store.dispatch(completeProject({ id: 'p4', payload: { finalLink: 'https://example.com' } }));
    expect(selectProjectById(store.getState(), 'p4').isCompleted).toBe(true);

    // Removal checks, leave & close requests, templates, cancelDeletion
    mockProjectsApi.getRemovalCheck.mockResolvedValueOnce({ allowed: true });
    await store.dispatch(fetchRemovalCheck({ projectId: 'p1', userId: 'u2' }));
    expect(store.getState().projects.removalChecksById.p1.u2.allowed).toBe(true);

    mockProjectsApi.removeMember.mockResolvedValueOnce({ ok: true });
    mockProjectsApi.get.mockResolvedValueOnce({ id: 'p1', removedUsers: [{ userId: 'u2' }] });
    await store.dispatch(removeProjectMember({ projectId: 'p1', memberId: 'u2', reason: 'Inactive member removal' }));

    mockProjectsApi.submitLeaveRequest.mockResolvedValueOnce({ id: 'lr1', status: 'pending' });
    await store.dispatch(submitProjectLeaveRequest({ projectId: 'p1', payload: {} }));
    mockProjectsApi.getMyLeaveRequest.mockResolvedValueOnce({ id: 'lr1', status: 'pending' });
    await store.dispatch(fetchMyProjectLeaveRequest({ id: 'p1' }));
    mockProjectsApi.withdrawLeaveRequest.mockResolvedValueOnce({});
    await store.dispatch(withdrawProjectLeaveRequest({ projectId: 'p1' }));
    mockProjectsApi.requestClose.mockResolvedValueOnce({});
    await store.dispatch(requestCloseProject({ projectId: 'p1' }));
    mockProjectsApi.getTaskTemplatesByCategory.mockResolvedValueOnce({ category: 'Web App', items: [] });
    await store.dispatch(fetchTaskTemplatesByCategory('Web App'));
    mockProjectsApi.getProjectTaskTemplates.mockResolvedValueOnce({ category: 'Web App', items: [] });
    await store.dispatch(fetchProjectTaskTemplates({ id: 'p1' }));
    mockProjectsApi.cancelDeletion.mockResolvedValueOnce({ project: { id: 'p1', deletionScheduledAt: null } });
    await store.dispatch(cancelProjectDeletion({ id: 'p1' }));

    // Immediate delete removes p1 from entities AND every view ID list
    mockProjectsApi.checkDeletion.mockResolvedValueOnce({ mode: 'immediate', blockers: [] });
    await store.dispatch(checkProjectDeletion({ id: 'p1' }));
    expect(store.getState().projects.deletionChecksById.p1.mode).toBe('immediate');

    mockProjectsApi.softDelete.mockResolvedValueOnce({ deleted: true, mode: 'immediate' });
    await store.dispatch(deleteProject({ id: 'p1', payload: { confirmTitle: 'Updated P1' } }));
    expect(selectProjectById(store.getState(), 'p1')).toBeUndefined();
    expect(store.getState().projects.marketplaceIds).not.toContain('p1');
    expect(store.getState().projects.myProjectIds).not.toContain('p1');
    expect(store.getState().projects.myWorkOngoingIds).not.toContain('p1');
    expect(store.getState().projects.myWorkCompletedIds).not.toContain('p1');
  });

  it('Marketplace screen renders preloaded Redux projects and clears search filter on routeChanged', async () => {
    const p1 = { id: 'm1', title: 'AI Tutor', owner: 'Priya', ownerId: 'o1', status: 'Open', skills: ['React'] };
    const p2 = { id: 'm2', title: 'Drone Mesh', owner: 'Rohan', ownerId: 'o2', status: 'Open', skills: ['Rust'] };
    const p3 = { id: 'm3', title: 'Quantum Lab', owner: 'Neha', ownerId: 'o3', status: 'Open', skills: ['Python'] };

    mockProjectsApi.list.mockResolvedValue([p1, p2, p3]);

    const { store } = renderWithStore(
      <>
        <RouteResetListener />
        <Link to="/dashboard">Leave Market</Link>
        <Routes>
          <Route path="/projects" element={<ProjectsMarketplace />} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </>,
      {
        route: '/projects',
        preloadedState: {
          session: {
            user: { id: 'u-col', name: 'Collab' },
            isAuthenticated: true,
            status: 'authenticated',
          },
          projects: {
            ids: ['m1', 'm2', 'm3'],
            entities: { m1: p1, m2: p2, m3: p3 },
            marketplaceIds: ['m1', 'm2', 'm3'],
            myProjectIds: [],
            myWorkOngoingIds: [],
            myWorkCompletedIds: [],
            status: 'succeeded',
            lastFetchedAt: new Date().toISOString(),
            viewLastFetchedAt: {
              marketplace: new Date().toISOString(),
              myProjects: null,
              myWork: null,
            },
          },
        },
      },
    );

    expect(screen.getByText('AI Tutor')).toBeDefined();
    expect(screen.getByText('Quantum Lab')).toBeDefined();

    const searchInput = screen.getByPlaceholderText(/Search projects/i);
    fireEvent.change(searchInput, { target: { value: 'Quantum' } });
    expect(selectProjectsWorking(store.getState()).searchQuery).toBe('Quantum');
    expect(screen.queryByText('AI Tutor')).toBeNull();
    expect(screen.getByText('Quantum Lab')).toBeDefined();

    fireEvent.click(screen.getByText('Leave Market'));
    expect(selectProjectsWorking(store.getState()).searchQuery).toBe('');
    expect(selectMarketplaceProjects(store.getState())).toHaveLength(3);
  });

  it('My Projects displays all tabs with counts equal to list lengths from preloaded store', () => {
    const items = [
      { id: 'op1', title: 'Active Proj', ownerId: 'o1', owner: 'Priya', status: 'Open', isCompleted: false },
      { id: 'op2', title: 'Finished Proj', ownerId: 'o1', owner: 'Priya', status: 'Completed', isCompleted: true },
      { id: 'op3', title: 'Closed Proj', ownerId: 'o1', owner: 'Priya', status: 'Closed', closureReason: 'Inactive' },
    ];
    mockProjectsApi.list.mockResolvedValue(items);

    renderWithStore(
      <MyProjects />,
      {
        preloadedState: {
          session: {
            user: { id: 'o1', name: 'Priya', role: 'Project Owner' },
            isAuthenticated: true,
            status: 'authenticated',
            activeRole: 'Project Owner',
            allowedRoles: ['Project Owner'],
          },
          projects: {
            ids: ['op1', 'op2', 'op3'],
            entities: { op1: items[0], op2: items[1], op3: items[2] },
            marketplaceIds: [],
            myProjectIds: ['op1', 'op2', 'op3'],
            myWorkOngoingIds: [],
            myWorkCompletedIds: [],
            myProjectsStatus: 'succeeded',
            viewLastFetchedAt: {
              marketplace: null,
              myProjects: new Date().toISOString(),
              myWork: null,
            },
          },
        },
      },
    );

    expect(screen.getByRole('tab', { name: /All.*3/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Active.*1/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Completed.*1/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Closed.*1/i })).toBeDefined();
    expect(screen.getByText('Active Proj')).toBeDefined();
    expect(screen.getByText('Finished Proj')).toBeDefined();
    expect(screen.getByText('Closed Proj')).toBeDefined();
  });

  it('My Work displays Completed & Closed projects with Closed badge and closure reason from preloaded store', () => {
    const ongoing = [{ id: 'w1', title: 'Ongoing Work', status: 'In Progress' }];
    const completed = [
      { id: 'w2', title: 'Completed Work', status: 'Completed', isCompleted: true },
      { id: 'w3', title: 'Closed Work', status: 'Closed', closureReason: 'Owner paused' },
    ];

    renderWithStore(
      <MyWork />,
      {
        preloadedState: {
          session: {
            user: { id: 'c1', name: 'Arjun', role: 'Collaborator' },
            isAuthenticated: true,
            status: 'authenticated',
            activeRole: 'Collaborator',
            allowedRoles: ['Collaborator'],
          },
          projects: {
            ids: ['w1', 'w2', 'w3'],
            entities: { w1: ongoing[0], w2: completed[0], w3: completed[1] },
            marketplaceIds: [],
            myProjectIds: [],
            myWorkOngoingIds: ['w1'],
            myWorkCompletedIds: ['w2', 'w3'],
            summary: {
              marketplaceCount: 0,
              myProjectsTotalCount: 0,
              myProjectsActiveCount: 0,
              myProjectsCompletedCount: 0,
              myProjectsClosedCount: 0,
              myWorkOngoingCount: 1,
              myWorkCompletedCount: 2,
            },
            myWorkStatus: 'succeeded',
            viewLastFetchedAt: {
              marketplace: null,
              myProjects: null,
              myWork: new Date().toISOString(),
            },
          },
        },
      },
    );

    expect(screen.getByRole('tab', { name: /Ongoing \(1\)/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Completed \(2\)/i })).toBeDefined();

    fireEvent.click(screen.getByRole('tab', { name: /Completed \(2\)/i }));
    expect(screen.getByText('Completed Work')).toBeDefined();
    expect(screen.getByText('Closed Work')).toBeDefined();
    const banner = screen.getByTestId('project-card-closure-banner');
    expect(banner.textContent).toContain('Closed:');
    expect(banner.textContent).toContain('Owner paused');
  });

  it('Create Project dispatches createProject thunk on valid form submit and stores created entity', async () => {
    mockProjectsApi.create.mockResolvedValueOnce({
      id: 'proj-created-1',
      title: 'Redux Robotics Hub',
      ownerId: 'o1',
      status: 'Open',
    });

    const { store, container } = renderWithStore(
      <CreateProject />,
      {
        preloadedState: {
          session: {
            user: { id: 'o1', name: 'Priya' },
            isAuthenticated: true,
            status: 'authenticated',
          },
        },
      },
    );

    const longDesc =
      'A comprehensive robotics workspace project with collaborative telemetry, hardware testing, and autonomous path planning.';
    fireEvent.change(screen.getByPlaceholderText(/AI Campus Navigator/i), {
      target: { value: 'Redux Robotics Hub' },
    });
    fireEvent.change(screen.getByPlaceholderText(/at least 100 characters/i), {
      target: { value: longDesc },
    });
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    const dateInput = container.querySelector('input[type="date"], input[placeholder="DD/MM/YYYY"]');
    if (dateInput) {
      fireEvent.change(dateInput, { target: { value: futureDate } });
    }

    fireEvent.click(screen.getByRole('button', { name: /Create Project/i }));

    await waitFor(() => {
      expect(mockProjectsApi.create).toHaveBeenCalledTimes(1);
      expect(selectProjectById(store.getState(), 'proj-created-1')).toBeDefined();
      expect(store.getState().projects.myProjectIds).toContain('proj-created-1');
    });
  });
});
