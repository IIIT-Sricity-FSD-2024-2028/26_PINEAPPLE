import { ConflictException } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ClockService } from '../common/services/clock.service';
import { TaskStatus } from '../tasks/dto/create-task.dto';

describe('Phase 11: Deadline Shift & Capacity Guard Unit Tests', () => {
  let projectsService: ProjectsService;
  let fakeClock: ClockService;
  let currentTime: Date;

  let projectsMap: Map<string, any>;
  let tasksList: any[];
  let auditLogs: any[];

  beforeEach(() => {
    currentTime = new Date('2026-11-11T12:00:00.000Z');
    fakeClock = {
      now: () => new Date(currentTime),
      nowIso: () => currentTime.toISOString(),
    } as any;

    projectsMap = new Map();
    tasksList = [];
    auditLogs = [];

    const mockProjectsRepo: any = {
      findById: (id: string) => projectsMap.get(id) || null,
      update: (id: string, patch: any) => {
        const existing = projectsMap.get(id);
        if (!existing) return null;
        const updated = { ...existing, ...patch };
        projectsMap.set(id, updated);
        return updated;
      },
      findAll: () => Array.from(projectsMap.values()),
    };

    const mockTasksService: any = {
      findAllByProjectId: (projectId: string) => tasksList.filter((t) => t.projectId === projectId),
      update: (taskId: string, patch: any) => {
        const t = tasksList.find((task) => task.id === taskId);
        if (t) {
          Object.assign(t, patch);
        }
        return t;
      },
    };

    const mockAuditService: any = {
      log: (entry: any) => auditLogs.push(entry),
    };

    const mockNotificationsService: any = {
      create: () => {},
    };

    const mockPlatformConfig: any = {
      getConfig: () => ({ maxCollaboratorCapacity: 20 }),
    };

    const mockUsersService: any = {
      findUserSafe: () => null,
    };

    projectsService = new ProjectsService(
      mockProjectsRepo,
      mockTasksService,
      {} as any, // joinRequestsService
      mockNotificationsService,
      {} as any, // mentorMarketplaceService
      mockAuditService,
      mockPlatformConfig,
      mockUsersService,
      fakeClock,
    );
  });

  describe('Deadline Shift on Extension', () => {
    it('shifts open task deadlines forward by the same number of days when shiftTasks is true', async () => {
      const initialProjectDue = new Date('2026-11-20T00:00:00.000Z');
      const newProjectDue = new Date('2026-11-30T00:00:00.000Z'); // +10 days

      const project = {
        id: 'proj-shift-1',
        ownerId: 'owner-1',
        dueDate: initialProjectDue.toISOString(),
        collaborators: [],
        status: 'Open',
      };
      projectsMap.set(project.id, project);

      tasksList = [
        {
          id: 'task-open-1',
          projectId: project.id,
          title: 'Open Task 1',
          status: 'pending',
          dueDate: new Date('2026-11-15T00:00:00.000Z').toISOString(),
        },
        {
          id: 'task-approved-2',
          projectId: project.id,
          title: 'Approved Task 2',
          status: 'approved',
          dueDate: new Date('2026-11-14T00:00:00.000Z').toISOString(),
        },
      ];

      await projectsService.changeDeadline(
        project.id,
        {
          dueDate: newProjectDue.toISOString(),
          reason: 'Scope expanded with client approval and additional tasks needed.',
          shiftTasks: true,
        },
        { id: 'owner-1', uid: 'owner-1', name: 'Owner User' },
        'Project Owner',
      );

      // Open task shifted by 10 days (Nov 15 -> Nov 25)
      const openTask = tasksList.find((t) => t.id === 'task-open-1');
      expect(new Date(openTask.dueDate).toISOString()).toBe(
        new Date('2026-11-25T00:00:00.000Z').toISOString(),
      );

      // Approved task was NEVER moved
      const approvedTask = tasksList.find((t) => t.id === 'task-approved-2');
      expect(new Date(approvedTask.dueDate).toISOString()).toBe(
        new Date('2026-11-14T00:00:00.000Z').toISOString(),
      );

      // Audit entry recorded
      const shiftAudit = auditLogs.find((a) => a.action === 'project-deadline-tasks-shifted');
      expect(shiftAudit).toBeDefined();
      expect(shiftAudit.details.shiftedCount).toBe(1);
      expect(shiftAudit.details.diffDays).toBe(10);
    });

    it('leaves task deadlines unchanged when shiftTasks is false or omitted', async () => {
      const project = {
        id: 'proj-shift-2',
        ownerId: 'owner-1',
        dueDate: new Date('2026-11-20T00:00:00.000Z').toISOString(),
        collaborators: [],
        status: 'Open',
      };
      projectsMap.set(project.id, project);

      tasksList = [
        {
          id: 'task-open-1',
          projectId: project.id,
          title: 'Open Task 1',
          status: 'pending',
          dueDate: new Date('2026-11-15T00:00:00.000Z').toISOString(),
        },
      ];

      await projectsService.changeDeadline(
        project.id,
        {
          dueDate: new Date('2026-11-30T00:00:00.000Z').toISOString(),
          reason: 'Timeline extended for QA validation phase.',
          shiftTasks: false,
        },
        { id: 'owner-1', uid: 'owner-1' },
        'Project Owner',
      );

      const openTask = tasksList.find((t) => t.id === 'task-open-1');
      expect(new Date(openTask.dueDate).toISOString()).toBe(
        new Date('2026-11-15T00:00:00.000Z').toISOString(),
      );

      const shiftAudit = auditLogs.find((a) => a.action === 'project-deadline-tasks-shifted');
      expect(shiftAudit).toBeUndefined();
    });

    it('never shifts a task deadline to earlier than today', async () => {
      const project = {
        id: 'proj-shift-3',
        ownerId: 'owner-1',
        dueDate: new Date('2026-11-15T00:00:00.000Z').toISOString(),
        collaborators: [],
        status: 'Open',
      };
      projectsMap.set(project.id, project);

      // Task with overdue date before today
      tasksList = [
        {
          id: 'task-overdue',
          projectId: project.id,
          title: 'Overdue Task',
          status: 'in-progress',
          dueDate: new Date('2026-11-01T00:00:00.000Z').toISOString(),
        },
      ];

      await projectsService.changeDeadline(
        project.id,
        {
          dueDate: new Date('2026-11-20T00:00:00.000Z').toISOString(),
          reason: 'Extending deadline to cover remaining open items.',
          shiftTasks: true,
        },
        { id: 'owner-1', uid: 'owner-1' },
        'Project Owner',
      );

      const task = tasksList.find((t) => t.id === 'task-overdue');
      // Shifted by 5 days: Nov 1 + 5d = Nov 6, which is still before today (Nov 11) -> clamped to today!
      expect(new Date(task.dueDate).getTime()).toBeGreaterThanOrEqual(currentTime.getTime());
    });
  });

  describe('Capacity Guard: TEAM_SIZE_BELOW_MEMBERS', () => {
    it('throws 409 Conflict when teamSize is set below current active collaborator count', () => {
      const project = {
        id: 'proj-cap-1',
        ownerId: 'owner-1',
        maxCollaborators: 5,
        teamSize: 5,
        collaborators: [
          { id: 'user-2', name: 'User 2' },
          { id: 'user-3', name: 'User 3' },
          { id: 'user-4', name: 'User 4' },
        ],
        status: 'Open',
      };
      projectsMap.set(project.id, project);

      expect(() =>
        projectsService.update(project.id, { teamSize: 2 } as any, 'owner-1'),
      ).toThrow(ConflictException);

      try {
        projectsService.update(project.id, { teamSize: 2 } as any, 'owner-1');
      } catch (err: any) {
        expect(err.getStatus()).toBe(409);
        expect(err.getResponse().code).toBe('TEAM_SIZE_BELOW_MEMBERS');
        expect(err.getResponse().message).toContain('3');
      }
    });

    it('allows setting teamSize equal to or greater than active members count', () => {
      const project = {
        id: 'proj-cap-2',
        ownerId: 'owner-1',
        maxCollaborators: 5,
        teamSize: 5,
        collaborators: [
          { id: 'user-2', name: 'User 2' },
          { id: 'user-3', name: 'User 3' },
        ],
        status: 'Open',
      };
      projectsMap.set(project.id, project);

      // Setting teamSize to 2 (equal to current members) succeeds
      const updated = projectsService.update(project.id, { teamSize: 2 } as any, 'owner-1');
      expect((updated as any).teamSize).toBe(2);
      expect((updated as any).maxCollaborators).toBe(2);
    });
  });
});
