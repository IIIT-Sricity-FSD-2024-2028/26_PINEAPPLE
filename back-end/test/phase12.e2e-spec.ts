import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, TestAppContext } from './helpers/test-helpers';
import { ProjectStatus } from '../src/projects/dto/create-project.dto';
import { TaskStatus } from '../src/tasks/dto/create-task.dto';

describe('Phase 12 E2E API Tests: Stuck Projects, Requests & Inactivity', () => {
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
    ctx.clockService.setTime('2026-11-11T12:00:00.000Z');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Release Tasks Endpoint (POST /projects/:id/members/:userId/release-tasks)', () => {
    it('releases To Do & In Progress tasks, leaves In Review intact, enforces RBAC, returns 409 NOTHING_TO_RELEASE when empty', async () => {
      const proj = ctx.projectsService.create('1', {
        title: 'Release E2E Project',
        description: 'Testing owner release-tasks endpoint and permissions to ensure assigned tasks transition accurately upon release.',
        teamSize: 4,
        dueDate: '2027-06-01T00:00:00.000Z',
      });
      ctx.projectsService.addCollaborator(proj.id, { id: '2', name: 'Arjun Sharma', role: 'Collaborator' });

      const tProg = ctx.tasksService.create({
        projectId: proj.id,
        title: 'Assigned In Progress',
        status: TaskStatus.InProgress,
        assigneeId: '2',
        assigneeName: 'Arjun Sharma',
        dueDate: '2027-05-01T00:00:00.000Z',
      });
      const tTodo = ctx.tasksService.create({
        projectId: proj.id,
        title: 'Assigned Open',
        status: TaskStatus.ToDo,
        assigneeId: '2',
        assigneeName: 'Arjun Sharma',
        dueDate: '2027-05-01T00:00:00.000Z',
      });
      const tReview = ctx.tasksService.create({
        projectId: proj.id,
        title: 'Submitted For Review',
        status: TaskStatus.InReview,
        assigneeId: '2',
        assigneeName: 'Arjun Sharma',
        dueDate: '2027-05-01T00:00:00.000Z',
      });

      // Collaborator cannot call release-tasks
      const forbiddenRes = await request(server)
        .post(`/projects/${proj.id}/members/2/release-tasks`)
        .set('Authorization', ctx.loginAs('2'));
      expect(forbiddenRes.status).toBe(403);

      // Owner releases tasks -> 200 { released: 2 }
      const releaseRes = await request(server)
        .post(`/projects/${proj.id}/members/2/release-tasks`)
        .set('Authorization', ctx.loginAs('1'));
      expect(releaseRes.status).toBe(200);
      expect(releaseRes.body.released).toBe(2);

      expect(ctx.tasksService.findById(tProg.id).assigneeId).toBeUndefined();
      expect(ctx.tasksService.findById(tProg.id).status).toBe(TaskStatus.ToDo);
      expect(ctx.tasksService.findById(tTodo.id).assigneeId).toBeUndefined();
      expect(ctx.tasksService.findById(tReview.id).assigneeId).toBe('2');
      expect(ctx.tasksService.findById(tReview.id).status).toBe(TaskStatus.InReview);

      // Calling again returns 409 NOTHING_TO_RELEASE
      const emptyRes = await request(server)
        .post(`/projects/${proj.id}/members/2/release-tasks`)
        .set('Authorization', ctx.loginAs('1'));
      expect(emptyRes.status).toBe(409);
      expect(JSON.stringify(emptyRes.body)).toContain('NOTHING_TO_RELEASE');
    });
  });

  describe('2. Request Close & Admin Inactive-Owner Close + Closure Refund', () => {
    it('returns 409 NOT_ELIGIBLE before 30d; creates admin case at 30d; admin closes with refund', async () => {
      const startIso = ctx.clockService.nowIso();
      ctx.usersRepository.findById('1')!.lastActiveAt = startIso;

      const proj = ctx.projectsService.create('1', {
        title: 'Long Abandoned E2E Project',
        description: 'Testing 30-day inactivity close request and admin closure with escrow refund across all non-terminal mentor sessions.',
        teamSize: 4,
        dueDate: '2027-06-01T00:00:00.000Z',
      });
      ctx.projectsRepository.findById(proj.id)!.lastOwnerActionAt = startIso;
      ctx.projectsService.addCollaborator(proj.id, { id: '2', name: 'Arjun Sharma', role: 'Collaborator' });

      // Book and fund a mentor session while owner is initially active
      const bookRes = await request(server)
        .post('/mentor-marketplace/sessions/book')
        .set('Authorization', ctx.loginAs('1'))
        .send({
          mentorId: 'mentor-profile-1',
          projectId: proj.id,
          projectDescription: 'Initial milestone review before inactivity',
          scheduledAt: '2027-02-15T14:00:00.000Z',
        });
      expect(bookRes.status).toBe(201);
      const sessionId = bookRes.body?.session?.id;
      expect(sessionId).toBeDefined();

      // Re-pin owner action timestamp back to startIso right after booking for clean 30d simulation
      ctx.projectsRepository.findById(proj.id)!.lastOwnerActionAt = startIso;
      ctx.usersRepository.findById('1')!.lastActiveAt = startIso;

      // Before 30 days -> 409 NOT_ELIGIBLE
      const tooEarlyRes = await request(server)
        .post(`/projects/${proj.id}/request-close`)
        .set('Authorization', ctx.loginAs('2'))
        .send({ reason: 'Owner missing' });
      expect(tooEarlyRes.status).toBe(409);
      expect(JSON.stringify(tooEarlyRes.body)).toContain('NOT_ELIGIBLE');

      // Advance 31 days and trigger tick as super user
      ctx.advanceTime({ days: 31 });
      const tickRes = await request(server)
        .post('/admin/jobs/tick')
        .set('Authorization', ctx.loginAs('superuser'));
      expect(tickRes.status).toBe(202);

      // Project must STILL not be closed automatically
      const midProj = ctx.projectsRepository.findById(proj.id)!;
      expect(midProj.ownerInactive30d).toBe(true);
      expect(midProj.status).toBe(ProjectStatus.Open);

      // Non-member cannot request close -> 403
      const nonMemberRes = await request(server)
        .post(`/projects/${proj.id}/request-close`)
        .set('Authorization', ctx.loginAs('7'))
        .send({});
      expect(nonMemberRes.status).toBe(403);

      // Active collaborator requests close -> 200 with support ticket
      const reqCloseRes = await request(server)
        .post(`/projects/${proj.id}/request-close`)
        .set('Authorization', ctx.loginAs('2'))
        .send({ reason: 'Owner unresponsive for 30+ days' });
      expect(reqCloseRes.status).toBe(200);
      expect(reqCloseRes.body.success).toBe(true);
      expect(reqCloseRes.body.ticketId).toBeDefined();

      const tickets = ctx.supportService.findByProject(proj.id);
      expect(tickets).toHaveLength(1);
      expect(tickets[0].category).toBe('Project Closure Request');

      // Admin closes project with reason "Owner inactive"
      const adminCloseRes = await request(server)
        .post(`/admin/projects/${proj.id}/close`)
        .set('Authorization', ctx.loginAs('admin'))
        .send({ reason: 'Owner inactive' });
      expect(adminCloseRes.status).toBe(200);
      expect(adminCloseRes.body.status).toBe(ProjectStatus.Closed);
      expect(adminCloseRes.body.closureReason).toBe('Owner inactive');

      // Payment-pending mentor session cancelled by Phase 9 closure settlement
      const sessRes = await request(server)
        .get('/mentor-marketplace/sessions/mine')
        .set('Authorization', ctx.loginAs('1'));
      expect(sessRes.status).toBe(200);
      const list = Array.isArray(sessRes.body) ? sessRes.body : [];
      const cancelledSess = list.find((s: any) => s.id === sessionId);
      expect(cancelledSess).toBeDefined();
      expect(['cancelled', 'refunded']).toContain(cancelledSess.status);
    });
  });

  describe('3. Early Withdraw Refund + Viewed Tracking + Zombie Breaker via HTTP Tick', () => {
    it('tracks owner GET viewedAt for withdraw slot restoration and applies zombie breaker on tick after 48h', async () => {
      const proj = ctx.projectsService.create('1', {
        title: 'Zombie E2E Project',
        description: 'Testing early withdraw and 48h zombie project break end-to-end when owner fails to respond to pending requests.',
        teamSize: 4,
        dueDate: '2027-06-01T00:00:00.000Z',
      });

      // Collaborator '7' applies at t=0
      const apply1 = await request(server)
        .post('/join-requests')
        .set('Authorization', ctx.loginAs('7'))
        .send({ projectId: proj.id, message: 'Fast apply' });
      expect(apply1.status).toBe(201);
      const r1Id = apply1.body.id;

      // Withdraw within 30 mins without owner viewing -> slot restored
      ctx.advanceTime({ ms: 30 * 60 * 1000 });
      const wd1 = await request(server)
        .delete(`/join-requests/${r1Id}`)
        .set('Authorization', ctx.loginAs('7'));
      expect(wd1.status).toBe(200);
      expect(ctx.joinRequestsService.requestsUsed('7', proj.id)).toBe(0);

      // Re-apply, owner opens GET /join-requests?projectId=... (sets viewedAt), then withdraw within 5 mins -> counted!
      const apply2 = await request(server)
        .post('/join-requests')
        .set('Authorization', ctx.loginAs('7'))
        .send({ projectId: proj.id, message: 'Viewed apply' });
      expect(apply2.status).toBe(201);
      const r2Id = apply2.body.id;

      const ownerViewRes = await request(server)
        .get(`/join-requests?projectId=${proj.id}`)
        .set('Authorization', ctx.loginAs('1'));
      expect(ownerViewRes.status).toBe(200);

      ctx.advanceTime({ ms: 5 * 60 * 1000 });
      const wd2 = await request(server)
        .delete(`/join-requests/${r2Id}`)
        .set('Authorization', ctx.loginAs('7'));
      expect(wd2.status).toBe(200);
      expect(ctx.joinRequestsService.requestsUsed('7', proj.id)).toBe(1);

      // Another collaborator '2' applies and leaves request pending
      const applyCollab2 = await request(server)
        .post('/join-requests')
        .set('Authorization', ctx.loginAs('2'))
        .send({ projectId: proj.id, message: 'Pending for zombie test' });
      expect(applyCollab2.status).toBe(201);
      const pendingReqId = applyCollab2.body.id;

      // Advance to day 5 + 1h from project creation and run tick -> pauses project for 48h
      ctx.clockService.setTime(new Date(new Date(proj.createdAt).getTime() + (5 * 24 + 1) * 3600 * 1000));
      const tick1 = await request(server)
        .post('/admin/jobs/tick')
        .set('Authorization', ctx.loginAs('superuser'));
      expect(tick1.status).toBe(202);
      expect(ctx.projectsRepository.findById(proj.id)!.pausedAt).toBeDefined();
      expect(ctx.projectsRepository.findById(proj.id)!.status).toBe(ProjectStatus.Open);

      // Advance 50 hours and trigger tick -> closes paused project and marks request system_closed
      ctx.advanceTime({ hours: 50 });
      const tick2 = await request(server)
        .post('/admin/jobs/tick')
        .set('Authorization', ctx.loginAs('superuser'));
      expect(tick2.status).toBe(202);

      const finalProj = ctx.projectsRepository.findById(proj.id)!;
      expect(finalProj.status).toBe(ProjectStatus.Closed);
      expect(finalProj.closureReason).toBe('No owner response');

      const finalReq = ctx.joinRequestsService.findByProject(proj.id).find((r) => r.id === pendingReqId)!;
      expect(finalReq.status).toBe('system_closed');
      expect(ctx.joinRequestsService.requestsUsed('2', proj.id)).toBe(0);

      // Closed project rejects subsequent join requests
      const blockedApply = await request(server)
        .post('/join-requests')
        .set('Authorization', ctx.loginAs('2'))
        .send({ projectId: proj.id, message: 'Too late' });
      expect(blockedApply.status).toBe(409);
    });
  });
});
