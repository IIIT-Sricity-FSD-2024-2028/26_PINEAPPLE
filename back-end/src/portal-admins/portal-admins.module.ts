import { Module } from '@nestjs/common';
import { PortalAdminsController } from './portal-admins.controller';
import { PortalAdminsService } from './portal-admins.service';

@Module({
  controllers: [PortalAdminsController],
  providers: [PortalAdminsService],
})
export class PortalAdminsModule {}
