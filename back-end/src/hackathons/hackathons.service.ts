import { BadRequestException, Injectable } from '@nestjs/common';
import { BaseService } from '../common/abstracts/base.service';
import { HackathonEntity } from './entities/hackathon.entity';
import { CreateHackathonDto, RegisterLeadDto, ScoreTeamDto } from './dto/hackathon.dto';
import { OrganizationsService } from '../organizations/organizations.service';
import { EscrowService } from '../escrow/escrow.service';
import { PayoutsService } from '../payouts/payouts.service';
import { TeamsService } from '../teams/teams.service';
import { ProjectsService } from '../projects/projects.service';
import { HackathonRegistrationsService } from '../hackathon-registrations/hackathon-registrations.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class HackathonsService extends BaseService<HackathonEntity> {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly escrowService: EscrowService,
    private readonly payoutsService: PayoutsService,
    private readonly teamsService: TeamsService,
    private readonly projectsService: ProjectsService,
    private readonly registrationsService: HackathonRegistrationsService,
    private readonly notificationsService: NotificationsService,
  ) {
    super();
  }

  // Host fills in the hackathon details and the prize money is funded into
  // escrow in the same action — the platform holds it until the hackathon
  // closes and winners are picked (never a direct host->winner transfer).
  create(dto: CreateHackathonDto): HackathonEntity {
    this.organizationsService.assertOrgAdmin(dto.orgId, dto.createdBy);

    const prizeSplit = dto.prizeSplit ?? [50, 30, 20];
    const splitSum = prizeSplit.reduce((a, b) => a + b, 0);
    if (splitSum !== 100) {
      throw new BadRequestException(`prizeSplit must sum to 100 (got ${splitSum})`);
    }
    if (dto.teamSizeMax < dto.teamSizeMin) {
      throw new BadRequestException('teamSizeMax cannot be less than teamSizeMin');
    }

    const hackathon = super.create({
      orgId: dto.orgId,
      title: dto.title,
      description: dto.description,
      theme: dto.theme,
      eligibilityCriteria: dto.eligibilityCriteria,
      teamSizeMin: dto.teamSizeMin,
      teamSizeMax: dto.teamSizeMax,
      prizePool: dto.prizePool,
      prizeSplit,
      registrationDeadline: dto.registrationDeadline,
      status: 'open_for_registration',
      escrowId: '', // set immediately below
      createdBy: dto.createdBy,
      createdAt: new Date().toISOString(),
    });

    const escrow = this.escrowService.fund({
      sourceType: 'hackathon',
      sourceId: hackathon.id,
      amount: dto.prizePool,
      currency: 'INR',
      releaseCondition: 'Hackathon closed and top 3 teams confirmed by the host',
    });

    return super.update(hackathon.id, { escrowId: escrow.id });
  }

  // Public browse + search — title/description/theme substring match.
  search(query?: string): HackathonEntity[] {
    if (!query) return this.findAll();
    const q = query.toLowerCase();
    return this.findAll().filter(
      (h) =>
        h.title.toLowerCase().includes(q) ||
        h.description.toLowerCase().includes(q) ||
        (h.theme ?? '').toLowerCase().includes(q),
    );
  }

  findByOrg(orgId: string): HackathonEntity[] {
    return this.items.filter((h) => h.orgId === orgId);
  }

  // Registration step 1: lead creates their team + submits their own KYC in
  // one action ("1st lead should register").
  registerLead(hackathonId: string, dto: RegisterLeadDto) {
    const hackathon = this.findOne(hackathonId);
    if (hackathon.status !== 'open_for_registration') {
      throw new BadRequestException(`Hackathon ${hackathonId} is not open for registration.`);
    }

    const team = this.teamsService.create({
      hackathonId,
      name: dto.teamName,
      leadUserId: dto.userId,
    });

    const registration = this.registrationsService.register({
      hackathonId,
      userId: dto.userId,
      teamId: team.id,
      role: 'lead',
      fullName: dto.fullName,
      collegeName: dto.collegeName,
      age: dto.age,
      idCardImageRef: dto.idCardImageRef,
    });

    return { team, registration };
  }

  // Host manually starts the hackathon once registration closes — every
  // registered team gets its own Project/workspace, pre-owned by its lead,
  // so the existing task-assignment UI works immediately with no further
  // wiring (Section: "each team will get their own workplace").
  start(hackathonId: string, requesterId: string) {
    const hackathon = this.findOne(hackathonId);
    this.organizationsService.assertOrgAdmin(hackathon.orgId, requesterId);
    if (hackathon.status !== 'open_for_registration') {
      throw new BadRequestException(`Hackathon ${hackathonId} cannot be started from status '${hackathon.status}'`);
    }

    const teams = this.teamsService.findByHackathon(hackathonId);
    for (const team of teams) {
      if (team.projectId) continue; // already started (idempotent)
      const project = this.projectsService.createForTeam({
        ownerId: team.leadUserId,
        title: `${hackathon.title} — ${team.name}`,
        description: hackathon.description,
        hackathonId,
        teamId: team.id,
      });
      this.teamsService.attachProject(team.id, project.id);
    }

    return super.update(hackathonId, { status: 'ongoing' });
  }

  // Host scores a submitted team-project. Live leaderboard re-sorts on every
  // call (teams/ already sorts by score descending).
  scoreTeam(hackathonId: string, teamId: string, dto: ScoreTeamDto) {
    const hackathon = this.findOne(hackathonId);
    this.organizationsService.assertOrgAdmin(hackathon.orgId, dto.scoredBy);
    if (dto.score < 1 || dto.score > 10) {
      throw new BadRequestException('score must be between 1 and 10');
    }
    if (hackathon.status === 'ongoing') {
      super.update(hackathonId, { status: 'judging' });
    }
    return this.teamsService.setScore(teamId, dto.score, dto.comment);
  }

  // Host closes the hackathon: picks the top 3 scored teams, releases the
  // prize pool from escrow split per prizeSplit, records a TRANSACTION per
  // winning team's lead, and notifies every member of the winning teams.
  close(hackathonId: string, closedBy: string) {
    const hackathon = this.findOne(hackathonId);
    this.organizationsService.assertOrgAdmin(hackathon.orgId, closedBy);
    if (hackathon.status === 'closed' || hackathon.status === 'cancelled') {
      throw new BadRequestException(`Hackathon ${hackathonId} is already ${hackathon.status}.`);
    }

    const leaderboard = this.teamsService.getLeaderboard(hackathonId);
    if (leaderboard.length === 0) {
      throw new BadRequestException('Cannot close a hackathon with no scored teams.');
    }

    const winners = leaderboard.slice(0, 3);
    this.escrowService.release(hackathon.escrowId);

    winners.forEach((team, index) => {
      const amount = Math.round((hackathon.prizePool * hackathon.prizeSplit[index]) / 100);
      this.payoutsService.recordTransaction({
        payerId: hackathon.orgId,
        payeeId: team.leadUserId,
        amount,
        type: 'hackathon_prize',
      });

      const members = this.teamsService.getMembers(team.id);
      for (const member of members) {
        this.notificationsService.create({
          userId: member.userId,
          type: 'HACKATHON_WIN',
          message: `🏆 Your team "${team.name}" placed #${index + 1} in "${hackathon.title}" and won ₹${amount.toLocaleString()}!`,
          readStatus: false,
          referenceId: hackathon.id,
        });
      }
    });

    return super.update(hackathonId, {
      status: 'closed',
      winningTeamIds: winners.map((t) => t.id),
      closedAt: new Date().toISOString(),
    });
  }

  cancel(hackathonId: string, requesterId: string) {
    const hackathon = this.findOne(hackathonId);
    this.organizationsService.assertOrgAdmin(hackathon.orgId, requesterId);
    this.escrowService.refund(hackathon.escrowId);
    return super.update(hackathonId, { status: 'cancelled' });
  }
}
