import { Injectable, NotFoundException, Optional, Inject, forwardRef } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { GamificationService } from '../gamification/gamification.service';
import { GamificationRepository } from '../gamification/gamification.repository';
import { ReputationService } from '../moderation/reputation.service';
import { TrustService } from '../users/trust.service';
import { LeaderboardEntryDto } from './leaderboard-entry.dto';
import { normalizeRole } from '../common/utils/role.util';
import { isProfileComplete } from '../common/utils/profile.util';

export type LeaderboardPeriod = 'weekly' | 'monthly' | 'alltime';
export type LeaderboardTab = 'xp' | 'reliable' | 'standing';

@Injectable()
export class LeaderboardService {
  private cachedLeaderboards = new Map<
    string,
    {
      data: LeaderboardEntryDto[];
      timestamp: number;
      userCount: number;
      completeUsersCount: number;
      ledgerCount: number;
    }
  >();
  private cacheTtlMs = 15000;

  public invalidateCache(): void {
    this.cachedLeaderboards.clear();
  }

  public resetToSeed(): void {
    this.invalidateCache();
  }

  constructor(
    private readonly usersService: UsersService,
    private readonly gamificationService: GamificationService,
    @Optional() private readonly reputationService?: ReputationService,
    @Optional() private readonly gamificationRepository?: GamificationRepository,
    @Optional()
    @Inject(forwardRef(() => TrustService))
    private readonly trustService?: TrustService,
  ) {}

  getLeaderboard(
    period: LeaderboardPeriod = 'alltime',
    limit?: number,
    tab: LeaderboardTab = 'xp',
    viewer?: any,
  ): LeaderboardEntryDto[] {
    const rawPeriod = String(period || 'alltime').trim().toLowerCase();
    const periodKey: LeaderboardPeriod =
      rawPeriod === 'weekly' ? 'weekly' : rawPeriod === 'monthly' ? 'monthly' : 'alltime';

    const rawUsers = this.usersService.findAll();
    const completeUsersCount = rawUsers.filter((u: any) => isProfileComplete(u)).length;
    const currentLedgerCount = this.gamificationRepository?.findAll?.()?.length ?? 0;

    // 1. Exclude Admin, Super User, system accounts, suspended accounts, deleted accounts, incomplete profiles, and hidden duplicates
    const eligibleUsers = rawUsers.filter((u: any) => {
      if (u.isDuplicate || u.isHidden || u.isDeleted || u.deletedAt) return false;
      if (!isProfileComplete(u)) return false;
      const normRole = normalizeRole(u.role);
      if (normRole === 'admin' || normRole === 'superuser') return false;
      if (u.id === 'u-admin' || u.id === 'u-superuser') return false;
      const statusLower = String(u.status || '').trim().toLowerCase();
      if (statusLower === 'suspended' || statusLower === 'inactive') return false;
      return true;
    });

    // 2. Deduplicate: one row per person, merged by user id, lowercase email, and clean name
    const seenIds = new Set<string>();
    const seenEmails = new Set<string>();
    const seenNames = new Set<string>();
    const dedupedUsers: any[] = [];

    for (const u of eligibleUsers) {
      const uid = String(u.id);
      const email = (u.email || '').trim().toLowerCase();
      const cleanName = (u.name || u.profile?.fullName || '')
        .replace(/\s*\([^)]*\)$/, '')
        .trim()
        .toLowerCase();

      if (seenIds.has(uid)) continue;
      if (email && seenEmails.has(email)) continue;
      if (cleanName && seenNames.has(cleanName)) continue;

      seenIds.add(uid);
      if (email) seenEmails.add(email);
      if (cleanName) seenNames.add(cleanName);
      dedupedUsers.push(u);
    }

    // 3. Map to LeaderboardEntryDto
    const repTotals = this.reputationService
      ? this.reputationService.getTotals(dedupedUsers.map((u) => String(u.id)))
      : {};

    const viewerRole = String(viewer?.role || '').toLowerCase().trim();
    const isAdmin = viewerRole === 'admin' || viewerRole === 'superuser';

