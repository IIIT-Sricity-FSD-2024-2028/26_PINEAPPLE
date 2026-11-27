import { Test } from '@nestjs/testing';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AppModule } from '../app.module';
import { MailService } from '../mail/mail.service';
import { ClockService } from '../common/services/clock.service';
import { JobsService } from '../jobs/jobs.service';
import { JobRunsService } from '../jobs/job-runs.service';
import { ProjectsService } from '../projects/projects.service';
import { ProjectsRepository } from '../projects/projects.repository';
import { isVisibleProject } from '../projects/project-visibility.util';
import { ProjectStatus } from '../projects/dto/create-project.dto';
import { TasksService } from '../tasks/tasks.service';
import { TasksRepository } from '../tasks/tasks.repository';
import { TaskStatus } from '../tasks/dto/create-task.dto';
import { UsersRepository } from '../users/users.repository';
import { UsersService } from '../users/users.service';
import { UserRole, UserStatus } from './dto/create-user.dto';
import { DataExportService } from './data-export.service';
import { AccountDeletionService } from './account-deletion.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CommunicationRepository } from '../communication/communication.repository';
import { AuditService } from '../audit/audit.service';
import { ReportsService } from '../moderation/reports.service';
import { ReputationService } from '../moderation/reputation.service';
import { GamificationRepository } from '../gamification/gamification.repository';
import { LeaderboardService } from '../leaderboard/leaderboard.service';
import { MentorMarketplaceService } from '../mentor-marketplace/mentor-marketplace.service';
import { EscrowService } from '../escrow/escrow.service';

