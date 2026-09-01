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
    this.syncProfiles();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Auto-sync: If a user is a Mentor but has no profile, generate one.
  // ─────────────────────────────────────────────────────────────────────────
  private syncProfiles() {
    const allUsers = this.usersService.findAll();
    const mentors = allUsers.filter((u) => u.role === UserRole.Mentor);

    const defaultMentorMeta: Record<string, Partial<MentorProfileEntity>> = {
      '4': {
        avatar: '🎨',
        title: 'Lead UI/UX Designer & Frontend Architect',
        bio: 'Staff Product Designer with 5+ years crafting intuitive design systems, React UIs, and Figma architectures.',
        skills: ['UI/UX', 'Figma', 'React', 'Design Systems'],
        experienceYears: 5,
        sessionPrice: 599,
        languages: ['English', 'Hindi'],
        rating: 4.9,
        totalSessions: 14,
      },
      '5': {
        avatar: '☁️',
        title: 'Senior Cloud & DevOps Architect',
        bio: 'AWS Certified Solutions Architect helping developers master Kubernetes, CI/CD pipelines, Docker, and scalable microservices.',
        skills: ['DevOps', 'AWS', 'Docker', 'Kubernetes'],
        experienceYears: 6,
        sessionPrice: 799,
        languages: ['English', 'Tamil'],
        rating: 5.0,
        totalSessions: 19,
      },
      '3': {
        avatar: '⚡',
        title: 'Full Stack & Database Specialist',
        bio: 'Specialist in high-performance TypeScript backend architectures, PostgreSQL, Supabase, and real-time APIs.',
        skills: ['TypeScript', 'Supabase', 'NestJS', 'PostgreSQL'],
        experienceYears: 4,
        sessionPrice: 499,
        languages: ['English', 'Bengali'],
        rating: 4.8,
        totalSessions: 8,
      },
    };

    for (const mentor of mentors) {
      if (!this.profiles.find((p) => p.userId === mentor.id)) {
        const meta = defaultMentorMeta[mentor.id] || {};
        this.profiles.push({
          id: randomUUID(),
          userId: mentor.id,
          name: mentor.name,
          avatar: meta.avatar || '🧑‍🏫',
          title: meta.title || 'Expert Mentor',
          bio: meta.bio || 'I love helping students learn and grow.',
          skills: meta.skills || (mentor.skills && mentor.skills.length > 0 ? mentor.skills : ['General Mentorship']),
          experienceYears: meta.experienceYears ?? 3,
          sessionPrice: meta.sessionPrice ?? 499,
          sessionDuration: 60,
          languages: meta.languages || ['English'],
          availability: 'Anytime',
          rating: meta.rating ?? 4.8,
          totalSessions: meta.totalSessions ?? 5,
          isAvailable: true,
          createdAt: new Date().toISOString(),
        });
      }
    }
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
  // Browse — only verified mentors, supports full filter + sort
  // ─────────────────────────────────────────────────────────────────────────
  listMentors(filters: FilterMentorsDto = {}): MentorProfileEntity[] {
    this.syncProfiles(); // Ensure all Mentor users have profiles

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
    this.syncProfiles();
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

  completeSession(sessionId: string): MentorSessionEntity {
    const session = this.findSession(sessionId);
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

    // Notify student to leave a review
    try {
      this.notificationsService.create({
        userId: session.studentId,
        type: 'MENTOR_SESSION_COMPLETED',
        message: `✅ Session completed! ₹${mentorPayout} paid to mentor. Leave a review to help others.`,
        readStatus: false,
        referenceId: sessionId,
      });
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
    this.syncProfiles();
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
    return {
      totalSessions: this.sessions.length,
      completedSessions: completed.length,
      totalProcessed,
      platformRevenue: platformCut,
      totalPayouts: totalProcessed - platformCut,
    };
  }

  private findSession(id: string): MentorSessionEntity {
    const s = this.sessions.find((s) => s.id === id);
    if (!s) throw new NotFoundException(`Session ${id} not found`);
    return s;
  }
}
