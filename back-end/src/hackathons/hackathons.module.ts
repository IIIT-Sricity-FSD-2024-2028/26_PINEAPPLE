import { Module } from '@nestjs/common';
import { HackathonsService } from './hackathons.service';
import { HackathonsController } from './hackathons.controller';
import { OrganizationsModule } from '../organizations/organizations.module';
import { EscrowModule } from '../escrow/escrow.module';
import { PayoutsModule } from '../payouts/payouts.module';
import { TeamsModule } from '../teams/teams.module';
import { ProjectsModule } from '../projects/projects.module';
import { HackathonRegistrationsModule } from '../hackathon-registrations/hackathon-registrations.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    OrganizationsModule,
    EscrowModule,
    PayoutsModule,
    TeamsModule,
    ProjectsModule,
    HackathonRegistrationsModule,
    NotificationsModule,
  ],
  controllers: [HackathonsController],
  providers: [HackathonsService],
  exports: [HackathonsService],
})
export class HackathonsModule {}
