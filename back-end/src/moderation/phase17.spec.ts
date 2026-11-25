import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ClockService } from '../common/services/clock.service';
import { AuditService } from '../audit/audit.service';
import { ModerationService } from './moderation.service';
import { ReportsService } from './reports.service';
import { EscrowService } from '../escrow/escrow.service';
import { PayoutsService } from '../payouts/payouts.service';
import { DemoUpiProvider } from '../mentor-marketplace/payments/demo-upi.provider';
import {
  MentorMarketplaceService,
  calculateEscrowBreakdown,
} from '../mentor-marketplace/mentor-marketplace.service';

describe('Phase 17 Unit Tests: Disputes, Accountability & Decay', () => {
  let clock: ClockService;

  beforeEach(() => {
    clock = new ClockService();
    clock.setTime('2026-06-01T12:00:00.000Z');
  });

  describe('1. Second Approval Thresholds & Warning Decay (ModerationService)', () => {
    let usersDb: Record<string, any>;
    let repMap: Record<string, number>;
    let notifications: any[];
    let mails: any[];
    let audits: any[];
    let service: ModerationService;

    beforeEach(() => {
      repMap = {};
      notifications = [];
      mails = [];
      audits = [];
      usersDb = {
        'admin-a': { id: 'admin-a', name: 'Admin A', role: 'admin', email: 'a@tf.io' },
        'admin-b': { id: 'admin-b', name: 'Admin B', role: 'admin', email: 'b@tf.io' },
        'su-1': { id: 'su-1', name: 'Super User', role: 'superuser', email: 'su@tf.io' },
        'u-89d': {
          id: 'u-89d',
          name: 'User 89 Days',
          role: 'collaborator',
          email: 'u89@tf.io',
          status: 'Active',
          activeWarningsCount: 0,
          createdAt: new Date(clock.now().getTime() - 89 * 24 * 60 * 60 * 1000).toISOString(),
        },
        'u-91d': {
          id: 'u-91d',
          name: 'User 91 Days',
          role: 'collaborator',
          email: 'u91@tf.io',
          status: 'Active',
          activeWarningsCount: 0,
          createdAt: new Date(clock.now().getTime() - 91 * 24 * 60 * 60 * 1000).toISOString(),
        },
        'u-rep150': {
          id: 'u-rep150',
          name: 'User Rep 150',
          role: 'collaborator',
          email: 'rep150@tf.io',
          status: 'Active',
          activeWarningsCount: 0,
          createdAt: new Date(clock.now().getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        },
      };

      const usersRepo: any = {
        findById: (id: string) => usersDb[id] || null,
        findAll: () => Object.values(usersDb),
        update: (id: string, patch: any) => {
          usersDb[id] = { ...usersDb[id], ...patch };
          return usersDb[id];
        },
      };
      const repService: any = {
        recordWarning: (uid: string) => {
          repMap[uid] = Math.max(0, (repMap[uid] ?? 100) - 10);
        },
        getReputation: (uid: string) => repMap[uid] ?? 100,
      };
      const consequencesService: any = { handleSuspension: async () => undefined };
      const mailService: any = {
        sendWarningEmail: async (m: any) => mails.push({ kind: 'warning', ...m }),
        sendSuspensionEmail: async (m: any) => mails.push({ kind: 'suspend', ...m }),
      };
      const notificationsService: any = {
        create: (n: any) => notifications.push(n),
      };
      const auditService: any = {
        create: (a: any) => audits.push(a),
      };

      repMap['u-89d'] = 149;
      repMap['u-91d'] = 90;
      repMap['u-rep150'] = 150;

      service = new ModerationService(
        clock,
        repService,
        consequencesService,
        usersRepo,
        mailService,
        notificationsService,
        auditService,
      );
    });

    it('requires second approval at 91 days (>90d) or reputation 150, but suspends immediately at 89 days and 149 rep', async () => {
      // 89 days & 149 rep -> immediate suspend
      const res89 = await service.suspend('admin-a', 'u-89d', 'Manual suspension for clear policy breach');
      expect(res89.status).toBe('suspended');
      expect(usersDb['u-89d'].status).toBe('Suspended');

      // 91 days & 90 rep -> pending second approval
      const res91 = await service.suspend('admin-a', 'u-91d', 'Manual suspension requiring verification');
      expect(res91.status).toBe('pending_second_approval');
      expect(res91.thresholdReasons).toContain('account_age_over_90_days');
      expect(usersDb['u-91d'].status).toBe('Active');

      // 5 days old & 150 rep -> pending second approval
      const res150 = await service.suspend('admin-a', 'u-rep150', 'High rep user manual suspension request');
      expect(res150.status).toBe('pending_second_approval');
      expect(res150.thresholdReasons).toContain('reputation_150_plus');
      expect(usersDb['u-rep150'].status).toBe('Active');

      // Same admin cannot approve
      await expect(
        service.approvePendingAction(res91.actionId!, 'admin-a', 'Trying to self-approve suspension'),
      ).rejects.toThrow(ForbiddenException);

      // Different admin approves
      const approved = await service.approvePendingAction(
        res91.actionId!,
        'admin-b',
        'Verified logs from second admin review',
      );
      expect(approved.status).toBe('suspended');
      expect(usersDb['u-91d'].status).toBe('Suspended');

      // Replay throws ACTION_ALREADY_DECIDED (409)
      await expect(
        service.approvePendingAction(res91.actionId!, 'su-1', 'Duplicate approval attempt'),
      ).rejects.toThrow(ConflictException);
    });

    it('Super User suspends >90d and >=150 rep users immediately without second approval, and pending expires at 72h', async () => {
      const suRes = await service.suspend(
        'su-1',
        'u-91d',
        'Immediate superuser safety suspension',
        'superuser',
      );
      expect(suRes.status).toBe('suspended');
      expect(usersDb['u-91d'].status).toBe('Suspended');

      // Queue one by admin-a, advance 72h -> expires
      const queued = await service.suspend('admin-a', 'u-rep150', 'Waiting for 72h timeout validation');
      expect(queued.status).toBe('pending_second_approval');
      clock.advanceHours(72);

      const expiredIds = service.expireStalePendingActions();
      expect(expiredIds).toContain(queued.actionId);
      await expect(
        service.approvePendingAction(queued.actionId!, 'admin-b', 'Too late approval attempt'),
      ).rejects.toThrow(ConflictException);
      expect(usersDb['u-rep150'].status).toBe('Active');
    });

    it('warning decay: stays active at day 89, expires at day 91 when clean, stops counting toward 4-limit, does not restore rep or notify', async () => {
      await service.warn('admin-a', 'u-91d', 'First warning older than ninety days test');
      const repAfterW1 = repMap['u-91d']; // 90 - 10 = 80
      expect(repAfterW1).toBe(80);
      const notifCountBeforeDecay = notifications.length;

      // Day 89: stays active
      clock.advanceDays(89);
      const day89 = service.decayExpiredWarnings();
      expect(day89.expiredWarningIds).toHaveLength(0);
      expect(service.getActiveWarningsCount('u-91d')).toBe(1);

      // Day 91: expires
      clock.advanceDays(2);
      const day91 = service.decayExpiredWarnings();
      expect(day91.expiredWarningIds).toHaveLength(1);
      expect(service.getActiveWarningsCount('u-91d')).toBe(0);
      expect(repMap['u-91d']).toBe(80); // Never restores -10 rep
      expect(notifications.length).toBe(notifCountBeforeDecay); // Never notifies

      // Stays in history as expired with label Expired
      const ownHistory = service.getUserOwnWarnings('u-91d');
      expect(ownHistory).toHaveLength(1);
      expect(ownHistory[0].status).toBe('expired');
      expect(ownHistory[0].label).toBe('Expired');

      // Issue 3 more warnings -> total history 4, but active count is 3 -> NOT auto-suspended
      await service.warn('admin-a', 'u-91d', 'Warning two after expiry clean');
      await service.warn('admin-a', 'u-91d', 'Warning three after expiry clean');
      const thirdNew = await service.warn('admin-a', 'u-91d', 'Warning four in history only');
      expect(thirdNew.autoSuspended).toBe(false);
      expect(thirdNew.activeCount).toBe(3);
      expect(usersDb['u-91d'].status).toBe('Active');
    });

    it('warning decay leaves older warning active if a second warning arrived inside the 90 days', async () => {
      await service.warn('admin-a', 'u-91d', 'Warning 1 at day zero');
      clock.advanceDays(45);
      await service.warn('admin-a', 'u-91d', 'Warning 2 inside 90 day window');

      // Now at day 91 from Warning 1 (46 days since Warning 2)
      clock.advanceDays(46);
      const res = service.decayExpiredWarnings();
      expect(res.expiredWarningIds).toHaveLength(0);
      expect(service.getActiveWarningsCount('u-91d')).toBe(2);
    });
  });

  describe('2. Audit CSV Export Escaping, Formula Protection & Row Cap', () => {
    it('escapes commas/quotes/newlines, prefixes =+-@ formula cells, filters correctly, and caps at 10,000 rows', () => {
      const audit = new AuditService(clock);
      audit.reset();

      audit.log({
        action: 'weird-event',
        actor: '=CMD|calc',
        target: 'Target, With "Quotes"',
        event: 'Multi\nline =SUM(1,2)',
        details: { note: '+danger', ok: '-1+1', tag: '@evil' },
      });

      const csvRes = audit.exportAuditLog({ format: 'csv', requesterId: 'admin-test' });
      expect(csvRes.format).toBe('csv');
      expect(csvRes.csv).toContain("'=CMD|calc");
      expect(csvRes.csv).toContain('"Target, With ""Quotes"""');
      expect(csvRes.csv).toContain('"Multi\nline =SUM(1,2)"');

      // Verify export itself was recorded
      const allEntries = audit.findAll();
      expect(allEntries.some((e) => e.action === 'audit-exported')).toBe(true);

      // Test 10,000 row cap
      const manyEntries = [];
      for (let i = 0; i < 10050; i++) {
        manyEntries.push({
          id: `bulk-${i}`,
          action: 'bulk-op',
          entityType: 'system',
          entityId: String(i),
          performedBy: 'admin-bulk',
          actor: 'admin-bulk',
          target: 'bulk',
          event: `Event ${i}`,
          details: {},
          timestamp: '2026-06-01T10:00:00.000Z',
        });
      }
      (audit as any).auditLog.length = 0;
      (audit as any).auditLog.push(...manyEntries);
      const capped = audit.exportAuditLog({ format: 'json', action: 'bulk-op', requesterId: 'admin-test' });
      expect(capped.totalMatched).toBe(10050);
      expect(capped.exportedCount).toBe(10000);
      expect(capped.truncated).toBe(true);
      expect(capped.items).toHaveLength(10000);
    });
  });

  describe('3. Owner Rejection Patterns (ReportsService)', () => {
    it('counts 30-day rejections and approvals, collects reasons, and flags >=5 rejections with 0 approvals only', () => {
      const usersRepo: any = {
        findById: (id: string) => ({ id, name: `User ${id}`, email: `${id}@tf.io` }),
      };
      const projectsRepo: any = {
        findAll: () => [
          { id: 'p1', title: 'Strict Project', ownerId: 'owner-flagged' },
          { id: 'p2', title: 'Balanced Project', ownerId: 'owner-ok' },
        ],
      };

      const nowMs = clock.now().getTime();
      const recentIso = new Date(nowMs - 5 * 24 * 60 * 60 * 1000).toISOString();
      const oldIso = new Date(nowMs - 45 * 24 * 60 * 60 * 1000).toISOString();

      const joinReqs: any[] = [
        { id: 'r1', projectId: 'p1', status: 'rejected', rejectionReason: 'Insufficient React skills', decidedAt: recentIso },
        { id: 'r2', projectId: 'p1', status: 'rejected', rejectionReason: 'Missing backend experience', decidedAt: recentIso },
        { id: 'r3', projectId: 'p1', status: 'rejected', rejectionReason: 'Timezone mismatch concern', decidedAt: recentIso },
        { id: 'r4', projectId: 'p1', status: 'rejected', rejectionReason: 'Portfolio link broken', decidedAt: recentIso },
        // Old approved request (>30d ago) should NOT clear the 30-day zero-approval window
        { id: 'r-old', projectId: 'p1', status: 'approved', decidedAt: oldIso },
        // Owner 2: 5 rejections AND 1 approval -> not flagged
        { id: 'o1', projectId: 'p2', status: 'rejected', rejectionReason: 'Reason 1 long enough', decidedAt: recentIso },
        { id: 'o2', projectId: 'p2', status: 'rejected', rejectionReason: 'Reason 2 long enough', decidedAt: recentIso },
        { id: 'o3', projectId: 'p2', status: 'rejected', rejectionReason: 'Reason 3 long enough', decidedAt: recentIso },
        { id: 'o4', projectId: 'p2', status: 'rejected', rejectionReason: 'Reason 4 long enough', decidedAt: recentIso },
        { id: 'o5', projectId: 'p2', status: 'rejected', rejectionReason: 'Reason 5 long enough', decidedAt: recentIso },
        { id: 'o6', projectId: 'p2', status: 'approved', decidedAt: recentIso },
      ];

      const tasksRepo: any = {
        findAll: () => [
          {
            id: 't1',
            projectId: 'p1',
            status: 'To Do',
            rejectionHistory: [{ reason: 'Tests missing from PR', at: recentIso, by: 'owner-flagged' }],
          },
          // Auto-approved task must NOT count as manual owner approval
          {
            id: 't2',
            projectId: 'p1',
            status: 'Completed',
            autoApproved: true,
            approvedAt: recentIso,
          },
        ],
      };

      const reportsSvc = new ReportsService(
        clock,
        usersRepo,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        undefined,
        projectsRepo,
        tasksRepo,
        { findAll: () => joinReqs } as any,
      );

      const result = reportsSvc.getOwnerRejectionPatterns(30);
      expect(result.flaggedCount).toBe(1);

      const flagged = result.items.find((i: any) => i.ownerId === 'owner-flagged');
      expect(flagged).toBeDefined();
      expect(flagged!.rejectedJoinRequests).toBe(4);
      expect(flagged!.rejectedTaskReviews).toBe(1);
      expect(flagged!.totalRejections).toBe(5);
      expect(flagged!.totalApprovals).toBe(0);
      expect(flagged!.reviewPatternFlag).toBe(true);
      expect(flagged!.badge).toBe('review pattern');
      expect(flagged!.reasons).toHaveLength(5);

      const okOwner = result.items.find((i: any) => i.ownerId === 'owner-ok');
      expect(okOwner).toBeDefined();
      expect(okOwner!.totalRejections).toBe(5);
      expect(okOwner!.totalApprovals).toBe(1);
      expect(okOwner!.reviewPatternFlag).toBe(false);
    });
  });

  describe('4. Escrow Dispute Split 70/30 Math & Reconciliation', () => {
    it('moves release, refund, and 70/30 split with fee ONLY on 70% mentor share while holding reconcile invariant', async () => {
      const escrowService = new EscrowService();
      const payoutsService = new PayoutsService();
      const paymentProvider = new DemoUpiProvider();
      const usersService: any = {
        findUserSafe: (id: string) => ({ id, name: `User ${id}`, role: 'project-owner' }),
        findAll: () => [{ id: 'u-superuser', role: 'superuser' }],
      };
      const projectsRepo: any = {
        findById: (id: string) => ({
          id,
          title: `Project ${id}`,
          ownerId: 'owner-1',
          dueDate: '2027-01-01T00:00:00.000Z',
          status: 'Active',
        }),
      };
      const notificationsService: any = { create: () => undefined };
      const auditService: any = { log: () => undefined };

      const marketplace = new MentorMarketplaceService(
        escrowService,
        payoutsService,
        usersService,
        {} as any,
        notificationsService,
        {} as any,
        projectsRepo,
        auditService,
        paymentProvider,
        clock,
      );

      // Seed 3 funded & active sessions at price 1000 each (totalAmount = 1000 + 150 + 20 = 1170)
      const createFundedActiveSession = (id: string, projectId: string) => {
        const escrow = escrowService.fundForSession(id, 1000);
        const breakdown = calculateEscrowBreakdown(1000);
        const s: any = {
          id,
          mentorId: 'mentor-profile-1',
          studentId: 'owner-1',
          projectId,
          projectDescription: 'Mentoring session',
          agreedPrice: 1000,
          totalAmount: breakdown.totalAmount,
          escrowId: escrow.id,
          status: 'active',
          createdAt: clock.nowIso(),
          scheduledAt: '2026-06-05T10:00:00.000Z',
        };
        (marketplace as any).sessions.push(s);
        return s;
      };

      createFundedActiveSession('s-rel', 'p1');
      createFundedActiveSession('s-ref', 'p2');
      createFundedActiveSession('s-split', 'p3');

      const d1 = await marketplace.openSessionDispute('s-rel', 'owner-1', 'Dispute one asking for review of deliverables');
      const d2 = await marketplace.openSessionDispute('s-ref', '7', 'Dispute two from mentor side over session issue');
      const d3 = await marketplace.openSessionDispute('s-split', 'owner-1', 'Dispute three partial completion of milestones');

      // Frozen: release/cancel blocked with 409 SESSION_DISPUTED
      expect(() => marketplace.completeSession('s-rel', 'owner-1')).toThrow(ConflictException);
      expect(() => marketplace.cancelSession('s-ref', 'owner-1')).toThrow(ConflictException);
      expect(marketplace.reconcileEscrow().ok).toBe(true);

      // Decide release_to_mentor
      const res1 = await marketplace.decideDispute(d1.id, 'admin-1', {
        decision: 'release_to_mentor',
        reason: 'Mentor delivered full agreed architectural review.',
      });
      expect(res1.dispute.mentorAmount).toBe(1000);
      expect(res1.dispute.ownerRefundAmount).toBe(0);
      expect(res1.session.status).toBe('completed');
      expect(marketplace.reconcileEscrow().ok).toBe(true);

      // Decide refund_to_owner
      const res2 = await marketplace.decideDispute(d2.id, 'admin-1', {
        decision: 'refund_to_owner',
        reason: 'Mentor could not attend scheduled slot.',
      });
      expect(res2.dispute.mentorAmount).toBe(0);
      expect(res2.dispute.ownerRefundAmount).toBe(1170);
      expect(res2.session.status).toBe('refunded');
      expect(marketplace.reconcileEscrow().ok).toBe(true);

      // Decide split 70/30 -> 700 mentor payout, 15% of 700 = 105 platformFee, 1170 - 700 - 105 = 365 refund
      const res3 = await marketplace.decideDispute(d3.id, 'admin-1', {
        decision: 'split',
        mentorPercent: 70,
        reason: '70% of session milestones completed cleanly.',
      });
      expect(res3.dispute.mentorAmount).toBe(700);
      expect(res3.dispute.platformFee).toBe(105);
      expect(res3.dispute.ownerRefundAmount).toBe(365);
      expect(res3.session.status).toBe('split');

      const rec = marketplace.reconcileEscrow();
      expect(rec.ok).toBe(true);
      expect(rec.mismatches).toHaveLength(0);
    });
  });
});
