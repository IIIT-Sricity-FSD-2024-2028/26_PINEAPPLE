import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Inject, forwardRef, OnApplicationBootstrap } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  MentorProfileEntity,
  MentorReviewEntity,
  MentorSessionEntity,
} from './entities/mentor-marketplace.entity';
import {
  BookSessionDto,
  CreateMentorProfileDto,
  FilterMentorsDto,
  SubmitReviewDto,
  UpdateMentorProfileDto,
} from './dto/mentor-marketplace.dto';
import { EscrowService } from '../escrow/escrow.service';
import { PayoutsService } from '../payouts/payouts.service';
import { UsersService } from '../users/users.service';
import { GamificationService } from '../gamification/gamification.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MentorApplicationsService } from '../mentor-applications/mentor-applications.service';
import { UserRole } from '../users/dto/create-user.dto';
import { ProjectsRepository } from '../projects/projects.repository';
import { AuditService } from '../audit/audit.service';

/**
 * Single canonical escrow breakdown calculation:
 * Formula:
 * - Owner pays: sessionPrice + 15% platformFee + 2% gatewayFee.
 * - Total amount held in escrow: sessionPrice + 15% platformFee + 2% gatewayFee.
 * - On completion / release:
 *     Mentor receives: sessionPrice (100% of mentor's fee).
 *     Platform revenue: 15% platformFee.
 *     Gateway cost: 2% gatewayFee.
 * - On decline / cancel:
 *     Owner is refunded the full amount paid: sessionPrice + 15% platformFee + 2% gatewayFee.
 * All numbers rounded to whole rupees consistently.
 */
export function calculateEscrowBreakdown(sessionPrice: number) {
  const price = Math.round(sessionPrice || 0);
  const platformFee = Math.round(price * 0.15);
  const gatewayFee = Math.round(price * 0.02);
  const totalAmount = price + platformFee + gatewayFee;
  const mentorPayout = price;
  return {
    price,
    platformFee,
    gatewayFee,
    totalFees: platformFee + gatewayFee,
    totalAmount,
    mentorPayout,
  };
}

@Injectable()
export class MentorMarketplaceService implements OnApplicationBootstrap {
  private profiles: MentorProfileEntity[] = [];
  private sessions: MentorSessionEntity[] = [];
  private reviews: MentorReviewEntity[] = [];

