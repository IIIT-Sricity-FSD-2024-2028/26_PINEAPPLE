import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { ProjectsService } from '../projects/projects.service';
import { ProjectsRepository } from '../projects/projects.repository';
import { ProjectStatus, ProjectDifficulty } from '../projects/dto/create-project.dto';
import { TasksService } from '../tasks/tasks.service';
import { TasksRepository } from '../tasks/tasks.repository';
import { JoinRequestsService } from '../join-requests/join-requests.service';
import { GamificationRepository } from '../gamification/gamification.repository';
import { ReputationService } from '../moderation/reputation.service';
import { MentorMarketplaceService } from '../mentor-marketplace/mentor-marketplace.service';
import { MentorMarketplaceController } from '../mentor-marketplace/mentor-marketplace.controller';
import { EscrowService } from '../escrow/escrow.service';
import { DemoUpiProvider } from '../mentor-marketplace/payments/demo-upi.provider';
import { ClockService } from '../common/services/clock.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AdminService } from '../admin/admin.service';
import { PlatformConfigService } from '../platform-config/platform-config.service';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from './dto/create-user.dto';

describe('Phase 2: Mentor Profile Mentored Projects Parity Spec', () => {
  let app: INestApplication;
  let usersRepo: UsersRepository;
  let projectsRepo: ProjectsRepository;
  let tasksRepo: TasksRepository;
  let projectsService: ProjectsService;
  let usersService: UsersService;
  let marketplaceService: MentorMarketplaceService;
  let adminService: AdminService;
  let clockService: ClockService;

  const OWNER_ID = 'owner-p2';
  const MENTOR_ID = 'mentor-p2';
  const OTHER_MENTOR_ID = 'other-mentor-p2';
  const COLLAB_ID = 'collab-p2';

  beforeEach(async () => {
    process.env.AUTH_MODE = 'legacy';
    process.env.NODE_ENV = 'test';

    clockService = new ClockService();
    clockService.setTime('2026-06-15T12:00:00.000Z');

    usersRepo = new UsersRepository();
    (usersRepo as any).users = [];
    (usersRepo as any).rebuildIndexes?.();

    projectsRepo = new ProjectsRepository();
    (projectsRepo as any).projects = [];
    (projectsRepo as any).rebuildIndexes?.();

    tasksRepo = new TasksRepository();
    (tasksRepo as any).tasks = [];

    const gamificationRepo = new GamificationRepository();
    (gamificationRepo as any).ledger = [];

    const notificationsService = new NotificationsService();
    const auditService: any = { log: () => undefined, findAll: () => [] };
    const platformConfigService: any = {
      getConfig: () => ({ maxCollaboratorsPerProject: 20, maxActiveMentorshipsPerMentor: 5 }),
    };

    const reputationService = new ReputationService(clockService, gamificationRepo, usersRepo, auditService);

    usersService = new UsersService(
      usersRepo,
      gamificationRepo,
      null as any,
      {} as any,
      auditService,
      notificationsService,
      clockService,
      undefined,
      undefined,
      reputationService,
    );

    const joinRequestsService: any = {
      findAll: () => [],
      findByProject: () => [],
      completeApprovedRequests: () => undefined,
    };

    const escrowService = new EscrowService();
    const paymentProvider = new DemoUpiProvider(clockService);
    const mentorAppsService: any = {
      isMentorVerified: () => true,
      findByUser: (uid: string) => [{ id: `app-${uid}`, userId: uid, status: 'approved' }],
      findByStatus: () => [],
      deriveMentorStatus: () => ({ status: 'approved', mentorUnlocked: true }),
    };

    marketplaceService = new MentorMarketplaceService(
      escrowService,
      { recordTransaction: () => undefined } as any,
      usersService,
      { awardBadges: () => undefined, awardXp: () => undefined } as any,
      notificationsService,
      mentorAppsService,
      projectsRepo,
      auditService,
      paymentProvider,
      clockService,
    );
    (marketplaceService as any).sessions = [];
    (marketplaceService as any).profiles = [];
    (marketplaceService as any).disputes = [];
    (marketplaceService as any).abandonmentReviews = [];
    (marketplaceService as any).mentorActivities = [];

    projectsService = new ProjectsService(
      projectsRepo,
      {} as any,
      joinRequestsService,
      notificationsService,
      marketplaceService,
      auditService,
      platformConfigService,
      usersService,
      clockService,
      { awardProjectCompletion: () => ({ badgeAwarded: false }), awardBadges: () => undefined, awardXp: () => undefined } as any,
      {} as any,
      { sanitizeText: (t: string) => t, checkContent: () => null } as any,
    );

    const tasksService = new TasksService(
      tasksRepo,
      {} as any,
      projectsService,
      usersService,
      auditService,
      platformConfigService,
      notificationsService,
      clockService,
    );
    (projectsService as any).tasksService = tasksService;
    (usersService as any).projectsService = projectsService;
    (usersService as any).joinRequestsService = joinRequestsService;
    (usersService as any).tasksService = tasksService;
    (usersService as any).mentorMarketplaceService = marketplaceService;

    adminService = new AdminService(
      usersService,
      projectsService,
      tasksService,
      auditService,
      mentorAppsService,
      {} as any, // portalAdminsService
      platformConfigService,
      notificationsService,
      {} as any, // jwtService
      {} as any, // firebaseService
      {} as any, // mailService
      {} as any, // gamificationService
      marketplaceService,
      clockService,
      undefined,
      undefined,
      undefined,
      reputationService,
    );

    // Seed users
    usersRepo.create({
      id: OWNER_ID,
      username: 'ownerp2',
      name: 'Priya Owner',
      email: 'ownerp2@example.com',
      role: UserRole.ProjectOwner,
    });
    usersRepo.create({
      id: MENTOR_ID,
      username: 'mentorp2',
      name: 'Kiran Mentor',
      email: 'mentorp2@example.com',
      role: UserRole.Mentor,
    });
    usersRepo.create({
      id: OTHER_MENTOR_ID,
      username: 'othermentorp2',
      name: 'Other Mentor',
      email: 'other@example.com',
      role: UserRole.Mentor,
    });
    usersRepo.create({
      id: COLLAB_ID,
      username: 'collabp2',
      name: 'Arjun Collab',
      email: 'collabp2@example.com',
      role: UserRole.Collaborator,
    });

    // Seed mentor profiles
    (marketplaceService as any).profiles.push(
      {
        id: 'mp-1',
        userId: MENTOR_ID,
        name: 'Kiran Mentor',
        title: 'Architect',
        bio: 'Experienced mentor',
        skills: ['React', 'Node.js'],
        sessionPrice: 1500,
        isAvailable: true,
        maxActiveMentees: 5,
      },
      {
        id: 'mp-2',
        userId: OTHER_MENTOR_ID,
        name: 'Other Mentor',
        title: 'Lead',
        bio: 'Other mentor',
        skills: ['Python'],
        sessionPrice: 1200,
        isAvailable: true,
        maxActiveMentees: 5,
      },
    );

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [UsersController, MentorMarketplaceController],
      providers: [
        { provide: UsersService, useValue: usersService },
        { provide: MentorMarketplaceService, useValue: marketplaceService },
        { provide: ReputationService, useValue: reputationService },
        { provide: UsersRepository, useValue: usersRepo },
        { provide: ProjectsService, useValue: projectsService },
        { provide: TasksService, useValue: tasksService },
        { provide: JoinRequestsService, useValue: joinRequestsService },
        { provide: PlatformConfigService, useValue: platformConfigService },
        { provide: 'DataExportService', useValue: {} },
        { provide: 'AccountDeletionService', useValue: {} },
      ],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideProvider(UsersController)
      .useFactory({
        factory: () =>
          new UsersController(
            usersService,
            reputationService,
            { get: (token: any) => (token === MentorMarketplaceService ? marketplaceService : undefined) } as any,
          ),
      })
      .overrideProvider(MentorMarketplaceController)
      .useFactory({
        factory: () => new MentorMarketplaceController(marketplaceService),
      })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  function seedScenarioProjects() {
    // 1. Active mentored project
    const pActive = projectsRepo.create(
      OWNER_ID,
      {
        title: 'Active Mentored SaaS',
        description: 'Building SaaS platform',
        difficulty: ProjectDifficulty.Medium,
        requiredSkills: ['React'],
        dueDate: '2026-12-01T00:00:00.000Z',
      },
      ProjectStatus.InProgress,
    );
    projectsRepo.update(pActive.id, { mentorId: MENTOR_ID, mentor: 'Kiran Mentor' });
    (marketplaceService as any).sessions.push({
      id: 'sess-active',
      mentorId: 'mp-1',
      studentId: OWNER_ID,
      projectId: pActive.id,
      agreedPrice: 1500,
      escrowId: 'esc-1',
      status: 'active',
      createdAt: '2026-06-01T10:00:00.000Z',
      startedAt: '2026-06-02T10:00:00.000Z',
    });

    // 2. Completed mentored project (already completed)
    const pCompleted = projectsRepo.create(
      OWNER_ID,
      {
        title: 'Completed AI Pipeline',
        description: 'Completed pipeline',
        difficulty: ProjectDifficulty.Hard,
        requiredSkills: ['Python'],
        dueDate: '2026-12-01T00:00:00.000Z',
      },
      ProjectStatus.Completed,
    );
    projectsRepo.update(pCompleted.id, {
      mentorId: MENTOR_ID,
      mentor: 'Kiran Mentor',
      isCompleted: true,
      completedAt: '2026-06-10T10:00:00.000Z',
      finalLink: 'https://github.com/teamforge/ai-pipeline',
      finishedLink: 'https://github.com/teamforge/ai-pipeline',
    });
    (marketplaceService as any).sessions.push({
      id: 'sess-comp',
      mentorId: 'mp-1',
      studentId: OWNER_ID,
      projectId: pCompleted.id,
      agreedPrice: 1500,
      escrowId: 'esc-2',
      status: 'completed',
      createdAt: '2026-05-01T10:00:00.000Z',
      startedAt: '2026-05-02T10:00:00.000Z',
      completedAt: '2026-06-10T10:00:00.000Z',
    });

    // 3. Released via abandonment review (excluded)
    const pReleased = projectsRepo.create(
      OWNER_ID,
      {
        title: 'Released Abandonment Project',
        description: 'Mentor released',
        difficulty: ProjectDifficulty.Easy,
        requiredSkills: ['HTML'],
        dueDate: '2026-12-01T00:00:00.000Z',
      },
      ProjectStatus.Open,
    );
    (marketplaceService as any).sessions.push({
      id: 'sess-rel',
      mentorId: 'mp-1',
      studentId: OWNER_ID,
      projectId: pReleased.id,
      agreedPrice: 1000,
      escrowId: 'esc-3',
      status: 'refunded',
      createdAt: '2026-05-10T10:00:00.000Z',
      startedAt: '2026-05-11T10:00:00.000Z',
    });
    (marketplaceService as any).abandonmentReviews.push({
      id: 'rev-1',
      projectId: pReleased.id,
      mentorId: MENTOR_ID,
      status: 'released',
      openedAt: '2026-05-15T10:00:00.000Z',
      deadlineAt: '2026-05-17T10:00:00.000Z',
    });

    // 4. Refunded before start (excluded)
    const pRefundedBeforeStart = projectsRepo.create(
      OWNER_ID,
      {
        title: 'Refunded Unstarted Project',
        description: 'Cancelled before start',
        difficulty: ProjectDifficulty.Easy,
        requiredSkills: ['CSS'],
        dueDate: '2026-12-01T00:00:00.000Z',
      },
      ProjectStatus.Open,
    );
    (marketplaceService as any).sessions.push({
      id: 'sess-unstarted',
      mentorId: 'mp-1',
      studentId: OWNER_ID,
      projectId: pRefundedBeforeStart.id,
      agreedPrice: 1000,
      escrowId: 'esc-4',
      status: 'refunded',
      createdAt: '2026-05-20T10:00:00.000Z',
    });

    // 5. Soft-deleted mentored project (excluded)
    const pDeleted = projectsRepo.create(
      OWNER_ID,
      {
        title: 'Deleted Mentored Project',
        description: 'Deleted',
        difficulty: ProjectDifficulty.Medium,
        requiredSkills: ['Node.js'],
        dueDate: '2026-12-01T00:00:00.000Z',
      },
      ProjectStatus.InProgress,
    );
    projectsRepo.update(pDeleted.id, {
      mentorId: MENTOR_ID,
      mentor: 'Kiran Mentor',
      deletedAt: '2026-06-12T00:00:00.000Z',
    });
    (marketplaceService as any).sessions.push({
      id: 'sess-del',
      mentorId: 'mp-1',
      studentId: OWNER_ID,
      projectId: pDeleted.id,
      agreedPrice: 1500,
      escrowId: 'esc-5',
      status: 'active',
      startedAt: '2026-06-03T10:00:00.000Z',
    });

    // 6. Different mentor's project (excluded for MENTOR_ID)
    const pOtherMentor = projectsRepo.create(
      OWNER_ID,
      {
        title: 'Other Mentor Project',
        description: 'Belongs to another mentor',
        difficulty: ProjectDifficulty.Medium,
        requiredSkills: ['Python'],
        dueDate: '2026-12-01T00:00:00.000Z',
      },
      ProjectStatus.Completed,
    );
    projectsRepo.update(pOtherMentor.id, {
      mentorId: OTHER_MENTOR_ID,
      mentor: 'Other Mentor',
      isCompleted: true,
      completedAt: '2026-06-08T10:00:00.000Z',
      finalLink: 'https://github.com/teamforge/other',
    });
    (marketplaceService as any).sessions.push({
      id: 'sess-other',
      mentorId: 'mp-2',
      studentId: OWNER_ID,
      projectId: pOtherMentor.id,
      agreedPrice: 1200,
      escrowId: 'esc-6',
      status: 'completed',
      startedAt: '2026-05-05T10:00:00.000Z',
    });

    return { pActive, pCompleted, pReleased, pRefundedBeforeStart, pDeleted, pOtherMentor };
  }

  describe('1. Shared Function getMentoredProjectsForUser(userId)', () => {
    it('includes active and completed mentored projects and excludes released, unstarted-refunded, deleted, and other mentors', () => {
      const { pActive, pCompleted } = seedScenarioProjects();

      const ownRes = (marketplaceService as any).getMentoredProjectsForUser(MENTOR_ID);
      expect(ownRes.items).toHaveLength(2);
      expect(ownRes.counts).toEqual({ all: 2, active: 1, completed: 1 });

      const activeItem = ownRes.items.find((i: any) => i.projectId === pActive.id);
      expect(activeItem).toBeDefined();
      expect(activeItem.title).toBe('Active Mentored SaaS');
      expect(activeItem.ownerName).toBe('Priya Owner');
      expect(activeItem.acceptedAt).toBe('2026-06-02T10:00:00.000Z');
      expect(activeItem.tab).toBe('active');

      const completedItem = ownRes.items.find((i: any) => i.projectId === pCompleted.id);
      expect(completedItem).toBeDefined();
      expect(completedItem.title).toBe('Completed AI Pipeline');
      expect(completedItem.ownerName).toBe('Priya Owner');
      expect(completedItem.status).toBe('Completed');
      expect(completedItem.completedAt).toBe('2026-06-10T10:00:00.000Z');
      expect(completedItem.finalLink).toBe('https://github.com/teamforge/ai-pipeline');
      expect(completedItem.tab).toBe('completed');

      // completedOnly option (public profile view)
      const publicRes = (marketplaceService as any).getMentoredProjectsForUser(MENTOR_ID, {
        completedOnly: true,
      });
      expect(publicRes.items).toHaveLength(1);
      expect(publicRes.items[0].projectId).toBe(pCompleted.id);
    });
  });

  describe('2. Completion Record & Startup Backfill', () => {
    it('records mentor in completion metadata on completeProject without mixing mentor into collaborators, and backfills legacy completed projects on startup', () => {
      const { pActive, pCompleted } = seedScenarioProjects();
      (tasksRepo as any).tasks.push({
        id: 'task-approved-p2',
        projectId: pActive.id,
        title: 'API Integration',
        status: 'Completed',
        assigneeId: COLLAB_ID,
      });
      // Complete pActive via ProjectsService.completeProject
      const completed = projectsService.completeProject(
        pActive.id,
        OWNER_ID,
        'https://github.com/teamforge/saas-done',
      );

      expect((completed as any).completedMentorUserId).toBe(MENTOR_ID);
      expect((completed as any).completedMemberIds).toContain(MENTOR_ID);
      expect(completed.collaborators).toHaveLength(0);

      // pCompleted initially lacks completedMentorUserId / completedMemberIds
      expect((projectsRepo.findById(pCompleted.id) as any).completedMentorUserId).toBeUndefined();

      // Run startup backfill
      const fixedCount = (projectsService as any).backfillCompletedProjectMentors();
      expect(fixedCount).toBeGreaterThanOrEqual(1);

      const backfilled = projectsRepo.findById(pCompleted.id) as any;
      expect(backfilled.completedMentorUserId).toBe(MENTOR_ID);
      expect(backfilled.completedMemberIds).toContain(MENTOR_ID);
      expect(backfilled.collaborators).toHaveLength(0);
    });
  });

  describe('3. API Parity: /users/me, /users/:id/public-profile, /mentor-marketplace/mentored-projects, and Admin Detail', () => {
    it('returns identical mentored projects on /users/me and /mentor-marketplace/mentored-projects, completed-only on public profile, and includes mentor projects in admin detail', async () => {
      const { pActive, pCompleted } = seedScenarioProjects();

      // Mentor's own /users/me
      const meRes = await request(app.getHttpServer())
        .get('/users/me')
        .set('x-user-id', MENTOR_ID)
        .set('x-user-role', 'mentor');
      expect(meRes.status).toBe(200);
      const meMentored = meRes.body.mentoredProjects || meRes.body.data?.mentoredProjects || [];
      expect(meMentored).toHaveLength(2);
      expect(meMentored.map((m: any) => m.projectId).sort()).toEqual([pActive.id, pCompleted.id].sort());

      // Mentored Projects workspace endpoint
      const wsRes = await request(app.getHttpServer())
        .get('/mentor-marketplace/mentored-projects')
        .set('x-user-id', MENTOR_ID)
        .set('x-user-role', 'mentor');
      expect(wsRes.status).toBe(200);
      expect(wsRes.body.items.map((m: any) => m.projectId).sort()).toEqual(
        meMentored.map((m: any) => m.projectId).sort(),
      );

      // Public profile viewed by owner (completed projects only)
      const pubRes = await request(app.getHttpServer())
        .get(`/users/${MENTOR_ID}/public-profile`)
        .set('x-user-id', OWNER_ID)
        .set('x-user-role', 'project-owner');
      expect(pubRes.status).toBe(200);
      expect(pubRes.body.mentoredProjects).toHaveLength(1);
      expect(pubRes.body.mentoredProjects[0].projectId).toBe(pCompleted.id);
      expect(pubRes.body.mentoredProjects[0].finalLink).toBe('https://github.com/teamforge/ai-pipeline');

      // Collaborator / unrelated user's profile has 0 mentored projects
      const collabMeRes = await request(app.getHttpServer())
        .get('/users/me')
        .set('x-user-id', COLLAB_ID)
        .set('x-user-role', 'collaborator');
      expect(collabMeRes.status).toBe(200);
      expect(collabMeRes.body.mentoredProjects || []).toHaveLength(0);

      // Admin mentor detail includes mentored projects via shared helper
      const adminDetail = adminService.getUserDetails(MENTOR_ID);
      expect(adminDetail.mentoredProjects).toHaveLength(2);
      expect(adminDetail.projects.some((p: any) => p.id === pCompleted.id && p.role === 'Mentor')).toBe(true);
    });
  });
});
