import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, TestAppContext } from './helpers/test-helpers';

describe('Phase 7 E2E Tests: Scheduler, Manual Tick, Run Log & Time-based Policy Execution', () => {
  let ctx: TestAppContext;
  let app: INestApplication;
  let server: any;

  beforeAll(async () => {
    ctx = await createTestApp();
    app = ctx.app;
    server = app.getHttpServer();
  });

  beforeEach(() => {
    ctx.resetStores();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. RBAC & Access Control on Scheduled Jobs Endpoints', () => {
    it('collaborator receives 403 Forbidden on POST /admin/jobs/tick', async () => {
      const res = await request(server)
        .post('/admin/jobs/tick')
        .set('Authorization', ctx.loginAs('collaborator'));

      expect(res.status).toBe(403);
    });

    it('collaborator receives 403 Forbidden on GET /admin/jobs/runs', async () => {
      const res = await request(server)
        .get('/admin/jobs/runs')
        .set('Authorization', ctx.loginAs('collaborator'));

      expect(res.status).toBe(403);
    });

    it('admin receives 403 Forbidden on POST /admin/jobs/tick (Super User only)', async () => {
      const res = await request(server)
        .post('/admin/jobs/tick')
        .set('Authorization', ctx.loginAs('admin'));

      expect(res.status).toBe(403);
    });

    it('admin receives 200 OK on GET /admin/jobs/runs (read-only access)', async () => {
      const res = await request(server)
        .get('/admin/jobs/runs')
        .set('Authorization', ctx.loginAs('admin'));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('2. Super User Trigger & Run Details', () => {
    it('Super User triggers tick with 202 Accepted, and run appears with status success', async () => {
      const triggerRes = await request(server)
        .post('/admin/jobs/tick')
        .set('Authorization', ctx.loginAs('superuser'));

      expect(triggerRes.status).toBe(202);
      expect(triggerRes.body).toHaveProperty('runId');
      const runId = triggerRes.body.runId;

      // Verify run appears in runs list
      const listRes = await request(server)
        .get('/admin/jobs/runs')
        .set('Authorization', ctx.loginAs('superuser'));

      expect(listRes.status).toBe(200);
      const found = listRes.body.find((r: any) => r.id === runId);
      expect(found).toBeDefined();
      expect(found.status).toBe('success');
      expect(found.trigger).toBe('manual');

      // Verify single run endpoint returns per-job details
      const detailRes = await request(server)
        .get(`/admin/jobs/runs/${runId}`)
        .set('Authorization', ctx.loginAs('superuser'));

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.id).toBe(runId);
      expect(detailRes.body.status).toBe('success');
      expect(Array.isArray(detailRes.body.jobs)).toBe(true);
      expect(detailRes.body.jobs.length).toBeGreaterThanOrEqual(3);

      const jobNames = detailRes.body.jobs.map((j: any) => j.name);
      expect(jobNames).toContain('closeEmptyProjects');
      expect(jobNames).toContain('expireMentorRequests');
      expect(jobNames).toContain('applyDeadlinePenalties');
    });

    it('returns 409 JOB_ALREADY_RUNNING with running runId when a tick is already in progress', async () => {
      // Simulate an active run in progress holding the in-memory lock
      const activeRun = ctx.jobRunsService.start('manual');
      expect(ctx.jobRunsService.isLockActive()).toBe(true);

      const res = await request(server)
        .post('/admin/jobs/tick')
        .set('Authorization', ctx.loginAs('superuser'));

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('JOB_ALREADY_RUNNING');
      expect(res.body.runId).toBe(activeRun.id);

      // Finish active run to release lock
      ctx.jobRunsService.finishRun(activeRun.id);
      expect(ctx.jobRunsService.isLockActive()).toBe(false);
    });

    it('returns 404 RUN_NOT_FOUND when requesting an unknown run ID', async () => {
      const res = await request(server)
        .get('/admin/jobs/runs/non-existent-run-id-999')
        .set('Authorization', ctx.loginAs('admin'));

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('RUN_NOT_FOUND');
    });
  });

  describe('3. Injectable Clock & Time-based Policy Execution', () => {
    it('project with no applicants created 5 days ago closes after a tick, and is still open after a tick at day 4', async () => {
      // Set initial clock
      ctx.clockService.setTime('2026-04-01T00:00:00.000Z');

      // Create a project at day 0
      const createRes = await request(server)
        .post('/projects')
        .set('Authorization', ctx.loginAs('project-owner'))
        .send({
          title: 'Orphaned Inactivity Project',
          description: 'A test project with no collaborators or applicants designed to verify the five-day inactivity closure job.',
          category: 'Web Development',
          skills: ['React'],
          dueDate: '2026-05-01T00:00:00.000Z',
          maxCollaborators: 3,
        });

      expect(createRes.status).toBe(201);
      const projectId = createRes.body.id || createRes.body.project?.id;
      expect(projectId).toBeDefined();

      // Check project is initially Open
      let project = ctx.projectsRepository.findById(projectId);
      expect(project?.status).toBe('Open');

      // Advance clock 4 days (96 hours)
      ctx.advanceTime({ days: 4 });

      // Run tick at Day 4
      const day4TickRes = await request(server)
        .post('/admin/jobs/tick')
        .set('Authorization', ctx.loginAs('superuser'));
      expect(day4TickRes.status).toBe(202);

      // Project must STILL be Open at Day 4
      project = ctx.projectsRepository.findById(projectId);
      expect(project?.status).toBe('Open');
      expect((project as any)?.day4ReminderSentAt).toBeDefined();

      // Advance clock by 1 more day (reaching 5 days / 120 hours total)
      ctx.advanceTime({ days: 1 });

      // Run tick at Day 5
      const day5TickRes = await request(server)
        .post('/admin/jobs/tick')
        .set('Authorization', ctx.loginAs('superuser'));
      expect(day5TickRes.status).toBe(202);

      // Project must now be CLOSED with reason "No applicants within 5 days"
      project = ctx.projectsRepository.findById(projectId);
      expect(project?.status).toBe('Closed');
      expect((project as any)?.closureReason).toBe('No applicants within 5 days');
    });
  });
});
