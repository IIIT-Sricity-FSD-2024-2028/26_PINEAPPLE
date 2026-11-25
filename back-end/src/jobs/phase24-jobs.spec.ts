import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module';
import { MailService } from '../mail/mail.service';
import { ClockService } from '../common/services/clock.service';
import { JobsService } from './jobs.service';
import { JobRunsService } from './job-runs.service';
import { ProjectsService, isLiveProject } from '../projects/projects.service';
import { ProjectsRepository } from '../projects/projects.repository';
import { ProjectStatus } from '../projects/dto/create-project.dto';
import { TasksRepository } from '../tasks/tasks.repository';
import { TaskStatus } from '../tasks/dto/create-task.dto';
import { JoinRequestsService } from '../join-requests/join-requests.service';
import { ProjectInvitesService } from '../projects/invites.service';
import { MentorMarketplaceService } from '../mentor-marketplace/mentor-marketplace.service';
import { ReputationService } from '../moderation/reputation.service';
import { UsersRepository } from '../users/users.repository';
import { UserRole, UserStatus } from '../users/dto/create-user.dto';
import { AuditService } from '../audit/audit.service';
import { GamificationService } from '../gamification/gamification.service';
import { PlatformConfigService } from '../platform-config/platform-config.service';

describe('Phase 24 Jobs Unit Tests: isLiveProject & Time-Based Job Filtering', () => {
  let appRef: { close: () => Promise<void> };
  let clockService: ClockService;
  let jobsService: JobsService;
  let jobRunsService: JobRunsService;
  let projectsService: ProjectsService;
  let projectsRepo: ProjectsRepository;
  let tasksRepo: TasksRepository;
  let joinRequestsService: JoinRequestsService;
  let invitesService: ProjectInvitesService;
  let mentorService: MentorMarketplaceService;
  let reputationService: ReputationService;
  let usersRepo: UsersRepository;
  let auditService: AuditService;

  const longDesc =
    'A detailed engineering collaboration workspace for validating automated hourly lifecycle jobs and live-project filters cleanly.';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.ALLOW_STORE_RESET = 'true';
    process.env.SCHEDULER_ENABLED = 'false';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailService)
      .useValue({
        sendMail: async () => ({ success: true, mode: 'console', messageId: 'mock' }),
        sendVerificationEmail: async () => ({ success: true, mode: 'console', messageId: 'mock' }),
        sendPasswordResetEmail: async () => ({ success: true, mode: 'console', messageId: 'mock' }),
        sendWarningEmail: async () => ({ success: true, mode: 'console', messageId: 'mock' }),
        sendSuspensionEmail: async () => ({ success: true, mode: 'console', messageId: 'mock' }),
        sendAccountDeletionCodeEmail: async () => ({ success: true, mode: 'console', messageId: 'mock' }),
      })
      .compile();

    const app = moduleRef.createNestApplication();
    await app.init();
    appRef = app;

    clockService = app.get(ClockService);
    jobsService = app.get(JobsService);
    jobRunsService = app.get(JobRunsService);
    projectsService = app.get(ProjectsService);
    projectsRepo = app.get(ProjectsRepository);
    tasksRepo = app.get(TasksRepository);
    joinRequestsService = app.get(JoinRequestsService);
    invitesService = app.get(ProjectInvitesService);
    mentorService = app.get(MentorMarketplaceService);
    reputationService = app.get(ReputationService);
    usersRepo = app.get(UsersRepository);
    auditService = app.get(AuditService);
  });

  beforeEach(() => {
    projectsRepo.reset();
    tasksRepo.reset();
    joinRequestsService.reset();
    invitesService.reset();
    mentorService.resetLifecycle();
    usersRepo.reset();
    auditService.reset();
    reputationService.reset();
    reputationService.backfillStartupSeedUsers();
    jobRunsService.reset();
    clockService.setTime('2026-11-11T10:00:00.000Z');
  });

  afterAll(async () => {
    if (appRef) await appRef.close();
  });

  it('1. Non-live projects are skipped by closeEmptyProjects, whereas live empty open projects ARE auto-closed at day 5', async () => {
    expect(isLiveProject({ status: 'Closed' })).toBe(false);
    expect(isLiveProject({ status: 'Completed' })).toBe(false);
    expect(isLiveProject({ status: 'Cancelled' })).toBe(false);
    expect(isLiveProject({ status: 'Open', isCompleted: true })).toBe(false);
    expect(isLiveProject({ status: 'Open', deletedAt: '2026-11-10T00:00:00.000Z' })).toBe(false);
    expect(isLiveProject({ status: 'Open' })).toBe(true);
    expect(isLiveProject({ status: 'In Progress' })).toBe(true);
    expect(projectsService.isLiveProject({ status: 'Closed' })).toBe(false);

    const closedProj = projectsRepo.create(
      '1',
      {
        title: 'Closed Never Close Project',
        description: longDesc,
        status: ProjectStatus.Closed,
        collaborators: [],
        createdAt: clockService.nowIso(),
      } as any,
      ProjectStatus.Closed,
    );

    const openEmptyProj = projectsRepo.create(
      '1',
      {
        title: 'Published Empty Project',
        description: longDesc,
        status: ProjectStatus.Open,
        collaborators: [],
        createdAt: clockService.nowIso(),
      } as any,
      ProjectStatus.Open,
    );

    clockService.advanceDays(6);

    const run = await jobsService.runTick('manual');

    expect(projectsRepo.findById(closedProj.id)?.status).toBe(ProjectStatus.Closed);
    expect(projectsRepo.findById(openEmptyProj.id)?.status).toBe(ProjectStatus.Closed);

    // One JOB_SKIPPED_NOT_LIVE audit summary per run with counts only
    const skipAudits = auditService
      .findAll()
      .filter((a) => a.action === 'JOB_SKIPPED_NOT_LIVE');
    expect(skipAudits).toHaveLength(1);
    expect(skipAudits[0].entityId).toBe(run.id);
    expect(skipAudits[0].details.totalSkipped).toBeGreaterThanOrEqual(1);
    expect(skipAudits[0].details.byJob.closeEmptyProjects).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(skipAudits[0])).not.toContain('Closed Never Close Project');
  });

  it('2. Closed, Completed, and soft-deleted projects receive 0 deadline penalties & skip review/request/invite jobs; live task penalized at most once across runs', async () => {
    const collab = usersRepo.create({
      name: 'Deadline Test Member',
      username: 'deadline_mem',
      email: 'deadline.mem@test.local',
      password: 'Password@123',
      role: UserRole.Collaborator,
      status: UserStatus.Active,
    } as any);
    reputationService.recordSeed(collab.id, 100);

    const closedProj = projectsRepo.create(
      '1',
      {
        title: 'Closed Skip All',
        description: longDesc,
        status: ProjectStatus.Closed,
        collaborators: [{ id: collab.id, name: collab.name }],
        createdAt: clockService.nowIso(),
      } as any,
      ProjectStatus.Closed,
    );

    const completedProj = projectsRepo.create(
      '1',
      {
        title: 'Completed Skip All',
        description: longDesc,
        status: ProjectStatus.Open,
        isCompleted: true,
        collaborators: [{ id: collab.id, name: collab.name }],
        createdAt: clockService.nowIso(),
      } as any,
      ProjectStatus.Open,
    );

    const deletedProj = projectsRepo.create(
      '1',
      {
        title: 'Deleted Skip All',
        description: longDesc,
        status: ProjectStatus.Open,
        collaborators: [{ id: collab.id, name: collab.name }],
        createdAt: clockService.nowIso(),
      } as any,
      ProjectStatus.Open,
    );

    const liveProj = projectsRepo.create(
      '1',
      {
        title: 'Live Penalized Project',
        description: longDesc,
        status: ProjectStatus.Open,
        collaborators: [{ id: collab.id, name: collab.name }],
        createdAt: clockService.nowIso(),
      } as any,
      ProjectStatus.Open,
    );

    const dueIso = '2026-11-11T18:00:00.000Z';
    const reviewSinceIso = '2026-11-01T10:00:00.000Z';

    const tClosed = tasksRepo.create({
      projectId: closedProj.id,
      title: 'Closed Overdue Task',
      status: TaskStatus.InProgress,
      assigneeId: collab.id,
      dueDate: dueIso,
    } as any);
    const tCompleted = tasksRepo.create({
      projectId: completedProj.id,
      title: 'Completed Overdue Task',
      status: TaskStatus.ToDo,
      assigneeId: collab.id,
      dueDate: dueIso,
    } as any);
    const tDeleted = tasksRepo.create({
      projectId: deletedProj.id,
      title: 'Deleted Overdue Task',
      status: TaskStatus.InProgress,
      assigneeId: collab.id,
      dueDate: dueIso,
    } as any);
    const tDeletedReview = tasksRepo.create({
      projectId: deletedProj.id,
      title: 'Deleted InReview Task',
      status: TaskStatus.InReview,
      assigneeId: collab.id,
      inReviewSince: reviewSinceIso,
      proofUrl: 'https://github.com/example/pr/1',
    } as any);
    const tLive = tasksRepo.create({
      projectId: liveProj.id,
      title: 'Live Overdue Task',
      status: TaskStatus.InProgress,
      assigneeId: collab.id,
      dueDate: dueIso,
    } as any);

    // Pending join request submitted before project was soft-deleted
    const applicant2 = usersRepo.create({
      name: 'Req Applicant',
      username: 'req_app_jobs24',
      email: 'req.app.jobs24@test.local',
      password: 'Password@123',
      role: UserRole.Collaborator,
      status: UserStatus.Active,
    } as any);
    const deletedReq = await joinRequestsService.create({
      projectId: deletedProj.id,
      userId: applicant2.id,
      userName: applicant2.name,
      message: 'Please let me join this project before it gets deleted.',
      status: 'Pending',
      createdAt: '2026-10-01T00:00:00.000Z',
    } as any);

    // Soft-delete deletedProj afterwards -> hourly jobs must skip it and all its tasks/requests
    projectsRepo.update(deletedProj.id, {
      deletedAt: clockService.nowIso(),
      deletedBy: '1',
    } as any);

    // Advance past midnight next day -> live task misses deadline; non-live ones must skip!
    clockService.setTime('2026-11-12T02:00:00.000Z');

    const run1 = await jobsService.runTick('manual');
    // Second run with another hour elapsed
    clockService.advanceHours(2);
    // Simulate a task flag glitch: even if penaltyAppliedAt were missing, ledger uniqueness stops double penalty
    tasksRepo.update(tLive.id, { penaltyAppliedAt: undefined } as any);
    const run2 = await jobsService.runTick('manual');

    // Only tLive got penalized ONCE (-5 total: 100 -> 95)
    expect(reputationService.getTotal(collab.id)).toBe(95);
    const entries = reputationService.getEntries(collab.id).filter((e) => e.type === 'deadline_missed');
    expect(entries).toHaveLength(1);
    expect(entries[0].refId).toBe(tLive.id);

    // Non-live tasks never touched
    expect(tasksRepo.findById(tClosed.id)?.penaltyAppliedAt).toBeUndefined();
    expect(tasksRepo.findById(tCompleted.id)?.penaltyAppliedAt).toBeUndefined();
    expect(tasksRepo.findById(tDeleted.id)?.penaltyAppliedAt).toBeUndefined();
    expect(tasksRepo.findById(tDeletedReview.id)?.status).toBe(TaskStatus.InReview);
    expect(
      String(joinRequestsService.findAll().find((r) => r.id === deletedReq.id)?.status || '').toLowerCase(),
    ).toBe('pending');

    // Exactly ONE JOB_SKIPPED_NOT_LIVE audit log emitted per runTick()
    const skipLogs = auditService.findAll().filter((a) => a.action === 'JOB_SKIPPED_NOT_LIVE');
    expect(skipLogs).toHaveLength(2);
    expect(skipLogs.map((l) => l.entityId)).toEqual([run2.id, run1.id]);
    expect(skipLogs[0].details.byJob.applyDeadlinePenalties).toBeGreaterThanOrEqual(4);
    expect(skipLogs[0].details.byJob.reviewDeadlineJob).toBeGreaterThanOrEqual(1);
    expect(skipLogs[0].details.byJob.remindPendingRequests).toBeGreaterThanOrEqual(1);
  });
});
