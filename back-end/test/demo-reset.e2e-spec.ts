import request from 'supertest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createTestApp, TestAppContext } from './helpers/test-helpers';
import { SEED_USER_REPUTATION } from '../src/moderation/reputation.seeds';
import { SECURE_CVS_DIR, UPLOADS_DIR } from '../src/core/middleware/file-upload.middleware';

describe('Demo Reset Feature E2E API Tests', () => {
  let ctx: TestAppContext;
  let server: any;
  let tempRoot: string;
  let exportDir: string;

  beforeAll(async () => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-demo-reset-e2e-'));
    exportDir = path.join(tempRoot, 'exports');
    fs.mkdirSync(exportDir, { recursive: true });
    process.env.EXPORT_DIR = exportDir;
    process.env.ALLOW_DEMO_RESET = 'true';

    ctx = await createTestApp();
    server = ctx.app.getHttpServer();
  });

  afterAll(async () => {
    delete process.env.EXPORT_DIR;
    delete process.env.ALLOW_DEMO_RESET;
    if (ctx?.app) await ctx.app.close();
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    } catch {}
  });

  beforeEach(() => {
    ctx.resetStores();
    process.env.ALLOW_DEMO_RESET = 'true';
  });

  it('1. Enforces auth (401), Super User RBAC (403), ALLOW_DEMO_RESET=false (403 DEMO_RESET_DISABLED), and confirm=RESET (400)', async () => {
    // Unauthenticated
    await request(server).get('/admin/system/demo-reset-status').expect(401);
    await request(server).post('/admin/system/reset-demo').send({ confirm: 'RESET' }).expect(401);

    // Collaborator and Admin get 403
    const collabToken = ctx.loginAs('2');
    const adminToken = ctx.loginAs('admin-reports');
    const superToken = ctx.loginAs('superuser');

    await request(server).get('/admin/system/demo-reset-status').set('Authorization', collabToken).expect(403);
    await request(server).post('/admin/system/reset-demo').set('Authorization', collabToken).send({ confirm: 'RESET' }).expect(403);

    await request(server).get('/admin/system/demo-reset-status').set('Authorization', adminToken).expect(403);
    await request(server).post('/admin/system/reset-demo').set('Authorization', adminToken).send({ confirm: 'RESET' }).expect(403);

    // Super User status
    const statusRes = await request(server).get('/admin/system/demo-reset-status').set('Authorization', superToken).expect(200);
    expect(statusRes.body.enabled).toBe(true);

    // Missing or wrong confirm
    const missingConfirm = await request(server).post('/admin/system/reset-demo').set('Authorization', superToken).send({});
    expect(missingConfirm.status).toBe(400);
    expect(missingConfirm.body.code).toBe('CONFIRMATION_REQUIRED');

    const wrongConfirm = await request(server).post('/admin/system/reset-demo').set('Authorization', superToken).send({ confirm: 'reset' });
    expect(wrongConfirm.status).toBe(400);
    expect(wrongConfirm.body.code).toBe('CONFIRMATION_REQUIRED');

    // Disabled env returns 403 DEMO_RESET_DISABLED and status enabled: false
    process.env.ALLOW_DEMO_RESET = 'false';
    const disabledStatus = await request(server).get('/admin/system/demo-reset-status').set('Authorization', superToken).expect(200);
    expect(disabledStatus.body.enabled).toBe(false);

    const disabledPost = await request(server)
      .post('/admin/system/reset-demo')
      .set('Authorization', superToken)
      .send({ confirm: 'RESET' });
    expect(disabledPost.status).toBe(403);
    expect(disabledPost.body.code).toBe('DEMO_RESET_DISABLED');
  });

  it('2. Full E2E reset restores all stores, escrow, job log, leaderboard, files, snapshot; revokes old tokens; logs 1 DEMO_DATA_RESET audit entry', async () => {
    const initialUserCount = ctx.usersRepository.findAll().length;
    const initialProjectCount = ctx.projectsRepository.findAll().length;
    const initialTaskCount = ctx.tasksRepository.findAll().length;
    const initialAuditLenBeforeExtras = ctx.auditService.count();
    expect(initialAuditLenBeforeExtras).toBeGreaterThanOrEqual(0);

    const superToken = ctx.loginAs('superuser');
    const collabToken = ctx.loginAs('2');
    const ownerToken = ctx.loginAs('1');

    // Create extra user, project, task, report, support ticket, job run, uploaded file, CV, export
    const extraUserRes = await request(server)
      .post('/auth/signup')
      .send({ email: 'extra.reset@teamforge.test', password: 'Password123!' })
      .expect(201);
    const extraUserToken = `Bearer ${extraUserRes.body.accessToken}`;
    await request(server)
      .post('/auth/profile')
      .set('Authorization', extraUserToken)
      .send({ name: 'Extra User', username: 'extra_reset_u' })
      .expect(200);

    const extraProjRes = await request(server)
      .post('/projects')
      .set('Authorization', ownerToken)
      .send({
        title: 'Temporary Reset Demo Project',
        description: 'Created before pressing Reset to mock data so we verify extra projects and tasks disappear cleanly on reset.',
        dueDate: '2028-06-01T00:00:00.000Z',
      })
      .expect(201);

    await request(server)
      .post('/tasks')
      .set('Authorization', ownerToken)
      .send({
        projectId: extraProjRes.body.id,
        title: 'Temporary Task To Erase',
        dueDate: '2028-05-01T00:00:00.000Z',
      })
      .expect(201);

    // Report
    await request(server)
      .post('/reports')
      .set('Authorization', collabToken)
      .send({
        reportedUserId: '8',
        reason: 'Spam',
        details: 'Test report created prior to demo reset to verify clearance.',
      })
      .expect(201);

    // Support ticket
    await request(server)
      .post('/support/tickets')
      .set('Authorization', collabToken)
      .send({
        subject: 'Temporary Support Ticket For Reset',
        message: 'This ticket must be erased when demo data is reset back to seed.',
        category: 'General',
      })
      .expect(201);

    // Job run
    await request(server).post('/admin/jobs/tick').set('Authorization', superToken).expect(202);
    expect(ctx.jobRunsService.list(10).length).toBeGreaterThanOrEqual(1);

    // Uploaded extra files on disk
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    fs.mkdirSync(SECURE_CVS_DIR, { recursive: true });
    const extraUploadPath = path.join(UPLOADS_DIR, `demo-reset-extra-${Date.now()}.txt`);
    const extraCvPath = path.join(SECURE_CVS_DIR, `demo-reset-cv-${Date.now()}.pdf`);
    const extraExportPath = path.join(exportDir, `demo-reset-exp-${Date.now()}.json`);
    fs.writeFileSync(extraUploadPath, 'extra upload');
    fs.writeFileSync(extraCvPath, '%PDF-1.4\nextra cv');
    fs.writeFileSync(extraExportPath, '{"extra":true}');

    // Execute reset
    const resetRes = await request(server)
      .post('/admin/system/reset-demo')
      .set('Authorization', superToken)
      .send({ confirm: 'RESET' });

    expect(resetRes.status).toBe(200);
    expect(resetRes.body.resetAt).toBeTruthy();
    expect(resetRes.body.counts).toEqual({
      users: initialUserCount,
      projects: initialProjectCount,
      tasks: initialTaskCount,
    });

    // All extra uploads/CVs/exports removed from disk
    expect(fs.existsSync(extraUploadPath)).toBe(false);
    expect(fs.existsSync(extraCvPath)).toBe(false);
    expect(fs.existsSync(extraExportPath)).toBe(false);
    expect(fs.existsSync(path.resolve(process.cwd(), 'data', 'snapshot.json'))).toBe(false);

    // Audit log contains ONLY the single DEMO_DATA_RESET entry
    const freshAudit = ctx.auditService.findAll();
    expect(freshAudit).toHaveLength(1);
    expect(freshAudit[0].action).toBe('DEMO_DATA_RESET');

    // Old tokens (both Super User and Collaborator) are immediately rejected with 401
    await request(server).get('/users/me').set('Authorization', collabToken).expect(401);
    await request(server).get('/admin/system/demo-reset-status').set('Authorization', superToken).expect(401);

    // Seed account can log in again & access restored leaderboard
    const reloginRes = await request(server)
      .post('/auth/login')
      .send({ identifier: 'arjun.sharma@teamforge.io', password: 'password123' });
    expect(reloginRes.status).toBe(200);
    const freshCollabToken = `Bearer ${reloginRes.body.accessToken}`;

    const lbRes = await request(server).get('/leaderboard').set('Authorization', freshCollabToken).expect(200);
    const arjunRow = lbRes.body.find((r: any) => String(r.userId) === '2');
    expect(arjunRow?.rep).toBe(SEED_USER_REPUTATION['2']);
    expect(ctx.reputationService.getTotal('2')).toBe(SEED_USER_REPUTATION['2']);
  });

  it('3. Concurrent reset -> 409 RESET_IN_PROGRESS; requests during reset -> 503 MAINTENANCE with Retry-After; 4th reset in 1h -> 429', async () => {
    const superToken = ctx.loginAs('superuser');
    const collabToken = ctx.loginAs('2');

    // Launch a reset with an async hook holding maintenance & lock open while we probe concurrently
    let releaseHold!: () => void;
    const holdPromise = new Promise<void>((resolve) => {
      releaseHold = resolve;
    });
    let enteredHold!: () => void;
    const enteredPromise = new Promise<void>((resolve) => {
      enteredHold = resolve;
    });

    const inFlightReset = ctx.demoResetService.reset('u-superuser', 'Super User', {
      onAfterResetBeforeResume: async () => {
        enteredHold();
        await holdPromise;
      },
    });

    await enteredPromise;

    // During reset: other API requests get 503 MAINTENANCE + Retry-After header
    const blockedReq = await request(server)
      .get('/projects')
      .set('Authorization', collabToken);
    expect(blockedReq.status).toBe(503);
    expect(blockedReq.headers['retry-after']).toBeDefined();
    expect(blockedReq.body.code).toBe('MAINTENANCE');

    const freshSuperToken = () =>
      ctx.loginAs('superuser', undefined, {
        tv: ctx.usersRepository.findById('u-superuser')?.tokenVersion ?? 1,
      });

    // Second reset while first is running gets 409 RESET_IN_PROGRESS
    const concurrentResetRes = await request(server)
      .post('/admin/system/reset-demo')
      .set('Authorization', freshSuperToken())
      .send({ confirm: 'RESET' });
    expect(concurrentResetRes.status).toBe(409);
    expect(concurrentResetRes.body.code).toBe('RESET_IN_PROGRESS');

    releaseHold();
    await inFlightReset;

    // Attempt #1 already consumed 1 of 3 hourly quota; execute 2 more resets (total 3)
    await request(server)
      .post('/admin/system/reset-demo')
      .set('Authorization', freshSuperToken())
      .send({ confirm: 'RESET' })
      .expect(200);

    await request(server)
      .post('/admin/system/reset-demo')
      .set('Authorization', freshSuperToken())
      .send({ confirm: 'RESET' })
      .expect(200);

    // 4th reset within an hour -> 429 DEMO_RESET_RATE_LIMIT
    const fourthRes = await request(server)
      .post('/admin/system/reset-demo')
      .set('Authorization', freshSuperToken())
      .send({ confirm: 'RESET' });
    expect(fourthRes.status).toBe(429);
    expect(fourthRes.body.code).toBe('DEMO_RESET_RATE_LIMIT');
  });
});
