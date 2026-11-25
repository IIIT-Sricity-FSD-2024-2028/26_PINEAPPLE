import request from 'supertest';
import { createTestApp, TestAppContext } from '../helpers/test-helpers';
import { MentorMarketplaceService } from '../../src/mentor-marketplace/mentor-marketplace.service';
import { AdminService } from '../../src/admin/admin.service';

describe('Regression & Smoke E2E Suite (Nov 21): Steps 1 through 5 Integration', () => {
  let ctx: TestAppContext;
  let server: any;
  let adminService: AdminService;
  let mentorMarketplaceService: MentorMarketplaceService;

  const validDescription =
    'This is a comprehensive open-source project initiative designed with high fidelity to exceed 100 characters so that project creation passes all TeamForge platform validations.';
  const defaultDueDate = new Date(Date.now() + 30 * 86400000).toISOString();

  let superuserToken: string;
  let adminToken: string;
  let ownerToken: string;
  let collabAToken: string;
  let collabBToken: string;
  let mentorMToken: string;
  let userUToken: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.app.getHttpServer();
    adminService = ctx.app.get(AdminService);
    mentorMarketplaceService = ctx.app.get(MentorMarketplaceService);

    superuserToken = ctx.loginAs('superuser');
    adminToken = ctx.loginAs('admin', ['support', 'audit', 'reports', 'users', 'projects']);
    ownerToken = ctx.loginAs('1'); // Priya Patel (Owner)
    collabAToken = ctx.loginAs('7', undefined, { role: 'collaborator' }); // Neha Gupta (User with mentor profile 'mentor-profile-1')
    collabBToken = ctx.loginAs('5'); // Sneha Iyer (Collaborator)
    mentorMToken = ctx.loginAs('3', undefined, { role: 'mentor' }); // Kiran Bose (Mentor profile 'mentor-profile-3')
    userUToken = ctx.loginAs('2'); // Arjun Sharma
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(() => {
    ctx.resetStores();
  });

  describe('Scenario A & F: Project Roles, One Role Per Person, Member Removal & Escrow Reconcile', () => {
    let projectId: string;

    it('a. Roles: owner, collaborator A (has mentor profile), collaborator B. Remove B -> count 2. Book A as mentor -> 409. Book mentor M, accepts, owner pays -> count 3. f. Reconcile ok.', async () => {
      // 1. Owner creates project
      const createProjRes = await request(server)
        .post('/projects')
        .set('Authorization', ownerToken)
        .send({
          title: 'Full Regression Roles Project',
          description: validDescription,
          requiredSkills: ['TypeScript', 'React'],
          dueDate: defaultDueDate,
        })
        .expect(201);

      projectId = createProjRes.body.id;
      expect(projectId).toBeDefined();

      // 2. Collaborator A applies and is approved
      const joinARes = await request(server)
        .post('/join-requests')
        .set('Authorization', collabAToken)
        .send({
          projectId,
          role: 'Collaborator',
          message: 'Collaborator A joining development team.',
        })
        .expect(201);

      await request(server)
        .patch(`/join-requests/${joinARes.body.id}`)
        .set('Authorization', ownerToken)
        .send({ status: 'Approved' })
        .expect(200);

      // 3. Collaborator B applies and is approved
      const joinBRes = await request(server)
        .post('/join-requests')
        .set('Authorization', collabBToken)
        .send({
          projectId,
          role: 'Collaborator',
          message: 'Collaborator B joining development team.',
        })
        .expect(201);

      await request(server)
        .patch(`/join-requests/${joinBRes.body.id}`)
        .set('Authorization', ownerToken)
        .send({ status: 'Approved' })
        .expect(200);

      // Verify before removal: 3 members (Owner + A + B), 2 collaborator seats
      const projBefore = await request(server)
        .get(`/projects/${projectId}`)
        .set('Authorization', ownerToken)
        .expect(200);
      expect(projBefore.body.memberCount).toBe(3);
      expect(projBefore.body.approvedCollaboratorCount).toBe(2);

      // 4. Remove Collaborator B
      await request(server)
        .delete(`/projects/${projectId}/members/5`)
        .set('Authorization', ownerToken)
        .send({ reason: 'Collaborator B voluntarily resigned' })
        .expect(200);

      // Read members list and count after removal
      const projAfterRemove = await request(server)
        .get(`/projects/${projectId}`)
        .set('Authorization', ownerToken)
        .expect(200);
      expect(projAfterRemove.body.memberCount).toBe(2);
      expect(projAfterRemove.body.approvedCollaboratorCount).toBe(1);
      expect(projAfterRemove.body.mentorId).toBeFalsy();

      const membersAfterRemove = await request(server)
        .get(`/projects/${projectId}/members`)
        .set('Authorization', ownerToken)
        .expect(200);
      expect(membersAfterRemove.body).toHaveLength(2);
      const remainingUserIds = membersAfterRemove.body.map((m: any) => m.userId);
      expect(remainingUserIds).toContain('1'); // Owner
      expect(remainingUserIds).toContain('7'); // Collaborator A
      expect(remainingUserIds).not.toContain('5'); // Collaborator B removed

      // 5. Attempt to book Collaborator A (mentor-profile-1) as project mentor -> 409 MENTOR_IS_PROJECT_MEMBER
      const bookCollabRes = await request(server)
        .post('/mentor-marketplace/sessions/book')
        .set('Authorization', ownerToken)
        .set('x-user-id', '1')
        .send({
          mentorId: 'mentor-profile-1',
          projectId,
          projectDescription: 'Attempting to assign active collaborator as mentor',
        })
        .expect(409);

      expect(bookCollabRes.body.code).toBe('MENTOR_IS_PROJECT_MEMBER');

      // 6. Book a different mentor M (mentor-profile-3, user 3)
      const bookMRes = await request(server)
        .post('/mentor-marketplace/sessions/book')
        .set('Authorization', ownerToken)
        .set('x-user-id', '1')
        .send({
          mentorId: 'mentor-profile-3',
          projectId,
          projectDescription: 'Official architecture and system guidance',
        })
        .expect(201);

      const sessionId = bookMRes.body.session.id;
      expect(sessionId).toBeDefined();

      // Owner pays
      await request(server)
        .post(`/mentor-marketplace/sessions/${sessionId}/confirm-payment`)
        .set('Authorization', ownerToken)
        .set('x-user-id', '1')
        .send({ idempotencyKey: `regression-pay-${Date.now()}` })
        .expect(200);

      // Mentor M accepts
      await request(server)
        .post(`/mentor-marketplace/sessions/${sessionId}/accept`)
        .set('Authorization', mentorMToken)
        .set('x-user-id', '3')
        .send({})
        .expect(200);

      // 7. Read members list: shows owner, A, M (count 3, one row each), seats correct
      const projWithMentor = await request(server)
        .get(`/projects/${projectId}`)
        .set('Authorization', ownerToken)
        .expect(200);
      expect(projWithMentor.body.memberCount).toBe(3);
      expect(projWithMentor.body.approvedCollaboratorCount).toBe(1);
      expect(projWithMentor.body.mentorId).toBe('3');

      const membersWithMentor = await request(server)
        .get(`/projects/${projectId}/members`)
        .set('Authorization', ownerToken)
        .expect(200);
      expect(membersWithMentor.body).toHaveLength(3);

      const rowsByUserId = new Map<string, any>(membersWithMentor.body.map((r: any) => [r.userId, r]));
      expect(rowsByUserId.get('1')?.role).toBe('Owner');
      expect(rowsByUserId.get('7')?.role).toBe('Collaborator');
      expect(rowsByUserId.get('3')?.role).toBe('Mentor');

      // 8. Scenario f: Check escrow reconcile endpoint returns ok after scenario a
      const reconcileRes = await request(server)
        .get('/admin/escrow/reconcile')
        .set('Authorization', adminToken)
        .expect(200);

      expect(reconcileRes.body.ok).toBe(true);
      expect(reconcileRes.body.mismatches).toEqual([]);
      expect(reconcileRes.body.totals.inEscrow).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Scenario B: Removal Rule With In Review & Released Tasks', () => {
    it('b. A submits a task (In Review): removing A returns 409 MEMBER_HAS_TASKS_IN_REVIEW; owner sends it back: removal works; A other tasks are released.', async () => {
      // 1. Owner creates project
      const projRes = await request(server)
        .post('/projects')
        .set('Authorization', ownerToken)
        .send({
          title: 'Removal Rule Validation Project',
          description: validDescription,
          requiredSkills: ['Node.js'],
          dueDate: defaultDueDate,
        })
        .expect(201);
      const projectId = projRes.body.id;

      // 2. User A (7) applies and is approved
      const joinRes = await request(server)
        .post('/join-requests')
        .set('Authorization', collabAToken)
        .send({
          projectId,
          role: 'Collaborator',
          message: 'Ready for sprint tasks',
        })
        .expect(201);

      await request(server)
        .put(`/join-requests/${joinRes.body.id}`)
        .set('Authorization', ownerToken)
        .send({ status: 'approved' })
        .expect(200);

      // 3. Create two tasks assigned to User A: Task 1 and Task 2
      const t1Res = await request(server)
        .post('/tasks')
        .set('Authorization', ownerToken)
        .send({
          projectId,
          title: 'Task 1 - Code Implementation',
          status: 'To Do',
          assigneeId: '7',
          dueDate: defaultDueDate,
        })
        .expect(201);
      const task1Id = t1Res.body.id;

      const t2Res = await request(server)
        .post('/tasks')
        .set('Authorization', ownerToken)
        .send({
          projectId,
          title: 'Task 2 - Future Work',
          status: 'To Do',
          assigneeId: '7',
          dueDate: defaultDueDate,
        })
        .expect(201);
      const task2Id = t2Res.body.id;

      // 4. User A submits Task 1 for review
      await request(server)
        .patch(`/tasks/${task1Id}/status`)
        .set('Authorization', collabAToken)
        .send({
          status: 'In Review',
          proofLink: 'https://github.com/teamforge/repo/pull/42',
        })
        .expect(200);

      // 5. Pre-check shows removal is blocked by Task 1
      const checkRes = await request(server)
        .get(`/projects/${projectId}/members/7/removal-check`)
        .set('Authorization', ownerToken)
        .expect(200);
      expect(checkRes.body.allowed).toBe(false);
      expect(checkRes.body.blockers).toHaveLength(1);
      expect(checkRes.body.blockers[0].taskId).toBe(task1Id);
      expect(checkRes.body.tasksToRelease).toHaveLength(1);
      expect(checkRes.body.tasksToRelease[0].taskId).toBe(task2Id);

      // 6. Owner attempts to remove User A -> 409 MEMBER_HAS_TASKS_IN_REVIEW
      const blockRes = await request(server)
        .delete(`/projects/${projectId}/members/7`)
        .set('Authorization', ownerToken)
        .send({ reason: 'Removing collaborator with submitted work' })
        .expect(409);

      expect(blockRes.body.code).toBe('MEMBER_HAS_TASKS_IN_REVIEW');
      expect(blockRes.body.blockers).toHaveLength(1);
      expect(blockRes.body.blockers[0].taskId).toBe(task1Id);

      // 7. Owner sends Task 1 back with changes requested / feedback
      await request(server)
        .patch(`/tasks/${task1Id}/status`)
        .set('Authorization', ownerToken)
        .send({
          status: 'To Do',
          rejectionReason: 'Please add automated unit tests before approval.',
        })
        .expect(200);

      // Pre-check is now allowed
      const checkAfterBack = await request(server)
        .get(`/projects/${projectId}/members/7/removal-check`)
        .set('Authorization', ownerToken)
        .expect(200);
      expect(checkAfterBack.body.allowed).toBe(true);
      expect(checkAfterBack.body.blockers).toHaveLength(0);
      expect(checkAfterBack.body.tasksToRelease).toHaveLength(2); // Both tasks 1 and 2

      // 8. Removal now succeeds
      await request(server)
        .delete(`/projects/${projectId}/members/7`)
        .set('Authorization', ownerToken)
        .send({ reason: 'Collaborator removed after task was sent back' })
        .expect(200);

      // 9. Both tasks are released back to unassigned
      const t1After = await request(server)
        .get(`/tasks/${task1Id}`)
        .set('Authorization', ownerToken)
        .expect(200);
      expect(t1After.body.assignee).toBe('Unassigned');

      const t2After = await request(server)
        .get(`/tasks/${task2Id}`)
        .set('Authorization', ownerToken)
        .expect(200);
      expect(t2After.body.assignee).toBe('Unassigned');
    });
  });

  describe('Scenario C: User Suspension & Login Security', () => {
    it('c. Suspension: admin suspends user U. U logs in with right password -> 403 ACCOUNT_SUSPENDED with reason; wrong password -> generic 401; earlier token -> ACCOUNT_SUSPENDED; reactivate -> login works.', async () => {
      // 1. User U (2, arjun.sharma@teamforge.io) logs in while active to get a live token
      const preLogin = await request(server)
        .post('/auth/login')
        .send({ identifier: 'arjun.sharma@teamforge.io', password: 'password123' })
        .expect(200);
      const earlierAccessToken = preLogin.body.accessToken;
      expect(earlierAccessToken).toBeDefined();

      // 2. Admin suspends User U
      adminService.suspendUser('2', { reason: 'Direct violation of community communication policies' }, 'admin');

      // 3. User U logs in with right password -> 403 ACCOUNT_SUSPENDED with reason
      const suspLogin = await request(server)
        .post('/auth/login')
        .send({ identifier: 'arjun.sharma@teamforge.io', password: 'password123' })
        .expect(403);

      expect(suspLogin.body.code).toBe('ACCOUNT_SUSPENDED');
      expect(suspLogin.body.message).toBe('Your account is suspended.');
      expect(suspLogin.body.reason).toBe('Direct violation of community communication policies');
      expect(suspLogin.body.accessToken).toBeUndefined();
      expect(suspLogin.body.token).toBeUndefined();

      // 4. User U logs in with WRONG password -> returns generic 401 identical to unknown email
      const wrongPwdRes = await request(server)
        .post('/auth/login')
        .send({ identifier: 'arjun.sharma@teamforge.io', password: 'invalid-password' })
        .expect(401);

      const unknownEmailRes = await request(server)
        .post('/auth/login')
        .send({ identifier: 'unknown-user-999@teamforge.io', password: 'invalid-password' })
        .expect(401);

      expect(wrongPwdRes.body.code).toBe(unknownEmailRes.body.code);
      expect(wrongPwdRes.body.code).toBe('INVALID_CREDENTIALS');
      expect(wrongPwdRes.body.message).toBe(unknownEmailRes.body.message);

      // 5. User U earlier token gets ACCOUNT_SUSPENDED mid-session
      const midSessionRes = await request(server)
        .get('/auth/me')
        .set('Authorization', `Bearer ${earlierAccessToken}`)
        .expect(403);

      expect(midSessionRes.body.code).toBe('ACCOUNT_SUSPENDED');
      expect(midSessionRes.body.reason).toBe('Direct violation of community communication policies');

      // 6. Reactivate user U
      adminService.reactivateUser('2', { reason: 'Appeal approved and restrictions lifted' }, 'admin');

      // Login now works and returns token without suspended message
      const reactivatedLogin = await request(server)
        .post('/auth/login')
        .send({ identifier: 'arjun.sharma@teamforge.io', password: 'password123' })
        .expect(200);

      expect(reactivatedLogin.body.accessToken).toBeDefined();
      expect(reactivatedLogin.body.code).toBeUndefined();
    });
  });

  describe('Scenario D: Read-Only Resolved/Rejected Support Tickets', () => {
    it('d. Tickets: user opens ticket, admin changes priority and assignee, resolves with note; every further change returns 409 TICKET_CLOSED; user opens new ticket.', async () => {
      // 1. User opens a ticket
      const ticketRes = await request(server)
        .post('/support/tickets')
        .set('Authorization', userUToken)
        .send({
          type: 'help',
          subject: 'Question on task completion metrics',
          message: 'My recent task completion points have not yet reflected on the leaderboard ledger.',
        })
        .expect(201);

      const ticketId = ticketRes.body.id;
      expect(ticketId).toBeDefined();

      // 2. Admin changes priority
      const patchPriority = await request(server)
        .patch(`/admin/support/tickets/${ticketId}`)
        .set('Authorization', adminToken)
        .send({ priority: 'high' })
        .expect(200);
      expect(patchPriority.body.priority).toBe('high');

      // 3. Admin changes assignee
      const patchAssignee = await request(server)
        .patch(`/admin/support/tickets/${ticketId}`)
        .set('Authorization', adminToken)
        .send({ assigneeId: 'u-admin' })
        .expect(200);
      expect(patchAssignee.body.assigneeId).toBe('u-admin');

      // 4. Admin resolves ticket with a note
      const resolveRes = await request(server)
        .patch(`/admin/support/tickets/${ticketId}`)
        .set('Authorization', adminToken)
        .send({
          status: 'resolved',
          note: 'Points were reconciled and updated on the next hourly cycle.',
        })
        .expect(200);
      expect(resolveRes.body.status).toBe('resolved');
      expect(resolveRes.body.resolutionNote).toBe('Points were reconciled and updated on the next hourly cycle.');

      // 5. Every further change returns 409 TICKET_CLOSED
      // Priority mutation
      const prioClosed = await request(server)
        .patch(`/admin/support/tickets/${ticketId}`)
        .set('Authorization', adminToken)
        .send({ priority: 'low' })
        .expect(409);
      expect(prioClosed.body.code).toBe('TICKET_CLOSED');

      // Assignee mutation
      const assnClosed = await request(server)
        .patch(`/admin/support/tickets/${ticketId}`)
        .set('Authorization', adminToken)
        .send({ assigneeId: 'u-admin-2' })
        .expect(409);
      expect(assnClosed.body.code).toBe('TICKET_CLOSED');

      // Status mutation
      const statClosed = await request(server)
        .patch(`/admin/support/tickets/${ticketId}`)
        .set('Authorization', adminToken)
        .send({ status: 'open' })
        .expect(409);
      expect(statClosed.body.code).toBe('TICKET_CLOSED');

      // Admin reply
      const replyClosed = await request(server)
        .post(`/admin/support/tickets/${ticketId}/replies`)
        .set('Authorization', adminToken)
        .send({ body: 'Attempting to reply to closed ticket', internal: false })
        .expect(409);
      expect(replyClosed.body.code).toBe('TICKET_CLOSED');

      // User reply
      const userReplyClosed = await request(server)
        .post(`/support/tickets/${ticketId}/replies`)
        .set('Authorization', userUToken)
        .send({ body: 'User attempting to reply to resolved ticket' })
        .expect(409);
      expect(userReplyClosed.body.code).toBe('TICKET_CLOSED');

      // 6. User opens a new follow-up ticket
      const newTicketRes = await request(server)
        .post('/support/tickets')
        .set('Authorization', userUToken)
        .send({
          type: 'help',
          subject: 'Follow-up regarding weekly leaderboard summary',
          message: 'Opening a fresh ticket to query the weekly leaderboard display.',
        })
        .expect(201);

      expect(newTicketRes.body.id).toBeDefined();
      expect(newTicketRes.body.id).not.toBe(ticketId);
    });
  });

  describe('Scenario E: Moderation Action from Report & Audit Trail Correlation', () => {
    it('e. Audit: user reports another user, admin suspends from the report; audit list with userId and with reportId shows the entries.', async () => {
      // 1. User reports another user (User 6)
      const reportRes = await request(server)
        .post('/reports')
        .set('Authorization', userUToken)
        .send({
          reportedUserId: '6',
          reason: 'Harassment',
          details: 'User repeatedly posted toxic remarks in public workspace comments.',
        })
        .expect(201);

      const reportId = reportRes.body.id;
      expect(reportId).toBeDefined();

      // 2. Superuser executes suspension directly from the report
      await request(server)
        .post(`/admin/reports/${reportId}/action`)
        .set('Authorization', superuserToken)
        .send({
          action: 'suspend',
          reason: 'Suspension confirmed after investigating report evidence.',
        })
        .expect(201);

      // 3. Query audit log with userId '6' -> shows user-suspended entry
      const userAuditRes = await request(server)
        .get('/admin/audit?userId=6')
        .set('Authorization', adminToken)
        .expect(200);

      const userAuditActions = userAuditRes.body.map((e: any) => e.action);
      expect(userAuditActions).toContain('user-suspended');

      // 4. Query audit log with reportId -> shows report-action and user-suspended entries linked to this report
      const reportAuditRes = await request(server)
        .get(`/admin/audit?reportId=${reportId}`)
        .set('Authorization', adminToken)
        .expect(200);

      const reportAuditActions = reportAuditRes.body.map((e: any) => e.action);
      expect(reportAuditActions).toContain('user-suspended');
      expect(reportAuditActions).toContain('report-action');
    });
  });
});