describe('Phase 18 Unit Tests: Privacy, Deletion & Notification Settings', () => {
  let appRef: { close: () => Promise<void> };
  let clockService: ClockService;
  let jobsService: JobsService;
  let jobRunsService: JobRunsService;
  let projectsService: ProjectsService;
  let projectsRepo: ProjectsRepository;
  let tasksService: TasksService;
  let tasksRepo: TasksRepository;
  let usersRepo: UsersRepository;
  let usersService: UsersService;
  let dataExportService: DataExportService;
  let accountDeletionService: AccountDeletionService;
  let notificationsService: NotificationsService;
  let commRepo: CommunicationRepository;
  let auditService: AuditService;
  let reportsService: ReportsService;
  let reputationService: ReputationService;
  let gamificationRepo: GamificationRepository;
  let leaderboardService: LeaderboardService;
  let mentorService: MentorMarketplaceService;
  let escrowService: EscrowService;

  const mailMock = {
    onModuleInit: async () => {},
    initializeTransport: async () => {},
    sendPasswordResetEmail: async () => ({ success: true, mode: 'console' as const }),
    sendEmailVerificationEmail: async () => ({ success: true, mode: 'console' as const }),
    sendMail: async () => ({ success: true, mode: 'console' as const }),
    sendWarningEmail: async () => ({ success: true, mode: 'console' as const }),
    sendSuspensionEmail: async () => ({ success: true, mode: 'console' as const }),
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.ALLOW_STORE_RESET = 'true';
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

    clockService = app.get(ClockService);
    jobsService = app.get(JobsService);
    jobRunsService = app.get(JobRunsService);
    projectsService = app.get(ProjectsService);
    projectsRepo = app.get(ProjectsRepository);
    tasksService = app.get(TasksService);
    tasksRepo = app.get(TasksRepository);
    usersRepo = app.get(UsersRepository);
    usersService = app.get(UsersService);
    dataExportService = app.get(DataExportService);
    accountDeletionService = app.get(AccountDeletionService);
    notificationsService = app.get(NotificationsService);
    commRepo = app.get(CommunicationRepository);
    auditService = app.get(AuditService);
    reportsService = app.get(ReportsService);
    reputationService = app.get(ReputationService);
    gamificationRepo = app.get(GamificationRepository);
    leaderboardService = app.get(LeaderboardService);
    mentorService = app.get(MentorMarketplaceService);
    escrowService = app.get(EscrowService);
  });

  beforeEach(() => {
    usersRepo.reset();
    projectsRepo.reset();
    tasksRepo.reset();
    gamificationRepo.reset();
    notificationsService.reset();
    auditService.reset();
    reportsService.reset();
    reputationService.reset();
    commRepo.reset();
    mentorService.resetLifecycle();
    dataExportService.reset();
    jobRunsService.reset();
    clockService.setTime('2026-11-11T08:00:00.000Z');
  });

  afterAll(async () => {
    await appRef?.close();
  });

  const longDesc =
    'A comprehensive engineering collaboration project with detailed requirements, architecture goals, task milestones, and review guidelines for all contributors.';

  it('1. isVisibleProject hides soft-deleted projects everywhere except includeDeleted queries', () => {
    const activeProj = { id: 'p-1', title: 'Visible', status: 'Open' };
    const deletedProj = { id: 'p-2', title: 'Gone', status: 'Open', deletedAt: '2026-11-10T00:00:00.000Z' };

    expect(isVisibleProject(activeProj)).toBe(true);
    expect(isVisibleProject(deletedProj)).toBe(false);
    expect(isVisibleProject(deletedProj, { includeDeleted: true })).toBe(true);

    const created = projectsService.create('1', {
      title: 'Soft Delete Target',
      description: longDesc,
      teamSize: 4,
      dueDate: '2027-03-01T00:00:00.000Z',
    });
    const delRes = projectsService.softDeleteProject(created.id, '1', 'project-owner');
    expect(delRes.deletedAt).toBeDefined();

    // Hidden from standard lists, owner lists, and direct non-admin queries
    expect(projectsService.findAll().some((p) => p.id === created.id)).toBe(false);
    expect(projectsService.findByOwnerId('1').some((p) => p.id === created.id)).toBe(false);
    expect(() => projectsService.findById(created.id)).toThrow();

    // Visible only when includeDeleted: true (admin)
    expect(projectsService.findById(created.id, undefined, { includeDeleted: true }).deletedAt).toBeDefined();
    expect(projectsService.findAll('deleted', undefined, undefined, undefined, undefined, true).some((p) => p.id === created.id)).toBe(true);
  });

  it('2. Soft delete refuses 409 PROJECT_HAS_ACTIVE_ESCROW, and admin restore works at day 29 but rejects at day 31', async () => {
    const project = projectsService.create('1', {
      title: 'Escrow Guarded Project',
      description: longDesc,
      teamSize: 3,
      dueDate: '2027-03-01T00:00:00.000Z',
    });
    const mentorUser = usersRepo.create({
      name: 'Mentor Restore',
      email: 'mentor.restore@test.local',
      username: 'mentor_restore_18',
      role: UserRole.Mentor,
      password: 'Password@123',
      skills: ['React'],
      status: UserStatus.Active,
    } as any);
    const profile = mentorService.createProfile(mentorUser.id, {
      name: mentorUser.name,
      title: 'Mentor',
      bio: 'Senior software architect guiding teams.',
      skills: ['React'],
      sessionPrice: 1000,
      experienceYears: 5,
    });
    const booked = await mentorService.bookSession('1', {
      mentorId: profile.id,
      projectId: project.id,
      projectDescription: 'Detailed project architecture and escrow review session description.',
    });
    await mentorService.confirmPayment(booked.session.id, '1', false, 'idem-p18-1');

    expect(() => projectsService.softDeleteProject(project.id, '1', 'project-owner')).toThrow(/escrow|closed/i);

    // Close project first -> Phase 9 refunds escrow, then soft delete succeeds
    projectsService.closeProject(project.id, 'Closing before delete', 'u-admin');
    const deleted = projectsService.softDeleteProject(project.id, '1', 'project-owner');
    expect(deleted.deletedAt).toBeDefined();

    // Day 29 restore succeeds
    clockService.advanceDays(29);
    const restored = projectsService.restoreProject(project.id, 'u-admin');
    expect(restored.project.deletedAt).toBeUndefined();
    expect(projectsService.findById(project.id).id).toBe(project.id);

    // Re-delete and advance 31 days -> 409 RESTORE_WINDOW_PASSED
    projectsService.softDeleteProject(project.id, '1', 'project-owner');
    clockService.advanceDays(31);
    let errObj: any;
    try {
      projectsService.restoreProject(project.id, 'u-admin');
    } catch (err) {
      errObj = err;
    }
    expect(errObj?.getStatus?.()).toBe(409);
    expect(errObj?.getResponse?.().code).toBe('RESTORE_WINDOW_PASSED');
  });

  it('3. DataExportService exports ONLY own user data, enforces 1/h rate limit, and expires after 24h via cleanup job', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-p18-exp-'));
    process.env.EXPORT_DIR = tempDir;

    const proj = projectsService.create('2', {
      title: 'Arjun Private Export Project',
      description: longDesc,
      teamSize: 3,
      dueDate: '2027-03-01T00:00:00.000Z',
    });
    commRepo.sendMessage('2', { projectId: proj.id, text: 'Message authored by Arjun' }, 'Owner');
    commRepo.sendMessage('7', { projectId: proj.id, text: 'Secret message authored by Neha' }, 'Collaborator');

    const exp1 = dataExportService.requestExport('2');
    expect(exp1.status).toBe('ready');

    const downloaded = dataExportService.getExportDownload(exp1.exportId, '2');
    const parsed = JSON.parse(downloaded.content);

    expect(parsed.profile.email).toBe('arjun.sharma@teamforge.io');
    expect(parsed.projects.some((p: any) => p.id === proj.id)).toBe(true);
    expect(parsed.messages.some((m: any) => m.content === 'Message authored by Arjun')).toBe(true);
    // Must NEVER include another user's chat messages or credentials
    expect(parsed.messages.some((m: any) => m.content === 'Secret message authored by Neha')).toBe(false);
    expect(downloaded.content).not.toContain('neha.gupta@teamforge.io');

    // Another user cannot download Arjun's export
    expect(() => dataExportService.getExportDownload(exp1.exportId, '7')).toThrow();

    // Rate limit within 1 hour -> 429
    let rateErr: any;
    try {
      dataExportService.requestExport('2');
    } catch (e) {
      rateErr = e;
    }
    expect(rateErr?.getStatus?.()).toBe(429);
    expect(rateErr?.getResponse?.().code).toBe('EXPORT_RATE_LIMIT');

    // After 25h -> expired and cleaned from disk by hourly job
    clockService.advanceHours(25);
    const cleanupRun = await jobsService.runTick('manual');
    const cleanupJob = cleanupRun.jobs.find((j) => j.name === 'cleanExpiredExports');
    expect(cleanupJob?.itemsProcessed).toBe(1);
    expect(fs.existsSync(downloaded.filePath)).toBe(false);
    expect(() => dataExportService.getExportDownload(exp1.exportId, '2')).toThrow();

    delete process.env.EXPORT_DIR;
  });

  it('4. AccountDeletionService blocks open obligations/admin/suspended, anonymises everything idempotently, and lets original email re-register with 0 rep', () => {
    const tempUser = usersRepo.create({
      name: 'Elena Privacy',
      email: 'elena.privacy@test.local',
      username: 'elena_priv',
      role: UserRole.Collaborator,
      password: 'SecretPass@1',
      skills: ['TypeScript'],
      status: UserStatus.Active,
    } as any);

    const openProj = projectsService.create(tempUser.id, {
      title: 'Elena Open Obligation Project',
      description: longDesc,
      teamSize: 3,
      dueDate: '2027-03-01T00:00:00.000Z',
    });
    const doneTask = tasksService.create({
      projectId: openProj.id,
      title: 'Preserve Completed Work',
      assigneeId: tempUser.id,
      assigneeName: tempUser.name,
      priority: 'Medium',
      status: TaskStatus.Completed,
      dueDate: '2027-02-01T00:00:00.000Z',
    });
    commRepo.sendMessage(tempUser.id, { projectId: openProj.id, text: 'Elena preserved chat line' }, 'Owner');
    auditService.log({
      action: 'project-created',
      actor: tempUser.name,
      performedBy: tempUser.id,
      target: tempUser.email,
      entityType: 'user',
      entityId: tempUser.id,
      event: `Elena Privacy (${tempUser.email}) created project`,
    });

    // Admin self-delete -> 403
    expect(() =>
      accountDeletionService.deleteMyAccount('u-admin', {
        username: 'tf_admin',
      }),
    ).toThrow(/Administrators/i);

    // Wrong typed username (even matching another user's username) -> 400 USERNAME_MISMATCH and never deletes that user
    let mismatchErr: any;
    try {
      accountDeletionService.deleteMyAccount(tempUser.id, {
        username: 'arjunsharma',
      });
    } catch (e) {
      mismatchErr = e;
    }
    expect(mismatchErr?.getStatus?.()).toBe(400);
    expect(mismatchErr?.getResponse?.().code).toBe('USERNAME_MISMATCH');
    expect(usersRepo.findById('2')?.isDeleted).toBeFalsy();

    // Unfinished owned project blocks deletion -> 409 ACCOUNT_HAS_OPEN_OBLIGATIONS
    let obErr: any;
    try {
      accountDeletionService.deleteMyAccount(tempUser.id, {
        username: 'elena_priv',
      });
    } catch (e) {
      obErr = e;
    }
    expect(obErr?.getStatus?.()).toBe(409);
    expect(obErr?.getResponse?.().code).toBe('ACCOUNT_HAS_OPEN_OBLIGATIONS');

    // Finish project & delete account (with username confirmation only)
    projectsService.closeProject(openProj.id, 'Finished before account deletion', 'u-admin');
    const delRes = accountDeletionService.deleteMyAccount(tempUser.id, {
      username: 'elena_priv',
    });
    expect(delRes.success).toBe(true);
    expect(delRes.anonymizedId).toMatch(/^deleted_/);

    // Repeat call is idempotent without writing a second audit log
    const replayRes = accountDeletionService.deleteMyAccount(tempUser.id, {
      username: 'elena_priv',
    });
    expect(replayRes.alreadyDeleted).toBe(true);
    expect(auditService.findAll().filter((a) => a.action === 'account-deleted')).toHaveLength(1);

    // Search & leaderboard exclude deleted account
    expect(usersService.searchUsers('elena', '1')).toHaveLength(0);
    expect(leaderboardService.getLeaderboard('alltime').some((e) => e.userId === tempUser.id)).toBe(false);

    // Chat and tasks preserve content under "Deleted user"
    const chatMsgs = commRepo.getMessagesByProjectId(openProj.id);
    expect(chatMsgs[0].senderName).toBe('Deleted user');
    expect(chatMsgs[0].content).toBe('Elena preserved chat line');
    const savedTask = tasksRepo.findById(doneTask.id);
    expect(savedTask?.assigneeName).toBe('Deleted user');

    // Audit entries replaced identifying info with hashed ID
    const oldAudit = auditService.findAll().find((a) => a.action === 'project-created' && a.entityId === delRes.anonymizedId);
    expect(oldAudit?.event).not.toContain('elena.privacy@test.local');
    expect(oldAudit?.event).toContain(delRes.anonymizedId);

    // Original email can sign up again cleanly with zero rep & XP
    const freshUser = usersRepo.create({
      name: 'Elena Returned',
      email: 'elena.privacy@test.local',
      username: 'elena_priv',
      role: UserRole.Collaborator,
      password: 'NewPassword@1',
      skills: [],
      status: UserStatus.Active,
    } as any);
    expect(freshUser.id).not.toBe(tempUser.id);
    expect(reputationService.getReputation(freshUser.id)).toBe(0);
    expect(gamificationRepo.findByUserId(freshUser.id)).toHaveLength(0);
  });

  it('5. Notifications are delivered immediately with no digest deferral or digest user settings', async () => {
    const project = projectsService.create('1', {
      title: 'Project X',
      description: longDesc,
      teamSize: 4,
      dueDate: '2027-03-01T00:00:00.000Z',
    });

    expect(usersService.getUserSettings('2')).toEqual({});
    expect(usersService.updateUserSettings('2')).toEqual({});

    const beforeUnread = notificationsService.findByUser('2').filter((n) => !n.readStatus).length;

    notificationsService.create({
      userId: '2',
      type: 'ACCOUNT_WARNED',
      title: 'Warning 1/4',
      message: 'Immediate warning delivery',
    });
    notificationsService.create({
      userId: '2',
      type: 'PROJECT_UPDATE',
      message: 'Immediate project update delivery',
      referenceId: project.id,
    });
    expect(notificationsService.findByUser('2').filter((n) => !n.readStatus).length).toBe(beforeUnread + 2);
    expect(notificationsService.findByUser('2').some((n) => n.type === 'DAILY_DIGEST')).toBe(false);
  });
});
