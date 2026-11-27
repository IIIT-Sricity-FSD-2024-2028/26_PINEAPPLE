import request from 'supertest';
import { createTestApp, TestAppContext } from './helpers/test-helpers';

describe('Full Project Invite Capacity Enforcement (E2E)', () => {
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

  function createFullProjectWithTwoMembers() {
    const proj = ctx.projectsService.create('1', {
      title: 'Full Capacity Project',
      description:
        'Detailed project description exceeding one hundred characters to verify full project invitation refusal and recovery.',
      dueDate: '2027-06-01T00:00:00.000Z',
      teamSize: 2,
      maxCollaborators: 2,
      mentorId: '3',
      mentor: 'Kiran Bose',
    });
    ctx.projectsService.addCollaborator(proj.id, {
      id: '2',
      name: 'Arjun Sharma',
      role: 'Collaborator',
    });
    ctx.projectsService.addCollaborator(proj.id, {
      id: '8',
      name: 'Vikram Nair',
      role: 'Collaborator',
    });
    return proj;
  }

  it('1. POST invite on a full project returns 409 PROJECT_FULL and creates no invite, notification, or audit entry', async () => {
    const ownerToken = ctx.loginAs('1');
    const proj = createFullProjectWithTwoMembers();

    const beforeInvites = ctx.projectInvitesService.findByProjectId(proj.id).length;
    const beforeNotifs = ctx.notificationsService.findByUser('6').length;
    const beforeAudit = ctx.auditService.findAll().length;

    const res = await request(server)
      .post(`/projects/${proj.id}/invites`)
      .set('Authorization', ownerToken)
      .send({ username: 'adityasai' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PROJECT_FULL');
    expect(res.body.message).toBe(
      'Your team is full. Increase the collaborator limit in project settings, or remove a collaborator, to invite more people.',
    );

    expect(ctx.projectInvitesService.findByProjectId(proj.id).length).toBe(beforeInvites);
    expect(ctx.notificationsService.findByUser('6').length).toBe(beforeNotifs);
    const afterAudit = ctx.auditService.findAll();
    expect(afterAudit.length).toBe(beforeAudit);
  });

  it('2. Order of checks: non-owner invites return 403 even when project is full, and already-member returns ALREADY_MEMBER before PROJECT_FULL', async () => {
    const nonOwnerToken = ctx.loginAs('2');
    const ownerToken = ctx.loginAs('1');
    const proj = createFullProjectWithTwoMembers();

    const nonOwnerRes = await request(server)
      .post(`/projects/${proj.id}/invites`)
      .set('Authorization', nonOwnerToken)
      .send({ username: 'adityasai' });
    expect(nonOwnerRes.status).toBe(403);
    expect(nonOwnerRes.body.code).toBe('FORBIDDEN');

    const alreadyMemberRes = await request(server)
      .post(`/projects/${proj.id}/invites`)
      .set('Authorization', ownerToken)
      .send({ username: 'arjunsharma' });
    expect(alreadyMemberRes.status).toBe(409);
    expect(alreadyMemberRes.body.code).toBe('ALREADY_MEMBER');
  });

  it('3. Raising the collaborator limit immediately allows inviting again', async () => {
    const ownerToken = ctx.loginAs('1');
    const proj = createFullProjectWithTwoMembers();

    const blockedRes = await request(server)
      .post(`/projects/${proj.id}/invites`)
      .set('Authorization', ownerToken)
      .send({ username: 'adityasai' });
    expect(blockedRes.status).toBe(409);

    const raiseRes = await request(server)
      .patch(`/projects/${proj.id}`)
      .set('Authorization', ownerToken)
      .send({ teamSize: 3, dueDate: '2027-06-01T00:00:00.000Z' });
    expect(raiseRes.status).toBe(200);
    expect(raiseRes.body.maxCollaborators).toBe(3);

    const allowedRes = await request(server)
      .post(`/projects/${proj.id}/invites`)
      .set('Authorization', ownerToken)
      .send({ username: 'adityasai' });
    expect(allowedRes.status).toBe(201);
    expect(allowedRes.body.status).toBe('pending');
  });

  it('4. Removing a collaborator immediately frees a seat and allows inviting again', async () => {
    const ownerToken = ctx.loginAs('1');
    const proj = createFullProjectWithTwoMembers();

    const blockedRes = await request(server)
      .post(`/projects/${proj.id}/invites`)
      .set('Authorization', ownerToken)
      .send({ username: 'adityasai' });
    expect(blockedRes.status).toBe(409);

    const removeRes = await request(server)
      .delete(`/projects/${proj.id}/members/8`)
      .set('Authorization', ownerToken)
      .send({ reason: 'Collaborator stepped away from the sprint.' });
    expect(removeRes.status).toBe(200);

    const allowedRes = await request(server)
      .post(`/projects/${proj.id}/invites`)
      .set('Authorization', ownerToken)
      .send({ username: 'adityasai' });
    expect(allowedRes.status).toBe(201);
    expect(allowedRes.body.status).toBe('pending');
  });

  it('5. Approved leave request immediately frees a seat and allows inviting again', async () => {
    const ownerToken = ctx.loginAs('1');
    const collabToken = ctx.loginAs('2');
    const proj = createFullProjectWithTwoMembers();

    const blockedRes = await request(server)
      .post(`/projects/${proj.id}/invites`)
      .set('Authorization', ownerToken)
      .send({ username: 'adityasai' });
    expect(blockedRes.status).toBe(409);

    const leaveCreateRes = await request(server)
      .post(`/projects/${proj.id}/leave-requests`)
      .set('Authorization', collabToken)
      .send({
        reasons: ['OTHER'],
        explanation: 'Stepping back due to coursework schedule changes.',
      });
    expect(leaveCreateRes.status).toBe(201);

    const approveLeaveRes = await request(server)
      .post(`/projects/${proj.id}/leave-requests/${leaveCreateRes.body.id}/approve`)
      .set('Authorization', ownerToken)
      .send({});
    expect(approveLeaveRes.status).toBe(201);

    const allowedRes = await request(server)
      .post(`/projects/${proj.id}/invites`)
      .set('Authorization', ownerToken)
      .send({ username: 'adityasai' });
    expect(allowedRes.status).toBe(201);
    expect(allowedRes.body.status).toBe('pending');
  });

  it('6. Pending invitations do not count as used seats, and only one invitee can accept the last open seat', async () => {
    const ownerToken = ctx.loginAs('1');
    const tokenAditya = ctx.loginAs('6');
    const tokenNeha = ctx.loginAs('7');

    // Limit 3, two active members -> 1 free seat
    const proj = ctx.projectsService.create('1', {
      title: 'Three Seat Pending Invite Test',
      description:
        'Verifies that pending invitations do not reserve seats and racing acceptors respect the team capacity.',
      dueDate: '2027-06-01T00:00:00.000Z',
      teamSize: 3,
      maxCollaborators: 3,
    });
    ctx.projectsService.addCollaborator(proj.id, {
      id: '2',
      name: 'Arjun Sharma',
      role: 'Collaborator',
    });
    ctx.projectsService.addCollaborator(proj.id, {
      id: '8',
      name: 'Vikram Nair',
      role: 'Collaborator',
    });

    // Send first pending invite while 2/3 used -> allowed
    const inv1Res = await request(server)
      .post(`/projects/${proj.id}/invites`)
      .set('Authorization', ownerToken)
      .send({ username: 'adityasai' });
    expect(inv1Res.status).toBe(201);

    // Send second pending invite while still 2/3 used -> pending invites don't count as used seats -> allowed
    const inv2Res = await request(server)
      .post(`/projects/${proj.id}/invites`)
      .set('Authorization', ownerToken)
      .send({ username: 'nehagupta' });
    expect(inv2Res.status).toBe(201);

    // Both try to accept the single free seat
    const [acc1, acc2] = await Promise.all([
      request(server)
        .post(`/invites/${inv1Res.body.id}/accept`)
        .set('Authorization', tokenAditya)
        .send({}),
      request(server)
        .post(`/invites/${inv2Res.body.id}/accept`)
        .set('Authorization', tokenNeha)
        .send({}),
    ]);

    const statuses = [acc1.status, acc2.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 409]);
    const rejected = acc1.status === 409 ? acc1 : acc2;
    expect(rejected.body.code).toBe('PROJECT_FULL');
  });

  it('7. Apply and approve capacity checks continue to return 409 PROJECT_FULL using the shared helper', async () => {
    const ownerToken = ctx.loginAs('1');
    const tokenAditya = ctx.loginAs('6');
    const tokenNeha = ctx.loginAs('7');

    // Create 1-seat project -> open initially
    const proj = ctx.projectsService.create('1', {
      title: 'Apply and Approve Capacity Check',
      description:
        'Testing that both join request creation and approval enforce shared team capacity checks accurately.',
      dueDate: '2027-06-01T00:00:00.000Z',
      teamSize: 1,
      maxCollaborators: 1,
    });

    // Two users apply while seat is open
    const app1Res = await request(server)
      .post('/join-requests')
      .set('Authorization', tokenAditya)
      .send({ projectId: proj.id, userName: 'Aditya Sai', role: 'Frontend' });
    expect(app1Res.status).toBe(201);

    const app2Res = await request(server)
      .post('/join-requests')
      .set('Authorization', tokenNeha)
      .send({ projectId: proj.id, userName: 'Neha Gupta', role: 'Backend' });
    expect(app2Res.status).toBe(201);

    // Owner approves first applicant -> fills the 1/1 seat
    const approve1 = await request(server)
      .patch(`/join-requests/${app1Res.body.id}`)
      .set('Authorization', ownerToken)
      .send({ status: 'Approved' });
    expect(approve1.status).toBe(200);

    // New applicant applying to full project -> 409 PROJECT_FULL
    const tokenRohan = ctx.loginAs('4');
    const applyFull = await request(server)
      .post('/join-requests')
      .set('Authorization', tokenRohan)
      .send({ projectId: proj.id, userName: 'Rohan Mehta', role: 'Design' });
    expect(applyFull.status).toBe(409);
    expect(applyFull.body.code).toBe('PROJECT_FULL');

    // Reopen second application manually to test approve check while full if needed,
    // or create a fresh 2-seat project, approve one while another is pending, fill the last via invite, then approve pending
    const proj2 = ctx.projectsService.create('1', {
      title: 'Approve Capacity Check Project',
      description:
        'Second test project verifying that approving an open join request on a full project returns 409 PROJECT_FULL.',
      dueDate: '2027-06-01T00:00:00.000Z',
      teamSize: 2,
      maxCollaborators: 2,
    });
    const reqPending = await request(server)
      .post('/join-requests')
      .set('Authorization', tokenRohan)
      .send({ projectId: proj2.id, userName: 'Rohan Mehta', role: 'Design' });
    expect(reqPending.status).toBe(201);

    // Fill all 2 seats directly (without going through joinRequests approve closure)
    ctx.projectsService.addCollaborator(proj2.id, { id: '2', name: 'Arjun Sharma', role: 'Collaborator' });
    ctx.projectsService.addCollaborator(proj2.id, { id: '8', name: 'Vikram Nair', role: 'Collaborator' });

    const approveWhenFull = await request(server)
      .patch(`/join-requests/${reqPending.body.id}`)
      .set('Authorization', ownerToken)
      .send({ status: 'Approved' });
    expect(approveWhenFull.status).toBe(409);
    expect(approveWhenFull.body.code).toBe('PROJECT_FULL');
  });

  it('8. Raising limit then lowering below active members is refused with 409 TEAM_SIZE_BELOW_MEMBERS', async () => {
    const ownerToken = ctx.loginAs('1');
    const proj = createFullProjectWithTwoMembers();

    const raiseRes = await request(server)
      .patch(`/projects/${proj.id}`)
      .set('Authorization', ownerToken)
      .send({ teamSize: 4, dueDate: '2027-06-01T00:00:00.000Z' });
    expect(raiseRes.status).toBe(200);

    const lowerRes = await request(server)
      .patch(`/projects/${proj.id}`)
      .set('Authorization', ownerToken)
      .send({ teamSize: 1, dueDate: '2027-06-01T00:00:00.000Z' });
    expect(lowerRes.status).toBe(409);
    expect(lowerRes.body.code).toBe('TEAM_SIZE_BELOW_MEMBERS');
  });
});
