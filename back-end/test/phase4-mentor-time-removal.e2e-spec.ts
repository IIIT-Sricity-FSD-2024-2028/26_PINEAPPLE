import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, TestAppContext } from './helpers/test-helpers';
import { MentorMarketplaceService } from '../src/mentor-marketplace/mentor-marketplace.service';
import { ProjectsRepository } from '../src/projects/projects.repository';
import { ProjectStatus, ProjectDifficulty } from '../src/projects/dto/create-project.dto';
import { UserRole } from '../src/users/dto/create-user.dto';

describe('Phase 4 E2E Tests: Mentor Time Removal & Price Renaming', () => {
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
    (mentorMarketplaceService as any).sessions = [];
    (mentorMarketplaceService as any).disputes = [];
    (mentorMarketplaceService as any).profiles = (mentorMarketplaceService as any).profiles.filter(
      (p: any) => String(p.id).startsWith('mentor-profile-'),
    );
    ctx.clockService.setTime('2026-06-01T10:00:00.000Z');

    ctx.usersRepository.update('1', { emailVerified: true, role: UserRole.ProjectOwner } as any);
    ctx.usersRepository.update('2', { emailVerified: true, role: UserRole.ProjectOwner } as any);
    ctx.usersRepository.update('7', { emailVerified: true, role: UserRole.Mentor } as any);
  });

  afterAll(async () => {
    await app.close();
  });

  const makeProject = (
    ownerId: string,
    title: string,
    status: ProjectStatus = ProjectStatus.Open,
    extra: Record<string, any> = {},
  ) => {
    return projectsRepo.create(
      ownerId,
      {
        title,
        description: `${title} description for Phase 4 mentor time removal testing.`,
        difficulty: ProjectDifficulty.Medium,
        requiredSkills: ['TypeScript', 'React'],
        dueDate: '2026-09-01T00:00:00.000Z',
        ...extra,
      },
      status,
    );
  };

  describe('1. Booking with only project, mentor, and message', () => {
    it('creates a session with payment_pending without scheduledAt or durationMinutes', async () => {
      const proj = makeProject('1', 'Clean Booking Project');
      const ownerToken = ctx.loginAs('1');

      const res = await request(server)
        .post('/mentor-marketplace/sessions/book')
        .set('Authorization', ownerToken)
        .send({
          mentorId: 'mentor-profile-1',
          projectId: proj.id,
          projectDescription: 'Need guidance on architectural decisions',
        });

      expect(res.status).toBe(201);
      expect(res.body.session).toBeDefined();
      expect(res.body.session.status).toBe('payment_pending');
      expect(res.body.session.mentorId).toBe('mentor-profile-1');
      expect(res.body.session.projectId).toBe(proj.id);
      expect(res.body.session.projectDescription).toBe('Need guidance on architectural decisions');
      // Time fields must not exist on the session
      expect(res.body.session.scheduledAt).toBeUndefined();
      expect(res.body.session.durationMinutes).toBeUndefined();
      expect(res.body.paymentIntent).toBeDefined();
    });
  });

  describe('2. Old time fields are ignored/stripped per DTO whitelist policy', () => {
    it('silently ignores scheduledAt, durationMinutes, and date when sent by legacy callers', async () => {
      const proj = makeProject('1', 'Legacy Fields Project');
      const ownerToken = ctx.loginAs('1');

      const res = await request(server)
        .post('/mentor-marketplace/sessions/book')
        .set('Authorization', ownerToken)
        .send({
          mentorId: 'mentor-profile-1',
          projectId: proj.id,
          projectDescription: 'Booking sending legacy time parameters',
          scheduledAt: '2026-06-15T14:00:00.000Z',
          durationMinutes: 60,
          date: '2026-06-15',
        });

      expect(res.status).toBe(201);
      expect(res.body.session).toBeDefined();
      expect(res.body.session.scheduledAt).toBeUndefined();
      expect(res.body.session.durationMinutes).toBeUndefined();
      expect(res.body.session.date).toBeUndefined();
    });
  });

  describe('3. No time-conflict codes exist', () => {
    it('does not reject concurrent bookings with MENTOR_TIME_CONFLICT or OWNER_TIME_CONFLICT', async () => {
      const proj1 = makeProject('1', 'Owner 1 First Project');
      const proj2 = makeProject('2', 'Owner 2 Project');

      const owner1Token = ctx.loginAs('1');
      const owner2Token = ctx.loginAs('2');

      // Owner 1 books mentor-profile-1
      const res1 = await request(server)
        .post('/mentor-marketplace/sessions/book')
        .set('Authorization', owner1Token)
        .send({
          mentorId: 'mentor-profile-1',
          projectId: proj1.id,
          projectDescription: 'Booking 1 for Neha',
        });
      expect(res1.status).toBe(201);

      // Owner 2 also books mentor-profile-1 (previously would conflict if time overlapped)
      const res2 = await request(server)
        .post('/mentor-marketplace/sessions/book')
        .set('Authorization', owner2Token)
        .send({
          mentorId: 'mentor-profile-1',
          projectId: proj2.id,
          projectDescription: 'Booking 2 for Neha without time conflict',
        });
      expect(res2.status).toBe(201);
      expect(res2.body.code).not.toBe('MENTOR_TIME_CONFLICT');
      expect(res2.body.code).not.toBe('OWNER_TIME_CONFLICT');
    });
  });

  describe('4. Dispute window uses the adapted rule', () => {
    it('allows dispute while booking is accepted/active, and within 7 days after released/refunded', async () => {
      const proj = makeProject('1', 'Dispute Active Project');
      const ownerToken = ctx.loginAs('1');
      const mentorToken = ctx.loginAs('7');

      // Book session
      const bookRes = await request(server)
        .post('/mentor-marketplace/sessions/book')
        .set('Authorization', ownerToken)
        .send({
          mentorId: 'mentor-profile-1',
          projectId: proj.id,
          projectDescription: 'Testing dispute window on active session',
        });
      expect(bookRes.status).toBe(201);
      const sessionId = bookRes.body.session.id;

      // Confirm payment -> escrow_funded
      await request(server)
        .post(`/mentor-marketplace/sessions/${sessionId}/confirm-payment`)
        .set('Authorization', ownerToken)
        .send({})
        .expect(200);

      // Mentor accepts -> active
      await request(server)
        .post(`/mentor-marketplace/sessions/${sessionId}/accept`)
        .set('Authorization', mentorToken)
        .send({})
        .expect(200);

      // Dispute while active -> allowed (201)
      const disputeActiveRes = await request(server)
        .post(`/mentor-marketplace/sessions/${sessionId}/dispute`)
        .set('Authorization', ownerToken)
        .send({ reason: 'Mentor did not attend the scheduled discussion in project chat.' });
      expect(disputeActiveRes.status).toBe(201);
      expect(disputeActiveRes.body.status).toBe('open');
    });

    it('enforces 7-day cutoff after session is released/completed', async () => {
      const proj = makeProject('1', 'Dispute Completed Project');
      const ownerToken = ctx.loginAs('1');
      const mentorToken = ctx.loginAs('7');

      // Book & fund & accept
      const bookRes = await request(server)
        .post('/mentor-marketplace/sessions/book')
        .set('Authorization', ownerToken)
        .send({
          mentorId: 'mentor-profile-1',
          projectId: proj.id,
          projectDescription: 'Testing dispute cutoff after release',
        });
      const sessionId = bookRes.body.session.id;

      await request(server)
        .post(`/mentor-marketplace/sessions/${sessionId}/confirm-payment`)
        .set('Authorization', ownerToken)
        .send({})
        .expect(200);

      await request(server)
        .post(`/mentor-marketplace/sessions/${sessionId}/accept`)
        .set('Authorization', mentorToken)
        .send({})
        .expect(200);

      // Complete / release session
      await request(server)
        .post(`/mentor-marketplace/sessions/${sessionId}/complete`)
        .set('Authorization', ownerToken)
        .send({})
        .expect(201);

      // Advance clock 6 days (within 7-day window) -> dispute succeeds
      ctx.advanceTime({ ms: 6 * 24 * 60 * 60 * 1000 });
      const withinWindowRes = await request(server)
        .post(`/mentor-marketplace/sessions/${sessionId}/dispute`)
        .set('Authorization', ownerToken)
        .send({ reason: 'Dispute opened within 6 days after completion release.' });
      expect(withinWindowRes.status).toBe(201);

      // Create a second session, complete it, and advance 8 days (> 7-day window)
      const proj2 = makeProject('1', 'Dispute Expired Project');
      const book2 = await request(server)
        .post('/mentor-marketplace/sessions/book')
        .set('Authorization', ownerToken)
        .send({
          mentorId: 'mentor-profile-1',
          projectId: proj2.id,
          projectDescription: 'Testing expired dispute window',
        });
      const sess2Id = book2.body.session.id;

      await request(server)
        .post(`/mentor-marketplace/sessions/${sess2Id}/confirm-payment`)
        .set('Authorization', ownerToken)
        .send({})
        .expect(200);

      await request(server)
        .post(`/mentor-marketplace/sessions/${sess2Id}/accept`)
        .set('Authorization', mentorToken)
        .send({})
        .expect(200);

      await request(server)
        .post(`/mentor-marketplace/sessions/${sess2Id}/complete`)
        .set('Authorization', ownerToken)
        .send({})
        .expect(201);

      // Advance clock 8 days
      ctx.advanceTime({ ms: 8 * 24 * 60 * 60 * 1000 });

      const expiredRes = await request(server)
        .post(`/mentor-marketplace/sessions/${sess2Id}/dispute`)
        .set('Authorization', ownerToken)
        .send({ reason: 'Attempting dispute after 8 days following release.' });

      expect(expiredRes.status).toBe(409);
      expect(expiredRes.body.code).toBe('DISPUTE_WINDOW_EXPIRED');
      expect(expiredRes.body.message).toBe(
        'Disputes must be opened while booking is accepted or active, or within 7 days after it was released or refunded.',
      );
    });
  });

  describe('5. Mentor profile saves without duration and schedule', () => {
    it('creates or updates profile without sessionDuration or availability schedule', async () => {
      const mentorToken = ctx.loginAs('7');

      const profilePayload = {
        name: 'Neha Gupta',
        title: 'Lead ML Engineer',
        bio: 'Hands-on mentoring for deep learning and AI architectures.',
        skills: ['Python', 'PyTorch', 'MLOps'],
        experienceYears: 6,
        sessionPrice: 2000,
        languages: ['English', 'Hindi'],
        maxActiveMentees: 4,
      };

      const res = await request(server)
        .patch('/mentor-marketplace/mentors/profile')
        .set('Authorization', mentorToken)
        .send({
          ...profilePayload,
          // Legacy fields passed should be stripped by DTO whitelist
          sessionDuration: '60 min',
          availabilitySchedule: 'Mon-Fri 10am-5pm',
        });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Neha Gupta');
      expect(res.body.sessionPrice).toBe(2000);
      expect(res.body.sessionDuration).toBeUndefined();
      expect(res.body.availabilitySchedule).toBeUndefined();
      expect(res.body.availability).toBeUndefined();
    });
  });

  describe('6. Financial totals reconcile across book, accept, pay, release and refund', () => {
    it('reconciles fees and balances for successful session release', async () => {
      const proj = makeProject('1', 'Finance Reconcile Project');
      const ownerToken = ctx.loginAs('1');
      const mentorToken = ctx.loginAs('7');

      // Book session with mentor-profile-1 (price = 1500)
      const bookRes = await request(server)
        .post('/mentor-marketplace/sessions/book')
        .set('Authorization', ownerToken)
        .send({
          mentorId: 'mentor-profile-1',
          projectId: proj.id,
          projectDescription: 'Reconciliation verification booking',
        });
      expect(bookRes.status).toBe(201);
      const s = bookRes.body.session;
      const price = s.agreedPrice; // 1500
      expect(s.platformFee).toBe(Math.round(price * 0.15)); // 225
      expect(s.gatewayFee).toBe(Math.round(price * 0.02)); // 30
      expect(s.totalAmount).toBe(price + s.platformFee + s.gatewayFee); // 1755
      expect(s.payout).toBe(price); // 1500

      // Confirm payment
      const payRes = await request(server)
        .post(`/mentor-marketplace/sessions/${s.id}/confirm-payment`)
        .set('Authorization', ownerToken)
        .send({});
      expect(payRes.status).toBe(200);
      expect(payRes.body.session.status).toBe('escrow_funded');
      expect(payRes.body.escrow.totalFunded).toBe(s.totalAmount);

      // Mentor accepts
      const acceptRes = await request(server)
        .post(`/mentor-marketplace/sessions/${s.id}/accept`)
        .set('Authorization', mentorToken)
        .send({});
      expect(acceptRes.status).toBe(200);
      expect(acceptRes.body.status).toBe('active');

      // Owner completes session
      const completeRes = await request(server)
        .post(`/mentor-marketplace/sessions/${s.id}/complete`)
        .set('Authorization', ownerToken)
        .send({});
      expect(completeRes.status).toBe(201);
      expect(completeRes.body.status).toBe('completed');
    });

    it('reconciles full refund on cancelled session before acceptance', async () => {
      const proj = makeProject('1', 'Refund Reconcile Project');
      const ownerToken = ctx.loginAs('1');

      const bookRes = await request(server)
        .post('/mentor-marketplace/sessions/book')
        .set('Authorization', ownerToken)
        .send({
          mentorId: 'mentor-profile-1',
          projectId: proj.id,
          projectDescription: 'Testing refund calculation',
        });
      const s = bookRes.body.session;

      await request(server)
        .post(`/mentor-marketplace/sessions/${s.id}/confirm-payment`)
        .set('Authorization', ownerToken)
        .send({})
        .expect(200);

      // Owner cancels session before mentor accepts -> refunds escrow
      const cancelRes = await request(server)
        .post(`/mentor-marketplace/sessions/${s.id}/cancel`)
        .set('Authorization', ownerToken)
        .send({});
      expect(cancelRes.status).toBe(201);
      expect(cancelRes.body.status).toBe('refunded');
      expect(cancelRes.body.refundedAt).toBeDefined();
    });
  });
});
