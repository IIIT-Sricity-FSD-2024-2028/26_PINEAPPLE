import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { GamificationModule } from '../gamification/gamification.module';
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardController } from './leaderboard.controller';

@Module({
  imports: [UsersModule, GamificationModule],
  controllers: [LeaderboardController],
  providers: [LeaderboardService],
  exports: [LeaderboardService],
})
export class LeaderboardModule {}
