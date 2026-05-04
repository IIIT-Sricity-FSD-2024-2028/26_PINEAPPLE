import { Injectable } from '@nestjs/common';
import { LedgerEntryDto, LedgerType } from './dto/ledger-entry.dto';
import { GamificationStatsDto } from './dto/gamification-stats.dto';

@Injectable()
export class GamificationRepository {
  private ledgers: LedgerEntryDto[] = [];
  private stats: GamificationStatsDto[] = [];

  constructor() {
    const now = new Date();
    // Simulate user 3 being inactive for 40 days to test the reputation decay Cron job
    const staleDate = new Date();
    staleDate.setDate(staleDate.getDate() - 40);

    // Seed initial stats matching the User IDs from Phase 2
    this.stats.push({
      userId: '1', // Priya Patel
      totalXp: 3850,
      repScore: 93,
      lastActive: now,
    });
    this.stats.push({
      userId: '2', // Arjun Sharma
      totalXp: 2450,
      repScore: 87,
      lastActive: now,
    });
    this.stats.push({
      userId: '3', // Kiran Bose (Suspended)
      totalXp: 950,
      repScore: 60,
      lastActive: staleDate,
    });

    // Seed dummy ledger entries for timeline views
    this.ledgers.push({
      id: 'ledg-1',
      userId: '2',
      type: LedgerType.XP,
      amount: 40,
      reason: 'Hard Task Approved',
      timestamp: now,
    });
    this.ledgers.push({
      id: 'ledg-2',
      userId: '2',
      type: LedgerType.REPUTATION,
      amount: 8,
      reason: 'Task Approved',
      timestamp: now,
    });
    this.ledgers.push({
      id: 'ledg-3',
      userId: '3',
      type: LedgerType.REPUTATION,
      amount: -20,
      reason: 'Abandoned project midway',
      timestamp: staleDate,
    });
  }

  getStatsByUserId(userId: string): GamificationStatsDto | undefined {
    return this.stats.find((s) => s.userId === userId);
  }

  upsertStats(statsData: GamificationStatsDto): void {
    const existingIndex = this.stats.findIndex((s) => s.userId === statsData.userId);
    if (existingIndex >= 0) {
      this.stats[existingIndex] = { ...this.stats[existingIndex], ...statsData };
    } else {
      this.stats.push(statsData);
    }
  }

  addLedgerEntry(entry: LedgerEntryDto): void {
    this.ledgers.push(entry);
  }

  getLedgerByUserId(userId: string): LedgerEntryDto[] {
    // Sort descending by timestamp
    return this.ledgers
      .filter((l) => l.userId === userId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getAllStats(): GamificationStatsDto[] {
    return this.stats;
  }
}
