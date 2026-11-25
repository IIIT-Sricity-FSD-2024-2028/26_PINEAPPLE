import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ClockService } from '../common/services/clock.service';
import { PlatformConfigService } from '../platform-config/platform-config.service';
import { Project } from './projects.repository';

describe('ProjectsService - Change Deadline Unit Tests (Phase 4)', () => {
  let projectsService: ProjectsService;
  let fakeClock: ClockService;
  let project: Project;
  let auditLogs: any[];
  let notifications: any[];

  beforeEach(() => {
    fakeClock = new ClockService();
    fakeClock.setTime('2026-06-01T00:00:00.000Z');

    auditLogs = [];
    notifications = [];

    project = {
      id: 'proj-1',
      title: 'AI Platform',
      ownerId: 'owner-1',
      status: 'Open',
      dueDate: '2026-07-01T00:00:00.000Z',
      collaborators: [{ id: 'collab-1', name: 'Collab One', userId: 'collab-1' }],
      mentorId: 'mentor-1',
    } as any;

    const mockProjectsRepo: any = {
      findById: (id: string) => (id === project.id ? project : null),
      update: (id: string, updates: any) => {
        if (id === project.id) Object.assign(project, updates);
        return project;
      },
    };

    const mockTasksService: any = {
      findAllByProjectId: (projId: string) => [
        {
          id: 'task-1',
          projectId: projId,
          title: 'Database Setup',
          dueDate: '2026-06-20T00:00:00.000Z',
        },
        {
          id: 'task-2',
          projectId: projId,
          title: 'Backend API',
          dueDate: '2026-06-25T00:00:00.000Z',
        },
      ],
    };

    const mockNotificationsService: any = {
      create: (n: any) => notifications.push(n),
    };

    const mockAuditService: any = {
      log: (a: any) => auditLogs.push(a),
    };

    const platformConfigService = new PlatformConfigService();

    const mockUsersService: any = {
      findUserSafe: (id: string) => ({ id, name: `User ${id}` }),
      findById: (id: string) => ({ id, name: `User ${id}` }),
    };

    const mockMentorMarketplaceService: any = {
      getSessionsByProject: () => [],
      findActiveMentorForProject: () => null,
      getActiveOrPendingSessionForProject: () => null,
    };

    projectsService = new ProjectsService(
      mockProjectsRepo,
      mockTasksService,
      {} as any,
      mockNotificationsService,
      mockMentorMarketplaceService,
      mockAuditService,
      platformConfigService,
      mockUsersService,
      fakeClock,
    );
  });

  it('rejects deadline change by non-owner collaborator with 403 FORBIDDEN', () => {
    const callerCollaborator = { id: 'collab-1', uid: 'collab-1', role: 'collaborator' };

    expect(() => {
      projectsService.changeDeadline(
        'proj-1',
        { dueDate: '2026-08-01T00:00:00.000Z', reason: 'Need more time for testing' },
        callerCollaborator,
      );
    }).toThrow(ForbiddenException);
  });

  it('rejects deadline change when reason is shorter than 10 characters with 400 REASON_REQUIRED', () => {
    const callerOwner = { id: 'owner-1', uid: 'owner-1', role: 'project-owner' };

    expect(() => {
      projectsService.changeDeadline(
        'proj-1',
        { dueDate: '2026-08-01T00:00:00.000Z', reason: 'Short' },
        callerOwner,
      );
    }).toThrow(BadRequestException);
  });

  it('rejects deadline in the past with 400 DEADLINE_NOT_FUTURE', () => {
    const callerOwner = { id: 'owner-1', uid: 'owner-1', role: 'project-owner' };

    expect(() => {
      projectsService.changeDeadline(
        'proj-1',
        { dueDate: '2026-05-15T00:00:00.000Z', reason: 'Attempting to move into past' },
        callerOwner,
      );
    }).toThrow(BadRequestException);
  });

  it('rejects deadline earlier than the latest task due date (2026-06-25) with 400 DEADLINE_BEFORE_TASKS', () => {
    const callerOwner = { id: 'owner-1', uid: 'owner-1', role: 'project-owner' };

    // Task-2 is due on June 25th. Moving project deadline to June 22nd must be rejected.
    expect(() => {
      projectsService.changeDeadline(
        'proj-1',
        { dueDate: '2026-06-22T00:00:00.000Z', reason: 'Attempting to shorten before tasks finish' },
        callerOwner,
      );
    }).toThrow(BadRequestException);
  });

  it('rejects deadline change when project is Completed or Closed with 409 PROJECT_LOCKED', () => {
    const callerOwner = { id: 'owner-1', uid: 'owner-1', role: 'project-owner' };
    project.status = 'Completed' as any;
    project.isCompleted = true;
    project.finalLink = 'https://github.com/teamforge/project';

    expect(() => {
      projectsService.changeDeadline(
        'proj-1',
        { dueDate: '2026-08-01T00:00:00.000Z', reason: 'Moving completed project' },
        callerOwner,
      );
    }).toThrow(ConflictException);

    // Also test Closed project
    project.status = 'Closed' as any;
    project.isCompleted = false;
    expect(() => {
      projectsService.changeDeadline(
        'proj-1',
        { dueDate: '2026-08-01T00:00:00.000Z', reason: 'Moving closed project' },
        callerOwner,
      );
    }).toThrow(ConflictException);
  });

  it('successfully updates deadline: updates record, logs audit, and notifies collaborators and mentor', () => {
    const callerOwner = { id: 'owner-1', uid: 'owner-1', name: 'Project Owner Priya', role: 'project-owner' };
    const newDeadline = '2026-08-15T00:00:00.000Z';
    const reason = 'Extending timeline to accommodate comprehensive security audit and QA testing.';

    const updated = projectsService.changeDeadline(
      'proj-1',
      { dueDate: newDeadline, reason },
      callerOwner,
    );

    expect(updated.dueDate).toBe(newDeadline);

    // Audit log
    expect(auditLogs.some((l) => l.action === 'project-deadline-changed')).toBe(true);

    // Notifications sent to collaborator and mentor
    expect(notifications.some((n) => n.userId === 'collab-1' && n.type === 'PROJECT_DEADLINE_CHANGED')).toBe(true);
    expect(notifications.some((n) => n.userId === 'mentor-1' && n.type === 'PROJECT_DEADLINE_CHANGED')).toBe(true);
  });

  describe('Phase 9 Part C: Deadline History storage & visibility policy', () => {
    it('records deadlineHistory with previousDueDate, newDueDate, reason, changedBy, and changedAt', () => {
      const callerOwner = { id: 'owner-1', uid: 'owner-1', name: 'Project Owner Priya', role: 'project-owner' };
      const newDeadline = '2026-08-15T00:00:00.000Z';
      const reason = 'Extending timeline to accommodate comprehensive security audit and QA testing.';

      const updated = projectsService.changeDeadline(
        'proj-1',
        { dueDate: newDeadline, reason },
        callerOwner,
      );

      expect(updated.deadlineHistory).toBeDefined();
      expect(updated.deadlineHistory).toHaveLength(1);
      expect(updated.deadlineHistory![0]).toEqual({
        previousDueDate: '2026-07-01T00:00:00.000Z',
        newDueDate: newDeadline,
        reason,
        changedBy: 'Project Owner Priya',
        changedAt: expect.any(String),
      });

      // Second change appends to history
      const secondDeadline = '2026-09-01T00:00:00.000Z';
      const secondReason = 'Second extension due to third-party integration delay.';
      const secondUpdated = projectsService.changeDeadline(
        'proj-1',
        { dueDate: secondDeadline, reason: secondReason },
        callerOwner,
      );

      expect(secondUpdated.deadlineHistory).toHaveLength(2);
      expect(secondUpdated.deadlineHistory![1].previousDueDate).toBe(newDeadline);
      expect(secondUpdated.deadlineHistory![1].newDueDate).toBe(secondDeadline);
      expect(secondUpdated.deadlineHistory![1].reason).toBe(secondReason);
    });

    it('allows owner, collaborator, assigned mentor, and admin to view deadlineHistory via findById', () => {
      project.deadlineHistory = [
        {
          previousDueDate: '2026-07-01T00:00:00.000Z',
          newDueDate: '2026-08-15T00:00:00.000Z',
          reason: 'Initial extension for testing',
          changedBy: 'Owner',
          changedAt: '2026-06-05T00:00:00.000Z',
        },
      ];

      // Owner can view
      const forOwner = projectsService.findById('proj-1', 'owner-1');
      expect(forOwner.deadlineHistory).toHaveLength(1);

      // Collaborator can view
      const forCollab = projectsService.findById('proj-1', 'collab-1');
      expect(forCollab.deadlineHistory).toHaveLength(1);

      // Mentor can view
      const forMentor = projectsService.findById('proj-1', 'mentor-1');
      expect(forMentor.deadlineHistory).toHaveLength(1);

      // Admin can view
      const forAdmin = projectsService.findById('proj-1', 'admin-user', { role: 'admin' } as any);
      expect(forAdmin.deadlineHistory).toHaveLength(1);
    });

    it('strips deadlineHistory for outsiders/strangers viewing the project', () => {
      project.deadlineHistory = [
        {
          previousDueDate: '2026-07-01T00:00:00.000Z',
          newDueDate: '2026-08-15T00:00:00.000Z',
          reason: 'Confidential internal reason',
          changedBy: 'Owner',
          changedAt: '2026-06-05T00:00:00.000Z',
        },
      ];

      // Anonymous / no caller
      const forAnon = projectsService.findById('proj-1');
      expect(forAnon.deadlineHistory).toBeUndefined();

      // Outsider / stranger
      const forStranger = projectsService.findById('proj-1', 'stranger-999');
      expect(forStranger.deadlineHistory).toBeUndefined();
    });
  });
});
