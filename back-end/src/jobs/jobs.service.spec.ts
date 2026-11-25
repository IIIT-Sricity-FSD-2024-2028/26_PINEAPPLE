import { JobsService } from './jobs.service';
import { ClockService } from '../common/services/clock.service';

function createSpy<T = any>(impl?: (...args: any[]) => any) {
  const calls: any[][] = [];
  const fn: any = (...args: any[]) => {
    calls.push(args);
    return impl ? impl(...args) : undefined;
  };
  fn.calls = calls;
  fn.reset = () => {
    calls.length = 0;
  };
  return fn;
}

describe('JobsService - Phase 3 Auto-Closing Empty Projects', () => {
  let jobsService: JobsService;
  let fakeClock: ClockService;
  let mockProjectsService: any;
  let mockProjectsRepository: any;
  let mockJoinRequestsService: any;
  let mockNotificationsService: any;

  let testProjects: any[] = [];
  let closeProjectSpy: any;
  let notifySpy: any;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.ALLOW_STORE_RESET = 'true';

    // Base start time: 2026-03-01T00:00:00.000Z
    fakeClock = new ClockService();
    fakeClock.setTime('2026-03-01T00:00:00.000Z');

    testProjects = [
      {
        id: 'proj-empty-1',
        title: 'Empty Project 1',
        ownerId: 'owner-1',
        status: 'Open',
        collaborators: [],
        createdAt: '2026-03-01T00:00:00.000Z',
      },
      {
        id: 'proj-with-collab',
        title: 'Collab Project',
        ownerId: 'owner-2',
        status: 'Open',
        collaborators: [{ id: 'collab-1', name: 'Collab' }],
        createdAt: '2026-03-01T00:00:00.000Z',
      },
    ];

    mockProjectsRepository = {
      findAll: () => testProjects,
      findById: (id: string) => testProjects.find((p) => p.id === id),
      update: (id: string, updates: any) => {
        const p = testProjects.find((item) => item.id === id);
        if (p) {
          Object.assign(p, updates);
        }
        return p;
      },
    };

    closeProjectSpy = createSpy((id: string, reason: string) => {
      const p = testProjects.find((item) => item.id === id);
      if (p) {
        p.status = 'Closed';
        p.closureReason = reason;
        p.closedAt = fakeClock.nowIso();
      }
      return p;
    });

    mockProjectsService = {
      closeProject: closeProjectSpy,
    };

    mockJoinRequestsService = {
      findByProject: () => [],
    };

    notifySpy = createSpy();
    mockNotificationsService = {
      create: notifySpy,
    };

    const mockTasksRepository: any = {
      findAll: () => [],
      findById: () => null,
      update: () => null,
    };

    const mockReputationService: any = {
      recordDeadlineMissed: createSpy(),
    };

    const mockMentorMarketplaceService: any = {
      findAllSessions: () => [],
      expireSession: createSpy(),
    };

    const mockAuditService: any = {
      log: createSpy(),
    };

    jobsService = new JobsService(
      fakeClock,
      mockProjectsService,
      mockProjectsRepository,
      mockJoinRequestsService,
      mockNotificationsService,
      mockTasksRepository,
      mockReputationService,
      mockMentorMarketplaceService,
      mockAuditService,
    );
  });

  it('Day 3 (72 hours): does not close projects or send reminders', async () => {
    fakeClock.advanceHours(72); // 3 days
    const result = await jobsService.closeEmptyProjects();

    expect(result.closedProjects).toHaveLength(0);
    expect(result.remindersSent).toHaveLength(0);
    expect(result.pausedProjects).toHaveLength(0);
    expect(notifySpy.calls).toHaveLength(0);
    expect(closeProjectSpy.calls).toHaveLength(0);
  });

  it('Day 4 (96 hours): sends Day 4 reminder once and does not send twice (idempotent)', async () => {
    fakeClock.advanceHours(96); // 4 days
    const result1 = await jobsService.closeEmptyProjects();

    expect(result1.remindersSent).toContain('proj-empty-1');
    expect(notifySpy.calls.length).toBeGreaterThanOrEqual(1);
    expect(notifySpy.calls[0][0].userId).toBe('owner-1');
    expect(notifySpy.calls[0][0].title).toBe('Project Inactivity Reminder');
    expect(testProjects[0].day4ReminderSentAt).toBeDefined();

    // Run a second time: reminder must not be sent again!
    notifySpy.reset();
    const result2 = await jobsService.closeEmptyProjects();
    expect(result2.remindersSent).toHaveLength(0);
    expect(notifySpy.calls).toHaveLength(0);
  });

  it('Day 5 (120 hours): closes empty project with reason "No applicants within 5 days"', async () => {
    fakeClock.advanceHours(120); // 5 days
    const result = await jobsService.closeEmptyProjects();

    expect(result.closedProjects).toContain('proj-empty-1');
    expect(closeProjectSpy.calls.length).toBe(1);
    expect(closeProjectSpy.calls[0][0]).toBe('proj-empty-1');
    expect(closeProjectSpy.calls[0][1]).toBe('No applicants within 5 days');
    expect(testProjects[0].status).toBe('Closed');

    // Running again does not re-close closed projects (idempotent)
    closeProjectSpy.reset();
    const result2 = await jobsService.closeEmptyProjects();
    expect(result2.closedProjects).toHaveLength(0);
    expect(closeProjectSpy.calls).toHaveLength(0);
  });

  it('Day 5 (120 hours): pending requests pause closing and remind owner to decide', async () => {
    // Add a pending request to proj-empty-1
    mockJoinRequestsService.findByProject = (id: string) => {
      if (id === 'proj-empty-1') {
        return [{ id: 'req-1', projectId: 'proj-empty-1', userId: 'applicant-1', status: 'pending' }];
      }
      return [];
    };

    fakeClock.advanceHours(120); // 5 days
    const result = await jobsService.closeEmptyProjects();

    // Project must NOT be closed!
    expect(result.closedProjects).toHaveLength(0);
    expect(closeProjectSpy.calls).toHaveLength(0);
    expect(result.pausedProjects).toContain('proj-empty-1');

    // Owner must be notified of paused auto-closing
    expect(notifySpy.calls.length).toBe(1);
    expect(notifySpy.calls[0][0].userId).toBe('owner-1');
    expect(notifySpy.calls[0][0].title).toBe('Pending Applications Require Decision');
    expect(testProjects[0].pendingReviewReminderSentAt).toBeDefined();

    // Running a second time does not re-notify (idempotent)
    notifySpy.reset();
    const result2 = await jobsService.closeEmptyProjects();
    expect(result2.pausedProjects).toContain('proj-empty-1');
    expect(notifySpy.calls).toHaveLength(0);
  });

  it('Day 5 (120 hours): project with approved collaborators is NEVER closed', async () => {
    fakeClock.advanceHours(120);
    const result = await jobsService.closeEmptyProjects();

    expect(result.closedProjects).not.toContain('proj-with-collab');
    expect(testProjects[1].status).toBe('Open');
  });

  it('tickHourly executes closeEmptyProjects idempotently', async () => {
    fakeClock.advanceHours(120);
    const tickResult = await jobsService.tickHourly();

    expect(tickResult.jobsExecuted).toContain('closeEmptyProjects');
    expect(testProjects[0].status).toBe('Closed');
  });
});
