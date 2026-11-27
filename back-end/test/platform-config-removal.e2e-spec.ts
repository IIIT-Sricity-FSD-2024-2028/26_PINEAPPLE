import request from 'supertest';
import { createTestApp, TestAppContext } from './helpers/test-helpers';

describe('Platform Config Partial Update & Demo Reset Removal (E2E)', () => {
  let ctx: TestAppContext;
  let server: any;

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.app.getHttpServer();
  });

  beforeEach(() => {
    ctx.resetStores();
    ctx.platformConfigService.resetToSeed();
  });

  afterAll(async () => {
    if (ctx?.app) {
      await ctx.app.close();
    }
  });

  it('1. Keeps startup seeding intact and preserves stored xpPerTaskCompletion when PUT /admin/config omits it', async () => {
    const superToken = ctx.loginAs('superuser', ['*']);

    // Startup seeds still present
    expect(ctx.usersRepository.findAll().length).toBeGreaterThanOrEqual(8);
    expect(ctx.projectsRepository.findAll().length).toBeGreaterThanOrEqual(5);
    expect(ctx.tasksRepository.findAll().length).toBeGreaterThanOrEqual(5);
    expect(ctx.platformConfigService.getConfig().xpPerTaskCompletion).toBe(50);

    // Seed custom stored XP config value, then update config WITHOUT xpPerTaskCompletion
    const setXpRes = await request(server)
      .put('/admin/config')
      .set('Authorization', superToken)
      .send({ xpPerTaskCompletion: 75 });
    expect(setXpRes.status).toBe(200);
    expect(setXpRes.body.xpPerTaskCompletion).toBe(75);

    const partialRes = await request(server)
      .put('/admin/config')
      .set('Authorization', superToken)
      .send({
        maxProjectsPerUser: 12,
        maxCollaboratorsPerProject: 25,
        mentorMinYearsExperience: 6,
        minimumTenure: 6,
        maintenanceMode: false,
        platformVersion: '1.4.2',
      });
    expect(partialRes.status).toBe(200);
    expect(partialRes.body.maxProjectsPerUser).toBe(12);
    expect(partialRes.body.xpPerTaskCompletion).toBe(75);

    const getRes = await request(server)
      .get('/admin/config')
      .set('Authorization', superToken);
    expect(getRes.status).toBe(200);
    expect(getRes.body.xpPerTaskCompletion).toBe(75);
  });

  it('2. Awards task approval XP normally while platform config omits XP input', async () => {
    const ownerToken = ctx.loginAs('1');
    const collabToken = ctx.loginAs('2');

    const proj = ctx.projectsService.create('1', {
      title: 'XP Preservation Project',
      description:
        'Comprehensive integration test project verifying that task approval still awards canonical XP when the XP yield config input is removed.',
      teamSize: 3,
      dueDate: '2026-12-30T00:00:00.000Z',
    });
    ctx.projectsService.addCollaborator(proj.id, { id: '2', name: 'Arjun Sharma', role: 'Collaborator' });

    const beforeStats = ctx.gamificationService.getUserStats('2');

    const createTaskRes = await request(server)
      .post('/tasks')
      .set('Authorization', ownerToken)
      .send({
        projectId: proj.id,
        title: 'Medium XP Check Task',
        description: 'Task verifying XP award stays unchanged on approval.',
        priority: 'Medium',
        dueDate: '2026-12-20T00:00:00.000Z',
        assigneeId: '2',
      });
    expect(createTaskRes.status).toBe(201);
    const taskId = createTaskRes.body.id;

    await request(server)
      .patch(`/tasks/${taskId}`)
      .set('Authorization', collabToken)
      .send({ status: 'In Review' })
      .expect(200);

    const approveRes = await request(server)
      .patch(`/tasks/${taskId}`)
      .set('Authorization', ownerToken)
      .send({ status: 'Approved' });
    expect(approveRes.status).toBe(200);

    const afterStats = ctx.gamificationService.getUserStats('2');
    expect(afterStats.totalXp - beforeStats.totalXp).toBe(20);
  });

  it('3. Removed demo reset routes return 404 even for Super User', async () => {
    const superToken = ctx.loginAs('superuser', ['*']);

    const statusRes = await request(server)
      .get('/admin/system/demo-reset-status')
      .set('Authorization', superToken);
    expect(statusRes.status).toBe(404);

    const postRes = await request(server)
      .post('/admin/system/reset-demo')
      .set('Authorization', superToken)
      .send({ confirm: 'RESET' });
    expect(postRes.status).toBe(404);
  });
});
