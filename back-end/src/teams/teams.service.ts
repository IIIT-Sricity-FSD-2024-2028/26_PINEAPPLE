import { Injectable } from '@nestjs/common';
import { BaseService } from '../common/abstracts/base.service';
import { TeamEntity, TeamMembershipEntity } from './entities/team.entity';
import { CreateTeamDto } from './dto/create-team.dto';

@Injectable()
export class TeamsService extends BaseService<TeamEntity> {
  private memberships: TeamMembershipEntity[] = [];

  create(dto: CreateTeamDto): TeamEntity {
    const team = super.create({
      hackathonId: dto.hackathonId,
      name: dto.name,
      leadUserId: dto.leadUserId,
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
