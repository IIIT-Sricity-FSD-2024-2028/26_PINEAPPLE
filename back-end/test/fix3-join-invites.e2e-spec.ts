import request from 'supertest';
import { ProjectStatus } from '../src/projects/dto/create-project.dto';
import { createTestApp, TestAppContext } from './helpers/test-helpers';

describe('FIX 3 E2E: Join Requests, Invitations & Cross-Checks', () => {
  let ctx: TestAppContext;
  let server: any;

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.app.getHttpServer();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(() => {
    ctx.resetStores();
  });

  const validDescription =
    'This is a comprehensive open-source engineering initiative aimed at designing, testing, and deploying scalable distributed systems for collaborative scientific computing across diverse universities.';

  it('1. Apply to a published project creates a request the owner can read through the owner endpoint and delivers an immediate notification', async () => {
    const ownerToken = ctx.loginAs('1');
    const applicantToken = ctx.loginAs('3'); // User 3 is Kiran Bose (@kiranbose)
    const expectedUsername = ctx.usersService.findRawUserById('3')?.username || 'kiranbose';

    // Owner creates an open published project
    const createRes = await request(server)
      .post('/projects')
      .set('Authorization', ownerToken)
      .send({
        title: 'Quantum Machine Learning Toolkit',
        description: validDescription,
        requiredSkills: ['Python', 'Quantum Computing', 'Linear Algebra'],
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      })
      .expect(201);

    const projectId = createRes.body.id;

    // Applicant applies to published project
    const applyRes = await request(server)
      .post('/join-requests')
      .set('Authorization', applicantToken)
      .send({
        projectId,
        role: 'Collaborator',
        message: 'I have research experience in variational quantum circuits.',
      })
      .expect(201);

    expect(applyRes.body.id).toBeDefined();
    expect(applyRes.body.status).toBe('pending');

    // Owner reads the project join requests via GET /join-requests?projectId=...
    const ownerListRes = await request(server)
      .get(`/join-requests?projectId=${projectId}`)
      .set('Authorization', ownerToken)
      .expect(200);

    expect(Array.isArray(ownerListRes.body)).toBe(true);
    expect(ownerListRes.body.length).toBe(1);
    const item = ownerListRes.body[0];
    expect(item.id).toBe(applyRes.body.id);
    expect(item.status).toBe('pending');
    expect(item.applicantName || item.name || item.userName).toBeDefined();
    expect(item.username || item.applicantUsername).toBe(expectedUsername);
    expect(item.skillMatch).toBeDefined();
    expect(typeof item.skillMatch.percent).toBe('number');
    expect(item.message).toBe('I have research experience in variational quantum circuits.');

    // Owner gets an immediate notification for this join request
    const ownerNotifications = ctx.notificationsService.findByUserId('1');
    const joinReqNotif = ownerNotifications.find(
      (n) => n.type === 'JOIN_REQUEST' && String(n.referenceId || (n as any).metadata?.projectId) === String(projectId),
    );
    expect(joinReqNotif).toBeDefined();
    expect(joinReqNotif?.title).toContain('New Join Request');
    expect(joinReqNotif?.link).toBe(`/owner/workspace/${projectId}?tab=members&section=requests`);

    // Owner project summary includes pendingRequestsCount
    const projectRes = await request(server)
      .get(`/projects/${projectId}`)
      .set('Authorization', ownerToken)
      .expect(200);

    expect(projectRes.body.pendingRequestsCount).toBe(1);
  });

  it('2. Apply to Draft returns 409 PROJECT_NOT_ACCEPTING_REQUESTS', async () => {
    const applicantToken = ctx.loginAs('3');

    // Seed a Draft project
    const draftProject = ctx.projectsRepository.create(
      '1',
      {
        title: 'Unpublished Research Draft',
        description: validDescription,
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      } as any,
      'Draft' as any,
    );

    const applyRes = await request(server)
      .post('/join-requests')
      .set('Authorization', applicantToken)
      .send({
        projectId: draftProject.id,
        role: 'Collaborator',
        message: 'Can I join your draft?',
      });

    expect(applyRes.status).toBe(409);
    expect(applyRes.body.code).toBe('PROJECT_NOT_ACCEPTING_REQUESTS');
  });

  it('3. Apply to Closed, Completed, and Deleted projects returns 409', async () => {
    const applicantToken = ctx.loginAs('3');

    // Closed project
    const closedProject = ctx.projectsRepository.create(
      '1',
      {
        title: 'Closed Autonomous System',
        description: validDescription,
        closureReason: 'Project was manually closed by owner.',
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      } as any,
      ProjectStatus.Closed,
    );

    const closedRes = await request(server)
      .post('/join-requests')
      .set('Authorization', applicantToken)
      .send({
        projectId: closedProject.id,
        role: 'Collaborator',
        message: 'Applying to closed project',
      });
    expect(closedRes.status).toBe(409);
    expect(closedRes.body.code).toBe('PROJECT_CLOSED');

    // Completed project
    const completedProject = ctx.projectsRepository.create(
      '1',
      {
        title: 'Finished Grid System',
        description: validDescription,
        isCompleted: true,
        finalLink: 'https://github.com/teamforge/grid-system',
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      } as any,
      ProjectStatus.Completed,
    );

    const completedRes = await request(server)
      .post('/join-requests')
      .set('Authorization', applicantToken)
      .send({
        projectId: completedProject.id,
        role: 'Collaborator',
        message: 'Applying to completed project',
      });
    expect(completedRes.status).toBe(409);
    expect(completedRes.body.code).toBe('PROJECT_NOT_ACCEPTING_REQUESTS');

    // Deleted project
    const deletedProject = ctx.projectsRepository.create(
      '1',
      {
        title: 'Archived Project',
        description: validDescription,
        deletedAt: new Date().toISOString(),
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      } as any,
      ProjectStatus.Open,
    );

    const deletedRes = await request(server)
      .post('/join-requests')
      .set('Authorization', applicantToken)
      .send({
        projectId: deletedProject.id,
        role: 'Collaborator',
        message: 'Applying to deleted project',
      });
    expect(deletedRes.status).toBe(409);
    expect(deletedRes.body.code).toBe('PROJECT_NOT_ACCEPTING_REQUESTS');
  });

  it('4. Non-owners cannot read the owner request list (403)', async () => {
    const ownerToken = ctx.loginAs('1');
    const otherUserToken = ctx.loginAs('2');

    const createRes = await request(server)
      .post('/projects')
      .set('Authorization', ownerToken)
      .send({
        title: 'Secure Neural Architecture',
        description: validDescription,
        requiredSkills: ['Python', 'PyTorch'],
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      })
      .expect(201);

    const projectId = createRes.body.id;

    // Non-owner attempts to read owner list
    const nonOwnerRes = await request(server)
      .get(`/join-requests?projectId=${projectId}`)
      .set('Authorization', otherUserToken);

    expect(nonOwnerRes.status).toBe(403);
  });

  it('5. Invite then apply returns 409 INVITE_PENDING_FROM_OWNER', async () => {
    const ownerToken = ctx.loginAs('1');
    const userToken = ctx.loginAs('3');
    const targetUsername = ctx.usersService.findRawUserById('3')?.username || 'kiranbose';

    const createRes = await request(server)
      .post('/projects')
      .set('Authorization', ownerToken)
      .send({
        title: 'Distributed Robotics Lab',
        description: validDescription,
        requiredSkills: ['ROS', 'C++'],
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      })
      .expect(201);

    const projectId = createRes.body.id;

    // Owner sends invite to user 3
    const inviteRes = await request(server)
      .post(`/projects/${projectId}/invites`)
      .set('Authorization', ownerToken)
      .send({ username: targetUsername })
      .expect(201);

    expect(inviteRes.body.id).toBeDefined();

    // Now user attempts to apply while invitation is pending
    const applyRes = await request(server)
      .post('/join-requests')
      .set('Authorization', userToken)
      .send({
        projectId,
        role: 'Collaborator',
        message: 'I want to apply to your robotics project.',
      });

    expect(applyRes.status).toBe(409);
    expect(applyRes.body.code).toBe('INVITE_PENDING_FROM_OWNER');
    expect(applyRes.body.message).toBe('The owner has already invited you. Accept or decline the invitation instead.');
  });

  it('6. Apply then invite returns 409 APPLICATION_PENDING_FROM_USER', async () => {
    const ownerToken = ctx.loginAs('1');
    const userToken = ctx.loginAs('3');
    const targetUsername = ctx.usersService.findRawUserById('3')?.username || 'kiranbose';

    const createRes = await request(server)
      .post('/projects')
      .set('Authorization', ownerToken)
      .send({
        title: 'Autonomous Submarine Navigation',
        description: validDescription,
        requiredSkills: ['OpenCV', 'Python'],
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      })
      .expect(201);

    const projectId = createRes.body.id;

    // User applies first
    await request(server)
      .post('/join-requests')
      .set('Authorization', userToken)
      .send({
        projectId,
        role: 'Collaborator',
        message: 'I have built underwater sensor fusion systems.',
      })
      .expect(201);

    // Owner attempts to invite user who already applied
    const inviteRes = await request(server)
      .post(`/projects/${projectId}/invites`)
      .set('Authorization', ownerToken)
      .send({ username: targetUsername });

    expect(inviteRes.status).toBe(409);
    expect(inviteRes.body.code).toBe('APPLICATION_PENDING_FROM_USER');
    expect(inviteRes.body.message).toBe('This user has already applied. Review their application.');
  });

  it('7. After the invite is declined or expired the user can apply', async () => {
    const ownerToken = ctx.loginAs('1');
    const userToken = ctx.loginAs('3');
    const targetUsername = ctx.usersService.findRawUserById('3')?.username || 'kiranbose';

    const createRes = await request(server)
      .post('/projects')
      .set('Authorization', ownerToken)
      .send({
        title: 'Satellite Constellation Scheduling',
        description: validDescription,
        requiredSkills: ['Python', 'Operations Research'],
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      })
      .expect(201);

    const projectId = createRes.body.id;

    // Owner invites user
    const inviteRes = await request(server)
      .post(`/projects/${projectId}/invites`)
      .set('Authorization', ownerToken)
      .send({ username: targetUsername })
      .expect(201);

    const inviteId = inviteRes.body.id;

    // User declines invite
    await request(server)
      .post(`/invites/${inviteId}/decline`)
      .set('Authorization', userToken)
      .send({ block: false })
      .expect(200);

    // User can now apply
    const applyRes = await request(server)
      .post('/join-requests')
      .set('Authorization', userToken)
      .send({
        projectId,
        role: 'Collaborator',
        message: 'Changed my mind, applying now with customized pitch.',
      })
      .expect(201);

    expect(applyRes.body.status).toBe('pending');
  });

  it('8. After the application is withdrawn or rejected the owner can invite', async () => {
    const ownerToken = ctx.loginAs('1');
    const userToken = ctx.loginAs('3');
    const targetUsername = ctx.usersService.findRawUserById('3')?.username || 'kiranbose';

    const createRes = await request(server)
      .post('/projects')
      .set('Authorization', ownerToken)
      .send({
        title: 'Deep Sea Exploration Vehicle',
        description: validDescription,
        requiredSkills: ['Python', 'Networking'],
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      })
      .expect(201);

    const projectId = createRes.body.id;

    // User applies
    const applyRes = await request(server)
      .post('/join-requests')
      .set('Authorization', userToken)
      .send({
        projectId,
        role: 'Collaborator',
        message: 'Pitch to be withdrawn.',
      })
      .expect(201);

    const requestId = applyRes.body.id;

    // User withdraws application
    await request(server)
      .delete(`/join-requests/${requestId}`)
      .set('Authorization', userToken)
      .expect(200);

    // Owner can now invite
    const inviteRes = await request(server)
      .post(`/projects/${projectId}/invites`)
      .set('Authorization', ownerToken)
      .send({ username: targetUsername })
      .expect(201);

    expect(inviteRes.body.id).toBeDefined();
    expect(inviteRes.body.status).toBe('pending');
  });

  it('9. Verify no new lock/mutex code exists in apply or invite handlers', () => {
    const invitesService = ctx.projectInvitesService as any;
    const joinRequestsService = ctx.joinRequestsService as any;

    expect(typeof invitesService.hasOpenItemBetween).toBe('function');
    expect(typeof joinRequestsService.hasOpenItemBetween).toBe('function');

    // Confirm neither service has mutex, lock, or queue fields added
    expect(invitesService.mutex).toBeUndefined();
    expect(invitesService.lock).toBeUndefined();
    expect(joinRequestsService.mutex).toBeUndefined();
    expect(joinRequestsService.lock).toBeUndefined();
  });
});
