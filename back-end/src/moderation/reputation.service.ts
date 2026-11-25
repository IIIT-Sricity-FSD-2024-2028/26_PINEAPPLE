import { Injectable, BadRequestException, Logger, Inject, forwardRef, OnModuleInit, Optional } from '@nestjs/common';
import { ReputationEntry, ReputationEntryClass } from './entities/reputation-entry.entity';
import { ClockService } from '../common/services/clock.service';
import { GamificationRepository } from '../gamification/gamification.repository';
import { UsersRepository } from '../users/users.repository';
import { AuditService } from '../audit/audit.service';
import { SEED_USER_REPUTATION } from './reputation.seeds';
import { REPUTATION_CONFIG } from '../reputation/reputation.config';

@Injectable()
export class ReputationService implements OnModuleInit {
  private readonly logger = new Logger(ReputationService.name);
  private entries: ReputationEntry[] = [];
  private ledgerMigrated = false;

  constructor(
    private readonly clockService: ClockService,
    @Optional()
    @Inject(forwardRef(() => GamificationRepository))
    private readonly _gamificationRepository?: GamificationRepository,
    @Optional()
    @Inject(forwardRef(() => UsersRepository))
    private readonly usersRepository?: UsersRepository,
    @Optional()
    @Inject(forwardRef(() => AuditService))
    private readonly auditService?: AuditService,
  ) {}

  onModuleInit() {
    this.repairReputationLedger();
    this.backfillStartupSeedUsers();
    this.migrateLedger();
  }

  /**
   * Clears in-memory entries for test isolation.
   */
  reset(): void {
    this.entries = [];
    this.ledgerMigrated = false;
  }

  resetToSeed(): void {
    this.entries = [];
    this.ledgerMigrated = false;
    this.backfillStartupSeedUsers();
    this.repairReputationLedger();
    this.migrateLedger();
  }

  /**
   * Returns whether a reputation type belongs to 'standing' or 'contribution'.
   */
  getEntryClass(type: string): ReputationEntryClass {
    const norm = String(type || '').toLowerCase().trim();
    if (norm === 'task_approved' || norm === 'project_completed') {
      return 'contribution';
    }
    return 'standing';
  }

  /**
   * Maps unclassified entries to 'contribution' or 'standing'. Runs once at startup.
   */
  migrateLedger(): { total: number; standing: number; contribution: number } {
    let standingCount = 0;
    let contributionCount = 0;

    for (const entry of this.entries) {
      if (!entry.entryClass) {
        entry.entryClass = this.getEntryClass(entry.type);
      }
      if (entry.entryClass === 'standing') {
        standingCount++;
      } else {
        contributionCount++;
      }
    }

    if (!this.ledgerMigrated) {
      this.ledgerMigrated = true;
      try {
        this.auditService?.log({
          action: 'LEDGER_MIGRATED',
          actor: 'system',
          target: 'reputation-ledger',
          entityType: 'reputation',
          entityId: 'reputation-ledger',
          event: `Migrated ${this.entries.length} reputation entries (${standingCount} standing, ${contributionCount} contribution)`,
          details: {
            total: this.entries.length,
            standing: standingCount,
            contribution: contributionCount,
          },
        });
      } catch (err: any) {
        this.logger.warn(`LEDGER_MIGRATED audit notice: ${err?.message || err}`);
      }
    }

    return {
      total: this.entries.length,
      standing: standingCount,
      contribution: contributionCount,
    };
  }

  /**
   * Startup and import repair: removes duplicate 'seed' entries for a user while
   * keeping the first 'seed' entry and preserving all non-'seed' entries intact.
   */
  repairReputationLedger(): { affectedUsers: number; removedDuplicates: number; remainingEntries: number } {
    const seenSeedUsers = new Set<string>();
    const repaired: ReputationEntry[] = [];
    const affectedUserSet = new Set<string>();
    let removedDuplicates = 0;

    for (const entry of this.entries) {
      if (entry.type === 'seed') {
        const uid = String(entry.userId || '').trim();
        if (seenSeedUsers.has(uid)) {
          removedDuplicates += 1;
          affectedUserSet.add(uid);
          continue;
        }
        seenSeedUsers.add(uid);
      }
      repaired.push(entry);
    }

    if (removedDuplicates > 0) {
      this.entries = repaired;
      try {
        this.auditService?.log({
          action: 'LEDGER_REPAIRED',
          actor: 'system',
          target: 'reputation-ledger',
          entityType: 'reputation',
          entityId: 'reputation-ledger',
          event: `Removed ${removedDuplicates} duplicate seed reputation entry/entries across ${affectedUserSet.size} user(s)`,
          details: {
            affectedUsers: Array.from(affectedUserSet),
            affectedUserCount: affectedUserSet.size,
            removedDuplicates,
            remainingEntries: repaired.length,
          },
        });
      } catch (err: any) {
        this.logger.warn(`LEDGER_REPAIRED audit notice: ${err?.message || err}`);
      }
    }

    return {
      affectedUsers: affectedUserSet.size,
      removedDuplicates,
      remainingEntries: this.entries.length,
    };
  }

