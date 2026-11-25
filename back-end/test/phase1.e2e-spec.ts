import request from 'supertest';
import { createTestApp, TestAppContext } from './helpers/test-helpers';
import { UserStatus } from '../src/users/dto/create-user.dto';

describe('Phase 1 Moderation Core - E2E API Tests', () => {
  let ctx: TestAppContext;
  let server: any;
  let adminToken: string;
  let superuserToken: string;
  let collaboratorToken: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.app.getHttpServer();
    adminToken = ctx.loginAs('admin');
    superuserToken = ctx.loginAs('superuser');
    collaboratorToken = ctx.loginAs('collaborator');
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(() => {
    ctx.resetStores();
  });

  describe('RBAC & Auth Guard Verification', () => {
    it('returns 401 Unauthorized when no token is provided for admin warn', async () => {
      const res = await request(server)
        .post('/admin/users/2/warn')
        .send({ reason: 'Valid ten char explanation' });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('statusCode', 401);
      expect(res.body).toHaveProperty('code');
    });

    it('returns 403 Forbidden when a collaborator tries to warn a user', async () => {
      const res = await request(server)
        .post('/admin/users/2/warn')
        .set('Authorization', collaboratorToken)
        .send({ reason: 'Valid ten char explanation' });

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('statusCode', 403);
    });

    it('returns 403 Forbidden when a collaborator tries to suspend a user', async () => {
      const res = await request(server)
        .post('/admin/users/2/suspend')
        .set('Authorization', collaboratorToken)
        .send({ reason: 'Valid ten char explanation' });

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('statusCode', 403);
    });

    it('returns 403 CANNOT_MODERATE_SELF when admin tries to moderate self', async () => {
      const res = await request(server)
        .post('/admin/users/u-admin/warn')
        .set('Authorization', adminToken)
        .send({ reason: 'Attempting to self warn' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('CANNOT_MODERATE_SELF');
    });

    it('returns 403 CANNOT_MODERATE_ADMIN when admin tries to moderate another admin or superuser', async () => {
      const res = await request(server)
        .post('/admin/users/u-superuser/warn')
        .set('Authorization', adminToken)
        .send({ reason: 'Attempting to warn superuser' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('CANNOT_MODERATE_ADMIN');
    });
  });

  describe('Validation: Written Explanation >= 10 Characters', () => {
    it('returns 400 Bad Request with standardized error shape when warning explanation < 10 chars', async () => {
      const res = await request(server)
        .post('/admin/users/2/warn')
        .set('Authorization', adminToken)
        .send({ reason: 'Short' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('statusCode', 400);
      expect(res.body).toHaveProperty('error');
      expect(res.body).toHaveProperty('code');
      expect(res.body).toHaveProperty('message');
      expect(res.body.message).toMatch(/(at least 10 characters|between 10 and 500 characters)/);
    });

    it('returns 400 Bad Request when suspension explanation < 10 chars', async () => {
      const res = await request(server)
        .post('/admin/users/2/suspend')
        .set('Authorization', adminToken)
        .send({ reason: 'bad user' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/(at least 10 characters|between 10 and 500 characters)/);
    });

    it('returns 400 Bad Request when reactivation explanation < 10 chars', async () => {
      const res = await request(server)
        .post('/admin/users/2/reactivate')
        .set('Authorization', adminToken)
        .send({ reason: 'ok' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/(at least 10 characters|between 10 and 500 characters)/);
    });
  });

  describe('Warning Progression & Automatic Suspension on 4th Warning', () => {
    it('issues 4 warnings consecutively, sends mail, titles notifications Warning 1/4..4/4, and 4th triggers auto-suspension', async () => {
      // Warning 1
      const warn1 = await request(server)
        .post('/admin/users/2/warn')
        .set('Authorization', adminToken)
        .send({ reason: 'First violation of code of conduct' });

      expect(warn1.status).toBe(201);
      expect(warn1.body.activeWarningsCount).toBe(1);

      // Warning 2
      const warn2 = await request(server)
        .post('/admin/users/2/warn')
        .set('Authorization', adminToken)
        .send({ reason: 'Second violation: missed milestones' });

      expect(warn2.status).toBe(201);
      expect(warn2.body.activeWarningsCount).toBe(2);

      // Warning 3
      const warn3 = await request(server)
        .post('/admin/users/2/warn')
        .set('Authorization', adminToken)
        .send({ reason: 'Third violation: repeated disruptions' });

      expect(warn3.status).toBe(201);
      expect(warn3.body.activeWarningsCount).toBe(3);

      // Verify notifications 1/4, 2/4, 3/4
      const notifs = ctx.notificationsService.findByUser('2');
      expect(notifs.some((n) => n.title === 'Warning 1/4')).toBe(true);
      expect(notifs.some((n) => n.title === 'Warning 2/4')).toBe(true);
      expect(notifs.some((n) => n.title === 'Warning 3/4')).toBe(true);

      // Warning 4 -> Triggers automatic suspension!
      const warn4 = await request(server)
        .post('/admin/users/2/warn')
        .set('Authorization', adminToken)
        .send({ reason: 'Fourth violation: unresolvable conflicts' });

      expect(warn4.status).toBe(201);
      expect(warn4.body.status).toBe(UserStatus.Suspended);
      expect(warn4.body.suspensionReason).toBe('Automatic suspension after 4 warnings');

      // Verify suspension email was dispatched
      const sentMails = ctx.mailServiceMock.getSentMails();
      const autoSuspMail = sentMails.find(
        (m) => m.type === 'suspension' && m.reason === 'Automatic suspension after 4 warnings',
      );
      expect(autoSuspMail).toBeDefined();

      // Suspended account is blocked from login
      const loginRes = await request(server)
        .post('/auth/login')
        .send({ email: 'arjun.sharma@teamforge.io', password: 'password123' });
      expect(loginRes.status).toBe(403);
    });

    it('each warning deducts 10 reputation from ledger and reputation cannot drop below 0', async () => {
      // Check user 2 initial rep
      const initialStats = ctx.gamificationService.getUserStats('2');
      const initialRep = initialStats.repScore;

      // Give 2 warnings
      await request(server)
        .post('/admin/users/2/warn')
        .set('Authorization', adminToken)
        .send({ reason: 'First violation explanation text' });

      expect(ctx.gamificationService.getUserStats('2').repScore).toBe(Math.max(0, initialRep - 10));

      await request(server)
        .post('/admin/users/2/warn')
        .set('Authorization', adminToken)
        .send({ reason: 'Second violation explanation text' });

      expect(ctx.gamificationService.getUserStats('2').repScore).toBe(Math.max(0, initialRep - 20));
    });
  });

  describe('Manual Suspension & Reactivation Endpoints', () => {
    it('manual suspension sends email only, no notification to user', async () => {
      ctx.mailServiceMock.clearSentMails();
      const beforeNotifCount = ctx.notificationsService.findByUser('2').length;

      const res = await request(server)
        .post('/admin/users/2/suspend')
        .set('Authorization', superuserToken)
        .send({ reason: 'Manual administrative suspension reason' });

      expect([200, 201]).toContain(res.status);
      expect(String(res.body.status).toLowerCase()).toBe(UserStatus.Suspended.toLowerCase());
      expect(res.body.suspensionReason).toBe('Manual administrative suspension reason');

      const afterNotifCount = ctx.notificationsService.findByUser('2').length;
      expect(afterNotifCount).toBe(beforeNotifCount); // No notification to user

      const sentMails = ctx.mailServiceMock.getSentMails();
      expect(sentMails.some((m) => m.type === 'suspension')).toBe(true);
    });

    it('reactivation resets activeWarningsCount to 0, sends notification only, keeps history', async () => {
      // Issue 2 warnings, then suspend
      await request(server)
        .post('/admin/users/2/warn')
        .set('Authorization', adminToken)
        .send({ reason: 'First infraction written here' });
      await request(server)
        .post('/admin/users/2/warn')
        .set('Authorization', adminToken)
        .send({ reason: 'Second infraction written here' });
      await request(server)
        .post('/admin/users/2/suspend')
        .set('Authorization', superuserToken)
        .send({ reason: 'Suspending pending formal review' });

      ctx.mailServiceMock.clearSentMails();

      // Reactivate
      const reactRes = await request(server)
        .post('/admin/users/2/reactivate')
        .set('Authorization', adminToken)
        .send({ reason: 'Account reviewed and reinstated successfully' });

      expect([200, 201]).toContain(reactRes.status);
      expect(String(reactRes.body.status).toLowerCase()).toBe(UserStatus.Active.toLowerCase());
      expect(reactRes.body.activeWarningsCount).toBe(0); // Cleared to 0!

      // Notification sent to user
      const notifs = ctx.notificationsService.findByUser('2');
      const reactNotif = notifs.find((n) => n.type === 'ACCOUNT_REACTIVATED');
      expect(reactNotif).toBeDefined();

      // NO email sent on reactivation
      const sentMails = ctx.mailServiceMock.getSentMails();
      expect(sentMails).toHaveLength(0);

      // Warning history preserved
      const user = ctx.usersService.findById('2');
      expect(user.warnings.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Suspension Cascades: Collaborator & Project Owner', () => {
    it('suspending collaborator releases Open & In-Progress tasks, keeps In-Review, notifies owner', async () => {
      // Create an open task and in-review task for user 2
      const taskOpen = ctx.tasksService.create({
        projectId: 'proj-1',
        title: 'Draft System Architecture',
        description: 'System architecture diagram',
        xpReward: 50,
        status: 'open' as any,
        assigneeId: '2',
        dueDate: '2027-01-01T00:00:00.000Z',
      });

      const taskReview = ctx.tasksService.create({
        projectId: 'proj-1',
        title: 'Review Security Controls',
        description: 'Security review task',
        xpReward: 50,
        status: 'in review' as any,
        assigneeId: '2',
        dueDate: '2027-01-01T00:00:00.000Z',
      });

      // Suspend user 2
      await request(server)
        .post('/admin/users/2/suspend')
        .set('Authorization', superuserToken)
        .send({ reason: 'Collaborator policy violation suspension' });

      // Check task status
      const updatedOpen = ctx.tasksService.findById(taskOpen.id);
      expect(updatedOpen.assignee).toBe('Unassigned');
      expect(updatedOpen.status).toBe('To Do');

      const updatedReview = ctx.tasksService.findById(taskReview.id);
      expect(updatedReview.assigneeId).toBe('2'); // stays for owner decision

      // Owner (User 1) notified
      const ownerNotifs = ctx.notificationsService.findByUser('1');
      const releaseNotif = ownerNotifs.find((n) => n.type === 'TASK_RELEASED');
      expect(releaseNotif).toBeDefined();
      expect(releaseNotif?.message).toContain('Draft System Architecture');
    });

    it('suspending owner closes all owned projects with "Owner suspended", which are read-only and locked', async () => {
      // Suspend User 2 (owns proj-2)
      await request(server)
        .post('/admin/users/2/suspend')
        .set('Authorization', superuserToken)
        .send({ reason: 'Owner suspended for fraudulent activities' });

      const project = ctx.projectsService.findById('proj-2');
      expect(String(project.status).toLowerCase()).toBe('closed');
      expect(project.closureReason).toBe('Owner suspended');

      // Attempting to create a task on closed project is refused
      expect(() => {
        ctx.tasksService.create({
          projectId: 'proj-2',
          title: 'Unauthorized Task',
          description: 'Cannot create on closed project',
          xpReward: 20,
          status: 'open' as any,
          dueDate: '2027-01-01T00:00:00.000Z',
        });
      }).toThrow();

      // Closed projects do not appear in marketplace
      const marketplace = ctx.projectsService.findAll();
      const projInList = marketplace.find((p) => p.id === 'proj-2');
      expect(projInList).toBeUndefined();
    });

    it('returns 409 PROJECT_CLOSED when applying to a closed project', async () => {
      // Suspend User 2 (owns proj-2) so proj-2 is closed
      await request(server)
        .post('/admin/users/2/suspend')
        .set('Authorization', superuserToken)
        .send({ reason: 'Owner suspended for fraudulent activities' });

      // An applicant tries to apply to proj-2
      const applicantToken = ctx.loginAs('u-collab');
      const res = await request(server)
        .post('/join-requests')
        .set('Authorization', applicantToken)
        .send({
          projectId: 'proj-2',
          role: 'Frontend Developer',
          message: 'I would like to help build this application.',
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('PROJECT_CLOSED');
    });
  });

  describe('Warnings History Endpoints', () => {
    it('allows admin to query user warning history and user to query own warnings with N/4 labels', async () => {
      // Issue 2 warnings to user 2
      await request(server)
        .post('/admin/users/2/warn')
        .set('Authorization', adminToken)
        .send({ reason: 'First violation of guidelines' });

      await request(server)
        .post('/admin/users/2/warn')
        .set('Authorization', adminToken)
        .send({ reason: 'Second violation of guidelines' });

      // Admin queries user 2 warnings
      const adminRes = await request(server)
        .get('/admin/users/2/warnings')
        .set('Authorization', adminToken);

      expect(adminRes.status).toBe(200);
      expect(Array.isArray(adminRes.body)).toBe(true);
      expect(adminRes.body.length).toBeGreaterThanOrEqual(2);
      expect(adminRes.body[0]).toHaveProperty('moderatorName');

      // User 2 queries own warnings
      const userRes = await request(server)
        .get('/users/me/warnings')
        .set('Authorization', collaboratorToken);

      expect(userRes.status).toBe(200);
      expect(Array.isArray(userRes.body)).toBe(true);
      expect(userRes.body.length).toBeGreaterThanOrEqual(2);
      expect(userRes.body[0].label).toBe('Warning 1/4');
      expect(userRes.body[1].label).toBe('Warning 2/4');
    });
  });
});
