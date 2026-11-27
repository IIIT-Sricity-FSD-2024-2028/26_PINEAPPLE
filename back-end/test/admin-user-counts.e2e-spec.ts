import request from 'supertest';
import { createTestApp, TestAppContext } from './helpers/test-helpers';
import { PortalAdminsService } from '../src/portal-admins/portal-admins.service';

describe('Admin Dashboard & Users Page User Counts E2E', () => {
  let ctx: TestAppContext;
  let server: any;
  let portalAdminsService: PortalAdminsService;

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

  it('dashboard stats and Users page counts exclude admins & Super User (9, never 12) and stay synchronized across mutations', async () => {
    const suToken = ctx.loginAs('superuser');

    // 1. Seeded state: 9 regular users; '1' (Priya Patel), 'u-admin', 'u-superuser' excluded
    const [stats0, counts0, list0] = await Promise.all([
      request(server).get('/admin/stats').set('Authorization', suToken).expect(200),
      request(server).get('/admin/users/counts').set('Authorization', suToken).expect(200),
      request(server).get('/admin/users').set('Authorization', suToken).expect(200),
    ]);

    expect(Array.isArray(list0.body)).toBe(true);
    expect(list0.body).toHaveLength(9);
    expect(list0.body.some((u: any) => ['1', 'u-admin', 'u-superuser'].includes(String(u.id)))).toBe(false);

    expect(counts0.body).toEqual({
      total: 9,
      active: 9,
      suspended: 0,
      flagged: 0,
      warned: 0,
      possibleDuplicates: 0,
      pendingApprovals: 0,
    });
    expect(stats0.body.totalUsers).toBe(counts0.body.total);
    expect(stats0.body.activeUsers).toBe(counts0.body.active);
    expect(stats0.body.suspendedUsers).toBe(counts0.body.suspended);
    expect(stats0.body.warnedUsers).toBe(counts0.body.warned);
    expect(stats0.body.flaggedUsers).toBe(counts0.body.flagged);
    expect(stats0.body.flaggedWarned).toBe(counts0.body.flagged);

    // Preserve existing /admin/stats fields used by FE
    expect(typeof stats0.body.totalProjects).toBe('number');
    expect(typeof stats0.body.auditEvents).toBe('number');

    // 2. Creating a portal admin and a UsersRepository admin does NOT change platform user counts
    await request(server)
      .post('/portal-admins')
      .set('Authorization', suToken)
      .send({
        name: 'Secondary Portal Admin',
        email: 'sec-portal-admin@teamforge.io',
        password: 'Password123!',
        permissions: ['users', 'reports'],
      })
      .expect(201);

    await request(server)
      .post('/users')
      .set('Authorization', suToken)
      .send({
        name: 'Created Admin User',
        email: 'created-admin@teamforge.io',
        role: 'Administrator',
      })
      .expect(201);

    const [statsAfterAdmin, countsAfterAdmin, listAfterAdmin] = await Promise.all([
      request(server).get('/admin/stats').set('Authorization', suToken).expect(200),
      request(server).get('/admin/users/counts').set('Authorization', suToken).expect(200),
      request(server).get('/admin/users').set('Authorization', suToken).expect(200),
    ]);
    expect(countsAfterAdmin.body.total).toBe(9);
    expect(statsAfterAdmin.body.totalUsers).toBe(9);
    expect(statsAfterAdmin.body.activeAdmins).toBe(1);
    expect(listAfterAdmin.body).toHaveLength(9);

    // 3. Creating a regular user adds 1 to both stats and Users counts
    const createdUserRes = await request(server)
      .post('/users')
      .set('Authorization', suToken)
      .send({
        name: 'Regular Platform Member',
        email: 'regular-member@teamforge.io',
        role: 'Collaborator',
      })
      .expect(201);
    const createdUserId = String(createdUserRes.body.id);

    const [statsAfterUser, countsAfterUser, listAfterUser] = await Promise.all([
      request(server).get('/admin/stats').set('Authorization', suToken).expect(200),
      request(server).get('/admin/users/counts').set('Authorization', suToken).expect(200),
      request(server).get('/admin/users').set('Authorization', suToken).expect(200),
    ]);
    expect(countsAfterUser.body.total).toBe(10);
    expect(countsAfterUser.body.active).toBe(10);
    expect(statsAfterUser.body.totalUsers).toBe(10);
    expect(statsAfterUser.body.activeUsers).toBe(10);
    expect(listAfterUser.body).toHaveLength(10);

    // 4. Warning a regular user increments warned (without auto-flagging) on both
    await request(server)
      .post(`/admin/users/${createdUserId}/warn`)
      .set('Authorization', suToken)
      .send({ reason: 'Disruptive conduct during team standup call' })
      .expect(201);

    const [statsAfterWarn, countsAfterWarn] = await Promise.all([
      request(server).get('/admin/stats').set('Authorization', suToken).expect(200),
      request(server).get('/admin/users/counts').set('Authorization', suToken).expect(200),
    ]);
    expect(countsAfterWarn.body.warned).toBe(1);
    expect(countsAfterWarn.body.flagged).toBe(0);
    expect(countsAfterWarn.body.active).toBe(10);
    expect(countsAfterWarn.body.total).toBe(10);
    expect(statsAfterWarn.body.warnedUsers).toBe(1);
    expect(statsAfterWarn.body.flaggedUsers).toBe(0);
    expect(statsAfterWarn.body.flaggedWarned).toBe(0);
    expect(statsAfterWarn.body.activeUsers).toBe(10);

    // 4b. Flagging a regular user increments flagged on both stats and Users counts
    await request(server)
      .put(`/admin/users/${createdUserId}/flag`)
      .set('Authorization', suToken)
      .expect(200);

    const [statsAfterFlag, countsAfterFlag] = await Promise.all([
      request(server).get('/admin/stats').set('Authorization', suToken).expect(200),
      request(server).get('/admin/users/counts').set('Authorization', suToken).expect(200),
    ]);
    expect(countsAfterFlag.body.flagged).toBe(1);
    expect(countsAfterFlag.body.warned).toBe(1);
    expect(statsAfterFlag.body.flaggedUsers).toBe(1);
    expect(statsAfterFlag.body.flaggedWarned).toBe(1);
    expect(statsAfterFlag.body.warnedUsers).toBe(1);

    // 5. Suspending moves 1 from active to suspended on both (young/low-rep account suspends immediately)
    await request(server)
      .post(`/admin/users/${createdUserId}/suspend`)
      .set('Authorization', suToken)
      .send({ reason: 'Confirmed abuse of workspace resources after warning' })
      .expect(200);

    const [statsAfterSuspend, countsAfterSuspend] = await Promise.all([
      request(server).get('/admin/stats').set('Authorization', suToken).expect(200),
      request(server).get('/admin/users/counts').set('Authorization', suToken).expect(200),
    ]);
    expect(countsAfterSuspend.body.total).toBe(10);
    expect(countsAfterSuspend.body.active).toBe(9);
    expect(countsAfterSuspend.body.suspended).toBe(1);
    expect(statsAfterSuspend.body.totalUsers).toBe(10);
    expect(statsAfterSuspend.body.activeUsers).toBe(9);
    expect(statsAfterSuspend.body.suspendedUsers).toBe(1);

    // 6. Deleting the account removes it from both stats, counts, and /admin/users
    await request(server)
      .delete(`/users/${createdUserId}`)
      .set('Authorization', suToken)
      .send({ reason: 'Removing test user created for E2E verification' })
      .expect(200);

    const [statsAfterDelete, countsAfterDelete, listAfterDelete] = await Promise.all([
      request(server).get('/admin/stats').set('Authorization', suToken).expect(200),
      request(server).get('/admin/users/counts').set('Authorization', suToken).expect(200),
      request(server).get('/admin/users').set('Authorization', suToken).expect(200),
    ]);
    expect(countsAfterDelete.body.total).toBe(9);
    expect(countsAfterDelete.body.active).toBe(9);
    expect(countsAfterDelete.body.suspended).toBe(0);
    expect(statsAfterDelete.body.totalUsers).toBe(9);
    expect(statsAfterDelete.body.activeUsers).toBe(9);
    expect(statsAfterDelete.body.suspendedUsers).toBe(0);
    expect(listAfterDelete.body).toHaveLength(9);
  });
});
