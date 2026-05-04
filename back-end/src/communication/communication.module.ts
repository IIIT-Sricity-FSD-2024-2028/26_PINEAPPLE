import { Module } from '@nestjs/common';
import { CommunicationController } from './communication.controller';
import { CommunicationService } from './communication.service';
import { CommunicationRepository } from './communication.repository';

@Module({
  controllers: [CommunicationController],
  providers: [CommunicationService, CommunicationRepository],
  exports: [CommunicationService], // Exported so other modules (e.g. Gamification/Tasks) can push notifications
})
export class CommunicationModule {}
