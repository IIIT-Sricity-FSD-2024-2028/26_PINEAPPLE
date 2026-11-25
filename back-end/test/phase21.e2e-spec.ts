import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as fs from 'fs';
import * as path from 'path';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { Public } from '../src/auth/decorators/public.decorator';
import {
  buildRouteAuthMatrixDocument,
  findUnguardedRoutes,
  PUBLIC_ROUTE_ALLOWLIST,
  RouteAuthMatrixDocument,
  validatePublicAllowList,
} from '../src/common/utils/route-auth-matrix';
import { createTestApp, TestAppContext } from './helpers/test-helpers';

@Controller('phase21-fake-unguarded')
class FakeUnguardedController {
  @Get('open')
  openEndpoint() {
    return { leaked: true };
  }
}

@Module({
  controllers: [FakeUnguardedController],
})
class FakeUnguardedModule {}

@Controller('phase21-fake-public')
class FakePublicController {
  @Public()
  @Get('unlisted')
  unlistedPublic() {
    return { public: true };
  }
}

@Module({
  controllers: [FakePublicController],
})
class FakePublicModule {}

describe('Phase 21 E2E: Legacy Route Retirement & Route Authorization Matrix', () => {
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
    if (ctx?.app) {
      await ctx.app.close();
    }
  });

  describe('1. Retired Governance & Mentorship Routes Return 410 LEGACY_ENDPOINT_REMOVED', () => {
    it('returns 410 LEGACY_ENDPOINT_REMOVED naming canonical replacements for all retired /governance and /mentorship routes', async () => {
      const collabToken = ctx.loginAs('2');
      const adminToken = ctx.loginAs('admin');

      const checks: Array<{
        method: 'get' | 'post' | 'patch';
        url: string;
        token: string;
        body?: any;
        replacement: string;
      }> = [
        {
          method: 'post',
          url: '/governance/reports',
          token: collabToken,
          body: { targetUserId: '3', reason: 'Legacy bypass attempt' },
          replacement: 'POST /reports',
        },
        {
          method: 'get',
          url: '/governance/reports',
          token: adminToken,
          replacement: 'GET /admin/reports',
        },
        {
          method: 'get',
          url: '/governance/reports/report-1',
          token: adminToken,
          replacement: 'GET /admin/reports/:id',
        },
        {
          method: 'patch',
          url: '/governance/reports/report-1/resolve',
          token: adminToken,
          body: { action: 'Warn', resolution: 'Legacy resolution bypass' },
          replacement: 'PATCH /admin/reports/:id/status',
        },
        {
          method: 'post',
          url: '/mentorship/apply',
          token: collabToken,
          body: { linkedinURL: 'https://linkedin.com/in/test', experienceYears: 1, motivation: 'Bypass' },
          replacement: 'POST /mentor-applications',
        },
        {
          method: 'get',
          url: '/mentorship/application',
          token: collabToken,
          replacement: 'GET /mentor-applications/me',
        },
        {
          method: 'patch',
          url: '/mentorship/application/app-1/review',
          token: adminToken,
          body: { status: 'Approved' },
          replacement: 'PUT /mentor-applications/:id/approve',
        },
      ];

      for (const item of checks) {
        let req = request(server)[item.method](item.url)
          .set('Authorization', item.token)
          .set('x-user-id', '3')
          .set('x-userid', '3');
        if (item.body) req = req.send(item.body);
        const res = await req;

        expect(res.status).toBe(410);
        expect(res.body?.code).toBe('LEGACY_ENDPOINT_REMOVED');
        expect(String(res.body?.message || '')).toContain(item.replacement);
      }

      // Verify legacy routes also reject anonymous callers (not exposed as @Public())
      const anonRes = await request(server).get('/governance/reports');
      expect(anonRes.status).toBe(401);
    });

    it('keeps /mentorship/badge, /mentorship/badges/:userId, and /mentorship/badges/project/:projectId working via verified token', async () => {
      const proj = ctx.projectsService.create('1', {
        title: 'Phase 21 Badge Project',
        description:
          'Comprehensive integration project validating kept mentorship recommendation badge routes, role authorization, and verified token ownership without legacy identity spoofing.',
        teamSize: 4,
        dueDate: '2026-12-01T00:00:00.000Z',
      });
      ctx.projectsService.addCollaborator(proj.id, { id: '2', name: 'Arjun Sharma', role: 'Collaborator' });
      proj.mentorId = '4';

      const mentor4Token = ctx.loginAs('4');
      const collabToken = ctx.loginAs('2');

      const awardRes = await request(server)
        .post('/mentorship/badge')
        .set('Authorization', mentor4Token)
        .set('x-user-id', '7')
        .set('x-userid', '7')
        .send({
          recipientId: '2',
          projectId: proj.id,
          badgeName: 'Architecture Champion',
          comment: 'Clean architecture delivery.',
        });

      expect([200, 201]).toContain(awardRes.status);
      expect(awardRes.body?.mentorId).toBe('4');

      const byUser = await request(server)
        .get('/mentorship/badges/2')
        .set('Authorization', collabToken);
      expect(byUser.status).toBe(200);
      expect(byUser.body.some((b: any) => b.projectId === proj.id)).toBe(true);

      const byProject = await request(server)
        .get(`/mentorship/badges/project/${proj.id}`)
        .set('Authorization', collabToken);
      expect(byProject.status).toBe(200);
      expect(byProject.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('2. Canonical Rules Remain Enforced & Client Identity Headers Ignored', () => {
    it('enforces self-report block, daily limit, finality on canonical /reports, and tenure/CV checks on /mentor-applications', async () => {
      const collabToken = ctx.loginAs('2');
      const adminToken = ctx.loginAs('admin');

      // 1. Self-report blocked on canonical POST /reports
      const selfRep = await request(server)
        .post('/reports')
        .set('Authorization', collabToken)
        .send({
          reportedUserId: '2',
          reason: 'Harassment',
          details: 'Self report must still be rejected by canonical ReportsService.',
        });
      expect(selfRep.status).toBe(400);
      expect(selfRep.body?.code).toBe('CANNOT_REPORT_SELF');

      const candidateTargets = ctx.usersRepository
        .findAll()
        .filter((u) => {
          const r = String(u.role || '').toLowerCase();
          return u.id !== '2' && !['admin', 'administrator', 'superuser'].includes(r);
        })
        .map((u) => u.id);
      expect(candidateTargets.length).toBeGreaterThanOrEqual(6);

      // 2. Daily limit (5 max/day) enforced on canonical POST /reports
      for (let i = 0; i < 5; i++) {
        const created = await request(server)
          .post('/reports')
          .set('Authorization', collabToken)
          .send({
            reportedUserId: candidateTargets[i],
            reason: 'Spam',
            details: `Canonical report number ${i + 1} with full required detail text.`,
          });
        expect(created.status).toBe(201);
      }
      const limitHit = await request(server)
        .post('/reports')
        .set('Authorization', collabToken)
        .send({
          reportedUserId: candidateTargets[5],
          reason: 'Spam',
          details: 'Sixth report on the same day must be rejected with 429.',
        });
      expect(limitHit.status).toBe(429);

      // 3. Finality on canonical admin report resolution
      const listRes = await request(server)
        .get('/admin/reports')
        .set('Authorization', adminToken);
      expect(listRes.status).toBe(200);
      const reportId = listRes.body?.items?.[0]?.id;
      expect(reportId).toBeTruthy();
      const act1 = await request(server)
        .post(`/admin/reports/${reportId}/action`)
        .set('Authorization', adminToken)
        .send({ action: 'dismiss', reason: 'Verified dismissal under canonical finality rules.' });
      expect([200, 201]).toContain(act1.status);
      const act2 = await request(server)
        .post(`/admin/reports/${reportId}/action`)
        .set('Authorization', adminToken)
        .send({ action: 'warn', reason: 'Cannot re-decide resolved report.' });
      expect(act2.status).toBe(409);

      // 4. Canonical POST /mentor-applications enforces tenure bounds & verified CV/DigiLocker rules
      const freshSignup = await request(server)
        .post('/auth/signup')
        .send({
          name: 'Phase21 Mentor Candidate',
          email: 'p21candidate@teamforge.io',
          password: 'Password123!',
          role: 'Collaborator',
        });
      expect(freshSignup.status).toBe(201);
      await request(server)
        .post('/auth/profile')
        .set('Authorization', `Bearer ${freshSignup.body.accessToken}`)
        .send({ name: 'Phase21 Mentor Candidate', username: 'p21candidate' })
        .expect(200);
      const rawCandidate = ctx.usersRepository.findById(freshSignup.body.user.id);
      if (rawCandidate) rawCandidate.emailVerified = true;
      const candidateLogin = await request(server)
        .post('/auth/login')
        .send({ email: 'p21candidate@teamforge.io', password: 'Password123!' });
      const candidateToken = `Bearer ${candidateLogin.body.accessToken}`;

      const lowTenureRes = await request(server)
        .post('/mentor-applications')
        .set('Authorization', candidateToken)
        .send({
          userId: freshSignup.body.user.id,
          name: 'Phase21 Mentor Candidate',
          email: 'p21candidate@teamforge.io',
          yearsOfExperience: 2,
          experience: '2 years',
          bio: 'Mentoring application that violates minimum tenure rule.',
        });
      expect(lowTenureRes.status).toBe(400);

      const missingCvAndDigiRes = await request(server)
        .post('/mentor-applications')
        .set('Authorization', candidateToken)
        .send({
          userId: freshSignup.body.user.id,
          name: 'Phase21 Mentor Candidate',
          email: 'p21candidate@teamforge.io',
          yearsOfExperience: 8,
          experience: '8 years',
          bio: 'Mentoring application with valid tenure but no verified CV or DigiLocker.',
        });
      expect(missingCvAndDigiRes.status).toBe(400);
    });

    it('never trusts client x-user-id / x-userid headers or ?userId= spoofing across endpoints', async () => {
      const collabToken = ctx.loginAs('2');
      const mentorToken = ctx.loginAs('4');
      const otherMentorToken = ctx.loginAs('7');

      // Ensure user 3 has a seeded mentor application record so spoofing userId=3 would leak it if vulnerable
      const myStatusRes = await request(server)
        .get('/mentor-applications/me?userId=3')
        .set('Authorization', collabToken)
        .set('x-user-id', '3')
        .set('x-userid', '3');
      expect(myStatusRes.status).toBe(200);
      expect(myStatusRes.body?.application?.userId).not.toBe('3');

      // POST /support attributes ticket strictly to authenticated uid=2 even with spoofed headers
      const supportRes = await request(server)
        .post('/support')
        .set('Authorization', collabToken)
        .set('x-user-id', '8')
        .set('x-userid', '8')
        .send({
          category: 'Bug Report',
          subject: 'Phase 21 Support Auth Check',
          message: 'Verify ticket creator comes only from verified token.',
        });
      expect(supportRes.status).toBe(201);
      expect(supportRes.body?.userId).toBe('2');

      // GET /support with mismatched ?userId=8 cannot read user 8 tickets
      const supportGetRes = await request(server)
        .get('/support?userId=8')
        .set('Authorization', collabToken)
        .set('x-user-id', '8')
        .set('x-userid', '8');
      expect(supportGetRes.status).toBe(403);

      // PATCH /mentor-marketplace/mentors/availability ignores x-user-id for another mentor
      const mentor7Before = await request(server)
        .get('/mentor-marketplace/mentors/me')
        .set('Authorization', otherMentorToken);
      const beforeAvail = mentor7Before.body?.isAvailable;

      await request(server)
        .patch('/mentor-marketplace/mentors/availability')
        .set('Authorization', mentorToken)
        .set('x-user-id', '7')
        .set('x-userid', '7')
        .send({ isAvailable: !beforeAvail });

      const mentor7After = await request(server)
        .get('/mentor-marketplace/mentors/me')
        .set('Authorization', otherMentorToken);
      expect(mentor7After.body?.isAvailable).toBe(beforeAvail);

      // Lock POST /auth/test-set-expiry away from public / non-superuser callers
      const anonExpiry = await request(server)
        .post('/auth/test-set-expiry')
        .send({ expiryMs: 1000 });
      expect(anonExpiry.status).toBe(401);
      const userExpiry = await request(server)
        .post('/auth/test-set-expiry')
        .set('Authorization', collabToken)
        .send({ expiryMs: 1000 });
      expect(userExpiry.status).toBe(403);
    });
  });

  describe('3. Route Authorization Matrix Integrity & Anti-Drift Checks', () => {
    it('matches committed back-end/test/route-auth-matrix.json exactly and keeps all public routes on allow-list', () => {
      const committedPath = path.resolve(process.cwd(), 'test/route-auth-matrix.json');
      const committed: RouteAuthMatrixDocument = JSON.parse(
        fs.readFileSync(committedPath, 'utf8'),
      );
      const liveMatrix = buildRouteAuthMatrixDocument(app);

      expect(liveMatrix.routes).toEqual(committed.routes);
      expect(liveMatrix.publicAllowList).toEqual(PUBLIC_ROUTE_ALLOWLIST);

      const publicCheck = validatePublicAllowList(liveMatrix.routes, committed.publicAllowList);
      expect(publicCheck.valid).toBe(true);
      expect(publicCheck.unexpectedPublic).toEqual([]);
    });

    it('fails matrix/unguarded/public checks when an unguarded or unlisted @Public() fake route module is registered', async () => {
      const committedPath = path.resolve(process.cwd(), 'test/route-auth-matrix.json');
      const committed: RouteAuthMatrixDocument = JSON.parse(
        fs.readFileSync(committedPath, 'utf8'),
      );
      const reviewedNoRoleKeys = committed.routes
        .filter((r) => r.access !== 'public' && !r.hasExplicitGuardOrRole)
        .map((r) => `${r.method} ${r.path}`);

      const modUnguarded = await Test.createTestingModule({
        imports: [AppModule, FakeUnguardedModule],
      }).compile();
      const unguardedApp = modUnguarded.createNestApplication();
      await unguardedApp.init();

      try {
        const mutatedMatrix = buildRouteAuthMatrixDocument(unguardedApp);
        expect(mutatedMatrix.routes).not.toEqual(committed.routes);
        const unexpectedUnguarded = findUnguardedRoutes(mutatedMatrix.routes, reviewedNoRoleKeys);
        expect(unexpectedUnguarded.map((r) => `${r.method} ${r.path}`)).toContain(
          'GET /phase21-fake-unguarded/open',
        );
      } finally {
        await unguardedApp.close();
      }

      const modPublic = await Test.createTestingModule({
        imports: [AppModule, FakePublicModule],
      }).compile();
      const publicApp = modPublic.createNestApplication();
      await publicApp.init();

      try {
        const mutatedPublicMatrix = buildRouteAuthMatrixDocument(publicApp);
        const pubValidation = validatePublicAllowList(
          mutatedPublicMatrix.routes,
          committed.publicAllowList,
        );
        expect(pubValidation.valid).toBe(false);
        expect(pubValidation.unexpectedPublic).toContain('GET /phase21-fake-public/unlisted');
      } finally {
        await publicApp.close();
      }
    });
  });
});
