import { Module } from '@nestjs/common';
import { GovernanceController } from './governance.controller';
import { GovernanceRepository } from './governance.repository';

@Module({
  controllers: [GovernanceController],
  providers: [GovernanceRepository],
  exports: [GovernanceRepository],
})
export class GovernanceModule {}
