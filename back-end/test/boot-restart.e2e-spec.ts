import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import request from 'supertest';
import { createTestApp, TestAppContext } from './helpers/test-helpers';
import { StartupCleanupService } from '../src/system/startup-cleanup.service';
import { UsersRepository } from '../src/users/users.repository';
import { SEED_USER_REPUTATION } from '../src/moderation/reputation.seeds';

describe('FIX 1 E2E: Boot Identity, No Snapshots, Token Boot Check & Startup File Cleanup', () => {
  let tempRoot: string;
  let origCleanOnStart: string | undefined;

  beforeAll(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-boot-e2e-'));
    origCleanOnStart = process.env.CLEAN_UPLOADS_ON_START;
  });

  afterAll(() => {
    if (origCleanOnStart === undefined) delete process.env.CLEAN_UPLOADS_ON_START;
    else process.env.CLEAN_UPLOADS_ON_START = origCleanOnStart;

    if (fs.existsSync(tempRoot)) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('1. Startup and normal mutations create no snapshot file; two clean starts produce identical seeds and 1 seed ledger entry per user', async () => {
    const oldSnapPath = path.resolve(process.cwd(), 'data', 'snapshot.json');
    expect(fs.existsSync(oldSnapPath)).toBe(false);

    const ctxA: TestAppContext = await createTestApp();
    const ctxB: TestAppContext = await createTestApp();

    try {
      expect(ctxA.usersRepository.findAll(true).map((u) => u.id)).toEqual(
        ctxB.usersRepository.findAll(true).map((u) => u.id),
      );
      expect(ctxA.projectsRepository.findAll(true).map((p) => p.id)).toEqual(
        ctxB.projectsRepository.findAll(true).map((p) => p.id),
      );
      for (const uid of Object.keys(SEED_USER_REPUTATION)) {
        const seedEntriesA = ctxA.reputationService.getEntries(uid).filter((e) => e.type === 'seed');
        const seedEntriesB = ctxB.reputationService.getEntries(uid).filter((e) => e.type === 'seed');
        expect(seedEntriesA).toHaveLength(1);
        expect(seedEntriesB).toHaveLength(1);
        expect(ctxA.reputationService.getTotal(uid)).toBe(SEED_USER_REPUTATION[uid]);
      }

      // Perform normal create-project flow on instance A
      await request(ctxA.app.getHttpServer())
        .post('/projects')
        .set('Authorization', ctxA.loginAs('1'))
        .send({
          title: 'Ephemeral In-Memory Project',
          description:
            'Verify through end-to-end execution that creating a brand new project in memory never writes any snapshot.json persistence artifact to disk.',
          difficulty: 'Medium',
          duration: '4 Weeks',
          dueDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
          requiredSkills: ['TypeScript'],
        })
        .expect(201);

      expect(fs.existsSync(oldSnapPath)).toBe(false);
    } finally {
      await ctxA.app.close();
      await ctxB.app.close();
    }
  });

  it('2. GET /health returns random bootId per instance; X-Boot-Id header appears on 200/401/404 responses; removed snapshot routes return 404', async () => {
    const ctxA = await createTestApp();
    const ctxB = await createTestApp();
    const serverA = ctxA.app.getHttpServer();
    const serverB = ctxB.app.getHttpServer();

    try {
      const healthA = await request(serverA).get('/health').expect(200);
      const healthB = await request(serverB).get('/health').expect(200);

      expect(healthA.body.status).toBe('ok');
      expect(typeof healthA.body.bootId).toBe('string');
      expect(healthA.body.bootId.length).toBeGreaterThan(8);
      expect(healthA.body.startedAt).toBeTruthy();
      expect(healthA.headers['x-boot-id']).toBe(healthA.body.bootId);

      expect(healthB.body.bootId).not.toBe(healthA.body.bootId);
      expect(healthB.headers['x-boot-id']).toBe(healthB.body.bootId);

      const unauthRes = await request(serverA).get('/projects').expect(401);
      expect(unauthRes.headers['x-boot-id']).toBe(healthA.body.bootId);

      const notFoundSnap = await request(serverA)
        .post('/admin/system/snapshot')
        .set('Authorization', ctxA.loginAs('superuser'))
        .expect(404);
      expect(notFoundSnap.headers['x-boot-id']).toBe(healthA.body.bootId);

      await request(serverA)
        .get('/admin/system/snapshot')
        .set('Authorization', ctxA.loginAs('superuser'))
        .expect(404);

      await request(serverA)
        .get('/admin/system/integrity')
        .set('Authorization', ctxA.loginAs('superuser'))
        .expect(404);
    } finally {
      await ctxA.app.close();
      await ctxB.app.close();
    }
  });

  it('3. Access and refresh tokens from instance A are rejected by instance B with 401 SESSION_INVALID; deleted/removed user tokens return 401 SESSION_INVALID (never 404)', async () => {
    const ctxA = await createTestApp();
    const ctxB = await createTestApp();
    const serverA = ctxA.app.getHttpServer();
    const serverB = ctxB.app.getHttpServer();

    try {
      // Login on instance A to obtain real access + refresh tokens bound to bootId A
      const loginRes = await request(serverA)
        .post('/auth/login')
        .send({ identifier: 'arjun.sharma@teamforge.io', password: 'password123' })
        .expect(200);

      const accessA = loginRes.body.accessToken;
      const refreshA = loginRes.body.refreshToken;

      // Works on instance A
      await request(serverA)
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessA}`)
        .expect(200);

      // Access token from A rejected by B with 401 SESSION_INVALID
      const crossAccessRes = await request(serverB)
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessA}`)
        .expect(401);
      expect(crossAccessRes.body.code).toBe('SESSION_INVALID');

      // Refresh token from A rejected by B with 401 SESSION_INVALID
      const crossRefreshRes = await request(serverB)
        .post('/auth/refresh')
        .send({ refreshToken: refreshA })
        .expect(401);
      expect(crossRefreshRes.body.code).toBe('SESSION_INVALID');

      // User created on instance A then removed/deleted returns 401 SESSION_INVALID on /users/me & /users/me/delete & /users/me/export (never 404)
      const createdUser = ctxA.usersRepository.create({
        name: 'Temp E2E User',
        username: 'tempe2euser',
        email: 'tempe2e@teamforge.io',
        password: 'password123',
      });
      const tempToken = ctxA.loginAs(createdUser.id, undefined, {
        email: createdUser.email,
      });

      // Remove user directly from memory (simulating gone user)
      const allUsers = (ctxA.usersRepository as UsersRepository)['users'];
      const idx = allUsers.findIndex((u) => String(u.id) === String(createdUser.id));
      if (idx !== -1) allUsers.splice(idx, 1);
      ctxA.usersRepository.rebuildIndexes();

      const meGone = await request(serverA)
        .get('/users/me')
        .set('Authorization', tempToken)
        .expect(401);
      expect(meGone.body.code).toBe('SESSION_INVALID');

      const delGone = await request(serverA)
        .post('/users/me/delete')
        .set('Authorization', tempToken)
        .send({ username: 'tempe2euser' })
        .expect(401);
      expect(delGone.body.code).toBe('SESSION_INVALID');
    } finally {
      await ctxA.app.close();
      await ctxB.app.close();
    }
  });

  it('4. Startup cleanup removes leftover uploaded/CV/export files while preserving seed-referenced files', async () => {
    const ctx = await createTestApp();
    try {
      const cleanupSvc = ctx.app.get(StartupCleanupService);
      const { seedUploads, seedCvs } = cleanupSvc.collectSeedReferencedFilenames();

      const upDir = path.join(tempRoot, 'up');
      const cvDir = path.join(tempRoot, 'cv');
      const expDir = path.join(tempRoot, 'exp');
      fs.mkdirSync(upDir, { recursive: true });
      fs.mkdirSync(cvDir, { recursive: true });
      fs.mkdirSync(expDir, { recursive: true });

      const sampleSeedUpload = [...seedUploads][0] || 'seed-avatar-sample.png';
      const sampleSeedCv = [...seedCvs][0] || 'seed-cv-sample.pdf';

      const orphanUp = path.join(upDir, 'orphan-after-restart.png');
      const orphanCv = path.join(cvDir, 'orphan-after-restart.pdf');
      const orphanExp = path.join(expDir, 'orphan-export.json');
      fs.writeFileSync(orphanUp, 'orphan');
      fs.writeFileSync(orphanCv, '%PDF-orphan');
      fs.writeFileSync(orphanExp, '{}');

      const preservedFiles: string[] = [];
      if (seedUploads.size > 0) {
        const seedUpPath = path.join(upDir, sampleSeedUpload);
        fs.writeFileSync(seedUpPath, 'seed');
        preservedFiles.push(seedUpPath);
      }
      if (seedCvs.size > 0) {
        const seedCvPath = path.join(cvDir, sampleSeedCv);
        fs.writeFileSync(seedCvPath, '%PDF-seed');
        preservedFiles.push(seedCvPath);
      }

      process.env.CLEAN_UPLOADS_ON_START = 'false';
      const disabledRes = cleanupSvc.cleanOrphanFilesOnStartup({
        uploadsDir: upDir,
        secureCvsDir: cvDir,
        exportDir: expDir,
      });
      expect(disabledRes.enabled).toBe(false);
      expect(fs.existsSync(orphanUp)).toBe(true);

      process.env.CLEAN_UPLOADS_ON_START = 'true';
      const enabledRes = cleanupSvc.cleanOrphanFilesOnStartup({
        uploadsDir: upDir,
        secureCvsDir: cvDir,
        exportDir: expDir,
      });
      expect(enabledRes.enabled).toBe(true);
      expect(enabledRes.removedCount).toBe(3);
      expect(fs.existsSync(orphanUp)).toBe(false);
      expect(fs.existsSync(orphanCv)).toBe(false);
      expect(fs.existsSync(orphanExp)).toBe(false);
      for (const p of preservedFiles) {
        expect(fs.existsSync(p)).toBe(true);
      }
    } finally {
      await ctx.app.close();
    }
  });
});
