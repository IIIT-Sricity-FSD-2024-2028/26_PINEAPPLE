import request from 'supertest';
import { createTestApp, TestAppContext } from './helpers/test-helpers';

const FORBIDDEN_SECRET_KEYS = new Set([
  'password',
  'passwordHash',
  'salt',
  'refreshTokens',
  'resetToken',
  'resetCode',
  'tokenVersion',
  'allowedLegacyJti',
  'otpChallenges',
  'verificationToken',
]);

function assertNoUserSecrets(payload: any, pathLabel = 'root'): void {
  if (!payload || typeof payload !== 'object') return;
  if (Array.isArray(payload)) {
    payload.forEach((item, idx) => assertNoUserSecrets(item, `${pathLabel}[${idx}]`));
    return;
  }
  for (const [key, val] of Object.entries(payload)) {
    if (FORBIDDEN_SECRET_KEYS.has(key)) {
      throw new Error(`Secret key "${key}" leaked at ${pathLabel}.${key}`);
    }
    if (val && typeof val === 'object') {
      assertNoUserSecrets(val, `${pathLabel}.${key}`);
    }
  }
}

describe('Phase 19 E2E: Users Controller Lockdown, Throttling & Privacy', () => {
  let ctx: TestAppContext;
  let server: any;

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.app.getHttpServer();
  });

  beforeEach(() => {
    ctx.resetStores();
  });

  afterAll(async () => {
    if (ctx?.app) {
      await ctx.app.close();
    }
  });

  describe('1. POST /users & /auth/signup Role Lockdown', () => {
    it('rejects anonymous POST /users (401) and never creates Super User', async () => {
      const countBefore = ctx.usersRepository.findAll().length;

      await request(server)
        .post('/users')
        .send({
          name: 'Rogue Superuser',
          email: 'rogue.su@teamforge.io',
          username: 'roguesu',
          password: 'Password123!',
          role: 'Super User',
        })
        .expect(401);

      expect(ctx.usersRepository.findByEmail('rogue.su@teamforge.io')).toBeUndefined();
      expect(ctx.usersRepository.findAll().length).toBe(countBefore);
    });

    it('rejects collaborator and regular admin POST /users with 403', async () => {
      await request(server)
        .post('/users')
        .set('Authorization', ctx.loginAs('2'))
        .send({
          name: 'Blocked User',
          email: 'blocked1@teamforge.io',
          role: 'Collaborator',
        })
        .expect(403);

      await request(server)
        .post('/users')
        .set('Authorization', ctx.loginAs('admin'))
        .send({
          name: 'Blocked Admin Attempt',
          email: 'blocked2@teamforge.io',
          role: 'Administrator',
        })
        .expect(403);
    });

    it('rejects elevated roles on POST /auth/signup', async () => {
      const suSignupRes = await request(server)
        .post('/auth/signup')
        .send({
          name: 'Hacker',
          username: 'hackersu1',
          email: 'hackersu1@teamforge.io',
          password: 'Password123!',
          role: 'Super User',
        });
      expect([400, 403]).toContain(suSignupRes.status);
      expect(ctx.usersRepository.findByEmail('hackersu1@teamforge.io')).toBeUndefined();

      const adminSignupRes = await request(server)
        .post('/auth/signup')
        .send({
          name: 'Hacker Admin',
          username: 'hackeradmin1',
          email: 'hackeradmin1@teamforge.io',
          password: 'Password123!',
          role: 'Administrator',
        });
      expect([400, 403]).toContain(adminSignupRes.status);
      expect(ctx.usersRepository.findByEmail('hackeradmin1@teamforge.io')).toBeUndefined();
    });

    it('allows Super User POST /users to create admin, returns no password, dispatches reset link, and logs audit', async () => {
      const res = await request(server)
        .post('/users')
        .set('Authorization', ctx.loginAs('superuser'))
        .send({
          name: 'Ops Admin',
          email: 'ops.admin@teamforge.io',
          username: 'ops_admin_19',
          role: 'Administrator',
          university: 'IIT Bombay',
        })
        .expect(201);

      expect(res.body.email).toBe('ops.admin@teamforge.io');
      expect(res.body.role).toBe('Administrator');
      expect(res.body.password).toBeUndefined();
      expect(res.body.passwordHash).toBeUndefined();
      expect(res.body.resetToken).toBeUndefined();
      assertNoUserSecrets(res.body);

      const resetMails = ctx.mailServiceMock
        .getSentMails()
        .filter((m) => m.type === 'password-reset' && m.to === 'ops.admin@teamforge.io');
      expect(resetMails.length).toBe(1);
      expect(resetMails[0].token).toBeTruthy();

      const auditEntry = ctx.auditService
        .findAll()
        .find((a) => a.action === 'USER_CREATED_BY_SUPERUSER' && a.entityId === String(res.body.id));
      expect(auditEntry).toBeTruthy();

      // New admin completes password setup via one-time reset token and logs in
      await request(server)
        .post('/auth/reset-password')
        .send({ token: resetMails[0].token, newPassword: 'OpsStrongPassword99!' })
        .expect(200);

      const adminLoginRes = await request(server)
        .post('/admin/login')
        .send({ email: 'ops.admin@teamforge.io', password: 'OpsStrongPassword99!' })
        .expect(200);
      expect(adminLoginRes.body.token).toBeTruthy();
      expect(adminLoginRes.body.role).toBe('admin');
    });
  });

  describe('2. Login Password Enforcement & Shared Throttling (/auth/login & /admin/login)', () => {
    it('removes POST /users/login endpoint', async () => {
      const res = await request(server)
        .post('/users/login')
        .send({ email: 'arjun.sharma@teamforge.io', password: 'password123' });
      expect([404, 405, 410]).toContain(res.status);
    });

    it('rejects missing, empty, or non-string password with 400 PASSWORD_REQUIRED on /auth/login and /admin/login', async () => {
      const badPayloads = [
        { email: 'arjun.sharma@teamforge.io' },
        { email: 'arjun.sharma@teamforge.io', password: '' },
        { email: 'arjun.sharma@teamforge.io', password: '   ' },
        { email: 'arjun.sharma@teamforge.io', password: 123456 },
        { email: 'arjun.sharma@teamforge.io', password: null },
      ];

      for (const body of badPayloads) {
        const userRes = await request(server).post('/auth/login').send(body).expect(400);
        expect(userRes.body.code).toBe('PASSWORD_REQUIRED');

        const adminRes = await request(server)
          .post('/admin/login')
          .send({ ...body, email: 'admin@teamforge.io' })
          .expect(400);
        expect(adminRes.body.code).toBe('PASSWORD_REQUIRED');
      }
    });

    it('returns identical error responses for wrong password vs unknown user', async () => {
      const wrongPassUser = await request(server)
        .post('/auth/login')
        .send({ identifier: 'arjun.sharma@teamforge.io', password: 'WrongPassword1!' })
        .expect(401);

      const unknownUser = await request(server)
        .post('/auth/login')
        .send({ identifier: 'does.not.exist@teamforge.io', password: 'WrongPassword1!' })
        .expect(401);

      expect(wrongPassUser.body.code).toBe('INVALID_CREDENTIALS');
      expect(unknownUser.body.code).toBe('INVALID_CREDENTIALS');
      expect(wrongPassUser.body.message).toBe(unknownUser.body.message);

      const wrongPassAdmin = await request(server)
        .post('/admin/login')
        .send({ email: 'admin@teamforge.io', password: 'WrongAdminPassword!' })
        .expect(401);

      const unknownAdmin = await request(server)
        .post('/admin/login')
        .send({ email: 'missing.admin@teamforge.io', password: 'WrongAdminPassword!' })
        .expect(401);

      expect(wrongPassAdmin.body.code).toBe('INVALID_CREDENTIALS');
      expect(unknownAdmin.body.code).toBe('INVALID_CREDENTIALS');
      expect(wrongPassAdmin.body.message).toBe(unknownAdmin.body.message);
    });

    it('locks after 10 wrong attempts on /auth/login (429 TOO_MANY_ATTEMPTS) and resets after window expiry', async () => {
      for (let i = 0; i < 10; i++) {
        await request(server)
          .post('/auth/login')
          .set('x-forwarded-for', '203.0.113.45')
          .send({ identifier: 'arjun.sharma@teamforge.io', password: 'wrong!' })
          .expect(401);
      }

      const lockedRes = await request(server)
        .post('/auth/login')
        .set('x-forwarded-for', '203.0.113.45')
        .send({ identifier: 'arjun.sharma@teamforge.io', password: 'password123' })
        .expect(429);

      expect(lockedRes.body.code).toBe('TOO_MANY_ATTEMPTS');
      expect(lockedRes.body.retryAt).toBeTruthy();

      const throttleAudit = ctx.auditService
        .findAll()
        .find((a) => a.action === 'LOGIN_THROTTLED');
      expect(throttleAudit).toBeTruthy();

      ctx.advanceTime({ ms: 15 * 60 * 1000 + 2000 });
      const unlockedRes = await request(server)
        .post('/auth/login')
        .set('x-forwarded-for', '203.0.113.45')
        .send({ identifier: 'arjun.sharma@teamforge.io', password: 'password123' })
        .expect(200);
      assertNoUserSecrets(unlockedRes.body.user);
    });

    it('shares throttle limit on /admin/login after 10 wrong attempts', async () => {
      for (let i = 0; i < 10; i++) {
        await request(server)
          .post('/admin/login')
          .set('x-forwarded-for', '203.0.113.88')
          .send({ email: 'admin@teamforge.io', password: 'wrong-admin-password' })
          .expect(401);
      }

      const lockedRes = await request(server)
        .post('/admin/login')
        .set('x-forwarded-for', '203.0.113.88')
        .send({ email: 'admin@teamforge.io', password: 'admin123' })
        .expect(429);

      expect(lockedRes.body.code).toBe('TOO_MANY_ATTEMPTS');
      expect(lockedRes.body.retryAt).toBeTruthy();
    });
  });

  describe('3. PATCH /users/:id Self-Update Allow-List & Email Verification Reset', () => {
    it('rejects role/xp/status mass-assignment with 400 FIELD_NOT_ALLOWED + audit', async () => {
      const res = await request(server)
        .patch('/users/2')
        .set('Authorization', ctx.loginAs('2'))
        .send({ role: 'Super User', xp: 9999 })
        .expect(400);

      expect(res.body.code).toBe('FIELD_NOT_ALLOWED');
      expect(res.body.rejectedFields).toEqual(expect.arrayContaining(['role', 'xp']));

      const auditEntry = ctx.auditService
        .findAll()
        .find((a) => a.action === 'USER_UPDATE_REJECTED_FIELD' && String(a.entityId) === '2');
      expect(auditEntry).toBeTruthy();
      expect(auditEntry?.details?.rejectedFields).toEqual(expect.arrayContaining(['role', 'xp']));

      const unchanged = ctx.usersRepository.findById('2')!;
      expect(unchanged.role).toBe('Collaborator');
    });

    it('rejects another user with 403 NOT_YOUR_ACCOUNT', async () => {
      const res = await request(server)
        .patch('/users/2')
        .set('Authorization', ctx.loginAs('6'))
        .send({ bio: 'Attempting to hijack another profile bio.' })
        .expect(403);

      expect(res.body.code).toBe('NOT_YOUR_ACCOUNT');
    });

    it('updates allow-listed profile fields safely without leaking secrets', async () => {
      const res = await request(server)
        .patch('/users/2')
        .set('Authorization', ctx.loginAs('2'))
        .send({
          name: 'Arjun S.',
          bio: 'Distributed systems enthusiast building TeamForge.',
          avatar: '/uploads/arjun.png',
          skills: ['TypeScript', 'NestJS', 'React'],
          links: { github: 'https://github.com/arjunsharma' },
          settings: { emailNotifications: true },
        })
        .expect(200);

      expect(res.body.name).toBe('Arjun S.');
      expect(res.body.profile?.bio).toContain('Distributed systems');
      expect(res.body.skills).toEqual(['TypeScript', 'NestJS', 'React']);
      assertNoUserSecrets(res.body);
    });

    it('resets emailVerified, sends verification mail, and revokes other active sessions on email change', async () => {
      const login1 = await request(server)
        .post('/auth/login')
        .send({ identifier: 'arjun.sharma@teamforge.io', password: 'password123' })
        .expect(200);
      const login2 = await request(server)
        .post('/auth/login')
        .send({ identifier: 'arjun.sharma@teamforge.io', password: 'password123' })
        .expect(200);

      const session1Token = `Bearer ${login1.body.accessToken}`;
      const session2Token = `Bearer ${login2.body.accessToken}`;

      // Session 1 changes email
      const patchRes = await request(server)
        .patch('/users/2')
        .set('Authorization', session1Token)
        .send({ email: 'arjun.updated@teamforge.io' })
        .expect(200);

      expect(patchRes.body.email).toBe('arjun.updated@teamforge.io');
      expect(patchRes.body.emailVerified).toBe(false);
      assertNoUserSecrets(patchRes.body);

      // Caller session 1 stays valid and sees emailVerified: false
      const meRes1 = await request(server)
        .get('/users/me')
        .set('Authorization', session1Token)
        .expect(200);
      expect(meRes1.body.emailVerified).toBe(false);
      assertNoUserSecrets(meRes1.body);

      // Session 2 was revoked immediately
      await request(server)
        .get('/users/me')
        .set('Authorization', session2Token)
        .expect(401);

      const verMails = ctx.mailServiceMock
        .getSentMails()
        .filter((m) => m.type === 'email-verification' && m.to === 'arjun.updated@teamforge.io');
      expect(verMails.length).toBe(1);
    });
  });

  describe('4. DELETE /users/:id Super User Lockdown', () => {
    it('rejects collaborator and regular admin with 403', async () => {
      await request(server)
        .delete('/users/6')
        .set('Authorization', ctx.loginAs('2'))
        .send({ reason: 'Unauthorized attempt' })
        .expect(403);

      await request(server)
        .delete('/users/6')
        .set('Authorization', ctx.loginAs('admin'))
        .send({ reason: 'Admin cannot delete directly' })
        .expect(403);
    });

    it('rejects Super User deletion without reason (400), on Super User (403), or with open obligations (409)', async () => {
      await request(server)
        .delete('/users/6')
        .set('Authorization', ctx.loginAs('superuser'))
        .send({})
        .expect(400);

      const suTargetRes = await request(server)
        .delete('/users/u-superuser')
        .set('Authorization', ctx.loginAs('superuser'))
        .send({ reason: 'Cannot remove super user' })
        .expect(403);
      expect(suTargetRes.body.code).toBe('CANNOT_DELETE_SUPERUSER');

      // User '1' has open owned project obligations
      const conflictRes = await request(server)
        .delete('/users/1')
        .set('Authorization', ctx.loginAs('superuser'))
        .send({ reason: 'Account closure request' })
        .expect(409);
      expect(conflictRes.body.code).toBe('ACCOUNT_HAS_OPEN_OBLIGATIONS');
    });

    it('allows Super User to delete collaborator without open obligations and logs USER_DELETED_BY_SUPERUSER', async () => {
      const signupRes = await request(server)
        .post('/auth/signup')
        .send({
          name: 'Deletable Collab',
          username: 'deletable_collab_19',
          email: 'deletable.collab19@teamforge.io',
          password: 'Password123!',
          role: 'Collaborator',
        })
        .expect(201);
      const targetId = String(signupRes.body.user.id);

      const res = await request(server)
        .delete(`/users/${targetId}`)
        .set('Authorization', ctx.loginAs('superuser'))
        .send({ reason: 'Confirmed abuse violation' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.anonymizedId).toBeTruthy();

      const deletedRaw = ctx.usersRepository.findById(targetId)!;
      expect(deletedRaw.isDeleted).toBe(true);
      expect(deletedRaw.name).toBe('Deleted user');

      const auditEntry = ctx.auditService
        .findAll()
        .find((a) => a.action === 'USER_DELETED_BY_SUPERUSER');
      expect(auditEntry).toBeTruthy();
      expect(auditEntry?.details?.reason).toBe('Confirmed abuse violation');
    });
  });

  describe('5. GET /users & GET /users/:id Privacy & Secret Stripping', () => {
    it('restricts GET /users to Super User and Admins with "users" permission', async () => {
      await request(server).get('/users').expect(401);

      await request(server)
        .get('/users')
        .set('Authorization', ctx.loginAs('2'))
        .expect(403);

      // Admin with only 'reports' permission is rejected
      await request(server)
        .get('/users')
        .set('Authorization', ctx.loginAs('admin-reports'))
        .expect(403);

      // Admin with ['users', 'projects'] permission succeeds and leaks no secrets
      const listRes = await request(server)
        .get('/users')
        .set('Authorization', ctx.loginAs('admin-no-reports'))
        .expect(200);
      expect(Array.isArray(listRes.body)).toBe(true);
      assertNoUserSecrets(listRes.body);
    });

    it('restricts GET /users/:id to account owner, Super User, or Admin with "users" permission', async () => {
      await request(server).get('/users/2').expect(401);

      // Another collaborator gets 403
      await request(server)
        .get('/users/2')
        .set('Authorization', ctx.loginAs('6'))
        .expect(403);

      // Admin without 'users' permission gets 403
      await request(server)
        .get('/users/2')
        .set('Authorization', ctx.loginAs('admin-reports'))
        .expect(403);

      // Owner gets 200 with full safe record and zero secrets
      const selfRes = await request(server)
        .get('/users/2')
        .set('Authorization', ctx.loginAs('2'))
        .expect(200);
      expect(selfRes.body.email).toBe('arjun.sharma@teamforge.io');
      assertNoUserSecrets(selfRes.body);

      // Admin with 'users' permission gets 200 with zero secrets
      const adminRes = await request(server)
        .get('/users/2')
        .set('Authorization', ctx.loginAs('admin-no-reports'))
        .expect(200);
      expect(adminRes.body.id).toBe('2');
      assertNoUserSecrets(adminRes.body);
    });
  });
});
