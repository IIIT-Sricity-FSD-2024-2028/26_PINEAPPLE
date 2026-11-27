import request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';
import { createTestApp, TestAppContext } from './helpers/test-helpers';
import { getUploadsDir, getSecureCvsDir } from '../src/core/middleware/file-upload.middleware';
import { PUBLIC_ROUTE_ALLOWLIST } from '../src/common/utils/route-auth-matrix';

describe('Avatar Persistence E2E API Tests', () => {
  let ctx: TestAppContext;
  let server: any;

  const VALID_PNG = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  ]);
  const VALID_WEBP = Buffer.concat([
    Buffer.from('RIFF'),
    Buffer.from([0x10, 0x00, 0x00, 0x00]),
    Buffer.from('WEBP'),
  ]);
  const VALID_PDF = Buffer.from('%PDF-1.4\n%%EOF\n');
  const SVG_PAYLOAD = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

  const createdFiles: string[] = [];

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.app.getHttpServer();
  });

  beforeEach(() => {
    ctx.resetStores();
  });

  afterAll(async () => {
    for (const p of createdFiles) {
      try {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch {}
    }
    if (ctx?.app) {
      await ctx.app.close();
    }
  });

  it('persists avatarUrl across upload, /auth/me, /users/me, public profile, serves publicly without auth, and deletes old avatar on replacement', async () => {
    const loginRes = await request(server)
      .post('/auth/login')
      .send({ identifier: 'arjun.sharma@teamforge.io', password: 'password123' })
      .expect(200);

    const token = `Bearer ${loginRes.body.accessToken}`;
    const userId = String(loginRes.body.user.id);

    // 1. Upload first avatar (PNG) with unguessable filename
    const uploadRes = await request(server)
      .post('/uploads/avatar')
      .set('Authorization', token)
      .attach('file', VALID_PNG, { filename: 'my-secret-photo-name.png', contentType: 'image/png' })
      .expect(201);

    expect(uploadRes.body.filename).not.toContain('my-secret-photo-name');
    expect(uploadRes.body.url).toBe(`/uploads/${uploadRes.body.filename}`);
    expect(uploadRes.body.avatarUrl).toBe(`/uploads/${uploadRes.body.filename}`);
    expect(uploadRes.body.user).toBeDefined();
    expect(uploadRes.body.user.avatarUrl).toBe(uploadRes.body.avatarUrl);
    expect(uploadRes.body.user.profile?.avatarUrl).toBe(uploadRes.body.avatarUrl);
    createdFiles.push(path.join(getUploadsDir(), uploadRes.body.filename));

    // 2. Verify /auth/me and /users/me and public profile return canonical avatarUrl immediately
    const authMeRes = await request(server)
      .get('/auth/me')
      .set('Authorization', token)
      .expect(200);
    expect(authMeRes.body.avatarUrl).toBe(uploadRes.body.avatarUrl);
    expect(authMeRes.body.profile?.avatarUrl).toBe(uploadRes.body.avatarUrl);

    const usersMeRes = await request(server)
      .get('/users/me')
      .set('Authorization', token)
      .expect(200);
    expect(usersMeRes.body.avatarUrl).toBe(uploadRes.body.avatarUrl);

    const publicProfileRes = await request(server)
      .get(`/users/${userId}/public-profile`)
      .set('Authorization', token)
      .expect(200);
    expect(publicProfileRes.body.avatarUrl).toBe(uploadRes.body.avatarUrl);

    // 3. Public GET without Authorization serves the image with safe headers
    const imgRes = await request(server)
      .get(uploadRes.body.avatarUrl)
      .expect(200);
    expect(imgRes.headers['content-type']).toContain('image/png');
    expect(imgRes.headers['x-content-type-options']).toBe('nosniff');
    expect(String(imgRes.headers['cache-control'] || '')).toMatch(/public|max-age/i);

    // 4. Upload replacement avatar (WEBP) -> previous file deleted and returns 404
    const replaceRes = await request(server)
      .post('/uploads/avatar')
      .set('Authorization', token)
      .attach('file', VALID_WEBP, { filename: 'replacement.webp', contentType: 'image/webp' })
      .expect(201);

    createdFiles.push(path.join(getUploadsDir(), replaceRes.body.filename));
    expect(replaceRes.body.avatarUrl).not.toBe(uploadRes.body.avatarUrl);

    await request(server)
      .get(uploadRes.body.avatarUrl)
      .expect(404);

    await request(server)
      .get(replaceRes.body.avatarUrl)
      .expect(200);

    const meAfterReplace = await request(server)
      .get('/auth/me')
      .set('Authorization', token)
      .expect(200);
    expect(meAfterReplace.body.avatarUrl).toBe(replaceRes.body.avatarUrl);
  });

  it('rejects SVG uploads, blocks path traversal / CV access via public uploads route, and keeps route allow-list accurate', async () => {
    const loginRes = await request(server)
      .post('/auth/login')
      .send({ identifier: 'priya.patel@teamforge.io', password: 'password123' })
      .expect(200);
    const token = `Bearer ${loginRes.body.accessToken}`;

    await request(server)
      .post('/uploads/avatar')
      .set('Authorization', token)
      .attach('file', SVG_PAYLOAD, { filename: 'bad.svg', contentType: 'image/svg+xml' })
      .expect(400);

    const cvUpload = await request(server)
      .post('/uploads/cv')
      .set('Authorization', token)
      .attach('file', VALID_PDF, { filename: 'secret-cv.pdf', contentType: 'application/pdf' })
      .expect(201);
    createdFiles.push(path.join(getSecureCvsDir(), cvUpload.body.filename));

    // Trying to read CV via public /uploads/:filename or traversal must fail
    await request(server).get(`/uploads/${cvUpload.body.filename}`).expect(404);
    await request(server).get(`/uploads/${encodeURIComponent('../secure-cvs/' + cvUpload.body.filename)}`).expect(404);
    await request(server).get(`/uploads/cv/${cvUpload.body.filename}`).expect(401);

    expect(PUBLIC_ROUTE_ALLOWLIST).toContain('GET /uploads/:filename');
  });
});
