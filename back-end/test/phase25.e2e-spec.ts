import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, TestAppContext } from './helpers/test-helpers';
import { MentorMarketplaceService } from '../src/mentor-marketplace/mentor-marketplace.service';
import { ProjectsRepository } from '../src/projects/projects.repository';
import { ProjectStatus, ProjectDifficulty } from '../src/projects/dto/create-project.dto';
import { UserRole, UserStatus } from '../src/users/dto/create-user.dto';

describe('Phase 25 E2E Tests: Mentor Booking Integrity', () => {
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
    // Isolate sessions & profiles created by prior Phase 25 tests
    (mentorMarketplaceService as any).sessions = [];
    (mentorMarketplaceService as any).profiles = (mentorMarketplaceService as any).profiles.filter(
      (p: any) => String(p.id).startsWith('mentor-profile-'),
    );
    ctx.clockService.setTime('2026-06-01T10:00:00.000Z');

    // Ensure owner '1' is email-verified and also has a verified second owner '2' promoted to ProjectOwner
    ctx.usersRepository.update('1', { emailVerified: true } as any);
    ctx.usersRepository.update('2', {
      emailVerified: true,
      role: UserRole.ProjectOwner,
    } as any);
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
        description: `${title} comprehensive project description for mentorship testing.`,
        difficulty: ProjectDifficulty.Medium,
        requiredSkills: ['TypeScript', 'NestJS'],
        duration: '2 Months',
        dueDate: '2026-08-01T00:00:00.000Z',
        ...extra,
      } as any,
      status,
    );
  };

  describe('1. Self & Collaborator Booking Prevention', () => {
    it('refuses owner booking themselves as mentor (409 CANNOT_BOOK_SELF)', async () => {
      // User '1' is a Project Owner who also has mentor listing unlocked
      ctx.usersRepository.update('1', {
        emailVerified: true,
        profile: { mentorUnlocked: true } as any,
      } as any);

      const ownerSelfProfile = mentorMarketplaceService.createProfile('1', {
        name: 'Priya Self Mentor',
        title: 'Fullstack Lead',
        bio: 'Mentoring teams',
        skills: ['TypeScript'],
        experienceYears: 5,
        sessionPrice: 1200,
      });

      const selfProj = makeProject('1', 'Priya Own Project');
      const ownerToken = ctx.loginAs('1');

      const res = await request(server)
        .post('/mentor-marketplace/sessions/book')
        .set('Authorization', ownerToken)
        .send({
          mentorId: ownerSelfProfile.id,
          projectId: selfProj.id,
          projectDescription: 'Attempting self booking',
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('CANNOT_BOOK_SELF');

      const audits = (ctx.auditService.findAll() as any[]).filter((a) => a.action === 'BOOKING_REFUSED');
      expect(audits.some((a) => a.details?.code === 'CANNOT_BOOK_SELF' && a.details?.projectId === selfProj.id)).toBe(true);
    });

    it('refuses booking a project collaborator as mentor (409 CANNOT_BOOK_OWN_PROJECT_MENTOR)', async () => {
      // Owner '1' owns project where Mentor '7' (Neha) is a collaborator
      const collabProj = makeProject('1', 'Collab Member Project', ProjectStatus.Open, {
        collaborators: [{ id: '7', userId: '7', name: 'Neha Gupta', role: 'Collaborator' }],
      });
      const ownerToken = ctx.loginAs('1');

      const res = await request(server)
        .post('/mentor-marketplace/sessions/book')
        .set('Authorization', ownerToken)
        .send({
          mentorId: 'mentor-profile-1',
          projectId: collabProj.id,
          projectDescription: 'Trying to book own collaborator as mentor',
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('CANNOT_BOOK_OWN_PROJECT_MENTOR');
    });
  });

  describe('2. Live Projects Only (409 PROJECT_NOT_BOOKABLE) & Suspended Mentor (409 MENTOR_SUSPENDED)', () => {
    it('rejects Closed, Completed, and soft-deleted projects with 409 PROJECT_NOT_BOOKABLE and reason', async () => {
      const ownerToken = ctx.loginAs('1');

      const closedProj = makeProject('1', 'Closed P25', ProjectStatus.Closed);
      const completedProj = makeProject('1', 'Completed P25', ProjectStatus.Completed, { isCompleted: true });
      const deletedProj = makeProject('1', 'Deleted P25', ProjectStatus.Open, { deletedAt: '2026-06-01T09:00:00.000Z' });

      const cases = [
        { proj: closedProj, reasonMatch: /closed/i },
        { proj: completedProj, reasonMatch: /completed/i },
        { proj: deletedProj, reasonMatch: /deleted/i },
      ];

      for (const c of cases) {
        const res = await request(server)
          .post('/mentor-marketplace/sessions/book')
          .set('Authorization', ownerToken)
          .send({
            mentorId: 'mentor-profile-1',
            projectId: c.proj.id,
            projectDescription: 'Booking on non-live project',
          });
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('PROJECT_NOT_BOOKABLE');
        expect(res.body.message).toMatch(c.reasonMatch);
      }
    });

    it('blocks booking a suspended mentor with 409 MENTOR_SUSPENDED', async () => {
      const proj = makeProject('1', 'Suspended Mentor Target Project');
      ctx.usersRepository.update('7', { status: UserStatus.Suspended });
      const ownerToken = ctx.loginAs('1');

      const res = await request(server)
        .post('/mentor-marketplace/sessions/book')
        .set('Authorization', ownerToken)
        .send({
          mentorId: 'mentor-profile-1',
          projectId: proj.id,
          projectDescription: 'Attempt booking suspended mentor',
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('MENTOR_SUSPENDED');
    });
  });

  describe('3. Re-checking on /pay and /accept + Payment Expiry Clock', () => {
    it('re-checks integrity on confirm-payment/pay and accept when project state changes after booking', async () => {
      const projA = makeProject('1', 'Re-check Pay Project');
      const projB = makeProject('1', 'Re-check Accept Project');

      const owner1Token = ctx.loginAs('1');
      const mentorToken = ctx.loginAs('7');

      // Owner 1 books projA (payment_pending)
      const bookA = await request(server)
        .post('/mentor-marketplace/sessions/book')
        .set('Authorization', owner1Token)
        .send({
          mentorId: 'mentor-profile-1',
          projectId: projA.id,
          projectDescription: 'Pay re-check booking',
        });
      expect(bookA.status).toBe(201);
      const sessAId = bookA.body.session.id;

      // Soft-delete projA before payment -> /pay must reject with 409 PROJECT_NOT_BOOKABLE!
      projectsRepo.update(projA.id, { deletedAt: ctx.clockService.nowIso() });
      const payDeletedRes = await request(server)
        .post(`/mentor-marketplace/sessions/${sessAId}/pay`)
        .set('Authorization', owner1Token)
        .set('Idempotency-Key', 'idem-deleted-pay')
        .send({});
      expect(payDeletedRes.status).toBe(409);
      expect(payDeletedRes.body.code).toBe('PROJECT_NOT_BOOKABLE');

      // Cancel sessA so capacity stays clear for projB test
      await request(server)
        .post(`/mentor-marketplace/sessions/${sessAId}/cancel-payment`)
        .set('Authorization', owner1Token)
        .expect(200);

      // Owner 1 books & funds projB (escrow_funded)
      const bookB = await request(server)
        .post('/mentor-marketplace/sessions/book')
        .set('Authorization', owner1Token)
        .send({
          mentorId: 'mentor-profile-1',
          projectId: projB.id,
          projectDescription: 'Accept re-check booking',
        });
      expect(bookB.status).toBe(201);
      const sessBId = bookB.body.session.id;

      await request(server)
        .post(`/mentor-marketplace/sessions/${sessBId}/confirm-payment`)
        .set('Authorization', owner1Token)
        .send({})
        .expect(200);

      // Soft-delete projB before accept completes -> /accept must reject with 409 PROJECT_NOT_BOOKABLE
      projectsRepo.update(projB.id, { deletedAt: ctx.clockService.nowIso() });

      const acceptConflictRes = await request(server)
        .post(`/mentor-marketplace/sessions/${sessBId}/accept`)
        .set('Authorization', mentorToken)
        .send({});
      expect(acceptConflictRes.status).toBe(409);
      expect(acceptConflictRes.body.code).toBe('PROJECT_NOT_BOOKABLE');
    });

    it('cancels stale payment_pending session after 30m via ClockService & releases project for rebooking', async () => {
      const proj = makeProject('1', 'Clock Expiry Release Project');
      const owner1Token = ctx.loginAs('1');

      const b1 = await request(server)
        .post('/mentor-marketplace/sessions/book')
        .set('Authorization', owner1Token)
        .send({
          mentorId: 'mentor-profile-1',
          projectId: proj.id,
          projectDescription: 'Unpaid hold',
        });
      expect(b1.status).toBe(201);

      // Attempting to book again for same project while hold is active fails
      const duplicateBook = await request(server)
        .post('/mentor-marketplace/sessions/book')
        .set('Authorization', owner1Token)
        .send({
          mentorId: 'mentor-profile-1',
          projectId: proj.id,
          projectDescription: 'Duplicate booking attempt',
        });
      expect(duplicateBook.status).toBe(409);

      // Advance clock 31 minutes -> hold expires automatically when checking/booking!
      ctx.advanceTime({ ms: 31 * 60 * 1000 });

      const b2 = await request(server)
        .post('/mentor-marketplace/sessions/book')
        .set('Authorization', owner1Token)
        .send({
          mentorId: 'mentor-profile-1',
          projectId: proj.id,
          projectDescription: 'Rebooking after expired hold',
        });
      expect(b2.status).toBe(201);
      expect(mentorMarketplaceService.findSession(b1.body.session.id).status).toBe('cancelled');
    });
  });
});
