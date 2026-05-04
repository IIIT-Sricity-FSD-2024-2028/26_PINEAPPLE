import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiHeader,
} from '@nestjs/swagger';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { LeaderboardService, LeaderboardPeriod } from './leaderboard.service';
import { LeaderboardEntryDto } from './leaderboard-entry.dto';

@ApiTags('Leaderboard')
@ApiHeader({
  name: 'x-user-role',
  description: 'User role for authorization',
  required: true,
  schema: { enum: ['admin', 'user'] },
})
@Controller('leaderboard')
@UseGuards(RolesGuard)
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get()
  @Roles('admin', 'user')
  @ApiOperation({ summary: 'Get leaderboard rankings' })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['weekly', 'monthly', 'alltime'],
    description: 'Time period for leaderboard rankings',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of entries to return',
  })
  @ApiResponse({
    status: 200,
    description: 'Leaderboard rankings',
    type: [LeaderboardEntryDto],
  })
  getLeaderboard(
    @Query('period') period: LeaderboardPeriod = 'alltime',
    @Query('limit') limit?: number,
  ): LeaderboardEntryDto[] {
    return this.leaderboardService.getLeaderboard(period, limit);
  }

  @Get(':userId')
  @Roles('admin', 'user')
  @ApiOperation({ summary: 'Get a specific user\'s leaderboard ranking' })
  @ApiParam({
    name: 'userId',
    description: 'User ID to get ranking for',
  })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['weekly', 'monthly', 'alltime'],
    description: 'Time period for ranking',
  })
  @ApiResponse({
    status: 200,
    description: 'User leaderboard entry',
    type: LeaderboardEntryDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found in leaderboard',
  })
  getUserRank(
    @Param('userId') userId: string,
    @Query('period') period: LeaderboardPeriod = 'alltime',
  ): LeaderboardEntryDto | null {
    return this.leaderboardService.getUserRank(userId, period);
  }
}