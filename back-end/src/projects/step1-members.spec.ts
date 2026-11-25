import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsService } from './projects.service';
import { ProjectsRepository } from './projects.repository';
import { TasksService } from '../tasks/tasks.service';
import { JoinRequestsService } from '../join-requests/join-requests.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MentorMarketplaceService } from '../mentor-marketplace/mentor-marketplace.service';
import { AuditService } from '../audit/audit.service';
import { PlatformConfigService } from '../platform-config/platform-config.service';
import { UsersService } from '../users/users.service';
import { ClockService } from '../common/services/clock.service';
import { GamificationService } from '../gamification/gamification.service';
import { SupportService } from '../support/support.service';
import { ContentFilterService } from '../common/services/content-filter.service';
import { DuplicateDetectionService } from '../users/duplicate-detection.service';
import { ProjectInvitesService } from './invites.service';
import { FeedbackService } from '../feedback/feedback.service';
import { DeletionPolicyService } from './deletion-policy.service';
import { getApprovedCollaboratorsCount } from '../common/utils/capacity.util';

describe('Step 1 Unit Tests: Single Members List Builder & Role Priority', () => {
  let service: ProjectsService;
  let warnSpy: any;

  const mockUsersService = {
    findUserSafe: jest.fn((id: string) => {
      const users: Record<string, any> = {
        'owner-1': { id: 'owner-1', name: 'Alice Owner', username: 'alice', isDeleted: false },
        'collab-1': { id: 'collab-1', name: 'Bob Collab', username: 'bob', isDeleted: false },
        'collab-2': { id: 'collab-2', name: 'Charlie Collab', username: 'charlie', isDeleted: false },
        'mentor-1': { id: 'mentor-1', name: 'Diana Mentor', username: 'diana', isDeleted: false },
        'multi-user': { id: 'multi-user', name: 'Multi Role User', username: 'multi', isDeleted: false },
      };
      return users[id] || null;
    }),
  };

  const mockTasksService = {
    findAllByProjectId: jest.fn(() => []),
  };

  const mockMentorMarketplaceService = {
    getSessionsByProject: jest.fn(() => []),
    getMentor: jest.fn(),
  };

  const mockPlatformConfigService = {
    getConfig: jest.fn(() => ({ maxCollaboratorsPerProject: 5, maxCollaboratorCapacity: 20 })),
  };

  const mockProjectsRepository = {
    findById: jest.fn(),
    findAll: jest.fn(() => []),
    update: jest.fn(),
  };

  beforeEach(async () => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: ProjectsRepository, useValue: mockProjectsRepository },
        { provide: TasksService, useValue: mockTasksService },
        { provide: JoinRequestsService, useValue: {} },
        { provide: NotificationsService, useValue: { create: jest.fn() } },
        { provide: MentorMarketplaceService, useValue: mockMentorMarketplaceService },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: PlatformConfigService, useValue: mockPlatformConfigService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: ClockService, useValue: { now: () => new Date(), nowIso: () => new Date().toISOString() } },
        { provide: GamificationService, useValue: {} },
        { provide: SupportService, useValue: {} },
        { provide: ContentFilterService, useValue: { sanitizeText: (t: string) => t, checkContent: () => null } },
        { provide: DuplicateDetectionService, useValue: {} },
        { provide: ProjectInvitesService, useValue: {} },
        { provide: FeedbackService, useValue: {} },
        { provide: DeletionPolicyService, useValue: {} },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    jest.clearAllMocks();
  });

  describe('1. List builder with owner only', () => {
    it('returns exactly one row with role Owner', () => {
      const project: any = {
        id: 'proj-1',
        ownerId: 'owner-1',
        collaborators: [],
        members: [],
        mentorId: null,
      };

      const list = service.buildProjectMembersList(project);
      expect(list).toHaveLength(1);
      expect(list[0].userId).toBe('owner-1');
      expect(list[0].role).toBe('Owner');
      expect(list[0].name).toBe('Alice Owner');
    });
  });

  describe('2. List builder with owner + collaborators', () => {
    it('returns owner and distinct collaborators', () => {
      const project: any = {
        id: 'proj-2',
        ownerId: 'owner-1',
        collaborators: [
          { id: 'collab-1', name: 'Bob Collab', role: 'Collaborator' },
          { id: 'collab-2', name: 'Charlie Collab', role: 'Collaborator' },
        ],
        members: [],
        mentorId: null,
      };

      const list = service.buildProjectMembersList(project);
      expect(list).toHaveLength(3);

      const roles = list.map((m) => m.role);
      expect(roles).toEqual(['Owner', 'Collaborator', 'Collaborator']);

      const ids = list.map((m) => m.userId);
      expect(ids).toContain('owner-1');
      expect(ids).toContain('collab-1');
      expect(ids).toContain('collab-2');
    });
  });

  describe('3. List builder with owner + mentor', () => {
    it('returns owner and mentor (2 distinct rows)', () => {
      const project: any = {
        id: 'proj-3',
        ownerId: 'owner-1',
        mentorId: 'mentor-1',
        mentor: 'Diana Mentor',
        collaborators: [],
        members: [],
      };

      const list = service.buildProjectMembersList(project);
      expect(list).toHaveLength(2);

      const roles = list.map((m) => m.role);
      expect(roles).toContain('Owner');
      expect(roles).toContain('Mentor');
    });
  });

  describe('4. List builder on inconsistent record (same user in multiple roles)', () => {
    it('same user as collaborator and mentor: returns one row, keeps Mentor, logs warning with project ID', () => {
      const project: any = {
        id: 'proj-dup-1',
        ownerId: 'owner-1',
        mentorId: 'multi-user',
        mentor: 'Multi Role User',
        collaborators: [
          { id: 'multi-user', name: 'Multi Role User', role: 'Collaborator' },
        ],
        members: [],
      };

      const list = service.buildProjectMembersList(project);
      expect(list).toHaveLength(2); // owner-1 and multi-user

      const multiEntry = list.find((m) => m.userId === 'multi-user');
      expect(multiEntry).toBeDefined();
      expect(multiEntry?.role).toBe('Mentor'); // Mentor priority > Collaborator

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('proj-dup-1'),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('multi-user'),
      );
    });

    it('same user as owner and collaborator: returns one row, keeps Owner, logs warning with project ID', () => {
      const project: any = {
        id: 'proj-dup-2',
        ownerId: 'owner-1',
        collaborators: [
          { id: 'owner-1', name: 'Alice Owner', role: 'Collaborator' },
        ],
        members: [],
      };

      const list = service.buildProjectMembersList(project);
      expect(list).toHaveLength(1);
      expect(list[0].userId).toBe('owner-1');
      expect(list[0].role).toBe('Owner'); // Owner priority > Collaborator

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('proj-dup-2'),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('owner-1'),
      );
    });
  });

  describe('5. Member count matches distinct people', () => {
    it('counts distinct user IDs even if raw arrays contain duplicates', () => {
      const project: any = {
        id: 'proj-5',
        ownerId: 'owner-1',
        mentorId: 'mentor-1',
        collaborators: [
          { id: 'collab-1', name: 'Bob Collab', role: 'Collaborator' },
          { id: 'collab-1', name: 'Bob Collab', role: 'Collaborator' }, // Duplicate entry
        ],
        members: [],
      };

      const list = service.buildProjectMembersList(project);
      expect(list).toHaveLength(3); // owner-1, mentor-1, collab-1
    });
  });

  describe('6. Collaborator seat count ignores owner and mentor', () => {
    it('seat count formula counts only active collaborators and excludes owner and mentor', () => {
      const project: any = {
        id: 'proj-6',
        ownerId: 'owner-1',
        mentorId: 'mentor-1',
        collaborators: [
          { id: 'collab-1', name: 'Bob Collab', role: 'Collaborator' },
          { id: 'owner-1', name: 'Alice Owner', role: 'Collaborator' }, // Should be ignored
          { id: 'mentor-1', name: 'Diana Mentor', role: 'Collaborator' }, // Should be ignored
        ],
        removedUsers: [],
      };

      const seatCount = getApprovedCollaboratorsCount(project);
      expect(seatCount).toBe(1); // Only collab-1 uses a seat
    });
  });

  describe('7. Startup integrity check (auditProjectRolesIntegrity)', () => {
    it('detects and logs any project with multi-role users', () => {
      mockProjectsRepository.findAll.mockReturnValueOnce([
        {
          id: 'proj-inconsistent',
          ownerId: 'user-x',
          mentorId: 'user-x',
          collaborators: [],
        },
        {
          id: 'proj-clean',
          ownerId: 'user-1',
          mentorId: 'user-2',
          collaborators: [{ id: 'user-3', role: 'Collaborator' }],
        },
      ]);

      const issues = service.auditProjectRolesIntegrity();
      expect(issues).toHaveLength(1);
      expect(issues[0].projectId).toBe('proj-inconsistent');
      expect(issues[0].duplicateUsers).toContain('user-x');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('proj-inconsistent'),
      );
    });
  });
});