  /**
   * Backfills exactly ONE 'seed' entry for each startup seeded user who has no entries yet.
   * Never writes duplicate entries or touches GamificationRepository.
   */
  backfillStartupSeedUsers(): void {
    if (!this.usersRepository) return;
    try {
      const allUsers =
        typeof (this.usersRepository as any).findAll === 'function'
          ? (this.usersRepository as any).findAll(true)
          : [];
      for (const user of allUsers) {
        const uid = String((user as any).id || '').trim();
        if (!uid) continue;

        const alreadyHasEntries = this.entries.some((e) => String(e.userId) === uid);
        if (alreadyHasEntries) continue;

        const seedVal =
          SEED_USER_REPUTATION[uid] !== undefined
            ? SEED_USER_REPUTATION[uid]
            : (user as any).rep !== undefined || (user as any).profile?.rep !== undefined
              ? Number((user as any).rep ?? (user as any).profile?.rep ?? 0)
              : undefined;

        if (seedVal !== undefined && !isNaN(seedVal)) {
          this.recordSeed(uid, seedVal);
        }
      }
    } catch (err: any) {
      this.logger.warn(`Startup reputation backfill skipped or non-critical error: ${err?.message || err}`);
    }
  }

  /**
   * Canonical single reader function: walks standing entries in time order,
   * starting from 0, clamping to [0, 100] after every step.
   * Contribution entries are excluded from the reputation total.
   */
  getTotal(userId: string): number {
    const uid = String(userId || '').trim();
    if (!uid) return 0;

    const userStanding = this.entries
      .filter((e) => String(e.userId) === uid && (e.entryClass || this.getEntryClass(e.type)) === 'standing')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    let total = 0;
    for (const e of userStanding) {
      const delta = Number(e.delta) || 0;
      total = Math.max(REPUTATION_CONFIG.MIN_POINTS, Math.min(REPUTATION_CONFIG.MAX_POINTS, total + delta));
    }
    return total;
  }

  /**
   * Bulk canonical reader: returns clamped reputation totals keyed by userId.
   */
  getTotals(userIds: string[]): Record<string, number> {
    const result: Record<string, number> = {};
    for (const rawId of userIds || []) {
      const uid = String(rawId || '').trim();
      if (!uid) continue;
      result[uid] = this.getTotal(uid);
    }
    return result;
  }

  /**
   * Alias to canonical getTotal(userId) for existing callers.
   */
  getReputation(userId: string): number {
    return this.getTotal(userId);
  }

  hasEntry(userId: string, type: string, refId?: string): boolean {
    const uid = String(userId || '').trim();
    if (!uid) return false;
    if (refId !== undefined && String(refId).trim() !== '') {
      const cleanRef = String(refId).trim();
      return this.entries.some(
        (e) =>
          String(e.userId) === uid &&
          e.type === type &&
          String(e.refId || '') === cleanRef,
      );
    }
    return this.entries.some((e) => String(e.userId) === uid && e.type === type);
  }

  hasEntryForRef(type: string, refId: string): boolean {
    const cleanRef = String(refId || '').trim();
    if (!cleanRef) return false;
    return this.entries.some(
      (e) => e.type === type && String(e.refId || '').trim() === cleanRef,
    );
  }

  private normalizeEntryForRead(entry: ReputationEntry): ReputationEntry {
    const entryClass = entry.entryClass || this.getEntryClass(entry.type);
    return {
      ...entry,
      entryClass,
      reason:
        entry.type === 'seed'
          ? 'Starting reputation'
          : entry.type === 'recovery'
            ? 'Good conduct recovery'
            : entry.reason || this.formatReason(entry.type, entry.refId),
    };
  }

  /**
   * Returns all reputation ledger entries for a user, newest first.
   */
  getEntries(userId: string): ReputationEntry[] {
    const uid = String(userId || '').trim();
    return this.entries
      .filter((e) => String(e.userId) === uid)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((e) => this.normalizeEntryForRead(e));
  }

