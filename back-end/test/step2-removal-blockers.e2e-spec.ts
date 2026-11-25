import request from 'supertest';
import { createTestApp, TestAppContext } from './helpers/test-helpers';
import { AuditService } from '../src/audit/audit.service';

describe('STEP 2 E2E: Owner Cannot Remove Collaborator With Task In Review', () => {
  let ctx: TestAppContext;
  let server: any;
  let auditService: AuditService;

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.app.getHttpServer();
    auditService = ctx.app.get<AuditService>(AuditService);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(() => {
    ctx.resetStores();
  });

  const validDescription =
    'This is a comprehensive open-source engineering initiative aimed at testing task workflows and collaborator removal rules in TeamForge.';
  const defaultDueDate = new Date(Date.now() + 14 * 86400000).toISOString();

  async function setupProjectWithCollaborator(collabUserId = '2') {
    const ownerToken = ctx.loginAs('1'); // Priya Patel (Owner)
    const collabToken = ctx.loginAs(collabUserId);

    const projRes = await request(server)
      .post('/projects')
      .set('Authorization', ownerToken)
      .send({
        title: `Removal Guard Project ${collabUserId}`,
        description: validDescription,
        requiredSkills: ['TypeScript', 'Node.js'],
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      })
      .expect(201);
    const projectId = projRes.body.id;

    const joinRes = await request(server)
      .post('/join-requests')
      .set('Authorization', collabToken)
      .send({
        projectId,
        role: 'Collaborator',
        message: 'Interested in working on backend tasks.',
      })
      .expect(201);

    await request(server)
      .put(`/join-requests/${joinRes.body.id}`)
      .set('Authorization', ownerToken)
      .send({ status: 'approved' })
      .expect(200);

    return { projectId, ownerToken, collabToken, collabUserId };
  }

  it('1. removal-check route returns {allowed, blockers, tasksToRelease, tasksKept}', async () => {
    const { projectId, ownerToken, collabToken, collabUserId } = await setupProjectWithCollaborator('2');

    // Initially: no tasks assigned
    const check1 = await request(server)
      .get(`/projects/${projectId}/members/${collabUserId}/removal-check`)
      .set('Authorization', ownerToken)
      .expect(200);

    expect(check1.body.allowed).toBe(true);
    expect(check1.body.blockers).toEqual([]);
    expect(check1.body.tasksToRelease).toEqual([]);
    expect(check1.body.tasksKept).toEqual([]);

    // Create 1 Open task, 1 In Review task, 1 Completed task
    const tOpen = await request(server)
      .post('/tasks')
      .set('Authorization', ownerToken)
      .send({ projectId, title: 'Open Deliverable', status: 'To Do', assigneeId: collabUserId, dueDate: defaultDueDate })
      .expect(201);

    const tReview = await request(server)
      .post('/tasks')
      .set('Authorization', ownerToken)
      .send({ projectId, title: 'Review Deliverable', status: 'To Do', assigneeId: collabUserId, dueDate: defaultDueDate })
      .expect(201);

    await request(server)
      .patch(`/tasks/${tReview.body.id}/status`)
      .set('Authorization', collabToken)
      .send({ status: 'In Review', proofLink: 'https://github.com/teamforge/repo/pull/101' })
      .expect(200);

    const tDone = await request(server)
      .post('/tasks')
      .set('Authorization', ownerToken)
      .send({ projectId, title: 'Done Deliverable', status: 'To Do', assigneeId: collabUserId, dueDate: defaultDueDate })
      .expect(201);

    await request(server)
      .patch(`/tasks/${tDone.body.id}/status`)
      .set('Authorization', collabToken)
      .send({ status: 'In Review', proofLink: 'https://github.com/teamforge/repo/pull/102' })
      .expect(200);

    await request(server)
      .patch(`/tasks/${tDone.body.id}/status`)
      .set('Authorization', ownerToken)
      .send({ status: 'Completed' })
      .expect(200);

    // Call removal-check again
    const check2 = await request(server)
      .get(`/projects/${projectId}/members/${collabUserId}/removal-check`)
      .set('Authorization', ownerToken)
      .expect(200);

    expect(check2.body.allowed).toBe(false);
    expect(check2.body.blockers).toHaveLength(1);
    expect(check2.body.blockers[0].taskId).toBe(tReview.body.id);
    expect(check2.body.blockers[0].title).toBe('Review Deliverable');
    expect(check2.body.tasksToRelease).toHaveLength(1);
    expect(check2.body.tasksToRelease[0].taskId).toBe(tOpen.body.id);
    expect(check2.body.tasksKept).toHaveLength(1);
    expect(check2.body.tasksKept[0].taskId).toBe(tDone.body.id);
  });

  it('2. non-owner cannot call removal-check (403)', async () => {
    const { projectId, collabToken, collabUserId } = await setupProjectWithCollaborator('2');
    const randomUserToken = ctx.loginAs('5'); // Sneha Iyer (non-member)

    // Collaborator cannot check removal of self or others
    await request(server)
      .get(`/projects/${projectId}/members/${collabUserId}/removal-check`)
      .set('Authorization', collabToken)
      .expect(403);

    // Random user cannot check removal
    await request(server)
      .get(`/projects/${projectId}/members/${collabUserId}/removal-check`)
      .set('Authorization', randomUserToken)
      .expect(403);
  });

  it('3. unknown member returns 404 MEMBER_NOT_FOUND', async () => {
    const { projectId, ownerToken } = await setupProjectWithCollaborator('2');

    const res = await request(server)
      .get(`/projects/${projectId}/members/non-existent-user-999/removal-check`)
      .set('Authorization', ownerToken)
      .expect(404);

    expect(res.body.code).toBe('MEMBER_NOT_FOUND');
  });

  it('4. remove with an In Review task returns 409 MEMBER_HAS_TASKS_IN_REVIEW with task list and changes nothing', async () => {
    const { projectId, ownerToken, collabToken, collabUserId } = await setupProjectWithCollaborator('2');

    // Create In Review task
    const tReview = await request(server)
      .post('/tasks')
      .set('Authorization', ownerToken)
      .send({ projectId, title: 'Blocking In Review Task', status: 'To Do', assigneeId: collabUserId, dueDate: defaultDueDate })
      .expect(201);

    await request(server)
      .patch(`/tasks/${tReview.body.id}/status`)
      .set('Authorization', collabToken)
      .send({ status: 'In Review', proofLink: 'https://github.com/teamforge/repo/pull/105' })
      .expect(200);

    // Attempt removal by owner
    const remRes = await request(server)
      .delete(`/projects/${projectId}/members/${collabUserId}`)
      .set('Authorization', ownerToken)
      .send({ reason: 'Attempting to remove collaborator who submitted work' })
      .expect(409);

    expect(remRes.body.code).toBe('MEMBER_HAS_TASKS_IN_REVIEW');
    expect(remRes.body.message).toContain('Review these submitted tasks first: approve them or send them back with feedback');
    expect(remRes.body.blockers).toHaveLength(1);
    expect(remRes.body.blockers[0].taskId).toBe(tReview.body.id);
    expect(remRes.body.blockers[0].title).toBe('Blocking In Review Task');

    // Verify nothing changed:
    // 1. Collaborator is still in project members
    const projRes = await request(server)
      .get(`/projects/${projectId}`)
      .set('Authorization', ownerToken)
      .expect(200);
    const hasCollab = (projRes.body.collaborators || []).some((c: any) =>
      (typeof c === 'string' ? c : (c.id || c.userId)) === collabUserId
    );
    expect(hasCollab).toBe(true);

    // 2. Task is still in In Review and assigned to collaborator
    const taskRes = await request(server)
      .get(`/tasks/${tReview.body.id}`)
      .set('Authorization', ownerToken)
      .expect(200);
    expect(taskRes.body.status).toBe('In Review');
    expect(String(taskRes.body.assigneeId)).toBe(collabUserId);
  });

  it('5. audit entry MEMBER_REMOVAL_BLOCKED written on blocked removal', async () => {
    const { projectId, ownerToken, collabToken, collabUserId } = await setupProjectWithCollaborator('7');

    const tReview = await request(server)
      .post('/tasks')
      .set('Authorization', ownerToken)
      .send({ projectId, title: 'Audit Test In Review Task', status: 'To Do', assigneeId: collabUserId, dueDate: defaultDueDate })
      .expect(201);

    await request(server)
      .patch(`/tasks/${tReview.body.id}/status`)
      .set('Authorization', collabToken)
      .send({ status: 'In Review', proofLink: 'https://github.com/teamforge/repo/pull/107' })
      .expect(200);

    await request(server)
      .delete(`/projects/${projectId}/members/${collabUserId}`)
      .set('Authorization', ownerToken)
      .send({ reason: 'Attempting to remove collaborator who submitted work' })
      .expect(409);

    const logs = auditService.findAll(100);
    const blockedAudit = logs.find(
      (l) => l.action === 'MEMBER_REMOVAL_BLOCKED' && l.entityId === projectId
    );
    expect(blockedAudit).toBeDefined();
    expect(blockedAudit?.details).toEqual({
      projectId,
      memberId: collabUserId,
      count: 1,
    });
  });

  it('6. after approving the task, remove succeeds', async () => {
    const { projectId, ownerToken, collabToken, collabUserId } = await setupProjectWithCollaborator('5');

    const tReview = await request(server)
      .post('/tasks')
      .set('Authorization', ownerToken)
      .send({ projectId, title: 'Deliverable To Approve', status: 'To Do', assigneeId: collabUserId, dueDate: defaultDueDate })
      .expect(201);

    await request(server)
      .patch(`/tasks/${tReview.body.id}/status`)
      .set('Authorization', collabToken)
      .send({ status: 'In Review', proofLink: 'https://github.com/teamforge/repo/pull/108' })
      .expect(200);

    // Blocked before approval
    await request(server)
      .delete(`/projects/${projectId}/members/${collabUserId}`)
      .set('Authorization', ownerToken)
      .send({ reason: 'Trying to remove before approval' })
      .expect(409);

    // Owner approves task
    await request(server)
      .patch(`/tasks/${tReview.body.id}/status`)
      .set('Authorization', ownerToken)
      .send({ status: 'Completed' })
      .expect(200);

    // Removal pre-check is now allowed
    const check = await request(server)
      .get(`/projects/${projectId}/members/${collabUserId}/removal-check`)
      .set('Authorization', ownerToken)
      .expect(200);
    expect(check.body.allowed).toBe(true);
    expect(check.body.blockers).toHaveLength(0);
    expect(check.body.tasksKept).toHaveLength(1);

    // Removal succeeds
    await request(server)
      .delete(`/projects/${projectId}/members/${collabUserId}`)
      .set('Authorization', ownerToken)
      .send({ reason: 'Removing collaborator whose work was approved' })
      .expect(200);

    // Completed task remains completed with credit
    const tAfter = await request(server)
      .get(`/tasks/${tReview.body.id}`)
      .set('Authorization', ownerToken)
      .expect(200);
    expect(tAfter.body.status).toBe('Completed');
  });

  it('7. after sending back with changes, remove succeeds', async () => {
    const { projectId, ownerToken, collabToken, collabUserId } = await setupProjectWithCollaborator('6');

    const tReview = await request(server)
      .post('/tasks')
      .set('Authorization', ownerToken)
      .send({ projectId, title: 'Deliverable To Send Back', status: 'To Do', assigneeId: collabUserId, dueDate: defaultDueDate })
      .expect(201);

    await request(server)
      .patch(`/tasks/${tReview.body.id}/status`)
      .set('Authorization', collabToken)
      .send({ status: 'In Review', proofLink: 'https://github.com/teamforge/repo/pull/109' })
      .expect(200);

    // Blocked before decision
    await request(server)
      .delete(`/projects/${projectId}/members/${collabUserId}`)
      .set('Authorization', ownerToken)
      .send({ reason: 'Trying to remove before decision' })
      .expect(409);

    // Owner rejects/sends back task
    await request(server)
      .patch(`/tasks/${tReview.body.id}/status`)
      .set('Authorization', ownerToken)
      .send({
        status: 'To Do',
        rejectionReason: 'Please fix edge cases in data parsing logic.',
      })
      .expect(200);

    // Removal pre-check is now allowed
    const check = await request(server)
      .get(`/projects/${projectId}/members/${collabUserId}/removal-check`)
      .set('Authorization', ownerToken)
      .expect(200);
    expect(check.body.allowed).toBe(true);
    expect(check.body.blockers).toHaveLength(0);
    expect(check.body.tasksToRelease).toHaveLength(1);

    // Removal succeeds
    await request(server)
      .delete(`/projects/${projectId}/members/${collabUserId}`)
      .set('Authorization', ownerToken)
      .send({ reason: 'Removing collaborator whose work was rejected' })
      .expect(200);

    // Sent back task is reset to unassigned & open
    const tAfter = await request(server)
      .get(`/tasks/${tReview.body.id}`)
      .set('Authorization', ownerToken)
      .expect(200);
    expect(tAfter.body.assignee).toBe('Unassigned');
  });
});
