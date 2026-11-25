import { Module, Global } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { GamificationController } from './gamification.controller';
import { GamificationService } from './gamification.service';
import { GamificationRepository } from './gamification.repository';

@Global()
@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [GamificationController],
  providers: [GamificationService, GamificationRepository],
  exports: [GamificationService, GamificationRepository],
})
export class GamificationModule {}
