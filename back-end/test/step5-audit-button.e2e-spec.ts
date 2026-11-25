import request from 'supertest';
import { createTestApp, TestAppContext } from './helpers/test-helpers';
import { AuditService } from '../src/audit/audit.service';

describe('Step 5 E2E: Audit Log Filtering by userId and reportId, Report Actions, & Permissions', () => {
  let ctx: TestAppContext;
  let server: any;
  let superuserToken: string;
  let adminAuditToken: string;
  let adminReportsToken: string;
  let userToken: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.app.getHttpServer();

    superuserToken = ctx.loginAs('superuser');
    adminAuditToken = ctx.loginAs('admin', ['audit', 'reports']);
    adminReportsToken = ctx.loginAs('admin', ['reports']); // Missing 'audit' permission
    userToken = ctx.loginAs('2', [], { email: 'arjun.sharma@teamforge.io', role: 'collaborator' });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(() => {
    ctx.resetStores();
    ctx.clockService.setTime('2026-11-20T10:00:00.000Z');
  });

  it('1. Non-permitted admin without audit permission gets 403 on GET /admin/audit', async () => {
    const res = await request(server)
      .get('/admin/audit')
      .set('Authorization', adminReportsToken)
      .expect(403);

    expect(res.body.message).toContain('audit');
  });

  it('2. GET /admin/audit with unknown userId or reportId returns empty list 200 OK, not an error', async () => {
    const res = await request(server)
      .get('/admin/audit?userId=non-existent-user-xyz&reportId=non-existent-rep-xyz')
      .set('Authorization', adminAuditToken)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });

  it('3. GET /admin/audit with userId, reportId, and intersection filters correctly', async () => {
    const auditService = ctx.app.get(AuditService);
    auditService.reset();

    auditService.log({
      action: 'user-warned',
      actor: 'admin-1',
      target: 'user-target-1',
      entityType: 'user',
      entityId: 'user-target-1',
      details: { userId: 'user-target-1', reportId: 'rep-101' },
    });

    auditService.log({
      action: 'user-warned',
      actor: 'admin-1',
      target: 'user-target-1',
      entityType: 'user',
      entityId: 'user-target-1',
      details: { userId: 'user-target-1', reportId: 'rep-202' },
    });

    auditService.log({
      action: 'report-status-changed',
      actor: 'admin-1',
      target: 'Report #rep-101',
      entityType: 'report',
      entityId: 'rep-101',
      details: { reportId: 'rep-101', reportedUserId: 'user-target-2' },
    });

    // Query by userId only
    const userRes = await request(server)
      .get('/admin/audit?userId=user-target-1')
      .set('Authorization', adminAuditToken)
      .expect(200);
    expect(userRes.body.length).toBe(2);

    // Query by reportId only
    const repRes = await request(server)
      .get('/admin/audit?reportId=rep-101')
      .set('Authorization', adminAuditToken)
      .expect(200);
    expect(repRes.body.length).toBe(2);

    // Query by both userId and reportId (intersection)
    const intersectRes = await request(server)
      .get('/admin/audit?userId=user-target-1&reportId=rep-101')
      .set('Authorization', adminAuditToken)
      .expect(200);
    expect(intersectRes.body.length).toBe(1);
    expect(intersectRes.body[0].details.userId).toBe('user-target-1');
    expect(intersectRes.body[0].details.reportId).toBe('rep-101');
  });

  it('4. GET /admin/audit/export applies userId and reportId filters for both JSON and CSV', async () => {
    const auditService = ctx.app.get(AuditService);
    auditService.reset();

    auditService.log({
      action: 'user-warned',
      actor: 'admin-1',
      target: 'user-target-1',
      entityType: 'user',
      entityId: 'user-target-1',
      details: { userId: 'user-target-1', reportId: 'rep-101' },
    });

    auditService.log({
      action: 'user-warned',
      actor: 'admin-1',
      target: 'user-other',
      entityType: 'user',
      entityId: 'user-other',
      details: { userId: 'user-other', reportId: 'rep-999' },
    });

    const jsonRes = await request(server)
      .get('/admin/audit/export?format=json&userId=user-target-1&reportId=rep-101')
      .set('Authorization', adminAuditToken)
      .expect(200);

    expect(jsonRes.body.exportedCount).toBe(1);
    expect(jsonRes.body.items[0].target).toBe('user-target-1');

    const csvRes = await request(server)
      .get('/admin/audit/export?format=csv&userId=user-target-1&reportId=rep-101')
      .set('Authorization', adminAuditToken)
      .expect(200);

    expect(csvRes.headers['content-type']).toContain('text/csv');
    expect(csvRes.text).toContain('user-target-1');
    expect(csvRes.text).not.toContain('user-other');
  });

  it('5. Warn then suspend a user from a report: both entries appear under the user and under the report', async () => {
    const auditService = ctx.app.get(AuditService);
    auditService.reset();

    // 1. Create first user report
    const report1Res = await request(server)
      .post('/reports')
      .set('Authorization', userToken)
      .send({
        reportedUserId: '3', // Seed user
        reason: 'Harassment',
        details: 'User repeatedly posted offensive comments in project channels.',
      })
      .expect(201);

    const report1Id = report1Res.body.id;
    expect(report1Id).toBeDefined();

    // 2. Action report 1: warn user
    await request(server)
      .post(`/admin/reports/${report1Id}/action`)
      .set('Authorization', adminAuditToken)
      .send({
        action: 'warn',
        reason: 'Violation of community standards regarding polite communication.',
      })
      .expect(201);

    // 3. Create second user report for same user
    const report2Res = await request(server)
      .post('/reports')
      .set('Authorization', userToken)
      .send({
        reportedUserId: '3',
        reason: 'Harassment',
        details: 'User continued harassment after warning.',
      })
      .expect(201);

    const report2Id = report2Res.body.id;
    expect(report2Id).toBeDefined();

    // 4. Action report 2: suspend user (by superuser for immediate suspension)
    await request(server)
      .post(`/admin/reports/${report2Id}/action`)
      .set('Authorization', superuserToken)
      .send({
        action: 'suspend',
        reason: 'Repeated severe harassment after warning.',
      })
      .expect(201);

    // Verify querying by userId '3' includes both actions
    const userAudit = await request(server)
      .get('/admin/audit?userId=3')
      .set('Authorization', adminAuditToken)
      .expect(200);

    const userActions = userAudit.body.map((e: any) => e.action);
    expect(userActions).toContain('user-warned');
    expect(userActions).toContain('user-suspended');

    // Verify querying by report1Id includes the warning action
    const report1Audit = await request(server)
      .get(`/admin/audit?reportId=${report1Id}`)
      .set('Authorization', adminAuditToken)
      .expect(200);

    const report1Actions = report1Audit.body.map((e: any) => e.action);
    expect(report1Actions).toContain('user-warned');
    expect(report1Actions).toContain('report-action');

    // Verify querying by report2Id includes the suspension action
    const report2Audit = await request(server)
      .get(`/admin/audit?reportId=${report2Id}`)
      .set('Authorization', adminAuditToken)
      .expect(200);

    const report2Actions = report2Audit.body.map((e: any) => e.action);
    expect(report2Actions).toContain('user-suspended');
    expect(report2Actions).toContain('report-action');
  });
});
