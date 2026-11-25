import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, TestAppContext } from './helpers/test-helpers';
import { UserRole, UserStatus } from '../src/users/dto/create-user.dto';

describe('Phase 24 E2E API Tests: Lifecycle Cleanup & Deletion Re-Authentication', () => {
  let ctx: TestAppContext;
  let app: INestApplication;
  let server: any;
  let ownerToken: string;

  const longDesc =
    'A comprehensive E2E test workspace engineered for validating spam caps, seat release on account deletion, and server-side re-auth codes.';

  beforeAll(async () => {
    ctx = await createTestApp();
    app = ctx.app;
    server = app.getHttpServer();
    ownerToken = ctx.loginAs('owner');
  });

  beforeEach(() => {
    ctx.resetStores();
    ctx.clockService.setTime('2026-11-11T10:00:00.000Z');
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Create 3 projects, delete all 3 -> creating a 4th within 24h returns 429 PROJECT_DAILY_LIMIT', async () => {
    const createdIds: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const createRes = await request(server)
        .post('/projects')
        .set('Authorization', ownerToken)
        .send({
          title: `E2E Spam Cap Project ${i}`,
          description: longDesc,
          teamSize: 3,
          dueDate: '2027-03-01T00:00:00.000Z',
        });
      expect(createRes.status).toBe(201);
      createdIds.push(createRes.body.id);

      const delRes = await request(server)
        .delete(`/projects/${createRes.body.id}`)
        .set('Authorization', ownerToken);
      expect(delRes.status).toBe(200);
    }

    const fourthRes = await request(server)
      .post('/projects')
      .set('Authorization', ownerToken)
      .send({
        title: 'E2E Fourth Project Bypass Attempt',
        description: longDesc,
        teamSize: 3,
        dueDate: '2027-03-01T00:00:00.000Z',
      });
    expect(fourthRes.status).toBe(429);
    expect(fourthRes.body.code).toBe('PROJECT_DAILY_LIMIT');
    expect(createdIds).toHaveLength(3);
  });

  it('2. Collaborator joins full project, deletes account -> freed seat accepts a replacement collaborator', async () => {
    const proj = ctx.projectsService.create('1', {
      title: 'Two Seat E2E Workspace',
      description: longDesc,
      teamSize: 2,
      maxCollaborators: 1, // 1 collaborator slot
      dueDate: '2027-03-01T00:00:00.000Z',
    } as any);

    const collab1 = ctx.usersRepository.create({
      name: 'First Seat Collaborator',
      username: 'seat_collab_1',
      email: 'seat1@test.local',
      password: 'DeletePass@123',
      role: UserRole.Collaborator,
      status: UserStatus.Active,
    } as any);
    const collab1Token = ctx.loginAs(collab1.id, [], {
      email: collab1.email,
      role: 'collaborator',
    });

    const collab2 = ctx.usersRepository.create({
      name: 'Second Replacement Collaborator',
      username: 'seat_collab_2',
      email: 'seat2@test.local',
      password: 'DeletePass@123',
      role: UserRole.Collaborator,
      status: UserStatus.Active,
    } as any);
    const collab2Token = ctx.loginAs(collab2.id, [], {
      email: collab2.email,
      role: 'collaborator',
    });

    // Approve collab1 so project reaches full 1/1 collaborator capacity
    const req1Res = await request(server)
      .post('/join-requests')
      .set('Authorization', collab1Token)
      .send({
        projectId: proj.id,
        message: 'I would love to join this workspace and contribute cleanly.',
      });
    expect(req1Res.status).toBe(201);

    const approve1Res = await request(server)
      .patch(`/join-requests/${req1Res.body.id}`)
      .set('Authorization', ownerToken)
      .send({ status: 'Approved' });
    expect(approve1Res.status).toBe(200);

    // Collab2 is blocked with 409 PROJECT_FULL while collab1 holds the 1/1 collaborator seat
    const req2BlockedRes = await request(server)
      .post('/join-requests')
      .set('Authorization', collab2Token)
      .send({
        projectId: proj.id,
        message: 'Applying for seat cleanly and ready to verify after seat release.',
      });
    expect(req2BlockedRes.status).toBe(409);
    expect(req2BlockedRes.body.code).toBe('PROJECT_FULL');

    // Wrong typed username returns 400 USERNAME_MISMATCH
    const badUsernameRes = await request(server)
      .post('/users/me/delete')
      .set('Authorization', collab1Token)
      .send({ username: 'wrong_username' });
    expect(badUsernameRes.status).toBe(400);
    expect(badUsernameRes.body.code).toBe('USERNAME_MISMATCH');

    // Matching typed username deletes collab1 without password and releases the seat
    const delRes = await request(server)
      .post('/users/me/delete')
      .set('Authorization', collab1Token)
      .send({ username: 'seat_collab_1' });
    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);

    // Now replacement collaborator collab2 can apply and be approved into the freed seat
    const req2Res = await request(server)
      .post('/join-requests')
      .set('Authorization', collab2Token)
      .send({
        projectId: proj.id,
        message: 'Applying for the freed seat cleanly after previous member deleted account.',
      });
    expect(req2Res.status).toBe(201);

    const approve2Res = await request(server)
      .patch(`/join-requests/${req2Res.body.id}`)
      .set('Authorization', ownerToken)
      .send({ status: 'Approved' });
    expect(approve2Res.status).toBe(200);
  });

  it('3. Passwordless account deletion HTTP rules: request-code removed (404), body userId ignored, 3/hour 429 rate limit, 200 deletes & revokes token', async () => {
    const social1 = ctx.usersRepository.create({
      name: 'Social E2E User',
      username: 'social_e2e_24',
      email: 'social.e2e24@test.local',
      password: '',
      role: UserRole.Collaborator,
      emailVerified: true,
      status: UserStatus.Active,
    } as any);
    const social1Token = ctx.loginAs(social1.id, [], {
      email: social1.email,
      role: 'collaborator',
    });

    const social2 = ctx.usersRepository.create({
      name: 'Social Target User',
      username: 'social_e2e_target',
      email: 'social.target24@test.local',
      password: 'Password@123',
      role: UserRole.Collaborator,
      emailVerified: true,
      status: UserStatus.Active,
    } as any);
    const social2Token = ctx.loginAs(social2.id, [], {
      email: social2.email,
      role: 'collaborator',
    });

    // Legacy request-code endpoint is removed
    const removedReqCode = await request(server)
      .post('/users/me/delete/request-code')
      .set('Authorization', social1Token)
      .send({});
    expect(removedReqCode.status).toBe(404);

    // Suspended account still refused 403 ACCOUNT_SUSPENDED
    const rawSocial2 = ctx.usersRepository.findById(social2.id)!;
    rawSocial2.status = UserStatus.Suspended;
    await request(server)
      .post('/users/me/delete')
      .set('Authorization', social2Token)
      .send({ username: 'social_e2e_target' })
      .expect(403);
    rawSocial2.status = UserStatus.Active;

    // Attempting to supply another user's id/username in body fails 400 and never deletes target
    for (let i = 1; i <= 3; i++) {
      const spoofRes = await request(server)
        .post('/users/me/delete')
        .set('Authorization', social1Token)
        .send({ id: social2.id, userId: social2.id, username: 'social_e2e_target' });
      expect(spoofRes.status).toBe(400);
      expect(spoofRes.body.code).toBe('USERNAME_MISMATCH');
      expect(ctx.usersRepository.findById(social2.id)?.isDeleted).toBeFalsy();
    }

    // 4th attempt within an hour returns 429
    const rateRes = await request(server)
      .post('/users/me/delete')
      .set('Authorization', social1Token)
      .send({ username: 'social_e2e_24' });
    expect(rateRes.status).toBe(429);
    expect(rateRes.body.code).toBe('DELETE_RATE_LIMIT');

    // After 1 hour window passes, case-insensitive typed username deletes social1 without password or code
    ctx.advanceTime({ hours: 1, ms: 60_000 });
    const okDelRes = await request(server)
      .post('/users/me/delete')
      .set('Authorization', social1Token)
      .send({ username: 'SOCIAL_E2E_24' });
    expect(okDelRes.status).toBe(200);
    expect(okDelRes.body.success).toBe(true);

    // Old token is rejected after deletion
    await request(server).get('/users/me').set('Authorization', social1Token).expect(401);
  });
});
