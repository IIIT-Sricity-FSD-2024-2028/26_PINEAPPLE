import { BadRequestException, Injectable } from '@nestjs/common';
import { BaseService } from '../common/abstracts/base.service';
import { TeamInvitationEntity } from './entities/team-invitation.entity';
import { CreateInvitationDto, AcceptInvitationDto } from './dto/team-invitation.dto';
import { TeamsService } from '../teams/teams.service';
import { HackathonRegistrationsService } from '../hackathon-registrations/hackathon-registrations.service';

// Lead-initiated invitations (distinct from the existing join-requests/
// module, which is request-initiated by the joiner). A hackathon teammate
// must be invited by their lead, not able to just request to join.
@Injectable()
export class TeamInvitationsService extends BaseService<TeamInvitationEntity> {
  constructor(
    private readonly teamsService: TeamsService,
    private readonly hackathonRegistrationsService: HackathonRegistrationsService,
  ) {
    super();
  }

  invite(dto: CreateInvitationDto): TeamInvitationEntity {
    if (!this.teamsService.isLead(dto.teamId, dto.invitedBy)) {
      throw new BadRequestException('Only the team lead can invite teammates.');
    }
    return super.create({
      teamId: dto.teamId,
      invitedUserId: dto.invitedUserId,
      invitedBy: dto.invitedBy,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
  }

  // Accepting requires KYC (Section: platform admin verifies students
  // registering — college, age, ID card) exactly like the lead's own
  // registration, since a teammate is just as much a hackathon participant.
  accept(id: string, kyc: AcceptInvitationDto): TeamInvitationEntity {
    const invite = this.findOne(id);
    if (invite.status !== 'pending') {
      throw new BadRequestException(`Invitation ${id} has already been responded to.`);
    }
    const team = this.teamsService.findOne(invite.teamId);

    this.teamsService.addMember(invite.teamId, invite.invitedUserId);
    this.hackathonRegistrationsService.register({
      hackathonId: team.hackathonId,
      userId: invite.invitedUserId,
      teamId: invite.teamId,
      role: 'member',
      fullName: kyc.fullName,
      collegeName: kyc.collegeName,
      age: kyc.age,
      idCardImageRef: kyc.idCardImageRef,
    });

    return super.update(id, { status: 'accepted' });
  }

  decline(id: string): TeamInvitationEntity {
    const invite = this.findOne(id);
    if (invite.status !== 'pending') {
      throw new BadRequestException(`Invitation ${id} has already been responded to.`);
    }
    return super.update(id, { status: 'declined' });
  }

  findForUser(userId: string): TeamInvitationEntity[] {
    return this.items.filter((i) => i.invitedUserId === userId);
  }

  findForTeam(teamId: string): TeamInvitationEntity[] {
    return this.items.filter((i) => i.teamId === teamId);
  }
}
