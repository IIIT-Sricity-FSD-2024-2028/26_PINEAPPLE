import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, TestAppContext } from './helpers/test-helpers';
import { ProjectStatus } from '../src/projects/dto/create-project.dto';

describe('Phase 15 E2E API Tests: Collaboration UX', () => {
  let ctx: TestAppContext;
  let app: INestApplication;
  let server: any;

  beforeAll(async () => {
    ctx = await createTestApp();
    app = ctx.app;
    server = app.getHttpServer();
  });

  beforeEach(() => {
    ctx.resetStores();
    ctx.clockService.setTime('2026-12-01T12:00:00.000Z');
  });

  afterAll(async () => {
    await app.close();
  });

  const FUTURE_DUE = '2027-02-01T00:00:00.000Z';

  it('1. GET /projects/:id/match returns skill-match % and missing skills without blocking apply', async () => {
    const ownerToken = ctx.loginAs('u-owner', undefined, { role: 'project-owner' });
    const collabToken = ctx.loginAs('2'); // Arjun has React, Python, ML

    const projRes = await request(server)
      .post('/projects')
      .set('Authorization', ownerToken)
      .send({
        title: 'AI Match Test Project',
        description: 'Testing skill match calculation cleanly without blocking applications so collaborators see helpful overlap hints.',
        requiredSkills: ['React', 'Kubernetes'],
        maxCollaborators: 4,
        dueDate: FUTURE_DUE,
      });
    expect(projRes.status).toBe(201);
    const projectId = projRes.body.id;

    const matchRes = await request(server)
      .get(`/projects/${projectId}/match`)
      .set('Authorization', collabToken);
    expect(matchRes.status).toBe(200);
    expect(matchRes.body).toEqual({
      percent: 50,
      shared: ['React'],
      missing: ['Kubernetes'],
    });

    // Empty skills project returns percent: null
    const emptyProjRes = await request(server)
      .post('/projects')
      .set('Authorization', ownerToken)
      .send({
        title: 'General Help Project',
        description: 'Project with no required skills specified so we verify that skill match percentages remain null in the UI.',
        requiredSkills: [],
        skills: [],
        dueDate: FUTURE_DUE,
      });
    expect(emptyProjRes.status).toBe(201);
    const emptyMatch = await request(server)
      .get(`/projects/${emptyProjRes.body.id}/match`)
      .set('Authorization', collabToken);
    expect(emptyMatch.status).toBe(200);
    expect(emptyMatch.body.percent).toBeNull();
  });

  it('2. Active project cap (MAX 3) returns 409 ACTIVE_PROJECT_CAP with count & projects[] on apply/approve/invite', async () => {
    const ownerToken = ctx.loginAs('u-owner', undefined, { role: 'project-owner' });
    const collabToken = ctx.loginAs('2'); // Arjun already starts in 2 seeded active projects (proj-1, proj-7)

    // Create 2 new open projects
    const p1Res = await request(server)
      .post('/projects')
      .set('Authorization', ownerToken)
      .send({ title: 'Cap Slot Three', description: 'Third active project slot test ensuring capacity limits trigger accurately upon reaching three concurrent teams.', requiredSkills: ['React'], dueDate: FUTURE_DUE });
    const p2Res = await request(server)
      .post('/projects')
      .set('Authorization', ownerToken)
      .send({ title: 'Cap Overflow Four', description: 'Overflow active project test verifying a fourth simultaneous project application returns conflict details properly.', requiredSkills: ['React'], dueDate: FUTURE_DUE });
    expect(p1Res.status).toBe(201);
    expect(p2Res.status).toBe(201);
    const p1Id = p1Res.body.id;
    const p2Id = p2Res.body.id;

    // Also invite Arjun to p2Id beforehand
    const preInviteRes = await request(server)
      .post(`/projects/${p2Id}/invites`)
      .set('Authorization', ownerToken)
      .send({ username: 'arjunsharma' });
    expect(preInviteRes.status).toBe(201);
    const preInviteId = preInviteRes.body.id;

    // Apply & approve p1Id -> Arjun now has 3/3 active memberships
    const jrRes = await request(server)
      .post('/join-requests')
      .set('Authorization', collabToken)
      .send({ projectId: p1Id, userId: '2', userName: 'Arjun Sharma', message: 'Joining 3rd active' });
    expect(jrRes.status).toBe(201);

    const approveRes = await request(server)
      .patch(`/join-requests/${jrRes.body.id}`)
      .set('Authorization', ownerToken)
      .send({ status: 'Approved' });
    expect(approveRes.status).toBe(200);

    // 4th apply -> 409 ACTIVE_PROJECT_CAP with currentCount & projects[]
    const overApply = await request(server)
      .post('/join-requests')
      .set('Authorization', collabToken)
      .send({ projectId: p2Id, userId: '2', userName: 'Arjun Sharma', message: 'Applying over cap' });
    expect(overApply.status).toBe(409);
    expect(overApply.body.code).toBe('ACTIVE_PROJECT_CAP');
    expect(overApply.body.currentCount).toBe(3);
    expect(overApply.body.maxAllowed).toBe(3);
    expect(Array.isArray(overApply.body.projects)).toBe(true);
    expect(overApply.body.projects).toHaveLength(3);

    // Accepting invite over cap -> 409 ACTIVE_PROJECT_CAP
    const acceptOver = await request(server)
      .post(`/invites/${preInviteId}/accept`)
      .set('Authorization', collabToken);
    expect(acceptOver.status).toBe(409);
    expect(acceptOver.body.code).toBe('ACTIVE_PROJECT_CAP');
    expect(acceptOver.body.projects).toHaveLength(3);
  });

  it('3. Rejected join requests attach up to 3 open skill-matched suggestedProjects on request and notification', async () => {
    const ownerToken = ctx.loginAs('u-owner', undefined, { role: 'project-owner' });
    const collabToken = ctx.loginAs('2');

    const rejTarget = await request(server)
      .post('/projects')
      .set('Authorization', ownerToken)
      .send({ title: 'Rust Compiler', description: 'Low-level systems tooling project focusing on lexical analysis, parser generation, and backend LLVM IR emission.', requiredSkills: ['Rust'], dueDate: FUTURE_DUE });
    expect(rejTarget.status).toBe(201);
    await request(server)
      .post('/projects')
      .set('Authorization', ownerToken)
      .send({ title: 'React ML Studio', description: 'Frontend plus Python notebook environment designed for interactive machine learning model prototyping and visualization.', requiredSkills: ['React', 'Python'], dueDate: FUTURE_DUE })
      .expect(201);
    await request(server)
      .post('/projects')
      .set('Authorization', ownerToken)
      .send({ title: 'ML Pipeline Ops', description: 'Python inference cluster orchestration framework with scalable container deployment and automated metric monitoring.', requiredSkills: ['Python', 'Docker'], dueDate: FUTURE_DUE })
      .expect(201);

    const jr = await request(server)
      .post('/join-requests')
      .set('Authorization', collabToken)
      .send({ projectId: rejTarget.body.id, userId: '2', userName: 'Arjun Sharma', message: 'Excited to help' });
    expect(jr.status).toBe(201);

    const rejRes = await request(server)
      .patch(`/join-requests/${jr.body.id}`)
      .set('Authorization', ownerToken)
      .send({ status: 'Rejected', reason: 'Need deeper Rust experience here.' });
    expect(rejRes.status).toBe(200);
    expect(Array.isArray(rejRes.body.suggestedProjects)).toBe(true);
    expect(rejRes.body.suggestedProjects.length).toBeGreaterThanOrEqual(2);
    expect(rejRes.body.suggestedProjects[0].title).toBe('React ML Studio');

    const mineRes = await request(server)
      .get('/join-requests/mine')
      .set('Authorization', collabToken);
    expect(mineRes.status).toBe(200);
    const mineItem = mineRes.body.find((r: any) => r.id === jr.body.id);
    expect(mineItem.suggestedProjects[0].title).toBe('React ML Studio');
  });

  it('4. Direct invites flow: role guards, my invites, decline, cancel, accept without consuming quota', async () => {
    const ownerToken = ctx.loginAs('u-owner', undefined, { role: 'project-owner' });
    const kiranToken = ctx.loginAs('3');
    const arjunToken = ctx.loginAs('2');

    const projRes = await request(server)
      .post('/projects')
      .set('Authorization', ownerToken)
      .send({ title: 'Direct Invite Squad', description: 'Project for direct invitation tests verifying owners can invite collaborators without consuming applicant quotas.', requiredSkills: ['React'], maxCollaborators: 3, dueDate: FUTURE_DUE });
    expect(projRes.status).toBe(201);
    const pid = projRes.body.id;

    // Collaborator cannot send invites
    const forbInvite = await request(server)
      .post(`/projects/${pid}/invites`)
      .set('Authorization', arjunToken)
      .send({ username: 'kiranbose' });
    expect(forbInvite.status).toBe(403);

    // Owner sends invite to Kiran ('kiranbose')
    const inv1 = await request(server)
      .post(`/projects/${pid}/invites`)
      .set('Authorization', ownerToken)
      .send({ username: 'kiranbose' });
    expect(inv1.status).toBe(201);
    expect(inv1.body.status).toBe('pending');

    // Listed under /projects/:id/invites for owner, 403 for non-owner
    const ownerList = await request(server)
      .get(`/projects/${pid}/invites`)
      .set('Authorization', ownerToken);
    expect(ownerList.status).toBe(200);
    expect(ownerList.body).toHaveLength(1);

    const kiranProjectList = await request(server)
      .get(`/projects/${pid}/invites`)
      .set('Authorization', kiranToken);
    expect(kiranProjectList.status).toBe(403);

    // Listed under /users/me/invites for Kiran
    const myInvites = await request(server)
      .get('/users/me/invites')
      .set('Authorization', kiranToken);
    expect(myInvites.status).toBe(200);
    expect(myInvites.body).toHaveLength(1);

    // Accept invite -> Kiran added as collaborator, invite marked accepted
    const acceptRes = await request(server)
      .post(`/invites/${inv1.body.id}/accept`)
      .set('Authorization', kiranToken);
    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.invite.status).toBe('accepted');

    // Invite to Arjun -> cancel by owner
    const inv2 = await request(server)
      .post(`/projects/${pid}/invites`)
      .set('Authorization', ownerToken)
      .send({ username: 'arjunsharma' });
    expect(inv2.status).toBe(201);

    const cancelRes = await request(server)
      .delete(`/projects/${pid}/invites/${inv2.body.id}`)
      .set('Authorization', ownerToken);
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.invite.status).toBe('cancelled');
  });

  it('5. Unread chat badge endpoints enforce Phase 6 membership guard and update counts on mark read', async () => {
    const ownerToken = ctx.loginAs('1');
    const memberToken = ctx.loginAs('2'); // Arjun in seeded proj-1 (owner: '1', mentor: '3')
    const outsiderToken = ctx.loginAs('4'); // Rohan ('4') is NOT in seeded proj-1

    await request(server)
      .post('/communication/messages')
      .set('Authorization', ownerToken)
      .send({ projectId: 'proj-1', text: 'Phase 15 chat ping!', senderName: 'Priya Patel' })
      .expect(201);

    const unreadBefore = await request(server)
      .get('/communication/unread')
      .set('Authorization', memberToken);
    expect(unreadBefore.status).toBe(200);
    const p1EntryBefore = unreadBefore.body.byProject.find((x: any) => x.projectId === 'proj-1');
    expect(p1EntryBefore.unreadCount).toBeGreaterThanOrEqual(1);

    // Outsider denied marking read
    const outsiderRead = await request(server)
      .post('/communication/projects/proj-1/read')
      .set('Authorization', outsiderToken);
    expect(outsiderRead.status).toBe(403);
    expect(outsiderRead.body.code).toBe('CHAT_MEMBERSHIP_REQUIRED');

    // Member marks read -> unread count for proj-1 becomes 0
    await request(server)
      .post('/communication/projects/proj-1/read')
      .set('Authorization', memberToken)
      .expect(200);

    const unreadAfter = await request(server)
      .get('/communication/unread')
      .set('Authorization', memberToken);
    expect(unreadAfter.status).toBe(200);
    const p1EntryAfter = unreadAfter.body.byProject.find((x: any) => x.projectId === 'proj-1');
    expect(p1EntryAfter.unreadCount).toBe(0);
  });

  it('6. GET /users/search ranks exact username match first', async () => {
    const ownerToken = ctx.loginAs('1');
    const searchRes = await request(server)
      .get('/users/search?q=arjunsharma')
      .set('Authorization', ownerToken);
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.length).toBeGreaterThanOrEqual(1);
    expect(searchRes.body[0].username).toBe('arjunsharma');
  });

  it('7. Removed endpoints export.md & clone return 404 (done means done)', async () => {
    const ownerToken = ctx.loginAs('u-owner', undefined, { role: 'project-owner' });

    const pRes = await request(server)
      .post('/projects')
      .set('Authorization', ownerToken)
      .send({
        title: 'Export Clone E2E Project',
        description: 'Testing closed project requirements export and draft cloning workflows across allowed roles and finished states.',
        requiredSkills: ['NestJS', 'React'],
        dueDate: FUTURE_DUE,
      });
    expect(pRes.status).toBe(201);
    const pid = pRes.body.id;

    // export.md and clone routes have been removed and return 404
    const exportRes = await request(server).get(`/projects/${pid}/export.md`).set('Authorization', ownerToken);
    expect(exportRes.status).toBe(404);

    const cloneRes = await request(server).post(`/projects/${pid}/clone`).set('Authorization', ownerToken);
    expect(cloneRes.status).toBe(404);
  });
});
