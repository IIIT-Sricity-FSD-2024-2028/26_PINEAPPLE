import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Link, Route, Routes } from 'react-router-dom';
import { createAppStore } from '../index';
import tasksReducer, {
  addOne as addTaskOne,
  createInitialTasksState,
  removeOne as removeTaskOne,
  setAll as setAllTasks,
  setSelectedTaskId,
  setTaskFilters,
  updateOne as updateTaskOne,
} from '../slices/tasksSlice';
import actionFeedbackReducer, {
  addOne as addFeedbackOne,
  createInitialActionFeedbackState,
  removeOne as removeFeedbackOne,
  setAll as setAllFeedback,
  setFeedbackWorking,
  updateOne as updateFeedbackOne,
} from '../slices/actionFeedbackSlice';
import {
  selectFeedbackByEntity,
  selectReasonConfigByAction,
  selectReasonsForAction,
  selectReasonsStatus,
} from '../selectors/feedbackSelectors';
import {
  selectFilteredTasksByProjectId,
  selectTaskById,
  selectTasksByProjectId,
  selectTasksForbiddenForProject,
  selectTasksWorking,
} from '../selectors/tasksSelectors';
import {
  fetchEntityFeedback,
  fetchFeedbackReasons,
} from '../thunks/feedbackThunks';
import {
  addTaskComment,
  createTask,
  deleteTask,
  fetchTasksByProject,
  reviewTask,
  unassignTask,
  updateTask,
  updateTaskStatus,
} from '../thunks/tasksThunks';
import {
  releaseMemberTasks,
  removeProjectMember,
} from '../thunks/projectsThunks';
import { routeChanged } from '../actions/appActions';
import RouteResetListener from '../components/RouteResetListener';
import UniversalReasonModal from '../../components/common/UniversalReasonModal';
import FeedbackHistory from '../../components/features/FeedbackHistory';
import TaskCard from '../../components/features/TaskCard';
import { renderWithStore } from '../../test/test-utils';

const { mockTasksApi, mockFeedbackApi, mockProjectsApi } = vi.hoisted(() => ({
  mockTasksApi: {
    list: vi.fn(),
    listForProjects: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
    review: vi.fn(),
    unassign: vi.fn(),
    addComment: vi.fn(),
    remove: vi.fn(),
  },
  mockFeedbackApi: {
    getFeedbackReasons: vi.fn(),
    getEntityFeedback: vi.fn(),
    clearCache: vi.fn(),
  },
  mockProjectsApi: {
    get: vi.fn(),
    removeMember: vi.fn(),
    releaseMemberTasks: vi.fn(),
    getRemovalCheck: vi.fn(),
  },
}));

vi.mock('../../services/tasksApi', () => ({
  default: mockTasksApi,
  tasksApi: mockTasksApi,
}));

vi.mock('../../services/feedbackApi', () => ({
  default: mockFeedbackApi,
  feedbackApi: mockFeedbackApi,
  OTHER_REASON_ID: 'OTHER',
}));

vi.mock('../../services/projectsApi', () => ({
  default: mockProjectsApi,
  projectsApi: mockProjectsApi,
  isProjectLocked: () => false,
}));

