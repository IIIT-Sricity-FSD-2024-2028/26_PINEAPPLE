import request from 'supertest';
import { createTestApp, TestAppContext } from './helpers/test-helpers';
import { MentorMarketplaceService } from '../src/mentor-marketplace/mentor-marketplace.service';

describe('Step 1 E2E API Tests: One Role Per Person In A Project', () => {
  let ctx: TestAppContext;
  let server: any;

  const validDescription =
    'This is a comprehensive and realistic project description designed to exceed 100 characters so that project creation passes all validations in TeamForge platform tests.';

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.app.getHttpServer();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(() => {
    if (ctx.resetStores) {
      ctx.resetStores();
    }
    try {
      const mentorSvc = ctx.app.get(MentorMarketplaceService);
      if (mentorSvc && typeof mentorSvc.resetToSeed === 'function') {
        mentorSvc.resetToSeed();
      }
    } catch {
      // Ignored if service is not found
    }
  });

  describe('S1: Collaborator removal leaves owner + remaining collaborator, no phantom mentor', () => {
    it('removes collaborator B; count changes from 3 to 2, collaborator seat from 2/N to 1/N, mentor untouched', async () => {
      const ownerToken = ctx.loginAs('1'); // Priya Patel (Owner)
      const userAToken = ctx.loginAs('7'); // Neha Gupta (User with mentor profile 'mentor-profile-1')
      const userBToken = ctx.loginAs('5'); // Sneha Iyer (Collaborator)

      // 1. Owner creates project
      const createRes = await request(server)
        .post('/projects')
        .set('Authorization', ownerToken)
        .send({
          title: 'Project Step 1 Scenario 1',
          description: validDescription,
          requiredSkills: ['TypeScript', 'React'],
          dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
        });
      expect(createRes.status).toBe(201);
      const projectId = createRes.body.id;

      // 2. User A applies & is approved
      const applyARes = await request(server)
        .post('/join-requests')
        .set('Authorization', userAToken)
        .send({
          projectId,
          role: 'Collaborator',
          message: 'User A applying as collaborator',
        });
      expect(applyARes.status).toBe(201);

      await request(server)
        .patch(`/join-requests/${applyARes.body.id}`)
        .set('Authorization', ownerToken)
        .send({ status: 'Approved' });

      // 3. User B applies & is approved
      const applyBRes = await request(server)
        .post('/join-requests')
        .set('Authorization', userBToken)
        .send({
          projectId,
          role: 'Collaborator',
          message: 'User B applying as collaborator',
        });
      expect(applyBRes.status).toBe(201);

      await request(server)
        .patch(`/join-requests/${applyBRes.body.id}`)
        .set('Authorization', ownerToken)
        .send({ status: 'Approved' });

      // Check state: 3 members (Owner + A + B), 2 collaborator seats
      const projBeforeRemove = await request(server)
        .get(`/projects/${projectId}`)
        .set('Authorization', ownerToken);
      expect(projBeforeRemove.status).toBe(200);
      expect(projBeforeRemove.body.memberCount).toBe(3);
      expect(projBeforeRemove.body.approvedCollaboratorCount).toBe(2);

      const membersBeforeRemove = await request(server)
        .get(`/projects/${projectId}/members`)
        .set('Authorization', ownerToken);
      expect(membersBeforeRemove.status).toBe(200);
      expect(membersBeforeRemove.body).toHaveLength(3);

      // 4. Owner removes User B
      const removeRes = await request(server)
        .delete(`/projects/${projectId}/members/5`)
        .set('Authorization', ownerToken)
        .send({ reason: 'Collaborator B requested to step down from project' });
      expect(removeRes.status).toBe(200);

      // 5. Verify members list and counts after removal
      const projAfterRemove = await request(server)
        .get(`/projects/${projectId}`)
        .set('Authorization', ownerToken);
      expect(projAfterRemove.status).toBe(200);
      expect(projAfterRemove.body.memberCount).toBe(2); // Exactly 2 people: Owner and User A
      expect(projAfterRemove.body.approvedCollaboratorCount).toBe(1); // Exactly 1 seat freed
      expect(projAfterRemove.body.mentorId).toBeFalsy(); // Mentor untouched, no phantom mentor

      const membersAfterRemove = await request(server)
        .get(`/projects/${projectId}/members`)
        .set('Authorization', ownerToken);
      expect(membersAfterRemove.status).toBe(200);
      expect(membersAfterRemove.body).toHaveLength(2);

      const roles = membersAfterRemove.body.map((m: any) => m.role);
      expect(roles).toEqual(['Owner', 'Collaborator']);
      const userIds = membersAfterRemove.body.map((m: any) => m.userId);
      expect(userIds).toContain('1');
      expect(userIds).toContain('7');
      expect(userIds).not.toContain('5');
    });
  });

  describe('S2: Booking, accepting, paying collaborator or owner as mentor is refused (409 MENTOR_IS_PROJECT_MEMBER)', () => {
    it('refuses booking an active collaborator as mentor with 409 MENTOR_IS_PROJECT_MEMBER', async () => {
      const ownerToken = ctx.loginAs('1');
      const collabToken = ctx.loginAs('7', undefined, { role: 'collaborator' }); // Neha Gupta (mentor-profile-1)

      const createRes = await request(server)
        .post('/projects')
        .set('Authorization', ownerToken)
        .set('x-user-id', '1')
        .send({
          title: 'Project Step 1 Scenario 2',
          description: validDescription,
          requiredSkills: ['TypeScript'],
          dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
        });
      const projectId = createRes.body.id;

      // Add User 7 as collaborator
      const applyRes = await request(server)
        .post('/join-requests')
        .set('Authorization', collabToken)
        .set('x-user-id', '7')
        .send({
          projectId,
          role: 'Collaborator',
          message: 'Joining as collaborator',
        });
      await request(server)
        .patch(`/join-requests/${applyRes.body.id}`)
        .set('Authorization', ownerToken)
        .set('x-user-id', '1')
        .send({ status: 'Approved' });

      // Attempt to book User 7 (mentor-profile-1) as project mentor
      const bookCollabRes = await request(server)
        .post('/mentor-marketplace/sessions/book')
        .set('Authorization', ownerToken)
        .set('x-user-id', '1')
        .send({
          mentorId: 'mentor-profile-1',
          projectId,
          projectDescription: 'Attempting to book collaborator as mentor',
        });
      expect(bookCollabRes.status).toBe(409);
      expect(bookCollabRes.body.code).toBe('MENTOR_IS_PROJECT_MEMBER');
      expect(bookCollabRes.body.message).toMatch(/cannot be booked as mentor on the same project/i);
    });

    it('refuses booking project owner as mentor with 409 MENTOR_IS_PROJECT_MEMBER', async () => {
      // User 7 switches to project-owner role in DB, then tries to book themselves (mentor-profile-1)
      const user7Token = ctx.loginAs('7');
      const switchRes = await request(server)
        .post('/users/switch-role')
        .set('Authorization', user7Token)
        .send({ role: 'project-owner' });
      expect(switchRes.status).toBe(201);

      const createRes = await request(server)
        .post('/projects')
        .set('Authorization', user7Token)
        .set('x-user-id', '7')
        .send({
          title: 'Project Owned by Mentor User 7',
          description: validDescription,
          requiredSkills: ['React'],
          dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
        });
      expect(createRes.status).toBe(201);
      const projectId = createRes.body.id;

      const bookSelfRes = await request(server)
        .post('/mentor-marketplace/sessions/book')
        .set('Authorization', user7Token)
        .set('x-user-id', '7')
        .send({
          mentorId: 'mentor-profile-1',
          projectId,
          projectDescription: 'Owner attempting to book themselves as mentor',
        });
      expect(bookSelfRes.status).toBe(409);
      expect(bookSelfRes.body.code).toBe('MENTOR_IS_PROJECT_MEMBER');
    });
  });

  describe('S3: Current mentor applying, being invited, approved, or accepting invite is refused (409 ALREADY_PROJECT_MENTOR)', () => {
    let projectId: string;
    const ownerToken = () => ctx.loginAs('1');
    const mentorToken = () => ctx.loginAs('3', undefined, { role: 'mentor' }); // Kiran Bose (mentorId '3', mentor-profile-3)

    beforeEach(async () => {
      const createRes = await request(server)
        .post('/projects')
        .set('Authorization', ownerToken())
        .set('x-user-id', '1')
        .send({
          title: 'Project Step 1 Scenario 3',
          description: validDescription,
          requiredSkills: ['Node.js'],
          dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
        });
      projectId = createRes.body.id;

      // Legitimate booking of mentor User 3 (mentor-profile-3)
      const bookRes = await request(server)
        .post('/mentor-marketplace/sessions/book')
        .set('Authorization', ownerToken())
        .set('x-user-id', '1')
        .send({
          mentorId: 'mentor-profile-3',
          projectId,
          projectDescription: 'Legitimate booking for project architecture review',
        });
      expect(bookRes.status).toBe(201);
      const sessionId = bookRes.body.session.id;

      // Confirm payment
      const payRes = await request(server)
        .post(`/mentor-marketplace/sessions/${sessionId}/confirm-payment`)
        .set('Authorization', ownerToken())
        .set('x-user-id', '1')
        .send({ idempotencyKey: `idemp-legit-${Date.now()}` });
      expect(payRes.status).toBe(200);

      // Mentor accepts
      const acceptRes = await request(server)
        .post(`/mentor-marketplace/sessions/${sessionId}/accept`)
        .set('Authorization', mentorToken())
        .set('x-user-id', '3')
        .send({});
      expect(acceptRes.status).toBe(200);
    });

    it('refuses mentor applying as collaborator with 409 ALREADY_PROJECT_MENTOR', async () => {
      const applyRes = await request(server)
        .post('/join-requests')
        .set('Authorization', mentorToken())
        .send({
          projectId,
          role: 'Collaborator',
          message: 'Assigned mentor attempting to apply as collaborator',
        });
      expect(applyRes.status).toBe(409);
      expect(applyRes.body.code).toBe('ALREADY_PROJECT_MENTOR');
    });

    it('refuses inviting assigned mentor as collaborator with 409 ALREADY_PROJECT_MENTOR', async () => {
      const inviteRes = await request(server)
        .post(`/projects/${projectId}/invites`)
        .set('Authorization', ownerToken())
        .send({
          username: 'kiranbose', // User 3
        });
      expect(inviteRes.status).toBe(409);
      expect(inviteRes.body.code).toBe('ALREADY_PROJECT_MENTOR');
    });
  });

  describe('Owner cannot apply or be invited (409 ALREADY_PROJECT_OWNER)', () => {
    it('refuses owner applying to their own project with 409 ALREADY_PROJECT_OWNER', async () => {
      const ownerToken = ctx.loginAs('1');
      const createRes = await request(server)
        .post('/projects')
        .set('Authorization', ownerToken)
        .send({
          title: 'Project Owner Apply Test',
          description: validDescription,
          requiredSkills: ['Go'],
          dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
        });
      const projectId = createRes.body.id;

      const applyRes = await request(server)
        .post('/join-requests')
        .set('Authorization', ownerToken)
        .send({
          projectId,
          role: 'Collaborator',
          message: 'Owner applying to own project',
        });
      expect(applyRes.status).toBe(409);
      expect(applyRes.body.code).toBe('ALREADY_PROJECT_OWNER');
    });

    it('refuses inviting owner with 409 ALREADY_PROJECT_OWNER', async () => {
      const ownerToken = ctx.loginAs('1');
      const createRes = await request(server)
        .post('/projects')
        .set('Authorization', ownerToken)
        .send({
          title: 'Project Owner Invite Test',
          description: validDescription,
          requiredSkills: ['Python'],
          dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
        });
      const projectId = createRes.body.id;

      const inviteRes = await request(server)
        .post(`/projects/${projectId}/invites`)
        .set('Authorization', ownerToken)
        .send({
          username: 'priyapatel', // Owner's username
        });
      expect(inviteRes.status).toBe(409);
      expect(inviteRes.body.code).toBe('ALREADY_PROJECT_OWNER');
    });
  });

  describe('Legitimate mentor flow and collaborator departure leaves mentor intact', () => {
    it('legitimate mentor booking works, mentor appears once in members list, collaborator departure leaves mentor untouched', async () => {
      const ownerToken = ctx.loginAs('1');
      const mentorToken = ctx.loginAs('3', undefined, { role: 'mentor' }); // Kiran Bose
      const collabToken = ctx.loginAs('2'); // Arjun Sharma (Collaborator)

      // Create project
      const createRes = await request(server)
        .post('/projects')
        .set('Authorization', ownerToken)
        .set('x-user-id', '1')
        .send({
          title: 'Legitimate Mentor Lifecycle Project',
          description: validDescription,
          requiredSkills: ['Kubernetes'],
          dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
        });
      const projectId = createRes.body.id;

      // Add collaborator User 2
      const joinRes = await request(server)
        .post('/join-requests')
        .set('Authorization', collabToken)
        .set('x-user-id', '2')
        .send({ projectId, role: 'Collaborator', message: 'Legitimate collaborator' });
      await request(server)
        .patch(`/join-requests/${joinRes.body.id}`)
        .set('Authorization', ownerToken)
        .set('x-user-id', '1')
        .send({ status: 'Approved' });

      // Book mentor User 3
      const bookRes = await request(server)
        .post('/mentor-marketplace/sessions/book')
        .set('Authorization', ownerToken)
        .set('x-user-id', '1')
        .send({
          mentorId: 'mentor-profile-3',
          projectId,
          projectDescription: 'Architecture consultation',
        });
      expect(bookRes.status).toBe(201);
      const sessionId = bookRes.body.session.id;

      // Confirm payment
      const payRes = await request(server)
        .post(`/mentor-marketplace/sessions/${sessionId}/confirm-payment`)
        .set('Authorization', ownerToken)
        .set('x-user-id', '1')
        .send({ idempotencyKey: `idemp-live-${Date.now()}` });
      expect(payRes.status).toBe(200);

      // Mentor accepts
      const acceptRes = await request(server)
        .post(`/mentor-marketplace/sessions/${sessionId}/accept`)
        .set('Authorization', mentorToken)
        .set('x-user-id', '3')
        .send({});
      expect(acceptRes.status).toBe(200);

      // Read members: Owner + Collaborator + Mentor = 3
      const membersRes = await request(server)
        .get(`/projects/${projectId}/members`)
        .set('Authorization', ownerToken);
      expect(membersRes.status).toBe(200);
      expect(membersRes.body).toHaveLength(3);

      const mentorRows = membersRes.body.filter((m: any) => m.role === 'Mentor');
      expect(mentorRows).toHaveLength(1);
      expect(mentorRows[0].userId).toBe('3');

      // Collaborator leaves
      const leaveRes = await request(server)
        .post(`/projects/${projectId}/leave`)
        .set('Authorization', collabToken)
        .set('x-user-id', '2')
        .send({
          category: 'Too busy',
          reason: 'Leaving because of university exam commitments',
        });
      expect(leaveRes.status).toBe(201);

      // Verify mentor and session are untouched
      const afterLeaveMembers = await request(server)
        .get(`/projects/${projectId}/members`)
        .set('Authorization', ownerToken);
      expect(afterLeaveMembers.status).toBe(200);
      expect(afterLeaveMembers.body).toHaveLength(2); // Owner + Mentor

      const remainingMentor = afterLeaveMembers.body.find((m: any) => m.role === 'Mentor');
      expect(remainingMentor).toBeDefined();
      expect(remainingMentor.userId).toBe('3');

      const projAfterLeave = await request(server)
        .get(`/projects/${projectId}`)
        .set('Authorization', ownerToken);
      expect(projAfterLeave.body.mentorId).toBe('3');
      expect(projAfterLeave.body.memberCount).toBe(2);
      expect(projAfterLeave.body.approvedCollaboratorCount).toBe(0);
    });
  });
});
