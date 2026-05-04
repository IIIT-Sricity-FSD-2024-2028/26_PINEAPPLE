import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { TasksRepository } from './tasks.repository';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
  // CRITICAL: Importing GamificationModule here so TasksService can resolve GamificationService
  imports: [GamificationModule],
  controllers: [TasksController],
  providers: [TasksService, TasksRepository],
  exports: [TasksService],
})
export class TasksModule {}
