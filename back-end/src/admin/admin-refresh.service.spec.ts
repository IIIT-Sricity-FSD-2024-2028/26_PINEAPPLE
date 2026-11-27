import { AdminRefreshService } from './admin-refresh.service';
import { ClockService } from '../common/services/clock.service';
import { getAdminRefreshCookieName } from '../common/utils/refresh-cookie.util';

describe('AdminRefreshService', () => {
  let clock: ClockService;
  let portalAdminsMock: any;
  let usersMock: any;
  let service: AdminRefreshService;

  const createMockRes = () => {
    const cookies: Array<{ name: string; value: string; options: any }> = [];
    const cleared: Array<{ name: string; options: any }> = [];
    return {
      cookies,
      cleared,
      cookie(name: string, value: string, options: any) {
        cookies.push({ name, value, options });
      },
      clearCookie(name: string, options: any) {
        cleared.push({ name, options });
      },
    };
  };

  beforeEach(() => {
    delete process.env.ADMIN_REFRESH_COOKIE_NAME;
    delete process.env.ADMIN_REFRESH_TTL;
    delete process.env.ADMIN_SESSION_MAX_HOURS;
    delete process.env.ADMIN_ACCESS_TOKEN_TTL;
    delete process.env.ADMIN_REFRESH_RATE_LIMIT_MAX;

    clock = new ClockService();
    portalAdminsMock = {
      items: [
        {
          id: 'pa-1',
          email: 'ops@teamforge.io',
          name: 'Ops Admin',
          portalRole: 'admin',
          permissions: ['reports', 'users'],
          status: 'active',
          tokenVersion: 1,
        },
      ],
      findById(id: string) {
        return this.items.find((i: any) => i.id === id);
      },
      findByEmail(email: string) {
        return this.items.find((i: any) => i.email === email);
      },
    };
    usersMock = {
      findById: () => undefined,
      findRawUserById: () => undefined,
      bumpTokenVersion: () => 2,
    };

    service = new AdminRefreshService(
      undefined,
      clock,
      { bootId: 'boot-test-1' } as any,
      portalAdminsMock,
      usersMock,
    );
  });

  it('issues an opaque SHA-256-hashed httpOnly Strict cookie scoped to /admin/auth', () => {
    const res = createMockRes();
    service.issueSessionForAdmin(res, {
      id: 'pa-1',
      email: 'ops@teamforge.io',
      name: 'Ops Admin',
      role: 'admin',
      permissions: ['reports', 'users'],
    });

    expect(res.cookies).toHaveLength(1);
    const issued = res.cookies[0];
    expect(issued.name).toBe(getAdminRefreshCookieName());
    expect(issued.value).toBeTruthy();
    // Opaque random token (not a 3-part JWT)
    expect(issued.value.split('.')).toHaveLength(1);
    expect(issued.value.length).toBeGreaterThanOrEqual(40);
    expect(issued.options).toMatchObject({
      httpOnly: true,
      sameSite: 'strict',
      path: '/admin/auth',
      secure: false,
    });
    expect(issued.options.maxAge).toBe(12 * 3_600_000);
    expect(service.getActiveRecordCountForAdmin('pa-1')).toBe(1);
  });

  it('rotates refresh cookie on refresh() and immediately revokes chain on old token reuse (REFRESH_REUSED)', () => {
    const loginRes = createMockRes();
    service.issueSessionForAdmin(loginRes, {
      id: 'pa-1',
      email: 'ops@teamforge.io',
      name: 'Ops Admin',
      role: 'admin',
      permissions: ['reports', 'users'],
    });
    const token1 = loginRes.cookies[0].value;

    const refreshRes1 = createMockRes();
    const out1 = service.refresh(
      { cookies: { [getAdminRefreshCookieName()]: token1 }, headers: {} },
      refreshRes1,
    );
    expect(out1.token).toBeTruthy();
    expect(out1.admin).toMatchObject({
      id: 'pa-1',
      email: 'ops@teamforge.io',
      role: 'admin',
      permissions: ['reports', 'users'],
    });
    const token2 = refreshRes1.cookies[0].value;
    expect(token2).not.toBe(token1);

    // Replaying token1 triggers REFRESH_REUSED and revokes whole chain including token2
    const reuseRes = createMockRes();
    expect(() =>
      service.refresh(
        { cookies: { [getAdminRefreshCookieName()]: token1 }, headers: {} },
        reuseRes,
      ),
    ).toThrow(/reuse detected/i);
    expect(reuseRes.cleared).toHaveLength(1);
    expect(service.getActiveRecordCountForAdmin('pa-1')).toBe(0);

    // Newer token2 is also revoked
    const afterReuseRes = createMockRes();
    expect(() =>
      service.refresh(
        { cookies: { [getAdminRefreshCookieName()]: token2 }, headers: {} },
        afterReuseRes,
      ),
    ).toThrow();
  });

  it('enforces idle refresh expiry (12h) and absolute 24h max session lifetime cap', () => {
    const loginRes = createMockRes();
    service.issueSessionForAdmin(loginRes, {
      id: 'pa-1',
      email: 'ops@teamforge.io',
      name: 'Ops Admin',
      role: 'admin',
      permissions: ['reports'],
    });
    let currentToken = loginRes.cookies[0].value;

    // Rotate after 10h
    clock.advanceHours(10);
    const res1 = createMockRes();
    service.refresh(
      { cookies: { [getAdminRefreshCookieName()]: currentToken }, headers: {} },
      res1,
    );
    currentToken = res1.cookies[0].value;
    expect(res1.cookies[0].options.maxAge).toBe(12 * 3_600_000);

    // Rotate at 20h total elapsed: maxAge capped at remaining ~4h (24h cap)
    clock.advanceHours(10);
    const res2 = createMockRes();
    service.refresh(
      { cookies: { [getAdminRefreshCookieName()]: currentToken }, headers: {} },
      res2,
    );
    currentToken = res2.cookies[0].value;
    expect(res2.cookies[0].options.maxAge).toBeLessThanOrEqual(4 * 3_600_000);
    expect(res2.cookies[0].options.maxAge).toBeGreaterThan(4 * 3_600_000 - 5000);

    // Advance past 24h cap -> expires even though 12h TTL from 20h wouldn't have elapsed
    clock.advanceHours(4);
    clock.advanceTime(1000);
    const res3 = createMockRes();
    let caught: any;
    try {
      service.refresh(
        { cookies: { [getAdminRefreshCookieName()]: currentToken }, headers: {} },
        res3,
      );
    } catch (err) {
      caught = err;
    }
    expect(caught?.getStatus?.()).toBe(401);
    expect(caught?.getResponse?.()?.code).toBe('REFRESH_EXPIRED');
    expect(res3.cleared).toHaveLength(1);
  });

  it('rejects disallowed Origin headers and enforces per-window rate limit', () => {
    process.env.ADMIN_REFRESH_RATE_LIMIT_MAX = '3';
    const loginRes = createMockRes();
    service.issueSessionForAdmin(loginRes, {
      id: 'pa-1',
      email: 'ops@teamforge.io',
      name: 'Ops Admin',
      role: 'admin',
      permissions: ['reports'],
    });
    const tok = loginRes.cookies[0].value;

    // Disallowed origin fails before touching record
    expect(() =>
      service.refresh(
        {
          cookies: { [getAdminRefreshCookieName()]: tok },
          headers: { origin: 'https://evil.example.com' },
        },
        createMockRes(),
      ),
    ).toThrow(/origin/i);

    // Allowed origin works up to rate limit max=3
    let activeTok = tok;
    for (let i = 0; i < 3; i++) {
      const r = createMockRes();
      service.refresh(
        {
          cookies: { [getAdminRefreshCookieName()]: activeTok },
          headers: { origin: 'http://localhost:5173' },
        },
        r,
      );
      activeTok = r.cookies[0].value;
    }

    // 4th attempt exceeds limit -> 429
    let rateErr: any;
    try {
      service.refresh(
        {
          cookies: { [getAdminRefreshCookieName()]: activeTok },
          headers: { origin: 'http://localhost:5173' },
        },
        createMockRes(),
      );
    } catch (e) {
      rateErr = e;
    }
    expect(rateErr?.getStatus?.()).toBe(429);
    expect(rateErr?.getResponse?.()?.code).toBe('RATE_LIMITED');
  });
});
