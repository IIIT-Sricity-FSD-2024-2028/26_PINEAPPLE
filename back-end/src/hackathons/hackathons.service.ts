import { BadRequestException, Injectable } from '@nestjs/common';
import { BaseService } from '../common/abstracts/base.service';
import { HackathonEntity, HackathonState } from './entities/hackathon.entity';
import { CreateHackathonDto, RegisterLeadDto, ScoreTeamDto } from './dto/hackathon.dto';
import { OrganizationsService } from '../organizations/organizations.service';
import { EscrowService } from '../escrow/escrow.service';
import { PayoutsService } from '../payouts/payouts.service';
import { TeamsService } from '../teams/teams.service';
import { TeamState } from '../teams/entities/team.entity';
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
    this.seedDemoHackathons();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Seed data — mirrors the DEMO_HACKATHONS array in hackathons.js so the
  // API always returns data even before any hackathon is created through the
  // Host form. Seeded records are created without touching escrow so that
  // they remain read-only demo entries.
  // ─────────────────────────────────────────────────────────────────────────
  private seedDemoHackathons() {
    const now = new Date();
    const future = (daysFromNow: number) =>
      new Date(now.getTime() + daysFromNow * 86_400_000).toISOString().slice(0, 10);

    const seeds: Omit<HackathonEntity, 'id'>[] = [
      {
        hostId: 'org-xyz',
        name: 'AI Innovation Challenge 2025',
        description: 'Build innovative AI-powered solutions for real-world problems.',
        theme: 'AI, Machine Learning, GenAI',
        dates: {
          registrationClose: future(15),
          start: future(22),
          submissionClose: future(24),
          end: future(24),
        },
        mode: 'Online',
        eligibility: 'Students worldwide',
        rules: 'Standard hackathon rules apply. Max one submission per team.',
        teamSizeLimits: { min: 2, max: 4 },
        prizes: {
          totalPool: 200000,
          distribution: [
            { rank: 1, amount: 100000 },
            { rank: 2, amount: 60000 },
            { rank: 3, amount: 40000 },
          ],
        },
        judgingCriteria: { Innovation: 40, Feasibility: 30, Presentation: 30 },
        status: HackathonState.RegistrationOpen,
        escrowId: 'escrow-demo-1',
        subjectMatterGuidesEnabled: true,
        createdBy: 'org-xyz',
        createdAt: now.toISOString(),
        logo: '🤖',
        organizer: 'XYZ Technologies',
        sponsored: true,
        featured: true,
        promotionPlan: 'Premium Promotion',
        views: 12450,
        registrations: 1284,
        teamMatches: 347,
        technologies: ['Python', 'TensorFlow', 'GPT'],
        regDeadline: future(15),
        eventDates: `${future(22)} to ${future(24)}`,
        teamSize: '2–4',
        prizePool: 200000,
      },
      {
        hostId: 'org-codecraft',
        name: 'Web Dev Masters',
        description: 'Create stunning web applications with modern frameworks.',
        theme: 'Web Development, React, Node.js',
        dates: {
          registrationClose: future(20),
          start: future(27),
          submissionClose: future(29),
          end: future(29),
        },
        mode: 'Hybrid',
        location: 'Bangalore, India',
        eligibility: 'Students aged 18+',
        rules: 'Teams must build from scratch during the event. No pre-built projects.',
        teamSizeLimits: { min: 2, max: 5 },
        prizes: {
          totalPool: 150000,
          distribution: [
            { rank: 1, amount: 75000 },
            { rank: 2, amount: 45000 },
            { rank: 3, amount: 30000 },
          ],
        },
        judgingCriteria: { Design: 35, Functionality: 35, Code: 30 },
        status: HackathonState.RegistrationOpen,
        escrowId: 'escrow-demo-2',
        subjectMatterGuidesEnabled: false,
        createdBy: 'org-codecraft',
        createdAt: now.toISOString(),
        logo: '🌐',
        organizer: 'CodeCraft Inc',
        sponsored: false,
        featured: true,
        promotionPlan: 'Featured Hackathon',
        views: 8920,
        registrations: 892,
        teamMatches: 156,
        technologies: ['React', 'Node.js', 'MongoDB'],
        regDeadline: future(20),
        eventDates: `${future(27)} to ${future(29)}`,
        teamSize: '2–5',
        prizePool: 150000,
      },
      {
        hostId: 'org-securehub',
        name: 'Cybersecurity Sprint',
        description: 'Identify vulnerabilities and build secure applications.',
        theme: 'Cybersecurity, Bug Bounty',
        dates: {
          registrationClose: future(10),
          start: future(17),
          submissionClose: future(19),
          end: future(19),
        },
        mode: 'Online',
        eligibility: 'Beginner Friendly',
        rules: 'Ethical hacking only. Any harmful activity results in disqualification.',
        teamSizeLimits: { min: 1, max: 3 },
        prizes: {
          totalPool: 100000,
          distribution: [
            { rank: 1, amount: 50000 },
            { rank: 2, amount: 30000 },
            { rank: 3, amount: 20000 },
          ],
        },
        judgingCriteria: { Security: 50, Documentation: 30, Demo: 20 },
        status: HackathonState.RegistrationOpen,
        escrowId: 'escrow-demo-3',
        subjectMatterGuidesEnabled: false,
        createdBy: 'org-securehub',
        createdAt: now.toISOString(),
        logo: '🔐',
        organizer: 'SecureHub Labs',
        sponsored: false,
        featured: false,
        promotionPlan: undefined,
        views: 3450,
        registrations: 256,
        teamMatches: 89,
        technologies: ['Python', 'Bash', 'Docker'],
        regDeadline: future(10),
        eventDates: `${future(17)} to ${future(19)}`,
        teamSize: '1–3',
        prizePool: 100000,
      },
      {
        hostId: 'org-payflow',
        name: 'FinTech Revolution',
        description: 'Design financial solutions for economic challenges.',
        theme: 'FinTech, Blockchain',
        dates: {
          registrationClose: future(-1),
          start: future(6),
          submissionClose: future(8),
          end: future(8),
        },
        mode: 'Offline',
        location: 'Mumbai, India',
        eligibility: 'Engineers & Finance enthusiasts',
        rules: 'All projects must be deployable and functional at demo time.',
        teamSizeLimits: { min: 3, max: 5 },
        prizes: {
          totalPool: 300000,
          distribution: [
            { rank: 1, amount: 150000 },
            { rank: 2, amount: 90000 },
            { rank: 3, amount: 60000 },
          ],
        },
        judgingCriteria: { Innovation: 40, Market: 35, Tech: 25 },
        status: HackathonState.Ongoing,
        escrowId: 'escrow-demo-4',
        subjectMatterGuidesEnabled: true,
        createdBy: 'org-payflow',
        createdAt: now.toISOString(),
        logo: '💰',
        organizer: 'PayFlow Systems',
        sponsored: true,
        featured: true,
        promotionPlan: 'Basic Promotion',
        views: 15680,
        registrations: 1456,
        teamMatches: 512,
        technologies: ['Solidity', 'JavaScript', 'PostgreSQL'],
        regDeadline: future(-1),
        eventDates: `${future(6)} to ${future(8)}`,
        teamSize: '3–5',
        prizePool: 300000,
      },
      {
        hostId: 'org-cloudops',
        name: 'Cloud Native Hackathon',
        description: 'Build scalable, containerized applications on modern cloud platforms.',
        theme: 'Cloud, Kubernetes, DevOps',
        dates: {
          registrationClose: future(25),
          start: future(32),
          submissionClose: future(34),
          end: future(34),
        },
        mode: 'Online',
        eligibility: 'Intermediate developers',
        rules: 'Solution must run on Kubernetes. Provide a working deployment manifest.',
        teamSizeLimits: { min: 2, max: 4 },
        prizes: {
          totalPool: 120000,
          distribution: [
            { rank: 1, amount: 60000 },
            { rank: 2, amount: 36000 },
            { rank: 3, amount: 24000 },
          ],
        },
        judgingCriteria: { Scalability: 40, Innovation: 30, Presentation: 30 },
        status: HackathonState.RegistrationOpen,
        escrowId: 'escrow-demo-5',
        subjectMatterGuidesEnabled: false,
        createdBy: 'org-cloudops',
        createdAt: now.toISOString(),
        logo: '☁️',
        organizer: 'CloudOps Global',
        sponsored: false,
        featured: false,
        promotionPlan: undefined,
        views: 4200,
        registrations: 340,
        teamMatches: 120,
        technologies: ['Docker', 'Kubernetes', 'AWS'],
        regDeadline: future(25),
        eventDates: `${future(32)} to ${future(34)}`,
        teamSize: '2–4',
        prizePool: 120000,
      },
    ];

    for (const seed of seeds) {
      this.create(seed as Omit<HackathonEntity, 'id'>);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Called by PromotionsService after a successful promotion purchase.
  // Updates the hackathon's display flags so it appears in the sponsored /
  // featured sections of the Browse tab.
  // ─────────────────────────────────────────────────────────────────────────
  markAsPromoted(hackathonId: string, planName: string, visibilityBoost: string): HackathonEntity {
    const isFeatured = visibilityBoost === 'High' || visibilityBoost === 'Maximum';
    const isSponsored = true; // any active plan = sponsored badge
    return super.update(hackathonId, {
      sponsored: isSponsored,
      featured: isFeatured,
      promotionPlan: planName,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Returns hackathons where the given userId is registered as a team lead
  // or team member. Used by the My Hackathons tab.
  // ─────────────────────────────────────────────────────────────────────────
  findByUser(userId: string): HackathonEntity[] {
    const userTeams = this.teamsService.findAll().filter(
      (t) => t.leadUserId === userId || this.teamsService.getMembers(t.id).some((m) => m.userId === userId),
    );
    const hackathonIds = new Set(userTeams.map((t) => t.hackathonId));
    return this.items.filter((h) => hackathonIds.has(h.id));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Core CRUD / lifecycle methods
  // ─────────────────────────────────────────────────────────────────────────

  createHackathon(dto: CreateHackathonDto): HackathonEntity {
    if (dto.maxTeamSize < dto.minTeamSize) {
      throw new BadRequestException('maxTeamSize cannot be less than minTeamSize');
    }

    const registrationClose = dto.registrationClose;
    const eventStart = dto.eventStart ?? new Date(new Date(registrationClose).getTime() + 86400000).toISOString();
    const eventEnd = dto.eventEnd ?? new Date(new Date(registrationClose).getTime() + 3 * 86400000).toISOString();
    const totalPool = dto.totalPrizePool;

    const distribution = [
      { rank: 1, amount: Math.round(totalPool * 0.5) },
      { rank: 2, amount: Math.round(totalPool * 0.3) },
      { rank: 3, amount: Math.round(totalPool * 0.2) },
    ];

    const regDeadline = registrationClose.slice(0, 10);
    const eventDates = `${eventStart.slice(0, 10)} to ${eventEnd.slice(0, 10)}`;

    const hackathon = super.create({
      hostId: dto.orgId,
      name: dto.name,
      description: dto.description,
      theme: dto.theme,
      dates: {
        registrationClose,
        start: eventStart,
        submissionClose: eventEnd,
        end: eventEnd,
      },
      mode: dto.mode ?? 'Online',
      location: dto.location,
      eligibility: dto.eligibility ?? 'Open to all students',
      rules: dto.rules ?? 'Standard hackathon rules apply.',
      teamSizeLimits: { min: dto.minTeamSize, max: dto.maxTeamSize },
      prizes: { totalPool, distribution },
      judgingCriteria: { Innovation: 40, Feasibility: 30, Presentation: 30 },
      subjectMatterGuidesEnabled: false,
      status: HackathonState.Draft,
      escrowId: '',
      createdBy: dto.orgId,
      createdAt: new Date().toISOString(),
      logo: dto.logo ?? '🏆',
      organizer: dto.organizer ?? dto.orgId,
      technologies: dto.technologies,
      sponsored: false,
      featured: false,
      views: 0,
      registrations: 0,
      teamMatches: 0,
      regDeadline,
      eventDates,
      teamSize: `${dto.minTeamSize}–${dto.maxTeamSize}`,
      prizePool: totalPool,
    });

    const escrow = this.escrowService.fund({
      hackathonId: hackathon.id,
      prizeAmount: totalPool,
      platformFee: totalPool * 0.05,
      gatewayFee: totalPool * 0.02,
      releaseCondition: 'Hackathon closed and top teams confirmed by the host',
    });

    return super.update(hackathon.id, { escrowId: escrow.id, status: HackathonState.RegistrationOpen });
  }

  search(query?: string): HackathonEntity[] {
    if (!query) return this.findAll();
    const q = query.toLowerCase();
    return this.findAll().filter(
      (h) =>
        h.name.toLowerCase().includes(q) ||
        h.description.toLowerCase().includes(q) ||
        (h.theme ?? '').toLowerCase().includes(q),
    );
  }

  findByOrg(hostId: string): HackathonEntity[] {
    return this.items.filter((h) => h.hostId === hostId);
  }

  registerLead(hackathonId: string, dto: RegisterLeadDto) {
    const hackathon = this.findOne(hackathonId);
    if (hackathon.status !== HackathonState.RegistrationOpen && hackathon.status !== HackathonState.Published) {
      throw new BadRequestException(`Hackathon ${hackathonId} is not open for registration.`);
    }

    const team = this.teamsService.create({
      hackathonId,
      name: dto.teamName,
      leadUserId: dto.userId,
      college: dto.college,
      studentId: dto.studentId,
      idCardImage: dto.idCardImage,
    });

    if (dto.college && dto.idCardImage) {
      this.registrationsService.submitVerification({
        userId: dto.userId,
        college: dto.college,
        studentId: dto.studentId || `STU-${Date.now()}`,
        idCardImage: dto.idCardImage,
        course: 'Engineering',
        year: 1,
        age: 20,
      });
    }

    // Increment registration counter on the hackathon
    const current = this.findOne(hackathonId);
    super.update(hackathonId, { registrations: (current.registrations ?? 0) + 1 });

    return { team };
  }

  start(hackathonId: string, requesterId: string) {
    const hackathon = this.findOne(hackathonId);
    if (hackathon.status !== HackathonState.RegistrationOpen && hackathon.status !== HackathonState.Published) {
      throw new BadRequestException(`Hackathon ${hackathonId} cannot be started from status '${hackathon.status}'`);
    }

    const teams = this.teamsService.findByHackathon(hackathonId).filter(
      (t) => t.status !== TeamState.VerificationPending && t.status !== TeamState.Rejected,
    );
    for (const team of teams) {
      if (team.projectId) continue;
      const project = this.projectsService.createForTeam({
        ownerId: team.leadUserId,
        title: `${hackathon.name} — ${team.name}`,
        description: hackathon.description,
        hackathonId,
        teamId: team.id,
      });
      this.teamsService.attachProject(team.id, project.id);
    }

    return super.update(hackathonId, { status: HackathonState.Ongoing });
  }

  scoreTeam(hackathonId: string, teamId: string, dto: ScoreTeamDto) {
    const hackathon = this.findOne(hackathonId);
    const score = dto.score;

    if (hackathon.status === HackathonState.Ongoing || hackathon.status === HackathonState.SubmissionClosed) {
      super.update(hackathonId, { status: HackathonState.Judging });
    }
    return this.teamsService.setScore(teamId, score, dto.comment);
  }

  close(hackathonId: string, closedBy: string) {
    const hackathon = this.findOne(hackathonId);
    if (hackathon.status === HackathonState.Closed || hackathon.status === HackathonState.Completed) {
      throw new BadRequestException(`Hackathon ${hackathonId} is already ${hackathon.status}.`);
    }

    const leaderboard = this.teamsService.getLeaderboard(hackathonId);
    if (leaderboard.length === 0) {
      throw new BadRequestException('Cannot close a hackathon with no scored teams.');
    }

    const winners = leaderboard.slice(0, hackathon.prizes.distribution.length);
    this.escrowService.release(hackathon.escrowId);

    winners.forEach((team, index) => {
      const amount = hackathon.prizes.distribution[index]?.amount || 0;
      if (amount > 0) {
        this.payoutsService.recordTransaction({
          payerId: hackathon.hostId,
          payeeId: team.leadUserId,
          amount,
          type: 'hackathon_prize',
        });

        const members = this.teamsService.getMembers(team.id);
        for (const member of members) {
          this.notificationsService.create({
            userId: member.userId,
            type: 'HACKATHON_WIN',
            message: `🏆 Your team "${team.name}" placed #${index + 1} in "${hackathon.name}" and won ₹${amount.toLocaleString()}!`,
            readStatus: false,
            referenceId: hackathon.id,
          });
        }
      }
    });

    return super.update(hackathonId, {
      status: HackathonState.Closed,
      winningTeamIds: winners.map((t) => t.id),
      closedAt: new Date().toISOString(),
    });
  }

  cancel(hackathonId: string, requesterId: string) {
    const hackathon = this.findOne(hackathonId);
    this.escrowService.refund(hackathon.escrowId);
    return super.update(hackathonId, { status: HackathonState.Completed });
  }
}
