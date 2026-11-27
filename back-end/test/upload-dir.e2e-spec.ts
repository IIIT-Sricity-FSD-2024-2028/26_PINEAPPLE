import request from 'supertest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createTestApp, TestAppContext } from './helpers/test-helpers';
import { MentorApplicationsService } from '../src/mentor-applications/mentor-applications.service';
import { StartupCleanupService } from '../src/system/startup-cleanup.service';
import { getSecureCvsDir, getUploadsDir } from '../src/core/middleware/file-upload.middleware';

describe('UPLOAD_DIR Lifecycle, Storage, Permissions & Cleanup (E2E)', () => {
  let ctx: TestAppContext;
  let server: any;
  let tempRoot: string;
  let customUploadDir: string;

  const originalEnv = {
    UPLOAD_DIR: process.env.UPLOAD_DIR,
    UPLOADS_DIR: process.env.UPLOADS_DIR,
    SECURE_CVS_DIR: process.env.SECURE_CVS_DIR,
  };

  const VALID_PDF = Buffer.from(
    '%PDF-1.4\n1 0 obj\n<< /Title (UPLOAD_DIR E2E CV) >>\nendobj\ntrailer\n%%EOF',
  );
  const VALID_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  );

  beforeAll(async () => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-e2e-upload-dir-'));
    customUploadDir = path.join(tempRoot, 'runtime-uploads');
    process.env.UPLOAD_DIR = customUploadDir;
    delete process.env.UPLOADS_DIR;
    delete process.env.SECURE_CVS_DIR;

    ctx = await createTestApp();
    server = ctx.app.getHttpServer();
  });

  beforeEach(() => {
    ctx.resetStores();
  });

  afterAll(async () => {
    if (ctx?.app) {
      await ctx.app.close();
    }
    for (const [k, v] of Object.entries(originalEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('creates UPLOAD_DIR on startup, stores uploaded CVs and avatars there, enforces CV permissions, and cleans orphans', async () => {
    expect(fs.existsSync(getUploadsDir())).toBe(true);
    expect(fs.existsSync(getSecureCvsDir())).toBe(true);
    expect(getUploadsDir()).toBe(path.resolve(customUploadDir));
    expect(getSecureCvsDir()).toBe(path.join(path.resolve(customUploadDir), 'secure-cvs'));

    const applicantToken = ctx.loginAs('6');
    const outsiderToken = ctx.loginAs('2');
    const mentorAppsAdminToken = ctx.loginAs('admin', ['mentor_apps']);
    const revenueAdminToken = ctx.loginAs('admin', ['revenue']);

    // 1. Upload CV -> lands inside UPLOAD_DIR/secure-cvs
    const cvRes = await request(server)
      .post('/uploads/cv')
      .set('Authorization', applicantToken)
      .attach('file', VALID_PDF, { filename: 'aditya-cv.pdf', contentType: 'application/pdf' });
    expect(cvRes.status).toBe(201);
    const cvFilename = cvRes.body.filename;
    const expectedCvPath = path.join(getSecureCvsDir(), cvFilename);
    expect(fs.existsSync(expectedCvPath)).toBe(true);

    // Register application referencing CV for permission check
    const mentorAppsSvc = ctx.app.get(MentorApplicationsService);
    (mentorAppsSvc as any).items.push({
      id: 'app-upload-dir-1',
      userId: '6',
      name: 'Aditya Sai',
      email: 'aditya.sai@teamforge.io',
      cvFileName: cvFilename,
      cvUrl: `/uploads/cv/${cvFilename}`,
      status: 'pending',
    });

    // 2. Permission checks on GET /uploads/cv/:filename
    const ownRes = await request(server)
      .get(`/uploads/cv/${cvFilename}`)
      .set('Authorization', applicantToken);
    expect(ownRes.status).toBe(200);

    const adminRes = await request(server)
      .get(`/uploads/cv/${cvFilename}`)
      .set('Authorization', mentorAppsAdminToken);
    expect(adminRes.status).toBe(200);

    const outsiderRes = await request(server)
      .get(`/uploads/cv/${cvFilename}`)
      .set('Authorization', outsiderToken);
    expect(outsiderRes.status).toBe(403);

    const wrongAdminRes = await request(server)
      .get(`/uploads/cv/${cvFilename}`)
      .set('Authorization', revenueAdminToken);
    expect(wrongAdminRes.status).toBe(403);

    // 3. Upload Avatar -> lands inside UPLOAD_DIR and is served from UPLOAD_DIR
    const avatarRes = await request(server)
      .post('/uploads/avatar')
      .set('Authorization', applicantToken)
      .attach('file', VALID_PNG, { filename: 'avatar.png', contentType: 'image/png' });
    expect(avatarRes.status).toBe(201);
    const expectedAvatarPath = path.join(getUploadsDir(), avatarRes.body.filename);
    expect(fs.existsSync(expectedAvatarPath)).toBe(true);

    const serveAvatarRes = await request(server).get(`/uploads/${avatarRes.body.filename}`);
    expect(serveAvatarRes.status).toBe(200);

    // 4. StartupCleanupService removes unreferenced orphan files from UPLOAD_DIR & secure-cvs
    const orphanUploadPath = path.join(getUploadsDir(), 'orphan-upload.png');
    const orphanCvPath = path.join(getSecureCvsDir(), 'orphan-cv.pdf');
    fs.writeFileSync(orphanUploadPath, VALID_PNG);
    fs.writeFileSync(orphanCvPath, VALID_PDF);

    const startupCleanup = ctx.app.get(StartupCleanupService);
    const summary = startupCleanup.cleanOrphanFilesOnStartup();
    expect(summary.enabled).toBe(true);
    expect(fs.existsSync(orphanUploadPath)).toBe(false);
    expect(fs.existsSync(orphanCvPath)).toBe(false);
    // Referenced CV from active application is kept
    expect(fs.existsSync(expectedCvPath)).toBe(true);
  });

  it('serves avatars and CVs from the default .runtime/uploads directory without Express dotfile 404s', async () => {
    delete process.env.UPLOAD_DIR;

    const applicantToken = ctx.loginAs('6');
    const createdFiles: string[] = [];
    try {
      const avatarRes = await request(server)
        .post('/uploads/avatar')
        .set('Authorization', applicantToken)
        .attach('file', VALID_PNG, { filename: 'default-dir-avatar.png', contentType: 'image/png' });
      expect(avatarRes.status).toBe(201);
      createdFiles.push(path.join(getUploadsDir(), avatarRes.body.filename));

      const serveAvatarRes = await request(server).get(`/uploads/${avatarRes.body.filename}`);
      expect(serveAvatarRes.status).toBe(200);

      const cvRes = await request(server)
        .post('/uploads/cv')
        .set('Authorization', applicantToken)
        .attach('file', VALID_PDF, { filename: 'default-dir-cv.pdf', contentType: 'application/pdf' });
      expect(cvRes.status).toBe(201);
      createdFiles.push(path.join(getSecureCvsDir(), cvRes.body.filename));

      const mentorAppsSvc = ctx.app.get(MentorApplicationsService);
      (mentorAppsSvc as any).items.push({
        id: 'app-upload-dir-default',
        userId: '6',
        name: 'Aditya Sai',
        email: 'aditya.sai@teamforge.io',
        cvFileName: cvRes.body.filename,
        cvUrl: `/uploads/cv/${cvRes.body.filename}`,
        status: 'pending',
      });

      const downloadCvRes = await request(server)
        .get(`/uploads/cv/${cvRes.body.filename}`)
        .set('Authorization', applicantToken);
      expect(downloadCvRes.status).toBe(200);
    } finally {
      for (const filePath of createdFiles) {
        fs.rmSync(filePath, { force: true });
      }
      process.env.UPLOAD_DIR = customUploadDir;
    }
  });
});
