import request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';
import { createTestApp, TestAppContext } from './helpers/test-helpers';
import { MentorApplicationsService } from '../src/mentor-applications/mentor-applications.service';
import { SECURE_CVS_DIR } from '../src/core/middleware/file-upload.middleware';
import { UserRole, UserStatus } from '../src/users/dto/create-user.dto';

describe('Phase 5: CV Delete Option Removal & Internal Cleanup Verification (E2E)', () => {
  let ctx: TestAppContext;
  let server: any;

  const VALID_PDF = Buffer.from(
    '%PDF-1.4\n1 0 obj\n<< /Title (Phase 5 CV Delete Removal Verification) >>\nendobj\ntrailer\n%%EOF',
  );

  const createdFilePaths: string[] = [];

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.app.getHttpServer();
  });

  beforeEach(() => {
    ctx.resetStores();
  });

  afterAll(async () => {
    for (const p of createdFilePaths) {
      try {
        if (fs.existsSync(p)) {
          fs.unlinkSync(p);
        }
      } catch {}
    }
    if (ctx?.app) {
      await ctx.app.close();
    }
  });

  describe('1. Removed CV Delete Endpoints Return 404 for All Callers', () => {
    it('returns 404 on DELETE /uploads/cv/:filename for applicant, admin, and Super User', async () => {
      const applicantToken = ctx.loginAs('2');
      const adminToken = ctx.loginAs('admin', ['mentor_apps']);
      const superuserToken = ctx.loginAs('superuser', ['*']);

      const testFilename = 'candidate-resume-sample.pdf';

      // 1. Applicant caller
      const resApplicant = await request(server)
        .delete(`/uploads/cv/${testFilename}`)
        .set('Authorization', applicantToken);
      expect(resApplicant.status).toBe(404);

      // 2. Admin caller with mentor_apps
      const resAdmin = await request(server)
        .delete(`/uploads/cv/${testFilename}`)
        .set('Authorization', adminToken);
      expect(resAdmin.status).toBe(404);

      // 3. Super User caller
      const resSuper = await request(server)
        .delete(`/uploads/cv/${testFilename}`)
        .set('Authorization', superuserToken);
      expect(resSuper.status).toBe(404);

      // 4. Unauthenticated caller
      const resUnauth = await request(server).delete(`/uploads/cv/${testFilename}`);
      expect(resUnauth.status).toBe(404);
    });

    it('returns 404 on DELETE /mentor-applications/:id/cv for applicant, admin, and Super User', async () => {
      const applicantToken = ctx.loginAs('2');
      const adminToken = ctx.loginAs('admin', ['mentor_apps']);
      const superuserToken = ctx.loginAs('superuser', ['*']);

      const appId = 'app-sample-id-123';

      // 1. Applicant caller
      const resApplicant = await request(server)
        .delete(`/mentor-applications/${appId}/cv`)
        .set('Authorization', applicantToken);
      expect(resApplicant.status).toBe(404);

      // 2. Admin caller with mentor_apps
      const resAdmin = await request(server)
        .delete(`/mentor-applications/${appId}/cv`)
        .set('Authorization', adminToken);
      expect(resAdmin.status).toBe(404);

      // 3. Super User caller
      const resSuper = await request(server)
        .delete(`/mentor-applications/${appId}/cv`)
        .set('Authorization', superuserToken);
      expect(resSuper.status).toBe(404);

      // 4. Unauthenticated caller
      const resUnauth = await request(server).delete(`/mentor-applications/${appId}/cv`);
      expect(resUnauth.status).toBe(404);
    });
  });

  describe('2. CV View and Download Retain Strict Permissions and Security Headers', () => {
    it('allows GET /uploads/cv/:filename for applicant, mentor_apps admin, and superuser; rejects unauthorized with 403', async () => {
      const applicantUser = ctx.usersRepository.create({
        name: 'Arjun Applicant',
        username: 'arjun_applicant_p5',
        email: 'arjun.applicant.p5@example.com',
        password: 'Password123!',
        role: UserRole.Collaborator,
        emailVerified: true,
        status: UserStatus.Active,
      } as any);

      const applicantToken = ctx.loginAs(applicantUser.id, [], {
        email: applicantUser.email,
        role: 'collaborator',
      });
      const otherToken = ctx.loginAs('2');
      const mentorAppsAdminToken = ctx.loginAs('admin', ['mentor_apps']);
      const otherAdminToken = ctx.loginAs('admin', ['revenue']);
      const superuserToken = ctx.loginAs('superuser', ['*']);

      // 1. Applicant uploads a CV
      const uploadRes = await request(server)
        .post('/uploads/cv')
        .set('Authorization', applicantToken)
        .attach('file', VALID_PDF, { filename: 'arjun-resume.pdf', contentType: 'application/pdf' });
      expect(uploadRes.status).toBe(201);
      const cvFilename = uploadRes.body.filename;
      createdFilePaths.push(path.join(SECURE_CVS_DIR, cvFilename));

      // 2. Seed a Mentor Application linking user to this CV
      const mentorAppsSvc = ctx.app.get(MentorApplicationsService);
      (mentorAppsSvc as any).items.push({
        id: 'app-p5-test-1',
        userId: applicantUser.id,
        name: applicantUser.name,
        email: applicantUser.email,
        cvFileName: cvFilename,
        status: 'pending',
      });

      // 3. Applicant can download own CV -> 200 with security headers
      const ownRes = await request(server)
        .get(`/uploads/cv/${cvFilename}`)
        .set('Authorization', applicantToken);
      expect(ownRes.status).toBe(200);
      expect(ownRes.headers['x-content-type-options']).toBe('nosniff');
      expect(String(ownRes.headers['content-disposition'])).toContain('attachment');

      // 4. Admin WITH mentor_apps permission -> 200
      const adminRes = await request(server)
        .get(`/uploads/cv/${cvFilename}`)
        .set('Authorization', mentorAppsAdminToken);
      expect(adminRes.status).toBe(200);
      expect(adminRes.headers['x-content-type-options']).toBe('nosniff');

      // 5. Super User -> 200
      const superRes = await request(server)
        .get(`/uploads/cv/${cvFilename}`)
        .set('Authorization', superuserToken);
      expect(superRes.status).toBe(200);

      // 6. Admin WITHOUT mentor_apps permission -> 403 FORBIDDEN
      const noPermAdminRes = await request(server)
        .get(`/uploads/cv/${cvFilename}`)
        .set('Authorization', otherAdminToken);
      expect(noPermAdminRes.status).toBe(403);

      // 7. Unrelated collaborator -> 403 FORBIDDEN
      const outsiderRes = await request(server)
        .get(`/uploads/cv/${cvFilename}`)
        .set('Authorization', otherToken);
      expect(outsiderRes.status).toBe(403);

      // 8. Unauthenticated -> 401 UNAUTHORIZED
      const unauthRes = await request(server).get(`/uploads/cv/${cvFilename}`);
      expect(unauthRes.status).toBe(401);
    });
  });

  describe('3. Account Deletion Cleans Up CV Files via Internal Service Method', () => {
    it('removes stored CV file from disk when user deletes account without calling HTTP delete routes', async () => {
      const userToDelete = ctx.usersRepository.create({
        name: 'Deleting User',
        username: 'cv_cleanup_user',
        email: 'cv.cleanup@example.com',
        password: 'Password123!',
        role: UserRole.Collaborator,
        emailVerified: true,
        status: UserStatus.Active,
      } as any);

      const userToken = ctx.loginAs(userToDelete.id, [], {
        email: userToDelete.email,
        role: 'collaborator',
      });

      // 1. Upload CV file to SECURE_CVS_DIR
      const uploadRes = await request(server)
        .post('/uploads/cv')
        .set('Authorization', userToken)
        .attach('file', VALID_PDF, { filename: 'cv-to-cleanup.pdf', contentType: 'application/pdf' });
      expect(uploadRes.status).toBe(201);
      const cvFilename = uploadRes.body.filename;
      const cvDiskPath = path.join(SECURE_CVS_DIR, cvFilename);
      createdFilePaths.push(cvDiskPath);

      // Verify file exists on disk
      expect(fs.existsSync(cvDiskPath)).toBe(true);

      // 2. Link CV to mentor application
      const mentorAppsSvc = ctx.app.get(MentorApplicationsService);
      (mentorAppsSvc as any).items.push({
        id: 'app-p5-cleanup-1',
        userId: userToDelete.id,
        name: userToDelete.name,
        email: userToDelete.email,
        cvFileName: cvFilename,
        status: 'pending',
      });

      // 3. User deletes account via self-service POST /users/me/delete
      const delAccountRes = await request(server)
        .post('/users/me/delete')
        .set('Authorization', userToken)
        .send({ username: 'cv_cleanup_user' });
      expect(delAccountRes.status).toBe(200);
      expect(delAccountRes.body.success).toBe(true);

      // 4. Verify internal cleanup removed the CV file from disk
      expect(fs.existsSync(cvDiskPath)).toBe(false);
    });
  });
});
