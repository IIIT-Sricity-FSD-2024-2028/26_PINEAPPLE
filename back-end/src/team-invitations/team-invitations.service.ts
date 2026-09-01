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

  // Accepting requires KYC verification. The student must have been verified
  // by a platform admin via the hackathon-registrations module.
  accept(id: string, kyc?: AcceptInvitationDto): TeamInvitationEntity {
    const invite = this.findOne(id);
    if (invite.status !== 'pending') {
      throw new BadRequestException(`Invitation ${id} has already been responded to.`);
    }

    let verification = this.hackathonRegistrationsService.findByUserId(invite.invitedUserId);
    if ((!verification || verification.status !== 'Verified') && kyc?.collegeName) {
      const newRec = this.hackathonRegistrationsService.submitVerification({
        userId: invite.invitedUserId,
        college: kyc.collegeName,
        age: kyc.age || 20,
        course: 'Engineering',
        year: 1,
        studentId: 'ID-' + Date.now(),
        idCardImage: kyc.idCardImageRef || '/uploads/default-id.png',
      });
      this.hackathonRegistrationsService.verify(newRec.id, 'System');
      verification = this.hackathonRegistrationsService.findByUserId(invite.invitedUserId);
    }

    if (!verification || verification.status !== 'Verified') {
      throw new BadRequestException('You must complete Student Verification before accepting an invite.');
    }

    this.teamsService.addMember(invite.teamId, invite.invitedUserId);

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
