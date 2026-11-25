import request from 'supertest';
import { createTestApp, TestAppContext } from './helpers/test-helpers';

describe('STEP 2 DIAGNOSIS: Owner Cannot Remove Collaborator With Task In Review', () => {
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
    'This is a comprehensive open-source engineering initiative aimed at testing task workflows and collaborator removal rules in TeamForge.';

  const defaultDueDate = new Date(Date.now() + 14 * 86400000).toISOString();

  // Helper to create project & add collaborator
  async function setupProjectWithCollaborator(collabUserId: string) {
    const ownerToken = ctx.loginAs('1'); // Priya Patel
    const collabToken = ctx.loginAs(collabUserId);

    const projRes = await request(server)
      .post('/projects')
      .set('Authorization', ownerToken)
      .send({
        title: `Diagnostic Step 2 Project for User ${collabUserId}`,
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

    return { projectId, ownerToken, collabToken };
  }

  it('Case 1: Collaborator has an OPEN (To Do) task', async () => {
    const c1 = await setupProjectWithCollaborator('2'); // Arjun Sharma
    const t1Res = await request(server)
      .post('/tasks')
      .set('Authorization', c1.ownerToken)
      .send({
        projectId: c1.projectId,
        title: 'Task in To Do status',
        description: 'Collaborator assigned to this open task.',
        status: 'To Do',
        assigneeId: '2',
        dueDate: defaultDueDate,
      })
      .expect(201);
    const t1Id = t1Res.body.id;

    // Owner removes collaborator 2
    const rem1Res = await request(server)
      .delete(`/projects/${c1.projectId}/members/2`)
      .set('Authorization', c1.ownerToken)
      .send({ reason: 'Downsizing team from project' });
    console.log(`[Case 1 Open] Removal status: ${rem1Res.status}`);

    const t1After = await request(server)
      .get(`/tasks/${t1Id}`)
      .set('Authorization', c1.ownerToken);
    console.log(`[Case 1 Open] Task after removal: status = '${t1After.body.status}', assigneeId = '${t1After.body.assigneeId}', assignee = '${t1After.body.assignee}'`);
  });

  it('Case 2: Collaborator has an IN PROGRESS task', async () => {
    const c2 = await setupProjectWithCollaborator('7'); // Neha Gupta
    const t2Res = await request(server)
      .post('/tasks')
      .set('Authorization', c2.ownerToken)
      .send({
        projectId: c2.projectId,
        title: 'Task In Progress',
        description: 'Collaborator working on this task.',
        status: 'To Do',
        assigneeId: '7',
        dueDate: defaultDueDate,
      })
      .expect(201);
    const t2Id = t2Res.body.id;

    await request(server)
      .patch(`/tasks/${t2Id}/status`)
      .set('Authorization', c2.collabToken)
      .send({ status: 'In Progress' })
      .expect(200);

    const rem2Res = await request(server)
      .delete(`/projects/${c2.projectId}/members/7`)
      .set('Authorization', c2.ownerToken)
      .send({ reason: 'Downsizing team from project' });
    console.log(`[Case 2 In Progress] Removal status: ${rem2Res.status}`);

    const t2After = await request(server)
      .get(`/tasks/${t2Id}`)
      .set('Authorization', c2.ownerToken);
    console.log(`[Case 2 In Progress] Task after removal: status = '${t2After.body.status}', assigneeId = '${t2After.body.assigneeId}', assignee = '${t2After.body.assignee}'`);
  });

  it('Case 3: Collaborator has an IN REVIEW task (Submitted work awaiting decision)', async () => {
    const c3 = await setupProjectWithCollaborator('5'); // Sneha Iyer
    const t3Res = await request(server)
      .post('/tasks')
      .set('Authorization', c3.ownerToken)
      .send({
        projectId: c3.projectId,
        title: 'Task In Review',
        description: 'Collaborator submitted work for review.',
        status: 'To Do',
        assigneeId: '5',
        dueDate: defaultDueDate,
      })
      .expect(201);
    const t3Id = t3Res.body.id;

    // Collaborator submits work (moves to In Review)
    await request(server)
      .patch(`/tasks/${t3Id}/status`)
      .set('Authorization', c3.collabToken)
      .send({
        status: 'In Review',
        proofLink: 'https://github.com/teamforge/repo/pull/42',
      })
      .expect(200);

    // Attempt removal by owner
    const rem3Res = await request(server)
      .delete(`/projects/${c3.projectId}/members/5`)
      .set('Authorization', c3.ownerToken)
      .send({ reason: 'Removing collaborator who submitted work' });
    console.log(`[Case 3 In Review] Removal status: ${rem3Res.status} (CURRENTLY ALLOWED!)`);

    const t3After = await request(server)
      .get(`/tasks/${t3Id}`)
      .set('Authorization', c3.ownerToken);
    console.log(`[Case 3 In Review] Task after removal: status = '${t3After.body.status}', assigneeId = '${t3After.body.assigneeId}', proofLink = '${t3After.body.proofLink}'`);
  });

  it('Case 4: Collaborator has an APPROVED (Completed) task', async () => {
    const c4 = await setupProjectWithCollaborator('6'); // Aditya Sai
    const t4Res = await request(server)
      .post('/tasks')
      .set('Authorization', c4.ownerToken)
      .send({
        projectId: c4.projectId,
        title: 'Task to be Approved',
        description: 'Collaborator task that gets approved.',
        status: 'To Do',
        assigneeId: '6',
        dueDate: defaultDueDate,
      })
      .expect(201);
    const t4Id = t4Res.body.id;

    // Submit work
    await request(server)
      .patch(`/tasks/${t4Id}/status`)
      .set('Authorization', c4.collabToken)
      .send({
        status: 'In Review',
        proofLink: 'https://github.com/teamforge/repo/pull/44',
      })
      .expect(200);

    // Owner approves work
    await request(server)
      .patch(`/tasks/${t4Id}/status`)
      .set('Authorization', c4.ownerToken)
      .send({
        status: 'Completed',
      })
      .expect(200);

    // Attempt removal by owner
    const rem4Res = await request(server)
      .delete(`/projects/${c4.projectId}/members/6`)
      .set('Authorization', c4.ownerToken)
      .send({ reason: 'Removing collaborator with completed work' });
    console.log(`[Case 4 Approved] Removal status: ${rem4Res.status}`);

    const t4After = await request(server)
      .get(`/tasks/${t4Id}`)
      .set('Authorization', c4.ownerToken);
    console.log(`[Case 4 Approved] Task after removal: status = '${t4After.body.status}', assigneeId = '${t4After.body.assigneeId}', xpAwarded = ${t4After.body.xpAwarded}`);
  });

  it('Case 5: Collaborator has a task SENT BACK for changes', async () => {
    const c5 = await setupProjectWithCollaborator('3'); // Kiran Bose
    const t5Res = await request(server)
      .post('/tasks')
      .set('Authorization', c5.ownerToken)
      .send({
        projectId: c5.projectId,
        title: 'Task to be rejected/sent back',
        description: 'Collaborator task sent back with feedback.',
        status: 'To Do',
        assigneeId: '3',
        dueDate: defaultDueDate,
      })
      .expect(201);
    const t5Id = t5Res.body.id;

    // Submit work
    await request(server)
      .patch(`/tasks/${t5Id}/status`)
      .set('Authorization', c5.collabToken)
      .send({
        status: 'In Review',
        proofLink: 'https://github.com/teamforge/repo/pull/45',
      })
      .expect(200);

    // Owner rejects / sends back task with feedback
    await request(server)
      .patch(`/tasks/${t5Id}/status`)
      .set('Authorization', c5.ownerToken)
      .send({
        status: 'To Do',
        rejectionReason: 'Please add unit tests and adhere to code style guidelines.',
      })
      .expect(200);

    // Attempt removal by owner
    const rem5Res = await request(server)
      .delete(`/projects/${c5.projectId}/members/3`)
      .set('Authorization', c5.ownerToken)
      .send({ reason: 'Removing collaborator whose work was rejected' });
    console.log(`[Case 5 Sent Back] Removal status: ${rem5Res.status}`);

    const t5After = await request(server)
      .get(`/tasks/${t5Id}`)
      .set('Authorization', c5.ownerToken);
    console.log(`[Case 5 Sent Back] Task after removal: status = '${t5After.body.status}', assigneeId = '${t5After.body.assigneeId}', rejectionReason = '${t5After.body.rejectionReason}'`);
  });

  it('Case 6: Collaborator has a MIX of tasks (In Review + Open + Approved)', async () => {
    const c6 = await setupProjectWithCollaborator('4'); // Rohan Mehta
    // Task 6a: Completed
    const t6aRes = await request(server)
      .post('/tasks')
      .set('Authorization', c6.ownerToken)
      .send({ projectId: c6.projectId, title: 'Mix Task Completed', status: 'To Do', assigneeId: '4', dueDate: defaultDueDate })
      .expect(201);
    await request(server)
      .patch(`/tasks/${t6aRes.body.id}/status`)
      .set('Authorization', c6.collabToken)
      .send({ status: 'In Review', proofLink: 'https://github.com/teamforge/repo/pull/46a' })
      .expect(200);
    await request(server)
      .patch(`/tasks/${t6aRes.body.id}/status`)
      .set('Authorization', c6.ownerToken)
      .send({ status: 'Completed' })
      .expect(200);

    // Task 6b: Open
    const t6bRes = await request(server)
      .post('/tasks')
      .set('Authorization', c6.ownerToken)
      .send({ projectId: c6.projectId, title: 'Mix Task Open', status: 'To Do', assigneeId: '4', dueDate: defaultDueDate })
      .expect(201);

    // Task 6c: In Review
    const t6cRes = await request(server)
      .post('/tasks')
      .set('Authorization', c6.ownerToken)
      .send({ projectId: c6.projectId, title: 'Mix Task In Review', status: 'To Do', assigneeId: '4', dueDate: defaultDueDate })
      .expect(201);
    await request(server)
      .patch(`/tasks/${t6cRes.body.id}/status`)
      .set('Authorization', c6.collabToken)
      .send({ status: 'In Review', proofLink: 'https://github.com/teamforge/repo/pull/46c' })
      .expect(200);

    // Attempt removal
    const rem6Res = await request(server)
      .delete(`/projects/${c6.projectId}/members/4`)
      .set('Authorization', c6.ownerToken)
      .send({ reason: 'Removing collaborator with mixed tasks' });
    console.log(`[Case 6 Mix] Removal status: ${rem6Res.status} (CURRENTLY ALLOWED!)`);

    const t6aAfter = await request(server).get(`/tasks/${t6aRes.body.id}`).set('Authorization', c6.ownerToken);
    const t6bAfter = await request(server).get(`/tasks/${t6bRes.body.id}`).set('Authorization', c6.ownerToken);
    const t6cAfter = await request(server).get(`/tasks/${t6cRes.body.id}`).set('Authorization', c6.ownerToken);
    console.log(`[Case 6 Mix] Completed task status: '${t6aAfter.body.status}', assigneeId: '${t6aAfter.body.assigneeId}'`);
    console.log(`[Case 6 Mix] Open task status: '${t6bAfter.body.status}', assigneeId: '${t6bAfter.body.assigneeId}'`);
    console.log(`[Case 6 Mix] In Review task status: '${t6cAfter.body.status}', assigneeId: '${t6cAfter.body.assigneeId}'`);
  });
});
