import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { GamificationController } from './gamification.controller';
import { GamificationService } from './gamification.service';
import { GamificationRepository } from './gamification.repository';

@Module({
  // CRITICAL: ScheduleModule.forRoot() is required here to activate the @Cron decorators in the service
  imports: [ScheduleModule.forRoot()],
  controllers: [GamificationController],
  providers: [GamificationService, GamificationRepository],
  exports: [GamificationService], // Exported so TasksModule can call awardXp() later
})
export class GamificationModule {}
