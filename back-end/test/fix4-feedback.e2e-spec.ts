import request from 'supertest';
import { TaskStatus } from '../src/tasks/dto/create-task.dto';
import { createTestApp, TestAppContext } from './helpers/test-helpers';

describe('FIX 4 E2E: Universal Action Reason and Feedback System', () => {
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

  it('1. GET /feedback/reasons returns all reason categories and action configurations', async () => {
    const userToken = ctx.loginAs('1');
    const res = await request(server)
      .get('/feedback/reasons')
      .set('Authorization', userToken)
      .expect(200);

    expect(res.body).toBeDefined();
    expect(res.body.categories).toBeDefined();
    expect(res.body.actions).toBeDefined();

    // Check categories
    const categories = res.body.categories;
    expect(categories.WORK_REJECTION).toBeDefined();
    expect(categories.COLLAB_DECLINE).toBeDefined();
    expect(categories.APPLICATION_REJECTION).toBeDefined();
    expect(categories.COLLABORATOR_REMOVAL).toBeDefined();
    expect(categories.PROJECT_CANCELLATION).toBeDefined();
    expect(categories.TASK_WITHDRAWAL).toBeDefined();
    expect(categories.MENTORSHIP_REJECTION).toBeDefined();
    expect(categories.MENTORSHIP_CANCELLATION).toBeDefined();
    expect(categories.GENERAL_WITHDRAWAL).toBeDefined();
    expect(categories.INVITATION_CANCELLATION).toBeDefined();

    // Check actions
    const actions = res.body.actions;
    expect(actions.REJECT_APPLICATION).toBeDefined();
    expect(actions.DECLINE_INVITATION).toBeDefined();
    expect(actions.DROP_TASK).toBeDefined();
    expect(actions.REJECT_WORK).toBeDefined();
    expect(actions.REMOVE_COLLABORATOR).toBeDefined();
    expect(actions.LEAVE_PROJECT).toBeDefined();
  });

  it('2. Rejecting join request without reason fails with 400 REASON_REQUIRED; with valid reason succeeds and records history', async () => {
    const ownerToken = ctx.loginAs('1');
    const applicantToken = ctx.loginAs('3');

    // Create project
    const pRes = await request(server)
      .post('/projects')
      .set('Authorization', ownerToken)
      .send({
        title: 'Distributed Neural Engine',
        description: validDescription,
        requiredSkills: ['Python', 'PyTorch'],
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      })
      .expect(201);
    const projectId = pRes.body.id;

    // Apply
    const appRes = await request(server)
      .post('/join-requests')
      .set('Authorization', applicantToken)
      .send({
        projectId,
        role: 'Collaborator',
        message: 'I would love to contribute to this neural engine project.',
      })
      .expect(201);
    const requestId = appRes.body.id;

    // Reject without reason fails with 400
    const failRes = await request(server)
      .put(`/join-requests/${requestId}`)
      .set('Authorization', ownerToken)
      .send({
        status: 'rejected',
        feedback: { reasons: [] },
      })
      .expect(400);

    expect(failRes.body.code || failRes.body.message).toMatch(/REASON_REQUIRED|At least 1 reason/);

    // Reject with valid reason succeeds
    const rejectRes = await request(server)
      .put(`/join-requests/${requestId}`)
      .set('Authorization', ownerToken)
      .send({
        status: 'rejected',
        feedback: {
          reasons: ['REQUIRED_SKILLS_NOT_MATCHED'],
          explanation: 'We require more advanced PyTorch experience for this component.',
        },
      })
      .expect(200);

    expect(rejectRes.body.status).toBe('rejected');

    // Duplicate rejection fails with 400 or 409 (already finalized)
    await request(server)
      .put(`/join-requests/${requestId}`)
      .set('Authorization', ownerToken)
      .send({
        status: 'rejected',
        feedback: { reasons: ['REQUIRED_SKILLS_NOT_MATCHED'] },
      })
      .expect((res) => {
        expect([400, 409]).toContain(res.status);
      });

    // Check feedback history for the application
    const historyRes = await request(server)
      .get(`/feedback?entityType=APPLICATION&entityId=${requestId}`)
      .set('Authorization', ownerToken)
      .expect(200);

    expect(historyRes.body.length).toBe(1);
    expect(historyRes.body[0].actionType).toBe('REJECT_APPLICATION');
    expect(historyRes.body[0].reasons).toEqual(['REQUIRED_SKILLS_NOT_MATCHED']);
    expect(historyRes.body[0].explanation).toBe('We require more advanced PyTorch experience for this component.');
  });

  it('3. Decline & Cancel Invitation require reasons and record feedback history', async () => {
    const ownerToken = ctx.loginAs('1');
    const inviteeToken = ctx.loginAs('3');
    const targetUsername = ctx.usersService.findRawUserById('3')?.username || 'kiranbose';

    // Create project
    const pRes = await request(server)
      .post('/projects')
      .set('Authorization', ownerToken)
      .send({
        title: 'Bioinformatics Pipeline',
        description: validDescription,
        requiredSkills: ['Rust', 'Genomics'],
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      })
      .expect(201);
    const projectId = pRes.body.id;

    // Owner invites user 3
    const inviteRes = await request(server)
      .post(`/projects/${projectId}/invites`)
      .set('Authorization', ownerToken)
      .send({
        username: targetUsername,
        role: 'Collaborator',
        message: 'Please join our genomics pipeline team!',
      })
      .expect(201);
    const inviteId = inviteRes.body.id;

    // Decline without reason fails
    await request(server)
      .post(`/invites/${inviteId}/decline`)
      .set('Authorization', inviteeToken)
      .send({ feedback: { reasons: [] } })
      .expect(400);

    // Decline with valid reason succeeds
    await request(server)
      .post(`/invites/${inviteId}/decline`)
      .set('Authorization', inviteeToken)
      .send({
        feedback: {
          reasons: ['CURRENTLY_UNAVAILABLE'],
          explanation: 'Overloaded with thesis work this month.',
        },
      })
      .expect(200);

    // History is accessible to invitee and owner
    const historyRes = await request(server)
      .get(`/feedback?entityType=INVITE&entityId=${inviteId}`)
      .set('Authorization', inviteeToken)
      .expect(200);

    expect(historyRes.body.length).toBe(1);
    expect(historyRes.body[0].actionType).toBe('DECLINE_INVITATION');
    expect(historyRes.body[0].reasons).toEqual(['CURRENTLY_UNAVAILABLE']);

    // Another invite for cancellation test
    const invite2Res = await request(server)
      .post(`/projects/${projectId}/invites`)
      .set('Authorization', ownerToken)
      .send({
        username: targetUsername,
        role: 'Collaborator',
      })
      .expect(201);
    const invite2Id = invite2Res.body.id;

    // Owner cancels invite with reason
    await request(server)
      .delete(`/projects/${projectId}/invites/${invite2Id}`)
      .set('Authorization', ownerToken)
      .send({
        feedback: {
          reasons: ['ROLE_ALREADY_FILLED'],
          explanation: 'Filled the position internally.',
        },
      })
      .expect(200);

    const cancelHistory = await request(server)
      .get(`/feedback?entityType=INVITE&entityId=${invite2Id}`)
      .set('Authorization', ownerToken)
      .expect(200);

    expect(cancelHistory.body.length).toBe(1);
    expect(cancelHistory.body[0].actionType).toBe('CANCEL_INVITATION');
    expect(cancelHistory.body[0].reasons).toEqual(['ROLE_ALREADY_FILLED']);
  });

  it('4. Dropping a task ALWAYS requires a reason, even >24h before deadline (old 24h exemption strictly removed)', async () => {
    const ownerToken = ctx.loginAs('1');
    const collabToken = ctx.loginAs('3');

    // Create project and add collaborator
    const pRes = await request(server)
      .post('/projects')
      .set('Authorization', ownerToken)
      .send({
        title: 'Aerospace Simulator',
        description: validDescription,
        requiredSkills: ['C++', 'Physics'],
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      })
      .expect(201);
    const projectId = pRes.body.id;

    // Add collaborator directly
    ctx.projectsService.addCollaborator(projectId, { id: '3', name: 'Kiran Bose', role: 'Collaborator' });

    // Create a task with due date 10 days in future (>24 hours)
    const tRes = await request(server)
      .post('/tasks')
      .set('Authorization', ownerToken)
      .send({
        projectId,
        title: 'Implement Aerodynamic Drag Formula',
        description: 'Complete physics implementation for high mach drag coefficient curves.',
        dueDate: new Date(Date.now() + 10 * 86400000).toISOString(),
      })
      .expect(201);
    const taskId = tRes.body.id;

    // Assign task to collaborator 3
    ctx.tasksRepository.update(taskId, { assigneeId: '3' });

    // Collaborator drops task WITHOUT reason -> MUST fail with 400 REASON_REQUIRED
    const dropFailRes = await request(server)
      .post(`/tasks/${taskId}/unassign`)
      .set('Authorization', collabToken)
      .send({})
      .expect(400);

    expect(dropFailRes.body.code || dropFailRes.body.message).toMatch(/REASON_REQUIRED|At least 1 reason/);

    // Collaborator drops task WITH valid reason -> succeeds
    await request(server)
      .post(`/tasks/${taskId}/unassign`)
      .set('Authorization', collabToken)
      .send({
        feedback: {
          reasons: ['INSUFFICIENT_TIME'],
          explanation: 'Exams approaching next week.',
        },
      })
      .expect(200);

    // Check task feedback history
    const taskHistory = await request(server)
      .get(`/feedback?entityType=TASK&entityId=${taskId}`)
      .set('Authorization', ownerToken)
      .expect(200);

    expect(taskHistory.body.length).toBe(1);
    expect(taskHistory.body[0].actionType).toBe('DROP_TASK');
    expect(taskHistory.body[0].reasons).toEqual(['INSUFFICIENT_TIME']);
  });

  it('5. Task Review Rejection (REJECT_WORK / REQUEST_CHANGES) requires 10-500 character explanation', async () => {
    const ownerToken = ctx.loginAs('1');
    const collabToken = ctx.loginAs('3');

    const pRes = await request(server)
      .post('/projects')
      .set('Authorization', ownerToken)
      .send({
        title: 'Robotics Control Library',
        description: validDescription,
        requiredSkills: ['C++', 'ROS'],
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      })
      .expect(201);
    const projectId = pRes.body.id;
    ctx.projectsService.addCollaborator(projectId, { id: '3', name: 'Kiran Bose', role: 'Collaborator' });

    const tRes = await request(server)
      .post('/tasks')
      .set('Authorization', ownerToken)
      .send({
        projectId,
        title: 'Kinematics Solver',
        description: 'Implement inverse kinematics algorithm with convergence checks.',
        dueDate: new Date(Date.now() + 5 * 86400000).toISOString(),
      })
      .expect(201);
    const taskId = tRes.body.id;

    // Assign and mark submitted
    ctx.tasksRepository.update(taskId, { assigneeId: '3', status: TaskStatus.InReview });

    // Review rejection without explanation (<10 chars) -> fails with 400
    await request(server)
      .post(`/tasks/${taskId}/review`)
      .set('Authorization', ownerToken)
      .send({
        decision: 'changes_requested',
        feedback: {
          reasons: ['INCOMPLETE_WORK'],
          explanation: 'fix it', // only 6 chars
        },
      })
      .expect(400);

    // Review rejection with >= 10 chars explanation -> succeeds
    await request(server)
      .post(`/tasks/${taskId}/review`)
      .set('Authorization', ownerToken)
      .send({
        decision: 'changes_requested',
        feedback: {
          reasons: ['INCOMPLETE_WORK'],
          explanation: 'The jacobian matrix singularities are unhandled in 3DOF tests.',
        },
      })
      .expect(200);

    // Check feedback history on the task
    const reviewHistory = await request(server)
      .get(`/feedback?entityType=TASK&entityId=${taskId}`)
      .set('Authorization', collabToken)
      .expect(200);

    expect(reviewHistory.body.length).toBe(1);
    expect(reviewHistory.body[0].actionType).toBe('REQUEST_CHANGES');
    expect(reviewHistory.body[0].reasons).toEqual(['INCOMPLETE_WORK']);
    expect(reviewHistory.body[0].explanation).toBe(
      'The jacobian matrix singularities are unhandled in 3DOF tests.',
    );
  });

  it('6. Feedback visibility enforcement: unrelated users get 403 Forbidden', async () => {
    const ownerToken = ctx.loginAs('1');
    const outsiderToken = ctx.loginAs('2'); // Unrelated user

    const pRes = await request(server)
      .post('/projects')
      .set('Authorization', ownerToken)
      .send({
        title: 'Secret Space Probe',
        description: validDescription,
        requiredSkills: ['Orbital Mechanics'],
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      })
      .expect(201);
    const projectId = pRes.body.id;

    // Outsider tries to read project feedback history
    await request(server)
      .get(`/feedback?entityType=PROJECT&entityId=${projectId}`)
      .set('Authorization', outsiderToken)
      .expect(403);

    // Admin can read feedback history
    const adminToken = ctx.loginAs('u-admin');

    await request(server)
      .get(`/feedback?entityType=PROJECT&entityId=${projectId}`)
      .set('Authorization', adminToken)
      .expect(200);
  });
});
