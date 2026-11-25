import { ReputationService } from './reputation.service';
import { TrustService } from '../users/trust.service';
import { ClockService } from '../common/services/clock.service';
import { REPUTATION_CONFIG } from '../reputation/reputation.config';

describe('Better Reputation System & Trust Metrics Unit Tests', () => {
  let clockService: ClockService;
  let reputationService: ReputationService;
  let trustService: TrustService;
  let recordedAudits: any[];
  let mockAuditService: any;
  let mockUsersRepo: any;
  let mockProjectsRepo: any;
  let mockTasksRepo: any;
  let mockGamificationRepo: any;
  let mockDuplicateDetectionService: any;

  beforeEach(() => {
    clockService = new ClockService();
    recordedAudits = [];
    mockAuditService = {
      log: (entry: any) => {
        recordedAudits.push(entry);
      },
      record: (entry: any) => {
        recordedAudits.push(entry);
      },
    };
    mockGamificationRepo = {
      addLedgerEntry: () => {},
      findByUserId: () => [],
    };
    mockUsersRepo = {
      findAll: () => [],
      findById: (id: string) => null,
    };
    mockProjectsRepo = {
      findAll: () => [],
      findById: (id: string) => null,
    };
    mockTasksRepo = {
      findAll: () => [],
      findByAssigneeId: () => [],
    };
    mockDuplicateDetectionService = {
      computeDuplicateGroups: () => ({ groups: [] }),
    };

    reputationService = new ReputationService(
      clockService,
      mockGamificationRepo,
      mockUsersRepo,
      mockAuditService,
    );

    trustService = new TrustService(
      mockUsersRepo,
      reputationService,
      mockGamificationRepo,
      mockTasksRepo,
      mockProjectsRepo,
      mockDuplicateDetectionService,
      clockService,
    );
  });

  afterEach(() => {
    reputationService.reset();
  });

  describe('1. Reputation Clamped Walk & Bounds (0 to 100)', () => {
    it('walks standing entries in time order, clamps to [0, 100], and preserves seeded user values', () => {
      // 1. Initial 100
      reputationService.recordInitial('u-test');
      expect(reputationService.getTotal('u-test')).toBe(100);

      // 2. Penalty -10 gives 90
      reputationService.recordWarning('u-test', 'warn-1');
      expect(reputationService.getTotal('u-test')).toBe(90);

      // 3. Recovery +2 gives 92
      reputationService.recordRecovery('u-test', 'rec-1');
      expect(reputationService.getTotal('u-test')).toBe(92);

      // 4. Over-recovery / bonuses never exceed 100
      reputationService.addEntry('u-test', 'recovery', 20, 'rec-2', undefined, 'standing');
      expect(reputationService.getTotal('u-test')).toBe(100);

      // 5. Penalties floor at 0
      reputationService.recordWarning('u-test', 'warn-2'); // 90
      reputationService.addEntry('u-test', 'warning', -150, 'warn-3', undefined, 'standing');
      expect(reputationService.getTotal('u-test')).toBe(0);

      // 6. Seeded user preserves seed value (87 remains 87)
      reputationService.recordSeed('u-seeded', 87);
      expect(reputationService.getTotal('u-seeded')).toBe(87);
    });

    it('re-types legacy +8 and +15 as contribution on migrateLedger and excludes them from total', () => {
      // Add unmigrated legacy entries
      reputationService.recordInitial('u-legacy');
      reputationService.addEntry('u-legacy', 'task_approved', 8, 'task-old', undefined);
      reputationService.addEntry('u-legacy', 'project_completed', 15, 'proj-old', undefined);

      // Run migration
      reputationService.migrateLedger();
      expect(recordedAudits.some((a) => a.action === 'LEDGER_MIGRATED')).toBe(true);

      // Reputation must strictly be 100 (excluding contribution entries)
      expect(reputationService.getTotal('u-legacy')).toBe(100);

      // Migration must be idempotent and not re-audit
      recordedAudits = [];
      reputationService.migrateLedger();
      expect(recordedAudits.length).toBe(0);
    });

    it('getTotals matches getTotal for all users', () => {
      reputationService.recordInitial('u1');
      reputationService.recordSeed('u2', 82);
      reputationService.recordWarning('u1', 'w1');

      const bulk = reputationService.getTotals(['u1', 'u2', 'u3']);
      expect(bulk['u1']).toBe(reputationService.getTotal('u1'));
      expect(bulk['u2']).toBe(reputationService.getTotal('u2'));
      expect(bulk['u3']).toBe(reputationService.getTotal('u3'));
      expect(bulk['u1']).toBe(90);
      expect(bulk['u2']).toBe(82);
      expect(bulk['u3']).toBe(0);
    });
  });

  describe('2. Good Conduct Recovery Daily Job', () => {
    it('awards +2 recovery points after 14 clean days without penalties or recovery, idempotently by date bucket', () => {
      const now = new Date('2026-11-20T12:00:00.000Z');
      const twentyDaysAgo = new Date('2026-11-01T12:00:00.000Z');
      const fifteenDaysAgo = new Date('2026-11-05T12:00:00.000Z');

      // User with 80 rep after warning 15 days ago, initial 20 days ago
      const initEntry = reputationService.recordInitial('u-recov');
      initEntry.createdAt = twentyDaysAgo.toISOString();
      const warnEntry = reputationService.recordWarning('u-recov', 'w-old');
      warnEntry.createdAt = fifteenDaysAgo.toISOString();

      mockUsersRepo.findAll = () => [
        { id: 'u-recov', status: 'active', isSuspended: false },
      ];

      expect(reputationService.getTotal('u-recov')).toBe(90);

      // Run recovery job
      const res = reputationService.processDailyRecovery(now);
      expect(res.recoveredUsers.length).toBe(1);
      expect(reputationService.getTotal('u-recov')).toBe(92);

      // Running again in same date bucket is idempotent (does not award twice)
      const secondRun = reputationService.processDailyRecovery(now);
      expect(secondRun.recoveredUsers.length).toBe(0);
      expect(reputationService.getTotal('u-recov')).toBe(92);

      // Audit was recorded
      expect(recordedAudits.some((a) => a.action === 'REPUTATION_RECOVERED' && a.entityId === 'u-recov')).toBe(true);
    });

    it('skips recovery if penalties occurred within 14 days, user is suspended, or rep is already 100', () => {
      const now = new Date('2026-11-20T12:00:00.000Z');
      const twentyDaysAgo = new Date('2026-11-01T12:00:00.000Z');
      const fiveDaysAgo = new Date('2026-11-15T12:00:00.000Z');

      // User A: warning only 5 days ago (< 14 days)
      const initA = reputationService.recordInitial('u-recent-warn');
      initA.createdAt = twentyDaysAgo.toISOString();
      const w = reputationService.recordWarning('u-recent-warn', 'w-recent');
      w.createdAt = fiveDaysAgo.toISOString();

      // User B: suspended
      reputationService.recordInitial('u-susp');
      reputationService.recordWarning('u-susp', 'w-susp');

      // User C: already at 100
      reputationService.recordInitial('u-full');

      mockUsersRepo.findAll = () => [
        { id: 'u-recent-warn', status: 'active', isSuspended: false },
        { id: 'u-susp', status: 'suspended', isSuspended: true },
        { id: 'u-full', status: 'active', isSuspended: false },
      ];

      const res = reputationService.processDailyRecovery(now);
      expect(res.recoveredUsers.length).toBe(0);
      expect(res.skipped).toBe(3);
      expect(reputationService.getTotal('u-recent-warn')).toBe(90);
      expect(reputationService.getTotal('u-susp')).toBe(90);
      expect(reputationService.getTotal('u-full')).toBe(100);
    });
  });

  describe('3. Verified Contribution Rules (Phase 22)', () => {
    const validProject: any = {
      id: 'proj-1',
      title: 'Valid Project',
      ownerId: 'owner-1',
      collaborators: ['owner-1', 'collab-1'],
    };

    it('rejects self-approval (approver === assignee)', () => {
      const task: any = {
        id: 't-1',
        projectId: 'proj-1',
        status: 'Done',
        assigneeId: 'owner-1',
        assignedAt: '2026-11-01T10:00:00.000Z',
        approvedAt: '2026-11-01T12:00:00.000Z',
      };
      expect(trustService.isVerifiedContribution(task, validProject)).toBe(false);
    });

    it('rejects tasks with review gap < 60 minutes after assignment', () => {
      const task: any = {
        id: 't-2',
        projectId: 'proj-1',
        status: 'Done',
        assigneeId: 'collab-1',
        assignedAt: '2026-11-01T10:00:00.000Z',
        approvedAt: '2026-11-01T10:30:00.000Z', // Only 30 minutes!
      };
      expect(trustService.isVerifiedContribution(task, validProject)).toBe(false);
    });

    it('rejects tasks in single-person projects (< 2 distinct people)', () => {
      const soloProject: any = {
        id: 'proj-solo',
        ownerId: 'owner-1',
        collaborators: ['owner-1'],
      };
      const task: any = {
        id: 't-3',
        projectId: 'proj-solo',
        status: 'Done',
        assigneeId: 'owner-1',
        assignedAt: '2026-11-01T10:00:00.000Z',
        approvedAt: '2026-11-01T12:00:00.000Z',
      };
      expect(trustService.isVerifiedContribution(task, soloProject)).toBe(false);
    });

    it('rejects collusion where approver and assignee belong to the same duplicate account group', () => {
      const dupGroup = { users: [{ id: 'owner-1' }, { id: 'collab-1' }] };
      const task: any = {
        id: 't-4',
        projectId: 'proj-1',
        status: 'Done',
        assigneeId: 'collab-1',
        assignedAt: '2026-11-01T10:00:00.000Z',
        approvedAt: '2026-11-01T12:00:00.000Z',
      };
      expect(trustService.isVerifiedContribution(task, validProject, [dupGroup])).toBe(false);
    });

    it('accepts legitimate task meeting all 5 verification conditions', () => {
      const task: any = {
        id: 't-valid',
        projectId: 'proj-1',
        status: 'Done',
        assigneeId: 'collab-1',
        assignedAt: '2026-11-01T10:00:00.000Z',
        approvedAt: '2026-11-01T11:30:00.000Z', // 90 min gap
      };
      expect(trustService.isVerifiedContribution(task, validProject)).toBe(true);
    });
  });

  describe('4. Weekly Pair Cap Enforcement', () => {
    it('caps verified tasks between any owner-collaborator pair at 10 per week', () => {
      const project: any = {
        id: 'proj-1',
        ownerId: 'owner-1',
        collaborators: ['owner-1', 'collab-1'],
      };
      const tasks: any[] = [];
      // Create 15 valid tasks approved in the same calendar week
      for (let i = 1; i <= 15; i++) {
        tasks.push({
          id: `task-${i}`,
          projectId: 'proj-1',
          status: 'Done',
          assigneeId: 'collab-1',
          assignedAt: `2026-11-10T08:00:00.000Z`,
          approvedAt: `2026-11-10T10:00:00.000Z`,
          dueDate: '2026-11-15T00:00:00.000Z',
        });
      }

      mockTasksRepo.findAll = () => tasks;
      mockProjectsRepo.findAll = () => [project];
      mockUsersRepo.findById = () => ({ id: 'collab-1', createdAt: '2026-01-01T00:00:00.000Z' });

      const record = trustService.getTrackRecord('collab-1');
      expect(record.tasksApproved).toBe(10); // Capped at 10!
    });
  });

  describe('5. Track Record Rates & Trust Labels', () => {
    it('returns onTimeRate as null when verified tasks < 3', () => {
      const project: any = { id: 'p1', ownerId: 'o1', collaborators: ['o1', 'c1'] };
      const tasks: any[] = [
        {
          id: 't1',
          projectId: 'p1',
          status: 'Done',
          assigneeId: 'c1',
          assignedAt: '2026-11-01T08:00:00.000Z',
          approvedAt: '2026-11-01T10:00:00.000Z',
          dueDate: '2026-11-02T00:00:00.000Z',
        },
      ];

      mockTasksRepo.findAll = () => tasks;
      mockProjectsRepo.findAll = () => [project];
      mockUsersRepo.findById = () => ({ id: 'c1', createdAt: '2026-01-01T00:00:00.000Z' });

      const record = trustService.getTrackRecord('c1');
      expect(record.tasksApproved).toBe(1);
      expect(record.onTimeRate).toBeNull();
    });

    it('assigns labels according to strict precedence rules', () => {
      // 1. New member (< 14 days old and < 3 tasks)
      const now = new Date('2026-11-20T00:00:00.000Z');
      const labelNew = trustService.computeTrustLabel(
        100,
        { tasksApproved: 1, projectsCompleted: 0, onTimeRate: null, memberSince: '2026-11-15T00:00:00.000Z', activeThisWeek: false },
        { createdAt: '2026-11-15T00:00:00.000Z' } as any,
        false,
        now,
      );
      expect(labelNew).toBe('New member');

      // 2. Trusted contributor (rep >= 90, tasks >= 10, projects >= 2, onTime >= 80%, no suspension 90d)
      const labelTrusted = trustService.computeTrustLabel(
        95,
        { tasksApproved: 12, projectsCompleted: 2, onTimeRate: 85, memberSince: '2025-01-01T00:00:00.000Z', activeThisWeek: true },
        { createdAt: '2025-01-01T00:00:00.000Z' } as any,
        false,
        now,
      );
      expect(labelTrusted).toBe('Trusted contributor');

      // 3. Reliable (rep >= 80, tasks >= 5, onTime >= 70%)
      const labelReliable = trustService.computeTrustLabel(
        82,
        { tasksApproved: 6, projectsCompleted: 1, onTimeRate: 75, memberSince: '2025-01-01T00:00:00.000Z', activeThisWeek: true },
        { createdAt: '2025-01-01T00:00:00.000Z' } as any,
        false,
        now,
      );
      expect(labelReliable).toBe('Reliable');

      // 4. Rising (>= 1 task)
      const labelRising = trustService.computeTrustLabel(
        75,
        { tasksApproved: 2, projectsCompleted: 0, onTimeRate: null, memberSince: '2025-01-01T00:00:00.000Z', activeThisWeek: true },
        { createdAt: '2025-01-01T00:00:00.000Z' } as any,
        false,
        now,
      );
      expect(labelRising).toBe('Rising');

      // 5. Getting started (0 tasks, account older than 14 days)
      const labelStarted = trustService.computeTrustLabel(
        100,
        { tasksApproved: 0, projectsCompleted: 0, onTimeRate: null, memberSince: '2025-01-01T00:00:00.000Z', activeThisWeek: false },
        { createdAt: '2025-01-01T00:00:00.000Z' } as any,
        false,
        now,
      );
      expect(labelStarted).toBe('Getting started');
    });

    it('assigns standing bands correctly at boundary values', () => {
      expect(trustService.computeStandingBand(100)).toBe('Good standing');
      expect(trustService.computeStandingBand(80)).toBe('Good standing');
      expect(trustService.computeStandingBand(79)).toBe('Fair standing');
      expect(trustService.computeStandingBand(60)).toBe('Fair standing');
      expect(trustService.computeStandingBand(59)).toBe('Low standing');
      expect(trustService.computeStandingBand(0)).toBe('Low standing');
    });
  });

  describe('6. Privacy and Authorization Safeguards', () => {
    it('conceals exact reputation number and admin flags from public callers', () => {
      mockUsersRepo.findById = () => ({
        id: 'u-target',
        name: 'Target User',
        email: 'target@example.com',
        role: 'Collaborator',
        status: 'active',
        createdAt: '2025-01-01T00:00:00.000Z',
      });
      reputationService.recordInitial('u-target');
      reputationService.recordWarning('u-target', 'w1'); // rep = 90

      // Public viewer (another user)
      const callerOther = { id: 'u-other', role: 'Collaborator' };
      const publicView = trustService.getUserTrustSummary('u-target', callerOther);

      expect((publicView as any).reputation).toBeUndefined();
      expect((publicView as any).needsAttention).toBeUndefined();
      expect((publicView as any).ledgerLink).toBeUndefined();
      expect(publicView.band).toBe('Good standing');

      // Profile owner viewer
      const callerSelf = { id: 'u-target', role: 'Collaborator' };
      const selfView = trustService.getUserTrustSummary('u-target', callerSelf);
      expect(selfView.reputation).toBe(90);
      expect(selfView.ledgerLink).toBeDefined();

      // Admin viewer
      const callerAdmin = { id: 'admin-1', role: 'Administrator', permissions: ['users'] };
      const adminView = trustService.getUserTrustSummary('u-target', callerAdmin);
      expect(adminView.reputation).toBe(90);
      expect(adminView.needsAttention).toBe(false);
      expect(adminView.ledgerLink).toBeDefined();
    });

    it('returns anonymised summary for unknown or deleted users', () => {
      mockUsersRepo.findById = () => null;
      const summary = trustService.getUserTrustSummary('non-existent');
      expect(summary.label).toBe('Getting started');
      expect(summary.band).toBe('Good standing');
      expect(summary.xp).toBe(0);
      expect(summary.trackRecord.tasksApproved).toBe(0);
      expect((summary as any).reputation).toBeUndefined();
    });
  });
});
