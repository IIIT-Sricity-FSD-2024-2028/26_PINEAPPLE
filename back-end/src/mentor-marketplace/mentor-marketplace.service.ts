import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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
import { UserRole } from '../users/dto/create-user.dto';

@Injectable()
export class MentorMarketplaceService {
  private profiles: MentorProfileEntity[] = [];
  private sessions: MentorSessionEntity[] = [];
  private reviews: MentorReviewEntity[] = [];

  constructor(
    private readonly escrowService: EscrowService,
    private readonly payoutsService: PayoutsService,
    private readonly usersService: UsersService,
    private readonly gamificationService: GamificationService,
    private readonly notificationsService: NotificationsService,
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
      rating: 4.9,
      totalSessions: 12,
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
      rating: 4.7,
      totalSessions: 25,
      isAvailable: true,
      createdAt: new Date().toISOString(),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Verify user has Mentor role before exposing their profile
  // ─────────────────────────────────────────────────────────────────────────
  private isMentorVerified(userId: string): boolean {
    try {
      const user = this.usersService.findById(userId);
      return user?.role === UserRole.Mentor;
    } catch {
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Self-service sync: a caller who already presents x-user-role: mentor
  // (i.e. their mentor application was approved through whichever admin
  // pathway granted it) can confirm that same role on their backend user
  // record, so isMentorVerified()/createProfile()/etc. recognize them.
  // Mirrors what MentorApplicationsService.approve() already does directly.
  // ─────────────────────────────────────────────────────────────────────────
  confirmMentorRole(userId: string): { role: string } {
    const user = this.usersService.findById(userId);
    if (user.role !== UserRole.Mentor) {
      this.usersService.update(userId, { role: UserRole.Mentor });
    }
    return { role: UserRole.Mentor };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Browse — only verified mentors, supports full filter + sort
  // ─────────────────────────────────────────────────────────────────────────
  listMentors(filters: FilterMentorsDto = {}): MentorProfileEntity[] {
    let result = this.profiles.filter(
      (m) => m.isAvailable && this.isMentorVerified(m.userId),
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

    // Min rating
    if (filters.minRating !== undefined) {
      result = result.filter((m) => m.rating >= Number(filters.minRating));
    }

    // Sort
    switch (filters.sort) {
      case 'price_asc':  result.sort((a, b) => a.sessionPrice - b.sessionPrice); break;
      case 'price_desc': result.sort((a, b) => b.sessionPrice - a.sessionPrice); break;
      case 'rating':     result.sort((a, b) => b.rating - a.rating); break;
      case 'sessions':   result.sort((a, b) => b.totalSessions - a.totalSessions); break;
      default:
        // Default: top mentors first (4.5+ and 10+ sessions), then rating
        result.sort((a, b) => {
          const aTop = a.rating >= 4.5 && a.totalSessions >= 10 ? 1 : 0;
          const bTop = b.rating >= 4.5 && b.totalSessions >= 10 ? 1 : 0;
          if (aTop !== bTop) return bTop - aTop;
          return b.rating - a.rating;
        });
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
    const existing = this.profiles.find((p) => p.userId === userId);
    if (existing) throw new BadRequestException('You already have a mentor listing.');

    const profile: MentorProfileEntity = {
      id: randomUUID(),
      userId,
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
      rating: 0,
      totalSessions: 0,
      isAvailable: true,
      createdAt: new Date().toISOString(),
    };
    this.profiles.push(profile);
    return profile;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Get the calling mentor's own listing — null if they haven't set one up yet
  // ─────────────────────────────────────────────────────────────────────────
  getMyProfile(userId: string): MentorProfileEntity | null {
    return this.profiles.find((p) => p.userId === userId) ?? null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Edit an existing listing (e.g. change price) — mentor only, own listing
  // ─────────────────────────────────────────────────────────────────────────
  updateProfile(userId: string, dto: UpdateMentorProfileDto): MentorProfileEntity {
    const profile = this.profiles.find((p) => p.userId === userId);
    if (!profile) throw new NotFoundException('Mentor profile not found for this user.');
    Object.assign(profile, dto);
    return profile;
  }

  updateAvailability(userId: string, isAvailable: boolean): MentorProfileEntity {
    const profile = this.profiles.find((p) => p.userId === userId);
    if (!profile) throw new NotFoundException('Mentor profile not found for this user.');
    profile.isAvailable = isAvailable;
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

    const sessionId = randomUUID();
    // First create escrow (links to sessionId)
    const escrow = this.escrowService.fundForSession(sessionId, profile.sessionPrice);

    const session: MentorSessionEntity = {
      id: sessionId,
      mentorId: dto.mentorId,
      studentId,
      projectId: dto.projectId,
      projectDescription: dto.projectDescription,
      agreedPrice: profile.sessionPrice,
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
        message: `📚 A student has booked a session with you! ₹${profile.sessionPrice} is held in escrow.`,
        readStatus: false,
        referenceId: sessionId,
      });
    } catch { /* non-critical */ }

    return { session, escrow };
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
        message: `🟢 Your session with ${profile?.name ?? 'your mentor'} has started!`,
        readStatus: false,
        referenceId: sessionId,
      });
    } catch { /* non-critical */ }

    return session;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Mentor accepts the booking request — grants the mentor access to work
  // with the project owner (frontend wires this into project workspace access).
  // ─────────────────────────────────────────────────────────────────────────
  acceptSession(sessionId: string, mentorUserId: string): MentorSessionEntity {
    const session = this.findSession(sessionId);
    const profile = this.profiles.find((m) => m.id === session.mentorId);
    if (!profile || profile.userId !== mentorUserId) {
      throw new ForbiddenException('This session was not booked with you.');
    }
    if (session.status !== 'escrow_funded') {
      throw new BadRequestException(`Session is already ${session.status}`);
    }
    session.status = 'active';
    session.startedAt = new Date().toISOString();

    try {
      this.notificationsService.create({
        userId: session.studentId,
        type: 'MENTOR_SESSION_ACCEPTED',
        message: `🟢 ${profile.name} accepted your mentor request! You can now access the shared project workspace.`,
        readStatus: false,
        referenceId: sessionId,
      });
    } catch { /* non-critical */ }

    return session;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Mentor declines the booking request — escrow is refunded to the owner.
  // ─────────────────────────────────────────────────────────────────────────
  declineSession(sessionId: string, mentorUserId: string): MentorSessionEntity {
    const session = this.findSession(sessionId);
    const profile = this.profiles.find((m) => m.id === session.mentorId);
    if (!profile || profile.userId !== mentorUserId) {
      throw new ForbiddenException('This session was not booked with you.');
    }
    if (session.status !== 'escrow_funded') {
      throw new BadRequestException(`Session is already ${session.status}`);
    }

    this.escrowService.refund(session.escrowId);
    session.status = 'refunded';

    try {
      this.notificationsService.create({
        userId: session.studentId,
        type: 'MENTOR_SESSION_DECLINED',
        message: `🔴 ${profile.name} declined your mentor request. ₹${session.agreedPrice} has been refunded.`,
        readStatus: false,
        referenceId: sessionId,
      });
    } catch { /* non-critical */ }

    return session;
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

    // Record payout (mentor gets 85% — 15% kept as platform fee)
    const mentorPayout = Math.round(session.agreedPrice * 0.85);
    const profile = this.profiles.find((m) => m.id === session.mentorId);
    this.payoutsService.recordTransaction({
      payerId: 'platform',
      payeeId: profile?.userId ?? session.mentorId,
      amount: mentorPayout,
      type: 'mentor_session_payout',
    });

    // Award XP — mentor gets 100, student gets 25
    try {
      this.gamificationService.awardXp(profile?.userId ?? session.mentorId, 100, 'Mentor session completed');
      this.gamificationService.awardXp(session.studentId, 25, 'Attended mentoring session');
    } catch { /* non-critical */ }

    // Update stats
    if (profile) profile.totalSessions += 1;

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

    return session;
  }

  cancelSession(sessionId: string): MentorSessionEntity {
    const session = this.findSession(sessionId);
    if (session.status === 'completed') {
      throw new BadRequestException('Cannot cancel a completed session.');
    }

    this.escrowService.refund(session.escrowId);
    session.status = 'refunded';

    try {
      this.notificationsService.create({
        userId: session.studentId,
        type: 'MENTOR_SESSION_CANCELLED',
        message: `🔴 Your session has been cancelled. ₹${session.agreedPrice} has been refunded.`,
        readStatus: false,
        referenceId: sessionId,
      });
    } catch { /* non-critical */ }

    return session;
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

    // Award XP for review
    try {
      this.gamificationService.awardXp(studentId, 25, 'Left a mentor review');
    } catch { /* non-critical */ }

    return review;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Queries
  // ─────────────────────────────────────────────────────────────────────────
  getSessionsByStudent(studentId: string): MentorSessionEntity[] {
    return this.sessions.filter((s) => s.studentId === studentId);
  }

  getSessionsByMentor(mentorUserId: string): MentorSessionEntity[] {
    const profile = this.profiles.find((p) => p.userId === mentorUserId);
    if (!profile) return [];
    return this.sessions.filter((s) => s.mentorId === profile.id);
  }

  getAllSessions(): MentorSessionEntity[] {
    return [...this.sessions];
  }

  getAdminStats() {
    const completed = this.sessions.filter((s) => s.status === 'completed');
    const totalProcessed = completed.reduce((s, se) => s + se.agreedPrice, 0);
    const platformCut = Math.round(totalProcessed * 0.15);
    // Escrow is locked for anything awaiting the mentor's response or in
    // progress — released on completion, returned to the owner on decline.
    const held = this.sessions.filter((s) => s.status === 'escrow_funded' || s.status === 'active');
    const escrowHeld = held.reduce((s, se) => s + se.agreedPrice, 0);
    return {
      totalSessions: this.sessions.length,
      completedSessions: completed.length,
      pendingSessions: this.sessions.filter((s) => s.status === 'escrow_funded').length,
      activeSessions: this.sessions.filter((s) => s.status === 'active').length,
      refundedSessions: this.sessions.filter((s) => s.status === 'refunded').length,
      totalProcessed,
      platformRevenue: platformCut,
      totalPayouts: totalProcessed - platformCut,
      escrowHeld,
    };
  }

  private findSession(id: string): MentorSessionEntity {
    const s = this.sessions.find((s) => s.id === id);
    if (!s) throw new NotFoundException(`Session ${id} not found`);
    return s;
  }
}
