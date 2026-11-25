import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, TestAppContext } from './helpers/test-helpers';
import { GamificationRepository } from '../src/gamification/gamification.repository';
import { ReputationService } from '../src/moderation/reputation.service';

describe('Better Reputation System & Trust Metrics E2E Tests', () => {
  let ctx: TestAppContext;
  let app: INestApplication;
  let server: any;

  beforeAll(async () => {
    ctx = await createTestApp();
    app = ctx.app;
    server = app.getHttpServer();
  });

  afterAll(async () => {
    if (ctx?.app) {
      await ctx.app.close();
    }
  });

  describe('1. GET /users/me/trust & GET /users/:id/trust Privacy Controls', () => {
    it('returns caller own trust summary with reputation number and ledger link', async () => {
      const userToken = ctx.loginAs('2'); // Collaborator (Arjun Sharma)

      const res = await request(server)
        .get('/users/me/trust')
        .set('Authorization', userToken);

      expect(res.status).toBe(200);
      expect(res.body.userId).toBe('2');
      expect(typeof res.body.xp).toBe('number');
      expect(res.body.label).toBeDefined();
      expect(res.body.band).toBeDefined();
      expect(res.body.trackRecord).toBeDefined();
      expect(typeof res.body.reputation).toBe('number');
      expect(res.body.ledgerLink).toBe('/users/me/reputation');
      // Collaborator is not admin, so needsAttention is undefined
      expect(res.body.needsAttention).toBeUndefined();
    });

    it('conceals exact reputation number and internal flags from public/peer viewers', async () => {
      const peerToken = ctx.loginAs('3'); // Another collaborator (Priya Patel)

      const res = await request(server)
        .get('/users/2/trust')
        .set('Authorization', peerToken);

      expect(res.status).toBe(200);
      expect(res.body.userId).toBe('2');
      expect(res.body.band).toBeDefined();
      expect(res.body.label).toBeDefined();
      expect(typeof res.body.xp).toBe('number');
      expect(res.body.trackRecord).toBeDefined();

      // FORBIDDEN PRIVATE KEYS: Must NEVER leak to peer
      expect(res.body.reputation).toBeUndefined();
      expect(res.body.ledgerLink).toBeUndefined();
      expect(res.body.needsAttention).toBeUndefined();
      expect(res.body.warnings).toBeUndefined();
      expect(res.body.suspensions).toBeUndefined();
    });

    it('reveals exact reputation number and admin flags to Administrator', async () => {
      const adminToken = ctx.loginAs('admin');

      const res = await request(server)
        .get('/users/2/trust')
        .set('Authorization', adminToken);

      expect(res.status).toBe(200);
      expect(res.body.userId).toBe('2');
      expect(typeof res.body.reputation).toBe('number');
      expect(res.body.ledgerLink).toBe('/admin/users/2/reputation');
      expect(typeof res.body.needsAttention).toBe('boolean');
    });

    it('returns anonymised summary for unknown or deleted user without 404/500 crash', async () => {
      const peerToken = ctx.loginAs('3');

      const res = await request(server)
        .get('/users/unknown-user-99999/trust')
        .set('Authorization', peerToken);

      expect(res.status).toBe(200);
      expect(res.body.userId).toBe('unknown-user-99999');
      expect(res.body.label).toBe('Getting started');
      expect(res.body.band).toBe('Good standing');
      expect(res.body.xp).toBe(0);
      expect(res.body.reputation).toBeUndefined();
    });
  });

  describe('2. POST /users/trust-summaries Bulk Endpoint', () => {
    it('returns array of trust summaries for valid list of user IDs', async () => {
      const peerToken = ctx.loginAs('3');

      const res = await request(server)
        .post('/users/trust-summaries')
        .set('Authorization', peerToken)
        .send({ ids: ['1', '2', '4'] });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(3);

      for (const item of res.body) {
        expect(item.userId).toBeDefined();
        expect(item.label).toBeDefined();
        expect(item.band).toBeDefined();
        expect(typeof item.xp).toBe('number');
        // Peer caller: no private fields
        expect(item.reputation).toBeUndefined();
        expect(item.needsAttention).toBeUndefined();
      }
    });

    it('rejects > 50 IDs with 400 TOO_MANY_IDS', async () => {
      const peerToken = ctx.loginAs('3');
      const ids = Array.from({ length: 51 }, (_, i) => `user-${i}`);

      const res = await request(server)
        .post('/users/trust-summaries')
        .set('Authorization', peerToken)
        .send({ ids });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('TOO_MANY_IDS');
    });
  });

  describe('3. Conduct Score Clamping & Contribution Separation', () => {
    it('approving tasks increases XP in gamification but keeps reputation capped at 100', async () => {
      const userToken = ctx.loginAs('2');

      // Check baseline
      const beforeRes = await request(server)
        .get('/users/me/trust')
        .set('Authorization', userToken);

      const beforeXp = beforeRes.body.xp;

      const gamificationRepo = app.get(GamificationRepository);
      const repService = app.get(ReputationService);

      // Add a task approved contribution entry to ledger
      repService.recordTaskApproved('2', 'task-verified-1', 'proj-1');
      gamificationRepo.addLedgerEntry({
        id: `xp-${Date.now()}`,
        userId: '2',
        xp: 25,
        reason: 'Task approved',
        createdAt: new Date().toISOString(),
      } as any);

      // Check after
      const afterRes = await request(server)
        .get('/users/me/trust')
        .set('Authorization', userToken);

      expect(afterRes.body.xp).toBe(beforeXp + 25);
      // Reputation must not exceed 100
      expect(afterRes.body.reputation).toBeLessThanOrEqual(100);
    });
  });

  describe('4. Leaderboard Tabs & Rank Removal', () => {
    it('returns leaderboard without rank, level, or title fields on any entry', async () => {
      const userToken = ctx.loginAs('2');

      const res = await request(server)
        .get('/leaderboard?tab=xp')
        .set('Authorization', userToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);

      for (const entry of res.body) {
        // Forbidden gamification hierarchy fields
        expect(entry.rank).toBeUndefined();
        expect(entry.level).toBeUndefined();
        expect(entry.title).toBeUndefined();
        expect(entry.progress).toBeUndefined();

        // Valid fields
        expect(entry.userId).toBeDefined();
        expect(typeof entry.xp).toBe('number');
        expect(entry.band).toBeDefined();
        expect(entry.trustLabel).toBeDefined();
      }
    });

    it('reliable tab returns users with onTimeRate >= 80%', async () => {
      const userToken = ctx.loginAs('2');

      const res = await request(server)
        .get('/leaderboard?tab=reliable')
        .set('Authorization', userToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      for (const entry of res.body) {
        if (entry.onTimeRate !== null && entry.onTimeRate !== undefined) {
          expect(entry.onTimeRate).toBeGreaterThanOrEqual(80);
        }
      }
    });

    it('standing tab conceals raw reputation numbers from non-admin callers', async () => {
      const userToken = ctx.loginAs('2');

      const res = await request(server)
        .get('/leaderboard?tab=standing')
        .set('Authorization', userToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      for (const entry of res.body) {
        // Non-admin cannot see raw reputation in leaderboard
        expect(entry.rep).toBeUndefined();
        expect(entry.band).toBeDefined();
      }
    });
  });
});
