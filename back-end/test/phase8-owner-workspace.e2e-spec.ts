import request from 'supertest';
import { createTestApp, TestAppContext } from './helpers/test-helpers';

describe('Phase 8: Owner Workspace (Request Filters, Invitations & Task Deletion)', () => {
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

  describe('Part A: Join Request Filters & Unified Items', () => {
    it('returns combined join requests and invitations with type and normalized filterGroup', async () => {
      const ownerToken = ctx.loginAs('1');
      const applicantToken = ctx.loginAs('3'); // User 3 is Kiran Bose (@kiranbose)
      const nonMemberToken = ctx.loginAs('4');

      // 1. Owner creates project
      const projRes = await request(server)
        .post('/projects')
        .set('Authorization', ownerToken)
        .send({
          title: 'Autonomous Multi-Agent Robotics',
          description: validDescription,
          requiredSkills: ['Robotics', 'ROS', 'Python'],
          dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
        })
        .expect(201);
      const projectId = projRes.body.id;

      // 2. User 3 submits join request (Applied)
      const appRes = await request(server)
        .post('/join-requests')
        .set('Authorization', applicantToken)
        .send({
          projectId,
          role: 'Collaborator',
          message: 'Interested in ROS path planning algorithms.',
        })
        .expect(201);
      const reqId = appRes.body.id;

      // 3. Owner directly invites User 2 (Invited)
      const inviteRes = await request(server)
        .post(`/projects/${projectId}/invites`)
        .set('Authorization', ownerToken)
        .send({
          username: 'arjunsharma',
          message: 'Join us to lead computer vision tasks.',
        })
        .expect(201);
      const inviteId = inviteRes.body.id;

      // 4. Non-owner gets 403 on GET /join-requests?projectId=...
      await request(server)
        .get(`/join-requests?projectId=${projectId}`)
        .set('Authorization', nonMemberToken)
        .expect(403);

      // 5. Owner retrieves combined items
      const combinedRes = await request(server)
        .get(`/join-requests?projectId=${projectId}`)
        .set('Authorization', ownerToken)
        .expect(200);

      expect(Array.isArray(combinedRes.body)).toBe(true);
      expect(combinedRes.body.length).toBe(2);

      const appliedItem = combinedRes.body.find((item: any) => item.id === reqId);
      expect(appliedItem).toBeDefined();
      expect(appliedItem.type).toBe('Applied');
      expect(appliedItem.filterGroup).toBe('Pending');
      expect(appliedItem.status.toLowerCase()).toBe('pending');
      expect(appliedItem.applicantName).toBeDefined();

      const invitedItem = combinedRes.body.find((item: any) => item.id === inviteId);
      expect(invitedItem).toBeDefined();
      expect(invitedItem.type).toBe('Invited');
      expect(invitedItem.filterGroup).toBe('Pending');
      expect(invitedItem.status.toLowerCase()).toBe('pending');

      // 6. Test filterGroup: status=pending returns both
      const pendingRes = await request(server)
        .get(`/join-requests?projectId=${projectId}&status=pending`)
        .set('Authorization', ownerToken)
        .expect(200);
      expect(pendingRes.body.length).toBe(2);

      // 7. Owner approves the join request -> moves to filterGroup: 'Approved'
      await request(server)
        .patch(`/join-requests/${reqId}`)
        .set('Authorization', ownerToken)
        .send({ status: 'Approved' })
        .expect(200);

      const afterApprove = await request(server)
        .get(`/join-requests?projectId=${projectId}`)
        .set('Authorization', ownerToken)
        .expect(200);

      const approvedItem = afterApprove.body.find((item: any) => item.id === reqId);
      expect(approvedItem.filterGroup).toBe('Approved');

      // 8. Filter by status=approved returns only the approved item
      const approvedOnly = await request(server)
        .get(`/join-requests?projectId=${projectId}&status=approved`)
        .set('Authorization', ownerToken)
        .expect(200);
      expect(approvedOnly.body.length).toBe(1);
      expect(approvedOnly.body[0].id).toBe(reqId);

      // 9. Owner cancels the invitation -> status becomes 'Cancelled', filterGroup: 'All'
      await request(server)
        .delete(`/projects/${projectId}/invites/${inviteId}`)
        .set('Authorization', ownerToken)
        .expect(200);

      const afterCancel = await request(server)
        .get(`/join-requests?projectId=${projectId}`)
        .set('Authorization', ownerToken)
        .expect(200);

      const cancelledInvite = afterCancel.body.find((item: any) => item.id === inviteId);
      expect(cancelledInvite.status.toLowerCase()).toBe('cancelled');
      expect(cancelledInvite.filterGroup).toBe('All');
    });
  });

  describe('Part B: Task Deletion Enforcement', () => {
    it('allows deleting an unassigned task, but refuses assigned or approved tasks', async () => {
      const ownerToken = ctx.loginAs('1');
      const collabToken = ctx.loginAs('3');

      // 1. Create project
      const projRes = await request(server)
        .post('/projects')
        .set('Authorization', ownerToken)
        .send({
          title: 'Distributed Consensus Engine',
          description: validDescription,
          requiredSkills: ['Rust', 'Distributed Systems'],
          dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
        })
        .expect(201);
      const projectId = projRes.body.id;

      // 2. Create unassigned task
      const task1Res = await request(server)
        .post('/tasks')
        .set('Authorization', ownerToken)
        .send({
          projectId,
          title: 'Setup Raft heartbeat protocol',
          priority: 'High',
          status: 'To Do',
          dueDate: new Date(Date.now() + 10 * 86400000).toISOString(),
        })
        .expect(201);
      const unassignedTaskId = task1Res.body.id;

      // 3. Non-owner cannot delete task (403 Forbidden)
      await request(server)
        .delete(`/tasks/${unassignedTaskId}`)
        .set('Authorization', collabToken)
        .expect(403);

      // 4. Owner successfully deletes unassigned task
      await request(server)
        .delete(`/tasks/${unassignedTaskId}`)
        .set('Authorization', ownerToken)
        .expect(200);

      // Verify task is gone
      await request(server)
        .get(`/tasks/${unassignedTaskId}`)
        .set('Authorization', ownerToken)
        .expect(404);

      // 5. Create assigned task
      const task2Res = await request(server)
        .post('/tasks')
        .set('Authorization', ownerToken)
        .send({
          projectId,
          title: 'Implement Raft election timer',
          priority: 'Medium',
          status: 'To Do',
          assigneeId: '3',
          assigneeName: 'Kiran Bose',
          dueDate: new Date(Date.now() + 10 * 86400000).toISOString(),
        })
        .expect(201);
      const assignedTaskId = task2Res.body.id;

      // 6. Deleting assigned task returns 409 Conflict with TASK_ASSIGNED
      const conflictRes = await request(server)
        .delete(`/tasks/${assignedTaskId}`)
        .set('Authorization', ownerToken)
        .expect(409);
      expect(conflictRes.body.code).toBe('TASK_ASSIGNED');

      // 7. Create completed/approved task
      const task3Res = await request(server)
        .post('/tasks')
        .set('Authorization', ownerToken)
        .send({
          projectId,
          title: 'Document architecture invariants',
          priority: 'Low',
          status: 'To Do',
          dueDate: new Date(Date.now() + 10 * 86400000).toISOString(),
        })
        .expect(201);
      const approvedTaskId = task3Res.body.id;
      // Mark task as approved
      const taskObj = ctx.tasksService.findById(approvedTaskId);
      taskObj.status = 'Approved';

      // 8. Deleting approved task returns 400 Bad Request with TASK_APPROVED
      const approvedRes = await request(server)
        .delete(`/tasks/${approvedTaskId}`)
        .set('Authorization', ownerToken)
        .expect(400);
      expect(approvedRes.body.code).toBe('TASK_APPROVED');

      // 9. Unassign the assigned task
      await request(server)
        .patch(`/tasks/${assignedTaskId}`)
        .set('Authorization', ownerToken)
        .send({
          assigneeId: 'unassigned',
          assigneeName: 'Unassigned',
        })
        .expect(200);

      // 10. Deleting now succeeds!
      await request(server)
        .delete(`/tasks/${assignedTaskId}`)
        .set('Authorization', ownerToken)
        .expect(200);
    });
  });
});
