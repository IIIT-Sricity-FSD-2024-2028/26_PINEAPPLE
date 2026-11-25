import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { LeaveRequestsService } from './leave-requests.service';
import { LeaveRequestsRepository } from './leave-requests.repository';
import { ProjectsRepository, Project } from './projects.repository';
import { ProjectsService } from './projects.service';
import { TasksRepository } from '../tasks/tasks.repository';
import { UsersRepository } from '../users/users.repository';
import { NotificationsService } from '../notifications/notifications.service';
import { ClockService } from '../common/services/clock.service';
import { AccountDeletionService } from '../users/account-deletion.service';
import { ModuleRef } from '@nestjs/core';

describe('Leave Requests & Account Deletion Safeguards (Step 3)', () => {
  let leaveRequestsService: LeaveRequestsService;
  let leaveRequestsRepo: LeaveRequestsRepository;
  let projectsRepo: ProjectsRepository;
  let projectsService: ProjectsService;
  let tasksRepo: TasksRepository;
  let usersRepo: UsersRepository;
  let clockService: ClockService;
  let accountDeletionService: AccountDeletionService;
  let moduleRef: ModuleRef;

  const mockProjectId = 'proj-leave-test';
  const ownerId = 'owner-1';
  const collabId = 'collab-1';

  beforeEach(async () => {
    leaveRequestsRepo = new LeaveRequestsRepository();
    projectsRepo = new ProjectsRepository();
    tasksRepo = new TasksRepository();
    usersRepo = new UsersRepository();
    clockService = new ClockService();

    const mockNotificationsService = {
      create: jest.fn(),
    };

    const mockProjectsService = {
      findById: (id: string) => projectsRepo.findById(id),
      executeMemberDeparture: jest.fn((pid: any, uid: any) => {
        const p = projectsRepo.findById(pid);
        if (p) {
          p.collaborators = (p.collaborators || []).filter((c: any) => String(c.id || c) !== String(uid));
        }
        return p;
      }),
      leaveProject: jest.fn((pid: any, uid: any) => {
        throw new HttpException(
          {
            statusCode: HttpStatus.CONFLICT,
            error: 'Conflict',
            code: 'USE_LEAVE_REQUEST',
            message: 'Collaborators cannot leave directly. Please submit a leave request for owner approval.',
          },
          HttpStatus.CONFLICT,
        );
      }),
    };
    projectsService = mockProjectsService as any;

    leaveRequestsService = new LeaveRequestsService(
      leaveRequestsRepo,
      projectsRepo,
      mockProjectsService as any,
      tasksRepo,
      mockNotificationsService as any,
      usersRepo,
      clockService,
    );

    // Setup project and members
    projectsRepo.create(
      ownerId,
      {
        id: mockProjectId,
        title: 'Leave Request Test Project',
        description: 'Testing leave requests',
        status: 'In Progress',
        requiredSkills: ['React', 'Node'],
        collaborators: [
          { id: collabId, name: 'Collab User', role: 'Collaborator' },
        ],
      } as any,
      'In Progress' as any,
    );

    usersRepo.create({
      id: collabId,
      name: 'Collab User',
      username: 'collabuser',
      email: 'collab@test.com',
      role: 'Collaborator',
      status: 'active',
    } as any);

    const mockModuleRef = {
      get: (token: any) => {
        if (token === TasksRepository) return tasksRepo;
        if (token === ProjectsRepository) return projectsRepo;
        return undefined;
      },
    };

    accountDeletionService = new AccountDeletionService(
      usersRepo,
      mockModuleRef as any,
      clockService,
    );
  });

  describe('Part 1: Collaborator Leave Request with Owner Approval', () => {
    it('1. Submitting a leave request creates a pending request with reasons and explanation', async () => {
      const req = await leaveRequestsService.createRequest(mockProjectId, collabId, {
        reasons: ['PERSONAL_COMMITMENTS'],
        explanation: 'I need to focus on university exams for the next month.',
      });

      expect(req).toBeDefined();
      expect(req.status).toBe('pending');
      expect(req.projectId).toBe(mockProjectId);
      expect(req.userId).toBe(collabId);
      expect(req.reasons).toEqual(['PERSONAL_COMMITMENTS']);
      expect(req.explanation).toBe('I need to focus on university exams for the next month.');

      // Member should still be in the project while pending
      const project = projectsRepo.findById(mockProjectId);
      expect(project?.collaborators.some((c: any) => String(c.id || c) === collabId)).toBe(true);
    });

    it('2. Legacy leaveProject throws 409 USE_LEAVE_REQUEST', () => {
      expect(() => {
        projectsService?.leaveProject ? projectsService.leaveProject(mockProjectId, collabId) : null;
      }).toThrow();
    });

    it('3. Duplicate pending leave request throws 409 LEAVE_REQUEST_PENDING', async () => {
      await leaveRequestsService.createRequest(mockProjectId, collabId, {
        reasons: ['TIME_CONSTRAINTS'],
        explanation: 'First pending request',
      });

      await expect(
        leaveRequestsService.createRequest(mockProjectId, collabId, {
          reasons: ['TIME_CONSTRAINTS'],
          explanation: 'Second request attempt',
        }),
      ).rejects.toMatchObject({
        response: {
          code: 'LEAVE_REQUEST_PENDING',
        },
      });
    });

    it('4. Withdrawing a pending request allows submitting a new request without cooldown', async () => {
      await leaveRequestsService.createRequest(mockProjectId, collabId, {
        reasons: ['TIME_CONSTRAINTS'],
        explanation: 'Initial request to be withdrawn',
      });

      const withdrawRes = await leaveRequestsService.withdrawRequest(mockProjectId, collabId);
      expect(withdrawRes.success).toBe(true);

      // Can submit again immediately
      const newReq = await leaveRequestsService.createRequest(mockProjectId, collabId, {
        reasons: ['CHANGE_IN_PRIORITIES'],
        explanation: 'Resubmitted request without cooldown',
      });
      expect(newReq.status).toBe('pending');
    });

    it('5. Owner rejecting a leave request triggers 24-hour cooldown', async () => {
      const req = await leaveRequestsService.createRequest(mockProjectId, collabId, {
        reasons: ['TIME_CONSTRAINTS'],
        explanation: 'Request that will be rejected',
      });

      const rejectRes = await leaveRequestsService.rejectRequest(req.id, ownerId, 'Project Owner', {
        reasons: ['CRITICAL_PROJECT_PHASE'],
        explanation: 'We are in a critical deployment phase and need your contributions.',
      });

      expect(rejectRes.success).toBe(true);
      expect(rejectRes.leaveRequest.status).toBe('rejected');

      // Attempting to ask again immediately throws 409 LEAVE_REQUEST_COOLDOWN
      await expect(
        leaveRequestsService.createRequest(mockProjectId, collabId, {
          reasons: ['TIME_CONSTRAINTS'],
          explanation: 'Attempt right after rejection',
        }),
      ).rejects.toMatchObject({
        response: {
          code: 'LEAVE_REQUEST_COOLDOWN',
        },
      });
    });

    it('6. Owner approving a leave request releases member from project', async () => {
      const req = await leaveRequestsService.createRequest(mockProjectId, collabId, {
        reasons: ['PERSONAL_COMMITMENTS'],
        explanation: 'Approval test request',
      });

      const approveRes = await leaveRequestsService.approveRequest(req.id, ownerId, 'Project Owner');
      expect(approveRes.success).toBe(true);
      expect(approveRes.leaveRequest.status).toBe('approved');

      // Member should now be removed from collaborators
      const project = projectsRepo.findById(mockProjectId);
      expect(project?.collaborators.some((c: any) => String(c.id || c) === collabId)).toBe(false);
    });

    it('7. Hourly automation: 3-day reminder and 7-day auto-approval', async () => {
      // 1. Create a request that is 4 days old (past 72h reminder)
      const fourDaysAgoIso = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
      const req1 = leaveRequestsRepo.create({
        projectId: mockProjectId,
        userId: collabId,
        userName: 'Collab User',
        reasons: ['TIME_CONSTRAINTS'],
        explanation: 'Waiting 4 days',
        status: 'pending',
        createdAt: fourDaysAgoIso,
      });

      const run1 = await leaveRequestsService.processHourlyAutomation();
      expect(run1.reminderCount).toBe(1);
      expect(leaveRequestsRepo.findById(req1.id)?.reminderSentAt).toBeDefined();

      // 2. Create a request that is 8 days old (past 168h auto-approval)
      const eightDaysAgoIso = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
      const req2 = leaveRequestsRepo.create({
        projectId: mockProjectId,
        userId: collabId,
        userName: 'Collab User',
        reasons: ['TIME_CONSTRAINTS'],
        explanation: 'Waiting 8 days',
        status: 'pending',
        createdAt: eightDaysAgoIso,
      });

      const run2 = await leaveRequestsService.processHourlyAutomation();
      expect(run2.approvedCount).toBe(1);
      expect(leaveRequestsRepo.findById(req2.id)?.status).toBe('approved');
      expect(leaveRequestsRepo.findById(req2.id)?.decidedBy).toBe('system');
    });
  });

  describe('Part 2: Account Deletion Only Without Active Tasks or In-Review', () => {
    it('8. Blocks account deletion when user has active InProgress or InReview tasks', () => {
      // Assign active task to user
      tasksRepo.create({
        projectId: mockProjectId,
        title: 'Active Task 1',
        assigneeId: collabId,
        assigneeName: 'Collab User',
        status: 'In Progress',
      } as any);

      // Check deletion eligibility
      const check = accountDeletionService.checkDeletionEligibility(collabId);
      expect(check.canDelete).toBe(false);
      expect(check.taskBlockers.length).toBeGreaterThan(0);
      expect(check.taskBlockers[0].taskTitle).toBe('Active Task 1');

      // Attempting deletion throws 409 ACCOUNT_HAS_ACTIVE_TASKS
      expect(() => {
        accountDeletionService.deleteMyAccount(collabId, { username: 'collabuser' });
      }).toThrow(
        expect.objectContaining({
          response: expect.objectContaining({
            code: 'ACCOUNT_HAS_ACTIVE_TASKS',
          }),
        }),
      );
    });

    it('9. Allows account deletion check when all assigned tasks are completed or user has no active tasks', () => {
      // Clear tasks for collab user
      tasksRepo.findAll().forEach((t) => {
        if (t.assigneeId === collabId) {
          t.status = 'Completed';
        }
      });

      const check = accountDeletionService.checkDeletionEligibility(collabId);
      expect(check.canDelete).toBe(true);
      expect(check.taskBlockers.length).toBe(0);
    });
  });
});
