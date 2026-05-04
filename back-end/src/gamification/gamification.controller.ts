import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GamificationService } from './gamification.service';
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
    return this.gamificationRepository.getLedgerByUserId(userId);
  }
}
