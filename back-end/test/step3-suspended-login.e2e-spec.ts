import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { UsersRepository } from '../src/users/users.repository';
import { AdminService } from '../src/admin/admin.service';
import { PortalAdminsService } from '../src/portal-admins/portal-admins.service';
import { AuditService } from '../src/audit/audit.service';
import { FirebaseService } from '../src/firebase/firebase.service';

describe('STEP 3 E2E: Suspended User Login & Mid-Session Policy', () => {
  let app: INestApplication;
  let server: any;
  let usersRepo: UsersRepository;
  let adminService: AdminService;
  let portalAdminsService: PortalAdminsService;
  let auditService: AuditService;
  let firebaseService: FirebaseService;

  beforeAll(async () => {
    process.env.AUTH_MODE = 'jwt';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer();
    usersRepo = moduleFixture.get<UsersRepository>(UsersRepository);
    adminService = moduleFixture.get<AdminService>(AdminService);
    portalAdminsService = moduleFixture.get<PortalAdminsService>(PortalAdminsService);
    auditService = moduleFixture.get<AuditService>(AuditService);
    firebaseService = moduleFixture.get<FirebaseService>(FirebaseService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. correct password on manually suspended user returns 403 ACCOUNT_SUSPENDED with reason, date, type, and no token', async () => {
    // User 2: arjun.sharma@teamforge.io / password123
    adminService.suspendUser('2', { reason: 'Conduct violation during team interaction' }, 'admin');

    const res = await request(server)
      .post('/auth/login')
      .send({ identifier: 'arjun.sharma@teamforge.io', password: 'password123' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_SUSPENDED');
    expect(res.body.message).toBe('Your account is suspended.');
    expect(res.body.reason).toBe('Conduct violation during team interaction');
    expect(res.body.suspensionType).toBe('manual');
    expect(res.body.suspendedAt).toBeDefined();
    expect(res.body.appealAvailable).toBe(false);
    expect(res.body.supportContact).toBe('support@teamforge.io');

    // Never return token or secrets
    expect(res.body.accessToken).toBeUndefined();
    expect(res.body.token).toBeUndefined();
    expect(res.body.refreshToken).toBeUndefined();
    expect(res.body.moderator).toBeUndefined();
    expect(res.body.internalNotes).toBeUndefined();

    // Check audit entry LOGIN_BLOCKED_SUSPENDED
    const audits = (auditService.findAll() as any[]).filter(
      (a) => a.action === 'LOGIN_BLOCKED_SUSPENDED' && a.details?.userId === '2',
    );
    expect(audits.length).toBeGreaterThan(0);
  });

  it('2. on automatically suspended user, suspensionType is "automatic" and reason is the automatic text', async () => {
    // User 3: kiran.bose@teamforge.io
    usersRepo.update('3', {
      status: 'suspended',
      suspensionReason: 'Automatic suspension after 4 warnings',
      suspendedAt: new Date().toISOString(),
    } as any);

    const res = await request(server)
      .post('/auth/login')
      .send({ identifier: 'kiran.bose@teamforge.io', password: 'password123' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_SUSPENDED');
    expect(res.body.suspensionType).toBe('automatic');
    expect(res.body.reason).toBe('Automatic suspension after 4 warnings');
  });

  it('3. wrong password for suspended user returns same generic 401 response as unknown email (probes reveal nothing)', async () => {
    // Suspended user 2 with WRONG password
    const wrongPwdRes = await request(server)
      .post('/auth/login')
      .send({ identifier: 'arjun.sharma@teamforge.io', password: 'wrong-password-xyz' });

    // Unknown user
    const unknownEmailRes = await request(server)
      .post('/auth/login')
      .send({ identifier: 'nonexistent-user-404@teamforge.io', password: 'wrong-password-xyz' });

    // Both status codes match exactly (401)
    expect(wrongPwdRes.status).toBe(401);
    expect(unknownEmailRes.status).toBe(401);

    // Both error codes and messages match exactly
    expect(wrongPwdRes.body.code).toBe(unknownEmailRes.body.code);
    expect(wrongPwdRes.body.code).toBe('INVALID_CREDENTIALS');
    expect(wrongPwdRes.body.message).toBe(unknownEmailRes.body.message);
    expect(wrongPwdRes.body.message).toBe('Invalid credentials');
  });

  it('4. ten correct-password attempts on a suspended account do not lock the account', async () => {
    // 10 correct password logins for suspended user 2
    for (let i = 0; i < 10; i++) {
      const res = await request(server)
        .post('/auth/login')
        .send({ identifier: 'arjun.sharma@teamforge.io', password: 'password123' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ACCOUNT_SUSPENDED');
    }

    // Attempt 11th should still be 403 ACCOUNT_SUSPENDED, NOT 429 TOO_MANY_ATTEMPTS
    const res11 = await request(server)
      .post('/auth/login')
      .send({ identifier: 'arjun.sharma@teamforge.io', password: 'password123' });

    expect(res11.status).toBe(403);
    expect(res11.body.code).toBe('ACCOUNT_SUSPENDED');
  });

  it('5. admin login for a suspended portal admin returns 403 ACCOUNT_SUSPENDED with no token', async () => {
    const pAdmin = portalAdminsService.create({
      name: 'Suspended Mod Admin',
      email: 'mod_suspended@teamforge.io',
      portalRole: 'admin',
      permissions: ['dashboard'],
      password: 'AdminPassword123',
    });

    portalAdminsService.update(pAdmin.id, {
      status: 'suspended',
      suspensionReason: 'Policy violation',
      suspendedAt: new Date().toISOString(),
    } as any);

    const res = await request(server)
      .post('/admin/login')
      .send({ email: 'mod_suspended@teamforge.io', password: 'AdminPassword123' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_SUSPENDED');
    expect(res.body.token).toBeUndefined();
  });

  it('6. user suspended mid-session gets 403 ACCOUNT_SUSPENDED on next call, NOT SESSION_INVALID', async () => {
    // Reactivate user 2 first
    adminService.reactivateUser('2', { reason: 'Clean reactivation' }, 'admin');

    // Login user 2 while active
    const loginRes = await request(server)
      .post('/auth/login')
      .send({ identifier: 'arjun.sharma@teamforge.io', password: 'password123' });

    expect(loginRes.status).toBe(200);
    const accessToken = loginRes.body.accessToken;

    // Suspend user 2 while logged in
    adminService.suspendUser('2', { reason: 'Suspended mid-session by admin' }, 'admin');

    // Next authenticated call must receive 403 ACCOUNT_SUSPENDED, not 401 SESSION_INVALID
    const nextCallRes = await request(server)
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(nextCallRes.status).toBe(403);
    expect(nextCallRes.body.code).toBe('ACCOUNT_SUSPENDED');
    expect(nextCallRes.body.reason).toBe('Suspended mid-session by admin');
  });

  it('7. refresh endpoint returns 403 ACCOUNT_SUSPENDED for suspended user', async () => {
    // Reactivate user 2 first
    adminService.reactivateUser('2', { reason: 'Reactivated for refresh test' }, 'admin');

    const loginRes = await request(server)
      .post('/auth/login')
      .send({ identifier: 'arjun.sharma@teamforge.io', password: 'password123' });

    const refreshToken = loginRes.body.refreshToken;

    // Suspend user 2
    adminService.suspendUser('2', { reason: 'Suspended before refresh' }, 'admin');

    // Call refresh with refresh token
    const refreshRes = await request(server)
      .post('/auth/refresh')
      .send({ refreshToken });

    expect(refreshRes.status).toBe(403);
    expect(refreshRes.body.code).toBe('ACCOUNT_SUSPENDED');
    expect(refreshRes.body.reason).toBe('Suspended before refresh');
  });

  it('8. after reactivation, login works normally and returns token without suspended message', async () => {
    // User 2 is currently suspended. Reactivate them.
    adminService.reactivateUser('2', { reason: 'Reactivation approved' }, 'admin');

    const loginRes = await request(server)
      .post('/auth/login')
      .send({ identifier: 'arjun.sharma@teamforge.io', password: 'password123' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.accessToken).toBeDefined();
    expect(loginRes.body.code).toBeUndefined();
  });

  it('9. social login test double: verified token for suspended account returns 403 ACCOUNT_SUSPENDED', async () => {
    // User 2 suspended
    adminService.suspendUser('2', { reason: 'Suspended social user' }, 'admin');

    const prevAuthMode = process.env.AUTH_MODE;
    process.env.AUTH_MODE = 'firebase';

    try {
      if (firebaseService) {
        jest.spyOn(firebaseService, 'auth', 'get').mockReturnValue({
          verifyIdToken: (jest.fn() as any).mockResolvedValue({
            uid: '2',
            email: 'arjun.sharma@teamforge.io',
            name: 'Arjun Sharma',
          }),
        } as any);
      }

      const res = await request(server)
        .get('/users/me')
        .set('Authorization', 'Bearer fake-firebase-social-token-12345');

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ACCOUNT_SUSPENDED');
      expect(res.body.reason).toBe('Suspended social user');
    } finally {
      process.env.AUTH_MODE = prevAuthMode;
    }
  });
});
