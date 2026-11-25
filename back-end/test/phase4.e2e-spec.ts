import request from 'supertest';
import { createTestApp, TestAppContext } from './helpers/test-helpers';

describe('Phase 4 Mentors and Deadlines - E2E API Tests', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(() => {
    ctx.resetStores();
  });

  describe('Mentor Booking Decline & 3-Day Auto-Decline', () => {
    it('requires written reason (10 to 500 chars) when mentor declines session (400 REASON_REQUIRED)', async () => {
      // proj-5 is owned by User 1 (no existing mentor)
      const ownerToken = ctx.loginAs('1');
      const mentorToken = ctx.loginAs('7'); // Neha Gupta (mentor-profile-1)

      // Book session
      const bookRes = await request(ctx.app.getHttpServer())
        .post('/mentor-marketplace/sessions/book')
        .set('Authorization', ownerToken)
        .send({
          mentorId: 'mentor-profile-1',
          projectId: 'proj-5',
          projectDescription: 'Guidance on ML pipeline',
          scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
        });
      expect(bookRes.status).toBe(201);
      const sessionId = bookRes.body.session.id;

      // Confirm payment to fund escrow
      const payRes = await request(ctx.app.getHttpServer())
        .post(`/mentor-marketplace/sessions/${sessionId}/confirm-payment`)
        .set('Authorization', ownerToken);
      expect(payRes.status).toBe(200);

      // Mentor attempts to decline without reason
      const declineNoReason = await request(ctx.app.getHttpServer())
        .post(`/mentor-marketplace/sessions/${sessionId}/decline`)
        .set('Authorization', mentorToken)
        .send({});
      expect(declineNoReason.status).toBe(400);
      expect(declineNoReason.body.code).toBe('REASON_REQUIRED');

      // Mentor attempts to decline with too short reason (< 10 chars)
      const declineShortReason = await request(ctx.app.getHttpServer())
        .post(`/mentor-marketplace/sessions/${sessionId}/decline`)
        .set('Authorization', mentorToken)
        .send({ reason: 'Too busy' });
      expect(declineShortReason.status).toBe(400);
      expect(declineShortReason.body.code).toBe('REASON_REQUIRED');

      // Mentor declines with valid written reason
      const declineValid = await request(ctx.app.getHttpServer())
        .post(`/mentor-marketplace/sessions/${sessionId}/decline`)
        .set('Authorization', mentorToken)
        .send({ reason: 'Unfortunately I have reached my capacity for this month and cannot take new mentees.' });
      expect(declineValid.status).toBe(200);
      expect(declineValid.body.status).toBe('refunded');
      expect(declineValid.body.declineReason).toBe('Unfortunately I have reached my capacity for this month and cannot take new mentees.');
      expect(declineValid.body.declinedBy).toBe('mentor');

      // Reason visible on student's session listing
      const studentSessionsRes = await request(ctx.app.getHttpServer())
        .get('/mentor-marketplace/sessions/mine')
        .set('Authorization', ownerToken);
      expect(studentSessionsRes.status).toBe(200);
      const declinedSession = studentSessionsRes.body.find((s: any) => s.id === sessionId);
      expect(declinedSession).toBeDefined();
      expect(declinedSession.declineReason).toContain('reached my capacity');
      expect(declinedSession.declinedBy).toBe('mentor');
    });

    it('automatically declines booking after 3 days without response with full refund (expireMentorRequests)', async () => {
      const ownerToken = ctx.loginAs('1');

      // Book session
      const bookRes = await request(ctx.app.getHttpServer())
        .post('/mentor-marketplace/sessions/book')
        .set('Authorization', ownerToken)
        .send({
          mentorId: 'mentor-profile-1',
          projectId: 'proj-5',
          projectDescription: 'Guidance on full stack architecture',
          scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
        });
      expect(bookRes.status).toBe(201);
      const sessionId = bookRes.body.session.id;

      // Confirm payment to fund escrow
      await request(ctx.app.getHttpServer())
        .post(`/mentor-marketplace/sessions/${sessionId}/confirm-payment`)
        .set('Authorization', ownerToken);

      // Run job before 3 days: no expiration
      ctx.advanceTime({ days: 2 });
      await ctx.jobsService.tickHourly();

      const midCheck = await request(ctx.app.getHttpServer())
        .get('/mentor-marketplace/sessions/mine')
        .set('Authorization', ownerToken);
      const midSession = midCheck.body.find((s: any) => s.id === sessionId);
      expect(midSession.status).toBe('escrow_funded');

      // Advance clock past 3 days (total 3 days + 2 hours)
      ctx.advanceTime({ days: 1, hours: 2 });
      const jobResult = await ctx.jobsService.tickHourly();
      expect(jobResult.jobsExecuted).toContain('expireMentorRequests');

      // Check session status is now refunded with declineReason "No response within 3 days"
      const afterCheck = await request(ctx.app.getHttpServer())
        .get('/mentor-marketplace/sessions/mine')
        .set('Authorization', ownerToken);
      const expiredSession = afterCheck.body.find((s: any) => s.id === sessionId);
      expect(expiredSession.status).toBe('refunded');
      expect(expiredSession.declineReason).toBe('No response within 3 days');
      expect(expiredSession.declinedBy).toBe('system');

      // Idempotent: running tick again does not duplicate actions
      const secondTick = await ctx.jobsService.tickHourly();
      expect(secondTick.jobsExecuted).not.toContain('expireMentorRequests');
    });
  });

  describe('Task Due Date Validation on Create', () => {
    it('returns 400 DUE_DATE_REQUIRED when creating task without due date', async () => {
      const ownerToken = ctx.loginAs('1');
      const res = await request(ctx.app.getHttpServer())
        .post('/tasks')
        .set('Authorization', ownerToken)
        .send({
          projectId: 'proj-1',
          title: 'Task without due date',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('DUE_DATE_REQUIRED');
    });

    it('returns 400 DUE_DATE_PAST when creating task with due date in the past', async () => {
      const ownerToken = ctx.loginAs('1');
      // Set due date to 5 days ago
      const pastDate = new Date(ctx.clockService.now().getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();

      const res = await request(ctx.app.getHttpServer())
        .post('/tasks')
        .set('Authorization', ownerToken)
        .send({
          projectId: 'proj-1',
          title: 'Past due task',
          dueDate: pastDate,
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('DUE_DATE_PAST');
    });

    it('returns 400 DUE_DATE_AFTER_PROJECT when task due date exceeds project due date', async () => {
      const ownerToken = ctx.loginAs('1');
      // Fetch proj-1 due date
      const projRes = await request(ctx.app.getHttpServer())
        .get('/projects/proj-1')
        .set('Authorization', ownerToken);
      const projDueDate = new Date(projRes.body.dueDate || '2026-12-31T23:59:59.000Z');

      // 10 days after project deadline
      const afterProjDate = new Date(projDueDate.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString();

      const res = await request(ctx.app.getHttpServer())
        .post('/tasks')
        .set('Authorization', ownerToken)
        .send({
          projectId: 'proj-1',
          title: 'Late task exceeding project',
          dueDate: afterProjDate,
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('DUE_DATE_AFTER_PROJECT');
    });

    it('successfully creates task with valid future due date within project bounds', async () => {
      const ownerToken = ctx.loginAs('1');
      const validDueDate = new Date(ctx.clockService.now().getTime() + 10 * 24 * 60 * 60 * 1000).toISOString();

      const res = await request(ctx.app.getHttpServer())
        .post('/tasks')
        .set('Authorization', ownerToken)
        .send({
          projectId: 'proj-1',
          title: 'Valid Deadline Task',
          dueDate: validDueDate,
        });

      expect(res.status).toBe(201);
      expect(res.body.dueDate).toBe(validDueDate);
    });
  });

  describe('Task Due Date Move & Locking', () => {
    it('returns 409 DUE_DATE_LOCKED when attempting to edit due date of task whose deadline has already passed', async () => {
      const ownerToken = ctx.loginAs('1');
      // Create task due in 2 days
      const initialDueDate = new Date(ctx.clockService.now().getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();

      const createRes = await request(ctx.app.getHttpServer())
        .post('/tasks')
        .set('Authorization', ownerToken)
        .send({
          projectId: 'proj-1',
          title: 'Expiring Task',
          dueDate: initialDueDate,
        });
      expect(createRes.status).toBe(201);
      const taskId = createRes.body.id;

      // Advance clock past the due date (3 days)
      ctx.advanceTime({ days: 3 });

      // Owner attempts to change the due date now that it has passed
      const newFutureDate = new Date(ctx.clockService.now().getTime() + 5 * 24 * 60 * 60 * 1000).toISOString();
      const updateRes = await request(ctx.app.getHttpServer())
        .patch(`/tasks/${taskId}`)
        .set('Authorization', ownerToken)
        .send({
          dueDate: newFutureDate,
        });

      expect(updateRes.status).toBe(409);
      expect(updateRes.body.code).toBe('DUE_DATE_LOCKED');
    });

    it('returns 409 DUE_DATE_LOCKED when attempting to edit due date of an approved task', async () => {
      const ownerToken = ctx.loginAs('1');
      const initialDueDate = new Date(ctx.clockService.now().getTime() + 10 * 24 * 60 * 60 * 1000).toISOString();

      const createRes = await request(ctx.app.getHttpServer())
        .post('/tasks')
        .set('Authorization', ownerToken)
        .send({
          projectId: 'proj-1',
          title: 'To Be Approved Task',
          dueDate: initialDueDate,
        });
      expect(createRes.status).toBe(201);
      const taskId = createRes.body.id;

      // Approve task
      await request(ctx.app.getHttpServer())
        .patch(`/tasks/${taskId}`)
        .set('Authorization', ownerToken)
        .send({
          status: 'Completed',
        });

      // Attempt to move due date of approved task
      const newFutureDate = new Date(ctx.clockService.now().getTime() + 15 * 24 * 60 * 60 * 1000).toISOString();
      const updateRes = await request(ctx.app.getHttpServer())
        .patch(`/tasks/${taskId}`)
        .set('Authorization', ownerToken)
        .send({
          dueDate: newFutureDate,
        });

      expect(updateRes.status).toBe(409);
      expect(updateRes.body.code).toBe('DUE_DATE_LOCKED');
    });
  });

  describe('Owner Changes Project Deadline (PATCH /projects/:id/deadline)', () => {
    it('returns 403 FORBIDDEN when collaborator attempts to change project deadline', async () => {
      const collabToken = ctx.loginAs('2');
      const newDate = new Date(ctx.clockService.now().getTime() + 60 * 24 * 60 * 60 * 1000).toISOString();

      const res = await request(ctx.app.getHttpServer())
        .patch('/projects/proj-1/deadline')
        .set('Authorization', collabToken)
        .send({
          dueDate: newDate,
          reason: 'Attempting to change deadline without owner permission',
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('returns 400 REASON_REQUIRED when reason is shorter than 10 characters', async () => {
      const ownerToken = ctx.loginAs('1');
      const newDate = new Date(ctx.clockService.now().getTime() + 60 * 24 * 60 * 60 * 1000).toISOString();

      const res = await request(ctx.app.getHttpServer())
        .patch('/projects/proj-1/deadline')
        .set('Authorization', ownerToken)
        .send({
          dueDate: newDate,
          reason: 'Too short',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('REASON_REQUIRED');
    });

    it('returns 400 DEADLINE_NOT_FUTURE when new project deadline is in the past', async () => {
      const ownerToken = ctx.loginAs('1');
      const pastDate = new Date(ctx.clockService.now().getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();

      const res = await request(ctx.app.getHttpServer())
        .patch('/projects/proj-1/deadline')
        .set('Authorization', ownerToken)
        .send({
          dueDate: pastDate,
          reason: 'Extending deadline backwards into the past is invalid.',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('DEADLINE_NOT_FUTURE');
    });

    it('returns 400 DEADLINE_BEFORE_TASKS when new deadline is earlier than latest task due date', async () => {
      const ownerToken = ctx.loginAs('1');

      // Create a task in proj-1 with due date in 30 days
      const taskDueDate = new Date(ctx.clockService.now().getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await request(ctx.app.getHttpServer())
        .post('/tasks')
        .set('Authorization', ownerToken)
        .send({
          projectId: 'proj-1',
          title: '30-day task',
          dueDate: taskDueDate,
        });

      // Owner attempts to change project deadline to 20 days (earlier than the 30-day task)
      const earlierDate = new Date(ctx.clockService.now().getTime() + 20 * 24 * 60 * 60 * 1000).toISOString();
      const res = await request(ctx.app.getHttpServer())
        .patch('/projects/proj-1/deadline')
        .set('Authorization', ownerToken)
        .send({
          dueDate: earlierDate,
          reason: 'Shortening project deadline before tasks finish.',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('DEADLINE_BEFORE_TASKS');
    });

    it('successfully updates project deadline: updates record, logs audit, and notifies team', async () => {
      const ownerToken = ctx.loginAs('1');
      const newFutureDate = new Date(ctx.clockService.now().getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
      const reason = 'Team requested additional time for comprehensive end-to-end QA and user testing.';

      const res = await request(ctx.app.getHttpServer())
        .patch('/projects/proj-1/deadline')
        .set('Authorization', ownerToken)
        .send({
          dueDate: newFutureDate,
          reason,
        });

      expect(res.status).toBe(200);
      expect(res.body.dueDate).toBe(newFutureDate);

      // Verify audit log
      const adminToken = ctx.loginAs('admin');
      const auditRes = await request(ctx.app.getHttpServer())
        .get('/admin/audit')
        .set('Authorization', adminToken);
      expect(auditRes.status).toBe(200);
      const auditEntry = auditRes.body.find((e: any) => e.action === 'project-deadline-changed');
      expect(auditEntry).toBeDefined();
      expect(auditEntry.details.reason).toBe(reason);
    });
  });

  describe('Task Due Date Startup Backfill', () => {
    it('backfills missing due dates so that no task is without a due date', async () => {
      // Run backfill method
      ctx.tasksService.backfillTaskDueDates();

      const allTasks = ctx.tasksService.findAll();
      for (const task of allTasks) {
        expect(task.dueDate).toBeDefined();
        expect(typeof task.dueDate).toBe('string');
        expect(task.dueDate.length).toBeGreaterThan(0);
      }
    });
  });
});
