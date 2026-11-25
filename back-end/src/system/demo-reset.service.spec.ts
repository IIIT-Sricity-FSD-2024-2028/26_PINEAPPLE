import { Test } from '@nestjs/testing';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AppModule } from '../app.module';
import { MailService } from '../mail/mail.service';
import { ClockService } from '../common/services/clock.service';
import { DemoResetService } from './demo-reset.service';
import { JobsService } from '../jobs/jobs.service';
import { UsersRepository } from '../users/users.repository';
import { ProjectsRepository } from '../projects/projects.repository';
import { TasksRepository } from '../tasks/tasks.repository';
import { GamificationRepository } from '../gamification/gamification.repository';
import { CommunicationRepository } from '../communication/communication.repository';
import { MentorshipRepository } from '../mentorship/mentorship.repository';
import { GovernanceRepository } from '../governance/governance.repository';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { PlatformConfigService } from '../platform-config/platform-config.service';
import { ReputationService } from '../moderation/reputation.service';
import { SEED_USER_REPUTATION } from '../moderation/reputation.seeds';
import { EscrowService } from '../escrow/escrow.service';
import { MentorMarketplaceService } from '../mentor-marketplace/mentor-marketplace.service';

describe('Demo Reset Feature Unit Tests', () => {
  let appRef: { close: () => Promise<void> };
  let tempRoot: string;
  let demoResetService: DemoResetService;
  let jobsService: JobsService;
  let clockService: ClockService;
  let usersRepo: UsersRepository;
  let projectsRepo: ProjectsRepository;
  let tasksRepo: TasksRepository;
  let gamificationRepo: GamificationRepository;
  let commRepo: CommunicationRepository;
  let mentorshipRepo: MentorshipRepository;
  let governanceRepo: GovernanceRepository;
  let notificationsService: NotificationsService;
  let auditService: AuditService;
  let platformConfigService: PlatformConfigService;
  let reputationService: ReputationService;
  let sentMailsCount = 0;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.SCHEDULER_ENABLED = 'false';
    process.env.ALLOW_DEMO_RESET = 'true';
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-demo-reset-unit-'));

    const mailMock: any = {
      sendEmailVerificationEmail: async () => { sentMailsCount += 1; return { success: true }; },
      sendPasswordResetEmail: async () => { sentMailsCount += 1; return { success: true }; },
      sendMail: async () => { sentMailsCount += 1; return { success: true }; },
    };

    const mod = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailService)
      .useValue(mailMock)
      .compile();

    const app = mod.createNestApplication();
    await app.init();
    appRef = app;

    demoResetService = app.get(DemoResetService);
    jobsService = app.get(JobsService);
    clockService = app.get(ClockService);
    usersRepo = app.get(UsersRepository);
    projectsRepo = app.get(ProjectsRepository);
    tasksRepo = app.get(TasksRepository);
    gamificationRepo = app.get(GamificationRepository);
    commRepo = app.get(CommunicationRepository);
    mentorshipRepo = app.get(MentorshipRepository);
    governanceRepo = app.get(GovernanceRepository);
    notificationsService = app.get(NotificationsService);
    auditService = app.get(AuditService);
    platformConfigService = app.get(PlatformConfigService);
    reputationService = app.get(ReputationService);
  });

  afterAll(async () => {
    delete process.env.ALLOW_DEMO_RESET;
    if (appRef) await appRef.close();
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    } catch {}
  });

  beforeEach(() => {
    sentMailsCount = 0;
    clockService.reset();
    demoResetService.resetRateLimitForTesting();
  });

  it('1. Each repository resetToSeed() matches a freshly constructed instance', () => {
    usersRepo.create({
      name: 'Temp Extra',
      username: 'temp_extra',
      email: 'temp.extra@test.local',
      password: 'Password123!',
    });
    projectsRepo.create(
      '1',
      {
        title: 'Extra Project For Unit Check',
        description: 'Added before resetToSeed verification across repositories in unit tests.',
        dueDate: '2028-01-01T00:00:00.000Z',
      } as any,
      'Open' as any,
    );
    tasksRepo.create({
      projectId: 'proj-1',
      title: 'Extra Task',
      dueDate: '2028-01-01T00:00:00.000Z',
    } as any);
    gamificationRepo.addLedgerEntry({
      id: 'extra-xp',
      userId: '2',
      taskId: null,
      projectId: null,
      xp: 999,
      reason: 'Extra test XP',
      date: new Date().toISOString(),
    });
    platformConfigService.updateConfig({ maxProjectsPerUser: 99, platformVersion: '9.9.9' });
    notificationsService.create({ userId: '2', type: 'INFO', title: 'Extra', message: 'Extra' });
    auditService.log({ action: 'EXTRA', actor: 'test', target: 'test' });

    usersRepo.resetToSeed();
    projectsRepo.resetToSeed();
    tasksRepo.resetToSeed();
    gamificationRepo.resetToSeed();
    commRepo.resetToSeed();
    mentorshipRepo.resetToSeed();
    governanceRepo.resetToSeed();
    notificationsService.resetToSeed();
    auditService.resetToSeed();
    platformConfigService.resetToSeed();

    const freshUsers = new UsersRepository();
    const freshProjects = new ProjectsRepository();
    const freshTasks = new TasksRepository();
    const freshGamification = new GamificationRepository();
    const freshComm = new CommunicationRepository(freshUsers, freshProjects);
    const freshMentorship = new MentorshipRepository();
    const freshGovernance = new GovernanceRepository();
    const freshConfig = new PlatformConfigService();

    expect(usersRepo.findAll(true).map((u) => u.id)).toEqual(freshUsers.findAll(true).map((u) => u.id));
    expect(projectsRepo.findAll(true).map((p) => p.id)).toEqual(freshProjects.findAll(true).map((p) => p.id));
    expect(tasksRepo.findAll().map((t) => t.id)).toEqual(freshTasks.findAll().map((t) => t.id));
    expect(gamificationRepo.findAll().length).toBe(freshGamification.findAll().length);
    expect(commRepo.getAllMessages().map((m) => m.id)).toEqual(freshComm.getAllMessages().map((m) => m.id));
    expect(mentorshipRepo.getAllBadges().map((b) => b.id)).toEqual(
      freshMentorship.getAllBadges().map((b) => b.id),
    );
    expect((mentorshipRepo as any).applications.map((a: any) => a.id)).toEqual(
      (freshMentorship as any).applications.map((a: any) => a.id),
    );
    expect((governanceRepo as any).reports.map((g: any) => g.id)).toEqual(
      (freshGovernance as any).reports.map((g: any) => g.id),
    );
    expect(notificationsService.findAll().map((n) => n.id)).toEqual(['notif-4', 'notif-2', 'notif-1']);
    expect(auditService.count()).toBe(9);
    expect(platformConfigService.getConfig()).toEqual(freshConfig.getConfig());
  });

  it('2. Reputation equals seed totals after one reset and two resets in a row (never doubled, idempotent, no mail/notifications)', async () => {
    reputationService.recordWarning('2', 'warn-demo-1');
    const beforeNotifs = 3; // notif-1, notif-2, notif-4

    await demoResetService.reset('u-superuser', 'Super User');
    for (const [uid, expectedRep] of Object.entries(SEED_USER_REPUTATION)) {
      expect(reputationService.getTotal(uid)).toBe(expectedRep);
    }
    expect(notificationsService.findAll()).toHaveLength(beforeNotifs);
    expect(sentMailsCount).toBe(0);

    await demoResetService.reset('u-superuser', 'Super User');
    for (const [uid, expectedRep] of Object.entries(SEED_USER_REPUTATION)) {
      expect(reputationService.getTotal(uid)).toBe(expectedRep);
    }
    expect(notificationsService.findAll()).toHaveLength(beforeNotifs);
    expect(sentMailsCount).toBe(0);
  });

  it('3. Scheduler timer is paused during reset and resumed after; failing step turns maintenance off and throws 500 RESET_FAILED', async () => {
    let observedPausedDuringReset = false;
    let observedMaintenanceDuringReset = false;

    await demoResetService.reset('u-superuser', 'Super User', {
      onAfterResetBeforeResume: () => {
        observedPausedDuringReset = jobsService.isSchedulerPaused();
        observedMaintenanceDuringReset = DemoResetService.isMaintenanceMode();
      },
    });

    expect(observedPausedDuringReset).toBe(true);
    expect(observedMaintenanceDuringReset).toBe(true);
    expect(jobsService.isSchedulerPaused()).toBe(false);
    expect(DemoResetService.isMaintenanceMode()).toBe(false);
    expect(demoResetService.isResetInProgress()).toBe(false);

    let caughtErr: any;
    try {
      await demoResetService.reset('u-superuser', 'Super User', {
        onAfterResetBeforeResume: () => {
          throw new Error('Simulation error');
        },
      });
    } catch (e) {
      caughtErr = e;
    }

    expect(caughtErr?.getStatus?.()).toBe(500);
    expect(caughtErr?.getResponse?.()?.code).toBe('RESET_FAILED');
    expect(caughtErr?.getResponse?.()?.step).toBe('test_hook');
    expect(DemoResetService.isMaintenanceMode()).toBe(false);
    expect(jobsService.isSchedulerPaused()).toBe(false);
    expect(demoResetService.isResetInProgress()).toBe(false);
  });

  it('4. Startup MentorMarketplace + Escrow seed counts remain exact across resets', async () => {
    const escrowService = (appRef as any).get(EscrowService);
    const mentorService = (appRef as any).get(MentorMarketplaceService);

    await demoResetService.reset('u-superuser', 'Super User');
    expect(mentorService.findAllSessions().filter((s: any) => s.status === 'active')).toHaveLength(2);
    expect(escrowService.findAll().length).toBe(3); // 2 active funded + 1 refunded duplicate from startup reconcile
  });
});
