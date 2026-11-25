import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, TestAppContext } from './helpers/test-helpers';
import { MentorMarketplaceService } from '../src/mentor-marketplace/mentor-marketplace.service';
import { ProjectsRepository } from '../src/projects/projects.repository';
import { ProjectStatus, ProjectDifficulty } from '../src/projects/dto/create-project.dto';

describe('Phase 9 E2E Tests: Escrow & Payment Safety', () => {
  let ctx: TestAppContext;
  let app: INestApplication;
  let server: any;
  let mentorMarketplaceService: MentorMarketplaceService;
  let projectsRepo: ProjectsRepository;

  beforeAll(async () => {
    ctx = await createTestApp();
    app = ctx.app;
    server = app.getHttpServer();
    mentorMarketplaceService = app.get(MentorMarketplaceService);
    projectsRepo = app.get(ProjectsRepository);
  });

  beforeEach(() => {
    ctx.resetStores();
    ctx.clockService.setTime('2026-03-01T12:00:00.000Z');
    const m = (mentorMarketplaceService as any).profiles?.find((p: any) => p.id === 'mentor-profile-1');
    if (m) m.maxActiveMentees = 10;
  });

  afterAll(async () => {
    await app.close();
  });

  const createCleanProject = (title: string, dueDate?: string) => {
    return projectsRepo.create('1', {
      title,
      description: 'Clean project for mentor booking test',
      difficulty: ProjectDifficulty.Medium,
      requiredSkills: ['React', 'TypeScript'],
      duration: '2 Months',
      dueDate: dueDate || '2027-02-28T00:00:00.000Z',
    } as any, ProjectStatus.Open);
  };

  describe('1. Booking Flow (No Date/Time, Request & Pay)', () => {
    it('accepts booking with only projectId, mentorId, and projectDescription', async () => {
      const p = createCleanProject('P9 Window Test 4', '2026-03-20T00:00:00.000Z');

      const res = await request(server)
        .post('/mentor-marketplace/sessions/book')
        .set('Authorization', ctx.loginAs('project-owner'))
        .set('x-user-id', '1')
        .send({
          mentorId: 'mentor-profile-1',
          projectId: p.id,
          projectDescription: 'Valid mentorship booking without date/time',
        });

      expect(res.status).toBe(201);
      expect(res.body.session).toBeDefined();
      expect(res.body.session.status).toBe('payment_pending');
      expect(res.body.session.scheduledAt).toBeUndefined();
      expect(res.body.session.durationMinutes).toBeUndefined();
      expect(res.body.paymentIntent).toBeDefined();
    });

    it('ignores old scheduledAt and durationMinutes if sent per DTO policy', async () => {
      const p = createCleanProject('P9 Ignore Old Fields', '2026-03-20T00:00:00.000Z');

      const res = await request(server)
        .post('/mentor-marketplace/sessions/book')
        .set('Authorization', ctx.loginAs('project-owner'))
        .set('x-user-id', '1')
        .send({
          mentorId: 'mentor-profile-1',
          projectId: p.id,
          projectDescription: 'Booking sending old time fields',
          scheduledAt: '2026-03-10T10:00:00.000Z',
          durationMinutes: 60,
        });

      expect(res.status).toBe(201);
      expect(res.body.session.scheduledAt).toBeUndefined();
      expect(res.body.session.durationMinutes).toBeUndefined();
    });
  });

  describe('2. Payment Idempotency & 409 ALREADY_PAID', () => {
    it('idempotency key: same key charges once, different key on paid session throws 409 ALREADY_PAID', async () => {
      const p = createCleanProject('P9 Idempotency Project', '2026-03-25T00:00:00.000Z');
      const bookRes = await request(server)
        .post('/mentor-marketplace/sessions/book')
        .set('Authorization', ctx.loginAs('project-owner'))
        .set('x-user-id', '1')
        .send({
          mentorId: 'mentor-profile-1',
          projectId: p.id,
          projectDescription: 'Mentorship on architecture',
          scheduledAt: '2026-03-10T10:00:00.000Z',
        });

      expect(bookRes.status).toBe(201);
      const sessionId = bookRes.body.session.id;

      const keyA = 'idemp-uuid-alpha-999';
      const keyB = 'idemp-uuid-beta-888';

      // 2. First payment with keyA -> 200 funded
      const pay1 = await request(server)
        .post(`/mentor-marketplace/sessions/${sessionId}/confirm-payment`)
        .set('Authorization', ctx.loginAs('project-owner'))
        .set('x-user-id', '1')
        .set('Idempotency-Key', keyA)
        .send();

      expect(pay1.status).toBe(200);
      expect(pay1.body.session.status).toBe('escrow_funded');
      const escrowId1 = pay1.body.escrow.id;

      // 3. Second payment with SAME keyA -> 200 returns original result, no duplicate charge
      const pay2 = await request(server)
        .post(`/mentor-marketplace/sessions/${sessionId}/confirm-payment`)
        .set('Authorization', ctx.loginAs('project-owner'))
        .set('x-user-id', '1')
        .set('Idempotency-Key', keyA)
        .send();

      expect(pay2.status).toBe(200);
      expect(pay2.body.session.status).toBe('escrow_funded');
      expect(pay2.body.escrow.id).toBe(escrowId1);

      // 4. Also works on the alias route POST /pay with SAME keyA -> 200
      const payAlias = await request(server)
        .post(`/mentor-marketplace/sessions/${sessionId}/pay`)
        .set('Authorization', ctx.loginAs('project-owner'))
        .set('x-user-id', '1')
        .set('Idempotency-Key', keyA)
        .send();

      expect(payAlias.status).toBe(200);
      expect(payAlias.body.escrow.id).toBe(escrowId1);

      // 5. Payment with DIFFERENT keyB on already funded session -> 409 ALREADY_PAID
      const payDiff = await request(server)
        .post(`/mentor-marketplace/sessions/${sessionId}/confirm-payment`)
        .set('Authorization', ctx.loginAs('project-owner'))
        .set('x-user-id', '1')
        .set('Idempotency-Key', keyB)
        .send();

      expect(payDiff.status).toBe(409);
      expect(payDiff.body.code).toBe('ALREADY_PAID');
      expect(payDiff.body.message).toContain('already been paid for');
    });
  });

  describe('3. Payment Expiry Job (30-min window) in Hourly Tick', () => {
    it('cancels payment_pending sessions older than 30 minutes during hourly tick', async () => {
      const p = createCleanProject('P9 Auto Expiry Project', '2026-03-25T00:00:00.000Z');
      const bookRes = await request(server)
        .post('/mentor-marketplace/sessions/book')
        .set('Authorization', ctx.loginAs('project-owner'))
        .set('x-user-id', '1')
        .send({
          mentorId: 'mentor-profile-1',
          projectId: p.id,
          projectDescription: 'Session to test auto-expiry',
          scheduledAt: '2026-03-12T10:00:00.000Z',
        });

      expect(bookRes.status).toBe(201);
      const sessionId = bookRes.body.session.id;

      // 2. Advance clock by 35 minutes (> 30 min PAYMENT_PENDING_EXPIRY_MS)
      ctx.clockService.advanceTime(35 * 60 * 1000);

      // 3. Superuser triggers the hourly tick
      const tickRes = await request(server)
        .post('/admin/jobs/tick')
        .set('Authorization', ctx.loginAs('superuser'))
        .set('x-user-id', 'u-superuser')
        .send();

      expect(tickRes.status).toBe(202);
      const runId = tickRes.body.runId;
      expect(runId).toBeDefined();

      // 4. Check run details from GET /admin/jobs/runs/:id
      const runRes = await request(server)
        .get(`/admin/jobs/runs/${runId}`)
        .set('Authorization', ctx.loginAs('admin'))
        .set('x-user-id', 'u-admin');

      expect(runRes.status).toBe(200);
      const expireJob = runRes.body.jobs.find((j: any) => j.name === 'expirePendingPayments');
      expect(expireJob).toBeDefined();
      expect(expireJob.itemsProcessed).toBeGreaterThanOrEqual(1);

      // 5. Session status must be cancelled with reason "Payment not completed"
      const session = mentorMarketplaceService.findSession(sessionId);
      expect(session.status).toBe('cancelled');
      expect(session.declineReason).toBe('Payment not completed');
    });
  });

  describe('4. Project Closure Refunds & Idempotency', () => {
    it('settles open sessions on project closure and does not refund twice on second closure call', async () => {
      const p = createCleanProject('P9 Closure Refund Project', '2026-03-25T00:00:00.000Z');
      const bookRes = await request(server)
        .post('/mentor-marketplace/sessions/book')
        .set('Authorization', ctx.loginAs('project-owner'))
        .set('x-user-id', '1')
        .send({
          mentorId: 'mentor-profile-1',
          projectId: p.id,
          projectDescription: 'Session to test closure refund',
          scheduledAt: '2026-03-12T10:00:00.000Z',
        });

      expect(bookRes.status).toBe(201);
      const sessionId = bookRes.body.session.id;
      await request(server)
        .post(`/mentor-marketplace/sessions/${sessionId}/confirm-payment`)
        .set('Authorization', ctx.loginAs('project-owner'))
        .set('x-user-id', '1')
        .set('Idempotency-Key', 'idemp-closure-test-1')
        .send();

      // Session is now escrow_funded
      expect(mentorMarketplaceService.findSession(sessionId).status).toBe('escrow_funded');

      // 2. Trigger project closure
      mentorMarketplaceService.handleProjectClosed(p.id, 'Admin project closure test', true);

      // Session must be refunded
      const closedSession = mentorMarketplaceService.findSession(sessionId);
      expect(closedSession.status).toBe('refunded');

      // 3. Second closure call on the same project does nothing (idempotent status guard)
      mentorMarketplaceService.handleProjectClosed(p.id, 'Admin project closure test', true);
      expect(mentorMarketplaceService.findSession(sessionId).status).toBe('refunded');
    });
  });

  describe('5. Escrow Reconciliation Endpoint (GET /admin/escrow/reconcile)', () => {
    it('returns 403 Forbidden for non-admin/non-superuser', async () => {
      const res = await request(server)
        .get('/admin/escrow/reconcile')
        .set('Authorization', ctx.loginAs('collaborator'))
        .set('x-user-id', '2');

      expect(res.status).toBe(403);
    });

    it('returns 200 with ok: true and mismatches: [] for Admin and Super User', async () => {
      // Admin
      const adminRes = await request(server)
        .get('/admin/escrow/reconcile')
        .set('Authorization', ctx.loginAs('admin'))
        .set('x-user-id', 'u-admin');

      expect(adminRes.status).toBe(200);
      expect(adminRes.body.ok).toBe(true);
      expect(adminRes.body.mismatches).toHaveLength(0);
      expect(adminRes.body.totalSessions).toBeGreaterThan(0);

      // Super User
      const suRes = await request(server)
        .get('/admin/escrow/reconcile')
        .set('Authorization', ctx.loginAs('superuser'))
        .set('x-user-id', 'u-superuser');

      expect(suRes.status).toBe(200);
      expect(suRes.body.ok).toBe(true);
      expect(suRes.body.mismatches).toHaveLength(0);
    });
  });
});
