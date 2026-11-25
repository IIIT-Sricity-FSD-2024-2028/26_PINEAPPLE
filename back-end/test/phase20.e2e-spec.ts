import request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';
import { createTestApp, TestAppContext } from './helpers/test-helpers';
import { MentorApplicationsService } from '../src/mentor-applications/mentor-applications.service';
import { SECURE_CVS_DIR, UPLOADS_DIR } from '../src/core/middleware/file-upload.middleware';

describe('Phase 20: Resource Authorization & Input Checks (E2E)', () => {
  let ctx: TestAppContext;
  let server: any;

  // Minimal valid binary payloads matching magic bytes
  const VALID_PNG = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  ]);
  const VALID_PDF = Buffer.from(
    '%PDF-1.4\n1 0 obj\n<< /Title (Phase 20 Verification) >>\nendobj\ntrailer\n%%EOF',
  );
  const SVG_PAYLOAD = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
  );

  const createdUploadPaths: string[] = [];

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.app.getHttpServer();
  });

  beforeEach(() => {
    ctx.resetStores();
  });

  afterAll(async () => {
    for (const p of createdUploadPaths) {
      try {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch {}
    }
    if (ctx?.app) {
      await ctx.app.close();
    }
  });

  describe('1. Cross-Project Task Authorization & Project ID Mismatch', () => {
    it('blocks Project A owner/collaborator from creating/editing/deleting tasks in Project B and rejects projectId mismatch with 404 TASK_NOT_FOUND', async () => {
      const signUpAndVerify = async (name: string, username: string, email: string, role: string) => {
        const res = await request(server)
          .post('/auth/signup')
          .send({ name, email, password: 'Password123!', role });
        expect(res.status).toBe(201);
        await request(server)
          .post('/auth/profile')
          .set('Authorization', `Bearer ${res.body.accessToken}`)
          .send({ name, username })
          .expect(200);
        const raw = ctx.usersRepository.findById(res.body.user.id);
        if (raw) raw.emailVerified = true;
        const login = await request(server)
          .post('/auth/login')
          .send({ identifier: username, password: 'Password123!' });
        expect(login.status).toBe(200);
        return `Bearer ${login.body.accessToken}`;
      };

      const ownerAToken = await signUpAndVerify('Owner A', 'owner_a_p20', 'owner.a.p20@example.com', 'Project Owner');
      const ownerBToken = await signUpAndVerify('Owner B', 'owner_b_p20', 'owner.b.p20@example.com', 'Project Owner');
      const collabAToken = await signUpAndVerify('Collab A', 'collab_a_p20', 'collab.a.p20@example.com', 'Collaborator');

      // Owner A creates Project A
      const projARes = await request(server)
        .post('/projects')
        .set('Authorization', ownerAToken)
        .send({
          title: 'Project A Primary Workspace',
          description:
            'Project A is owned strictly by user A with a separate team and task list for cross-project isolation tests.',
          dueDate: '2028-06-30',
        });
      expect(projARes.status).toBe(201);
      const projAId = projARes.body.id;

      // Create Project B owned by verified Project Owner B
      const projBRes = await request(server)
        .post('/projects')
        .set('Authorization', ownerBToken)
        .send({
          title: 'Project B Security Isolation',
          description:
            'Project B is strictly isolated and owned by user B so any cross-project task read, create, edit, comment, or delete attempt must fail.',
          dueDate: '2028-06-30',
        });
      expect(projBRes.status).toBe(201);
      const projBId = projBRes.body.id;

      // Owner of Project B creates a valid task in Project B
      const taskBRes = await request(server)
        .post('/tasks')
        .set('Authorization', ownerBToken)
        .send({
          projectId: projBId,
          title: 'Secret Project B Task',
          dueDate: '2028-05-15',
          priority: 'Medium',
        });
      expect(taskBRes.status).toBe(201);
      const taskBId = taskBRes.body.id;

      // 1. Project A owner tries creating a task in Project B -> 403 NOT_A_PROJECT_MEMBER + audit
      const outsiderCreateRes = await request(server)
        .post('/tasks')
        .set('Authorization', ownerAToken)
        .send({
          projectId: projBId,
          title: 'Cross Project Injection',
          dueDate: '2028-05-15',
        });
      expect(outsiderCreateRes.status).toBe(403);
      expect(outsiderCreateRes.body.code).toBe('NOT_A_PROJECT_MEMBER');

      const deniedAudits = ctx.auditService
        .findAll()
        .filter((l: any) => l.action === 'ACCESS_DENIED_TASK');
      expect(deniedAudits.length).toBeGreaterThanOrEqual(1);
      expect(deniedAudits.some((l: any) => l.details?.projectId === projBId)).toBe(true);

      // 2. Project A collaborator tries to read, edit, comment, or delete Project B task -> 403
      const outsiderRead = await request(server)
        .get(`/tasks/${taskBId}`)
        .set('Authorization', collabAToken);
      expect(outsiderRead.status).toBe(403);
      expect(outsiderRead.body.code).toBe('NOT_A_PROJECT_MEMBER');

      const outsiderEdit = await request(server)
        .patch(`/tasks/${taskBId}`)
        .set('Authorization', collabAToken)
        .send({ title: 'Tampered Title' });
      expect(outsiderEdit.status).toBe(403);
      expect(outsiderEdit.body.code).toBe('NOT_A_PROJECT_MEMBER');

      const outsiderComment = await request(server)
        .post(`/tasks/${taskBId}/comments`)
        .set('Authorization', collabAToken)
        .send({ text: 'Outsider comment attempt' });
      expect(outsiderComment.status).toBe(403);
      expect(outsiderComment.body.code).toBe('NOT_A_PROJECT_MEMBER');

      const outsiderDelete = await request(server)
        .delete(`/tasks/${taskBId}`)
        .set('Authorization', collabAToken);
      expect(outsiderDelete.status).toBe(403);

      // 3. Mismatched projectId in URL or body gets 404 TASK_NOT_FOUND
      const mismatchQuery = await request(server)
        .get(`/tasks/${taskBId}?projectId=${projAId}`)
        .set('Authorization', ownerBToken);
      expect(mismatchQuery.status).toBe(404);
      expect(mismatchQuery.body.code).toBe('TASK_NOT_FOUND');

      const mismatchBody = await request(server)
        .patch(`/tasks/${taskBId}`)
        .set('Authorization', ownerBToken)
        .send({ projectId: projAId, title: 'Hijacked' });
      expect(mismatchBody.status).toBe(404);
      expect(mismatchBody.body.code).toBe('TASK_NOT_FOUND');
    });

    it('rejects initial task status other than Open/To Do with 400 INVALID_INITIAL_STATUS', async () => {
      const ownerToken = ctx.loginAs('1');

      const badRes = await request(server)
        .post('/tasks')
        .set('Authorization', ownerToken)
        .send({
          projectId: 'proj-1',
          title: 'Pre-approved bypass attempt',
          dueDate: '2028-05-01',
          status: 'In Review',
        });
      expect(badRes.status).toBe(400);
      expect(badRes.body.code).toBe('INVALID_INITIAL_STATUS');

      const badCompleted = await request(server)
        .post('/tasks')
        .set('Authorization', ownerToken)
        .send({
          projectId: 'proj-1',
          title: 'Completed on create bypass attempt',
          dueDate: '2028-05-01',
          status: 'Completed',
        });
      expect(badCompleted.status).toBe(400);
      expect(badCompleted.body.code).toBe('INVALID_INITIAL_STATUS');
    });

    it('enforces ContentFilter on task titles, comments, mentor application headlines, and project invites without echoing banned words', async () => {
      const ownerToken = ctx.loginAs('1');
      const collabToken = ctx.loginAs('2');

      const badTaskRes = await request(server)
        .post('/tasks')
        .set('Authorization', ownerToken)
        .send({
          projectId: 'proj-1',
          title: 'Fix this fucking bug',
          dueDate: '2028-05-01',
        });
      expect(badTaskRes.status).toBe(400);
      expect(badTaskRes.body.code).toBe('CONTENT_NOT_ALLOWED');
      expect(JSON.stringify(badTaskRes.body).toLowerCase()).not.toContain('fuck');

      const projA = ctx.projectsService.findById('proj-1');
      const validDueDate = projA?.dueDate
        ? new Date(new Date(projA.dueDate).getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        : new Date(ctx.clockService.now().getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const goodTaskRes = await request(server)
        .post('/tasks')
        .set('Authorization', ownerToken)
        .send({
          projectId: 'proj-1',
          title: 'Clean task for comment test',
          dueDate: validDueDate,
        });
      expect(goodTaskRes.status).toBe(201);

      const badCommentRes = await request(server)
        .post(`/tasks/${goodTaskRes.body.id}/comments`)
        .set('Authorization', collabToken)
        .send({ text: 'Stop acting like an asshole' });
      expect(badCommentRes.status).toBe(400);
      expect(badCommentRes.body.code).toBe('CONTENT_NOT_ALLOWED');
      expect(JSON.stringify(badCommentRes.body).toLowerCase()).not.toContain('asshole');

      const inviteTarget = ctx.usersRepository.findById('3');
      const badInviteRes = await request(server)
        .post('/projects/proj-1/invites')
        .set('Authorization', ownerToken)
        .send({
          username: inviteTarget?.username || 'rohan_mehta',
          message: 'Stop being a fucking fool and join this',
        });
      expect(badInviteRes.status).toBe(400);
      expect(badInviteRes.body.code).toBe('CONTENT_NOT_ALLOWED');

      const appSignup = await request(server)
        .post('/auth/signup')
        .send({
          name: 'Fresh Applicant',
          email: 'fresh.app.p20@example.com',
          password: 'Password123!',
          role: 'Collaborator',
        });
      expect(appSignup.status).toBe(201);
      await request(server)
        .post('/auth/profile')
        .set('Authorization', `Bearer ${appSignup.body.accessToken}`)
        .send({ name: 'Fresh Applicant', username: 'fresh_applicant_p20' })
        .expect(200);
      const rawAppUser = ctx.usersRepository.findById(appSignup.body.user.id);
      if (rawAppUser) rawAppUser.emailVerified = true;
      const appLogin = await request(server)
        .post('/auth/login')
        .send({ identifier: 'fresh_applicant_p20', password: 'Password123!' });
      expect(appLogin.status).toBe(200);
      const freshApplicantToken = `Bearer ${appLogin.body.accessToken}`;

      const badMentorRes = await request(server)
        .post('/mentor-applications')
        .set('Authorization', freshApplicantToken)
        .send({
          userId: appSignup.body.user.id,
          name: 'Fresh Applicant',
          headline: 'No bullshit bullshit fucking mentor',
          bio: 'Experienced mentor in distributed backend systems',
          yearsOfExperience: 7,
          email: 'fresh.app.p20@example.com',
          cvFileName: 'sample.pdf',
        });
      expect(badMentorRes.status).toBe(400);
      expect(badMentorRes.body.code).toBe('CONTENT_NOT_ALLOWED');
      expect(JSON.stringify(badMentorRes.body).toLowerCase()).not.toContain('fuck');
    });
  });

  describe('2. Notification Ownership & Admin-Only System POST', () => {
    it('isolates notifications per user (404 NOTIFICATION_NOT_FOUND + audit on cross-user access) and restricts POST to admin/superuser', async () => {
      const userAToken = ctx.loginAs('1');
      const userBToken = ctx.loginAs('2');
      const adminToken = ctx.loginAs('admin');

      const userANotif = ctx.notificationsService.create({
        userId: '1',
        type: 'PROJECT_UPDATE',
        title: 'Private Alert',
        message: 'Private notification specifically for user one.',
        readStatus: false,
        priority: 'immediate',
        bypassDigest: true,
      });

      // User B tries GET /notifications/:id, PUT /notifications/:id, PUT /read, DELETE /notifications/:id
      const getOther = await request(server)
        .get(`/notifications/${userANotif.id}`)
        .set('Authorization', userBToken);
      expect(getOther.status).toBe(404);
      expect(getOther.body.code).toBe('NOTIFICATION_NOT_FOUND');

      const putOther = await request(server)
        .put(`/notifications/${userANotif.id}`)
        .set('Authorization', userBToken)
        .send({ readStatus: true });
      expect(putOther.status).toBe(404);
      expect(putOther.body.code).toBe('NOTIFICATION_NOT_FOUND');

      const readOther = await request(server)
        .put(`/notifications/${userANotif.id}/read`)
        .set('Authorization', userBToken);
      expect(readOther.status).toBe(404);
      expect(readOther.body.code).toBe('NOTIFICATION_NOT_FOUND');

      const delOther = await request(server)
        .delete(`/notifications/${userANotif.id}`)
        .set('Authorization', userBToken);
      expect(delOther.status).toBe(404);
      expect(delOther.body.code).toBe('NOTIFICATION_NOT_FOUND');

      const notifAudits = ctx.auditService
        .findAll()
        .filter((l: any) => l.action === 'ACCESS_DENIED_NOTIFICATION');
      expect(notifAudits.length).toBeGreaterThanOrEqual(4);

      // User B querying ?userId=1 still receives only User B's notifications (not User A's)
      const queryOther = await request(server)
        .get('/notifications?userId=1')
        .set('Authorization', userBToken);
      expect(queryOther.status).toBe(200);
      expect(queryOther.body.some((n: any) => n.id === userANotif.id)).toBe(false);

      // User A can read own notification
      const getOwn = await request(server)
        .get(`/notifications/${userANotif.id}`)
        .set('Authorization', userAToken);
      expect(getOwn.status).toBe(200);
      expect(getOwn.body.id).toBe(userANotif.id);

      // Collaborator cannot POST /notifications -> 403
      const collabPost = await request(server)
        .post('/notifications')
        .set('Authorization', userBToken)
        .send({ userId: '1', message: 'Forged system message from collab' });
      expect(collabPost.status).toBe(403);

      // Admin validation: message too short or missing userId -> 400
      const shortPost = await request(server)
        .post('/notifications')
        .set('Authorization', adminToken)
        .send({ userId: '1', message: 'short' });
      expect(shortPost.status).toBe(400);

      // Admin valid notification -> 201
      const validPost = await request(server)
        .post('/notifications')
        .set('Authorization', adminToken)
        .send({ userId: '1', message: 'Scheduled maintenance tonight at 11 PM UTC.' });
      expect(validPost.status).toBe(201);
      expect(validPost.body.userId).toBe('1');
    });
  });

  describe('3. Uploads Magic-Bytes, SVG Blocking, Safe Headers & CV RBAC', () => {
    it('rejects SVG and disguised text-as-PNG with 400 UNSUPPORTED_FILE_TYPE + UPLOAD_REJECTED audit, serves safe files with nosniff/attachment', async () => {
      const userToken = ctx.loginAs('1');

      // 1. Upload .svg -> 400 UNSUPPORTED_FILE_TYPE
      const svgRes = await request(server)
        .post('/uploads/avatar')
        .set('Authorization', userToken)
        .attach('file', SVG_PAYLOAD, { filename: 'xss.svg', contentType: 'image/svg+xml' });
      expect(svgRes.status).toBe(400);
      expect(svgRes.body.code).toBe('UNSUPPORTED_FILE_TYPE');

      // 2. Upload plain text named malicious.png -> 400 UNSUPPORTED_FILE_TYPE
      const disguisedRes = await request(server)
        .post('/uploads/avatar')
        .set('Authorization', userToken)
        .attach('file', Buffer.from('not really a png image!'), {
          filename: 'fake.png',
          contentType: 'image/png',
        });
      expect(disguisedRes.status).toBe(400);
      expect(disguisedRes.body.code).toBe('UNSUPPORTED_FILE_TYPE');

      const uploadRejects = ctx.auditService
        .findAll()
        .filter((l: any) => l.action === 'UPLOAD_REJECTED');
      expect(uploadRejects.length).toBeGreaterThanOrEqual(2);

      // 3. Upload valid PNG -> 201, served with nosniff
      const pngRes = await request(server)
        .post('/uploads/avatar')
        .set('Authorization', userToken)
        .attach('file', VALID_PNG, { filename: 'avatar.png', contentType: 'image/png' });
      expect(pngRes.status).toBe(201);
      createdUploadPaths.push(path.join(UPLOADS_DIR, pngRes.body.filename));

      const fetchPng = await request(server).get(`/uploads/${pngRes.body.filename}`);
      expect(fetchPng.status).toBe(200);
      expect(fetchPng.headers['x-content-type-options']).toBe('nosniff');
      expect(fetchPng.headers['content-type']).toContain('image/png');

      // 4. Upload valid PDF to /uploads/resource -> served with nosniff + Content-Disposition: attachment
      const pdfRes = await request(server)
        .post('/uploads/resource')
        .set('Authorization', userToken)
        .attach('file', VALID_PDF, { filename: 'spec.pdf', contentType: 'application/pdf' });
      expect(pdfRes.status).toBe(201);
      createdUploadPaths.push(path.join(UPLOADS_DIR, pdfRes.body.filename));

      const fetchPdf = await request(server).get(`/uploads/${pdfRes.body.filename}`);
      expect(fetchPdf.status).toBe(200);
      expect(fetchPdf.headers['x-content-type-options']).toBe('nosniff');
      expect(String(fetchPdf.headers['content-disposition'])).toContain('attachment');

      // 5. Pre-existing stored SVG in uploads/ is refused with 404
      const legacySvgName = `legacy-${Date.now()}.svg`;
      const legacySvgPath = path.join(UPLOADS_DIR, legacySvgName);
      fs.writeFileSync(legacySvgPath, SVG_PAYLOAD);
      createdUploadPaths.push(legacySvgPath);

      const fetchSvg = await request(server).get(`/uploads/${legacySvgName}`);
      expect(fetchSvg.status).toBe(404);
    });

    it('restricts GET /uploads/cv/:filename to applicant, mentor_apps admin, and superuser', async () => {
      const applicantToken = ctx.loginAs('3');
      const otherToken = ctx.loginAs('2');
      const superuserToken = ctx.loginAs('superuser', ['*']);
      const mentorAppsAdminToken = ctx.loginAs('admin', ['mentor_apps']);
      const revenueOnlyAdminToken = ctx.loginAs('admin', ['revenue']);

      // Ensure an application exists referencing this CV for user '3'
      const cvRes = await request(server)
        .post('/uploads/cv')
        .set('Authorization', applicantToken)
        .attach('file', VALID_PDF, { filename: 'priya-cv.pdf', contentType: 'application/pdf' });
      expect(cvRes.status).toBe(201);
      const cvFilename = cvRes.body.filename;
      createdUploadPaths.push(path.join(SECURE_CVS_DIR, cvFilename));

      // Seed application record tied to user '3'
      const mentorAppsSvc = ctx.app.get(MentorApplicationsService);
      (mentorAppsSvc as any).items.push({
        id: 'app-p20-1',
        userId: '3',
        name: 'Priya Nair',
        email: 'priya@example.com',
        cvFileName: cvFilename,
        status: 'pending',
      });

      // Applicant can download own CV -> 200 with nosniff & attachment
      const ownGet = await request(server)
        .get(`/uploads/cv/${cvFilename}`)
        .set('Authorization', applicantToken);
      expect(ownGet.status).toBe(200);
      expect(ownGet.headers['x-content-type-options']).toBe('nosniff');
      expect(String(ownGet.headers['content-disposition'])).toContain('attachment');

      // Admin without mentor_apps permission -> 403 on GET
      const revAdminGet = await request(server)
        .get(`/uploads/cv/${cvFilename}`)
        .set('Authorization', revenueOnlyAdminToken);
      expect(revAdminGet.status).toBe(403);

      // Unrelated regular user -> 403
      const outsiderGet = await request(server)
        .get(`/uploads/cv/${cvFilename}`)
        .set('Authorization', otherToken);
      expect(outsiderGet.status).toBe(403);

      // Admin WITH mentor_apps permission -> 200 with nosniff & attachment
      const mentorAdminGet = await request(server)
        .get(`/uploads/cv/${cvFilename}`)
        .set('Authorization', mentorAppsAdminToken);
      expect(mentorAdminGet.status).toBe(200);
      expect(mentorAdminGet.headers['x-content-type-options']).toBe('nosniff');
      expect(String(mentorAdminGet.headers['content-disposition'])).toContain('attachment');

      // Superuser -> 200
      const suGet = await request(server)
        .get(`/uploads/cv/${cvFilename}`)
        .set('Authorization', superuserToken);
      expect(suGet.status).toBe(200);
    });
  });

  describe('4. Admin Login Throttle & EmailVerifiedGuard Expansion', () => {
    it('throttles admin login on 11th attempt with 429 TOO_MANY_ATTEMPTS, retryAt, and ADMIN_LOGIN_THROTTLED audit', async () => {
      // Check unknown admin vs wrong password produce identical response shape
      const unknownRes = await request(server)
        .post('/admin/login')
        .send({ email: 'nobody@teamforge.io', password: 'WrongPassword!' });
      expect(unknownRes.status).toBe(401);
      expect(unknownRes.body.code).toBe('INVALID_CREDENTIALS');

      const targetAdmin = 'admin@teamforge.io';
      for (let i = 0; i < 10; i++) {
        const res = await request(server)
          .post('/admin/login')
          .send({ email: targetAdmin, password: `WrongPass#${i}` });
        expect(res.status).toBe(401);
        expect(res.body.code).toBe('INVALID_CREDENTIALS');
        expect(res.body.message).toBe(unknownRes.body.message);
      }

      const throttledRes = await request(server)
        .post('/admin/login')
        .send({ email: targetAdmin, password: 'WrongPass#10' });
      expect(throttledRes.status).toBe(429);
      expect(throttledRes.body.code).toBe('TOO_MANY_ATTEMPTS');
      expect(throttledRes.body.retryAt).toBeDefined();

      const adminThrottleAudit = ctx.auditService
        .findAll()
        .find((l: any) => l.action === 'ADMIN_LOGIN_THROTTLED');
      expect(adminThrottleAudit).toBeDefined();
    });

    it('blocks unverified users (403 EMAIL_NOT_VERIFIED) on invite accept, mentor apply, report, dispute, and data export', async () => {
      const signupRes = await request(server)
        .post('/auth/signup')
        .send({
          name: 'Unverified Phase Twenty',
          email: 'unverified.p20@example.com',
          password: 'Password123!',
          role: 'Collaborator',
        });
      expect(signupRes.status).toBe(201);
      await request(server)
        .post('/auth/profile')
        .set('Authorization', `Bearer ${signupRes.body.accessToken}`)
        .send({ name: 'Unverified Phase Twenty', username: 'unverified_p20' })
        .expect(200);

      const loginRes = await request(server)
        .post('/auth/login')
        .send({ identifier: 'unverified_p20', password: 'Password123!' });
      expect(loginRes.status).toBe(200);
      const unverifiedToken = `Bearer ${loginRes.body.accessToken}`;

      const invRes = await request(server)
        .post('/invites/inv-fake/accept')
        .set('Authorization', unverifiedToken);
      expect(invRes.status).toBe(403);
      expect(invRes.body.code).toBe('EMAIL_NOT_VERIFIED');

      const mentorRes = await request(server)
        .post('/mentor-applications')
        .set('Authorization', unverifiedToken)
        .send({ name: 'Test User', email: 'unverified.p20@example.com', yearsOfExperience: 6 });
      expect(mentorRes.status).toBe(403);
      expect(mentorRes.body.code).toBe('EMAIL_NOT_VERIFIED');

      const reportRes = await request(server)
        .post('/reports')
        .set('Authorization', unverifiedToken)
        .send({
          reportedUserId: '1',
          reason: 'Harassment',
          details: 'Detailed explanation that exceeds twenty characters.',
        });
      expect(reportRes.status).toBe(403);
      expect(reportRes.body.code).toBe('EMAIL_NOT_VERIFIED');

      const disputeRes1 = await request(server)
        .post('/mentor-sessions/sess-1/dispute')
        .set('Authorization', unverifiedToken)
        .send({ reason: 'Mentor did not show up to the scheduled session.' });
      expect(disputeRes1.status).toBe(403);
      expect(disputeRes1.body.code).toBe('EMAIL_NOT_VERIFIED');

      const disputeRes2 = await request(server)
        .post('/mentor-marketplace/sessions/sess-1/dispute')
        .set('Authorization', unverifiedToken)
        .send({ reason: 'Mentor did not show up to the scheduled session.' });
      expect(disputeRes2.status).toBe(403);
      expect(disputeRes2.body.code).toBe('EMAIL_NOT_VERIFIED');

      const exportRes = await request(server)
        .post('/users/me/export')
        .set('Authorization', unverifiedToken);
      expect(exportRes.status).toBe(403);
      expect(exportRes.body.code).toBe('EMAIL_NOT_VERIFIED');
    });
  });
});
