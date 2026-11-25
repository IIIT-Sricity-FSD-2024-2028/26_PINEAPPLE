import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import request from 'supertest';
import { createTestApp, loginAs, TestAppContext } from './helpers/test-helpers';
import { UPLOADS_DIR } from '../src/core/middleware/file-upload.middleware';

describe('Phase 23 E2E: Storage Hygiene & Removed Snapshot Endpoints', () => {
  let tempRoot: string;
  let origExportDir: string | undefined;
  let origCleanOnStart: string | undefined;

  beforeAll(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-phase23-e2e-'));
    origExportDir = process.env.EXPORT_DIR;
    origCleanOnStart = process.env.CLEAN_UPLOADS_ON_START;
  });

  afterAll(() => {
    if (origExportDir === undefined) delete process.env.EXPORT_DIR;
    else process.env.EXPORT_DIR = origExportDir;

    if (origCleanOnStart === undefined) delete process.env.CLEAN_UPLOADS_ON_START;
    else process.env.CLEAN_UPLOADS_ON_START = origCleanOnStart;

    if (fs.existsSync(tempRoot)) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('1. Removed snapshot and integrity endpoints return 404 Not Found', async () => {
    const ctx: TestAppContext = await createTestApp();
    const server = ctx.app.getHttpServer();
    try {
      await request(server)
        .post('/admin/system/snapshot')
        .set('Authorization', ctx.loginAs('superuser'))
        .expect(404);
      await request(server)
        .get('/admin/system/snapshot')
        .set('Authorization', ctx.loginAs('superuser'))
        .expect(404);
      await request(server)
        .get('/admin/system/integrity')
        .set('Authorization', ctx.loginAs('superuser'))
        .expect(404);
    } finally {
      await ctx.app.close();
    }
  });

  it('2. POST /admin/jobs/tick executes storageHygiene job and exposes detailed counts on GET /admin/jobs/runs/:id', async () => {
    const expDir = path.join(tempRoot, 'e2e-exports');
    fs.mkdirSync(expDir, { recursive: true });
    process.env.EXPORT_DIR = expDir;
    process.env.CLEAN_UPLOADS_ON_START = 'false';

    const orphanExportFile = path.join(expDir, `teamforge-export-orphan-${Date.now()}.json`);
    fs.writeFileSync(orphanExportFile, '{"orphan":true}');

    const orphanUploadName = `p23-e2e-orphan-${Date.now()}.png`;
    const orphanUploadPath = path.join(UPLOADS_DIR, orphanUploadName);
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    fs.writeFileSync(orphanUploadPath, 'stale-orphan-upload');
    const oldSec = (Date.now() - 26 * 60 * 60 * 1000) / 1000;
    fs.utimesSync(orphanUploadPath, oldSec, oldSec);

    const ctx: TestAppContext = await createTestApp();
    const server = ctx.app.getHttpServer();

    try {
      const tickRes = await request(server)
        .post('/admin/jobs/tick')
        .set('Authorization', ctx.loginAs('superuser'))
        .expect(202);
      const runId = tickRes.body.runId;

      const runRes = await request(server)
        .get(`/admin/jobs/runs/${runId}`)
        .set('Authorization', ctx.loginAs('admin'))
        .expect(200);

      const hygieneJob = runRes.body.jobs.find((j: any) => j.name === 'storageHygiene');
      expect(hygieneJob).toBeDefined();
      expect(hygieneJob.counts.orphanUploadsRemoved).toBeGreaterThanOrEqual(1);
      expect(hygieneJob.counts.orphanExportsRemoved).toBeGreaterThanOrEqual(1);
      expect(fs.existsSync(orphanUploadPath)).toBe(false);
      expect(fs.existsSync(orphanExportFile)).toBe(false);
    } finally {
      if (fs.existsSync(orphanUploadPath)) {
        try {
          fs.unlinkSync(orphanUploadPath);
        } catch {}
      }
      await ctx.app.close();
    }
  });
});
