import { ReputationService } from './reputation.service';
import { ClockService } from '../common/services/clock.service';

describe('ReputationService Unit Tests', () => {
  let reputationService: ReputationService;
  let clockService: ClockService;
  let mockGamificationRepo: any;
  let mockUsersRepo: any;

  beforeEach(() => {
    clockService = new ClockService();
    mockGamificationRepo = {
      addLedgerEntry: () => {},
    };
    mockUsersRepo = {
      findAll: () => [
        { id: 'u1', rep: 75, profile: { rep: 75 } },
        { id: 'u2', rep: 95, profile: { rep: 95 } },
      ],
    };

    reputationService = new ReputationService(
      clockService,
      mockGamificationRepo,
      mockUsersRepo,
    );
  });

  afterEach(() => {
    reputationService.reset();
  });

  it('records initial 100 reputation for new accounts in ledger', () => {
    const entry = reputationService.recordInitial('new-user-1');
    expect(entry.delta).toBe(100);
    expect(entry.type).toBe('initial');

    const total = reputationService.getReputation('new-user-1');
    expect(total).toBe(100);
  });

  it('records +8 on task approval as contribution without changing reputation total', () => {
    reputationService.recordInitial('dev-1');
    const entry = reputationService.recordTaskApproved('dev-1', 'task-101', 'proj-1');

    expect(entry.delta).toBe(8);
    expect(entry.refId).toBe('task-101');
    expect(entry.entryClass).toBe('contribution');
    expect(reputationService.getReputation('dev-1')).toBe(100);
  });

  it('records -10 on warning', () => {
    reputationService.recordInitial('dev-2');
    const entry = reputationService.recordWarning('dev-2', 'warn-1');

    expect(entry.delta).toBe(-10);
    expect(entry.refId).toBe('warn-1');
    expect(reputationService.getReputation('dev-2')).toBe(90);
  });

  it('clamps reputation at zero so reputation never goes below 0', () => {
    // User with 15 rep
    reputationService.recordSeed('user-low', 15);
    expect(reputationService.getReputation('user-low')).toBe(15);

    // Warning 1: 15 - 10 = 5
    reputationService.recordWarning('user-low', 'w1');
    expect(reputationService.getReputation('user-low')).toBe(5);

    // Warning 2: 5 - 10 = -5 -> clamped to 0
    reputationService.recordWarning('user-low', 'w2');
    expect(reputationService.getReputation('user-low')).toBe(0);

    // Warning 3: -15 total delta -> clamped to 0
    reputationService.recordWarning('user-low', 'w3');
    expect(reputationService.getReputation('user-low')).toBe(0);
  });

  it('seed entry preserves existing reputation for seeded users', () => {
    const seedEntry = reputationService.recordSeed('seed-user-1', 87);
    expect(seedEntry.delta).toBe(87);
    expect(seedEntry.type).toBe('seed');
    expect(reputationService.getReputation('seed-user-1')).toBe(87);
  });

  it('startup backfill creates exactly one seed entry for users without ledger entries', () => {
    reputationService.backfillStartupSeedUsers();

    expect(reputationService.getReputation('u1')).toBe(75);
    expect(reputationService.getReputation('u2')).toBe(95);

    // Running backfill again should not duplicate entries
    reputationService.backfillStartupSeedUsers();
    expect(reputationService.getEntries('u1')).toHaveLength(1);
    expect(reputationService.getReputation('u1')).toBe(75);
  });

  it('returns the same total and entries across multiple calls', () => {
    reputationService.recordInitial('user-const');
    reputationService.recordTaskApproved('user-const', 't1');
    reputationService.recordTaskApproved('user-const', 't2');
    reputationService.recordWarning('user-const', 'w1');

    const total1 = reputationService.getReputation('user-const');
    const total2 = reputationService.getReputation('user-const');
    expect(total1).toBe(total2);
    expect(total1).toBe(90); // 100 + 8 (contrib) + 8 (contrib) - 10 = 90

    const entries = reputationService.getEntries('user-const');
    expect(entries).toHaveLength(4);
  });

  describe('Phase 10: Reputation Ledger Pagination & Type Filter', () => {
    beforeEach(() => {
      // Seed 25 entries for user 'paged-user'
      for (let i = 1; i <= 25; i++) {
        const type = i % 2 === 0 ? 'task_approved' : 'warning';
        reputationService.addEntry('paged-user', type, i % 2 === 0 ? 8 : -10, `ref-${i}`);
      }
    });

    it('returns default page 1 with 20 items and correct total', () => {
      const res = reputationService.getPaginatedEntries('paged-user');
      expect(res.page).toBe(1);
      expect(res.limit).toBe(20);
      expect(res.total).toBe(25);
      expect(res.items).toHaveLength(20);
    });

    it('returns page 2 with remaining items', () => {
      const res = reputationService.getPaginatedEntries('paged-user', { page: 2, limit: 20 });
      expect(res.page).toBe(2);
      expect(res.limit).toBe(20);
      expect(res.total).toBe(25);
      expect(res.items).toHaveLength(5);
    });

    it('filters by entry type', () => {
      const res = reputationService.getPaginatedEntries('paged-user', { type: 'task_approved', limit: 50 });
      expect(res.total).toBe(12);
      expect(res.items.every((item) => item.type === 'task_approved')).toBe(true);
    });

    it('throws 400 INVALID_PAGINATION when limit > 100', () => {
      expect(() => {
        reputationService.getPaginatedEntries('paged-user', { limit: 101 });
      }).toThrow();

      try {
        reputationService.getPaginatedEntries('paged-user', { limit: 101 });
      } catch (err: any) {
        expect(err.getStatus()).toBe(400);
        expect(err.getResponse().code).toBe('INVALID_PAGINATION');
      }
    });

    it('throws 400 INVALID_PAGINATION when limit <= 0', () => {
      try {
        reputationService.getPaginatedEntries('paged-user', { limit: 0 });
      } catch (err: any) {
        expect(err.getStatus()).toBe(400);
        expect(err.getResponse().code).toBe('INVALID_PAGINATION');
      }
    });

    it('throws 400 INVALID_PAGINATION when page < 1', () => {
      try {
        reputationService.getPaginatedEntries('paged-user', { page: -1 });
      } catch (err: any) {
        expect(err.getStatus()).toBe(400);
        expect(err.getResponse().code).toBe('INVALID_PAGINATION');
      }
    });

    it('resetToSeed restores clean single-entry seed ledger without doubling entries', () => {
      expect(reputationService.getEntries('paged-user')).toHaveLength(25);

      reputationService.resetToSeed();
      expect(reputationService.getEntries('paged-user')).toHaveLength(0);
    });
  });
});
