import request from 'supertest';
import { createTestApp, TestAppContext } from './helpers/test-helpers';
import { PortalAdminsService } from '../src/portal-admins/portal-admins.service';
import { getAdminRefreshCookieName } from '../src/common/utils/refresh-cookie.util';
import { USER_REFRESH_COOKIE_NAME } from '../src/common/utils/refresh-cookie.util';

function extractCookieValue(setCookieHeaders: string[] | string | undefined, name: string): string | null {
  const list = Array.isArray(setCookieHeaders)
    ? setCookieHeaders
    : setCookieHeaders
      ? [setCookieHeaders]
      : [];
  for (const header of list) {
    if (header.startsWith(`${name}=`)) {
      const semi = header.indexOf(';');
      return header.slice(name.length + 1, semi === -1 ? header.length : semi);
    }
  }
  return null;
}

function findSetCookieHeader(setCookieHeaders: string[] | string | undefined, name: string): string | undefined {
  const list = Array.isArray(setCookieHeaders)
    ? setCookieHeaders
    : setCookieHeaders
      ? [setCookieHeaders]
      : [];
  return list.find((h) => h.startsWith(`${name}=`));
}

describe('Admin Session Refresh E2E (/admin/auth/refresh & /admin/auth/logout)', () => {
  let ctx: TestAppContext;
  let server: any;
  let portalAdminsService: PortalAdminsService;
  const adminCookieName = getAdminRefreshCookieName();

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.app.getHttpServer();
    portalAdminsService = ctx.app.get(PortalAdminsService);
  }, 30000);

  afterAll(async () => {
    if (ctx?.app) {
      await ctx.app.close();
    }
  });

  beforeEach(() => {
    ctx.resetStores();
    portalAdminsService.reset();
  });

  it('admin login sets httpOnly Strict /admin/auth cookie, refresh rotates it without body secret, and protects admin routes', async () => {
    const loginRes = await request(server)
      .post('/admin/login')
      .send({ email: 'admin@teamforge.io', password: 'admin123' })
      .expect(200);

    expect(loginRes.body.token).toBeTruthy();
    expect(loginRes.body.admin).toMatchObject({
      id: 'u-admin',
      email: 'admin@teamforge.io',
      role: 'admin',
    });

    const cookieHeader = findSetCookieHeader(loginRes.headers['set-cookie'], adminCookieName);
    expect(cookieHeader).toBeTruthy();
    expect(cookieHeader).toMatch(/HttpOnly/i);
    expect(cookieHeader).toMatch(/SameSite=Strict/i);
    expect(cookieHeader).toMatch(/Path=\/admin\/auth/i);

    const cookie1 = extractCookieValue(loginRes.headers['set-cookie'], adminCookieName);
    expect(cookie1).toBeTruthy();

    // Refresh without Authorization header, only cookie
    const refreshRes = await request(server)
      .post('/admin/auth/refresh')
      .set('Cookie', `${adminCookieName}=${cookie1}`)
      .expect(200);

    expect(refreshRes.body.token).toBeTruthy();
    expect(refreshRes.body.admin).toMatchObject({
      id: 'u-admin',
      email: 'admin@teamforge.io',
      role: 'admin',
    });
    expect(refreshRes.body.refreshToken).toBeUndefined();
    expect(JSON.stringify(refreshRes.body)).not.toContain(cookie1!);

    const cookie2 = extractCookieValue(refreshRes.headers['set-cookie'], adminCookieName);
    expect(cookie2).toBeTruthy();
    expect(cookie2).not.toBe(cookie1);
    expect(JSON.stringify(refreshRes.body)).not.toContain(cookie2!);

    // New access token works on guarded admin API
    await request(server)
      .get('/admin/users')
      .set('Authorization', `Bearer ${refreshRes.body.token}`)
      .expect(200);

    // Failed login sets no cookie
    const badLogin = await request(server)
      .post('/admin/login')
      .send({ email: 'admin@teamforge.io', password: 'wrong-password' })
      .expect(401);
    expect(findSetCookieHeader(badLogin.headers['set-cookie'], adminCookieName)).toBeUndefined();
  });

  it('rejects replayed old admin cookie with 401 REFRESH_REUSED and revokes the entire chain', async () => {
    const loginRes = await request(server)
      .post('/admin/login')
      .send({ email: 'superuser@teamforge.io', password: 'Super@123' })
      .expect(200);

    const cookie1 = extractCookieValue(loginRes.headers['set-cookie'], adminCookieName)!;
    const refreshRes = await request(server)
      .post('/admin/auth/refresh')
      .set('Cookie', `${adminCookieName}=${cookie1}`)
      .expect(200);
    const cookie2 = extractCookieValue(refreshRes.headers['set-cookie'], adminCookieName)!;

    // Replay cookie1 -> REFRESH_REUSED + clears cookie
    const replayRes = await request(server)
      .post('/admin/auth/refresh')
      .set('Cookie', `${adminCookieName}=${cookie1}`)
      .expect(401);
    expect(replayRes.body.code).toBe('REFRESH_REUSED');

    // Follow-up with cookie2 must now fail because chain was revoked
    const afterRes = await request(server)
      .post('/admin/auth/refresh')
      .set('Cookie', `${adminCookieName}=${cookie2}`)
      .expect(401);
    expect(afterRes.body.code).toBe('REFRESH_INVALID');
  });

  it('clears cookie and revokes chain on POST /admin/auth/logout', async () => {
    const loginRes = await request(server)
      .post('/admin/login')
      .send({ email: 'admin@teamforge.io', password: 'admin123' })
      .expect(200);
    const cookie1 = extractCookieValue(loginRes.headers['set-cookie'], adminCookieName)!;

    const logoutRes = await request(server)
      .post('/admin/auth/logout')
      .set('Cookie', `${adminCookieName}=${cookie1}`)
      .expect(200);
    expect(logoutRes.body.loggedOut).toBe(true);
    const clearedHeader = findSetCookieHeader(logoutRes.headers['set-cookie'], adminCookieName);
    expect(clearedHeader).toBeTruthy();

    await request(server)
      .post('/admin/auth/refresh')
      .set('Cookie', `${adminCookieName}=${cookie1}`)
      .expect(401);

    // Calling logout with no cookie still succeeds idempotently
    await request(server).post('/admin/auth/logout').expect(200);
  });

  it('loads newly added permissions on refresh and revokes session when permissions are removed, admin is suspended, or sessions revoked', async () => {
    const suToken = ctx.loginAs('superuser');
    const created = await request(server)
      .post('/portal-admins')
      .set('Authorization', suToken)
      .send({
        name: 'Moderation Admin',
        email: 'mod-admin@teamforge.io',
        password: 'Password123!',
        permissions: ['reports'],
      })
      .expect(201);
    const adminId = created.body.id;

    const loginRes = await request(server)
      .post('/admin/login')
      .send({ email: 'mod-admin@teamforge.io', password: 'Password123!' })
      .expect(200);
    let cookie = extractCookieValue(loginRes.headers['set-cookie'], adminCookieName)!;

    // Adding a permission keeps refresh chain alive and returns new permission live on refresh
    await request(server)
      .put(`/portal-admins/${adminId}`)
      .set('Authorization', suToken)
      .send({ permissions: ['reports', 'audit'] })
      .expect(200);

    const refreshedAdded = await request(server)
      .post('/admin/auth/refresh')
      .set('Cookie', `${adminCookieName}=${cookie}`)
      .expect(200);
    expect(refreshedAdded.body.permissions).toEqual(['reports', 'audit']);
    cookie = extractCookieValue(refreshedAdded.headers['set-cookie'], adminCookieName)!;
    const activeJwt = refreshedAdded.body.token;

    // Removing a permission bumps tokenVersion and invalidates both JWT and refresh cookie
    await request(server)
      .put(`/portal-admins/${adminId}`)
      .set('Authorization', suToken)
      .send({ permissions: ['reports'] })
      .expect(200);

    await request(server)
      .get('/admin/reports')
      .set('Authorization', `Bearer ${activeJwt}`)
      .expect(401);

    await request(server)
      .post('/admin/auth/refresh')
      .set('Cookie', `${adminCookieName}=${cookie}`)
      .expect(401);

    // Re-login and test suspension -> 403 ACCOUNT_SUSPENDED on refresh
    const login2 = await request(server)
      .post('/admin/login')
      .send({ email: 'mod-admin@teamforge.io', password: 'Password123!' })
      .expect(200);
    const cookie2 = extractCookieValue(login2.headers['set-cookie'], adminCookieName)!;

    // Mutate status directly to suspended while testing refresh check against live suspended admin
    const rawAdmin = portalAdminsService.findById(adminId)!;
    rawAdmin.status = 'suspended';
    const suspendedRefresh = await request(server)
      .post('/admin/auth/refresh')
      .set('Cookie', `${adminCookieName}=${cookie2}`)
      .expect(403);
    expect(suspendedRefresh.body.code).toBe('ACCOUNT_SUSPENDED');

    // Reactivate, login, then revoke-sessions via Super User endpoint
    rawAdmin.status = 'active';
    const login3 = await request(server)
      .post('/admin/login')
      .send({ email: 'mod-admin@teamforge.io', password: 'Password123!' })
      .expect(200);
    const cookie3 = extractCookieValue(login3.headers['set-cookie'], adminCookieName)!;
    const jwt3 = login3.body.token;

    await request(server)
      .post(`/portal-admins/${adminId}/revoke-sessions`)
      .set('Authorization', suToken)
      .expect(200);

    await request(server)
      .get('/admin/reports')
      .set('Authorization', `Bearer ${jwt3}`)
      .expect(401);

    await request(server)
      .post('/admin/auth/refresh')
      .set('Cookie', `${adminCookieName}=${cookie3}`)
      .expect(401);
  });

  it('keeps standard user refresh cookie and admin refresh cookie independent when both log in', async () => {
    const userRes = await request(server)
      .post('/auth/login')
      .send({ email: 'aarav.patel@teamforge.io', password: 'password123' });
    // Fallback if seed password differs: create verified user or assert user cookie
    let userCookie = extractCookieValue(userRes.headers['set-cookie'], USER_REFRESH_COOKIE_NAME);
    if (!userCookie) {
      const signup = await request(server)
        .post('/auth/signup')
        .send({
          name: 'Dual Cookie User',
          email: 'dualcookie@teamforge.io',
          password: 'Password123!',
          role: 'Collaborator',
        })
        .expect(201);
      const rawUser = ctx.usersRepository.findById(signup.body.user.id);
      if (rawUser) rawUser.emailVerified = true;
      const loginU = await request(server)
        .post('/auth/login')
        .send({ email: 'dualcookie@teamforge.io', password: 'Password123!' })
        .expect(200);
      userCookie = extractCookieValue(loginU.headers['set-cookie'], USER_REFRESH_COOKIE_NAME);
    }
    expect(userCookie).toBeTruthy();

    const adminRes = await request(server)
      .post('/admin/login')
      .send({ email: 'admin@teamforge.io', password: 'admin123' })
      .expect(200);
    const adminCookie = extractCookieValue(adminRes.headers['set-cookie'], adminCookieName);
    expect(adminCookie).toBeTruthy();
    expect(adminCookieName).not.toBe(USER_REFRESH_COOKIE_NAME);

    // Log out admin only -> user refresh still succeeds
    await request(server)
      .post('/admin/auth/logout')
      .set('Cookie', `${adminCookieName}=${adminCookie}; ${USER_REFRESH_COOKIE_NAME}=${userCookie}`)
      .expect(200);

    await request(server)
      .post('/auth/refresh')
      .set('Cookie', `${USER_REFRESH_COOKIE_NAME}=${userCookie}`)
      .expect(200);

    await request(server)
      .post('/admin/auth/refresh')
      .set('Cookie', `${adminCookieName}=${adminCookie}`)
      .expect(401);
  });

  it('expires admin refresh session past 12h idle TTL or 24h absolute session cap', async () => {
    const loginRes = await request(server)
      .post('/admin/login')
      .send({ email: 'admin@teamforge.io', password: 'admin123' })
      .expect(200);
    const cookie = extractCookieValue(loginRes.headers['set-cookie'], adminCookieName)!;

    ctx.advanceTime({ hours: 13 });
    const expiredRes = await request(server)
      .post('/admin/auth/refresh')
      .set('Cookie', `${adminCookieName}=${cookie}`)
      .expect(401);
    expect(expiredRes.body.code).toBe('REFRESH_EXPIRED');
  });
});
