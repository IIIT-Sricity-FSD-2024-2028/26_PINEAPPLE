import { JobsService } from './jobs.service';
import { ClockService } from '../common/services/clock.service';
import { ReputationService } from '../moderation/reputation.service';
import { Task } from '../tasks/tasks.repository';

describe('JobsService - Deadline Missed Penalties Unit Tests (Phase 4)', () => {
  let jobsService: JobsService;
  let fakeClock: ClockService;
  let reputationService: ReputationService;
  let tasks: Task[];
  let notificationsSent: any[];

  beforeEach(() => {
    // Start time: March 1st, 2026, 12:00:00 (noon)
    fakeClock = new ClockService();
    fakeClock.setTime('2026-03-01T12:00:00.000Z');

    const mockGamificationRepo: any = {
      addLedgerEntry: () => {},
    };
    const mockUsersRepo: any = {
      findAll: () => [],
    };
    reputationService = new ReputationService(fakeClock, mockGamificationRepo, mockUsersRepo);

    // Initial reputation baseline for user-collab = 100
    reputationService.recordSeed('user-collab', 100);

    // Task due on March 1st, 2026 at 23:59:59 (or 18:00:00)
    tasks = [
      {
        id: 'task-active-1',
        projectId: 'proj-1',
        title: 'Active In-Progress Task',
        status: 'In Progress',
        assigneeId: 'user-collab',
        dueDate: '2026-03-01T18:00:00.000Z',
      } as Task,
      {
        id: 'task-unassigned',
        projectId: 'proj-1',
        title: 'Unassigned Task',
        status: 'To Do',
        assigneeId: undefined,
        dueDate: '2026-03-01T18:00:00.000Z',
      } as Task,
      {
        id: 'task-submitted',
        projectId: 'proj-1',
        title: 'Submitted Task',
        status: 'In Review',
        assigneeId: 'user-collab',
        dueDate: '2026-03-01T18:00:00.000Z',
      } as Task,
      {
        id: 'task-approved',
        projectId: 'proj-1',
        title: 'Approved Task',
        status: 'Completed',
        assigneeId: 'user-collab',
        dueDate: '2026-03-01T18:00:00.000Z',
      } as Task,
    ];

    notificationsSent = [];
    const mockNotificationsService: any = {
      create: (n: any) => notificationsSent.push(n),
    };

    const mockTasksRepository: any = {
      findAll: () => tasks,
      findById: (id: string) => tasks.find((t) => t.id === id),
      update: (id: string, updates: any) => {
        const t = tasks.find((item) => item.id === id);
        if (t) {
          Object.assign(t, updates);
        }
        return t;
      },
    };

    const mockProjectsService: any = {
      closeProject: () => {},
    };
    const mockProjectsRepository: any = {
      findAll: () => [],
      update: () => {},
    };
    const mockJoinRequestsService: any = {
      findByProject: () => [],
    };
    const mockMentorMarketplaceService: any = {
      findAllSessions: () => [],
      expireSession: () => null,
    };
    const mockAuditService: any = {
      log: () => {},
    };

    jobsService = new JobsService(
      fakeClock,
      mockProjectsService,
      mockProjectsRepository,
      mockJoinRequestsService,
      mockNotificationsService,
      mockTasksRepository,
      reputationService,
      mockMentorMarketplaceService,
      mockAuditService,
    );
  });

  it('runs job before midnight: no penalty applied', async () => {
    // Current time: March 1st, 23:30:00 (before midnight)
    fakeClock.setTime('2026-03-01T23:30:00.000Z');

    const result = await jobsService.applyDeadlinePenalties();
    expect(result.penalizedTasks).toHaveLength(0);
    expect(reputationService.getReputation('user-collab')).toBe(100);
    expect(tasks[0].penaltyAppliedAt).toBeUndefined();
  });

  it('runs job after midnight (March 2nd 00:01:00): applies exactly one penalty of -5 reputation', async () => {
    // Current time: March 2nd, 00:01:00 (after midnight server time the day after)
    fakeClock.setTime('2026-03-02T00:01:00.000Z');

    const result = await jobsService.applyDeadlinePenalties();
    expect(result.penalizedTasks).toContain('task-active-1');
    expect(tasks[0].penaltyAppliedAt).toBeDefined();

    // Reputation dropped by 5: 100 - 5 = 95
    expect(reputationService.getReputation('user-collab')).toBe(95);

    // Notification was sent
    expect(notificationsSent.some((n) => n.userId === 'user-collab' && n.type === 'DEADLINE_MISSED')).toBe(true);
  });

  it('runs job again after midnight: no second penalty applied (idempotent)', async () => {
    fakeClock.setTime('2026-03-02T00:01:00.000Z');
    await jobsService.applyDeadlinePenalties();
    expect(reputationService.getReputation('user-collab')).toBe(95);

    // Run again 5 hours later
    fakeClock.setTime('2026-03-02T05:00:00.000Z');
    const result2 = await jobsService.applyDeadlinePenalties();
    expect(result2.penalizedTasks).toHaveLength(0);
    expect(reputationService.getReputation('user-collab')).toBe(95);
  });

  it('unassigned task carries no penalty', async () => {
    fakeClock.setTime('2026-03-02T00:01:00.000Z');
    const result = await jobsService.applyDeadlinePenalties();
    expect(result.penalizedTasks).not.toContain('task-unassigned');
  });

  it('submitted task (In Review) carries no penalty', async () => {
    fakeClock.setTime('2026-03-02T00:01:00.000Z');
    const result = await jobsService.applyDeadlinePenalties();
    expect(result.penalizedTasks).not.toContain('task-submitted');
    expect(tasks.find((t) => t.id === 'task-submitted')?.penaltyAppliedAt).toBeUndefined();
  });

  it('approved task (Completed) carries no penalty', async () => {
    fakeClock.setTime('2026-03-02T00:01:00.000Z');
    const result = await jobsService.applyDeadlinePenalties();
    expect(result.penalizedTasks).not.toContain('task-approved');
    expect(tasks.find((t) => t.id === 'task-approved')?.penaltyAppliedAt).toBeUndefined();
  });

  it('reassigned task penalises current assignee', async () => {
    reputationService.recordSeed('user-new-assignee', 50);

    // Reassign task-active-1 to user-new-assignee before deadline job runs
    tasks[0].assigneeId = 'user-new-assignee';

    fakeClock.setTime('2026-03-02T00:01:00.000Z');
    const result = await jobsService.applyDeadlinePenalties();
    expect(result.penalizedTasks).toContain('task-active-1');

    // Previous assignee is untouched
    expect(reputationService.getReputation('user-collab')).toBe(100);

    // Current assignee gets -5: 50 - 5 = 45
    expect(reputationService.getReputation('user-new-assignee')).toBe(45);
  });

  it('floors reputation at 0: user with 3 rep gets -5, result is 0 (not -2)', async () => {
    // User with baseline 3 reputation
    reputationService.recordSeed('user-low-rep', 3);
    expect(reputationService.getReputation('user-low-rep')).toBe(3);

    tasks.push({
      id: 'task-low-rep',
      projectId: 'proj-1',
      title: 'Low Rep Task',
      status: 'To Do',
      assigneeId: 'user-low-rep',
      dueDate: '2026-03-01T18:00:00.000Z',
    } as Task);

    fakeClock.setTime('2026-03-02T00:01:00.000Z');
    await jobsService.applyDeadlinePenalties();

    // Floored at 0!
    expect(reputationService.getReputation('user-low-rep')).toBe(0);
  });
});
