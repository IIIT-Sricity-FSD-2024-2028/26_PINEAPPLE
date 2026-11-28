import request from 'supertest';
import { createTestApp, TestAppContext } from '../../test/helpers/test-helpers';

describe('AdminUserDetails API & Audit String Shapes', () => {
  let ctx: TestAppContext;
  let adminToken: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    ctx.resetStores();
    const loginRes = await request(ctx.app.getHttpServer())
      .post('/admin/login')
      .send({ email: 'admin@teamforge.io', password: 'admin123' })
      .expect(200);
    adminToken = loginRes.body.accessToken || loginRes.body.token;
  });

  function assertConsistentUserDetailsShape(body: any) {
    expect(typeof body.id).toBe('string');
    expect(typeof body.status).toBe('string');
    expect(typeof body.warnings).toBe('number');
    expect(typeof body.activeWarningsCount).toBe('number');
    expect(Array.isArray(body.warningHistory)).toBe(true);
    expect(Array.isArray(body.recentActivity)).toBe(true);
    expect(Array.isArray(body.pendingModerationActions)).toBe(true);

    for (const entry of body.recentActivity) {
      expect(typeof entry.event).toBe('string');
      expect(typeof entry.action).toBe('string');
    }
    for (const w of body.warningHistory) {
      expect(typeof w.reason).toBe('string');
      expect(typeof w.moderatorName).toBe('string');
      expect(typeof w.issuedByName).toBe('string');
    }
  }

  it('guarantees plain string audit events and consistent suspension shapes across active, warned, manual suspend, auto suspend, and reactivated states', async () => {
    // 1. Active user
    const activeRes = await request(ctx.app.getHttpServer())
      .get('/admin/users/5')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    assertConsistentUserDetailsShape(activeRes.body);
    expect(activeRes.body.status).toBe('Active');
    expect(activeRes.body.suspension).toBeNull();

    // 2. Warned user
    await request(ctx.app.getHttpServer())
      .post('/admin/users/5/warn')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'First moderation warning for test verification.' })
      .expect(201);

    const warnedRes = await request(ctx.app.getHttpServer())
      .get('/admin/users/5')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    assertConsistentUserDetailsShape(warnedRes.body);
    expect(warnedRes.body.activeWarningsCount).toBe(1);
    expect(warnedRes.body.recentActivity[0].event).toContain('warning');

    // 3. Manual suspension (low-rep / new user or via direct moderation check on user 5)
    // User 5 createdAt 2024 triggers second approval unless superuser, so test suspendUser for direct manual suspension first:
    await ctx.adminService.suspendUser('5', { reason: 'Manual moderation suspension verification.' }, 'u-admin');
    const manualSuspRes = await request(ctx.app.getHttpServer())
      .get('/admin/users/5')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    assertConsistentUserDetailsShape(manualSuspRes.body);
    expect(manualSuspRes.body.status).toBe('Suspended');
    expect(manualSuspRes.body.suspension).toEqual(
      expect.objectContaining({
        reason: 'Manual moderation suspension verification.',
        type: 'manual',
        typeLabel: 'Manual',
        suspendedByName: expect.any(String),
      }),
    );
    expect(manualSuspRes.body.suspension.suspendedAt).toBeTruthy();

    // 4. Reactivated user clears active suspension and warnings count
    await request(ctx.app.getHttpServer())
      .post('/admin/users/5/reactivate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Reactivation after manual moderation review.' })
      .expect(200);

    const reactivatedRes = await request(ctx.app.getHttpServer())
      .get('/admin/users/5')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    assertConsistentUserDetailsShape(reactivatedRes.body);
    expect(reactivatedRes.body.status).toBe('Active');
    expect(reactivatedRes.body.activeWarningsCount).toBe(0);
    expect(reactivatedRes.body.suspension).toBeNull();

    // 5. Automatic suspension via 4 warnings on user 2
    for (let i = 1; i <= 4; i += 1) {
      await request(ctx.app.getHttpServer())
        .post('/admin/users/2/warn')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: `Automatic suspension warning step ${i} test reason.` })
        .expect(201);
    }

    const autoSuspRes = await request(ctx.app.getHttpServer())
      .get('/admin/users/2')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    assertConsistentUserDetailsShape(autoSuspRes.body);
    expect(autoSuspRes.body.status).toBe('Suspended');
    expect(autoSuspRes.body.suspension).toEqual(
      expect.objectContaining({
        reason: 'Automatic suspension after 4 warnings',
        type: 'automatic',
        typeLabel: 'Automatic after 4 warnings',
        suspendedByName: 'System',
      }),
    );
    expect(autoSuspRes.body.suspension.suspendedAt).toBeTruthy();
  });

  it('AuditService.create always stores plain string event even when entry.event is omitted and details is an object', () => {
    const created = ctx.auditService.create({
      action: 'user-warned',
      actor: 'u-admin',
      entityType: 'user',
      entityId: '99',
      details: {
        userId: '99',
        targetUserId: '99',
        actorId: 'u-admin',
        message: 'Issued warning 1/4 to user 99.',
      },
    });
    expect(typeof created.event).toBe('string');
    expect(created.event).toContain('Issued warning 1/4');
  });
});
