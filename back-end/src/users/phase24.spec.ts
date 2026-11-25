import { Test } from '@nestjs/testing';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AppModule } from '../app.module';
import { MailService } from '../mail/mail.service';
import { ClockService } from '../common/services/clock.service';
import { ProjectsService } from '../projects/projects.service';
import { ProjectsRepository } from '../projects/projects.repository';
import { TasksService } from '../tasks/tasks.service';
import { TasksRepository } from '../tasks/tasks.repository';
import { TaskStatus } from '../tasks/dto/create-task.dto';
import { JoinRequestsService } from '../join-requests/join-requests.service';
import { ProjectInvitesService } from '../projects/invites.service';
import { UsersRepository } from '../users/users.repository';
import { UsersService } from '../users/users.service';
import { UserRole, UserStatus } from './dto/create-user.dto';
import { DataExportService } from './data-export.service';
import { AccountDeletionService } from './account-deletion.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { MentorApplicationsService } from '../mentor-applications/mentor-applications.service';
import { serializeSafeUser } from './user-serializer';

describe('Phase 24 Unit Tests: Lifecycle Cleanup, FileCleanupService, Spam Caps & Re-Auth Deletion Code', () => {
  let appRef: { close: () => Promise<void> };
  let clockService: ClockService;
  let projectsService: ProjectsService;
  let projectsRepo: ProjectsRepository;
  let tasksService: TasksService;
  let tasksRepo: TasksRepository;
  let joinRequestsService: JoinRequestsService;
  let invitesService: ProjectInvitesService;
  let usersRepo: UsersRepository;
  let usersService: UsersService;
  let dataExportService: DataExportService;
  let accountDeletionService: AccountDeletionService;
  let notificationsService: NotificationsService;
  let auditService: AuditService;
  let mentorAppsService: MentorApplicationsService;

  let sentMails: Array<{ type: string; to: string; code?: string; subject?: string; text?: string }> = [];

  const longDesc =
    'A comprehensive Phase 24 lifecycle cleanup verification project workspace with clear goals, milestones, and deliverables.';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.ALLOW_STORE_RESET = 'true';
    process.env.SCHEDULER_ENABLED = 'false';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailService)
      .useValue({
        sendMail: async (opts: any) => {
          sentMails.push({ type: 'mail', to: opts.to, subject: opts.subject, text: opts.text });
          return { success: true, mode: 'console' as const };
        },
        sendPasswordResetEmail: async () => ({ success: true, mode: 'console' as const }),
        sendEmailVerificationEmail: async () => ({ success: true, mode: 'console' as const }),
        sendWarningEmail: async () => ({ success: true, mode: 'console' as const }),
        sendSuspensionEmail: async () => ({ success: true, mode: 'console' as const }),
        sendAccountDeletionCodeEmail: async (opts: any) => {
          sentMails.push({ type: 'deletion-code', to: opts.to, code: String(opts.code) });
          return { success: true, mode: 'console' as const };
        },
      })
      .compile();

    const app = moduleRef.createNestApplication();
    await app.init();
    appRef = app;

    clockService = app.get(ClockService);
    projectsService = app.get(ProjectsService);
    projectsRepo = app.get(ProjectsRepository);
    tasksService = app.get(TasksService);
    tasksRepo = app.get(TasksRepository);
    joinRequestsService = app.get(JoinRequestsService);
    invitesService = app.get(ProjectInvitesService);
    usersRepo = app.get(UsersRepository);
    usersService = app.get(UsersService);
    dataExportService = app.get(DataExportService);
    accountDeletionService = app.get(AccountDeletionService);
    notificationsService = app.get(NotificationsService);
    auditService = app.get(AuditService);
    mentorAppsService = app.get(MentorApplicationsService);
  });

  beforeEach(() => {
    sentMails = [];
    projectsRepo.reset();
    tasksRepo.reset();
    joinRequestsService.reset();
    invitesService.reset();
    usersRepo.reset();
    dataExportService.reset();
    accountDeletionService.reset();
    notificationsService.reset();
    auditService.reset();
    mentorAppsService.reset();
    clockService.setTime('2026-11-11T12:00:00.000Z');
  });

  afterAll(async () => {
    delete process.env.SECURE_CVS_DIR;
    delete process.env.UPLOADS_DIR;
    delete process.env.EXPORT_DIR;
    if (appRef) await appRef.close();
  });

  it('1. 3-per-24h spam cap counts deleted projects in last 24h while open cap excludes them', () => {
    const owner = usersRepo.create({
      name: 'Cap Owner',
      username: 'cap_owner_24',
      email: 'capowner24@test.local',
      password: 'Password@123',
      role: UserRole.ProjectOwner,
      status: UserStatus.Active,
    } as any);

    const p1 = projectsService.create(owner.id, {
      title: 'Cap Project 1',
      description: longDesc,
      teamSize: 3,
      dueDate: '2027-03-01T00:00:00.000Z',
    });
    const p2 = projectsService.create(owner.id, {
      title: 'Cap Project 2',
      description: longDesc,
      teamSize: 3,
      dueDate: '2027-03-01T00:00:00.000Z',
    });
    const p3 = projectsService.create(owner.id, {
      title: 'Cap Project 3',
      description: longDesc,
      teamSize: 3,
      dueDate: '2027-03-01T00:00:00.000Z',
    });

    // Soft-delete all three -> creating a 4th within 24h still hits 429 PROJECT_DAILY_LIMIT
    projectsService.softDeleteProject(p1.id, owner.id, 'project-owner');
    projectsService.softDeleteProject(p2.id, owner.id, 'project-owner');
    projectsService.softDeleteProject(p3.id, owner.id, 'project-owner');

    let capErr: any;
    try {
      projectsService.create(owner.id, {
        title: 'Cap Project 4 Bypass Attempt',
        description: longDesc,
        teamSize: 3,
        dueDate: '2027-03-01T00:00:00.000Z',
      });
    } catch (err) {
      capErr = err;
    }
    expect(capErr?.getStatus?.()).toBe(429);
    expect(capErr?.getResponse?.().code).toBe('PROJECT_DAILY_LIMIT');

    // Advance 24h + 1min -> window clears and creation succeeds (0 open projects currently)
    clockService.advanceHours(24);
    clockService.advanceTime(60 * 1000);
    const p4 = projectsService.create(owner.id, {
      title: 'Cap Project After Window',
      description: longDesc,
      teamSize: 3,
      dueDate: '2027-03-01T00:00:00.000Z',
    });
    expect(p4.id).toBeDefined();
  });

  it('2. Project soft delete closes pending join requests as system_closed (uncounted + notifies) and cancels pending invites', async () => {
    const owner = usersRepo.create({
      name: 'Del Proj Owner',
      username: 'delproj_owner',
      email: 'delproj.owner@test.local',
      password: 'Password@123',
      role: UserRole.ProjectOwner,
      status: UserStatus.Active,
    } as any);
    const applicant = usersRepo.create({
      name: 'Pending Applicant',
      username: 'pending_app',
      email: 'pending.app@test.local',
      password: 'Password@123',
      role: UserRole.Collaborator,
      status: UserStatus.Active,
    } as any);
    const invitee = usersRepo.create({
      name: 'Pending Invitee',
      username: 'pending_inv',
      email: 'pending.inv@test.local',
      password: 'Password@123',
      role: UserRole.Collaborator,
      status: UserStatus.Active,
    } as any);

    const proj = projectsService.create(owner.id, {
      title: 'Project With Pending Items',
      description: longDesc,
      teamSize: 4,
      dueDate: '2027-03-01T00:00:00.000Z',
    });

    const req = await joinRequestsService.create({
      projectId: proj.id,
      userId: applicant.id,
      userName: applicant.name,
      message: 'Excited to contribute to this architecture and deliver quality tests.',
      status: 'Pending',
    } as any);

    const inv = invitesService.sendInvite(proj.id, invitee.username!, {
      uid: owner.id,
      role: 'project-owner',
    });

    const delRes = projectsService.softDeleteProject(proj.id, owner.id, 'project-owner');
    expect(delRes.closedRequestsCount).toBe(1);
    expect(delRes.cancelledInvitesCount).toBe(1);

    const updatedReq = joinRequestsService.findAll().find((r) => r.id === req.id) as any;
    expect(updatedReq.status).toBe('system_closed');
    expect(updatedReq.countedTowardLimit).toBe(false);
    expect(updatedReq.closureReason).toBe('Closed because the project was deleted');
    expect(joinRequestsService.requestsUsed(applicant.id, proj.id)).toBe(0);

    const applicantNotifs = notificationsService.findByUser(applicant.id);
    expect(applicantNotifs.some((n) => n.message.includes('Closed because the project was deleted'))).toBe(true);

    const updatedInv = invitesService.listForUser(invitee.id).find((i) => i.id === inv.id);
    expect(updatedInv?.status).toBe('cancelled');
    expect(updatedInv?.closureReason).toBe('Closed because the project was deleted');
  });

  it('3. Account deletion frees project seats, releases Open/In Progress tasks, keeps In Review under Deleted user, closes requests/invites, deletes CV & upload & export files, and is idempotent', async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-p24-files-'));
    const cvsDir = path.join(tmpRoot, 'secure-cvs');
    const upDir = path.join(tmpRoot, 'uploads');
    const expDir = path.join(tmpRoot, 'exports');
    fs.mkdirSync(cvsDir, { recursive: true });
    fs.mkdirSync(upDir, { recursive: true });
    fs.mkdirSync(expDir, { recursive: true });

    process.env.SECURE_CVS_DIR = cvsDir;
    process.env.UPLOADS_DIR = upDir;
    process.env.EXPORT_DIR = expDir;

    const cvFile = 'member-cv-test.pdf';
    const avatarFile = 'member-avatar-test.png';
    const retainedProofFile = 'retained-review-proof.png';
    fs.writeFileSync(path.join(cvsDir, cvFile), '%PDF-1.4\n%%EOF\n');
    fs.writeFileSync(path.join(upDir, avatarFile), 'png-binary');
    fs.writeFileSync(path.join(upDir, retainedProofFile), 'png-binary');

    const owner = usersRepo.create({
      name: 'Seat Owner',
      username: 'seat_owner',
      email: 'seat.owner@test.local',
      password: 'Password@123',
      role: UserRole.ProjectOwner,
      status: UserStatus.Active,
    } as any);

    const member = usersRepo.create({
      name: 'Departing Member',
      username: 'departing_mem',
      email: 'departing.mem@test.local',
      password: 'Password@123',
      role: UserRole.Collaborator,
      avatar: `/uploads/${avatarFile}`,
      status: UserStatus.Active,
    } as any);

    const standby = usersRepo.create({
      name: 'Replacement Member',
      username: 'replacement_mem',
      email: 'replacement@test.local',
      password: 'Password@123',
      role: UserRole.Collaborator,
      status: UserStatus.Active,
    } as any);

    // Mentor CV on disk for departing member
    mentorAppsService.create({
      userId: member.id,
      name: member.name,
      headline: 'Senior Distributed Systems Architect Mentor Application',
      bio: 'Ten years building resilient systems and mentoring engineers through complex migrations and releases.',
      years: 10,
      skills: ['TypeScript'],
      linkedin: 'https://linkedin.com/in/departing-member',
      cvFileName: cvFile,
      cvUrl: `/uploads/cv/${cvFile}`,
      certificates: [
        {
          holderName: member.name,
          issuer: 'National University',
          docType: 'DEGREE',
          documentNumber: 'DEG-P24-001',
        },
      ],
    } as any);

    // Personal export file on disk for departing member
    const exp = dataExportService.requestExport(member.id);
    const expRecord = dataExportService.getAllRecords().find((r) => r.exportId === exp.exportId)!;
    expect(fs.existsSync(expRecord.filePath)).toBe(true);

    // Project P with maxCollaborators: 1 (1 collab seat -> FULL when member is inside!)
    const projP = projectsService.create(owner.id, {
      title: 'Full Team Seat Project',
      description: longDesc,
      teamSize: 2,
      maxCollaborators: 1,
      dueDate: '2027-03-01T00:00:00.000Z',
    } as any);
    const approvedReq = await joinRequestsService.create({
      projectId: projP.id,
      userId: member.id,
      userName: member.name,
      message: 'Ready to contribute on tasks and deliverables.',
      status: 'Pending',
    } as any);
    await joinRequestsService.approveRequest(approvedReq.id);
    expect(projectsService.isFull(projectsRepo.findById(projP.id)!)).toBe(true);

    // Open, In Progress, and In Review tasks for departing member
    const openTask = tasksService.create({
      projectId: projP.id,
      title: 'Open Task To Release',
      assigneeId: member.id,
      assigneeName: member.name,
      status: TaskStatus.ToDo,
      dueDate: '2027-02-01T00:00:00.000Z',
    });
    const inProgTask = tasksService.create({
      projectId: projP.id,
      title: 'In Progress Task To Release',
      assigneeId: member.id,
      assigneeName: member.name,
      status: TaskStatus.InProgress,
      dueDate: '2027-02-02T00:00:00.000Z',
    });
    const reviewTask = tasksService.create({
      projectId: projP.id,
      title: 'Submitted Review Task',
      assigneeId: member.id,
      assigneeName: member.name,
      status: TaskStatus.InReview,
      proofUrl: `https://storage.teamforge.local/uploads/${retainedProofFile}`,
      dueDate: '2027-02-03T00:00:00.000Z',
    });

    // Pending join request on Q & pending invite on R
    const projQ = projectsService.create(owner.id, {
      title: 'Pending Queue Project',
      description: longDesc,
      teamSize: 4,
      dueDate: '2027-03-01T00:00:00.000Z',
    });
    const pendingReq = await joinRequestsService.create({
      projectId: projQ.id,
      userId: member.id,
      userName: member.name,
      message: 'Interested in collaborating on testing tasks.',
      status: 'Pending',
    } as any);

    const projR = projectsService.create(owner.id, {
      title: 'Invited Project R',
      description: longDesc,
      teamSize: 4,
      dueDate: '2027-03-01T00:00:00.000Z',
    });
    const inv = invitesService.sendInvite(projR.id, member.username!, {
      uid: owner.id,
      role: 'project-owner',
    });

    // Delete account
    const delRes = accountDeletionService.deleteMyAccount(member.id, {
      username: 'departing_mem',
    });
    expect(delRes.success).toBe(true);
    expect(delRes.released?.projectCount).toBeGreaterThanOrEqual(1);
    expect(delRes.released?.taskCount).toBe(2);
    expect(delRes.released?.fileCount).toBe(3);

    // Seat on Proj P is now free and replacement member can join!
    const projPAfter = projectsRepo.findById(projP.id)!;
    expect(projPAfter.collaborators).toHaveLength(0);
    expect(projectsService.isFull(projPAfter)).toBe(false);
    expect((joinRequestsService.findAll().find((r) => r.id === approvedReq.id) as any).status).toBe('left');

    const replacementReq = await joinRequestsService.create({
      projectId: projP.id,
      userId: standby.id,
      userName: standby.name,
      message: 'Taking the newly freed collaborator seat cleanly.',
      status: 'Pending',
    } as any);
    await joinRequestsService.approveRequest(replacementReq.id);
    expect(projectsRepo.findById(projP.id)!.collaborators).toHaveLength(1);

    // Tasks released vs preserved
    const openAfter = tasksRepo.findById(openTask.id)!;
    expect(openAfter.assigneeId).toBeUndefined();
    expect(openAfter.assigneeName).toBe('Unassigned');
    expect(openAfter.status).toBe(TaskStatus.ToDo);

    const progAfter = tasksRepo.findById(inProgTask.id)!;
    expect(progAfter.assigneeId).toBeUndefined();
    expect(progAfter.assigneeName).toBe('Unassigned');
    expect(progAfter.status).toBe(TaskStatus.ToDo);

    const reviewAfter = tasksRepo.findById(reviewTask.id)!;
    expect(reviewAfter.status).toBe(TaskStatus.InReview);
    expect(reviewAfter.assigneeName).toBe('Deleted user');

    // Pending join request & invite closed/cancelled
    expect((joinRequestsService.findAll().find((r) => r.id === pendingReq.id) as any).status).toBe('system_closed');
    expect(invitesService.listForUser(member.id).find((i) => i.id === inv.id)?.status).toBe('cancelled');

    // Files removed from disk except retained task proof
    expect(fs.existsSync(path.join(cvsDir, cvFile))).toBe(false);
    expect(fs.existsSync(path.join(upDir, avatarFile))).toBe(false);
    expect(fs.existsSync(expRecord.filePath)).toBe(false);
    expect(fs.existsSync(path.join(upDir, retainedProofFile))).toBe(true);

    // ACCOUNT_RELEASED audit log with counts only
    const releaseAudits = auditService.findAll().filter((a) => a.action === 'ACCOUNT_RELEASED');
    expect(releaseAudits).toHaveLength(1);
    expect(releaseAudits[0].details).toEqual(
      expect.objectContaining({
        anonymizedId: delRes.anonymizedId,
        projectCount: expect.any(Number),
        taskCount: 2,
        fileCount: 3,
      }),
    );

    // Idempotent repeat call does not write a duplicate ACCOUNT_RELEASED audit log
    const replay = accountDeletionService.deleteMyAccount(member.id, {
      username: 'departing_mem',
    });
    expect(replay.alreadyDeleted).toBe(true);
    expect(auditService.findAll().filter((a) => a.action === 'ACCOUNT_RELEASED')).toHaveLength(1);
  });

  it('4. Passwordless account deletion, verified-token Firebase-UID regression fix, USERNAME_MISMATCH, and 3/hour rate limit', async () => {
    const socialUser = usersRepo.create({
      name: 'Social User',
      username: 'social_oauth_24',
      email: 'social.oauth24@test.local',
      password: '',
      role: UserRole.Collaborator,
      emailVerified: true,
      status: UserStatus.Active,
    } as any);

    const otherUser = usersRepo.create({
      name: 'Other User',
      username: 'other_oauth_24',
      email: 'other.oauth24@test.local',
      password: 'Password@123',
      role: UserRole.Collaborator,
      emailVerified: true,
      status: UserStatus.Active,
    } as any);

    // 3 wrong-username attempts within 1 hour return 400 USERNAME_MISMATCH and keep both users intact
    for (let i = 1; i <= 3; i++) {
      let mismatchErr: any;
      try {
        accountDeletionService.deleteMyAccount(socialUser.id, {
          username: 'other_oauth_24', // attempting to type someone else's username
        });
      } catch (e) {
        mismatchErr = e;
      }
      expect(mismatchErr?.getStatus?.()).toBe(400);
      expect(mismatchErr?.getResponse?.().code).toBe('USERNAME_MISMATCH');
      expect(usersRepo.findById(otherUser.id)?.isDeleted).toBeFalsy();
      expect(usersRepo.findById(socialUser.id)?.isDeleted).toBeFalsy();
    }

    // 4th attempt within the same hour hits 429 rate limit
    let rateErr: any;
    try {
      accountDeletionService.deleteMyAccount(socialUser.id, {
        username: 'social_oauth_24',
      });
    } catch (e) {
      rateErr = e;
    }
    expect(rateErr?.getStatus?.()).toBe(429);
    expect(rateErr?.getResponse?.().code).toBe('DELETE_RATE_LIMIT');

    // Non-existent user id without verified email still returns 404
    expect(() =>
      accountDeletionService.deleteMyAccount('does-not-exist', { username: 'social_oauth_24' }),
    ).toThrow('User account not found.');

    // Advance past 1 hour window, then verify Firebase-UID mismatch regression fix:
    // Caller authenticated with a Firebase UID differing from repository ID resolves cleanly via verified token email!
    clockService.advanceTime(61 * 60 * 1000);
    const { FirebaseStrategy } = await import('../auth/strategies/firebase.strategy');
    const fakeFirebaseService = {
      isEmulator: () => true,
      auth: {
        verifyIdToken: async () => ({
          uid: 'firebase-external-uid-xyz',
          email: socialUser.email,
          email_verified: true,
        }),
      },
    } as any;
    const strategy = new FirebaseStrategy(fakeFirebaseService, usersService, {} as any);
    const verifiedCaller = await strategy.verify({
      headers: { authorization: 'Bearer header.payload.signature' },
    });
    expect(verifiedCaller.uid).toBe(String(socialUser.id));

    // Deleting with case-insensitive typed username succeeds (200) and requires no password/code
    const finalRes = accountDeletionService.deleteMyAccount(
      'firebase-external-uid-xyz',
      { username: '  SOCIAL_OAUTH_24  ' },
      verifiedCaller.email,
    );
    expect(finalRes.success).toBe(true);
    expect(usersRepo.findById(socialUser.id)?.isDeleted).toBe(true);
    expect(usersRepo.findById(otherUser.id)?.isDeleted).toBeFalsy();

    // Deleted account whose uid matches repository id is immediately rejected by FirebaseStrategy
    fakeFirebaseService.auth.verifyIdToken = async () => ({
      uid: String(socialUser.id),
      email: socialUser.email,
      email_verified: true,
    });
    await expect(
      strategy.verify({ headers: { authorization: 'Bearer header.payload.signature2' } }),
    ).rejects.toThrow();
  });
});
