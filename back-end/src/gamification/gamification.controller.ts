import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { GamificationService, GamificationPeriod } from './gamification.service';
import { GamificationRepository } from './gamification.repository';

@ApiTags('Gamification')
@Controller('gamification')
export class GamificationController {
  constructor(
    private readonly gamificationService: GamificationService,
    private readonly gamificationRepository: GamificationRepository,
  ) {}

  @Get('leaderboard')
  @ApiOperation({ summary: 'Get the global leaderboard sorted by XP' })
  @ApiResponse({ status: 200, description: 'Returns an array of gamification stats sorted by XP.' })
  getLeaderboard() {
    return this.gamificationService.getLeaderboard();
  }

  @Get(':userId/ledger')
  @ApiOperation({ summary: 'Get the gamification ledger for a specific user' })
  @ApiResponse({ status: 200, description: 'Returns an array of ledger entries.' })
  getLedgerByUserId(@Param('userId') userId: string) {
    return this.gamificationService.getLedgerByUserId(userId);
  }

  @Get(':userId/stats')
  @ApiOperation({ summary: 'Get computed gamification stats for a specific user' })
  @ApiQuery({ name: 'period', required: false, enum: ['alltime', 'monthly', 'weekly'] })
  @ApiResponse({ status: 200, description: 'Returns computed total XP, reputation, tasks, and projects.' })
  getUserStats(
    @Param('userId') userId: string,
    @Query('period') period?: GamificationPeriod,
  ) {
    if (period) {
      return this.gamificationService.getUserPeriodStats(userId, period);
    }
    return this.gamificationService.getUserStats(userId);
  }
}
