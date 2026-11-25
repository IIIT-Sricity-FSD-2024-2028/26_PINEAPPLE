import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, TestAppContext } from './helpers/test-helpers';
import { ReputationService } from '../src/moderation/reputation.service';

describe('Phase 10 E2E Tests: UTC Handling & Reputation Ledger', () => {
  let ctx: TestAppContext;
  let app: INestApplication;
  let server: any;
  let reputationService: ReputationService;

  beforeAll(async () => {
    ctx = await createTestApp();
    app = ctx.app;
    server = app.getHttpServer();
    reputationService = app.get(ReputationService);
  });

  beforeEach(() => {
    ctx.resetStores();
    ctx.clockService.setTime('2026-03-01T12:00:00.000Z');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Reputation Ledger Pagination (GET /users/me/reputation)', () => {
    it('returns 200 with { items, page, limit, total } for authenticated user', async () => {
      // Add entries for user 2 (Arjun)
      reputationService.addEntry('2', 'seed', 87);
      reputationService.addEntry('2', 'task_approved', 8, 'task-1');
      reputationService.addEntry('2', 'warning', -10, 'warn-1');

      const res = await request(server)
        .get('/users/me/reputation')
        .set('Authorization', ctx.loginAs('collaborator'))
        .set('x-user-id', '2');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('items');
      expect(res.body).toHaveProperty('page', 1);
      expect(res.body).toHaveProperty('limit', 20);
      expect(res.body).toHaveProperty('total');
      expect(res.body.total).toBeGreaterThanOrEqual(3);
      expect(Array.isArray(res.body.items)).toBe(true);
    });

    it('supports custom page and limit query parameters', async () => {
      for (let i = 1; i <= 15; i++) {
        reputationService.addEntry('2', 'task_approved', 8, `batch-task-${i}`);
      }

      const res = await request(server)
        .get('/users/me/reputation?page=2&limit=5')
        .set('Authorization', ctx.loginAs('collaborator'))
        .set('x-user-id', '2');

      expect(res.status).toBe(200);
      expect(res.body.page).toBe(2);
      expect(res.body.limit).toBe(5);
      expect(res.body.items).toHaveLength(5);
    });

    it('supports type filter (e.g. ?type=task_approved)', async () => {
      reputationService.addEntry('2', 'task_approved', 8, 't-approved');
      reputationService.addEntry('2', 'warning', -10, 'w-penalty');

      const res = await request(server)
        .get('/users/me/reputation?type=task_approved')
        .set('Authorization', ctx.loginAs('collaborator'))
        .set('x-user-id', '2');

      expect(res.status).toBe(200);
      expect(res.body.items.length).toBeGreaterThan(0);
      expect(res.body.items.every((e: any) => e.type === 'task_approved')).toBe(true);
    });

    it('rejects limit > 100 with 400 INVALID_PAGINATION', async () => {
      const res = await request(server)
        .get('/users/me/reputation?limit=101')
        .set('Authorization', ctx.loginAs('collaborator'))
        .set('x-user-id', '2');

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_PAGINATION');
    });

    it('rejects limit <= 0 with 400 INVALID_PAGINATION', async () => {
      const res = await request(server)
        .get('/users/me/reputation?limit=0')
        .set('Authorization', ctx.loginAs('collaborator'))
        .set('x-user-id', '2');

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_PAGINATION');
    });
  });

  describe('2. Admin Reputation Ledger Endpoint (GET /admin/users/:id/reputation)', () => {
    it('allows Admin to view paginated reputation of any user', async () => {
      reputationService.addEntry('2', 'seed', 87);

      const res = await request(server)
        .get('/admin/users/2/reputation?page=1&limit=10')
        .set('Authorization', ctx.loginAs('admin'))
        .set('x-user-role', 'admin');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('items');
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(10);
    });

    it('forbids Collaborators from accessing admin reputation endpoint (403)', async () => {
      const res = await request(server)
        .get('/admin/users/2/reputation')
        .set('Authorization', ctx.loginAs('collaborator'))
        .set('x-user-role', 'collaborator');

      expect(res.status).toBe(403);
    });
  });

  describe('3. Removed Snapshot Endpoints Return 404', () => {
    it('returns 404 for POST /admin/system/snapshot and GET /admin/system/snapshot', async () => {
      await request(server)
        .post('/admin/system/snapshot')
        .set('Authorization', ctx.loginAs('superuser'))
        .expect(404);

      await request(server)
        .get('/admin/system/snapshot')
        .set('Authorization', ctx.loginAs('superuser'))
        .expect(404);
    });
  });
});
