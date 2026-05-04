import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GamificationRepository } from './gamification.repository';
import { LedgerType } from './dto/ledger-entry.dto';
import { GamificationStatsDto } from './dto/gamification-stats.dto';

@Injectable()
export class GamificationService {
  private readonly logger = new Logger(GamificationService.name);

  constructor(private readonly gamificationRepository: GamificationRepository) {}

  private getOrInitializeStats(userId: string): GamificationStatsDto {
    const existing = this.gamificationRepository.getStatsByUserId(userId);
    if (existing) {
      return existing;
    }
    return {
      userId,
      totalXp: 0,
      repScore: 100, // Base reputation
      lastActive: new Date(),
    };
  }

  awardXp(userId: string, amount: number, reason: string): GamificationStatsDto {
    const stats = this.getOrInitializeStats(userId);
    const now = new Date();

    this.gamificationRepository.addLedgerEntry({
      id: `ledg-xp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId,
      type: LedgerType.XP,
      amount,
      reason,
      timestamp: now,
    });

    stats.totalXp += amount;
    stats.lastActive = now;
    this.gamificationRepository.upsertStats(stats);

    return stats;
  }

  updateReputation(userId: string, amount: number, reason: string): GamificationStatsDto {
    const stats = this.getOrInitializeStats(userId);
    const now = new Date();

    this.gamificationRepository.addLedgerEntry({
      id: `ledg-rep-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId,
      type: LedgerType.REPUTATION,
      amount,
      reason,
      timestamp: now,
    });

    stats.repScore += amount;
    stats.lastActive = now;
    this.gamificationRepository.upsertStats(stats);

    return stats;
  }

  getLeaderboard(): GamificationStatsDto[] {
    const allStats = this.gamificationRepository.getAllStats();
    // Sort descending by totalXp
    return [...allStats].sort((a, b) => b.totalXp - a.totalXp);
  }

  @Cron(CronExpression.EVERY_10_SECONDS) // Using 10 seconds for testing as requested
  applyReputationDecay() {
    const allStats = this.gamificationRepository.getAllStats();
    const now = new Date();
    
    let decayedCount = 0;

    for (const stats of allStats) {
      const diffTime = Math.abs(now.getTime() - stats.lastActive.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays > 30) {
        const oldScore = stats.repScore;
        // Apply 2% penalty (multiply by 0.98) and round to 2 decimals
        stats.repScore = Math.round((stats.repScore * 0.98) * 100) / 100;
        
        this.gamificationRepository.upsertStats(stats);
        
        // Log the decay
        this.logger.log(`Reputation decayed for user ${stats.userId}: ${oldScore} -> ${stats.repScore} (Inactive for ${diffDays} days)`);
        decayedCount++;
      }
    }

    if (decayedCount > 0) {
      this.logger.log(`Completed reputation decay run. Affected ${decayedCount} user(s).`);
    }
  }
}
