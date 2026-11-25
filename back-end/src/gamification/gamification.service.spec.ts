import { GamificationService } from './gamification.service';
import { GamificationRepository } from './gamification.repository';
import { ReputationService } from '../moderation/reputation.service';
import { ClockService } from '../common/services/clock.service';

describe('GamificationService - Single Reputation Ledger & Completion Thresholds', () => {
  let service: GamificationService;
  let repository: GamificationRepository;
  let reputationService: ReputationService;
  let clockService: ClockService;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.ALLOW_STORE_RESET = 'true';
    clockService = new ClockService();
    clockService.setTime('2026-06-10T12:00:00.000Z');
    repository = new GamificationRepository();
    repository.reset();
    reputationService = new ReputationService(clockService);
    reputationService.reset();
    service = new GamificationService(repository, reputationService);
  });

  it('records initial 100 reputation for new accounts via ReputationService', () => {
    const testUserId = 'test-new-user-1';
    reputationService.recordInitial(testUserId);

    const stats = service.getUserStats(testUserId);
    expect(stats.repScore).toBe(100);
    expect(stats.totalXp).toBe(0);

    const repLedger = reputationService.getEntries(testUserId);
    expect(repLedger).toHaveLength(1);
    expect(repLedger[0].delta).toBe(100);
    expect(repLedger[0].type).toBe('initial');
  });

  it('deducts 10 reputation per warning issued through ReputationService', () => {
    const testUserId = 'test-user-warn';
    reputationService.recordInitial(testUserId); // 100

    reputationService.recordWarning(testUserId, 'warn-1');
    expect(service.getUserStats(testUserId).repScore).toBe(90);

    reputationService.recordWarning(testUserId, 'warn-2');
    expect(service.getUserStats(testUserId).repScore).toBe(80);
  });

  it('clamps reputation at zero so reputation never goes below 0', () => {
    const testUserId = 'test-zero-rep';
    reputationService.recordSeed(testUserId, 15);

    reputationService.recordWarning(testUserId, 'w-1'); // 15 - 10 = 5
    expect(service.getUserStats(testUserId).repScore).toBe(5);

    reputationService.recordWarning(testUserId, 'w-2'); // clamped to 0
    expect(service.getUserStats(testUserId).repScore).toBe(0);

    reputationService.recordWarning(testUserId, 'w-3'); // still clamped to 0
    expect(service.getUserStats(testUserId).repScore).toBe(0);
  });

  it('restores 10 reputation when a warning is removed by appeal or review', () => {
    const testUserId = 'test-appeal-user';
    reputationService.recordInitial(testUserId); // 100

    reputationService.recordWarning(testUserId, 'warn-appeal-1'); // 90
    expect(service.getUserStats(testUserId).repScore).toBe(90);

    reputationService.recordWarningRemoved(testUserId, 'warn-appeal-1'); // 90 + 10 = 100
    expect(service.getUserStats(testUserId).repScore).toBe(100);

    const repLedger = reputationService.getEntries(testUserId);
    expect(repLedger).toHaveLength(3);
    const removeEntry = repLedger.find((e) => e.type === 'warning_removed');
    expect(removeEntry).toBeDefined();
    expect(removeEntry?.delta).toBe(10);
  });

  describe('Phase 8 & Phase 22: Project completion badge thresholds', () => {
    it('awards no badge when project has fewer than 3 approved tasks (e.g. 1 task)', () => {
      const res = service.awardProjectCompletion('user-owner-1', 'proj-1', 1);
      expect(res.badgeAwarded).toBe(false);
      expect(res.reason).toBe('Completed. Badges need at least 3 approved tasks');

      const stats = service.getUserStats('user-owner-1');
      expect(stats.totalXp).toBe(0);
    });

    it('awards completion badge, +250 XP, and +15 rep when project meets all rules', () => {
      reputationService.recordInitial('user-owner-2');
      const nowMs = clockService.now().getTime();
      const fourDaysAgo = new Date(nowMs - 4 * 24 * 60 * 60 * 1000).toISOString();
      const twoHoursAgo = new Date(nowMs - 2 * 60 * 60 * 1000).toISOString();
      const approvedAt = new Date(nowMs).toISOString();

      const res = service.awardProjectCompletion('user-owner-2', 'proj-2', 3, {
        nowMs,
        project: {
          id: 'proj-2',
          ownerId: 'user-owner-2',
          createdAt: fourDaysAgo,
          collaborators: [{ id: 'collab-99' }],
        },
        tasks: [
          { id: 't-1', status: 'Completed', assigneeId: 'collab-99', assignedAt: twoHoursAgo, approvedAt },
          { id: 't-2', status: 'Completed', assigneeId: 'collab-99', assignedAt: twoHoursAgo, approvedAt },
          { id: 't-3', status: 'Completed', assigneeId: 'collab-99', assignedAt: twoHoursAgo, approvedAt },
        ],
      });
      expect(res.badgeAwarded).toBe(true);
      expect(res.reason).toContain('Completion badge awarded');

      const stats = service.getUserStats('user-owner-2');
      expect(stats.totalXp).toBe(250);
      expect(stats.repScore).toBe(115);
    });
  });
});
