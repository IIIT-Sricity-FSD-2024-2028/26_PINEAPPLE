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
import { ConflictException } from '@nestjs/common';

describe('Step 2 Unit Tests: getRemovalBlockers & Collaborator Removal Guard', () => {
  let service: ProjectsService;
  let mockTasks: any[] = [];
  let auditLogSpy: any;

  const mockUsersService = {
    findById: jest.fn((id: string) => {
      const users: Record<string, any> = {
        'owner-1': { id: 'owner-1', name: 'Alice Owner', username: 'alice' },
        'collab-a': { id: 'collab-a', name: 'Bob Collab', username: 'bob' },
        'collab-b': { id: 'collab-b', name: 'Charlie Collab', username: 'charlie' },
      };
      return users[id] || null;
    }),
  };

  const mockTasksService = {
    findAllByProjectId: jest.fn((projectId: string) => mockTasks),
    releaseMemberTasksOnDeparture: jest.fn((opts: any) => ({
      releasedTasks: [],
      affectedProjectIds: [],
    })),
  };

  const mockProjectsRepository = {
    findById: jest.fn((id: string) => ({
      id,
      title: 'Removal Test Project',
      ownerId: 'owner-1',
      collaborators: [
        { id: 'collab-a', userId: 'collab-a', name: 'Bob Collab' },
        { id: 'collab-b', userId: 'collab-b', name: 'Charlie Collab' },
      ],
      members: [],
      removedUsers: [],
      status: 'In Progress',
    })),
    update: jest.fn(),
  };

  beforeEach(async () => {
    mockTasks = [];
    auditLogSpy = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: ProjectsRepository, useValue: mockProjectsRepository },
        { provide: TasksService, useValue: mockTasksService },
        { provide: JoinRequestsService, useValue: { updateJoinRequestStatus: jest.fn() } },
        { provide: NotificationsService, useValue: { create: jest.fn() } },
        { provide: MentorMarketplaceService, useValue: { getSessionsByProject: jest.fn(() => []), getMentor: jest.fn() } },
        { provide: AuditService, useValue: { log: auditLogSpy } },
        { provide: PlatformConfigService, useValue: { getConfig: jest.fn(() => ({ maxCollaboratorsPerProject: 5 })) } },
        { provide: UsersService, useValue: mockUsersService },
        { provide: ClockService, useValue: { nowIso: () => '2026-11-21T12:00:00.000Z', now: () => new Date('2026-11-21T12:00:00.000Z') } },
        { provide: GamificationService, useValue: {} },
        { provide: SupportService, useValue: {} },
        { provide: ContentFilterService, useValue: {} },
        { provide: DuplicateDetectionService, useValue: {} },
        { provide: ProjectInvitesService, useValue: {} },
        { provide: FeedbackService, useValue: null },
        { provide: DeletionPolicyService, useValue: {} },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  it('1. one In Review plus others (blocked)', () => {
    mockTasks = [
      { id: 't-1', projectId: 'p-1', title: 'Task in review', status: 'In Review', assigneeId: 'collab-a', inReviewSince: '2026-11-20T10:00:00.000Z' },
      { id: 't-2', projectId: 'p-1', title: 'Task open', status: 'To Do', assigneeId: 'collab-a' },
      { id: 't-3', projectId: 'p-1', title: 'Task approved', status: 'Completed', assigneeId: 'collab-a' },
    ];

    const res = service.getRemovalBlockers('p-1', 'collab-a');
    expect(res.allowed).toBe(false);
    expect(res.blockers).toHaveLength(1);
    expect(res.blockers[0]).toEqual({
      taskId: 't-1',
      title: 'Task in review',
      submittedAt: '2026-11-20T10:00:00.000Z',
    });
    expect(res.tasksToRelease).toHaveLength(1);
    expect(res.tasksToRelease[0].taskId).toBe('t-2');
    expect(res.tasksKept).toHaveLength(1);
    expect(res.tasksKept[0].taskId).toBe('t-3');
  });

  it('2. only Open (allowed)', () => {
    mockTasks = [
      { id: 't-open', projectId: 'p-1', title: 'Open Task', status: 'To Do', assigneeId: 'collab-a' },
    ];

    const res = service.getRemovalBlockers('p-1', 'collab-a');
    expect(res.allowed).toBe(true);
    expect(res.blockers).toHaveLength(0);
    expect(res.tasksToRelease).toHaveLength(1);
    expect(res.tasksToRelease[0].taskId).toBe('t-open');
    expect(res.tasksKept).toHaveLength(0);
  });

  it('3. only In Progress (allowed)', () => {
    mockTasks = [
      { id: 't-prog', projectId: 'p-1', title: 'In Progress Task', status: 'In Progress', assigneeId: 'collab-a' },
    ];

    const res = service.getRemovalBlockers('p-1', 'collab-a');
    expect(res.allowed).toBe(true);
    expect(res.blockers).toHaveLength(0);
    expect(res.tasksToRelease).toHaveLength(1);
    expect(res.tasksToRelease[0].taskId).toBe('t-prog');
    expect(res.tasksKept).toHaveLength(0);
  });

  it('4. only Approved (allowed)', () => {
    mockTasks = [
      { id: 't-comp', projectId: 'p-1', title: 'Approved Task', status: 'Completed', assigneeId: 'collab-a' },
    ];

    const res = service.getRemovalBlockers('p-1', 'collab-a');
    expect(res.allowed).toBe(true);
    expect(res.blockers).toHaveLength(0);
    expect(res.tasksToRelease).toHaveLength(0);
    expect(res.tasksKept).toHaveLength(1);
    expect(res.tasksKept[0].taskId).toBe('t-comp');
  });

  it('5. only sent back (allowed)', () => {
    mockTasks = [
      {
        id: 't-rej',
        projectId: 'p-1',
        title: 'Sent Back Task',
        status: 'To Do',
        assigneeId: 'collab-a',
        rejectionReason: 'Needs unit tests and proper documentation.',
      },
    ];

    const res = service.getRemovalBlockers('p-1', 'collab-a');
    expect(res.allowed).toBe(true);
    expect(res.blockers).toHaveLength(0);
    expect(res.tasksToRelease).toHaveLength(1);
    expect(res.tasksToRelease[0].taskId).toBe('t-rej');
    expect(res.tasksKept).toHaveLength(0);
  });

  it('6. no tasks (allowed)', () => {
    mockTasks = [];

    const res = service.getRemovalBlockers('p-1', 'collab-a');
    expect(res.allowed).toBe(true);
    expect(res.blockers).toHaveLength(0);
    expect(res.tasksToRelease).toHaveLength(0);
    expect(res.tasksKept).toHaveLength(0);
  });

  it('7. two collaborators (only the one with In Review is blocked)', () => {
    mockTasks = [
      { id: 't-a', projectId: 'p-1', title: 'Task A In Review', status: 'In Review', assigneeId: 'collab-a' },
      { id: 't-b', projectId: 'p-1', title: 'Task B Open', status: 'To Do', assigneeId: 'collab-b' },
    ];

    const resA = service.getRemovalBlockers('p-1', 'collab-a');
    expect(resA.allowed).toBe(false);
    expect(resA.blockers).toHaveLength(1);
    expect(resA.blockers[0].taskId).toBe('t-a');

    const resB = service.getRemovalBlockers('p-1', 'collab-b');
    expect(resB.allowed).toBe(true);
    expect(resB.blockers).toHaveLength(0);
    expect(resB.tasksToRelease).toHaveLength(1);
    expect(resB.tasksToRelease[0].taskId).toBe('t-b');
  });

  it('removeMember throws 409 MEMBER_HAS_TASKS_IN_REVIEW and logs MEMBER_REMOVAL_BLOCKED when blocked', () => {
    mockTasks = [
      { id: 't-rev', projectId: 'p-1', title: 'Waiting Task', status: 'In Review', assigneeId: 'collab-a', inReviewSince: '2026-11-21T08:00:00Z' },
    ];

    let caughtError: any;
    try {
      service.removeMember('p-1', 'collab-a', 'Removal reason minimum 10 chars', { id: 'owner-1', role: 'Owner' });
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(ConflictException);
    const resp = caughtError.getResponse();
    expect(resp.code).toBe('MEMBER_HAS_TASKS_IN_REVIEW');
    expect(resp.blockers).toHaveLength(1);
    expect(resp.blockers[0].taskId).toBe('t-rev');

    expect(auditLogSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'MEMBER_REMOVAL_BLOCKED',
        entityId: 'p-1',
        details: {
          projectId: 'p-1',
          memberId: 'collab-a',
          count: 1,
        },
      }),
    );
  });
});