describe('Phase 5: Tasks & Action Feedback (tasksSlice, actionFeedbackSlice)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Named CRUD Reducers (SPEC 2 & 3)', () => {
    it('supports setAll, addOne, updateOne, and removeOne on tasksSlice', () => {
      let state = createInitialTasksState();
      const t1 = { id: 't1', projectId: 'p1', title: 'Setup API', status: 'To Do' };
      const t2 = { id: 't2', projectId: 'p1', title: 'Write Tests', status: 'In Progress' };

      state = tasksReducer(state, setAllTasks([t1, t2]));
      expect(state.ids).toEqual(['t1', 't2']);
      expect(state.taskIdsByProject.p1).toEqual(['t1', 't2']);

      const t3 = { id: 't3', projectId: 'p1', title: 'Deploy', status: 'To Do' };
      state = tasksReducer(state, addTaskOne(t3));
      expect(state.ids).toEqual(['t1', 't2', 't3']);
      expect(state.taskIdsByProject.p1).toEqual(['t1', 't2', 't3']);

      state = tasksReducer(
        state,
        updateTaskOne({ id: 't2', changes: { status: 'In Review' } }),
      );
      expect(state.entities.t2.status).toBe('In Review');

      state = tasksReducer(state, removeTaskOne('t1'));
      expect(state.ids).toEqual(['t2', 't3']);
      expect(state.taskIdsByProject.p1).toEqual(['t2', 't3']);
    });

    it('supports setAll, addOne, updateOne, and removeOne on actionFeedbackSlice', () => {
      let state = createInitialActionFeedbackState();
      const f1 = {
        id: 'fb-1',
        entityType: 'TASK',
        entityId: 't1',
        actionType: 'REJECT_WORK',
        explanation: 'Add error handling.',
      };
      state = actionFeedbackReducer(state, setAllFeedback([f1]));
      expect(state.ids).toEqual(['fb-1']);
      expect(state.historyIdsByEntity['TASK:t1']).toEqual(['fb-1']);

      const f2 = {
        id: 'fb-2',
        entityType: 'TASK',
        entityId: 't1',
        actionType: 'DROP_TASK',
        explanation: 'Blocked by upstream dependency.',
      };
      state = actionFeedbackReducer(state, addFeedbackOne(f2));
      expect(state.historyIdsByEntity['TASK:t1']).toEqual(['fb-2', 'fb-1']);

      state = actionFeedbackReducer(
        state,
        updateFeedbackOne({
          id: 'fb-2',
          changes: { explanation: 'Updated explanation.' },
        }),
      );
      expect(state.entities['fb-2'].explanation).toBe('Updated explanation.');

      state = actionFeedbackReducer(state, removeFeedbackOne('fb-1'));
      expect(state.ids).toEqual(['fb-2']);
      expect(state.historyIdsByEntity['TASK:t1']).toEqual(['fb-2']);
    });
  });

  describe('2. Tasks Thunks, Optimistic Rollback, and 409 Review Rejection', () => {
    it('fetches, creates, updates, comments on, and deletes tasks through store', async () => {
      const store = createAppStore();
      mockTasksApi.list.mockResolvedValueOnce([
        { id: 't1', projectId: 'p1', title: 'Initial Task', status: 'To Do' },
      ]);
      await store.dispatch(fetchTasksByProject({ projectId: 'p1' }));
      expect(selectTasksByProjectId(store.getState(), 'p1')).toHaveLength(1);

      mockTasksApi.create.mockResolvedValueOnce({
        id: 't2',
        projectId: 'p1',
        title: 'Created Task',
        status: 'To Do',
      });
      await store.dispatch(
        createTask({ payload: { projectId: 'p1', title: 'Created Task' } }),
      );
      expect(selectTasksByProjectId(store.getState(), 'p1')).toHaveLength(2);

      mockTasksApi.update.mockResolvedValueOnce({
        id: 't2',
        projectId: 'p1',
        assigneeId: 'u-collab',
        assigneeName: 'Kiran Bose',
      });
      await store.dispatch(
        updateTask({
          id: 't2',
          payload: { assigneeId: 'u-collab', assigneeName: 'Kiran Bose' },
        }),
      );
      expect(selectTaskById(store.getState(), 't2').assigneeName).toBe('Kiran Bose');

      mockTasksApi.addComment.mockResolvedValueOnce({
        id: 'c-1',
        text: 'Looks promising',
        comments: [{ id: 'c-1', text: 'Looks promising' }],
      });
      await store.dispatch(
        addTaskComment({ id: 't2', payload: { text: 'Looks promising' } }),
      );
      expect(selectTaskById(store.getState(), 't2').comments).toHaveLength(1);

      mockTasksApi.remove.mockResolvedValueOnce({});
      await store.dispatch(
        deleteTask({ id: 't2', projectId: 'p1', role: 'Project Owner' }),
      );
      expect(mockTasksApi.remove).toHaveBeenCalledWith('t2', 'Project Owner');
      expect(selectTasksByProjectId(store.getState(), 'p1')).toHaveLength(1);
    });

    it('rolls back optimistic updateTaskStatus on rejection', async () => {
      const baseTask = {
        id: 't-opt',
        projectId: 'p1',
        title: 'Optimistic Status Task',
        status: 'To Do',
      };
      const store = createAppStore({
        preloadedState: {
          tasks: tasksReducer(undefined, setAllTasks([baseTask])),
        },
      });

      let rejectPromise;
      mockTasksApi.updateStatus.mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectPromise = reject;
          }),
      );

      const pendingAction = store.dispatch(
        updateTaskStatus({
          id: 't-opt',
          payload: { status: 'In Progress' },
          optimistic: true,
        }),
      );

      expect(selectTaskById(store.getState(), 't-opt').status).toBe('In Progress');

      rejectPromise({
        statusCode: 403,
        code: 'NOT_A_PROJECT_MEMBER',
        serverMessage: 'You are not a member of this project.',
      });
      await pendingAction;

      expect(selectTaskById(store.getState(), 't-opt').status).toBe('To Do');
      expect(selectTasksWorking(store.getState()).updateError.code).toBe(
        'NOT_A_PROJECT_MEMBER',
      );
    });

    it('leaves task unchanged and surfaces error when reviewTask is rejected with 409', async () => {
      const submittedTask = {
        id: 't-rev-409',
        projectId: 'p1',
        title: 'Payment Webhook Signature',
        status: 'In Review',
        submittedAt: '2026-11-20T10:00:00Z',
        inReviewSince: '2026-11-20T10:00:00Z',
      };
      const store = createAppStore({
        preloadedState: {
          tasks: tasksReducer(undefined, setAllTasks([submittedTask])),
        },
      });

      mockTasksApi.review.mockRejectedValueOnce({
        statusCode: 409,
        data: {
          code: 'PROJECT_EXTENSION_REQUIRED',
          message: 'Review credit extends due date past project deadline.',
          minProjectDueDate: '2026-12-05T00:00:00Z',
          reviewCreditMs: 259200000,
        },
      });

      const res = await store.dispatch(
        reviewTask({
          id: 't-rev-409',
          payload: { decision: 'reject', reason: 'Add HMAC timestamp verification tests.' },
          projectId: 'p1',
        }),
      );

      expect(res.meta.requestStatus).toBe('rejected');
      const storedTask = selectTaskById(store.getState(), 't-rev-409');
      expect(storedTask).toEqual(submittedTask);
      const err = selectTasksWorking(store.getState()).reviewError;
      expect(err.statusCode).toBe(409);
      expect(err.code).toBe('PROJECT_EXTENSION_REQUIRED');
      expect(err.minProjectDueDate).toBe('2026-12-05T00:00:00Z');
      expect(err.reviewCreditMs).toBe(259200000);
    });

    it('merges Review Time Credit fields & cascades fetchProjectById when project due date is extended', async () => {
      const store = createAppStore({
        preloadedState: {
          tasks: tasksReducer(
            undefined,
            setAllTasks([
              {
                id: 't-rev-ok',
                projectId: 'p-cascade',
                title: 'Search Endpoint',
                status: 'In Review',
              },
            ]),
          ),
        },
      });

      mockTasksApi.review.mockResolvedValueOnce({
        id: 't-rev-ok',
        projectId: 'p-cascade',
        status: 'To Do',
        rejectionReason: 'Add pagination edge-case assertions.',
        dueDateHistory: [
          {
            previousDueDate: '2026-11-28T00:00:00Z',
            newDueDate: '2026-12-02T00:00:00Z',
            reason: 'Review Time Credit applied',
            reviewCreditMs: 345600000,
          },
        ],
        extendedProjectDueDate: '2026-12-05T00:00:00Z',
      });
      mockProjectsApi.get.mockResolvedValueOnce({
        id: 'p-cascade',
        title: 'Cascade Project',
        dueDate: '2026-12-05T00:00:00Z',
      });

      await store.dispatch(
        reviewTask({
          id: 't-rev-ok',
          projectId: 'p-cascade',
          payload: {
            decision: 'reject',
            reason: 'Add pagination edge-case assertions.',
            extendedProjectDueDate: '2026-12-05T00:00:00Z',
            projectReason: 'Extending project deadline due to review credit.',
          },
        }),
      );

      const updated = selectTaskById(store.getState(), 't-rev-ok');
      expect(updated.status).toBe('To Do');
      expect(updated.rejectionReason).toBe('Add pagination edge-case assertions.');
      expect(updated.dueDateHistory).toHaveLength(1);
      expect(mockProjectsApi.get).toHaveBeenCalledWith('p-cascade');
      expect(store.getState().projects.entities['p-cascade'].dueDate).toBe(
        '2026-12-05T00:00:00Z',
      );
    });

    it('synchronizes tasks when removeProjectMember or releaseMemberTasks succeeds, and marks 403 task list forbidden', async () => {
      const store = createAppStore({
        preloadedState: {
          tasks: tasksReducer(
            undefined,
            setAllTasks([
              {
                id: 't-open',
                projectId: 'p1',
                assigneeId: 'u2',
                assignee: 'Maya',
                status: 'In Progress',
              },
              {
                id: 't-review',
                projectId: 'p1',
                assigneeId: 'u2',
                assignee: 'Maya',
                status: 'In Review',
              },
            ]),
          ),
        },
      });

      mockProjectsApi.releaseMemberTasks.mockResolvedValueOnce({
        released: 1,
        taskIds: ['t-open'],
      });
      await store.dispatch(releaseMemberTasks({ projectId: 'p1', memberId: 'u2' }));
      expect(selectTaskById(store.getState(), 't-open').status).toBe('To Do');
      expect(selectTaskById(store.getState(), 't-open').assigneeName).toBe('Unassigned');
      expect(selectTaskById(store.getState(), 't-review').status).toBe('In Review');

      mockProjectsApi.removeMember.mockRejectedValueOnce({
        statusCode: 409,
        data: {
          code: 'MEMBER_HAS_TASKS_IN_REVIEW',
          message: 'Member still has submitted tasks awaiting review.',
          blockers: [{ id: 't-review', title: 'Review Me' }],
        },
      });
      const removeAction = await store.dispatch(
        removeProjectMember({
          projectId: 'p1',
          memberId: 'u2',
          memberName: 'Maya',
          reason: 'Reassigning workload cleanly.',
        }),
      );
      expect(removeAction.meta.requestStatus).toBe('rejected');
      expect(removeAction.payload.code).toBe('MEMBER_HAS_TASKS_IN_REVIEW');
      expect(removeAction.payload.blockers).toEqual([{ id: 't-review', title: 'Review Me' }]);

      mockTasksApi.list.mockRejectedValueOnce({
        statusCode: 403,
        code: 'NOT_A_PROJECT_MEMBER',
        serverMessage: 'Forbidden',
      });
      await store.dispatch(fetchTasksByProject({ projectId: 'p-secret' }));
      expect(selectTasksForbiddenForProject(store.getState(), 'p-secret')).toBe(true);
    });

    it('handles unassignTask fulfillment and rejection cleanly', async () => {
      const store = createAppStore({
        preloadedState: {
          tasks: tasksReducer(
            undefined,
            setAllTasks([
              {
                id: 't-drop',
                projectId: 'p1',
                title: 'Drop Me',
                assigneeId: 'u2',
                assigneeName: 'Arjun',
                status: 'In Progress',
              },
            ]),
          ),
        },
      });

      mockTasksApi.unassign.mockResolvedValueOnce({
        id: 't-drop',
        projectId: 'p1',
        assigneeId: '',
        assigneeName: 'Unassigned',
        status: 'To Do',
      });

      await store.dispatch(
        unassignTask({
          id: 't-drop',
          payload: {
            reasons: ['SCOPE_CHANGE'],
            explanation: 'Moving focus to security critical path.',
          },
        }),
      );
      expect(selectTaskById(store.getState(), 't-drop').status).toBe('To Do');
      expect(selectTaskById(store.getState(), 't-drop').assigneeName).toBe('Unassigned');
    });
  });

  describe('3. Feedback Reasons Single-Fetch Caching & Entity Audit History', () => {
    it('fetches reasons config once and reuses across dispatches unless force: true', async () => {
      const store = createAppStore();
      mockFeedbackApi.getFeedbackReasons.mockResolvedValue({
        categories: { REJECT_WORK: 'TASK' },
        actions: {
          REJECT_WORK: {
            actionType: 'REJECT_WORK',
            title: 'Reject Submission',
            explanationRequired: true,
            explanationMin: 10,
            reasons: [{ id: 'INCOMPLETE_WORK', label: 'Incomplete work' }],
          },
        },
      });

      await store.dispatch(fetchFeedbackReasons());
      await store.dispatch(fetchFeedbackReasons());
      await store.dispatch(fetchFeedbackReasons());

      expect(mockFeedbackApi.getFeedbackReasons).toHaveBeenCalledTimes(1);
      expect(selectReasonsStatus(store.getState())).toBe('succeeded');
      expect(selectReasonsForAction(store.getState(), 'REJECT_WORK')).toEqual([
        { id: 'INCOMPLETE_WORK', label: 'Incomplete work' },
      ]);

      await store.dispatch(fetchFeedbackReasons({ force: true }));
      expect(mockFeedbackApi.getFeedbackReasons).toHaveBeenCalledTimes(2);
    });

    it('loads entity feedback audit history via fetchEntityFeedback', async () => {
      const store = createAppStore();
      mockFeedbackApi.getEntityFeedback.mockResolvedValueOnce([
        {
          id: 'hist-1',
          entityType: 'TASK',
          entityId: 't-99',
          actionType: 'REJECT_WORK',
          actorName: 'Priya Patel',
          reasonLabels: ['Missing Tests'],
          explanation: 'Need unit tests for offline case.',
        },
      ]);

      await store.dispatch(
        fetchEntityFeedback({ entityType: 'TASK', entityId: 't-99' }),
      );

      const history = selectFeedbackByEntity(store.getState(), 'TASK', 't-99');
      expect(history).toHaveLength(1);
      expect(history[0].actorName).toBe('Priya Patel');
    });
  });

  describe('4. Route-Leave Reset & Preloaded Store UI Verification', () => {
    it('clears task selection, filters, and working errors on routeChanged while keeping entities', () => {
      const store = createAppStore({
        preloadedState: {
          tasks: tasksReducer(
            undefined,
            setAllTasks([
              { id: 't1', projectId: 'p1', title: 'Alpha', status: 'To Do' },
              { id: 't2', projectId: 'p1', title: 'Beta', status: 'Completed' },
            ]),
          ),
        },
      });

      store.dispatch(setSelectedTaskId('t1'));
      store.dispatch(
        setTaskFilters({ statusFilter: 'completed', searchQuery: 'Beta' }),
      );
      store.dispatch(
        setFeedbackWorking({ activeActionType: 'REJECT_WORK', activeEntityKey: 'TASK:t1' }),
      );

      expect(selectFilteredTasksByProjectId(store.getState(), 'p1')).toHaveLength(1);
      expect(selectTasksWorking(store.getState()).selectedTaskId).toBe('t1');

      store.dispatch(
        routeChanged({ from: '/workspace/p1', to: '/my-work', group: 'my-work' }),
      );

      expect(selectTasksWorking(store.getState()).selectedTaskId).toBeNull();
      expect(selectTasksWorking(store.getState()).statusFilter).toBe('all');
      expect(selectTasksWorking(store.getState()).searchQuery).toBe('');
      expect(store.getState().actionFeedback.working.activeActionType).toBeNull();
      expect(selectTasksByProjectId(store.getState(), 'p1')).toHaveLength(2);
    });

    it('renders UniversalReasonModal options from preloaded store and dispatches tags + explanation', async () => {
      const preloadedReasonsState = actionFeedbackReducer(
        createInitialActionFeedbackState(),
        fetchFeedbackReasons.fulfilled(
          {
            actions: {
              REJECT_WORK: {
                actionType: 'REJECT_WORK',
                title: 'Reject Deliverable',
                description: 'Select reasons and explain revisions.',
                confirmLabel: 'Confirm Rejection',
                minReasons: 1,
                explanationRequired: true,
                explanationMin: 10,
                explanationMax: 500,
                reasons: [
                  { id: 'MISSING_TESTS', label: 'Missing Unit Tests' },
                  { id: 'EDGE_CASE_BUG', label: 'Edge Case Bug' },
                ],
              },
            },
          },
          'req-reasons',
        ),
      );

      const store = createAppStore({
        preloadedState: { actionFeedback: preloadedReasonsState },
      });

      const onClose = vi.fn();
      const onConfirm = vi.fn().mockResolvedValue({ id: 't1', status: 'To Do' });

      renderWithStore(
        <UniversalReasonModal
          isOpen={true}
          actionType="REJECT_WORK"
          entityName="Caching Layer"
          onClose={onClose}
          onConfirm={onConfirm}
        />,
        { store },
      );

      // Reused from preloaded store without triggering another API call
      expect(mockFeedbackApi.getFeedbackReasons).not.toHaveBeenCalled();
      expect(selectReasonConfigByAction(store.getState(), 'REJECT_WORK').title).toBe(
        'Reject Deliverable',
      );
      expect(screen.getByText('Missing Unit Tests')).toBeTruthy();

      fireEvent.click(screen.getByTestId('reason-chip-MISSING_TESTS'));
      fireEvent.change(screen.getByTestId('universal-reason-textarea'), {
        target: { value: 'Please add coverage for cache eviction edge cases.' },
      });
      fireEvent.click(screen.getByTestId('universal-reason-confirm-btn'));

      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalledWith({
          reasons: ['MISSING_TESTS'],
          explanation: 'Please add coverage for cache eviction edge cases.',
        });
      });
    });

    it('renders FeedbackHistory and TaskCard Review Time Credit history from preloaded store', () => {
      let feedbackState = createInitialActionFeedbackState();
      feedbackState = actionFeedbackReducer(
        feedbackState,
        setAllFeedback([
          {
            id: 'fh-1',
            entityType: 'TASK',
            entityId: 't-credit-1',
            actionType: 'REJECT_WORK',
            actorName: 'Priya Patel',
            reasonLabels: ['Missing Tests'],
            explanation: 'Add integration tests for timeout handling.',
            createdAt: '2026-11-21T12:00:00Z',
          },
        ]),
      );
      feedbackState = {
        ...feedbackState,
        entityLastFetchedAtByKey: {
          'TASK:t-credit-1': new Date().toISOString(),
        },
      };

      const storedTask = {
        id: 't-credit-1',
        projectId: 'p1',
        title: 'Webhook Retries',
        status: 'To Do',
        priority: 'High',
        dueDate: '2026-12-10T00:00:00Z',
        dueDateHistory: [
          {
            at: '2026-11-21T12:00:00Z',
            previousDueDate: '2026-12-07T00:00:00Z',
            newDueDate: '2026-12-10T00:00:00Z',
            reason: 'REVIEW_CREDIT',
            creditMs: 3 * 24 * 60 * 60 * 1000,
          },
        ],
      };

      const { store } = renderWithStore(
        <>
          <TaskCard task={storedTask} />
          <FeedbackHistory entityType="TASK" entityId="t-credit-1" />
        </>,
        {
          preloadedState: {
            session: {
              user: { id: 'u1', name: 'Owner' },
              isAuthenticated: true,
              status: 'authenticated',
            },
            tasks: tasksReducer(undefined, setAllTasks([storedTask])),
            actionFeedback: feedbackState,
          },
        },
      );

      expect(selectTaskById(store.getState(), 't-credit-1').dueDateHistory).toHaveLength(1);
      expect(screen.getByTestId('task-review-credit-badge-t-credit-1')).toBeTruthy();
      expect(screen.getByText(/Priya Patel/i)).toBeTruthy();
      expect(
        screen.getByText(/Add integration tests for timeout handling\./i),
      ).toBeTruthy();
    });

    it('resets working filters when navigating via RouteResetListener', () => {
      const store = createAppStore();
      store.dispatch(setSelectedTaskId('t-old'));
      store.dispatch(setTaskFilters({ statusFilter: 'in review', searchQuery: 'API' }));

      renderWithStore(
        <>
          <RouteResetListener />
          <Link to="/my-work">Go My Work</Link>
          <Routes>
            <Route path="/" element={<div>Workspace</div>} />
            <Route path="/workspace/p1" element={<div>Workspace</div>} />
            <Route path="/my-work" element={<div>My Work</div>} />
          </Routes>
        </>,
        {
          store,
          route: '/workspace/p1',
        },
      );

      expect(selectTasksWorking(store.getState()).selectedTaskId).toBe('t-old');
      fireEvent.click(screen.getByRole('link', { name: 'Go My Work' }));
      expect(selectTasksWorking(store.getState()).selectedTaskId).toBeNull();
      expect(selectTasksWorking(store.getState()).statusFilter).toBe('all');
      expect(selectTasksWorking(store.getState()).searchQuery).toBe('');
    });
  });
});
