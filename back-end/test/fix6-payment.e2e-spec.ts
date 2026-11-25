import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, TestAppContext } from './helpers/test-helpers';
import { MentorMarketplaceService } from '../src/mentor-marketplace/mentor-marketplace.service';
import { ProjectsRepository } from '../src/projects/projects.repository';
import { UsersRepository } from '../src/users/users.repository';
import { ProjectStatus, ProjectDifficulty } from '../src/projects/dto/create-project.dto';

describe('Fix 6 E2E Tests: Mentor Booking Payment & CORS Preflight', () => {
  let ctx: TestAppContext;
  let app: INestApplication;
  let server: any;
  let mentorMarketplaceService: MentorMarketplaceService;
  let projectsRepo: ProjectsRepository;
  let usersRepo: UsersRepository;

  beforeAll(async () => {
    ctx = await createTestApp();
    app = ctx.app;
    server = app.getHttpServer();
    mentorMarketplaceService = app.get(MentorMarketplaceService);
    projectsRepo = app.get(ProjectsRepository);
    usersRepo = app.get(UsersRepository);
  });

  beforeEach(() => {
    ctx.resetStores();
  });

  afterAll(async () => {
    await app.close();
  });

  const getFutureDates = (dayOffset = 7) => {
    const now = Date.now();
    const scheduledAt = new Date(now + dayOffset * 24 * 60 * 60 * 1000).toISOString();
    const dueDate = new Date(now + 60 * 24 * 60 * 60 * 1000).toISOString();
    return { scheduledAt, dueDate };
  };

  const createCleanProject = (title: string, dueDate?: string) => {
    const dates = getFutureDates(10);
    return projectsRepo.create(
      '1',
      {
        title,
        description: 'Clean project for payment test',
        difficulty: ProjectDifficulty.Medium,
        requiredSkills: ['React', 'TypeScript'],
        duration: '2 Months',
        dueDate: dueDate || dates.dueDate,
      } as any,
      ProjectStatus.Open,
    );
  };

  describe('1. CORS Preflight & Header Compliance', () => {
    it('responds to OPTIONS preflight with Idempotency-Key allowed for dev frontend origin', async () => {
      const res = await request(server)
        .options('/mentor-marketplace/sessions/sess-123/confirm-payment')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'authorization,content-type,idempotency-key');

      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      expect(res.headers['access-control-allow-credentials']).toBe('true');

      const allowedHeaders = (res.headers['access-control-allow-headers'] || '').toLowerCase();
      expect(allowedHeaders).toContain('idempotency-key');
      expect(allowedHeaders).toContain('authorization');
      expect(allowedHeaders).toContain('content-type');
    });

    it('OPTIONS preflight on alias route /pay also allows Idempotency-Key', async () => {
      const res = await request(server)
        .options('/mentor-marketplace/sessions/sess-123/pay')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'authorization,content-type,idempotency-key');

      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      const allowedHeaders = (res.headers['access-control-allow-headers'] || '').toLowerCase();
      expect(allowedHeaders).toContain('idempotency-key');
    });

    it('OPTIONS preflight exposes X-Boot-Id and Retry-After', async () => {
      const res = await request(server)
        .options('/mentor-marketplace/sessions/sess-123/confirm-payment')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'authorization,content-type,idempotency-key');

      expect(res.status).toBe(204);
      const exposedHeaders = (res.headers['access-control-expose-headers'] || '').toLowerCase();
      expect(exposedHeaders).toContain('x-boot-id');
      expect(exposedHeaders).toContain('retry-after');
    });

    it('rejects preflight from unauthorized origin (does not return Access-Control-Allow-Origin)', async () => {
      const res = await request(server)
        .options('/mentor-marketplace/sessions/sess-123/confirm-payment')
        .set('Origin', 'http://malicious-site.com')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'authorization,content-type,idempotency-key');

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('2. Browser Payment Flow & Escrow Funding', () => {
    it('executes payment successfully with Idempotency-Key and funds escrow', async () => {
      const dates = getFutureDates(5);
      const p = createCleanProject('Fix6 Booking Project 1', dates.dueDate);

      // Book session
      const bookRes = await request(server)
        .post('/mentor-marketplace/sessions/book')
        .set('Authorization', ctx.loginAs('project-owner'))
        .set('x-user-id', '1')
        .send({
          mentorId: 'mentor-profile-1',
          projectId: p.id,
          projectDescription: 'Mentorship on payment safety',
          scheduledAt: dates.scheduledAt,
        });

      expect(bookRes.status).toBe(201);
      const sessionId = bookRes.body.session.id;
      expect(bookRes.body.session.status).toBe('payment_pending');

      const idempotencyKey = 'uuid-fix6-test-alpha-123';

      // Confirm payment (simulates "I have paid" button click with browser Origin)
      const payRes = await request(server)
        .post(`/mentor-marketplace/sessions/${sessionId}/confirm-payment`)
        .set('Origin', 'http://localhost:5173')
        .set('Authorization', ctx.loginAs('project-owner'))
        .set('x-user-id', '1')
        .set('Idempotency-Key', idempotencyKey)
        .send();

      expect(payRes.status).toBe(200);
      expect(payRes.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      expect(payRes.body.session.status).toBe('escrow_funded');
      expect(payRes.body.escrow).toBeDefined();
      expect(payRes.body.escrow.status.toLowerCase()).toBe('funded');
      expect(payRes.body.escrow.totalFunded).toBeGreaterThan(0);
      const firstEscrowId = payRes.body.escrow.id;

      // Retry payment with SAME Idempotency-Key (e.g. user retried after network blip)
      const retryRes = await request(server)
        .post(`/mentor-marketplace/sessions/${sessionId}/confirm-payment`)
        .set('Origin', 'http://localhost:5173')
        .set('Authorization', ctx.loginAs('project-owner'))
        .set('x-user-id', '1')
        .set('Idempotency-Key', idempotencyKey)
        .send();

      expect(retryRes.status).toBe(200);
      expect(retryRes.body.session.status).toBe('escrow_funded');
      expect(retryRes.body.escrow.id).toBe(firstEscrowId);

      // Payment with DIFFERENT Idempotency-Key on already funded session returns 409 ALREADY_PAID
      const diffKeyRes = await request(server)
        .post(`/mentor-marketplace/sessions/${sessionId}/confirm-payment`)
        .set('Origin', 'http://localhost:5173')
        .set('Authorization', ctx.loginAs('project-owner'))
        .set('x-user-id', '1')
        .set('Idempotency-Key', 'different-key-uuid-999')
        .send();

      expect(diffKeyRes.status).toBe(409);
      expect(diffKeyRes.body.code).toBe('ALREADY_PAID');
    });

    it('rejects payment on expired session with 400', async () => {
      const dates = getFutureDates(6);
      const p = createCleanProject('Expired Session Test 2', dates.dueDate);

      const bookRes = await request(server)
        .post('/mentor-marketplace/sessions/book')
        .set('Authorization', ctx.loginAs('project-owner'))
        .set('x-user-id', '1')
        .send({
          mentorId: 'mentor-profile-1',
          projectId: p.id,
          projectDescription: 'Mentorship expiring test',
          scheduledAt: dates.scheduledAt,
        });

      expect(bookRes.status).toBe(201);
      const sessionId = bookRes.body.session.id;

      // Expire session payment window (30 minutes limit)
      const session = mentorMarketplaceService.findSession(sessionId);
      session.paymentExpiresAt = new Date(Date.now() - 60000).toISOString();
      session.createdAt = new Date(Date.now() - 40 * 60 * 1000).toISOString();

      const payRes = await request(server)
        .post(`/mentor-marketplace/sessions/${sessionId}/confirm-payment`)
        .set('Origin', 'http://localhost:5173')
        .set('Authorization', ctx.loginAs('project-owner'))
        .set('x-user-id', '1')
        .set('Idempotency-Key', 'exp-key-111')
        .send();

      expect(payRes.status).toBe(400);
      expect(payRes.body.message).toMatch(/expired|cancelled/i);
    });

    it('rejects payment when user is unverified with 403 EMAIL_NOT_VERIFIED', async () => {
      const dates = getFutureDates(7);
      const p = createCleanProject('Unverified User Test 3', dates.dueDate);

      // Book session as verified owner
      const bookRes = await request(server)
        .post('/mentor-marketplace/sessions/book')
        .set('Authorization', ctx.loginAs('project-owner'))
        .set('x-user-id', '1')
        .send({
          mentorId: 'mentor-profile-1',
          projectId: p.id,
          projectDescription: 'Mentorship booking',
          scheduledAt: dates.scheduledAt,
        });

      expect(bookRes.status).toBe(201);
      const sessionId = bookRes.body.session.id;

      // Mark user '1' as non-admin project-owner with unverified email in the store
      const user = usersRepo.findById('1');
      const originalRole = user?.role;
      if (user) {
        (user as any).role = 'project-owner';
        (user as any).emailVerified = false;
      }

      const payRes = await request(server)
        .post(`/mentor-marketplace/sessions/${sessionId}/confirm-payment`)
        .set('Origin', 'http://localhost:5173')
        .set('Authorization', ctx.loginAs('project-owner'))
        .set('x-user-id', '1')
        .set('Idempotency-Key', 'unverified-key-222')
        .send();

      expect(payRes.status).toBe(403);
      expect(payRes.body.code).toBe('EMAIL_NOT_VERIFIED');
      expect(payRes.body.message).toContain('Verify your email address');

      // Restore user verification and role
      if (user) {
        (user as any).role = originalRole;
        (user as any).emailVerified = true;
      }
    });

    it('rejects payment attempt by unauthorized user with 403', async () => {
      const dates = getFutureDates(8);
      const p = createCleanProject('Unauthorized User Test 4', dates.dueDate);

      const bookRes = await request(server)
        .post('/mentor-marketplace/sessions/book')
        .set('Authorization', ctx.loginAs('project-owner'))
        .set('x-user-id', '1')
        .send({
          mentorId: 'mentor-profile-1',
          projectId: p.id,
          projectDescription: 'Mentorship booking',
          scheduledAt: dates.scheduledAt,
        });

      expect(bookRes.status).toBe(201);
      const sessionId = bookRes.body.session.id;

      // Another user (collaborator '2') attempts to pay
      const payRes = await request(server)
        .post(`/mentor-marketplace/sessions/${sessionId}/confirm-payment`)
        .set('Origin', 'http://localhost:5173')
        .set('Authorization', ctx.loginAs('collaborator'))
        .set('x-user-id', '2')
        .set('Idempotency-Key', 'other-user-key-333')
        .send();

      expect(payRes.status).toBe(403);
    });
  });
});