  getPaginatedEntries(
    userId?: string,
    options?: { page?: any; limit?: any; type?: string; entryClass?: string },
  ): { items: ReputationEntry[]; page: number; limit: number; total: number } {
    let page = 1;
    let limit = 20;

    if (options?.page !== undefined && options?.page !== null && options?.page !== '') {
      const p = Number(options.page);
      if (isNaN(p) || p <= 0 || !Number.isInteger(p)) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          code: 'INVALID_PAGINATION',
          message: 'Page parameter must be a positive integer',
        });
      }
      page = p;
    }

    if (options?.limit !== undefined && options?.limit !== null && options?.limit !== '') {
      const l = Number(options.limit);
      if (isNaN(l) || l <= 0 || l > 100 || !Number.isInteger(l)) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          code: 'INVALID_PAGINATION',
          message: 'Limit parameter must be an integer between 1 and 100',
        });
      }
      limit = l;
    }

    let filtered = [...this.entries];

    if (userId) {
      const uid = String(userId).trim();
      filtered = filtered.filter((e) => String(e.userId) === uid);
    }

    if (options?.type && String(options.type).trim() !== '' && String(options.type).toLowerCase() !== 'all') {
      const typeFilter = String(options.type).trim().toLowerCase();
      filtered = filtered.filter((e) => String(e.type).toLowerCase() === typeFilter);
    }

    if (options?.entryClass && String(options.entryClass).trim() !== '' && String(options.entryClass).toLowerCase() !== 'all') {
      const classFilter = String(options.entryClass).trim().toLowerCase();
      filtered = filtered.filter((e) => (e.entryClass || this.getEntryClass(e.type)) === classFilter);
    }

    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = filtered.length;
    const startIndex = (page - 1) * limit;
    const items = filtered
      .slice(startIndex, startIndex + limit)
      .map((e) => this.normalizeEntryForRead(e));

    return {
      items,
      page,
      limit,
      total,
    };
  }

  addEntry(
    userId: string,
    type: string,
    delta: number,
    refId?: string,
    createdAt?: string,
    entryClass?: ReputationEntryClass,
  ): ReputationEntry {
    const uid = String(userId || '').trim();
    const cleanRefId =
      refId !== undefined && refId !== null && String(refId).trim() !== ''
        ? String(refId).trim()
        : undefined;

    if (type === 'seed') {
      const existingSeed = this.entries.find(
        (e) => String(e.userId) === uid && e.type === 'seed',
      );
      if (existingSeed) {
        return this.normalizeEntryForRead(existingSeed);
      }
    }

    if (type === 'initial') {
      const existingInitial = this.entries.find(
        (e) => String(e.userId) === uid && e.type === 'initial',
      );
      if (existingInitial) {
        return this.normalizeEntryForRead(existingInitial);
      }
    }

    const effectiveRefId =
      cleanRefId ??
      (type === 'initial' ? uid : type === 'seed' ? `seed-${uid}` : undefined);

    if (effectiveRefId) {
      const duplicate = this.entries.find(
        (e) =>
          String(e.userId) === uid &&
          e.type === type &&
          String(e.refId || '') === effectiveRefId,
      );
      if (duplicate) {
        return this.normalizeEntryForRead(duplicate);
      }
    }

    const resolvedClass: ReputationEntryClass =
      entryClass || this.getEntryClass(type);

    const entry: ReputationEntry = {
      id: `rep-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      userId: uid,
      type,
      delta: Number(delta) || 0,
      entryClass: resolvedClass,
      refId: effectiveRefId,
      reason: this.formatReason(type, effectiveRefId),
      createdAt: createdAt || this.clockService?.nowIso?.() || new Date().toISOString(),
    };

    this.entries.push(entry);
    return entry;
  }

  recordInitial(userId: string): ReputationEntry {
    const uid = String(userId || '').trim();
    return this.addEntry(uid, 'initial', REPUTATION_CONFIG.START_POINTS, uid, undefined, 'standing');
  }

  recordSeed(userId: string, seedValue: number): ReputationEntry {
    const uid = String(userId || '').trim();
    return this.addEntry(uid, 'seed', seedValue, `seed-${uid}`, undefined, 'standing');
  }

  recordTaskApproved(userId: string, taskId: string, _projectId?: string): ReputationEntry {
    // History & tests preserved as class 'contribution'; does not alter total reputation score
    return this.addEntry(userId, 'task_approved', 8, taskId, undefined, 'contribution');
  }

  recordProjectCompleted(userId: string, projectId: string): ReputationEntry {
    // History & tests preserved as class 'contribution'; does not alter total reputation score
    return this.addEntry(userId, 'project_completed', 15, projectId, undefined, 'contribution');
  }

  recordWarning(userId: string, warningId: string): ReputationEntry {
    return this.addEntry(userId, 'warning', REPUTATION_CONFIG.WARNING_PENALTY, warningId, undefined, 'standing');
  }

  recordWarningRemoved(userId: string, warningId: string): ReputationEntry {
    return this.addEntry(userId, 'warning_removed', REPUTATION_CONFIG.WARNING_REMOVED_RESTORATION, warningId, undefined, 'standing');
  }

  recordDeadlineMissed(userId: string, taskId: string): ReputationEntry {
    return this.addEntry(userId, 'deadline_missed', REPUTATION_CONFIG.DEADLINE_PENALTY, taskId, undefined, 'standing');
  }

  recordRecovery(userId: string, refId: string, createdAt?: string): ReputationEntry {
    return this.addEntry(userId, 'recovery', REPUTATION_CONFIG.RECOVERY_POINTS, refId, createdAt, 'standing');
  }

  /**
   * Daily good conduct recovery job.
   * Awards +RECOVERY_POINTS to non-suspended users with reputation < 100,
   * no standing penalties in the last 14 days, and no recovery in the last 14 days.
   * Idempotent by (userId + dateBucket).
   */
  processDailyRecovery(now?: Date): { recoveredUsers: Array<{ userId: string; points: number }>; skipped: number } {
    const recoveryPoints = REPUTATION_CONFIG.RECOVERY_POINTS;
    if (recoveryPoints <= 0) {
      return { recoveredUsers: [], skipped: 0 };
    }

    const currentDate = now || (this.clockService ? this.clockService.now() : new Date());
    const nowIso = currentDate.toISOString();
    const dateBucket = nowIso.slice(0, 10);
    const cutoff14DaysMs = currentDate.getTime() - REPUTATION_CONFIG.RECOVERY_DAYS * 24 * 60 * 60 * 1000;

    const allUsers =
      this.usersRepository && typeof (this.usersRepository as any).findAll === 'function'
        ? (this.usersRepository as any).findAll(true)
        : [];

    const recoveredUsers: Array<{ userId: string; points: number }> = [];
    let skipped = 0;

    for (const user of allUsers) {
      const uid = String((user as any).id || '').trim();
      if (!uid) continue;

      const isSuspended =
        String((user as any).status || '').toLowerCase() === 'suspended' ||
        (user as any).isSuspended === true;
      if (isSuspended) {
        skipped++;
        continue;
      }

      const currentRep = this.getTotal(uid);
      if (currentRep >= REPUTATION_CONFIG.MAX_POINTS) {
        skipped++;
        continue;
      }

      const userEntries = this.entries.filter((e) => String(e.userId) === uid);

      // Check for standing penalties in last 14 days
      const hasRecentPenalty = userEntries.some((e) => {
        const isStanding = (e.entryClass || this.getEntryClass(e.type)) === 'standing';
        const isPenalty = Number(e.delta) < 0;
        const createdMs = new Date(e.createdAt).getTime();
        return isStanding && isPenalty && createdMs >= cutoff14DaysMs;
      });

      if (hasRecentPenalty) {
        skipped++;
        continue;
      }

      // Check for recovery in last 14 days
      const hasRecentRecovery = userEntries.some((e) => {
        const isRecovery = e.type === 'recovery';
        const createdMs = new Date(e.createdAt).getTime();
        return isRecovery && createdMs >= cutoff14DaysMs;
      });

      if (hasRecentRecovery) {
        skipped++;
        continue;
      }

      // Idempotent bucket check
      const refId = `${uid}-${dateBucket}`;
      const alreadyRecoveredInBucket = userEntries.some(
        (e) => e.type === 'recovery' && String(e.refId || '') === refId,
      );

      if (alreadyRecoveredInBucket) {
        skipped++;
        continue;
      }

      this.addEntry(
        uid,
        'recovery',
        recoveryPoints,
        refId,
        nowIso,
        'standing',
      );

      try {
        this.auditService?.log({
          action: 'REPUTATION_RECOVERED',
          actor: 'system',
          target: (user as any).name || uid,
          entityType: 'reputation',
          entityId: uid,
          event: `Good conduct recovery: +${recoveryPoints} reputation points awarded`,
          details: {
            userId: uid,
            points: recoveryPoints,
            newReputation: this.getTotal(uid),
            dateBucket,
          },
        });
      } catch (err: any) {
        this.logger.warn(`REPUTATION_RECOVERED audit notice: ${err?.message || err}`);
      }

      recoveredUsers.push({ userId: uid, points: recoveryPoints });
    }

    return { recoveredUsers, skipped };
  }

  formatReason(type: string, refId?: string): string {
    switch (type) {
      case 'initial':
        return 'Initial signup reputation';
      case 'seed':
        return 'Starting reputation';
      case 'task_approved':
        return `Task approved: ${refId || ''}`;
      case 'project_completed':
        return `Project completion bonus: ${refId || ''}`;
      case 'warning':
        return `Account warning penalty: ${refId || ''}`;
      case 'warning_removed':
        return `Warning appeal accepted: ${refId || ''}`;
      case 'deadline_missed':
        return `Missed task deadline penalty: ${refId || ''}`;
      case 'recovery':
        return 'Good conduct recovery';
      default:
        return type;
    }
  }
}
