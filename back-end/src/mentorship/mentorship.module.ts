import { Module } from '@nestjs/common';
import { MentorshipController } from './mentorship.controller';
import { MentorshipService } from './mentorship.service';
import { MentorshipRepository } from './mentorship.repository';
import { UsersModule } from '../users/users.module';
import { GamificationModule } from '../gamification/gamification.module';
import { CommunicationModule } from '../communication/communication.module';

@Module({
  // CRITICAL: Importing all peer modules required for cross-module orchestration
  imports: [UsersModule, GamificationModule, CommunicationModule],
  controllers: [MentorshipController],
  providers: [MentorshipService, MentorshipRepository],
})
export class MentorshipModule {}
