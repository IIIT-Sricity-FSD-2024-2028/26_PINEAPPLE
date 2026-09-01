import { Injectable, BadRequestException } from '@nestjs/common';
import { BaseService } from '../common/abstracts/base.service';
import { TeamEntity, TeamMembershipEntity, TeamState } from './entities/team.entity';
import { CreateTeamDto } from './dto/create-team.dto';

@Injectable()
export class TeamsService extends BaseService<TeamEntity> {
  private memberships: TeamMembershipEntity[] = [];

  create(dto: CreateTeamDto): TeamEntity {
    const team = super.create({
      hackathonId: dto.hackathonId,
      name: dto.name,
      leadUserId: dto.leadUserId,
      college: dto.college,
      studentId: dto.studentId,
      idCardImage: dto.idCardImage,
      status: dto.status || TeamState.VerificationPending,
      stakedXP: 0,
      createdAt: new Date().toISOString(),
    });
    this.memberships.push({
      id: `${team.id}:${dto.leadUserId}`,
      teamId: team.id,
      userId: dto.leadUserId,
      role: 'lead',
      joinedAt: new Date().toISOString(),
    });
    return team;
  }

  approve(id: string, verifiedBy: string): TeamEntity {
    const team = this.findOne(id);
    return super.update(id, {
      status: TeamState.Registered,
      verifiedBy,
      verifiedAt: new Date().toISOString(),
    });
  }

  reject(id: string, verifiedBy: string, reason?: string): TeamEntity {
    const team = this.findOne(id);
    return super.update(id, {
      status: TeamState.Rejected,
      verifiedBy,
      rejectionReason: reason || 'ID verification rejected',
      verifiedAt: new Date().toISOString(),
    });
  }

  getPendingApprovals(): TeamEntity[] {
    return this.items.filter((t) => t.status === TeamState.VerificationPending);
  }

  addMember(teamId: string, userId: string): TeamMembershipEntity {
    this.findOne(teamId);
    const membership: TeamMembershipEntity = {
      id: `${teamId}:${userId}`,
      teamId,
      userId,
      role: 'member',
      joinedAt: new Date().toISOString(),
    };
    this.memberships = this.memberships.filter((m) => m.id !== membership.id);
    this.memberships.push(membership);
    return membership;
  }

  getMembers(teamId: string): TeamMembershipEntity[] {
    return this.memberships.filter((m) => m.teamId === teamId);
  }

  getMemberCount(teamId: string): number {
    return this.getMembers(teamId).length;
  }

  isLead(teamId: string, userId: string): boolean {
    return this.memberships.some((m) => m.teamId === teamId && m.userId === userId && m.role === 'lead');
  }

  findByHackathon(hackathonId: string): TeamEntity[] {
    return this.items.filter((t) => t.hackathonId === hackathonId);
  }

  attachProject(teamId: string, projectId: string): TeamEntity {
    return super.update(teamId, { projectId });
  }

  submitProject(teamId: string, dto: any): TeamEntity {
    const team = this.findOne(teamId);
    if (team.status === TeamState.Submitted || team.status === TeamState.Judged) {
      throw new BadRequestException('Team has already submitted or been judged.');
    }
    return super.update(teamId, {
      status: TeamState.Submitted,
      submission: {
        repoUrl: dto.repoUrl,
        demoUrl: dto.demoUrl,
        presentationUrl: dto.presentationUrl,
        submittedAt: new Date().toISOString(),
      },
    });
  }

  setScore(teamId: string, score: number, scoreComment?: string): TeamEntity {
    return super.update(teamId, { score, scoreComment, scoredAt: new Date().toISOString() });
  }

  // Rankings re-sort dynamically as the host scores more teams — this is
  // just a live sort of the in-memory list, not a stored ordering.
  getLeaderboard(hackathonId: string): TeamEntity[] {
    return this.findByHackathon(hackathonId)
      .filter((t) => t.score !== undefined)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  }
}
