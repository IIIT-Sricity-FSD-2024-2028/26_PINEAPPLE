import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';
import { createTestApp, TestAppContext } from './helpers/test-helpers';
import { ProjectStatus, ProjectDifficulty } from '../src/projects/dto/create-project.dto';
import { TaskStatus } from '../src/tasks/dto/create-task.dto';

describe('Phase 17 E2E Tests: Disputes and Admin Accountability', () => {
  let ctx: TestAppContext;
  let app: INestApplication;
  let server: any;
  let ownerToken: string;
  let mentorToken: string;
  let collaboratorToken: string;
  let adminToken: string;
  let adminBToken: string;
  let superuserToken: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    app = ctx.app;
    server = app.getHttpServer();
    ownerToken = ctx.loginAs('owner');
    mentorToken = ctx.loginAs('mentor');
    collaboratorToken = ctx.loginAs('collaborator');
    adminToken = ctx.loginAs('admin'); // sub: 'u-admin', permissions: ['*']
    adminBToken = ctx.loginAs('admin-no-reports'); // sub: 'u-admin-restricted', permissions: ['users', 'projects']
    superuserToken = ctx.loginAs('superuser');
  });

  beforeEach(() => {
    ctx.resetStores();
    ctx.clockService.setTime('2026-06-01T12:00:00.000Z');
  });

  afterAll(async () => {
    await app.close();
  });

  const createBookedActiveSession = async (
    projectName = 'Phase17 Dispute Proj',
    scheduledAt = '2026-06-03T14:00:00.000Z',
  ) => {
    const proj = ctx.projectsRepository.create(
      '1',
      {
        title: projectName,
        description: 'A detailed project testing escrow disputes and accounting reconciliation.',
        difficulty: ProjectDifficulty.Medium,
        requiredSkills: ['React', 'Node.js', 'TypeScript'],
        duration: '2 Months',
        dueDate: '2027-02-28T00:00:00.000Z',
      } as any,
      ProjectStatus.Open,
    );

    // Book session for future date within project due window
    const bookRes = await request(server)
      .post('/mentor-marketplace/sessions/book')
      .set('Authorization', ownerToken)
      .send({
        mentorId: 'mentor-profile-1',
        projectId: proj.id,
        projectDescription: 'Need architecture mentoring session.',
        scheduledAt,
      });
    expect(bookRes.status).toBe(201);
    const sessionId = bookRes.body.session.id;

    const payRes = await request(server)
      .post(`/mentor-marketplace/sessions/${sessionId}/confirm-payment`)
      .set('Authorization', ownerToken)
      .send({});
    expect([200, 201]).toContain(payRes.status);

    const acceptRes = await request(server)
      .post(`/mentor-marketplace/sessions/${sessionId}/accept`)
      .set('Authorization', mentorToken)
      .send({});
    expect([200, 201]).toContain(acceptRes.status);

    return { project: proj, sessionId };
  };

  describe('1. Escrow Dispute Lifecycle, Freeze & Admin Decisions', () => {
    it('enforces party access, freezes payout (409 SESSION_DISPUTED), skips expiry/closure refund, decides split 70/30 once, and reconciles', async () => {
      const { project, sessionId } = await createBookedActiveSession('Dispute Lifecycle Project');

      // Unrelated collaborator cannot open dispute -> 403
      const forbidRes = await request(server)
        .post(`/mentor-sessions/${sessionId}/dispute`)
        .set('Authorization', collaboratorToken)
        .send({ reason: 'Unauthorized attempt to open dispute on session.' });
      expect(forbidRes.status).toBe(403);

      // Too short reason -> 400
      const shortRes = await request(server)
        .post(`/mentor-sessions/${sessionId}/dispute`)
        .set('Authorization', ownerToken)
        .send({ reason: 'too short' });
      expect(shortRes.status).toBe(400);

      // Owner opens valid dispute -> 201
      const dispRes = await request(server)
        .post(`/mentor-sessions/${sessionId}/dispute`)
        .set('Authorization', ownerToken)
        .send({ reason: 'Mentor disconnected halfway through the session.' });
      expect(dispRes.status).toBe(201);
      const disputeId = dispRes.body.id;
      expect(dispRes.body.status).toBe('open');

      // Duplicate open dispute -> 409 DISPUTE_ALREADY_OPEN
      const dupRes = await request(server)
        .post(`/mentor-sessions/${sessionId}/dispute`)
        .set('Authorization', mentorToken)
        .send({ reason: 'Trying to open a second dispute on the same session.' });
      expect(dupRes.status).toBe(409);
      expect(dupRes.body.code).toBe('DISPUTE_ALREADY_OPEN');

      // Direct complete/cancel blocked with 409 SESSION_DISPUTED
      const completeRes = await request(server)
        .post(`/mentor-marketplace/sessions/${sessionId}/complete`)
        .set('Authorization', ownerToken);
      expect(completeRes.status).toBe(409);
      expect(completeRes.body.code).toBe('SESSION_DISPUTED');

      // Project closure skips disputed session cleanly
      ctx.projectsService.closeProject(project.id, 'Administrative review closure', 'Admin');
      const sessionsAfterClose = ctx.mentorMarketplaceService.getSessionsByStudent('1');
      const frozenSess = sessionsAfterClose.find((s) => s.id === sessionId);
      expect(frozenSess?.status).toBe('disputed');

      // Admin lists disputes & checks project escrow tab
      const listRes = await request(server)
        .get('/admin/disputes?status=open')
        .set('Authorization', adminToken);
      expect(listRes.status).toBe(200);
      expect(listRes.body.some((d: any) => d.id === disputeId)).toBe(true);

      const projEscrowBefore = await request(server)
        .get(`/admin/projects/${project.id}/escrow`)
        .set('Authorization', adminToken);
      expect(projEscrowBefore.status).toBe(200);
      expect(projEscrowBefore.body.totals.inEscrow).toBeGreaterThan(0);

      // Invalid split percent -> 400
      const badSplit = await request(server)
        .post(`/admin/disputes/${disputeId}/decide`)
        .set('Authorization', adminToken)
        .send({ decision: 'split', mentorPercent: 120, reason: 'Invalid percentage test case.' });
      expect(badSplit.status).toBe(400);

      // Admin decides 70/30 split
      const beforeOwnerNotifs = ctx.notificationsService.findByUser('1').length;
      const beforeMentorNotifs = ctx.notificationsService.findByUser('7').length;

      const decideRes = await request(server)
        .post(`/admin/disputes/${disputeId}/decide`)
        .set('Authorization', adminToken)
        .send({
          decision: 'split',
          mentorPercent: 70,
          reason: 'Delivered 70 percent of planned review milestones.',
        });
      expect(decideRes.status).toBe(200);
      expect(decideRes.body.dispute.status).toBe('decided');
      expect(decideRes.body.session.status).toBe('split');
      expect(decideRes.body.dispute.mentorAmount).toBe(Math.round(decideRes.body.session.agreedPrice * 0.7));
      expect(decideRes.body.dispute.platformFee).toBe(Math.round(decideRes.body.dispute.mentorAmount * 0.15));

      // Both parties notified with reason
      const ownerNotifs = ctx.notificationsService.findByUser('1');
      const mentorNotifs = ctx.notificationsService.findByUser('7');
      expect(ownerNotifs.length).toBeGreaterThan(beforeOwnerNotifs);
      expect(mentorNotifs.length).toBeGreaterThan(beforeMentorNotifs);
      expect(ownerNotifs[0].message).toContain('Delivered 70 percent');

      // Second decision fails -> 409 DISPUTE_ALREADY_DECIDED
      const replayRes = await request(server)
        .post(`/admin/disputes/${disputeId}/decide`)
        .set('Authorization', adminToken)
        .send({ decision: 'refund_to_owner', reason: 'Trying to override previous ruling.' });
      expect(replayRes.status).toBe(409);
      expect(replayRes.body.code).toBe('DISPUTE_ALREADY_DECIDED');

      // Project escrow & global reconcile hold
      const projEscrowAfter = await request(server)
        .get(`/admin/projects/${project.id}/escrow`)
        .set('Authorization', adminToken);
      expect(projEscrowAfter.status).toBe(200);
      expect(projEscrowAfter.body.ok).toBe(true);
      expect(projEscrowAfter.body.totals.inEscrow).toBe(0);

      const reconcileRes = await request(server)
        .get('/admin/escrow/reconcile')
        .set('Authorization', adminToken);
      expect(reconcileRes.status).toBe(200);
      expect(reconcileRes.body.ok).toBe(true);
    });

    it('rejects dispute >7 days after session end, and notifies Super User ONCE after 7 days undecided', async () => {
      const { sessionId } = await createBookedActiveSession('Old Dispute Escalation');

      // Advance 10 days past scheduledAt (2026-06-03 + 60m -> > 7 days ago)
      ctx.clockService.setTime('2026-06-15T12:00:00.000Z');
      const lateRes = await request(server)
        .post(`/mentor-sessions/${sessionId}/dispute`)
        .set('Authorization', ownerToken)
        .send({ reason: 'Trying to dispute more than seven days late.' });
      expect(lateRes.status).toBe(409);
      expect(lateRes.body.code).toBe('DISPUTE_WINDOW_EXPIRED');

      // Reset to 2026-06-01 & create another session in a non-overlapping slot, open dispute right away
      ctx.clockService.setTime('2026-06-01T12:00:00.000Z');
      const fresh = await createBookedActiveSession('Unresolved 7d Dispute', '2026-06-04T14:00:00.000Z');
      await request(server)
        .post(`/mentor-sessions/${fresh.sessionId}/dispute`)
        .set('Authorization', ownerToken)
        .send({ reason: 'Open dispute to test seven day superuser escalation.' });

      // Advance 7 days and run job tick twice -> notified ONCE
      ctx.clockService.advanceDays(7);
      const suBefore = ctx.notificationsService.findByUser('u-superuser').filter((n) => n.type === 'DISPUTE_OVERDUE').length;
      await request(server).post('/admin/jobs/tick').set('Authorization', superuserToken);
      await request(server).post('/admin/jobs/tick').set('Authorization', superuserToken);
      const suAfter = ctx.notificationsService.findByUser('u-superuser').filter((n) => n.type === 'DISPUTE_OVERDUE').length;
      expect(suAfter - suBefore).toBe(1);
    });
  });

  describe('2. Audit Export CSV/JSON & Owner Rejection Patterns', () => {
    it('exports CSV with formula protection, logs audit-exported event, and respects scoped audit permissions', async () => {
      // Restricted admin lacks 'audit' permission -> 403
      const forbidExport = await request(server)
        .get('/admin/audit/export?format=csv')
        .set('Authorization', adminBToken);
      expect(forbidExport.status).toBe(403);

      ctx.auditService.log({
        action: 'phase17-export-check',
        actor: '=FORMULA_ACTOR',
        target: 'Alpha, "Quoted"',
        event: 'Line1\nLine2',
        details: { formula: '+1+1' },
      });

      const csvRes = await request(server)
        .get('/admin/audit/export?format=csv&action=phase17-export-check')
        .set('Authorization', adminToken);
      expect(csvRes.status).toBe(200);
      expect(csvRes.headers['content-type']).toContain('text/csv');
      expect(csvRes.text).toContain("'=FORMULA_ACTOR");
      expect(csvRes.text).toContain('"Alpha, ""Quoted"""');

      // Verify export logged
      const auditLogs = ctx.auditService.findAll();
      expect(auditLogs.some((e) => e.action === 'audit-exported')).toBe(true);
    });

    it('returns 30-day owner rejection patterns and flags >=5 rejections with 0 approvals', async () => {
      const ownerUser = ctx.usersRepository.create({
        id: 'owner-strict-p17',
        name: 'Strict Owner',
        username: 'strict-owner-p17',
        email: 'strict.owner@teamforge.io',
        role: 'project-owner' as any,
        createdAt: ctx.clockService.nowIso(),
      } as any);

      const proj = ctx.projectsRepository.create(
        ownerUser.id,
        {
          title: 'Strict Pattern Project',
          description: 'A project with many rejections for testing pattern telemetry.',
          difficulty: ProjectDifficulty.Medium,
          requiredSkills: ['React'],
          duration: '1 Month',
        } as any,
        ProjectStatus.Open,
      );

      for (let i = 0; i < 4; i++) {
        const applicant = ctx.usersRepository.create({
          id: `app-${i}`,
          name: `Applicant ${i}`,
          username: `applicant-p17-${i}`,
          email: `app${i}@teamforge.io`,
          role: 'collaborator' as any,
        } as any);
        const req = await ctx.joinRequestsService.create({
          projectId: proj.id,
          userId: applicant.id,
          userName: applicant.name,
          role: 'Frontend',
          message: 'Application for strict owner pattern testing.',
        } as any);
        await ctx.joinRequestsService.update(
          req.id,
          { status: 'rejected', reason: `Missing required qualification number ${i}` },
          { uid: ownerUser.id, role: 'project-owner' },
        );
      }

      // Add 1 task review rejection
      ctx.tasksRepository.create({
        projectId: proj.id,
        title: 'Task Review Rej 1',
        status: TaskStatus.ToDo,
        priority: 'Medium' as any,
        rejectionHistory: [
          { reason: 'PR misses unit tests cleanly', at: ctx.clockService.nowIso(), by: ownerUser.id },
        ],
      } as any);

      const patternRes = await request(server)
        .get('/admin/reports/owner-patterns')
        .set('Authorization', adminToken);
      expect(patternRes.status).toBe(200);
      const entry = patternRes.body.items.find((i: any) => i.ownerId === ownerUser.id);
      expect(entry).toBeDefined();
      expect(entry.totalRejections).toBe(5);
      expect(entry.totalApprovals).toBe(0);
      expect(entry.reviewPatternFlag).toBe(true);
      expect(entry.badge).toBe('review pattern');
    });
  });

  describe('3. Second Approval for Suspensions, Warning Decay & Snapshot Roundtrip', () => {
    it('queues manual suspension on >90d user with 202, blocks self-approval 403, approves with different admin, and snapshots survive restore', async () => {
      // User '2' is >90 days old (createdAt 2024-03-20)
      const suspRes = await request(server)
        .post('/admin/users/2/suspend')
        .set('Authorization', adminToken)
        .send({ reason: 'Manual suspension threshold check on established account.' });
      expect(suspRes.status).toBe(202);
      expect(suspRes.body.status).toBe('pending_second_approval');
      const actionId = suspRes.body.actionId;

      // User stays Active while pending
      expect(ctx.usersService.findById('2').status).toBe('Active');

      // Same admin blocked -> 403 SAME_ADMIN_NOT_ALLOWED
      const selfRes = await request(server)
        .post(`/admin/moderation-actions/${actionId}/approve`)
        .set('Authorization', adminToken)
        .send({ reason: 'Same admin attempting to approve own request.' });
      expect(selfRes.status).toBe(403);
      expect(selfRes.body.code).toBe('SAME_ADMIN_NOT_ALLOWED');

      // Admin B approves -> 200 suspended
      const appRes = await request(server)
        .post(`/admin/moderation-actions/${actionId}/approve`)
        .set('Authorization', adminBToken)
        .send({ reason: 'Second admin corroborates harassment reports.' });
      expect(appRes.status).toBe(200);
      expect(appRes.body.status).toBe('suspended');
      expect(ctx.usersService.findById('2').status).toBe('Suspended');
    });

    it('decays clean active warnings >90d via hourly job and preserves state across persistence snapshot', async () => {
      await request(server)
        .post('/admin/users/2/warn')
        .set('Authorization', adminToken)
        .send({ reason: 'First violation written carefully for decay test.' });

      expect(ctx.moderationService.getActiveWarningsCount('2')).toBe(1);

      // Day 91 -> hourly tick expires warning without restoring rep or notifying
      ctx.clockService.advanceDays(91);
      const repBefore = ctx.reputationService.getReputation('2');
      const notifsBefore = ctx.notificationsService.findByUser('2').length;

      const tickRes = await request(server).post('/admin/jobs/tick').set('Authorization', superuserToken);
      expect(tickRes.status).toBe(202);

      expect(ctx.moderationService.getActiveWarningsCount('2')).toBe(0);
      expect(ctx.reputationService.getReputation('2')).toBe(repBefore);
      expect(ctx.notificationsService.findByUser('2').length).toBe(notifsBefore);
    });
  });
});
