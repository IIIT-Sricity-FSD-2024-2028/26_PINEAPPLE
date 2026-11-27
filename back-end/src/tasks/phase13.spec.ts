import { Test } from '@nestjs/testing';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { AppModule } from '../app.module';
import { MailService } from '../mail/mail.service';
import { ClockService } from '../common/services/clock.service';
import { JobsService } from '../jobs/jobs.service';
import { JobRunsService } from '../jobs/job-runs.service';
import { ProjectsService } from '../projects/projects.service';
import { ProjectsRepository } from '../projects/projects.repository';
import { TasksService } from './tasks.service';
import { TasksRepository } from './tasks.repository';
import { TaskStatus } from './dto/create-task.dto';
import { UsersRepository } from '../users/users.repository';
import { NotificationsService } from '../notifications/notifications.service';
import { GamificationService } from '../gamification/gamification.service';
import { GamificationRepository } from '../gamification/gamification.repository';
import { SuspensionConsequencesService } from '../moderation/suspension-consequences.service';

describe('Phase 13 Unit Tests: Task Review, Retention, Review Deadlines, Unassign & Field Whitelist', () => {
  let tasksService: TasksService;
  let tasksRepo: TasksRepository;
  let projectsService: ProjectsService;
  let projectsRepo: ProjectsRepository;
  let jobsService: JobsService;
  let jobRunsService: JobRunsService;
  let clockService: ClockService;
  let usersRepo: UsersRepository;
  let notificationsService: NotificationsService;
  let gamificationService: GamificationService;
  let gamificationRepo: GamificationRepository;
  let suspensionService: SuspensionConsequencesService;
  let appRef: { close: () => Promise<void> };

  const mailMock = {
    onModuleInit: async () => {},
    initializeTransport: async () => {},
    sendPasswordResetEmail: async () => ({ success: true, mode: 'console' as const }),
    sendMail: async () => ({ success: true, mode: 'console' as const }),
    sendWarningEmail: async () => ({ success: true, mode: 'console' as const }),
    sendSuspensionEmail: async () => ({ success: true, mode: 'console' as const }),
  };

  beforeAll(async () => {
    process.env.SCHEDULER_ENABLED = 'false';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailService)
      .useValue(mailMock)
      .compile();

    const app = moduleRef.createNestApplication();
    await app.init();
    appRef = app;

    tasksService = app.get(TasksService);
    tasksRepo = app.get(TasksRepository);
    projectsService = app.get(ProjectsService);
    projectsRepo = app.get(ProjectsRepository);
    jobsService = app.get(JobsService);
    jobRunsService = app.get(JobRunsService);
    clockService = app.get(ClockService);
    usersRepo = app.get(UsersRepository);
    notificationsService = app.get(NotificationsService);
    gamificationService = app.get(GamificationService);
    gamificationRepo = app.get(GamificationRepository);
    suspensionService = app.get(SuspensionConsequencesService);
  });

  beforeEach(() => {
    usersRepo.reset();
    projectsRepo.reset();
    tasksRepo.reset();
    gamificationRepo.reset();
    notificationsService.reset();
    jobRunsService.reset();
    clockService.setTime('2026-11-11T12:00:00.000Z');
  });

  afterAll(async () => {
    await appRef?.close();
  });

  it('1. Rejection reason boundary validation (9 fails, 10 passes, 500 passes, 501 fails) and resubmission clears visible reason but keeps history', () => {
    const proj = projectsService.create('1', {
      title: 'Review Validation Project',
      description: 'Testing rejection reason length bounds and history when sending tasks back to collaborators for revisions during review.',
      teamSize: 4,
      dueDate: '2027-06-01T00:00:00.000Z',
    });
    projectsService.addCollaborator(proj.id, { id: '2', name: 'Arjun Sharma', role: 'Collaborator' });

    const task = tasksService.create({
      projectId: proj.id,
      title: 'Build Auth Filter',
      assigneeId: '2',
      assigneeName: 'Arjun Sharma',
      status: TaskStatus.InReview,
      proofLink: 'https://github.com/org/repo/pull/10',
      dueDate: '2027-05-01T00:00:00.000Z',
    });

    // 9 chars -> 400 REASON_REQUIRED
    expect(() =>
      tasksService.reviewTask(task.id, { decision: 'reject', reason: '123456789' }, '1', 'project-owner'),
    ).toThrow(BadRequestException);

    // 501 chars -> 400 REASON_REQUIRED
    expect(() =>
      tasksService.reviewTask(task.id, { decision: 'reject', reason: 'a'.repeat(501) }, '1', 'project-owner'),
    ).toThrow(BadRequestException);

    // 10 chars -> accepted & stored with history and notification
    const rej10 = tasksService.reviewTask(task.id, { decision: 'reject', reason: '1234567890' }, '1', 'project-owner');
    expect(rej10.status).toBe(TaskStatus.ToDo);
    expect(rej10.rejectionReason).toBe('1234567890');
    expect(rej10.rejectedBy).toBe('1');
    expect(rej10.rejectedAt).toBeDefined();
    expect(rej10.rejectionHistory).toHaveLength(1);

    // Collaborator resubmits -> visible rejectionReason cleared, history retained
    clockService.advanceHours(2);
    const resubmitted = tasksService.updateStatus(
      task.id,
      { status: TaskStatus.InReview, proofLink: 'https://github.com/org/repo/pull/11' },
      '2',
      'collaborator',
    );
    expect(resubmitted.rejectionReason).toBeUndefined();
    expect(resubmitted.rejectionHistory).toHaveLength(1);
    expect(resubmitted.inReviewSince).toBe(clockService.nowIso());

    // 500 chars -> accepted & appended to history (length 2)
    const reason500 = 'b'.repeat(500);
    const rej500 = tasksService.reviewTask(task.id, { decision: 'reject', reason: reason500 }, '1', 'project-owner');
    expect(rej500.rejectionReason).toBe(reason500);
    expect(rej500.rejectionHistory).toHaveLength(2);
  });

  it('2. Member leave and suspension share one release path: In Review tasks & proof stay; Open/In Progress reset; departed member can be approved for XP', async () => {
    const proj = projectsService.create('1', {
      title: 'Departure Retention Project',
      description: 'Verify leave and suspension treat In Review tasks identically so proofs remain intact and departed users earn XP on approval.',
      teamSize: 4,
      dueDate: '2027-06-01T00:00:00.000Z',
    });
    projectsService.addCollaborator(proj.id, { id: '2', name: 'Arjun Sharma', role: 'Collaborator' });
    projectsService.addCollaborator(proj.id, { id: '7', name: 'Neha Gupta', role: 'Collaborator' });

    const arjunTodo = tasksService.create({
      projectId: proj.id,
      title: 'Arjun Open Task',
      assigneeId: '2',
      assigneeName: 'Arjun Sharma',
      status: TaskStatus.ToDo,
      dueDate: '2027-05-01T00:00:00.000Z',
    });
    const arjunReview = tasksService.create({
      projectId: proj.id,
      title: 'Arjun Submitted Work',
      assigneeId: '2',
      assigneeName: 'Arjun Sharma',
      status: TaskStatus.InReview,
      proofLink: 'https://github.com/org/repo/pull/42',
      priority: 'High',
      dueDate: '2027-05-01T00:00:00.000Z',
    });

    // User 2 leaves project
    projectsService.leaveProject(proj.id, '2', {
      category: 'Too busy',
      reason: 'Need to focus on exams this month.',
    });

    expect(tasksService.findById(arjunTodo.id).assignee).toBe('Unassigned');
    expect(tasksService.findById(arjunTodo.id).status).toBe(TaskStatus.ToDo);

    const reviewAfterLeave = tasksService.findById(arjunReview.id);
    expect(reviewAfterLeave.status).toBe(TaskStatus.InReview);
    expect(reviewAfterLeave.assigneeId).toBe('2');
    expect(reviewAfterLeave.proofLink).toBe('https://github.com/org/repo/pull/42');

    // Owner approves departed member's In Review task -> XP credited to User 2
    const xpBefore = gamificationService.getUserStats('2').totalXp;
    tasksService.reviewTask(arjunReview.id, { decision: 'approve' }, '1', 'project-owner');
    expect(gamificationService.getUserStats('2').totalXp).toBe(xpBefore + 40);

    // Now test suspension path on User 7
    const nehaProg = tasksService.create({
      projectId: proj.id,
      title: 'Neha In Progress Task',
      assigneeId: '7',
      assigneeName: 'Neha Gupta',
      status: TaskStatus.InProgress,
      dueDate: '2027-05-01T00:00:00.000Z',
    });
    const nehaReview = tasksService.create({
      projectId: proj.id,
      title: 'Neha In Review Work',
      assigneeId: '7',
      assigneeName: 'Neha Gupta',
      status: TaskStatus.InReview,
      proofLink: 'https://github.com/org/repo/pull/77',
      dueDate: '2027-05-01T00:00:00.000Z',
    });

    await suspensionService.handleSuspension('7', 'Policy violation');
    expect(tasksService.findById(nehaProg.id).assignee).toBe('Unassigned');
    expect(tasksService.findById(nehaProg.id).status).toBe(TaskStatus.ToDo);
    expect(tasksService.findById(nehaReview.id).status).toBe(TaskStatus.InReview);
    expect(tasksService.findById(nehaReview.id).assigneeId).toBe('7');
    expect(tasksService.findById(nehaReview.id).proofLink).toBe('https://github.com/org/repo/pull/77');
  });

  it('3. reviewDeadlineJob: day-3 reminder once, day-7 auto-approve awards XP once, idempotent second run, skips bad proof URLs', async () => {
    const proj = projectsService.create('1', {
      title: 'Auto Approve Job Project',
      description: 'Testing 3d reminder, 7d auto-approve, idempotency, and bad URL block when owners delay task review decisions.',
      teamSize: 4,
      dueDate: '2027-06-01T00:00:00.000Z',
    });
    projectsService.addCollaborator(proj.id, { id: '2', name: 'Arjun Sharma', role: 'Collaborator' });

    const goodTask = tasksService.create({
      projectId: proj.id,
      title: 'Valid Proof Submission',
      assigneeId: '2',
      assigneeName: 'Arjun Sharma',
      priority: 'High',
      status: TaskStatus.InReview,
      proofLink: 'https://github.com/org/repo/pull/99',
      dueDate: '2027-05-01T00:00:00.000Z',
    });

    const badProofTask = tasksService.create({
      projectId: proj.id,
      title: 'Unsafe Proof Submission',
      assigneeId: '2',
      assigneeName: 'Arjun Sharma',
      priority: 'High',
      status: TaskStatus.InProgress,
      dueDate: '2027-05-01T00:00:00.000Z',
    });
    // Verify immediate reminder delivery on Day 3
    // Force an unsafe proof URL directly into repository state
    tasksRepo.update(badProofTask.id, {
      status: TaskStatus.InReview,
      proofLink: 'javascript:alert(1)',
      inReviewSince: clockService.nowIso(),
    } as any);

    // Day 3 + 1h -> sends reminder once to owner
    clockService.advanceDays(3);
    clockService.advanceHours(1);
    const runDay3 = await jobsService.reviewDeadlineJob();
    expect(runDay3.remindedTasks).toContain(goodTask.id);
    expect(runDay3.autoApprovedTasks).toHaveLength(0);

    // Re-running right away sends no duplicate reminder
    const runDay3Repeat = await jobsService.reviewDeadlineJob();
    expect(runDay3Repeat.remindedTasks).not.toContain(goodTask.id);
    const ownerReminders = notificationsService
      .findByUser('1')
      .filter((n) => n.type === 'TASK_REVIEW_REMINDER' && n.metadata?.taskId === goodTask.id);
    expect(ownerReminders).toHaveLength(1);

    // Day 7 -> auto-approves goodTask, credits XP once, skips badProofTask
    const xpBefore = gamificationService.getUserStats('2').totalXp;
    clockService.advanceDays(4);
    const runDay7 = await jobsService.reviewDeadlineJob();
    expect(runDay7.autoApprovedTasks).toContain(goodTask.id);
    expect(runDay7.skippedBadProofTasks).toContain(badProofTask.id);

    const approvedTask = tasksService.findById(goodTask.id);
    expect(approvedTask.status).toBe(TaskStatus.Completed);
    expect(approvedTask.autoApproved).toBe(true);
    expect(approvedTask.xpAwarded).toBe(true);
    expect(gamificationService.getUserStats('2').totalXp).toBe(xpBefore + 40);

    // Bad URL task stayed In Review with no XP awarded
    expect(tasksService.findById(badProofTask.id).status).toBe(TaskStatus.InReview);
    expect(tasksService.findById(badProofTask.id).xpAwarded).toBeUndefined();

    // Idempotent second run -> no duplicate XP
    const runDay7Repeat = await jobsService.reviewDeadlineJob();
    expect(runDay7Repeat.autoApprovedTasks).not.toContain(goodTask.id);
    expect(gamificationService.getUserStats('2').totalXp).toBe(xpBefore + 40);
  });

  it('4. Late unassign requires 10-300 char reason (<24h); early unassign (>24h) needs no reason; whitelist blocks collaborator dueDate', () => {
    const proj = projectsService.create('1', {
      title: 'Unassign & Whitelist Project',
      description: 'Testing late unassign reason and dueDate role whitelist to protect collaborator schedules and owner authority.',
      teamSize: 4,
      dueDate: '2027-06-01T00:00:00.000Z',
    });
    projectsService.addCollaborator(proj.id, { id: '2', name: 'Arjun Sharma', role: 'Collaborator' });

    const lateDueIso = new Date(clockService.now().getTime() + 12 * 60 * 60 * 1000).toISOString();
    const earlyDueIso = new Date(clockService.now().getTime() + 72 * 60 * 60 * 1000).toISOString();

    const earlyTask = tasksService.create({
      projectId: proj.id,
      title: 'Early Drop Task',
      assigneeId: '2',
      assigneeName: 'Arjun Sharma',
      status: TaskStatus.InProgress,
      dueDate: earlyDueIso,
    });
    const earlyDropped = tasksService.unassignTask(earlyTask.id, undefined, '2', 'collaborator');
    expect(earlyDropped.assignee).toBe('Unassigned');
    expect(earlyDropped.status).toBe(TaskStatus.ToDo);

    const lateTask = tasksService.create({
      projectId: proj.id,
      title: 'Urgent Deadline Task',
      assigneeId: '2',
      assigneeName: 'Arjun Sharma',
      status: TaskStatus.InProgress,
      dueDate: lateDueIso,
    });

    // Whitelist rejects dueDate from collaborator with 403 FORBIDDEN_FIELD
    let caughtForbidden: any;
    try {
      tasksService.update(lateTask.id, { dueDate: earlyDueIso }, '2', 'collaborator');
    } catch (err) {
      caughtForbidden = err;
    }
    expect(caughtForbidden).toBeInstanceOf(ForbiddenException);
    expect(caughtForbidden.getResponse()).toMatchObject({ code: 'FORBIDDEN_FIELD' });

    // Owner CAN update dueDate
    const ownerMoved = tasksService.update(lateTask.id, { dueDate: earlyDueIso }, '1', 'project-owner');
    expect(ownerMoved.dueDate).toBe(earlyDueIso);

    // Move another task inside 24h to test late unassign error & success
    const urgentTask = tasksService.create({
      projectId: proj.id,
      title: 'Real Urgent Task',
      assigneeId: '2',
      assigneeName: 'Arjun Sharma',
      status: TaskStatus.InProgress,
      dueDate: lateDueIso,
    });

    expect(() => tasksService.unassignTask(urgentTask.id, 'too short', '2', 'collaborator')).toThrow(BadRequestException);
    expect(() => tasksService.unassignTask(urgentTask.id, 'x'.repeat(301), '2', 'collaborator')).toThrow(BadRequestException);

    const lateDropped = tasksService.unassignTask(
      urgentTask.id,
      'Blocked on external dependency and need to hand off.',
      '2',
      'collaborator',
    );
    expect(lateDropped.assignee).toBe('Unassigned');
    const ownerDropNotif = notificationsService
      .findByUser('1')
      .find((n) => n.type === 'TASK_UNASSIGNED' && n.metadata?.taskId === urgentTask.id);
    expect(ownerDropNotif?.message).toContain('Blocked on external dependency');
  });
});
