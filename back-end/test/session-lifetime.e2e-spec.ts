import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { createTestApp, TestAppContext, JWT_TEST_SECRET } from './helpers/test-helpers';

describe('Session Lifetime & Refresh Flow (7-Day Sessions E2E)', () => {
  let ctx: TestAppContext;
  let originalAccessTokenTtl: string | undefined;
  let originalRefreshTokenTtl: string | undefined;
  let originalSessionMaxDays: string | undefined;

  beforeAll(async () => {
    originalAccessTokenTtl = process.env.ACCESS_TOKEN_TTL;
    originalRefreshTokenTtl = process.env.REFRESH_TOKEN_TTL;
    originalSessionMaxDays = process.env.SESSION_MAX_DAYS;

    delete process.env.ACCESS_TOKEN_TTL;
    delete process.env.REFRESH_TOKEN_TTL;
    delete process.env.SESSION_MAX_DAYS;

    ctx = await createTestApp();
  });

  afterAll(async () => {
    if (originalAccessTokenTtl !== undefined) process.env.ACCESS_TOKEN_TTL = originalAccessTokenTtl;
    else delete process.env.ACCESS_TOKEN_TTL;

    if (originalRefreshTokenTtl !== undefined) process.env.REFRESH_TOKEN_TTL = originalRefreshTokenTtl;
    else delete process.env.REFRESH_TOKEN_TTL;

    if (originalSessionMaxDays !== undefined) process.env.SESSION_MAX_DAYS = originalSessionMaxDays;
    else delete process.env.SESSION_MAX_DAYS;

    await ctx.app.close();
  });

  beforeEach(() => {
    delete process.env.ACCESS_TOKEN_TTL;
    delete process.env.REFRESH_TOKEN_TTL;
    delete process.env.SESSION_MAX_DAYS;
  });

  it('1. Default TTLs verify as 15m (access token) and 7d (refresh token)', async () => {
    expect(ctx.authService.getAccessTokenTtl()).toBe('15m');
    expect(ctx.authService.getRefreshTokenTtl()).toBe('7d');
    expect(ctx.authService.getRefreshTokenTtlMs()).toBe(7 * 24 * 60 * 60 * 1000);

    const loginRes = await request(ctx.app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: 'priya.patel@teamforge.io', password: 'password123' })
      .expect(200);

    expect(loginRes.body.accessToken).toBeDefined();
    expect(loginRes.body.refreshToken).toBeDefined();

    const decodedAccess: any = jwt.decode(loginRes.body.accessToken);
    const decodedRefresh: any = jwt.decode(loginRes.body.refreshToken);

    // 15m = 900 seconds (+- 2s window)
    const accessTtlSeconds = decodedAccess.exp - decodedAccess.iat;
    expect(accessTtlSeconds).toBe(900);

    // 7d = 604800 seconds (+- 2s window)
    const refreshTtlSeconds = decodedRefresh.exp - decodedRefresh.iat;
    expect(refreshTtlSeconds).toBe(604800);
  });

  it('2. Access token expires at ACCESS_TOKEN_TTL (test with 2s) and returns 401 TOKEN_EXPIRED', async () => {
    process.env.ACCESS_TOKEN_TTL = '2s';

    const loginRes = await request(ctx.app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: 'priya.patel@teamforge.io', password: 'password123' })
      .expect(200);

    const token = loginRes.body.accessToken;

    // Immediately works
    await request(ctx.app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // Wait 2.2 seconds for access token to expire
    await new Promise((resolve) => setTimeout(resolve, 2200));

    // Protected endpoint now returns 401 with code TOKEN_EXPIRED
    const expiredRes = await request(ctx.app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    expect(expiredRes.body.code).toBe('TOKEN_EXPIRED');
    expect(expiredRes.body.message).toMatch(/expired/i);
  });

  it('3. Refresh endpoint /auth/refresh rotates token, returns new access & refresh tokens, and rejects old refresh token with 401 REFRESH_INVALID', async () => {
    delete process.env.ACCESS_TOKEN_TTL;
    delete process.env.REFRESH_TOKEN_TTL;

    const loginRes = await request(ctx.app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: 'priya.patel@teamforge.io', password: 'password123' })
      .expect(200);

    const oldRefreshToken = loginRes.body.refreshToken;
    const oldAccessToken = loginRes.body.accessToken;

    // Refresh token rotation
    const refreshRes = await request(ctx.app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: oldRefreshToken })
      .expect(200);

    const newAccessToken = refreshRes.body.accessToken;
    const newRefreshToken = refreshRes.body.refreshToken;

    expect(newAccessToken).toBeDefined();
    expect(newRefreshToken).toBeDefined();
    expect(newAccessToken).not.toBe(oldAccessToken);
    expect(newRefreshToken).not.toBe(oldRefreshToken);

    // New access token works
    await request(ctx.app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${newAccessToken}`)
      .expect(200);

    // Old refresh token reuse beyond grace period triggers theft rejection (401 REFRESH_INVALID)
    // Age tombstone past 10s grace period
    const oldHash = crypto.createHash('sha256').update(oldRefreshToken.trim()).digest('hex');
    const tombstone = (ctx.authService as any).rotatedRefreshTokens.get(oldHash);
    if (tombstone) {
      tombstone.rotatedAt = new Date(Date.now() - 15000);
    }

    const reuseRes = await request(ctx.app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: oldRefreshToken })
      .expect(401);

    expect(reuseRes.body.code).toBe('REFRESH_INVALID');

    // Submitting a completely invalid/unknown token returns 401 REFRESH_INVALID
    const invalidRes = await request(ctx.app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: 'completely-invalid-refresh-token' })
      .expect(401);

    expect(invalidRes.body.code).toBe('REFRESH_INVALID');
  });

  it('4. Refresh token expires at REFRESH_TOKEN_TTL and returns 401 REFRESH_INVALID', async () => {
    process.env.REFRESH_TOKEN_TTL = '2s';

    const loginRes = await request(ctx.app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: 'priya.patel@teamforge.io', password: 'password123' })
      .expect(200);

    const shortRefreshToken = loginRes.body.refreshToken;

    // Wait 2.2 seconds for refresh token to expire
    await new Promise((resolve) => setTimeout(resolve, 2200));

    const expiredRefreshRes = await request(ctx.app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: shortRefreshToken })
      .expect(401);

    expect(expiredRefreshRes.body.code).toBe('REFRESH_INVALID');
    expect(expiredRefreshRes.body.message).toMatch(/expired/i);
  });

  it('5. Token from another bootId returns 401 SESSION_INVALID', async () => {
    const currentBootId = ctx.bootService.bootId;
    const foreignBootId = 'foreign-boot-id-different-from-current';
    expect(foreignBootId).not.toBe(currentBootId);

    // Foreign access token
    const foreignAccessToken = jwt.sign(
      {
        sub: '1',
        email: 'priya.patel@teamforge.io',
        role: 'project-owner',
        permissions: [],
        tv: 1,
        jti: crypto.randomUUID(),
        bootId: foreignBootId,
      },
      JWT_TEST_SECRET,
      {
        algorithm: 'HS256',
        expiresIn: '15m',
        issuer: 'teamforge',
        audience: 'teamforge-web',
      },
    );

    const resAccess = await request(ctx.app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${foreignAccessToken}`)
      .expect(401);

    expect(resAccess.body.code).toBe('SESSION_INVALID');
    expect(resAccess.body.message).toMatch(/server restarted/i);

    // Foreign refresh token
    const foreignRefreshToken = jwt.sign(
      {
        sub: '1',
        type: 'refresh',
        tv: 1,
        jti: crypto.randomUUID(),
        bootId: foreignBootId,
      },
      JWT_TEST_SECRET,
      {
        algorithm: 'HS256',
        expiresIn: '7d',
        issuer: 'teamforge',
        audience: 'teamforge-web',
      },
    );

    const resRefresh = await request(ctx.app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: foreignRefreshToken })
      .expect(401);

    expect(resRefresh.body.code).toBe('SESSION_INVALID');
    expect(resRefresh.body.message).toMatch(/server restarted/i);
  });

  it('6. Configurable TTLs via env variables: ACCESS_TOKEN_TTL and REFRESH_TOKEN_TTL', async () => {
    process.env.ACCESS_TOKEN_TTL = '30m';
    process.env.REFRESH_TOKEN_TTL = '14d';
    process.env.SESSION_MAX_DAYS = '14';

    expect(ctx.authService.getAccessTokenTtl()).toBe('30m');
    expect(ctx.authService.getRefreshTokenTtl()).toBe('14d');
    expect(ctx.authService.getRefreshTokenTtlMs()).toBe(14 * 24 * 60 * 60 * 1000);

    const loginRes = await request(ctx.app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: 'priya.patel@teamforge.io', password: 'password123' })
      .expect(200);

    const decodedAccess: any = jwt.decode(loginRes.body.accessToken);
    const decodedRefresh: any = jwt.decode(loginRes.body.refreshToken);

    // 30m = 1800 seconds
    expect(decodedAccess.exp - decodedAccess.iat).toBe(1800);
    // 14d = 1209600 seconds
    expect(decodedRefresh.exp - decodedRefresh.iat).toBe(1209600);
  });
});
