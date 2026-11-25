import { JobRunsService } from './job-runs.service';
import { JobsService } from './jobs.service';
import { ClockService } from '../common/services/clock.service';
import { ConflictException } from '@nestjs/common';

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

describe('JobRunsService & Scheduler Unit Tests', () => {
  let fakeClock: ClockService;
  let jobRunsService: JobRunsService;

  beforeEach(() => {
    fakeClock = new ClockService();
    fakeClock.setTime('2026-03-01T12:00:00.000Z');
    jobRunsService = new JobRunsService(fakeClock);
  });

  it('1. Lock prevents overlap: concurrent tick rejected with 409 and active runId', () => {
    const run1 = jobRunsService.start('manual');
    expect(run1.status).toBe('running');
    expect(jobRunsService.isLockActive()).toBe(true);
    expect(jobRunsService.getActiveRunId()).toBe(run1.id);

    // Second start attempt must throw ConflictException with code JOB_ALREADY_RUNNING
    expect(() => jobRunsService.start('manual')).toThrow(ConflictException);

    try {
      jobRunsService.start('manual');
      fail('Expected ConflictException was not thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ConflictException);
      const res = err.getResponse();
      expect(res.code).toBe('JOB_ALREADY_RUNNING');
      expect(res.runId).toBe(run1.id);
    }

    // Finishing run1 releases the lock
    jobRunsService.finishRun(run1.id);
    expect(jobRunsService.isLockActive()).toBe(false);
    expect(jobRunsService.getActiveRunId()).toBeNull();

    // Now a subsequent run can start cleanly
    const run2 = jobRunsService.start('cron');
    expect(run2.status).toBe('running');
    expect(run2.id).not.toBe(run1.id);
    jobRunsService.finishRun(run2.id);
  });

  it('2. One failing job does not stop the next: errors are logged and status is partial', async () => {
    // Setup JobsService with a failing job 1, but succeeding jobs 2 and 3
    const mockProjectsService: any = {
      closeProject: () => {
        throw new Error('Database connection timeout in closeProject');
      },
    };
    const mockProjectsRepository: any = {
      findAll: () => [
        {
          id: 'proj-error',
          title: 'Error Project',
          ownerId: 'owner-err',
          status: 'Open',
          collaborators: [],
          createdAt: '2026-02-20T00:00:00.000Z',
        },
      ],
      update: createSpy(),
    };
    const mockJoinRequestsService: any = {
      findByProject: () => [],
    };
    const mockNotificationsService: any = {
      create: createSpy(),
    };
    const mockTasksRepository: any = {
      findAll: () => [],
    };
    const mockReputationService: any = {
      recordDeadlineMissed: createSpy(),
    };
    const mockMentorMarketplaceService: any = {
      findAllSessions: () => [
        {
          id: 'session-exp',
          status: 'escrow_funded',
          createdAt: '2026-02-20T00:00:00.000Z',
          respondBy: '2026-02-23T00:00:00.000Z',
        },
      ],
      expireSession: createSpy(() => true),
      expireStalePaymentPendingSessions: () => ({ expiredSessions: [] }),
    };
    const mockAuditService: any = {
      log: createSpy(),
    };

    const jobsService = new JobsService(
      fakeClock,
      mockProjectsService,
      mockProjectsRepository,
      mockJoinRequestsService,
      mockNotificationsService,
      mockTasksRepository,
      mockReputationService,
      mockMentorMarketplaceService,
      mockAuditService,
      jobRunsService,
    );

    // Run tick
    const run = await jobsService.runTick('manual');

    // Job 1 had an error and itemsProcessed = 0
    // Job 2 succeeded with itemsProcessed = 1
    // Job 3 succeeded with itemsProcessed = 0
    expect(run.status).toBe('partial');
    expect(run.jobs).toHaveLength(21);

    const closeJob = run.jobs.find((j) => j.name === 'closeEmptyProjects');
    expect(closeJob).toBeDefined();

    const expireJob = run.jobs.find((j) => j.name === 'expireMentorRequests');
    expect(expireJob).toBeDefined();
    expect(expireJob!.itemsProcessed).toBe(1);
    expect(expireJob!.errors).toHaveLength(0);

    // Lock was released properly despite the failure
    expect(jobRunsService.isLockActive()).toBe(false);
  });

  it('3. Run record has correct counts and per-job details', () => {
    const run = jobRunsService.start('cron');

    jobRunsService.finishJob(run.id, {
      name: 'closeEmptyProjects',
      itemsProcessed: 2,
      errors: [],
    });

    jobRunsService.finishJob(run.id, {
      name: 'expireMentorRequests',
      itemsProcessed: 1,
      errors: [],
    });

    jobRunsService.finishJob(run.id, {
      name: 'applyDeadlinePenalties',
      itemsProcessed: 5,
      errors: [],
    });

    fakeClock.advanceTime(3000);
    const finishedRun = jobRunsService.finishRun(run.id);

    expect(finishedRun.status).toBe('success');
    expect(finishedRun.trigger).toBe('cron');
    expect(finishedRun.durationMs).toBe(3000);
    expect(finishedRun.jobs).toHaveLength(3);
    expect(finishedRun.jobs[0].itemsProcessed).toBe(2);
    expect(finishedRun.jobs[1].itemsProcessed).toBe(1);
    expect(finishedRun.jobs[2].itemsProcessed).toBe(5);

    const fetched = jobRunsService.findById(run.id);
    expect(fetched).toEqual(finishedRun);
  });

  it('4. Log keeps only the latest 200 runs', () => {
    for (let i = 0; i < 205; i++) {
      const run = jobRunsService.start('cron');
      jobRunsService.finishJob(run.id, {
        name: 'testJob',
        itemsProcessed: i,
        errors: [],
      });
      jobRunsService.finishRun(run.id);
    }

    const runsList = jobRunsService.list(300);
    expect(runsList.length).toBe(200);

    // Newest run should be the first item in the list
    expect(runsList[0].jobs[0].itemsProcessed).toBe(204);
  });

  it('5. The 5-day no-applicant close job run twice closes the project once (idempotent)', async () => {
    const testProjects = [
      {
        id: 'proj-empty-idemp',
        title: 'Empty Project Idempotency Test',
        ownerId: 'owner-idemp',
        status: 'Open',
        collaborators: [],
        createdAt: '2026-03-01T00:00:00.000Z',
      },
    ];

    let closeCallCount = 0;
    const mockProjectsService: any = {
      closeProject: (id: string, reason: string) => {
        closeCallCount++;
        const p = testProjects.find((x) => x.id === id);
        if (p) {
          p.status = 'Closed';
          (p as any).closureReason = reason;
        }
      },
    };

    const mockProjectsRepository: any = {
      findAll: () => testProjects,
      update: (id: string, updates: any) => {
        const p = testProjects.find((x) => x.id === id);
        if (p) Object.assign(p, updates);
        return p;
      },
    };

    const mockJoinRequestsService: any = {
      findByProject: () => [],
    };
    const mockNotificationsService: any = {
      create: createSpy(),
    };
    const mockTasksRepository: any = {
      findAll: () => [],
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

    const jobsService = new JobsService(
      fakeClock,
      mockProjectsService,
      mockProjectsRepository,
      mockJoinRequestsService,
      mockNotificationsService,
      mockTasksRepository,
      mockReputationService,
      mockMentorMarketplaceService,
      mockAuditService,
      jobRunsService,
    );

    // Advance 5 days (120 hours)
    fakeClock.advanceHours(120);

    // Pass 1: Project should close
    const result1 = await jobsService.closeEmptyProjects();
    expect(result1.closedProjects).toContain('proj-empty-idemp');
    expect(closeCallCount).toBe(1);
    expect(testProjects[0].status).toBe('Closed');

    // Pass 2: Project is already Closed -> should NOT close again!
    const result2 = await jobsService.closeEmptyProjects();
    expect(result2.closedProjects).toHaveLength(0);
    expect(closeCallCount).toBe(1);
  });

  it('Phase 11: remindPendingRequests sends reminder once for pending requests > 3 days', async () => {
    const notifications: any[] = [];
    const mockNotifs: any = {
      create: (n: any) => notifications.push(n),
    };

    const nowTime = fakeClock.now().getTime();
    const reqs: any[] = [
      {
        id: 'req-old',
        projectId: 'proj-1',
        status: 'pending',
        createdAt: new Date(nowTime - 4 * 24 * 3600 * 1000).toISOString(), // 4 days old
        userName: 'Applicant 1',
      },
      {
        id: 'req-fresh',
        projectId: 'proj-1',
        status: 'pending',
        createdAt: new Date(nowTime - 1 * 24 * 3600 * 1000).toISOString(), // 1 day old
        userName: 'Applicant 2',
      },
    ];

    const mockJoinReqs: any = {
      findAll: () => reqs,
      update: (id: string, patch: any) => {
        const r = reqs.find((item) => item.id === id);
        if (r) Object.assign(r, patch);
      },
    };

    const mockProjService: any = {
      findById: () => ({ id: 'proj-1', ownerId: 'owner-99', title: 'Test Project' }),
    };

    const jobsService = new JobsService(
      fakeClock,
      mockProjService,
      {} as any,
      mockJoinReqs,
      mockNotifs,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      jobRunsService,
    );

    // Pass 1: Old request > 3 days receives reminder
    const res1 = await jobsService.remindPendingRequests();
    expect(res1.remindedRequests).toContain('req-old');
    expect(res1.remindedRequests).not.toContain('req-fresh');
    expect(notifications).toHaveLength(1);
    expect(notifications[0].userId).toBe('owner-99');
    expect(notifications[0].type).toBe('JOIN_REQUEST_REMINDER');

    // Pass 2: Running again should NOT remind req-old a second time
    const res2 = await jobsService.remindPendingRequests();
    expect(res2.remindedRequests).toHaveLength(0);
    expect(notifications).toHaveLength(1); // unchanged
  });
});
