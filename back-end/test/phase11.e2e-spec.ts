import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, TestAppContext } from './helpers/test-helpers';
import { ProjectsRepository } from '../src/projects/projects.repository';
import { TasksRepository } from '../src/tasks/tasks.repository';
import { AuditService } from '../src/audit/audit.service';
import { TaskStatus } from '../src/tasks/dto/create-task.dto';

describe('Phase 11 E2E API Tests: Project Health Removal & Kept Features', () => {
  let ctx: TestAppContext;
  let app: INestApplication;
  let server: any;
  let projectsRepo: ProjectsRepository;
  let tasksRepo: TasksRepository;
  let auditService: AuditService;

  beforeAll(async () => {
    ctx = await createTestApp();
    app = ctx.app;
    server = app.getHttpServer();
    projectsRepo = app.get(ProjectsRepository);
    tasksRepo = app.get(TasksRepository);
    auditService = app.get(AuditService);
  });

  beforeEach(() => {
    ctx.resetStores();
    ctx.clockService.setTime('2026-11-11T12:00:00.000Z');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Removed Routes Return 404 (impression, preview, health)', () => {
    it('POST /projects/:id/impression returns 404', async () => {
      const res = await request(server)
        .post('/projects/proj-1/impression')
        .set('Authorization', ctx.loginAs('7'));

      expect(res.status).toBe(404);
    });

    it('POST /projects/:id/preview returns 404', async () => {
      const res = await request(server)
        .post('/projects/proj-1/preview')
        .set('Authorization', ctx.loginAs('7'));

      expect(res.status).toBe(404);
    });

    it('GET /projects/:id/health returns 404 for owner and admin', async () => {
      const ownerRes = await request(server)
        .get('/projects/proj-1/health')
        .set('Authorization', ctx.loginAs('owner'));
      expect(ownerRes.status).toBe(404);

      const adminRes = await request(server)
        .get('/projects/proj-1/health')
        .set('Authorization', ctx.loginAs('admin'));
      expect(adminRes.status).toBe(404);
    });
  });

  describe('2. Project Responses Contain No Health Fields', () => {
    it('GET /projects/:id returns project object with no health fields', async () => {
      const res = await request(server)
        .get('/projects/proj-1')
        .set('Authorization', ctx.loginAs('owner'));

      expect(res.status).toBe(200);
      expect(res.body.health).toBeUndefined();
      expect(res.body.healthScore).toBeUndefined();
      expect(res.body.grade).toBeUndefined();
      expect(res.body.recommendations).toBeUndefined();
      expect(res.body.metrics).toBeUndefined();
    });

    it('GET /projects returns project items with no health fields', async () => {
      const res = await request(server)
        .get('/projects')
        .set('Authorization', ctx.loginAs('7'));

      expect(res.status).toBe(200);
      const items = Array.isArray(res.body) ? res.body : res.body.items || [];
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) {
        expect(item.health).toBeUndefined();
        expect(item.healthScore).toBeUndefined();
        expect(item.grade).toBeUndefined();
        expect(item.recommendations).toBeUndefined();
        expect(item.metrics).toBeUndefined();
      }
    });
  });

  describe('3. Kept Feature: 3-Day Pending Join Request Reminder Fires', () => {
    it('remindPendingRequests sends notification to owner for join requests pending >= 3 days', async () => {
      // Create a pending join request that is 4 days old
      const fourDaysAgo = new Date(ctx.clockService.now().getTime() - 4 * 24 * 60 * 60 * 1000).toISOString();
      const newReq = ctx.joinRequestsService.create({
        projectId: 'proj-1',
        userId: 'user-pending-test',
        userName: 'Pending Applicant',
        message: 'Looking forward to collaborating on this project.',
      } as any);

      // Force createdAt back 4 days
      (newReq as any).createdAt = fourDaysAgo;
      if (typeof (ctx.joinRequestsService as any).updateSync === 'function') {
        (ctx.joinRequestsService as any).updateSync(newReq.id, { createdAt: fourDaysAgo });
      }

      const result = await ctx.jobsService.remindPendingRequests();
      expect(result.remindedRequests).toContain(newReq.id);

      // Verify remindedAt is now set on the request
      const updatedReq = ctx.joinRequestsService.findOne(newReq.id);
      expect(updatedReq?.remindedAt).toBeDefined();

      // Running again should not remind again (one-time reminder)
      const repeatResult = await ctx.jobsService.remindPendingRequests();
      expect(repeatResult.remindedRequests).not.toContain(newReq.id);
    });
  });

  describe('4. Kept Feature: Public Owner Response Time (GET /users/:id/response-time)', () => {
    it('returns 200 with medianHours and sample for public inquiries', async () => {
      const res = await request(server).get('/users/1/response-time');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('medianHours');
      expect(res.body).toHaveProperty('sample');
      expect(typeof res.body.sample).toBe('number');
    });
  });

  describe('5. Kept Feature: Deadline Extension with Task Shifting', () => {
    it('shifts open task deadlines forward when shiftTasks is true, skipping approved tasks', async () => {
      const proj = projectsRepo.findById('proj-1');
      const originalDueDate = new Date(proj.dueDate);
      const newDueDate = new Date(originalDueDate.getTime() + 10 * 24 * 60 * 60 * 1000); // +10 days

      // Prepare an open task and an approved task
      const openTask = tasksRepo.create({
        projectId: 'proj-1',
        title: 'Open Work Item',
        description: 'Testing task shift',
        dueDate: new Date(originalDueDate.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        status: TaskStatus.ToDo,
        priority: 'Medium' as any,
      } as any);

      const approvedTask = tasksRepo.create({
        projectId: 'proj-1',
        title: 'Approved Work Item',
        description: 'Should not shift',
        dueDate: new Date(originalDueDate.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        status: TaskStatus.Completed,
        priority: 'High' as any,
      } as any);

      const initialOpenTaskDue = openTask.dueDate;

      const res = await request(server)
        .patch('/projects/proj-1/deadline')
        .set('Authorization', ctx.loginAs('owner'))
        .send({
          dueDate: newDueDate.toISOString(),
          reason: 'Timeline extended for thorough quality assurance testing.',
          shiftTasks: true,
        });

      expect(res.status).toBe(200);

      // Verify open task shifted by 10 days
      const updatedOpenTask = tasksRepo.findById(openTask.id);
      const expectedDue = new Date(
        new Date(initialOpenTaskDue).getTime() + 10 * 24 * 60 * 60 * 1000,
      ).toISOString();
      expect(new Date(updatedOpenTask.dueDate).toISOString()).toBe(expectedDue);

      // Verify approved task was NOT moved
      const updatedApprovedTask = tasksRepo.findById(approvedTask.id);
      expect(new Date(updatedApprovedTask.dueDate).toISOString()).toBe(
        new Date(approvedTask.dueDate).toISOString(),
      );

      // Verify audit log entry
      const logs = auditService.findAll();
      const shiftLog = logs.find((l) => l.action === 'project-deadline-tasks-shifted');
      expect(shiftLog).toBeDefined();
      expect(shiftLog.details.diffDays).toBe(10);
    });

    it('leaves task deadlines untouched when shiftTasks is false', async () => {
      const proj = projectsRepo.findById('proj-1');
      const curDueDate = new Date(proj.dueDate);
      const newDueDate = new Date(curDueDate.getTime() + 5 * 24 * 60 * 60 * 1000); // +5 days

      const task = tasksRepo.create({
        projectId: 'proj-1',
        title: 'Unshifted Item',
        dueDate: curDueDate.toISOString(),
        status: TaskStatus.ToDo,
        priority: 'Medium' as any,
      } as any);

      const res = await request(server)
        .patch('/projects/proj-1/deadline')
        .set('Authorization', ctx.loginAs('owner'))
        .send({
          dueDate: newDueDate.toISOString(),
          reason: 'Standard deadline extension without task cascaded movement.',
          shiftTasks: false,
        });

      expect(res.status).toBe(200);

      const afterTask = tasksRepo.findById(task.id);
      expect(new Date(afterTask.dueDate).toISOString()).toBe(new Date(task.dueDate).toISOString());
    });
  });

  describe('6. Kept Feature: Capacity Guard: TEAM_SIZE_BELOW_MEMBERS', () => {
    it('returns 409 Conflict TEAM_SIZE_BELOW_MEMBERS when setting teamSize below current active collaborators', async () => {
      // proj-1 has 1 collaborator (Arjun Sharma, user 2) in seed data
      const proj = projectsRepo.findById('proj-1');
      expect(proj.collaborators.length).toBeGreaterThanOrEqual(1);

      const res = await request(server)
        .patch('/projects/proj-1')
        .set('Authorization', ctx.loginAs('owner'))
        .send({
          teamSize: 0, // less than current collaborators (1)
          dueDate: '2027-02-28T00:00:00.000Z',
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('TEAM_SIZE_BELOW_MEMBERS');
      expect(res.body.message).toContain('2');
    });

    it('succeeds when setting teamSize greater than or equal to current active collaborators', async () => {
      const res = await request(server)
        .patch('/projects/proj-1')
        .set('Authorization', ctx.loginAs('owner'))
        .send({
          teamSize: 4,
          dueDate: '2027-02-28T00:00:00.000Z',
        });

      expect(res.status).toBe(200);
      expect(res.body.teamSize).toBe(4);
      expect(res.body.maxCollaborators).toBe(4);
    });
  });
});