    let entries: LeaderboardEntryDto[] = dedupedUsers.map((user) => {
      const periodStats = this.gamificationService.getUserPeriodStats(String(user.id), periodKey);
      const allTimeStats = this.gamificationService.getUserStats(String(user.id));

      const cleanDisplayName = (user.name || user.profile?.fullName || 'Contributor')
        .replace(/\s*\([^)]*\)$/, '')
        .trim();

      let xp = periodStats.totalXp;
      const rawRep = this.reputationService
        ? (repTotals[String(user.id)] ?? 0)
        : allTimeStats.repScore;

      const band =
        rawRep >= 80 ? 'Good standing' : rawRep >= 60 ? 'Fair standing' : 'Low standing';

      let tasks = 0;
      let projects = 0;
      let onTimeRate: number | null = null;
      let trustLabel = 'Getting started';

      if (this.trustService) {
        try {
          const trust = this.trustService.getSummary(String(user.id), viewer);
          onTimeRate = trust.trackRecord.onTimeRate;
          trustLabel = trust.label;
          if (periodKey === 'alltime') {
            tasks = trust.trackRecord.tasksApproved;
          }
        } catch {}
      }

      if (periodKey === 'alltime') {
        xp = allTimeStats.totalXp;
        if (!tasks) {
          tasks =
            user.tasksCompleted !== undefined
              ? user.tasksCompleted
              : user.profile?.tasksCount || allTimeStats.tasksCompleted || 0;
        }
        projects =
          user.projectsCount !== undefined
            ? user.projectsCount
            : Array.isArray(user.data?.projects) && user.data.projects.length > 0
              ? user.data.projects.length
              : allTimeStats.projectsCount || 1;
      } else {
        xp = periodStats.totalXp;
        tasks = periodStats.tasksCompleted;
        projects = periodStats.projectsCount;
      }

      const entry: LeaderboardEntryDto = {
        userId: user.id,
        user: cleanDisplayName,
        initials: this.getInitials(cleanDisplayName),
        xp,
        band,
        tasks,
        projects,
        onTimeRate,
        trustLabel,
      };

      // Exact reputation number visible only to admin viewer
      if (isAdmin) {
        entry.rep = rawRep;
      }

      return entry;
    });

    // 4. Tab filtering & sorting
    const normTab = String(tab || 'xp').toLowerCase().trim();
    if (normTab === 'reliable') {
      // "Most reliable": only users with onTimeRate at least 80%, sorted by verified tasks
      entries = entries.filter((e) => e.onTimeRate !== null && e.onTimeRate !== undefined && e.onTimeRate >= 80);
      entries.sort((a, b) => b.tasks - a.tasks || b.xp - a.xp);
    } else if (normTab === 'standing') {
      // "Highest standing": sorted by reputation on server
      entries.sort((a, b) => {
        const repA = repTotals[String(a.userId)] ?? 0;
        const repB = repTotals[String(b.userId)] ?? 0;
        return repB - repA || b.xp - a.xp;
      });
    } else {
      // "Top by XP": default, sorted by XP descending
      entries.sort((a, b) => {
        const repA = repTotals[String(a.userId)] ?? 0;
        const repB = repTotals[String(b.userId)] ?? 0;
        return b.xp - a.xp || repB - repA;
      });
    }

    return limit !== undefined && limit > 0 ? entries.slice(0, limit) : entries;
  }

  getUserRank(userId: string, period: LeaderboardPeriod = 'alltime') {
    const user = this.usersService.findById(userId);
    if (!user || user.isDeleted || user.deletedAt) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const leaderboard = this.getLeaderboard(period);
    const userEntry = leaderboard.find((entry) => String(entry.userId) === String(userId));

    return {
      userId,
      xp: userEntry ? userEntry.xp : 0,
      band: userEntry ? userEntry.band : 'Good standing',
      tasks: userEntry ? userEntry.tasks : 0,
      projects: userEntry ? userEntry.projects : 0,
      period,
    };
  }

  private getInitials(name: string): string {
    return (name || '')
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }
}
