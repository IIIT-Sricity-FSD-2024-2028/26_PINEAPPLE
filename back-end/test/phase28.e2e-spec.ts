import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, TestAppContext } from './helpers/test-helpers';

describe('Phase 28 E2E API Tests: Starter Task Templates', () => {
  let ctx: TestAppContext;
  let app: INestApplication;
  let server: any;
  let ownerToken: string;
  let collabToken: string;
  let adminToken: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    app = ctx.app;
    server = app.getHttpServer();

    ownerToken = ctx.loginAs('1', [], { email: 'priya.patel@teamforge.io', role: 'Project Owner' });
    collabToken = ctx.loginAs('2', [], { email: 'arjun.sharma@teamforge.io', role: 'Collaborator' });
    adminToken = ctx.loginAs('admin', ['projects']);
  });

  beforeEach(() => {
    ctx.resetStores();
    ctx.clockService.setTime('2026-11-12T10:00:00.000Z');
    ctx.usersRepository.update('1', { emailVerified: true } as any);
    ctx.usersRepository.update('2', { emailVerified: true } as any);
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. GET /task-templates?category= & GET /projects/:id/task-templates enforce auth + fall back cleanly', async () => {
    // Anonymous refused
    const anonRes = await request(server).get('/task-templates?category=Web%20App');
    expect(anonRes.status).toBe(401);

    // Any logged-in user can preview category templates during project creation
    const collabPreview = await request(server)
      .get('/task-templates?category=Web%20App')
      .set('Authorization', collabToken);
    expect(collabPreview.status).toBe(200);
    expect(collabPreview.body.category).toBe('Web App');
    expect(collabPreview.body.items.length).toBeGreaterThanOrEqual(3);
    expect(collabPreview.body.items.length).toBeLessThanOrEqual(6);

    // Unknown category falls back to General
    const fallbackPreview = await request(server)
      .get('/task-templates?category=NonExistentCategory')
      .set('Authorization', collabToken);
    expect(fallbackPreview.status).toBe(200);
    expect(fallbackPreview.body.category).toBe('General');

    const proj = ctx.projectsService.create('1', {
      title: 'Mobile Template Test Project',
      description: 'Testing owner and admin access to GET /projects/:id/task-templates plus collaborator denial across project endpoints cleanly.',
      category: 'Mobile App',
      dueDate: '2027-06-01T00:00:00.000Z',
    });

    // Owner and Admin allowed
    const ownerRes = await request(server)
      .get(`/projects/${proj.id}/task-templates`)
      .set('Authorization', ownerToken);
    expect(ownerRes.status).toBe(200);
    expect(ownerRes.body.category).toBe('Mobile App');

    const adminRes = await request(server)
      .get(`/projects/${proj.id}/task-templates`)
      .set('Authorization', adminToken);
    expect(adminRes.status).toBe(200);

    // Non-owner collaborator denied
    const collabRes = await request(server)
      .get(`/projects/${proj.id}/task-templates`)
      .set('Authorization', collabToken);
    expect(collabRes.status).toBe(403);
  });

  it('2. Applying 3 starter tasks creates tasks, blocks non-owner, and prevents duplicate applies', async () => {
    const createRes = await request(server)
      .post('/projects')
      .set('Authorization', ownerToken)
      .send({
        title: 'Task Template Impact App',
        description: 'Building a modern collaborative workspace platform with React UI, automated tests, and analytics dashboards.',
        requiredSkills: ['React', 'TypeScript', 'Node.js'],
        duration: '2 months',
        dueDate: '2027-01-05T00:00:00.000Z',
        teamSize: 4,
        category: 'Web App',
      });
    expect(createRes.status).toBe(201);
    const projectId = createRes.body.id;

    // Non-owner and admin cannot apply starter templates (owner only -> 403)
    const tplRes = await request(server)
      .get(`/projects/${projectId}/task-templates`)
      .set('Authorization', ownerToken);
    const keys3 = tplRes.body.items.slice(0, 3).map((t: any) => t.key);

    const collabApply = await request(server)
      .post(`/projects/${projectId}/task-templates/apply`)
      .set('Authorization', collabToken)
      .send({ keys: keys3 });
    expect(collabApply.status).toBe(403);

    const adminApply = await request(server)
      .post(`/projects/${projectId}/task-templates/apply`)
      .set('Authorization', adminToken)
      .send({ keys: keys3 });
    expect(adminApply.status).toBe(403);

    // Owner applies 3 starter tasks -> 201 created
    const applyRes = await request(server)
      .post(`/projects/${projectId}/task-templates/apply`)
      .set('Authorization', ownerToken)
      .send({ keys: keys3 });
    expect(applyRes.status).toBe(201);
    expect(applyRes.body.created).toHaveLength(3);
    expect(applyRes.body.skipped).toHaveLength(0);

    // Applying the exact same 3 keys again returns skipped with TEMPLATE_TASK_EXISTS
    const replayApply = await request(server)
      .post(`/projects/${projectId}/task-templates/apply`)
      .set('Authorization', ownerToken)
      .send({ keys: keys3 });
    expect(replayApply.status).toBe(201);
    expect(replayApply.body.created).toHaveLength(0);
    expect(replayApply.body.skipped).toHaveLength(3);
    expect(replayApply.body.skipped.every((s: any) => s.code === 'TEMPLATE_TASK_EXISTS')).toBe(true);
  });

  it('3. Create project with starterTaskKeys creates tasks immediately, skips unknown keys, and counts in Phase 8 completion rule', async () => {
    const tplRes = await request(server)
      .get('/task-templates?category=Research')
      .set('Authorization', ownerToken);
    const validKey = tplRes.body.items[0].key;

    const createWithStarters = await request(server)
      .post('/projects')
      .set('Authorization', ownerToken)
      .send({
        title: 'AI Citation Study',
        description: 'Empirical study evaluating citation hallucination rates across open research datasets with reproducible scripts.',
        requiredSkills: ['Python', 'Research', 'ML'],
        duration: '2 months',
        dueDate: '2027-01-05T00:00:00.000Z',
        teamSize: 4,
        category: 'Research',
        starterTaskKeys: [validKey, 'unknown-template-key'],
      });

    expect(createWithStarters.status).toBe(201);
    expect(createWithStarters.body.id).toBeTruthy();
    expect(createWithStarters.body.category).toBe('Research');
    expect(createWithStarters.body.starterTasksCreated).toHaveLength(1);
    expect(createWithStarters.body.starterTasksSkipped).toHaveLength(1);
    expect(createWithStarters.body.starterTasksSkipped[0].key).toBe('unknown-template-key');

    // Phase 8 completion rule sees the created Open starter task and refuses completion until approved
    const completeAttempt = await request(server)
      .post(`/projects/${createWithStarters.body.id}/complete`)
      .set('Authorization', ownerToken)
      .send({ finalLink: 'https://github.com/teamforge/study-output' });
    expect([400, 409]).toContain(completeAttempt.status);
    expect(completeAttempt.body.code).toBe('TASKS_NOT_COMPLETED');

    // Verify audit log recorded TEMPLATE_TASKS_ADDED (count only)
    const auditLogs = ctx.auditService.findAll();
    const addedAudit = auditLogs.find((l) => l.action === 'TEMPLATE_TASKS_ADDED');
    expect(addedAudit).toBeDefined();
    expect(addedAudit?.details?.addedCount).toBe(1);
  });
});
