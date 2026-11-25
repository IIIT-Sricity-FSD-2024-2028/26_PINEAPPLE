import request from 'supertest';
import { createTestApp, TestAppContext } from './helpers/test-helpers';
import { isDigiLockerNameMatch } from '../src/mentor-applications/digilocker/digilocker-sandbox.provider';

describe('Phase 6 Security Hardening - E2E API Tests', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(() => {
    ctx.resetStores();
  });

  describe('1. Private Project Chat Guard', () => {
    it('returns 401 when reading project chat without authentication', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/communication/messages/project/proj-1');

      expect(res.status).toBe(401);
    });

    it('returns 403 CHAT_MEMBERSHIP_REQUIRED when non-member reads project chat', async () => {
      // proj-1 members: owner=1 (Priya), mentor=3 (Kiran), collabs=2 (Arjun), 8 (Vikram)
      // User 4 (Rohan) is NOT a member of proj-1
      const nonMemberToken = ctx.loginAs('4');
      const res = await request(ctx.app.getHttpServer())
        .get('/communication/messages/project/proj-1')
        .set('Authorization', nonMemberToken);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('CHAT_MEMBERSHIP_REQUIRED');
      expect(res.body.message).toContain('project member');

      // Verify audit log has CHAT_ACCESS_DENIED
      const auditEntries = ctx.auditService.findAll();
      const deniedEntry = auditEntries.find(
        (a) => a.action === 'CHAT_ACCESS_DENIED' && a.entityId === 'proj-1',
      );
      expect(deniedEntry).toBeDefined();
    });

    it('allows project owner (User 1) to read project chat', async () => {
      const ownerToken = ctx.loginAs('1');
      const res = await request(ctx.app.getHttpServer())
        .get('/communication/messages/project/proj-1')
        .set('Authorization', ownerToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('allows project collaborator (User 2) to read project chat', async () => {
      const collabToken = ctx.loginAs('2');
      const res = await request(ctx.app.getHttpServer())
        .get('/communication/messages/project/proj-1')
        .set('Authorization', collabToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('allows assigned project mentor (User 3) to read project chat', async () => {
      const mentorToken = ctx.loginAs('3');
      const res = await request(ctx.app.getHttpServer())
        .get('/communication/messages/project/proj-1')
        .set('Authorization', mentorToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('allows admin and superuser to read project chat', async () => {
      const adminToken = ctx.loginAs('admin');
      const adminRes = await request(ctx.app.getHttpServer())
        .get('/communication/messages/project/proj-1')
        .set('Authorization', adminToken);

      expect(adminRes.status).toBe(200);

      const superToken = ctx.loginAs('superuser');
      const superRes = await request(ctx.app.getHttpServer())
        .get('/communication/messages/project/proj-1')
        .set('Authorization', superToken);

      expect(superRes.status).toBe(200);
    });

    it('returns 403 CHAT_MEMBERSHIP_REQUIRED when removed member reads project chat', async () => {
      // Simulate removing collaborator 8 from proj-1
      const project = ctx.projectsRepository.findById('proj-1');
      if (project) {
        project.collaborators = (project.collaborators || []).filter(
          (c: any) => String(c.id || c.userId || c) !== '8',
        );
        project.removedUsers = project.removedUsers || [];
        project.removedUsers.push({
          userId: '8',
          userName: 'Vikram Nair',
          reason: 'Violated project norms',
          removedAt: new Date().toISOString(),
        });
      }

      const removedToken = ctx.loginAs('8');
      const res = await request(ctx.app.getHttpServer())
        .get('/communication/messages/project/proj-1')
        .set('Authorization', removedToken);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('CHAT_MEMBERSHIP_REQUIRED');
    });

    it('returns 403 CHAT_MEMBERSHIP_REQUIRED when non-member posts a message', async () => {
      const nonMemberToken = ctx.loginAs('5'); // Sneha is not in proj-1
      const res = await request(ctx.app.getHttpServer())
        .post('/communication/messages')
        .set('Authorization', nonMemberToken)
        .send({
          projectId: 'proj-1',
          text: 'Unauthorized hello from an outsider',
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('CHAT_MEMBERSHIP_REQUIRED');
    });

    it('allows active project member to post a message', async () => {
      const collabToken = ctx.loginAs('2');
      const res = await request(ctx.app.getHttpServer())
        .post('/communication/messages')
        .set('Authorization', collabToken)
        .send({
          projectId: 'proj-1',
          text: 'Legitimate update on the ML pipeline module.',
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body).toBeDefined();
    });
  });

  describe('2. Proof & User URL Validation', () => {
    it('rejects task proof submission with javascript: URI with 400 INVALID_URL', async () => {
      const collabToken = ctx.loginAs('2');
      const res = await request(ctx.app.getHttpServer())
        .put('/tasks/task-1/status')
        .set('Authorization', collabToken)
        .send({
          status: 'In Review',
          proofUrl: 'javascript:alert(1)',
          notes: 'Malicious payload in proof URL',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_URL');
      expect(res.body.message).toContain('http:// or https://');

      // Verify audit log has INVALID_URL_REJECTED
      const auditEntries = ctx.auditService.findAll();
      const invalidUrlEntry = auditEntries.find(
        (a) => a.action === 'INVALID_URL_REJECTED',
      );
      expect(invalidUrlEntry).toBeDefined();
    });

    it('rejects task proof submission with data: URI with 400 INVALID_URL', async () => {
      const collabToken = ctx.loginAs('2');
      const res = await request(ctx.app.getHttpServer())
        .put('/tasks/task-1/status')
        .set('Authorization', collabToken)
        .send({
          status: 'In Review',
          proofUrl: 'data:text/html,<script>alert(1)</script>',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_URL');
    });

    it('rejects task proof submission with file: URI with 400 INVALID_URL', async () => {
      const collabToken = ctx.loginAs('2');
      const res = await request(ctx.app.getHttpServer())
        .put('/tasks/task-1/status')
        .set('Authorization', collabToken)
        .send({
          status: 'In Review',
          proofUrl: 'file:///etc/passwd',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_URL');
    });

    it('rejects task proof URL exceeding 2048 characters with 400 INVALID_URL', async () => {
      const collabToken = ctx.loginAs('2');
      const longUrl = 'https://example.com/' + 'a'.repeat(2040);
      const res = await request(ctx.app.getHttpServer())
        .put('/tasks/task-1/status')
        .set('Authorization', collabToken)
        .send({
          status: 'In Review',
          proofUrl: longUrl,
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_URL');
    });

    it('accepts valid HTTPS task proof URL', async () => {
      const collabToken = ctx.loginAs('2');
      const validUrl = 'https://github.com/teamforge/ai-planner/pull/42';
      const res = await request(ctx.app.getHttpServer())
        .put('/tasks/task-1/status')
        .set('Authorization', collabToken)
        .send({
          status: 'In Review',
          proofUrl: validUrl,
          notes: 'Completed the task according to specifications.',
        });

      expect(res.status).toBe(200);
      expect(res.body.proofUrl).toBe(validUrl);
    });

    it('rejects profile update with invalid LinkedIn URI with 400 INVALID_URL', async () => {
      const token = ctx.loginAs('2');
      const res = await request(ctx.app.getHttpServer())
        .patch('/users/2')
        .set('Authorization', token)
        .send({
          linkedIn: 'javascript:void(0)',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_URL');
    });

    it('accepts profile update with valid HTTPS LinkedIn URL', async () => {
      const token = ctx.loginAs('2');
      const validLinkedin = 'https://www.linkedin.com/in/arjun-sharma-test';
      const res = await request(ctx.app.getHttpServer())
        .patch('/users/2')
        .set('Authorization', token)
        .send({
          linkedIn: validLinkedin,
        });

      expect(res.status).toBe(200);
    });
  });

  describe('3. Incomplete-Profile Lock (403 PROFILE_INCOMPLETE)', () => {
    it('returns 403 PROFILE_INCOMPLETE when incomplete-profile user accesses protected routes', async () => {
      const incompleteToken = ctx.loginAs('social-new-user-1', undefined, {
        profileComplete: false,
        email: 'social.coder@gmail.com',
      });

      // Projects
      const projRes = await request(ctx.app.getHttpServer())
        .get('/projects')
        .set('Authorization', incompleteToken);
      expect(projRes.status).toBe(403);
      expect(projRes.body.code).toBe('PROFILE_INCOMPLETE');

      // Tasks
      const tasksRes = await request(ctx.app.getHttpServer())
        .get('/tasks/project/proj-1')
        .set('Authorization', incompleteToken);
      expect(tasksRes.status).toBe(403);
      expect(tasksRes.body.code).toBe('PROFILE_INCOMPLETE');

      // Notifications
      const notifRes = await request(ctx.app.getHttpServer())
        .get('/notifications')
        .set('Authorization', incompleteToken);
      expect(notifRes.status).toBe(403);
      expect(notifRes.body.code).toBe('PROFILE_INCOMPLETE');
    });

    it('allows access to whitelisted endpoints while profileComplete is false', async () => {
      const incompleteToken = ctx.loginAs('social-new-user-2', undefined, {
        profileComplete: false,
        email: 'social.coder2@gmail.com',
      });

      // GET /auth/me
      const meRes = await request(ctx.app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', incompleteToken);
      expect(meRes.status).toBe(200);

      // GET /users/me
      const usersMeRes = await request(ctx.app.getHttpServer())
        .get('/users/me')
        .set('Authorization', incompleteToken);
      expect(usersMeRes.status).toBe(200);

      // GET /users/username-available
      const availRes = await request(ctx.app.getHttpServer())
        .get('/users/username-available?username=newuniqueuser')
        .set('Authorization', incompleteToken);
      expect(availRes.status).toBe(200);

      // POST /auth/logout
      const logoutRes = await request(ctx.app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', incompleteToken);
      expect([200, 204]).toContain(logoutRes.status);
    });
  });

  describe('4. Self-Report Guard', () => {
    it('returns 400 CANNOT_REPORT_SELF when a user tries to report their own account', async () => {
      const token = ctx.loginAs('2');
      const res = await request(ctx.app.getHttpServer())
        .post('/reports')
        .set('Authorization', token)
        .send({
          reportedUserId: '2',
          reason: 'Harassment',
          details: 'I am filing a self-report which should be rejected by the server.',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('CANNOT_REPORT_SELF');
      expect(res.body.message).toContain('cannot report your own account');
    });

    it('allows a user to report another user', async () => {
      const token = ctx.loginAs('2');
      const res = await request(ctx.app.getHttpServer())
        .post('/reports')
        .set('Authorization', token)
        .send({
          reportedUserId: '4', // Reporting User 4
          reason: 'Spam',
          details: 'User has been sending unsolicited spam messages across multiple channels.',
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body.id).toBeDefined();
    });
  });

  describe('5. DigiLocker Sandbox Name Matching', () => {
    it('matches exact name and token reorderings', () => {
      expect(isDigiLockerNameMatch('Aditya Verma', 'Aditya Verma')).toBe(true);
      expect(isDigiLockerNameMatch('Aditya Verma', 'Verma Aditya')).toBe(true);
      expect(isDigiLockerNameMatch('aditya verma', 'ADITYA VERMA')).toBe(true);
    });

    it('strips honorifics and matches', () => {
      expect(isDigiLockerNameMatch('Dr. Aditya Verma', 'Aditya Verma')).toBe(true);
      expect(isDigiLockerNameMatch('Prof. Aditya Verma', 'Verma Aditya')).toBe(true);
      expect(isDigiLockerNameMatch('Mr. Aditya Verma', 'Aditya Verma')).toBe(true);
    });

    it('ignores punctuation and extra whitespace', () => {
      expect(isDigiLockerNameMatch('Aditya, Verma.', 'Aditya   Verma')).toBe(true);
      expect(isDigiLockerNameMatch('Aditya - Verma', 'Verma Aditya')).toBe(true);
    });

    it('strictly rejects substring matches', () => {
      expect(isDigiLockerNameMatch('Aditya', 'Aditya Verma')).toBe(false);
      expect(isDigiLockerNameMatch('Verma', 'Aditya Verma')).toBe(false);
      expect(isDigiLockerNameMatch('Ali', 'Alice')).toBe(false);
    });

    it('rejects mismatched names', () => {
      expect(isDigiLockerNameMatch('Aditya Verma', 'Sneha Rao')).toBe(false);
    });
  });
});
