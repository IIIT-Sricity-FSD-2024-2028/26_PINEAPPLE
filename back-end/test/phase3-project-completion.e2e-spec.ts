import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, TestAppContext } from './helpers/test-helpers';
import { ProjectStatus } from '../src/projects/dto/create-project.dto';
import { TaskStatus } from '../src/tasks/dto/create-task.dto';

describe('Phase 3 E2E: Remove Draft & Go-Live, Make Completion Final', () => {
  let ctx: TestAppContext;
  let app: INestApplication;
  let server: any;
  let ownerToken: string;
  let collabToken: string;

  const FUTURE_DUE = '2027-02-15T00:00:00.000Z';
  const VALID_DESC = 'A comprehensive decentralized edge computing platform designed to optimize latency for smart campus IoT deployments.';

  beforeAll(async () => {
    ctx = await createTestApp();
    app = ctx.app;
    server = app.getHttpServer();

    ownerToken = ctx.loginAs('1', [], { email: 'priya.patel@teamforge.io', role: 'Project Owner' });
    collabToken = ctx.loginAs('2', [], { email: 'arjun.sharma@teamforge.io', role: 'Collaborator' });
  });

  beforeEach(() => {
    ctx.resetStores();
    ctx.clockService.setTime('2026-11-13T10:00:00.000Z');
    ctx.usersRepository.update('1', { emailVerified: true } as any);
    ctx.usersRepository.update('2', { emailVerified: true } as any);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Immediate Go-Live & No Draft Status', () => {
    it('creates project directly as Open, visible in marketplace, and accepts join requests immediately', async () => {
      const createRes = await request(server)
        .post('/projects')
        .set('Authorization', ownerToken)
        .send({
          title: 'Live On Create Project',
          description: VALID_DESC,
          dueDate: FUTURE_DUE,
          maxCollaborators: 5,
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.status).toBe(ProjectStatus.Open);
      expect(createRes.body.id).toBeDefined();
      const projId = createRes.body.id;

      // Project immediately appears in public marketplace
      const marketRes = await request(server)
        .get('/projects')
        .set('Authorization', collabToken);

      expect(marketRes.status).toBe(200);
      const inMarket = marketRes.body.find((p: any) => p.id === projId);
      expect(inMarket).toBeDefined();
      expect(inMarket.status).toBe('Open');

      // Collaborator can apply immediately without any go-live publish step
      const applyRes = await request(server)
        .post('/join-requests')
        .set('Authorization', collabToken)
        .send({
          projectId: projId,
          message: 'I would like to contribute right away!',
        });

      expect([200, 201]).toContain(applyRes.status);
      expect(String(applyRes.body.status).toLowerCase()).toBe('pending');
    });

    it('POST /projects/:id/publish returns 404', async () => {
      const res = await request(server)
        .post('/projects/proj-1/publish')
        .set('Authorization', ownerToken)
        .send({ finalLink: 'https://github.com/teamforge/final' });

      expect(res.status).toBe(404);
    });

    it('rejects Draft status anywhere (POST /projects with status Draft returns 400)', async () => {
      const res = await request(server)
        .post('/projects')
        .set('Authorization', ownerToken)
        .send({
          title: 'Draft Rejection Project',
          description: VALID_DESC,
          dueDate: FUTURE_DUE,
          status: 'Draft',
        });

      expect(res.status).toBe(400);
    });

    it('auto-closes empty project 5 days after creation via closeEmptyProjects job', async () => {
      const createRes = await request(server)
        .post('/projects')
        .set('Authorization', ownerToken)
        .send({
          title: 'Empty Auto Close Project',
          description: VALID_DESC,
          dueDate: FUTURE_DUE,
        });
      expect(createRes.status).toBe(201);
      const projId = createRes.body.id;

      // Advance clock by 6 days
      ctx.clockService.advanceDays(6);

      await ctx.jobsService.runTick('manual');

      const projAfter = ctx.projectsRepository.findById(projId);
      expect(projAfter?.status).toBe(ProjectStatus.Closed);
      expect(projAfter?.closureReason).toMatch(/5 days/i);
    });

    it('seed data contains no Draft status', () => {
      const allProjects = ctx.projectsRepository.findAll(true);
      for (const p of allProjects) {
        expect(p.status).not.toBe('Draft');
        expect(p.status).not.toBe(ProjectStatus['Draft' as any]);
      }
    });
  });

  describe('2. Project Completion Rules', () => {
    let projectId: string;

    beforeEach(async () => {
      const p = ctx.projectsRepository.create(
        '1',
        {
          title: 'Completion Verification Project',
          description: VALID_DESC,
          dueDate: FUTURE_DUE,
          status: ProjectStatus.Open,
          collaborators: [{ id: '2', name: 'Arjun Sharma', role: 'Collaborator' }],
          createdAt: ctx.clockService.nowIso(),
        } as any,
        ProjectStatus.Open,
      );
      projectId = p.id;
    });

    it('non-owner attempting completion returns 403', async () => {
      const res = await request(server)
        .post(`/projects/${projectId}/complete`)
        .set('Authorization', collabToken)
        .send({ finalLink: 'https://github.com/teamforge/output' });

      expect(res.status).toBe(403);
    });

    it('invalid URL returns 400 INVALID_URL', async () => {
      const res = await request(server)
        .post(`/projects/${projectId}/complete`)
        .set('Authorization', ownerToken)
        .send({ finalLink: 'not-a-valid-url' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_URL');
    });

    it('project with no tasks returns 409 NO_TASKS', async () => {
      const res = await request(server)
        .post(`/projects/${projectId}/complete`)
        .set('Authorization', ownerToken)
        .send({ finalLink: 'https://github.com/teamforge/output' });

      expect(res.status).toBe(409);
      expect(['NO_TASKS', 'PROJECT_NO_TASKS']).toContain(res.body.code);
    });

    it('project with unapproved tasks returns 409 TASKS_NOT_COMPLETED', async () => {
      ctx.tasksRepository.create({
        projectId,
        title: 'Pending Implementation Task',
        status: TaskStatus.InProgress,
        assigneeId: '2',
        dueDate: '2027-01-20T00:00:00.000Z',
      } as any);

      const res = await request(server)
        .post(`/projects/${projectId}/complete`)
        .set('Authorization', ownerToken)
        .send({ finalLink: 'https://github.com/teamforge/output' });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('TASKS_NOT_COMPLETED');
    });

    it('Closed project cannot be completed (returns 409 PROJECT_CLOSED)', async () => {
      ctx.projectsRepository.update(projectId, { status: ProjectStatus.Closed } as any);
      ctx.tasksRepository.create({
        projectId,
        title: 'Approved Task',
        status: TaskStatus.Completed,
        assigneeId: '2',
        dueDate: '2027-01-20T00:00:00.000Z',
      } as any);

      const res = await request(server)
        .post(`/projects/${projectId}/complete`)
        .set('Authorization', ownerToken)
        .send({ finalLink: 'https://github.com/teamforge/output' });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('PROJECT_CLOSED');
    });

    it('successful completion sets all required fields and marks approved applications as Completed', async () => {
      // Add approved task
      ctx.tasksRepository.create({
        projectId,
        title: 'Final Tested Feature',
        status: TaskStatus.Completed,
        assigneeId: '2',
        dueDate: '2027-01-20T00:00:00.000Z',
      } as any);

      // Add an approved join request for user 3
      const req = ctx.joinRequestsService.create({
        projectId,
        userId: '3',
        userName: 'Sneha Rao',
        message: 'Let me help',
      });
      await ctx.joinRequestsService.update(req.id, { status: 'Approved' }, { uid: '1', role: 'Project Owner' });

      const finalUrl = 'https://github.com/teamforge/completion-showcase';
      const res = await request(server)
        .post(`/projects/${projectId}/complete`)
        .set('Authorization', ownerToken)
        .send({ finalLink: finalUrl });

      expect([200, 201]).toContain(res.status);
      expect(res.body.isCompleted).toBe(true);
      expect(res.body.status).toBe(ProjectStatus.Completed);
      expect(res.body.completedAt).toBeDefined();
      expect(res.body.finalLink).toBe(finalUrl);
      expect(Array.isArray(res.body.completedMemberIds)).toBe(true);
      expect(res.body.completedMemberIds).toContain('2');
      expect(res.body.completedMemberIds).toContain('3');

      // Verify approved application status was updated to Completed
      const updatedReq = ctx.joinRequestsService.findByProject(projectId).find((r: any) => r.id === req.id);
      expect(String(updatedReq?.status).toLowerCase()).toBe('completed');

      // Verify notifications were created
      const notifs = ctx.notificationsService.findAll().filter(
        (n: any) => n.referenceId === projectId && n.type === 'PROJECT_COMPLETED',
      );
      expect(notifs.length).toBeGreaterThanOrEqual(1);
      // Ensure one per recipient (grouped, unique)
      const userIds = notifs.map((n) => n.userId);
      expect(new Set(userIds).size).toBe(userIds.length);
    });
  });

  describe('3. Completion Finality ("Done Means Done")', () => {
    let completedProjId: string;

    beforeEach(async () => {
      const p = ctx.projectsRepository.create(
        '1',
        {
          title: 'Final Done Project',
          description: VALID_DESC,
          dueDate: FUTURE_DUE,
          status: ProjectStatus.Open,
          collaborators: [{ id: '2', name: 'Arjun Sharma', role: 'Collaborator' }],
          createdAt: ctx.clockService.nowIso(),
        } as any,
        ProjectStatus.Open,
      );
      completedProjId = p.id;

      ctx.tasksRepository.create({
        projectId: completedProjId,
        title: 'Finished Milestone Task',
        status: TaskStatus.Completed,
        assigneeId: '2',
        dueDate: '2027-01-20T00:00:00.000Z',
      } as any);

      // Complete the project
      await request(server)
        .post(`/projects/${completedProjId}/complete`)
        .set('Authorization', ownerToken)
        .send({ finalLink: 'https://github.com/teamforge/done' })
        .expect(201);
    });

    it('second completion returns 409 PROJECT_ALREADY_COMPLETED and alters nothing', async () => {
      const projBefore = ctx.projectsRepository.findById(completedProjId);

      const res = await request(server)
        .post(`/projects/${completedProjId}/complete`)
        .set('Authorization', ownerToken)
        .send({ finalLink: 'https://github.com/teamforge/new-attempt' });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('PROJECT_ALREADY_COMPLETED');

      const projAfter = ctx.projectsRepository.findById(completedProjId);
      expect(projAfter?.finalLink).toBe(projBefore?.finalLink);
      expect(projAfter?.completedAt).toBe(projBefore?.completedAt);
    });

    it('mutations are refused after completion (task create, apply, member remove, deadline change)', async () => {
      // 1. Task create rejected
      const taskRes = await request(server)
        .post('/tasks')
        .set('Authorization', ownerToken)
        .send({
          projectId: completedProjId,
          title: 'Illegal Post-Completion Task',
          dueDate: FUTURE_DUE,
        });
      expect([400, 409]).toContain(taskRes.status);

      // 2. Join request apply rejected
      const applyToken = ctx.loginAs('3', [], { role: 'Collaborator' });
      const applyRes = await request(server)
        .post('/join-requests')
        .set('Authorization', applyToken)
        .send({
          projectId: completedProjId,
          message: 'Applying to completed project',
        });
      expect([400, 409]).toContain(applyRes.status);

      // 3. Deadline change rejected
      const deadlineRes = await request(server)
        .patch(`/projects/${completedProjId}/deadline`)
        .set('Authorization', ownerToken)
        .send({
          dueDate: '2027-05-01T00:00:00.000Z',
          reason: 'Attempting post-completion shift on locked project',
        });
      expect([400, 409]).toContain(deadlineRes.status);

      // 4. Remove member rejected
      const removeRes = await request(server)
        .delete(`/projects/${completedProjId}/members/2`)
        .set('Authorization', ownerToken)
        .send({ reason: 'Attempting post-completion member removal' });
      expect([400, 409]).toContain(removeRes.status);
    });

    it('removed endpoints (clone, export.md) return 404', async () => {
      const cloneRes = await request(server)
        .post(`/projects/${completedProjId}/clone`)
        .set('Authorization', ownerToken);
      expect(cloneRes.status).toBe(404);

      const exportRes = await request(server)
        .get(`/projects/${completedProjId}/export.md`)
        .set('Authorization', ownerToken);
      expect(exportRes.status).toBe(404);
    });

    it('marketplace excludes completed projects, but completed lists include it', async () => {
      // Marketplace query excludes it
      const marketRes = await request(server)
        .get('/projects')
        .set('Authorization', collabToken);
      expect(marketRes.status).toBe(200);
      expect(marketRes.body.some((p: any) => p.id === completedProjId)).toBe(false);

      // Owner completed list includes it
      const completedListRes = await request(server)
        .get('/projects?status=completed')
        .set('Authorization', ownerToken);
      expect(completedListRes.status).toBe(200);
      expect(completedListRes.body.some((p: any) => p.id === completedProjId)).toBe(true);
    });
  });
});
