import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { ProjectsService } from '../projects/projects.service';
import { ProjectsController } from '../projects/projects.controller';
import { ProjectsRepository } from '../projects/projects.repository';
import { TasksService } from '../tasks/tasks.service';
import { TasksRepository } from '../tasks/tasks.repository';
import { TaskStatus } from '../tasks/dto/create-task.dto';
import { UsersRepository } from './users.repository';
import { GamificationRepository } from '../gamification/gamification.repository';
import { JoinRequestsService } from '../join-requests/join-requests.service';
import { ReputationService } from '../moderation/reputation.service';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from './dto/create-user.dto';

describe('Completed Projects & Collaborator Task Guard Spec', () => {
  let app: INestApplication;
  let usersService: UsersService;
  let projectsService: ProjectsService;
  let tasksService: TasksService;
  let projectsRepo: ProjectsRepository;
  let tasksRepo: TasksRepository;
  let usersRepo: UsersRepository;

  const OWNER_ID = 'owner-101';
  const COLLAB_WITH_TASK = 'collab-201';
  const COLLAB_ZERO_TASK = 'collab-202';
  const COLLAB_IN_PROGRESS_ONLY = 'collab-203';
  const MENTOR_ID = 'mentor-301';

  beforeEach(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_MODE = 'legacy';

    projectsRepo = new ProjectsRepository();
    tasksRepo = new TasksRepository();
    usersRepo = new UsersRepository();
    const gamificationRepo = new GamificationRepository();

    // Mock minimal required dependencies
    const mockJoinRequestsService: any = {
      findAll: () => [
        { id: 'req-1', userId: COLLAB_WITH_TASK, projectId: 'proj-completed-1', status: 'approved' },
        { id: 'req-2', userId: COLLAB_ZERO_TASK, projectId: 'proj-completed-1', status: 'approved' },
        { id: 'req-3', userId: COLLAB_IN_PROGRESS_ONLY, projectId: 'proj-completed-1', status: 'approved' },
      ],
      getMyRequestStatus: () => 'approved',
    };

    const mockAuditService: any = { log: () => {} };
    const mockNotificationsService: any = { create: () => {} };
    const mockFirebaseService: any = {};
    const mockReputationService: any = { getTotal: () => 100 };

    const mockPlatformConfigService: any = {
      getConfig: () => ({ maxCollaboratorsPerProject: 20, maxCollaboratorCapacity: 20 }),
    };

    const mockUsersServiceForProjects: any = {
      findById: (id: string) => usersRepo.findById(id),
      findUserSafe: (id: string) => usersRepo.findById(id),
      findAll: () => usersRepo.findAll(),
    };

    // Setup projectsService
    projectsService = new ProjectsService(
      projectsRepo,
      {} as any, // tasksService will be linked
      mockJoinRequestsService,
      mockNotificationsService,
      {} as any, // mentorMarketplaceService
      mockAuditService,
      mockPlatformConfigService,
      mockUsersServiceForProjects,
      { now: () => new Date(), nowIso: () => new Date().toISOString() } as any,
      {} as any, // gamificationService
      {} as any, // supportService
      { sanitizeText: (t: string) => t, checkContent: () => null } as any,
    );

    // Setup tasksService
    tasksService = new TasksService(
      tasksRepo,
      {} as any, // gamificationService
      projectsService,
      mockUsersServiceForProjects,
      mockAuditService,
      mockPlatformConfigService,
      mockNotificationsService,
    );
    (projectsService as any).tasksService = tasksService;

    // Seed users
    const ownerUser = { id: OWNER_ID, username: 'alice_owner', name: 'Alice Owner', email: 'alice@example.com', role: UserRole.ProjectOwner };
    const collabUser1 = { id: COLLAB_WITH_TASK, username: 'bob_active', name: 'Bob Active Collab', email: 'bob@example.com', role: UserRole.Collaborator };
    const collabUser2 = { id: COLLAB_ZERO_TASK, username: 'charlie_zero', name: 'Charlie Zero Tasks', email: 'charlie@example.com', role: UserRole.Collaborator };
    const collabUser3 = { id: COLLAB_IN_PROGRESS_ONLY, username: 'dave_inprog', name: 'Dave InProgress Only', email: 'dave@example.com', role: UserRole.Collaborator };
    const mentorUser = { id: MENTOR_ID, username: 'maya_mentor', name: 'Maya Mentor', email: 'maya@example.com', role: UserRole.Mentor };

    usersRepo.create(ownerUser as any);
    usersRepo.create(collabUser1 as any);
    usersRepo.create(collabUser2 as any);
    usersRepo.create(collabUser3 as any);
    usersRepo.create(mentorUser as any);

    // Seed Projects
    // 1. Completed Project with deliverable
    const completedProject = {
      id: 'proj-completed-1',
      title: 'Decentralized Identity Protocol',
      description: 'A sovereign identity protocol',
      status: 'completed',
      isCompleted: true,
      ownerId: OWNER_ID,
      owner: { id: OWNER_ID, name: 'Alice Owner' },
      mentorId: MENTOR_ID,
      mentor: { id: MENTOR_ID, name: 'Maya Mentor' },
      collaborators: [
        { id: COLLAB_WITH_TASK, name: 'Bob Active Collab' },
        { id: COLLAB_ZERO_TASK, name: 'Charlie Zero Tasks' },
        { id: COLLAB_IN_PROGRESS_ONLY, name: 'Dave InProgress Only' },
      ],
      finalLink: 'https://github.com/teamforge/identity-protocol',
      completedAt: '2026-04-01T12:00:00.000Z',
    };

    // 2. Open / In Progress Project
    const openProject = {
      id: 'proj-open-2',
      title: 'Quantum Simulator',
      description: 'Quantum simulation toolkit',
      status: 'in-progress',
      isCompleted: false,
      ownerId: OWNER_ID,
      owner: { id: OWNER_ID, name: 'Alice Owner' },
      collaborators: [{ id: COLLAB_WITH_TASK, name: 'Bob Active Collab' }],
    };

    // 3. Soft-Deleted Completed Project
    const deletedCompletedProject = {
      id: 'proj-deleted-completed-3',
      title: 'Deleted Legacy App',
      description: 'Deprecated archive',
      status: 'completed',
      isCompleted: true,
      deletedAt: new Date().toISOString(),
      ownerId: OWNER_ID,
      collaborators: [{ id: COLLAB_WITH_TASK, name: 'Bob Active Collab' }],
      finalLink: 'https://github.com/teamforge/deleted-archive',
    };

    projectsRepo.create(OWNER_ID, completedProject as any, 'Completed' as any);
    projectsRepo.create(OWNER_ID, openProject as any, 'In Progress' as any);
    projectsRepo.create(OWNER_ID, deletedCompletedProject as any, 'Completed' as any);

    // Seed Tasks for proj-completed-1
    // Task 1: Completed by COLLAB_WITH_TASK
    tasksRepo.create({
      id: 'task-1',
      projectId: 'proj-completed-1',
      title: 'Design smart contracts',
      status: TaskStatus.Completed,
      assigneeId: COLLAB_WITH_TASK,
      assignee: 'Bob Active Collab',
    } as any);

    // Task 2: InProgress only for COLLAB_IN_PROGRESS_ONLY
    tasksRepo.create({
      id: 'task-2',
      projectId: 'proj-completed-1',
      title: 'Draft documentation',
      status: TaskStatus.InProgress,
      assigneeId: COLLAB_IN_PROGRESS_ONLY,
      assignee: 'Dave InProgress Only',
    } as any);

    // Setup module for UsersService & Controllers
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [UsersController, ProjectsController],
      providers: [
        {
          provide: UsersService,
          useFactory: () => {
            const svc = new UsersService(
              usersRepo,
              gamificationRepo,
              {
                get: (type: any) => {
                  if (type === ProjectsService) return projectsService;
                  if (type === TasksService) return tasksService;
                  if (type === JoinRequestsService) return mockJoinRequestsService;
                  return null;
                },
              } as any,
              mockFirebaseService,
              mockAuditService,
              mockNotificationsService,
            );
            (svc as any).projectsService = projectsService;
            (svc as any).tasksService = tasksService;
            (svc as any).joinRequestsService = mockJoinRequestsService;
            (svc as any).reputationService = mockReputationService;
            return svc;
          },
        },
        { provide: ProjectsService, useValue: projectsService },
        { provide: TasksService, useValue: tasksService },
        { provide: JoinRequestsService, useValue: mockJoinRequestsService },
        { provide: ReputationService, useValue: mockReputationService },
      ],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    usersService = moduleRef.get<UsersService>(UsersService);

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  describe('1. Back-end Unit Tests: ProjectsService.findAll filtering', () => {
    it('projectsService.findAll() without status=all strips completed projects (marketplace default)', () => {
      const publicMarketplaceProjects = projectsService.findAll();
      const ids = publicMarketplaceProjects.map((p) => p.id);
      expect(ids).toContain('proj-open-2');
      expect(ids).not.toContain('proj-completed-1');
      expect(ids).not.toContain('proj-deleted-completed-3');
    });

    it('projectsService.findAll("all") includes completed projects while excluding soft-deleted projects', () => {
      const allProjects = projectsService.findAll('all');
      const ids = allProjects.map((p) => p.id);
      expect(ids).toContain('proj-completed-1');
      expect(ids).toContain('proj-open-2');
      expect(ids).not.toContain('proj-deleted-completed-3');
    });
  });

  describe('2. Back-end Unit Tests: UsersService.getApplicantProfile / getPublicProfile', () => {
    it('returns completed project for Project Owner with role Owner and deliverable link', async () => {
      const profile = await usersService.getApplicantProfile(OWNER_ID, OWNER_ID, 'project-owner');
      expect(profile).toBeDefined();
      expect(profile.completedProjects).toHaveLength(1);
      const cp = profile.completedProjects[0];
      expect(cp.id).toBe('proj-completed-1');
      expect(cp.title).toBe('Decentralized Identity Protocol');
      expect(cp.role).toBe('Owner');
      expect(cp.projectRole).toBe('Owner');
      expect(cp.link).toBe('https://github.com/teamforge/identity-protocol');
    });

    it('returns completed project for Mentor with role Mentor', async () => {
      const profile = await usersService.getApplicantProfile(MENTOR_ID, OWNER_ID, 'project-owner');
      expect(profile).toBeDefined();
      expect(profile.completedProjects).toHaveLength(1);
      const cp = profile.completedProjects[0];
      expect(cp.id).toBe('proj-completed-1');
      expect(cp.role).toBe('Mentor');
      expect(cp.projectRole).toBe('Mentor');
    });

    it('returns completed project for Collaborator who completed at least one task', async () => {
      const profile = await usersService.getApplicantProfile(COLLAB_WITH_TASK, OWNER_ID, 'project-owner');
      expect(profile).toBeDefined();
      expect(profile.completedProjects).toHaveLength(1);
      const cp = profile.completedProjects[0];
      expect(cp.id).toBe('proj-completed-1');
      expect(cp.projectRole).toBe('Collaborator');
      expect(cp.role).toBe('Collaborator');
    });

    it('excludes completed project for Collaborator with 0 completed tasks (joined but no tasks)', async () => {
      const profile = await usersService.getApplicantProfile(COLLAB_ZERO_TASK, OWNER_ID, 'project-owner');
      expect(profile).toBeDefined();
      expect(profile.completedProjects).toHaveLength(0);
    });

    it('excludes completed project for Collaborator who only has In-Progress tasks (0 completed/approved)', async () => {
      const profile = await usersService.getApplicantProfile(COLLAB_IN_PROGRESS_ONLY, OWNER_ID, 'project-owner');
      expect(profile).toBeDefined();
      expect(profile.completedProjects).toHaveLength(0);
    });

    it('excludes soft-deleted and deletion-scheduled completed projects from all profiles', async () => {
      const profile = await usersService.getApplicantProfile(OWNER_ID, OWNER_ID, 'project-owner');
      const ids = profile.completedProjects.map((p: any) => p.id);
      expect(ids).not.toContain('proj-deleted-completed-3');
    });
  });

  describe('3. Supertest API Integration Tests', () => {
    it('GET /projects without status=all excludes completed projects from marketplace', async () => {
      const res = await request(app.getHttpServer()).get('/projects');
      expect(res.status).toBe(200);
      const items = Array.isArray(res.body) ? res.body : res.body.data;
      const ids = items.map((p: any) => p.id);
      expect(ids).toContain('proj-open-2');
      expect(ids).not.toContain('proj-completed-1');
    });

    it('GET /projects?status=all includes completed projects', async () => {
      const res = await request(app.getHttpServer()).get('/projects?status=all');
      expect(res.status).toBe(200);
      const items = Array.isArray(res.body) ? res.body : res.body.data;
      const ids = items.map((p: any) => p.id);
      expect(ids).toContain('proj-completed-1');
      expect(ids).toContain('proj-open-2');
    });

    it('GET /users/:id/public-profile returns filtered completedProjects with role, projectRole, and link', async () => {
      // 1. Authorized Owner checks collaborator with completed task
      const res1 = await request(app.getHttpServer())
        .get(`/users/${COLLAB_WITH_TASK}/public-profile`)
        .set('x-user-id', OWNER_ID)
        .set('x-user-role', 'project-owner');
      expect(res1.status).toBe(200);
      expect(res1.body.completedProjects).toHaveLength(1);
      expect(res1.body.completedProjects[0].id).toBe('proj-completed-1');
      expect(res1.body.completedProjects[0].projectRole).toBe('Collaborator');
      expect(res1.body.completedProjects[0].link).toBe('https://github.com/teamforge/identity-protocol');

      // 2. Authorized Owner checks collaborator with zero completed tasks
      const res2 = await request(app.getHttpServer())
        .get(`/users/${COLLAB_ZERO_TASK}/public-profile`)
        .set('x-user-id', OWNER_ID)
        .set('x-user-role', 'project-owner');
      expect(res2.status).toBe(200);
      expect(res2.body.completedProjects).toHaveLength(0);
    });
  });
});