  constructor(
    private readonly escrowService: EscrowService,
    private readonly payoutsService: PayoutsService,
    private readonly usersService: UsersService,
    private readonly gamificationService: GamificationService,
    private readonly notificationsService: NotificationsService,
    private readonly mentorApplicationsService: MentorApplicationsService,
    @Inject(forwardRef(() => ProjectsRepository))
    private readonly projectsRepository: ProjectsRepository,
    private readonly auditService: AuditService,
  ) {
    this.profiles.push({
      id: 'mentor-profile-1',
      userId: '7', // Neha Gupta (Mentor)
      name: 'Neha Gupta',
      avatar: '👧',
      title: 'Data Scientist & Mentor, 5 yrs',
      bio: 'Passionate about teaching machine learning and data science concepts.',
      skills: ['Data Science', 'Python', 'TensorFlow'],
      experienceYears: 5,
      sessionPrice: 1500,
      sessionDuration: 60,
      languages: ['English', 'Hindi'],
      availability: 'Weekends',
      isAvailable: true,
      createdAt: new Date().toISOString(),
    });

    this.profiles.push({
      id: 'mentor-profile-2',
      userId: '4', // Rohan Mehta (Mentor)
      name: 'Rohan Mehta',
      avatar: '👦',
      title: 'UI/UX Designer, 4 yrs',
      bio: 'I help teams design beautiful and accessible user interfaces.',
      skills: ['UI/UX', 'Figma', 'React'],
      experienceYears: 4,
      sessionPrice: 800,
      sessionDuration: 30,
      languages: ['English'],
      availability: 'Anytime',
      isAvailable: true,
      createdAt: new Date().toISOString(),
    });

    this.profiles.push({
      id: 'mentor-profile-3',
      userId: '3', // Kiran Bose (Mentor)
      name: 'Kiran Bose',
      avatar: '👨‍🏫',
      title: 'Full-stack Architect, 8 yrs',
      bio: 'Cloud architecture, distributed systems, and scalable full-stack web applications.',
      skills: ['Node.js', 'React', 'Cloud Architecture', 'TypeScript'],
      experienceYears: 8,
      sessionPrice: 2000,
      sessionDuration: 60,
      languages: ['English', 'Bengali'],
      availability: 'Weekdays',
      isAvailable: true,
      createdAt: new Date().toISOString(),
    });

    this.profiles.push({
      id: 'mentor-profile-4',
      userId: '5', // Sneha Iyer (Mentor)
      name: 'Sneha Iyer',
      avatar: '👩‍💻',
      title: 'DevOps & Cloud Specialist, 6 yrs',
      bio: 'Container orchestration, CI/CD pipelines, and robust AWS infrastructure design.',
      skills: ['DevOps', 'AWS', 'Docker', 'Kubernetes'],
      experienceYears: 6,
      sessionPrice: 1200,
      sessionDuration: 45,
      languages: ['English', 'Tamil'],
      availability: 'Anytime',
      isAvailable: true,
      createdAt: new Date().toISOString(),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Verify user has real approved Mentor status from user record or mentor application
  // ─────────────────────────────────────────────────────────────────────────
  isMentorVerified(userId?: string): boolean {
    if (!userId) return false;
    const strUserId = String(userId);
    let userEmail: string | undefined;
    try {
      const user = this.usersService.findById(strUserId);
      if (user) {
        userEmail = user.email;
        if (user.role === UserRole.Mentor || user.profile?.mentorUnlocked) {
          return true;
        }
      }
    } catch {
      // User not found in repository by ID
    }

    try {
      const allUsers = this.usersService.findAll();
      const user = allUsers.find((u) => String(u.id) === strUserId);
      if (user) {
        userEmail = user.email;
        if (user.role === UserRole.Mentor || user.profile?.mentorUnlocked) {
          return true;
        }
      }
    } catch {
      // Lookup failure
    }

    try {
      const apps = this.mentorApplicationsService.findByUser(strUserId);
      if (apps && apps.some((a) => a.status === 'approved')) {
        return true;
      }
      if (userEmail) {
        const approved = this.mentorApplicationsService.findByStatus('approved');
        if (approved.some((a) => a.email && a.email.toLowerCase() === userEmail?.toLowerCase())) {
          return true;
        }
      }
    } catch {
      // Lookup failure
    }

    return false;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Self-service sync: only allowed if account is verified/approved
  // ─────────────────────────────────────────────────────────────────────────
  confirmMentorRole(userId: string): { role: string } {
    if (!this.isMentorVerified(userId)) {
      throw new ForbiddenException(
        'Account does not have an approved mentor application or unlocked mentor status.',
      );
    }
    const user = this.usersService.findById(String(userId));
    if (user.role !== UserRole.Mentor) {
      this.usersService.update(String(userId), { role: UserRole.Mentor });
    }
    return { role: UserRole.Mentor };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Browse — only verified mentors, supports full filter + sort
  // ─────────────────────────────────────────────────────────────────────────
  listMentors(filters: FilterMentorsDto = {}): MentorProfileEntity[] {
    let result = this.profiles.filter(
      (m) => Boolean(m.isAvailable) && Number(m.sessionPrice) > 0 && this.isMentorVerified(m.userId),
    );

    // Text search (name, bio, title, skills)
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.bio.toLowerCase().includes(q) ||
          m.title.toLowerCase().includes(q) ||
          m.skills.some((s) => s.toLowerCase().includes(q)),
      );
    }

    // Skills filter (one or many)
    if (filters.skills) {
      const skillArr = Array.isArray(filters.skills)
        ? filters.skills
        : [filters.skills];
      const lowerSkills = skillArr.map((s) => s.toLowerCase());
      result = result.filter((m) =>
        lowerSkills.some((sk) =>
          m.skills.some((ms) => ms.toLowerCase().includes(sk)),
        ),
      );
    }

    // Price range
    if (filters.minPrice !== undefined) {
      result = result.filter((m) => m.sessionPrice >= Number(filters.minPrice));
    }
    if (filters.maxPrice !== undefined) {
      result = result.filter((m) => m.sessionPrice <= Number(filters.maxPrice));
    }

    // Experience
    if (filters.minExp !== undefined) {
      result = result.filter((m) => m.experienceYears >= Number(filters.minExp));
    }

    // Availability
    if (filters.availability) {
      result = result.filter(
        (m) =>
          m.availability === filters.availability || m.availability === 'Anytime',
      );
    }

    // Sort
    switch (filters.sort) {
      case 'price_asc':  result.sort((a, b) => a.sessionPrice - b.sessionPrice); break;
      case 'price_desc': result.sort((a, b) => b.sessionPrice - a.sessionPrice); break;
      default:
        result.sort((a, b) => b.sessionPrice - a.sessionPrice);
    }

    return result;
  }

  getMentor(id: string): { profile: MentorProfileEntity; reviews: MentorReviewEntity[] } {
    const profile = this.profiles.find((m) => m.id === id);
    if (!profile) throw new NotFoundException(`Mentor profile ${id} not found`);
    const reviews = this.reviews.filter((r) => r.mentorId === id);
    return { profile, reviews };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Create mentor listing — only if user has Mentor role
  // ─────────────────────────────────────────────────────────────────────────
  createProfile(userId: string, dto: CreateMentorProfileDto): MentorProfileEntity {
    if (!this.isMentorVerified(userId)) {
      throw new ForbiddenException(
        'Only approved mentors (role: Mentor) can create a listing. Apply via the "Become a Mentor" form first.',
      );
    }
    const existing = this.profiles.find((p) => String(p.userId) === String(userId));
    if (existing) {
      Object.assign(existing, dto);
      if (dto.isAvailable !== undefined) {
        existing.isAvailable = Boolean(dto.isAvailable);
      }
      return existing;
    }

    const profile: MentorProfileEntity = {
      id: randomUUID(),
      userId: String(userId),
      name: dto.name,
      avatar: dto.avatar ?? '🧑‍🏫',
      title: dto.title,
      bio: dto.bio,
      skills: dto.skills,
      experienceYears: dto.experienceYears,
      sessionPrice: dto.sessionPrice,
      sessionDuration: dto.sessionDuration,
      languages: dto.languages ?? ['English'],
      availability: dto.availability,
      isAvailable: dto.isAvailable !== undefined ? Boolean(dto.isAvailable) : true,
      createdAt: new Date().toISOString(),
    };
    this.profiles.push(profile);

    try {
      this.auditService.log({
        action: 'mentor-profile-saved',
        actor: profile.name || `User #${userId}`,
        target: 'Mentor Marketplace Profile',
        entityType: 'mentor_profile',
        entityId: profile.id,
        event: `${profile.name || 'Mentor'} created marketplace profile (₹${profile.sessionPrice}/session)`,
        details: { sessionPrice: profile.sessionPrice, isAvailable: profile.isAvailable },
      });
    } catch { /* non-critical */ }

    return profile;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Get the calling mentor's own listing — null if they haven't set one up yet
  // ─────────────────────────────────────────────────────────────────────────
  getMyProfile(userId: string): MentorProfileEntity | null {
    if (!this.isMentorVerified(userId)) {
      throw new ForbiddenException('Only approved mentors can access mentor listing profile.');
    }
    return this.profiles.find((p) => String(p.userId) === String(userId)) ?? null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Edit an existing listing (e.g. change price) — mentor only, own listing
  // ─────────────────────────────────────────────────────────────────────────
  updateProfile(userId: string, dto: UpdateMentorProfileDto): MentorProfileEntity {
    if (!this.isMentorVerified(userId)) {
      throw new ForbiddenException('Only approved mentors can update a mentor listing.');
    }
    let profile = this.profiles.find((p) => String(p.userId) === String(userId));
    if (!profile) {
      // Upsert: Create profile if not yet created
      profile = {
        id: randomUUID(),
        userId: String(userId),
        name: dto.name || 'Mentor',
        avatar: dto.avatar ?? '🧑‍🏫',
        title: dto.title || 'Senior Software Mentor',
        bio: dto.bio || '',
        skills: dto.skills || ['Mentorship'],
        experienceYears: dto.experienceYears ?? 1,
        sessionPrice: dto.sessionPrice ?? 1000,
        sessionDuration: dto.sessionDuration ?? 60,
        languages: dto.languages ?? ['English'],
        availability: dto.availability || 'Anytime',
        isAvailable: dto.isAvailable !== undefined ? Boolean(dto.isAvailable) : true,
        createdAt: new Date().toISOString(),
      };
      this.profiles.push(profile);
    } else {
      Object.assign(profile, dto);
      if (dto.isAvailable !== undefined) {
        profile.isAvailable = Boolean(dto.isAvailable);
      }
    }

    try {
      this.auditService.log({
        action: 'mentor-profile-saved',
        actor: profile.name || `User #${userId}`,
        target: 'Mentor Marketplace Profile',
        entityType: 'mentor_profile',
        entityId: profile.id,
        event: `${profile.name || 'Mentor'} updated marketplace profile (₹${profile.sessionPrice}/session)`,
        details: { sessionPrice: profile.sessionPrice, isAvailable: profile.isAvailable },
      });
    } catch { /* non-critical */ }

    return profile;
  }

  updateAvailability(userId: string, isAvailable: boolean): MentorProfileEntity {
    if (!this.isMentorVerified(userId)) {
      throw new ForbiddenException('Only approved mentors can update availability.');
    }
    let profile = this.profiles.find((p) => String(p.userId) === String(userId));
    if (!profile) {
      profile = {
        id: randomUUID(),
        userId: String(userId),
        name: 'Mentor',
        avatar: '🧑‍🏫',
        title: 'Senior Software Mentor',
        bio: '',
        skills: ['Mentorship'],
        experienceYears: 1,
        sessionPrice: 1000,
        sessionDuration: 60,
        languages: ['English'],
        availability: 'Anytime',
        isAvailable: Boolean(isAvailable),
        createdAt: new Date().toISOString(),
      };
      this.profiles.push(profile);
      return profile;
    }
    profile.isAvailable = Boolean(isAvailable);
    return profile;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Book a session — creates escrow, records session
  // ─────────────────────────────────────────────────────────────────────────
  bookSession(studentId: string, dto: BookSessionDto): { session: MentorSessionEntity; escrow: any } {
    const profile = this.profiles.find((m) => m.id === dto.mentorId);
    if (!profile) throw new NotFoundException('Mentor not found');
    if (!profile.isAvailable) throw new BadRequestException('This mentor is currently unavailable.');
    if (!this.isMentorVerified(profile.userId)) {
      throw new BadRequestException('This mentor is not verified.');
    }

    if (!dto.projectId) {
      throw new BadRequestException('Project ID is required to book a mentor.');
    }

    const project = this.projectsRepository.findById(dto.projectId);
    if (!project) {
      throw new NotFoundException(`Project ${dto.projectId} not found.`);
    }

    if (project.isCompleted || String(project.status || '').toLowerCase() === 'completed') {
      throw new BadRequestException('Cannot book mentorship for a completed project.');
    }

    // Verify caller is the owner of the project
    let callerName: string | undefined;
    try {
      const caller = this.usersService.findById(String(studentId));
      if (caller) callerName = caller.name;
    } catch { /* ignore */ }

    const isOwner =
      String(project.ownerId) === String(studentId) ||
      (callerName && project.owner && project.owner.toLowerCase() === callerName.toLowerCase()) ||
      (project.owner && project.owner.toLowerCase() === String(studentId).toLowerCase());

    if (!isOwner) {
      throw new ForbiddenException('You can only book mentors for projects that you own.');
    }

    const sessionId = randomUUID();
    // First create escrow (links to sessionId)
    const escrow = this.escrowService.fundForSession(sessionId, profile.sessionPrice);

    const breakdown = calculateEscrowBreakdown(profile.sessionPrice);
    const session: MentorSessionEntity = {
      id: sessionId,
      mentorId: dto.mentorId,
      studentId,
      projectId: dto.projectId,
      projectDescription: dto.projectDescription,
      agreedPrice: profile.sessionPrice,
      platformFee: breakdown.platformFee,
      gatewayFee: breakdown.gatewayFee,
      totalAmount: escrow.totalFunded || breakdown.totalAmount,
      payout: breakdown.mentorPayout,
      escrowId: escrow.id,
      status: 'escrow_funded',
      createdAt: new Date().toISOString(),
    };
    this.sessions.push(session);

    // Notify mentor
    try {
      this.notificationsService.create({
        userId: profile.userId,
        type: 'MENTOR_SESSION_BOOKED',
        title: 'Mentor Booking Confirmed',
        message: `📚 A student has booked a session with you! ₹${profile.sessionPrice} is held in escrow.`,
        readStatus: false,
        referenceId: sessionId,
      });
    } catch { /* non-critical */ }

    try {
      this.auditService.log({
        action: 'booking-funded',
        actor: `User #${studentId}`,
        target: profile.name,
        entityType: 'mentor_session',
        entityId: sessionId,
        event: `Mentorship session booked with ${profile.name} (Escrow ₹${profile.sessionPrice} held)`,
        details: { price: profile.sessionPrice, projectId: dto.projectId },
      });
    } catch { /* non-critical */ }

    return { session: this.enrichSession(session), escrow };
  }

  startSession(sessionId: string): MentorSessionEntity {
    const session = this.findSession(sessionId);
    if (session.status !== 'escrow_funded') {
      throw new BadRequestException(`Session is already ${session.status}`);
    }
    session.status = 'active';
    session.startedAt = new Date().toISOString();

    // Notify both parties
    const profile = this.profiles.find((m) => m.id === session.mentorId);
    try {
      this.notificationsService.create({
        userId: session.studentId,
        type: 'MENTOR_SESSION_STARTED',
        title: 'Mentor Session Started',
        message: `🟢 Your session with ${profile?.name ?? 'your mentor'} has started!`,
        readStatus: false,
        referenceId: sessionId,
      });
    } catch { /* non-critical */ }

    return this.enrichSession(session);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Mentor accepts the booking request — grants the mentor access to work
  // with the project owner (frontend wires this into project workspace access).
  // ─────────────────────────────────────────────────────────────────────────
  acceptSession(sessionId: string, mentorUserId: string, isPrivileged = false): MentorSessionEntity {
    if (!isPrivileged && !this.isMentorVerified(mentorUserId)) {
      throw new ForbiddenException('Only approved mentors can accept session bookings.');
    }
    const session = this.findSession(sessionId);
    const profile = this.profiles.find((m) => m.id === session.mentorId);
    if (!isPrivileged && (!profile || profile.userId !== mentorUserId)) {
      throw new ForbiddenException('This session was not booked with you.');
    }
    if (session.status !== 'escrow_funded') {
      throw new BadRequestException(`Session is already ${session.status}`);
    }
    session.status = 'active';
    session.startedAt = new Date().toISOString();

    // Assign mentor to project
    if (session.projectId) {
      try {
        const project = this.projectsRepository.findById(session.projectId);
        if (project) {
          project.mentorId = mentorUserId;
          project.mentor = profile?.name || 'Mentor';
          this.projectsRepository.update(session.projectId, {
            mentorId: mentorUserId,
            mentor: profile?.name || 'Mentor',
          });
        }
      } catch {
        /* non-critical */
      }
    }

    try {
      this.notificationsService.create({
        userId: session.studentId,
        type: 'MENTOR_SESSION_ACCEPTED',
        title: 'Mentor Request Accepted',
        message: `🟢 ${profile?.name || 'Mentor'} accepted your mentor request! You can now access the shared project workspace.`,
        readStatus: false,
        referenceId: sessionId,
      });
    } catch { /* non-critical */ }

    try {
      this.auditService.log({
        action: 'booking-accepted',
        actor: profile?.name || 'Mentor',
        target: `Session #${sessionId}`,
        entityType: 'mentor_session',
        entityId: sessionId,
        event: `${profile?.name || 'Mentor'} accepted mentorship request for project #${session.projectId}`,
        details: { status: 'active', agreedPrice: session.agreedPrice },
      });
    } catch { /* non-critical */ }

    return this.enrichSession(session);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Mentor declines the booking request — escrow is refunded to the owner.
  // ─────────────────────────────────────────────────────────────────────────
  declineSession(sessionId: string, mentorUserId: string, isPrivileged = false): MentorSessionEntity {
    if (!isPrivileged && !this.isMentorVerified(mentorUserId)) {
      throw new ForbiddenException('Only approved mentors can decline session bookings.');
    }
    const session = this.findSession(sessionId);
    const profile = this.profiles.find((m) => m.id === session.mentorId);
    if (!isPrivileged && (!profile || profile.userId !== mentorUserId)) {
      throw new ForbiddenException('This session was not booked with you.');
    }
    if (session.status === 'active') {
      throw new ForbiddenException('A mentor cannot leave or be removed once a project has started.');
    }
    if (session.status !== 'escrow_funded') {
      throw new BadRequestException(`Session is already ${session.status}`);
    }

    this.escrowService.refund(session.escrowId);
    session.status = 'refunded';

    const { totalAmount } = calculateEscrowBreakdown(session.agreedPrice);

    try {
      this.notificationsService.create({
        userId: session.studentId,
        type: 'MENTOR_SESSION_DECLINED',
        title: 'Mentor Request Declined',
        message: `🔴 ${profile?.name || 'Mentor'} declined your mentor request. ₹${totalAmount} has been refunded.`,
        readStatus: false,
        referenceId: sessionId,
      });
    } catch { /* non-critical */ }

    try {
      this.auditService.log({
        action: 'booking-declined',
        actor: profile?.name || 'Mentor',
        target: `Session #${sessionId}`,
        entityType: 'mentor_session',
        entityId: sessionId,
        event: `${profile?.name || 'Mentor'} declined mentorship booking (₹${totalAmount} refunded)`,
        details: { status: 'refunded', agreedPrice: session.agreedPrice, totalAmount },
      });
    } catch { /* non-critical */ }

    return this.enrichSession(session);
  }

  // requesterId/isPrivileged: the project owner who booked the session can
  // complete their own session (e.g. when they close out their project);
  // admin/superuser may complete any session for support purposes.
  completeSession(sessionId: string, requesterId?: string, isPrivileged = false): MentorSessionEntity {
    const session = this.findSession(sessionId);
    if (!isPrivileged && requesterId !== undefined && session.studentId !== requesterId) {
      throw new ForbiddenException('Only the project owner who booked this session (or an admin) can mark it complete.');
    }
    if (session.status !== 'active') {
      throw new BadRequestException(`Session must be active to complete. Current: ${session.status}`);
    }

    // Release escrow
    this.escrowService.release(session.escrowId);

    // Record payout (mentor receives 100% of agreed session price; platform retains 15% platform fee)
    const { mentorPayout, platformFee } = calculateEscrowBreakdown(session.agreedPrice);
    const profile = this.profiles.find((m) => m.id === session.mentorId);
    this.payoutsService.recordTransaction({
      payerId: 'platform',
      payeeId: profile?.userId ?? session.mentorId,
      amount: mentorPayout,
      type: 'mentor_session_payout',
    });

    // Update stats
    if (profile && profile.totalSessions !== undefined) profile.totalSessions += 1;

    session.status = 'completed';
    session.completedAt = new Date().toISOString();

    // Notify student to leave a review, and the mentor that they got paid
    try {
      this.notificationsService.create({
        userId: session.studentId,
        type: 'MENTOR_SESSION_COMPLETED',
        message: `✅ Session completed! ₹${mentorPayout} paid to mentor. Leave a review to help others.`,
        readStatus: false,
        referenceId: sessionId,
      });
      if (profile) {
        this.notificationsService.create({
          userId: profile.userId,
          type: 'MENTOR_SESSION_COMPLETED',
          message: `💸 ₹${mentorPayout} has been paid out for your completed session.`,
          readStatus: false,
          referenceId: sessionId,
        });
      }
    } catch { /* non-critical */ }

    try {
      this.auditService.log({
        action: 'escrow-released',
        actor: 'System',
        target: profile?.name || `Mentor #${session.mentorId}`,
        entityType: 'mentor_session',
        entityId: sessionId,
        event: `Mentor escrow released: ₹${mentorPayout} paid to ${profile?.name || 'mentor'}, ₹${platformFee} platform fee`,
        details: { mentorPayout, platformFee, agreedPrice: session.agreedPrice },
      });
    } catch { /* non-critical */ }

    return this.enrichSession(session);
  }

  cancelSession(sessionId: string, requesterId?: string, isPrivileged = false): MentorSessionEntity {
    const session = this.findSession(sessionId);
    if (!isPrivileged && requesterId && String(session.studentId) !== String(requesterId)) {
      throw new ForbiddenException('Only the project owner who booked this session (or an admin) can cancel it.');
    }
    if (session.status === 'completed') {
      throw new BadRequestException('Cannot cancel a completed session.');
    }
    if (session.status === 'active' && !isPrivileged) {
      throw new ForbiddenException('A mentor cannot leave or be removed once a project has started.');
    }

    this.escrowService.refund(session.escrowId);
    session.status = 'refunded';

    const { totalAmount } = calculateEscrowBreakdown(session.agreedPrice);

    try {
      this.notificationsService.create({
        userId: session.studentId,
        type: 'MENTOR_SESSION_CANCELLED',
        message: `🔴 Your session has been cancelled. ₹${totalAmount} has been refunded.`,
        readStatus: false,
        referenceId: sessionId,
      });
    } catch { /* non-critical */ }

    return this.enrichSession(session);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Review
  // ─────────────────────────────────────────────────────────────────────────
  submitReview(sessionId: string, studentId: string, dto: SubmitReviewDto): MentorReviewEntity {
    const session = this.findSession(sessionId);
    if (session.studentId !== studentId) throw new ForbiddenException('Not your session.');
    if (session.status !== 'completed') throw new BadRequestException('Can only review completed sessions.');

    const alreadyReviewed = this.reviews.find((r) => r.sessionId === sessionId);
    if (alreadyReviewed) throw new BadRequestException('You already reviewed this session.');

    const review: MentorReviewEntity = {
      id: randomUUID(),
      sessionId,
      mentorId: session.mentorId,
      studentId,
      rating: dto.rating,
      comment: dto.comment,
      createdAt: new Date().toISOString(),
    };
    this.reviews.push(review);

    // Recalculate mentor's average rating
    const mentorReviews = this.reviews.filter((r) => r.mentorId === session.mentorId);
    const profile = this.profiles.find((m) => m.id === session.mentorId);
    if (profile && mentorReviews.length > 0) {
      profile.rating = Math.round(
        (mentorReviews.reduce((s, r) => s + r.rating, 0) / mentorReviews.length) * 10,
      ) / 10;
    }

    return review;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle & Safety Net Hooks
  // ─────────────────────────────────────────────────────────────────────────
  onApplicationBootstrap(): void {
    this.syncCompletedProjectSessions();
  }

  syncCompletedProjectSessions(): void {
    for (const session of this.sessions) {
      if (
        session.status === 'active' ||
        session.status === 'escrow_funded' ||
        session.status === 'payout_pending'
      ) {
        try {
          const project = this.projectsRepository.findById(session.projectId);
          if (
            project &&
            (project.isCompleted === true || String(project.status || '').toLowerCase() === 'completed')
          ) {
            session.status = 'active';
            this.completeSession(session.id, undefined, true);
          }
        } catch (err) {
          session.status = 'payout_pending';
          console.error(`Safety net escrow release failed for session ${session.id}:`, err);
        }
      }
    }
  }

  enrichSession(session: MentorSessionEntity): MentorSessionEntity {
    const { platformFee, gatewayFee, totalAmount, mentorPayout } = calculateEscrowBreakdown(session.agreedPrice);
    let ownerName = session.studentId;
    let projectName = session.projectId;
    try {
      const user = this.usersService.findUserSafe(session.studentId);
      if (user) ownerName = user.name;
    } catch { /* ignore */ }
    try {
      const proj = this.projectsRepository.findById(session.projectId);
      if (proj) projectName = proj.title || proj.name || session.projectId;
    } catch { /* ignore */ }

    return {
      ...session,
      platformFee,
      gatewayFee,
      totalAmount: session.totalAmount || totalAmount,
      payout: mentorPayout,
      ownerName,
      projectName,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Queries
  // ─────────────────────────────────────────────────────────────────────────
  getSessionsByStudent(studentId: string): MentorSessionEntity[] {
    return this.sessions
      .filter((s) => String(s.studentId) === String(studentId))
      .map((s) => this.enrichSession(s));
  }

  getSessionsByMentor(mentorUserId: string, isPrivileged = false): MentorSessionEntity[] {
    if (!isPrivileged && !this.isMentorVerified(mentorUserId)) {
      throw new ForbiddenException('Only approved mentors can view mentor sessions.');
    }
    const profile = this.profiles.find((p) => String(p.userId) === String(mentorUserId));
    if (!profile) return [];
    return this.sessions
      .filter((s) => s.mentorId === profile.id)
      .map((s) => this.enrichSession(s));
  }

  getAllSessions(): MentorSessionEntity[] {
    this.syncCompletedProjectSessions();
    return this.sessions.map((s) => this.enrichSession(s));
  }

  getAdminStats() {
    this.syncCompletedProjectSessions();

    const completed = this.sessions.filter((s) => s.status === 'completed');
    const fundedOrActive = this.sessions.filter((s) => s.status === 'escrow_funded' || s.status === 'active');
    const awaitingResponse = this.sessions.filter((s) => s.status === 'escrow_funded');
    const active = this.sessions.filter((s) => s.status === 'active');
    const refunded = this.sessions.filter((s) => s.status === 'refunded');

    // Currently in Escrow = total paid for funded and active sessions
    const escrowHeld = fundedOrActive.reduce((sum, se) => {
      const breakdown = calculateEscrowBreakdown(se.agreedPrice);
      return sum + (se.totalAmount || breakdown.totalAmount);
    }, 0);

    // Platform Revenue = platform fees of released sessions
    const platformRevenue = completed.reduce((sum, se) => {
      const breakdown = calculateEscrowBreakdown(se.agreedPrice);
      return sum + breakdown.platformFee;
    }, 0);

    // Paid Out to Mentors = sum of mentor payouts
    const totalPayouts = completed.reduce((sum, se) => {
      const breakdown = calculateEscrowBreakdown(se.agreedPrice);
      return sum + breakdown.mentorPayout;
    }, 0);

    const totalProcessed = completed.reduce((sum, se) => {
      const breakdown = calculateEscrowBreakdown(se.agreedPrice);
      return sum + (se.totalAmount || breakdown.totalAmount);
    }, 0);

    return {
      totalSessions: this.sessions.length,
      completedSessions: completed.length,
      pendingSessions: awaitingResponse.length,
      activeSessions: active.length,
      refundedSessions: refunded.length,
      totalProcessed,
      platformRevenue,
      totalPayouts,
      escrowHeld,
    };
  }

  getSessionsByProject(projectId: string): MentorSessionEntity[] {
    return this.sessions
      .filter((s) => String(s.projectId) === String(projectId))
      .map((s) => this.enrichSession(s));
  }

  findProfileById(profileId: string): MentorProfileEntity | undefined {
    return this.profiles.find((p) => p.id === profileId);
  }

  releaseEscrowForProject(projectId: string): void {
    const projectSessions = this.sessions.filter(
      (s) =>
        String(s.projectId) === String(projectId) &&
        (s.status === 'active' || s.status === 'escrow_funded' || s.status === 'payout_pending'),
    );
    for (const session of projectSessions) {
      try {
        session.status = 'active';
        this.completeSession(session.id, undefined, true);
      } catch (err) {
        session.status = 'payout_pending';
        // Non-blocking release: a failed release must not break completion
        console.error(`Non-blocking mentor escrow release failed for session ${session.id}:`, err);
      }
    }
  }

  refundEscrowForProject(projectId: string): void {
    const projectSessions = this.sessions.filter(
      (s) =>
        String(s.projectId) === String(projectId) &&
        (s.status === 'active' || s.status === 'escrow_funded' || s.status === 'payout_pending'),
    );
    for (const session of projectSessions) {
      try {
        this.escrowService.refund(session.escrowId);
        session.status = 'refunded';
        const { totalAmount } = calculateEscrowBreakdown(session.agreedPrice);
        const profile = this.profiles.find((m) => m.id === session.mentorId);

        // Notify student / owner
        this.notificationsService.create({
          userId: session.studentId,
          type: 'MENTOR_SESSION_CANCELLED',
          title: 'Project Deleted - Escrow Refunded',
          message: `🔴 Project has been deleted. ₹${totalAmount} mentor escrow has been refunded to your account.`,
          readStatus: false,
          referenceId: session.id,
        });

        // Notify mentor
        if (profile?.userId) {
          this.notificationsService.create({
            userId: profile.userId,
            type: 'PROJECT_DELETED',
            title: 'Project Deleted',
            message: `⚠️ Project #${projectId} has been deleted. The mentorship session has been closed and escrow settled.`,
            readStatus: false,
            referenceId: projectId,
          });
        }
      } catch (err) {
        console.error(`Failed to refund mentor escrow for session ${session.id} on project delete:`, err);
      }
    }
  }

  retryPayout(sessionId: string): MentorSessionEntity {
    const session = this.findSession(sessionId);
    if (session.status !== 'payout_pending' && session.status !== 'active') {
      throw new BadRequestException(`Session is not in payout_pending or active state (current: ${session.status}).`);
    }
    session.status = 'active';
    return this.completeSession(sessionId, undefined, true);
  }

  private findSession(id: string): MentorSessionEntity {
    const s = this.sessions.find((s) => s.id === id);
    if (!s) throw new NotFoundException(`Session ${id} not found`);
    return s;
  }
}
