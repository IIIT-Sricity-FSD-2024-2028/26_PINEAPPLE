import { Injectable, NotFoundException } from '@nestjs/common';
import { UsersService } from '../users/users.service';

import { LeaderboardEntryDto } from './leaderboard-entry.dto';

export type LeaderboardPeriod = 'weekly' | 'monthly' | 'alltime';

@Injectable()
export class LeaderboardService {
  constructor(private readonly usersService: UsersService) {}

  getLeaderboard(_period: LeaderboardPeriod = 'alltime', limit?: number): LeaderboardEntryDto[] {
    const users = this.usersService.findAll();

    // For now, we'll use all-time data since we don't have period-specific tracking
    // In a real implementation, you'd track XP earned within specific time periods
    const entries: LeaderboardEntryDto[] = users
      .map(user => ({
        rank: 0, // Will be set after sorting
        userId: user.id,
        user: user.name,
        initials: this.getInitials(user.name),
        xp: (user as any).profile?.xp ?? 0,
        rep: (user as any).profile?.rep ?? 0,
        tasks: this.calculateCompletedTasks(user.id),
        projects: this.calculateParticipatedProjects(user.id),
      }))
      .sort((a, b) => b.xp - a.xp) // Sort by XP descending
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));

    // Apply limit if specified
    return limit ? entries.slice(0, limit) : entries;
  }

  getUserRank(userId: string, period: LeaderboardPeriod = 'alltime') {
    const user = this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const leaderboard = this.getLeaderboard(period);
    const userRank = leaderboard.findIndex((entry) => entry.userId === userId);

    return {
      userId,
      rank: userRank !== -1 ? userRank + 1 : null,
      xp: (user as any).profile?.xp || 0,
      period: period,
    };
  }

  private getInitials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  private calculateCompletedTasks(userId: string): number {
    // In a real implementation, this would query the tasks service
    // For now, return a mock calculation based on user XP
    const user = this.usersService.findById(userId);
    const xp = (user as any).profile?.xp || 0;
    // Rough estimation: assume ~10 XP per task
    return Math.floor(xp / 10);
  }

  private calculateParticipatedProjects(userId: string): number {
    // In a real implementation, this would query the projects service
    // For now, return a mock calculation
    const user = this.usersService.findById(userId);
    const xp = (user as any).profile?.xp || 0;
    // Rough estimation: assume ~100 XP per project
    return Math.max(1, Math.floor(xp / 100));
  }
}
