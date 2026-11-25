import { ReputationService } from './reputation.service';
import { SEED_USER_REPUTATION } from './reputation.seeds';
import { GamificationService } from '../gamification/gamification.service';
import { GamificationRepository } from '../gamification/gamification.repository';
import { ClockService } from '../common/services/clock.service';
import { AuditService } from '../audit/audit.service';

describe('Phase 22 Unit: Single Reputation Ledger & Anti-Farming Completion Rules', () => {
  let clock: ClockService;
  let auditService: AuditService;
  let usersRepoMock: any;
  let gamificationRepo: GamificationRepository;
  let reputationService: ReputationService;
  let gamificationService: GamificationService;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.ALLOW_STORE_RESET = 'true';
    clock = new ClockService();
    clock.setTime('2026-07-01T12:00:00.000Z');
    auditService = new AuditService(clock);
    auditService.reset();

    usersRepoMock = {
      findAll: () => [
        { id: '1', name: 'Priya Patel' },
        { id: '2', name: 'Arjun Sharma' },
        { id: '6', name: 'Aditya Sai' },
      ],
    };

    gamificationRepo = new GamificationRepository();
    gamificationRepo.reset();
    reputationService = new ReputationService(
      clock,
      gamificationRepo,
      usersRepoMock,
      auditService,
    );
    reputationService.reset();
    reputationService.onModuleInit();
    gamificationService = new GamificationService(gamificationRepo, reputationService);
  });

  it('1. Single startup backfill sets seeded reputation once (Arjun=87, never 174) and restarts are no-ops', () => {
    expect(reputationService.getTotal('2')).toBe(SEED_USER_REPUTATION['2']);
    expect(reputationService.getTotal('2')).toBe(87);
    expect(reputationService.getTotal('1')).toBe(93);

    // Repeating backfill / onModuleInit does not double seed entries
    reputationService.backfillStartupSeedUsers();
    reputationService.onModuleInit();

    expect(reputationService.getTotal('2')).toBe(87);
    const seedEntries = reputationService.getEntries('2').filter((e) => e.type === 'seed');
    expect(seedEntries).toHaveLength(1);
    expect(seedEntries[0].reason).toBe('Starting reputation');
  });

  it('2. repairReputationLedger keeps first seed entry, strips duplicates, preserves non-seed entries, and audits LEDGER_REPAIRED', () => {
    const entries = (reputationService as any).entries;
    entries.push({
      id: 'rep-dup-seed-1',
      userId: '2',
      type: 'seed',
      delta: 87,
      refId: 'seed-2-dup',
      createdAt: '2026-06-01T00:00:00.000Z',
    });
    entries.push({
      id: 'rep-dup-seed-2',
      userId: '1',
      type: 'seed',
      delta: 93,
      createdAt: '2026-06-01T00:00:00.000Z',
    });
    entries.push({
      id: 'rep-real-task',
      userId: '2',
      type: 'task_approved',
      delta: 8,
      refId: 'task-901',
      createdAt: '2026-06-15T10:00:00.000Z',
    });
    entries.push({
      id: 'rep-real-warn',
      userId: '2',
      type: 'warning',
      delta: -10,
      refId: 'warn-901',
      createdAt: '2026-06-16T10:00:00.000Z',
    });

    reputationService.repairReputationLedger();

    expect(reputationService.getTotal('2')).toBe(87 + 8 - 10);
    expect(reputationService.getTotal('1')).toBe(93);
    expect(reputationService.getEntries('2').filter((e) => e.type === 'seed')).toHaveLength(1);
    expect(reputationService.getEntries('2').some((e) => e.type === 'task_approved' && e.refId === 'task-901')).toBe(true);
    expect(reputationService.getEntries('2').some((e) => e.type === 'warning' && e.refId === 'warn-901')).toBe(true);

    const repairAudit = auditService.findAll().find((a) => a.action === 'LEDGER_REPAIRED');
    expect(repairAudit).toBeDefined();
    expect(repairAudit?.details?.removedDuplicates).toBe(2);
    expect(repairAudit?.details?.affectedUserCount).toBe(2);
  });

  it('3. getTotals bulk helper matches getTotal for every user and clamps below zero', () => {
    reputationService.recordSeed('low-user', 5);
    reputationService.recordWarning('low-user', 'warn-low');
    expect(reputationService.getTotal('low-user')).toBe(0);

    const totals = reputationService.getTotals(['1', '2', 'low-user', 'unknown-user']);
    expect(totals['1']).toBe(reputationService.getTotal('1'));
    expect(totals['2']).toBe(reputationService.getTotal('2'));
    expect(totals['low-user']).toBe(0);
    expect(totals['unknown-user']).toBe(0);
  });

  it('4. Writes are idempotent by (type, refId, userId) across initial, task_approved, project_completed, warning, appeal & deadline', () => {
    reputationService.recordInitial('u-fresh');
    reputationService.recordInitial('u-fresh');
    expect(reputationService.getTotal('u-fresh')).toBe(100);

    reputationService.recordTaskApproved('u-fresh', 't-100');
    reputationService.recordTaskApproved('u-fresh', 't-100');
    expect(reputationService.getTotal('u-fresh')).toBe(108);

    reputationService.recordProjectCompleted('u-fresh', 'p-100');
    reputationService.recordProjectCompleted('u-fresh', 'p-100');
    expect(reputationService.getTotal('u-fresh')).toBe(123);

    reputationService.recordWarning('u-fresh', 'w-100');
    reputationService.recordWarning('u-fresh', 'w-100');
    expect(reputationService.getTotal('u-fresh')).toBe(113);

    reputationService.recordWarningRemoved('u-fresh', 'w-100');
    reputationService.recordWarningRemoved('u-fresh', 'w-100');
    expect(reputationService.getTotal('u-fresh')).toBe(123);

    reputationService.recordDeadlineMissed('u-fresh', 't-missed');
    reputationService.recordDeadlineMissed('u-fresh', 't-missed');
    expect(reputationService.getTotal('u-fresh')).toBe(118);
  });

  it('5. Enforces all 4 completion anti-farming rules, awards +15 rep/+250 XP once when valid, and audits BADGE_WITHHELD on failures', () => {
    reputationService.recordInitial('owner-a');
    const nowMs = clock.now().getTime();
    const fourDaysAgo = new Date(nowMs - 4 * 24 * 60 * 60 * 1000).toISOString();
    const twoDaysAgo = new Date(nowMs - 2 * 24 * 60 * 60 * 1000).toISOString();
    const twoHoursAgo = new Date(nowMs - 2 * 60 * 60 * 1000).toISOString();
    const tenMinAgo = new Date(nowMs - 10 * 60 * 1000).toISOString();
    const approvedNow = new Date(nowMs).toISOString();

    // (a) 2 approved tasks -> withheld
    const rFewTasks = gamificationService.awardProjectCompletion('owner-a', 'p-few', 2, {
      nowMs,
      project: { id: 'p-few', ownerId: 'owner-a', createdAt: fourDaysAgo, collaborators: [{ id: 'collab-1' }] },
      auditService,
    });
    expect(rFewTasks.badgeAwarded).toBe(false);
    expect(rFewTasks.withheldRule).toBe('MIN_APPROVED_TASKS');
    expect(reputationService.getTotal('owner-a')).toBe(100);

    // (b) 3 approved tasks on 2-day-old project -> withheld
    const rYoung = gamificationService.awardProjectCompletion('owner-a', 'p-young', 3, {
      nowMs,
      project: { id: 'p-young', ownerId: 'owner-a', createdAt: twoDaysAgo, collaborators: [{ id: 'collab-1' }] },
      tasks: [
        { id: 't1', status: 'Completed', assigneeId: 'collab-1', assignedAt: twoHoursAgo, approvedAt: approvedNow },
        { id: 't2', status: 'Completed', assigneeId: 'collab-1', assignedAt: twoHoursAgo, approvedAt: approvedNow },
        { id: 't3', status: 'Completed', assigneeId: 'collab-1', assignedAt: twoHoursAgo, approvedAt: approvedNow },
      ],
      auditService,
    });
    expect(rYoung.badgeAwarded).toBe(false);
    expect(rYoung.reason).toBe('No badge: project is under 3 days old');
    expect(reputationService.getTotal('owner-a')).toBe(100);

    // (c) 3 approved tasks on 4-day-old project, 1 task approved after 10 min -> withheld
    const rFast = gamificationService.awardProjectCompletion('owner-a', 'p-fast', 3, {
      nowMs,
      project: { id: 'p-fast', ownerId: 'owner-a', createdAt: fourDaysAgo, collaborators: [{ id: 'collab-1' }] },
      tasks: [
        { id: 't1', status: 'Completed', assigneeId: 'collab-1', assignedAt: twoHoursAgo, approvedAt: approvedNow },
        { id: 't2', status: 'Completed', assigneeId: 'collab-1', assignedAt: twoHoursAgo, approvedAt: approvedNow },
        { id: 't3', status: 'Completed', assigneeId: 'collab-1', assignedAt: tenMinAgo, approvedAt: approvedNow },
      ],
      auditService,
    });
    expect(rFast.badgeAwarded).toBe(false);
    expect(rFast.withheldRule).toBe('TASK_MIN_REVIEW_GAP');
    expect(reputationService.getTotal('owner-a')).toBe(100);

    // (d) Owner and collaborator in same Phase 16 duplicate group -> withheld
    const rDup = gamificationService.awardProjectCompletion('owner-a', 'p-dup', 3, {
      nowMs,
      project: { id: 'p-dup', ownerId: 'owner-a', createdAt: fourDaysAgo, collaborators: [{ id: 'collab-alt' }] },
      tasks: [
        { id: 't1', status: 'Completed', assigneeId: 'collab-alt', assignedAt: twoHoursAgo, approvedAt: approvedNow },
        { id: 't2', status: 'Completed', assigneeId: 'collab-alt', assignedAt: twoHoursAgo, approvedAt: approvedNow },
        { id: 't3', status: 'Completed', assigneeId: 'collab-alt', assignedAt: twoHoursAgo, approvedAt: approvedNow },
      ],
      duplicateGroups: [{ users: [{ id: 'owner-a' }, { id: 'collab-alt' }] }],
      auditService,
    });
    expect(rDup.badgeAwarded).toBe(false);
    expect(rDup.withheldRule).toBe('DUPLICATE_GROUP_COLLUSION');
    expect(reputationService.getTotal('owner-a')).toBe(100);

    const withheldLogs = auditService.findAll().filter((a) => a.action === 'BADGE_WITHHELD');
    expect(withheldLogs).toHaveLength(4);
    expect(withheldLogs.map((l) => l.details?.failedRule).sort()).toEqual([
      'DUPLICATE_GROUP_COLLUSION',
      'MIN_APPROVED_TASKS',
      'MIN_PROJECT_AGE',
      'TASK_MIN_REVIEW_GAP',
    ]);

    // (e) Valid project (>=3 days old, 3 tasks >=60 min gap, distinct collaborator) -> awarded once
    const rValid = gamificationService.awardProjectCompletion('owner-a', 'p-valid', 3, {
      nowMs,
      project: { id: 'p-valid', ownerId: 'owner-a', createdAt: fourDaysAgo, collaborators: [{ id: 'collab-clean' }] },
      tasks: [
        { id: 'tv1', status: 'Completed', assigneeId: 'collab-clean', assignedAt: twoHoursAgo, approvedAt: approvedNow },
        { id: 'tv2', status: 'Completed', assigneeId: 'collab-clean', assignedAt: twoHoursAgo, approvedAt: approvedNow },
        { id: 'tv3', status: 'Completed', assigneeId: 'collab-clean', assignedAt: twoHoursAgo, approvedAt: approvedNow },
      ],
      duplicateGroups: [],
      auditService,
    });
    expect(rValid.badgeAwarded).toBe(true);
    expect(reputationService.getTotal('owner-a')).toBe(115);
    expect(gamificationService.getUserStats('owner-a').totalXp).toBe(250);

    // Replay for same (projectId, userId) is idempotent
    const rReplay = gamificationService.awardProjectCompletion('owner-a', 'p-valid', 3, {
      nowMs,
      project: { id: 'p-valid', ownerId: 'owner-a', createdAt: fourDaysAgo, collaborators: [{ id: 'collab-clean' }] },
      tasks: [
        { id: 'tv1', status: 'Completed', assigneeId: 'collab-clean', assignedAt: twoHoursAgo, approvedAt: approvedNow },
        { id: 'tv2', status: 'Completed', assigneeId: 'collab-clean', assignedAt: twoHoursAgo, approvedAt: approvedNow },
        { id: 'tv3', status: 'Completed', assigneeId: 'collab-clean', assignedAt: twoHoursAgo, approvedAt: approvedNow },
      ],
      duplicateGroups: [],
      auditService,
    });
    expect(rReplay.badgeAwarded).toBe(true);
    expect(reputationService.getTotal('owner-a')).toBe(115);
    expect(gamificationService.getUserStats('owner-a').totalXp).toBe(250);
  });
});
