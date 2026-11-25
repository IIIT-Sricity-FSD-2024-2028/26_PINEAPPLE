import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module';
import { MailService } from '../mail/mail.service';
import { ClockService } from '../common/services/clock.service';
import { JobsService } from './jobs.service';
import { JobRunsService } from './job-runs.service';
import { ProjectsService } from '../projects/projects.service';
import { ProjectsRepository } from '../projects/projects.repository';
import { ProjectStatus } from '../projects/dto/create-project.dto';
import { TasksService } from '../tasks/tasks.service';
import { TasksRepository } from '../tasks/tasks.repository';
import { TaskStatus } from '../tasks/dto/create-task.dto';
import { JoinRequestsService } from '../join-requests/join-requests.service';
import { UsersRepository } from '../users/users.repository';
import { NotificationsService } from '../notifications/notifications.service';
import { SupportService } from '../support/support.service';
import { ModerationService } from '../moderation/moderation.service';

describe('Phase 12 Unit Tests: Stuck Projects, Requests & Inactivity', () => {
  let jobsService: JobsService;
  let jobRunsService: JobRunsService;
  let clockService: ClockService;
  let projectsService: ProjectsService;
  let projectsRepo: ProjectsRepository;
  let tasksService: TasksService;
  let tasksRepo: TasksRepository;
  let joinRequestsService: JoinRequestsService;
  let usersRepo: UsersRepository;
  let notificationsService: NotificationsService;
  let supportService: SupportService;
  let moderationService: ModerationService;
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

    jobsService = app.get(JobsService);
    jobRunsService = app.get(JobRunsService);
    clockService = app.get(ClockService);
    projectsService = app.get(ProjectsService);
    projectsRepo = app.get(ProjectsRepository);
    tasksService = app.get(TasksService);
    tasksRepo = app.get(TasksRepository);
    joinRequestsService = app.get(JoinRequestsService);
    usersRepo = app.get(UsersRepository);
    notificationsService = app.get(NotificationsService);
    supportService = app.get(SupportService);
    moderationService = app.get(ModerationService);
  });

  beforeEach(() => {
    usersRepo.reset();
    for (const u of usersRepo.findAll(true)) {
      u.digestEnabled = false;
    }
    projectsRepo.reset();
    tasksRepo.reset();
    notificationsService.reset();
    joinRequestsService.reset();
    supportService.reset();
    moderationService.reset();
    jobRunsService.reset();
    clockService.setTime('2026-11-11T12:00:00.000Z');
  });

  afterAll(async () => {
    await appRef?.close();
  });

  it('1. Zombie project breaker: pauses 48h at day 5, keeps open at 47h, system_closes requests and closes project at 49h', async () => {
    const project = projectsService.create('1', {
      title: 'Zombie Pause Project',
      description: 'Project with pending request testing 48h grace limit before the scheduled zombie breaker system-closes the project.',
      skills: ['TypeScript', 'NestJS', 'React'],
      teamSize: 4,
      dueDate: '2027-06-01T00:00:00.000Z',
    });

    // Advance 1 day and submit join request from user '7'
    clockService.advanceHours(24);
    const req = joinRequestsService.create(
      { projectId: project.id, userId: '7', userName: 'Neha', message: 'Interested' },
      '7',
    );
    expect(req.status).toBe('pending');

    // Advance to day 5 + 1h from project creation -> pauses instead of immediate close
    clockService.setTime(new Date(new Date(project.createdAt).getTime() + (5 * 24 + 1) * 3600 * 1000));
    await jobsService.closeEmptyProjects();

    const pausedProj = projectsRepo.findById(project.id)!;
    expect(pausedProj.status).toBe(ProjectStatus.Open);
    expect(pausedProj.pausedAt).toBeDefined();
    expect(pausedProj.pendingReviewGraceExpiresAt).toBeDefined();

    const ownerPauseNotifs = notificationsService
      .findByUser('1')
      .filter((n) => n.message.includes('Decide on pending requests within 48 hours or the project closes'));
    expect(ownerPauseNotifs.length).toBeGreaterThanOrEqual(1);

    // At +47h from pausedAt: zombieProjectBreaker leaves it open
    clockService.advanceHours(47);
    const res47 = await jobsService.zombieProjectBreaker();
    expect(res47.closedProjects).not.toContain(project.id);
    expect(projectsRepo.findById(project.id)!.status).toBe(ProjectStatus.Open);

    // At +49h from pausedAt: system_closes pending request, restores slot, closes project
    clockService.advanceHours(2);
    const res49 = await jobsService.zombieProjectBreaker();
    expect(res49.closedProjects).toContain(project.id);
    expect(res49.closedRequests).toContain(req.id);

    const closedProj = projectsRepo.findById(project.id)!;
    expect(closedProj.status).toBe(ProjectStatus.Closed);
    expect(closedProj.closureReason).toBe('No owner response');
    expect(closedProj.pausedAt).toBeUndefined();

    const closedReq = joinRequestsService.findByProject(project.id).find((r) => r.id === req.id)!;
    expect(closedReq.status).toBe('system_closed');
    expect(closedReq.countedTowardLimit).toBe(false);
    expect(joinRequestsService.requestsUsed('7', project.id)).toBe(0);
    expect(joinRequestsService.requestsLeft('7', project.id)).toBe(2);

    const applicantNotif = notificationsService
      .findByUser('7')
      .find((n) => n.referenceId === project.id && n.message.toLowerCase().includes('closed'));
    expect(applicantNotif).toBeDefined();
    expect(applicantNotif?.link).toBe(`/projects/${project.id}`);

    // Idempotent second run
    const resRepeat = await jobsService.zombieProjectBreaker();
    expect(resRepeat.closedProjects).not.toContain(project.id);
    expect(resRepeat.closedRequests).not.toContain(req.id);
  });

  it('2. Zombie pause clears if owner decides pending request within 48h', async () => {
    const project = projectsService.create('1', {
      title: 'Saved Project',
      description: 'Owner approves pending request within 48h window so the pending pause clears cleanly and the project remains active.',
      teamSize: 3,
      dueDate: '2027-06-01T00:00:00.000Z',
    });
    const req = joinRequestsService.create({ projectId: project.id, userId: '7', message: 'Join' }, '7');

    clockService.setTime(new Date(new Date(project.createdAt).getTime() + (5 * 24 + 1) * 3600 * 1000));
    await jobsService.closeEmptyProjects();
    expect(projectsRepo.findById(project.id)!.pausedAt).toBeDefined();

    // Owner approves within 48h -> pause cleared and project stays open even after 49h
    clockService.advanceHours(10);
    await joinRequestsService.update(req.id, { status: 'Approved' }, '1');
    expect(projectsRepo.findById(project.id)!.pausedAt).toBeUndefined();

    clockService.advanceHours(45);
    const breakerRes = await jobsService.zombieProjectBreaker();
    expect(breakerRes.closedProjects).not.toContain(project.id);
    expect(projectsRepo.findById(project.id)!.status).toBe(ProjectStatus.Open);
  });

  it('3. Stale request closer: 14-day single pending request becomes system_closed and notifies both sides', async () => {
    const project = projectsService.create('1', {
      title: 'Active Stale Req Project',
      description: 'Project with collaborator so it stays open while stale request closes cleanly after 14 days without owner action.',
      teamSize: 4,
      dueDate: '2027-06-01T00:00:00.000Z',
    });
    projectsService.addCollaborator(project.id, { id: '2', name: 'Arjun Sharma', role: 'Collaborator' });
    const req = joinRequestsService.create({ projectId: project.id, userId: '7', message: 'Hello' }, '7');

    // Advance 14 days + 1 hour
    clockService.advanceDays(14);
    clockService.advanceHours(1);

    const res = await jobsService.staleRequestCloser();
    expect(res.closedRequests).toContain(req.id);

    const updatedReq = joinRequestsService.findByProject(project.id).find((r) => r.id === req.id)!;
    expect(updatedReq.status).toBe('system_closed');
    expect(updatedReq.countedTowardLimit).toBe(false);
    expect(joinRequestsService.requestsLeft('7', project.id)).toBe(2);

    const applicantNotif = notificationsService.findByUser('7').find((n) => n.referenceId === project.id);
    const ownerNotif = notificationsService.findByUser('1').find((n) => n.referenceId === project.id);
    expect(applicantNotif?.link).toBe(`/projects/${project.id}`);
    expect(ownerNotif?.link).toBe(`/owner/workspace/${project.id}`);

    // Idempotent second run
    const res2 = await jobsService.staleRequestCloser();
    expect(res2.closedRequests).not.toContain(req.id);
  });

  it('4. Early withdraw refund: <2h & unviewed restores slot; viewed OR >2h counts toward 2-request limit', async () => {
    const project = projectsService.create('1', {
      title: 'Withdraw Rules Project',
      description: 'Testing early withdraw refund against viewedAt and 2h cutoff so unviewed early withdrawals restore the applicant slot.',
      teamSize: 4,
      dueDate: '2027-06-01T00:00:00.000Z',
    });

    // Case A: < 2h, not viewed -> refunds slot
    const r1 = joinRequestsService.create({ projectId: project.id, userId: '7', message: 'Try 1' }, '7');
    clockService.advanceHours(1);
    const w1 = joinRequestsService.withdrawRequest(r1.id, '7');
    expect(w1.slotRestored).toBe(true);
    expect(w1.countedTowardLimit).toBe(false);
    expect(joinRequestsService.requestsUsed('7', project.id)).toBe(0);

    // Case B: Owner opens GET /join-requests (marks viewedAt), then withdraw within 10 mins -> counts!
    const r2 = joinRequestsService.create({ projectId: project.id, userId: '7', message: 'Try 2' }, '7');
    joinRequestsService.markViewedForProject(project.id, '1');
    clockService.advanceTime(10 * 60 * 1000);
    const w2 = joinRequestsService.withdrawRequest(r2.id, '7');
    expect(w2.slotRestored).toBe(false);
    expect(w2.countedTowardLimit).toBe(true);
    expect(joinRequestsService.requestsUsed('7', project.id)).toBe(1);

    // Case C: Unviewed, advance 3h (> 2h), withdraw -> counts!
    const r3 = joinRequestsService.create({ projectId: project.id, userId: '7', message: 'Try 3' }, '7');
    clockService.advanceHours(3);
    const w3 = joinRequestsService.withdrawRequest(r3.id, '7');
    expect(w3.slotRestored).toBe(false);
    expect(w3.countedTowardLimit).toBe(true);
    expect(joinRequestsService.requestsUsed('7', project.id)).toBe(2);
    expect(joinRequestsService.requestsLeft('7', project.id)).toBe(0);
  });

  it('5. Abandoned owner: 14d notifies collaborators & mentor once, 30d sets eligible flag without auto-close', async () => {
    const nowIso = clockService.nowIso();
    usersRepo.findById('1')!.lastActiveAt = nowIso;
    const project = projectsService.create('1', {
      title: 'Abandoned Owner Project',
      description: 'Testing 14d notice and 30d close request eligibility when a project owner stops engaging with their active project.',
      teamSize: 4,
      dueDate: '2027-06-01T00:00:00.000Z',
    });
    const projEntity = projectsRepo.findById(project.id)!;
    projEntity.lastOwnerActionAt = nowIso;
    projEntity.mentorId = '4';
    projectsService.addCollaborator(project.id, { id: '2', name: 'Arjun Sharma', role: 'Collaborator' });

    // Advance 14 days + 1h -> collaborator & mentor notified once
    clockService.advanceDays(14);
    clockService.advanceHours(1);
    const res14 = await jobsService.ownerInactivityNotifier();
    expect(res14.notified14dProjects).toContain(project.id);

    const collabNotifs14 = notificationsService
      .findByUser('2')
      .filter((n) => (n.referenceId === project.id || n.metadata?.projectIds?.includes(project.id)) && n.message.includes('14 days'));
    const mentorNotifs14 = notificationsService
      .findByUser('4')
      .filter((n) => (n.referenceId === project.id || n.metadata?.projectIds?.includes(project.id)) && n.message.includes('14 days'));
    expect(collabNotifs14).toHaveLength(1);
    expect(mentorNotifs14).toHaveLength(1);

    // Running again right away does NOT re-notify
    const res14Repeat = await jobsService.ownerInactivityNotifier();
    expect(res14Repeat.notified14dProjects).not.toContain(project.id);
    expect(
      notificationsService
        .findByUser('2')
        .filter((n) => (n.referenceId === project.id || n.metadata?.projectIds?.includes(project.id)) && n.message.includes('14 days')),
    ).toHaveLength(1);

    // Advance to 30 days + 1h -> flags ownerInactive30d, never auto-closes
    clockService.advanceDays(16);
    const res30 = await jobsService.ownerInactivityNotifier();
    expect(res30.flagged30dProjects).toContain(project.id);

    const flagged = projectsRepo.findById(project.id)!;
    expect(flagged.ownerInactive30d).toBe(true);
    expect(flagged.status).toBe(ProjectStatus.Open);

    // Running again is idempotent
    const res30Repeat = await jobsService.ownerInactivityNotifier();
    expect(res30Repeat.flagged30dProjects).not.toContain(project.id);

    // Owner action clears inactivity flags
    projectsService.recordOwnerAction(project.id, '1');
    const refreshed = projectsRepo.findById(project.id)!;
    expect(refreshed.ownerInactive30d).toBe(false);
    expect(refreshed.ownerInactive14dNotifiedAt).toBeUndefined();
  });

  it('6. Inactive collaborator: 7d notice repeats per 7d window and releaseMemberTasks preserves In Review & Completed', async () => {
    const nowIso = clockService.nowIso();
    usersRepo.findById('1')!.lastActiveAt = nowIso;
    const project = projectsService.create('1', {
      title: 'Collab Inactivity Project',
      description: 'Testing 7d collaborator inactivity notices and task release while preserving In Review and Completed task proofs.',
      teamSize: 4,
      dueDate: '2027-06-01T00:00:00.000Z',
    });
    const projEntity = projectsRepo.findById(project.id)!;
    projEntity.lastOwnerActionAt = nowIso;
    projEntity.memberActivity = {
      '2': {
        lastActivityAt: nowIso,
      },
    };
    projectsService.addCollaborator(project.id, { id: '2', name: 'Arjun Sharma', role: 'Collaborator' });

    const tTodo = tasksService.create({
      projectId: project.id,
      title: 'To Do Task',
      status: TaskStatus.ToDo,
      assigneeId: '2',
      assigneeName: 'Arjun Sharma',
      dueDate: '2027-05-01T00:00:00.000Z',
    });
    const tProg = tasksService.create({
      projectId: project.id,
      title: 'In Progress Task',
      status: TaskStatus.InProgress,
      assigneeId: '2',
      assigneeName: 'Arjun Sharma',
      dueDate: '2027-05-01T00:00:00.000Z',
    });
    const tReview = tasksService.create({
      projectId: project.id,
      title: 'In Review Task',
      status: TaskStatus.InReview,
      assigneeId: '2',
      assigneeName: 'Arjun Sharma',
      dueDate: '2027-05-01T00:00:00.000Z',
    });
    const tDone = tasksService.create({
      projectId: project.id,
      title: 'Completed Task',
      status: TaskStatus.Completed,
      assigneeId: '2',
      assigneeName: 'Arjun Sharma',
      dueDate: '2027-05-01T00:00:00.000Z',
    });

    // Keep owner active, collaborator '2' inactive for 7 days + 1h
    clockService.advanceDays(7);
    clockService.advanceHours(1);
    usersRepo.findById('1')!.lastActiveAt = clockService.nowIso();
    projectsService.recordOwnerAction(project.id, '1');

    const res7 = await jobsService.memberInactivityNotifier();
    expect(res7.notifiedMembers.some((k) => k.startsWith(`${project.id}:2`))).toBe(true);

    const collabWarn1 = notificationsService
      .findByUser('2')
      .filter((n) => n.referenceId === project.id && n.message.includes('no task or chat activity'));
    const ownerWarn1 = notificationsService
      .findByUser('1')
      .filter((n) => n.referenceId === project.id && n.message.includes('no activity'));
    expect(collabWarn1).toHaveLength(1);
    expect(ownerWarn1).toHaveLength(1);
    expect(ownerWarn1[0].link).toBe(`/owner/workspace/${project.id}`);

    // Immediate second run does not repeat in the same 7-day period
    const res7Repeat = await jobsService.memberInactivityNotifier();
    expect(res7Repeat.notifiedMembers.some((k) => k.startsWith(`${project.id}:2`))).toBe(false);

    // Advance another 7 days + 1h (14d total) -> sends second reminder
    clockService.advanceDays(7);
    clockService.advanceHours(1);
    const res14 = await jobsService.memberInactivityNotifier();
    expect(res14.notifiedMembers.some((k) => k.startsWith(`${project.id}:2`))).toBe(true);
    expect(
      notificationsService
        .findByUser('2')
        .filter((n) => n.referenceId === project.id && n.message.includes('no task or chat activity')),
    ).toHaveLength(2);

    // Release tasks keeps In Review and Completed untouched, releases To Do & In Progress, keeps member in team
    const rel = projectsService.releaseMemberTasks(project.id, '2', { id: '1', role: 'project-owner' });
    expect(rel.released).toBe(2);

    const afterTodo = tasksService.findById(tTodo.id);
    const afterProg = tasksService.findById(tProg.id);
    const afterReview = tasksService.findById(tReview.id);
    const afterDone = tasksService.findById(tDone.id);

    expect(afterTodo.assigneeId).toBeUndefined();
    expect(afterTodo.assigneeName).toBe('Unassigned');
    expect(afterTodo.status).toBe(TaskStatus.ToDo);

    expect(afterProg.assigneeId).toBeUndefined();
    expect(afterProg.assigneeName).toBe('Unassigned');
    expect(afterProg.status).toBe(TaskStatus.ToDo);

    expect(afterReview.assigneeId).toBe('2');
    expect(afterReview.status).toBe(TaskStatus.InReview);

    expect(afterDone.assigneeId).toBe('2');
    expect(afterDone.status).toBe(TaskStatus.Completed);

    // Collaborator remains on the project team
    const projAfter = projectsRepo.findById(project.id)!;
    expect(projAfter.collaborators.some((c) => String(c.id || c.userId) === '2')).toBe(true);
  });
});
