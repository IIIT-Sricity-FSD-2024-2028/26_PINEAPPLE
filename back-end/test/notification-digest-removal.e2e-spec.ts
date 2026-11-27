import request from 'supertest';
import { createTestApp, TestAppContext } from './helpers/test-helpers';

describe('Notification Digest Removal E2E Tests', () => {
  let ctx: TestAppContext;
  let server: any;

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.app.getHttpServer();
  });

  beforeEach(() => {
    ctx.resetStores();
  });

  afterAll(async () => {
    if (ctx?.app) {
      await ctx.app.close();
    }
  });

  it('GET and PATCH /users/me/settings return no digest fields and ignore unknown digest fields per ValidationPipe policy, while PATCH /users/:id rejects them with 400 FIELD_NOT_ALLOWED', async () => {
    const loginRes = await request(server)
      .post('/auth/login')
      .send({ identifier: 'arjun.sharma@teamforge.io', password: 'password123' })
      .expect(200);

    const token = `Bearer ${loginRes.body.accessToken}`;
    const userId = String(loginRes.body.user.id);

    const getRes = await request(server)
      .get('/users/me/settings')
      .set('Authorization', token)
      .expect(200);
    expect(getRes.body.digestEnabled).toBeUndefined();
    expect(getRes.body.digestHour).toBeUndefined();
    expect(getRes.body.utcOffsetMinutes).toBeUndefined();

    const emptyPatch = await request(server)
      .patch('/users/me/settings')
      .set('Authorization', token)
      .send({})
      .expect(200);
    expect(emptyPatch.body.digestEnabled).toBeUndefined();
    expect(emptyPatch.body.digestHour).toBeUndefined();

    // Unknown digest fields sent to PATCH /users/me/settings are stripped/ignored gracefully
    const legacyPatch = await request(server)
      .patch('/users/me/settings')
      .set('Authorization', token)
      .send({ digestEnabled: true, digestHour: 24, utcOffsetMinutes: 330 })
      .expect(200);
    expect(legacyPatch.body.digestEnabled).toBeUndefined();
    expect(legacyPatch.body.digestHour).toBeUndefined();
    expect(legacyPatch.body.utcOffsetMinutes).toBeUndefined();

    // Self-account update (PATCH /users/:id) rejects unknown/removed fields per SelfAccountUpdateGuard allow-list
    const selfUpdateReject = await request(server)
      .patch(`/users/${userId}`)
      .set('Authorization', token)
      .send({ digestEnabled: false, digestHour: 18 })
      .expect(400);
    expect(selfUpdateReject.body.code).toBe('FIELD_NOT_ALLOWED');
  });

  it('delivers NEW_APPLICANT immediately over HTTP and hourly tick does not run flushNotificationDigests', async () => {
    const ownerLogin = await request(server)
      .post('/auth/login')
      .send({ identifier: 'priya.patel@teamforge.io', password: 'password123' })
      .expect(200);
    const ownerToken = `Bearer ${ownerLogin.body.accessToken}`;

    const collabLogin = await request(server)
      .post('/auth/login')
      .send({ identifier: 'arjun.sharma@teamforge.io', password: 'password123' })
      .expect(200);
    const collabToken = `Bearer ${collabLogin.body.accessToken}`;

    const project = ctx.projectsService.create('1', {
      title: 'Immediate Applicant Project',
      description: 'Collaborative engineering project verifying immediate NEW_APPLICANT notifications without any digest deferral.',
      teamSize: 5,
      dueDate: '2027-06-01T00:00:00.000Z',
    });

    await request(server)
      .post('/join-requests')
      .set('Authorization', collabToken)
      .send({
        projectId: project.id,
        message: 'Excited to contribute to the immediate notification verification.',
      })
      .expect(201);

    const ownerNotifs = await request(server)
      .get('/notifications')
      .set('Authorization', ownerToken)
      .expect(200);

    expect(
      ownerNotifs.body.some(
        (n: any) =>
          (n.type === 'NEW_APPLICANT' || n.type === 'JOIN_REQUEST') &&
          String(n.referenceId) === String(project.id),
      ),
    ).toBe(true);

    const suToken = ctx.loginAs('superuser');
    const tickRes = await request(server)
      .post('/admin/jobs/tick')
      .set('Authorization', suToken);
    expect([200, 201, 202]).toContain(tickRes.status);

    const jobsList = tickRes.body?.jobs || [];
    expect(jobsList.some((j: any) => j.name === 'flushNotificationDigests')).toBe(false);
  });
});
