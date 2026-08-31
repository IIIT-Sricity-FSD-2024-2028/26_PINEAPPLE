import { Module } from '@nestjs/common';
import { TeamInvitationsService } from './team-invitations.service';
import { TeamInvitationsController } from './team-invitations.controller';
import { TeamsModule } from '../teams/teams.module';
import { HackathonRegistrationsModule } from '../hackathon-registrations/hackathon-registrations.module';

@Module({
  imports: [TeamsModule, HackathonRegistrationsModule],
  controllers: [TeamInvitationsController],
  providers: [TeamInvitationsService],
  exports: [TeamInvitationsService],
})
export class TeamInvitationsModule {}
