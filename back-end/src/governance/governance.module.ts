import { Module } from '@nestjs/common';
import { GovernanceController } from './governance.controller';
import { GovernanceService } from './governance.service';
import { GovernanceRepository } from './governance.repository';
import { UsersModule } from '../users/users.module';
import { GamificationModule } from '../gamification/gamification.module';
import { CommunicationModule } from '../communication/communication.module';

@Module({
  // CRITICAL: Importing external modules to trigger cascading penalties and notifications
  imports: [UsersModule, GamificationModule, CommunicationModule],
  controllers: [GovernanceController],
  providers: [GovernanceService, GovernanceRepository],
})
export class GovernanceModule {}
