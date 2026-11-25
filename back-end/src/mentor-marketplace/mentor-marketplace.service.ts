import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, Inject, forwardRef, OnApplicationBootstrap, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  AbandonmentReviewEntity,
  DisputeDecision,
  MentorAbandonmentIncident,
  MentorProfileEntity,
  MentorProjectActivityRecord,
  MentorReviewEntity,
  MentorSessionEntity,
  MentoredProjectItem,
  MentoredProjectsResponse,
  SessionDisputeEntity,
  SessionFeedbackEntity,
} from './entities/mentor-marketplace.entity';
import {
  BookSessionDto,
  CreateMentorProfileDto,
  FilterMentorsDto,
  SubmitReviewDto,
  UpdateMentorProfileDto,
} from './dto/mentor-marketplace.dto';
import { EscrowService } from '../escrow/escrow.service';
import { DemoUpiProvider } from './payments/demo-upi.provider';
import { PaymentIntent } from './payments/payment-provider.interface';
import { PayoutsService } from '../payouts/payouts.service';
import { UsersService } from '../users/users.service';
import { GamificationService } from '../gamification/gamification.service';
import {
  NotificationsService,
  NotificationGroupedItem,
  dispatchGroupedNotification,
  formatGroupedItemList,
} from '../notifications/notifications.service';
import { MentorApplicationsService } from '../mentor-applications/mentor-applications.service';
import { UserRole } from '../users/dto/create-user.dto';
import { ProjectsRepository } from '../projects/projects.repository';
import { AuditService } from '../audit/audit.service';
import { isProjectOwner, normalizeRole, getProjectRole } from '../common/utils/role.util';
import { ClockService } from '../common/services/clock.service';
import { isLiveProject } from '../projects/project-visibility.util';
import { FeedbackService } from '../feedback/feedback.service';
import { validateMentorPrice } from './mentor-marketplace.config';

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
export const PAYMENT_PENDING_EXPIRY_MS = 30 * 60 * 1000;
export const BLOCKING_BOOKING_STATUSES = new Set<string>([
  'pending',
  'payment_pending',
  'escrow_funded',
  'accepted',
  'active',
]);

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
  private mentorActivities: MentorProjectActivityRecord[] = [];
  private abandonmentReviews: AbandonmentReviewEntity[] = [];
  private sessionFeedbacks: SessionFeedbackEntity[] = [];
  private mentorAbandonmentHistory: MentorAbandonmentIncident[] = [];
  private disputes: SessionDisputeEntity[] = [];
  private sessionQueues: Map<string, Promise<void>> = new Map();

  private hasOpenDispute(sessionId: string): boolean {
    return this.disputes.some(
      (d) => String(d.sessionId) === String(sessionId) && d.status === 'open',
    );
  }

  private findDisputeForSession(sessionId: string): SessionDisputeEntity | undefined {
    return this.disputes.find((d) => String(d.sessionId) === String(sessionId));
  }

  private runInSessionQueue<T>(sessionId: string, fn: () => Promise<T>): Promise<T> {
    return this.runInQueueKey(`session:${String(sessionId)}`, fn);
  }

  private runInQueueKey<T>(queueKey: string, fn: () => Promise<T>): Promise<T> {
    const key = String(queueKey);
    const prev = this.sessionQueues.get(key) || Promise.resolve();
    const resultPromise = prev.then(() => fn());
    const tail = resultPromise.then(
      () => undefined,
      () => undefined,
    );
    this.sessionQueues.set(key, tail);
    return resultPromise;
  }

  private async runWithBookingLocks<T>(keys: string[], fn: () => Promise<T>): Promise<T> {
    const uniqueSortedKeys = Array.from(
      new Set(keys.filter((k) => Boolean(k && String(k).trim()))),
    ).sort();
    const invoke = (idx: number): Promise<T> => {
      if (idx >= uniqueSortedKeys.length) {
        return fn();
      }
      return this.runInQueueKey(uniqueSortedKeys[idx], () => invoke(idx + 1));
    };
    return invoke(0);
  }

  constructor(
    private readonly escrowService: EscrowService,
    private readonly payoutsService: PayoutsService,
    private readonly usersService: UsersService,
    private readonly gamificationService: GamificationService,
    private readonly notificationsService: NotificationsService,
    private readonly mentorApplicationsService: MentorApplicationsService,
    @Inject(forwardRef(() => ProjectsRepository))
    private readonly projectsRepository: any,
    private readonly auditService: AuditService,
    private readonly paymentProvider: DemoUpiProvider,
    @Optional() private readonly clockService?: ClockService,
    @Optional() private readonly feedbackService?: FeedbackService,
  ) {
    this.initSeeds();
  }

  private initSeeds(): void {
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
      languages: ['English', 'Hindi'],
      isAvailable: true,
      maxActiveMentees: 3,
      createdAt: this.getCurrentIso(),
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
      languages: ['English'],
      isAvailable: true,
      maxActiveMentees: 3,
      createdAt: this.getCurrentIso(),
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
      languages: ['English', 'Bengali'],
      isAvailable: true,
      maxActiveMentees: 3,
      createdAt: this.getCurrentIso(),
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
      languages: ['English', 'Tamil'],
      isAvailable: true,
      maxActiveMentees: 3,
      createdAt: this.getCurrentIso(),
    });

    // Seed canonical active sessions matching seeded projects
    const session1Id = 'session-proj-1-kiran';
    const escrow1 = this.escrowService.fundForSession(session1Id, 2000);
    const b1 = calculateEscrowBreakdown(2000);
    this.sessions.push({
      id: session1Id,
      mentorId: 'mentor-profile-3',
      studentId: '1',
      projectId: 'proj-1',
      projectDescription: 'Full-stack architecture and ML integration guidance',
      agreedPrice: 2000,
      platformFee: b1.platformFee,
      gatewayFee: b1.gatewayFee,
      totalAmount: escrow1.totalFunded,
      payout: b1.mentorPayout,
      escrowId: escrow1.id,
      status: 'active',
      createdAt: '2026-10-01T10:00:00.000Z',
      startedAt: '2026-10-02T10:00:00.000Z',
    });

    const session2Id = 'session-proj-2-rohan';
    const escrow2 = this.escrowService.fundForSession(session2Id, 800);
    const b2 = calculateEscrowBreakdown(800);
    this.sessions.push({
      id: session2Id,
      mentorId: 'mentor-profile-2',
      studentId: '2',
      projectId: 'proj-2',
      projectDescription: 'UI/UX design system and accessibility review',
      agreedPrice: 800,
      platformFee: b2.platformFee,
      gatewayFee: b2.gatewayFee,
      totalAmount: escrow2.totalFunded,
      payout: b2.mentorPayout,
      escrowId: escrow2.id,
      status: 'active',
      createdAt: '2026-10-05T10:00:00.000Z',
      startedAt: '2026-10-06T10:00:00.000Z',
    });

    // Seed an intentional duplicate live session for proj-2 to demonstrate startup reconciliation
    const sessionDupId = 'session-proj-2-dup';
    const escrowDup = this.escrowService.fundForSession(sessionDupId, 1500);
    const bDup = calculateEscrowBreakdown(1500);
    this.sessions.push({
      id: sessionDupId,
      mentorId: 'mentor-profile-1',
      studentId: '2',
      projectId: 'proj-2',
      projectDescription: 'Duplicate booking attempt',
      agreedPrice: 1500,
      platformFee: bDup.platformFee,
      gatewayFee: bDup.gatewayFee,
      totalAmount: escrowDup.totalFunded,
      payout: bDup.mentorPayout,
      escrowId: escrowDup.id,
      status: 'escrow_funded',
      createdAt: '2026-10-15T12:00:00.000Z',
      respondBy: '2026-10-18T12:00:00.000Z',
    });
  }

  resetToSeed(): void {
    this.profiles = [];
    this.sessions = [];
    this.reviews = [];
    this.mentorActivities = [];
    this.abandonmentReviews = [];
    this.sessionFeedbacks = [];
    this.mentorAbandonmentHistory = [];
    this.disputes = [];
    this.sessionQueues.clear();
    this.initSeeds();
    this.reconcileDuplicateSessionsOnStartup({ silent: true });
    this.syncCompletedProjectSessions();
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
    } catch (err: any) {
        console.warn('[mentor-marketplace.service] Suppressed non-critical error:', err?.message || err);
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
    } catch (err: any) {
        console.warn('[mentor-marketplace.service] Suppressed non-critical error:', err?.message || err);
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
    } catch (err: any) {
        console.warn('[mentor-marketplace.service] Suppressed non-critical error:', err?.message || err);
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
      (m) =>
        !(m as any).isDeleted &&
        Boolean(m.isAvailable) &&
        Number(m.sessionPrice) > 0 &&
        this.isMentorVerified(m.userId) &&
        !this.isMentorUserSuspended(m.userId),
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

    // Sort
    switch (filters.sort) {
      case 'price_asc':  result.sort((a, b) => a.sessionPrice - b.sessionPrice); break;
      case 'price_desc': result.sort((a, b) => b.sessionPrice - a.sessionPrice); break;
      default:
        result.sort((a, b) => b.sessionPrice - a.sessionPrice);
    }

    return result.map((m) => this.enrichProfile(m));
  }

  getActiveMenteeCount(profile: MentorProfileEntity, excludeSessionId?: string): number {
    this.expireStalePaymentPendingSessions();
    const activeProjectKeys = new Set<string>();
    const pid = String(profile.id);
    const uid = String(profile.userId);
    const excludedSession = excludeSessionId
      ? this.sessions.find((s) => String(s.id) === String(excludeSessionId))
      : undefined;

    for (const s of this.sessions) {
      if (excludeSessionId && String(s.id) === String(excludeSessionId)) continue;
      if (String(s.mentorId) !== pid && String(s.mentorId) !== uid) continue;
      if (s.status === 'active' || s.status === 'escrow_funded' || s.status === 'payment_pending') {
        activeProjectKeys.add(s.projectId ? String(s.projectId) : `session:${s.id}`);
      }
    }

    try {
      const allProjects = typeof this.projectsRepository?.findAll === 'function'
        ? this.projectsRepository.findAll()
        : [];
      for (const proj of allProjects) {
        if (!proj || String(proj.mentorId) !== uid) continue;
        if (excludedSession?.projectId && String(proj.id) === String(excludedSession.projectId)) continue;
        const st = String(proj.status || '').toLowerCase();
        if (proj.isCompleted || st === 'completed' || st === 'closed' || st === 'cancelled') continue;
        activeProjectKeys.add(String(proj.id));
      }
    } catch {}

    return activeProjectKeys.size;
  }

  private clampMaxActiveMentees(raw?: number, fallback = 3): number {
    if (raw === undefined || raw === null) return fallback;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > 10) {
      throw new BadRequestException('maxActiveMentees must be an integer between 1 and 10.');
    }
    return n;
  }

  enrichProfile(profile: MentorProfileEntity): MentorProfileEntity {
    const maxActiveMentees = profile.maxActiveMentees ?? 3;
    const activeMenteesCount = this.getActiveMenteeCount(profile);
    const isFull = activeMenteesCount >= maxActiveMentees;
    let university = profile.university;
    try {
      const u = this.usersService.findById(profile.userId);
      if (u && (u.university || u.profile?.university || u.profile?.uni)) {
        university = u.university || u.profile?.university || u.profile?.uni;
      }
    } catch {}

    const feedbackList = this.sessionFeedbacks.filter(
      (f) => String(f.mentorId) === String(profile.id) || String(f.mentorUserId) === String(profile.userId),
    );
    const aggregateRating = feedbackList.length > 0
      ? Math.round((feedbackList.reduce((sum, f) => sum + f.rating, 0) / feedbackList.length) * 10) / 10
      : profile.rating;

    return {
      ...profile,
      university,
      rating: aggregateRating,
      maxActiveMentees,
      activeMenteesCount,
      isFull,
    };
  }

  getMentor(id: string): { profile: MentorProfileEntity; reviews: MentorReviewEntity[] } {
    const profile = this.profiles.find((m) => m.id === id);
    if (!profile) throw new NotFoundException(`Mentor profile ${id} not found`);
    // Public mentor endpoint never exposes individual session feedback comments or student identities
    return { profile: this.enrichProfile(profile), reviews: [] };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Create mentor listing — only if user has Mentor role
  // ─────────────────────────────────────────────────────────────────────────
  createProfile(userId: string, dto: CreateMentorProfileDto): MentorProfileEntity {
    if ((dto as any)?.username !== undefined || (dto as any)?.profile?.username !== undefined) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'USERNAME_IMMUTABLE',
        message: "Your username can't be changed.",
      });
    }
    if (!this.isMentorVerified(userId)) {
      throw new ForbiddenException(
        'Only approved mentors (role: Mentor) can create a listing. Apply via the "Become a Mentor" form first.',
      );
    }
    dto.sessionPrice = validateMentorPrice(dto.sessionPrice);
    const maxActiveMentees = this.clampMaxActiveMentees(dto.maxActiveMentees, 3);
    const existing = this.profiles.find((p) => String(p.userId) === String(userId));
    if (existing) {
      Object.assign(existing, dto);
      existing.maxActiveMentees = dto.maxActiveMentees !== undefined ? maxActiveMentees : (existing.maxActiveMentees ?? 3);
      if (dto.isAvailable !== undefined) {
        existing.isAvailable = Boolean(dto.isAvailable);
      }
      return this.enrichProfile(existing);
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
      languages: dto.languages ?? ['English'],
      isAvailable: dto.isAvailable !== undefined ? Boolean(dto.isAvailable) : true,
      maxActiveMentees,
      createdAt: this.getCurrentIso(),
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
        details: { sessionPrice: profile.sessionPrice, isAvailable: profile.isAvailable, maxActiveMentees },
      });
    } catch (err: any) {
        console.warn('[mentor-marketplace.service] Suppressed non-critical error:', err?.message || err);
      }

    return this.enrichProfile(profile);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Get the calling mentor's own listing — null if they haven't set one up yet
  // ─────────────────────────────────────────────────────────────────────────
  getMyProfile(userId: string): MentorProfileEntity | null {
    if (!this.isMentorVerified(userId)) {
      throw new ForbiddenException('Only approved mentors can access mentor listing profile.');
    }
    const found = this.profiles.find((p) => String(p.userId) === String(userId));
    return found ? this.enrichProfile(found) : null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Edit an existing listing (e.g. change price) — mentor only, own listing
  // ─────────────────────────────────────────────────────────────────────────
  updateProfile(userId: string, dto: UpdateMentorProfileDto): MentorProfileEntity {
    if ((dto as any)?.username !== undefined || (dto as any)?.profile?.username !== undefined) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'USERNAME_IMMUTABLE',
        message: "Your username can't be changed.",
      });
    }
    if (!this.isMentorVerified(userId)) {
      throw new ForbiddenException('Only approved mentors can update a mentor listing.');
    }
    if (dto.sessionPrice !== undefined) {
      dto.sessionPrice = validateMentorPrice(dto.sessionPrice);
    }
    const maxMenteesParsed = dto.maxActiveMentees !== undefined ? this.clampMaxActiveMentees(dto.maxActiveMentees) : undefined;
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
        languages: dto.languages ?? ['English'],
        isAvailable: dto.isAvailable !== undefined ? Boolean(dto.isAvailable) : true,
        maxActiveMentees: maxMenteesParsed ?? 3,
        createdAt: this.getCurrentIso(),
      };
      this.profiles.push(profile);
    } else {
      Object.assign(profile, dto);
      if (maxMenteesParsed !== undefined) {
        profile.maxActiveMentees = maxMenteesParsed;
      }
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
        details: { sessionPrice: profile.sessionPrice, isAvailable: profile.isAvailable, maxActiveMentees: profile.maxActiveMentees ?? 3 },
      });
    } catch (err: any) {
        console.warn('[mentor-marketplace.service] Suppressed non-critical error:', err?.message || err);
      }

    return this.enrichProfile(profile);
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
        languages: ['English'],
        isAvailable: Boolean(isAvailable),
        createdAt: this.getCurrentIso(),
      };
      this.profiles.push(profile);
      return profile;
    }
    profile.isAvailable = Boolean(isAvailable);
    return profile;
  }

  private readonly inFlightBookings = new Set<string>();

  isSessionLive(session: MentorSessionEntity): boolean {
    return (
      session.status === 'active' ||
      session.status === 'escrow_funded' ||
      session.status === 'payment_pending'
    );
  }

  getActiveOrPendingSessionForProject(projectId: string): MentorSessionEntity | undefined {
    this.expireStalePaymentPendingSessions();
    return this.sessions.find(
      (s) => String(s.projectId) === String(projectId) && this.isSessionLive(s),
    );
  }

  private isUserProjectMember(project: any, userId: string): boolean {
    if (!project || !userId) return false;
    const uid = String(userId);
    const matchesEntry = (entry: any): boolean => {
      if (!entry) return false;
      if (typeof entry === 'string') return entry === uid;
      if (String(entry.status || '').toLowerCase() === 'removed') return false;
      const candidateId = entry.userId || entry.id || entry.uid;
      return candidateId !== undefined && candidateId !== null && String(candidateId) === uid;
    };
    const collabs = Array.isArray(project.collaborators) ? project.collaborators : [];
    if (collabs.some(matchesEntry)) return true;
    const members = Array.isArray(project.members) ? project.members : [];
    return members.some((m: any) => {
      if (!matchesEntry(m)) return false;
      return String(m?.role || '').toLowerCase() !== 'owner';
    });
  }

  private isMentorUserSuspended(userId?: string): boolean {
    if (!userId) return false;
    const uid = String(userId);
    let user: any;
    try {
      user = this.usersService?.findById(uid);
    } catch {
      user = undefined;
    }
    if (!user) {
      try {
        const all = this.usersService?.findAll?.() || [];
        user = all.find((u: any) => String(u.id) === uid);
      } catch {
        user = undefined;
      }
    }
    if (!user) return false;
    const statusLower = String(user.status || '').toLowerCase().trim();
    return statusLower === 'suspended' || statusLower === 'banned' || Boolean(user.isSuspended);
  }

  private getNonBookableProjectReason(project: any): string {
    if (!project) return 'Project was not found.';
    if (project.deletedAt) return 'Project has been soft-deleted.';
    if (project.isCompleted === true) return 'Project is already Completed.';
    const statusLower = String(project.status || '').toLowerCase().trim();
    if (statusLower === 'closed') return 'Project is Closed.';
    if (statusLower === 'completed') return 'Project is already Completed.';
    if (statusLower === 'cancelled') return 'Project is Cancelled.';
    return 'Project is not in a live, bookable state.';
  }

  private logBookingRefused(
    code: string,
    projectId: string,
    mentorId: string,
    ownerId: string,
    reason: string,
    extra?: Record<string, any>,
  ): void {
    try {
      this.auditService.log({
        action: 'BOOKING_REFUSED',
        actor: `User #${ownerId}`,
        target: `Mentor #${mentorId}`,
        entityType: 'mentor_session',
        entityId: String(projectId || mentorId),
        event: `BOOKING_REFUSED (${code}): ${reason}`,
        details: {
          code,
          projectId,
          mentorId,
          ownerId,
          ...(extra || {}),
        },
      });
    } catch (err: any) {
      console.warn('[mentor-marketplace.service] Suppressed non-critical error:', err?.message || err);
    }
  }

  /**
   * Canonical Phase 25 booking integrity validator.
   * Checks in exact order:
   * 1) project live, 2) not self, 3) not project member,
   * 4) mentor active/available/not suspended/not at capacity,
   * 5) time window, 6) mentor time overlap, 7) owner time overlap.
   */
  assertBookable(
    projectId: string,
    mentorId: string,
    ownerId: string,
    excludeSessionId?: string,
  ): { project: any; profile: MentorProfileEntity } {
    const profile = this.profiles.find(
      (m) => String(m.id) === String(mentorId) || String(m.userId) === String(mentorId),
    );
    if (!profile) {
      throw new NotFoundException('Mentor not found');
    }

    const project = this.projectsRepository.findById(projectId, true);
    if (!project || !isLiveProject(project)) {
      const reason = this.getNonBookableProjectReason(project);
      this.logBookingRefused('PROJECT_NOT_BOOKABLE', projectId, profile.id, ownerId, reason);
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'PROJECT_NOT_BOOKABLE',
        message: `Cannot book mentorship: ${reason}`,
      });
    }

    const mentorUserId = String(profile.userId);
    const existingRole = getProjectRole(project, mentorUserId);
    if (
      existingRole === 'Owner' ||
      existingRole === 'Collaborator' ||
      String(mentorUserId) === String(ownerId) ||
      (project.ownerId && String(mentorUserId) === String(project.ownerId)) ||
      this.isUserProjectMember(project, mentorUserId)
    ) {
      const msg = 'A project owner or active collaborator cannot be booked as mentor on the same project.';
      this.logBookingRefused('MENTOR_IS_PROJECT_MEMBER', projectId, profile.id, ownerId, msg);
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'MENTOR_IS_PROJECT_MEMBER',
        message: msg,
      });
    }

    if (this.isMentorUserSuspended(profile.userId)) {
      const msg = 'This mentor account is suspended and cannot be booked.';
      this.logBookingRefused('MENTOR_SUSPENDED', projectId, profile.id, ownerId, msg);
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'MENTOR_SUSPENDED',
        message: msg,
      });
    }

    if (!this.isMentorVerified(profile.userId)) {
      const msg = 'This mentor is not verified.';
      this.logBookingRefused('MENTOR_NOT_VERIFIED', projectId, profile.id, ownerId, msg);
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'MENTOR_NOT_VERIFIED',
        message: msg,
      });
    }

    if (!profile.isAvailable) {
      const msg = 'This mentor is currently unavailable.';
      this.logBookingRefused('MENTOR_UNAVAILABLE', projectId, profile.id, ownerId, msg);
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'MENTOR_UNAVAILABLE',
        message: msg,
      });
    }

    const maxMentees = profile.maxActiveMentees ?? 3;
    const activeMentees = this.getActiveMenteeCount(profile, excludeSessionId);
    if (activeMentees >= maxMentees) {
      const msg = `Mentor "${profile.name}" is at full active mentee capacity (${activeMentees}/${maxMentees}).`;
      this.logBookingRefused('MENTOR_AT_CAPACITY', projectId, profile.id, ownerId, msg);
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'MENTOR_AT_CAPACITY',
        message: msg,
      });
    }

    return { project, profile };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Book a session — creates escrow, records session
  // ─────────────────────────────────────────────────────────────────────────
  async bookSession(studentId: string, dto: BookSessionDto): Promise<{ session: MentorSessionEntity; paymentIntent: PaymentIntent }> {
    const profile = this.profiles.find(
      (m) => String(m.id) === String(dto.mentorId) || String(m.userId) === String(dto.mentorId),
    );
    if (!profile) throw new NotFoundException('Mentor not found');

    if (!dto.projectId) {
      throw new BadRequestException('Project ID is required to book a mentor.');
    }

    const project = this.projectsRepository.findById(dto.projectId, true);
    if (!project) {
      throw new NotFoundException(`Project ${dto.projectId} not found.`);
    }

    // Verify caller is the owner of the project (by verified UID)
    const isOwner = isProjectOwner(project, studentId) || String(project.ownerId) === String(studentId);
    if (!isOwner) {
      throw new ForbiddenException('You can only book mentors for projects that you own.');
    }

    return this.runWithBookingLocks(
      [`mentor:${profile.userId}`, `owner:${studentId}`, `project:${dto.projectId}`],
      async () => {
        this.expireStalePaymentPendingSessions();

        const validated = this.assertBookable(
          dto.projectId,
          profile.id,
          studentId,
        );

        // Phase 6 & 7: A project can have at most ONE mentor session in pending/active state
        if (this.inFlightBookings.has(dto.projectId)) {
          throw new ConflictException('This project already has an active or pending mentor session.');
        }

        const existingLive = this.getActiveOrPendingSessionForProject(dto.projectId);
        const hasExistingMentor = Boolean(validated.project.mentorId);
        if (existingLive || hasExistingMentor) {
          throw new ConflictException('This project already has an active or pending mentor session.');
        }

        this.inFlightBookings.add(dto.projectId);
        try {
          const sessionId = randomUUID();
          const breakdown = calculateEscrowBreakdown(profile.sessionPrice);

          // Create Payment Intent with 30-minute hold (via ClockService)
          const paymentIntent = await this.paymentProvider.createPaymentIntent(sessionId, breakdown.totalAmount);

          const respondBy = new Date(this.getCurrentMs() + 3 * 24 * 60 * 60 * 1000).toISOString();

          const session: MentorSessionEntity = {
            id: sessionId,
            mentorId: profile.id,
            studentId,
            projectId: dto.projectId,
            projectDescription: dto.projectDescription,
            agreedPrice: profile.sessionPrice,
            platformFee: breakdown.platformFee,
            gatewayFee: breakdown.gatewayFee,
            totalAmount: breakdown.totalAmount,
            payout: breakdown.mentorPayout,
            escrowId: '', // Escrow funded only after payment confirmation
            status: 'payment_pending',
            paymentIntentId: paymentIntent.id,
            paymentExpiresAt: paymentIntent.expiresAt,
            upiUri: paymentIntent.upiUri,
            payeeVpa: paymentIntent.payeeVpa,
            createdAt: this.getCurrentIso(),
            respondBy,
          };
          this.sessions.push(session);

          try {
            this.auditService.log({
              action: 'payment-intent-created',
              actor: `User #${studentId}`,
              target: profile.name,
              entityType: 'mentor_session',
              entityId: sessionId,
              event: `Demo payment intent generated for ${profile.name} (₹${breakdown.totalAmount})`,
              details: { price: profile.sessionPrice, totalAmount: breakdown.totalAmount, projectId: dto.projectId, upiUri: paymentIntent.upiUri },
            });
          } catch (err: any) {
            console.warn('[mentor-marketplace.service] Suppressed non-critical error:', err?.message || err);
          }

          return { session: this.enrichSession(session), paymentIntent };
        } finally {
          this.inFlightBookings.delete(dto.projectId);
        }
      },
    );
  }

  async createBooking(studentId: string, dto: BookSessionDto): Promise<{ session: MentorSessionEntity; paymentIntent: PaymentIntent }> {
    return this.bookSession(studentId, dto);
  }

  async confirmPayment(
    sessionId: string,
    studentId: string,
    isPrivileged = false,
    idempotencyKey?: string,
  ): Promise<{ session: MentorSessionEntity; escrow: any }> {
    const initialSession = this.findSession(sessionId);
    const initialProfile = this.profiles.find(
      (m) => String(m.id) === String(initialSession.mentorId) || String(m.userId) === String(initialSession.mentorId),
    );
    const mentorUserKey = initialProfile?.userId || this.resolveMentorUserId(initialSession.mentorId);

    return this.runWithBookingLocks(
      [`session:${sessionId}`, `mentor:${mentorUserKey}`, `owner:${initialSession.studentId}`],
      async () => {
        this.expireStalePaymentPendingSessions();

        const session = this.findSession(sessionId);

        // Caller authorization
        if (!isPrivileged && String(session.studentId) !== String(studentId)) {
          throw new ForbiddenException('Only the project owner who booked this session can confirm payment.');
        }

        if (session.projectId) {
          const project = this.projectsRepository.findById(session.projectId, true);
          if (project) {
            const role = getProjectRole(project, mentorUserKey);
            if (role === 'Owner' || role === 'Collaborator') {
              throw new ConflictException({
                statusCode: 409,
                error: 'Conflict',
                code: 'MENTOR_IS_PROJECT_MEMBER',
                message: 'A project owner or active collaborator cannot be booked as mentor on the same project.',
              });
            }
          }
        }

        // Phase 9 Idempotency Check:
        // Stored { sessionId, key, result } in demo payment provider layer.
        const existingRecord = this.paymentProvider.getIdempotencyRecord?.(sessionId);

        // If session is already paid and funded:
        if (session.status === 'escrow_funded' || session.status === 'active' || session.status === 'completed') {
          if (existingRecord && idempotencyKey && existingRecord.key === idempotencyKey) {
            // Same key on the same session returns the original result with 200 and never charges twice
            return existingRecord.result;
          }
          // Different key or missing key on an already paid session returns 409 ALREADY_PAID
          throw new ConflictException({
            statusCode: 409,
            error: 'Conflict',
            code: 'ALREADY_PAID',
            message: 'This session has already been paid for.',
          });
        }

        if (session.status === 'cancelled') {
          throw new BadRequestException('This payment session was cancelled. Please book again.');
        }
        if (session.status !== 'payment_pending') {
          throw new BadRequestException(`Cannot confirm payment for session in status '${session.status}'.`);
        }

        const nowMs = this.getCurrentMs();
        const createdMs = new Date(session.createdAt || 0).getTime();
        if (
          (session.paymentExpiresAt && new Date(session.paymentExpiresAt).getTime() <= nowMs) ||
          (createdMs > 0 && nowMs - createdMs >= PAYMENT_PENDING_EXPIRY_MS)
        ) {
          session.status = 'cancelled';
          session.declineReason = 'Payment not completed';
          throw new BadRequestException('Payment window has expired (30 minutes limit). Please book again.');
        }

        const profile = this.profiles.find(
          (m) => String(m.id) === String(session.mentorId) || String(m.userId) === String(session.mentorId),
        );

        // Phase 25: Re-verify project live state, self/collaborator rules, and capacity before charging
        if (session.projectId) {
          this.assertBookable(
            session.projectId,
            session.mentorId,
            session.studentId,
            session.id,
          );
        }

        const isVerified = await this.paymentProvider.verifyPayment(session.paymentIntentId || session.id);
        if (!isVerified) {
          throw new BadRequestException('Payment verification failed.');
        }

        // Fund escrow ONCE
        const escrow = this.escrowService.fundForSession(session.id, session.agreedPrice);
        session.escrowId = escrow.id;
        session.totalAmount = escrow.totalFunded;
        session.status = 'escrow_funded';

        // Notify mentor
        try {
          this.notificationsService.create({
            userId: profile?.userId || session.mentorId,
            type: 'MENTOR_SESSION_BOOKED',
            title: 'Mentor Booking Confirmed',
            message: `📚 A student has funded a mentorship session! ₹${session.agreedPrice} is secured in escrow.`,
            readStatus: false,
            referenceId: session.id,
          });
        } catch (err: any) {
          console.warn('[mentor-marketplace.service] Suppressed non-critical error:', err?.message || err);
        }

        // Audit log
        try {
          this.auditService.log({
            action: 'payment-confirmed-escrow-funded',
            actor: `User #${studentId}`,
            target: profile?.name || 'Mentor',
            entityType: 'mentor_session',
            entityId: session.id,
            event: `Demo payment confirmed: ₹${session.totalAmount} secured in escrow for project #${session.projectId}`,
            details: {
              agreedPrice: session.agreedPrice,
              totalAmount: session.totalAmount,
              projectId: session.projectId,
              escrowId: escrow.id,
              isDemoPayment: true,
              idempotencyKey: idempotencyKey || null,
            },
          });
        } catch (err: any) {
          console.warn('[mentor-marketplace.service] Suppressed non-critical error:', err?.message || err);
        }

        const result = { session: this.enrichSession(session), escrow };
        if (idempotencyKey) {
          this.paymentProvider.saveIdempotencyRecord?.(sessionId, idempotencyKey, result);
        }
        return result;
      },
    );
  }

  cancelPayment(sessionId: string, studentId: string, isPrivileged = false): MentorSessionEntity {
    const session = this.findSession(sessionId);
    if (!isPrivileged && String(session.studentId) !== String(studentId)) {
      throw new ForbiddenException('Only the project owner who booked this session can cancel it.');
    }

    if (session.status !== 'payment_pending') {
      throw new BadRequestException(`Cannot cancel payment for session in status '${session.status}'.`);
    }

    session.status = 'cancelled';
    session.declineReason = 'Payment cancelled by owner';
    try {
      this.paymentProvider.cancelPayment(session.paymentIntentId || session.id);
    } catch (err: any) {
      console.warn('[mentor-marketplace.service] Suppressed non-critical error:', err?.message || err);
    }

    try {
      this.auditService.log({
        action: 'payment-cancelled',
        actor: `User #${studentId}`,
        target: `Session #${sessionId}`,
        entityType: 'mentor_session',
        entityId: sessionId,
        event: `Payment cancelled by owner for project #${session.projectId}. Project hold released.`,
        details: { projectId: session.projectId, status: 'cancelled' },
      });
    } catch (err: any) {
      console.warn('[mentor-marketplace.service] Suppressed non-critical error:', err?.message || err);
    }

    return this.enrichSession(session);
  }

  expireStalePaymentPendingSessions(): { expiredSessions: string[]; skippedNotLive: number } {
    const now = this.getCurrentMs();
    const expiredSessions: string[] = [];
    let skippedNotLive = 0;
    const expiredByStudent = new Map<string, { items: NotificationGroupedItem[]; firstSessionId: string }>();
    for (const session of this.sessions) {
      if (session.status === 'payment_pending') {
        if (session.projectId && typeof this.projectsRepository?.findById === 'function') {
          const project = this.projectsRepository.findById(session.projectId, true);
          if (!isLiveProject(project)) {
            skippedNotLive += 1;
            continue;
          }
        }
        const createdMs = new Date(session.createdAt || 0).getTime();
        const expiresAtMs = session.paymentExpiresAt
          ? new Date(session.paymentExpiresAt).getTime()
          : createdMs + PAYMENT_PENDING_EXPIRY_MS;
        if (expiresAtMs <= now || (createdMs > 0 && now - createdMs >= PAYMENT_PENDING_EXPIRY_MS)) {
          session.status = 'cancelled';
          session.declineReason = 'Payment not completed';
          expiredSessions.push(session.id);
          try {
            this.paymentProvider.cancelPayment(session.paymentIntentId || session.id);
          } catch (err: any) {
            console.warn('[mentor-marketplace.service] Suppressed non-critical error:', err?.message || err);
          }

          const uid = String(session.studentId);
          if (!expiredByStudent.has(uid)) {
            expiredByStudent.set(uid, { items: [], firstSessionId: session.id });
          }
          expiredByStudent.get(uid)!.items.push({
            label: `Project #${session.projectId}`,
            link: `/owner/mentors`,
          });

          try {
            this.auditService.log({
              action: 'payment-expired',
              actor: 'System',
              target: `Session #${session.id}`,
              entityType: 'mentor_session',
              entityId: session.id,
              event: `Payment not completed within 30 minutes for session #${session.id}. Project hold released.`,
              details: { projectId: session.projectId, status: 'cancelled', reason: 'Payment not completed' },
            });
          } catch (err: any) {
            console.warn('[mentor-marketplace.service] Suppressed non-critical error:', err?.message || err);
          }

          console.log(`[Payment Expiry] Session ${session.id} for project ${session.projectId} expired and was cancelled.`);
        }
      }
    }

    const expKey = new Date(now).toISOString().slice(0, 16);
    for (const [studentId, bucket] of expiredByStudent.entries()) {
      try {
        dispatchGroupedNotification(
          this.notificationsService,
          studentId,
          `payment_expired:${expKey}`,
          bucket.items,
          (groupedItems, count) => ({
            type: 'MENTOR_SESSION_CANCELLED',
            title: count > 1 ? `Payment Holds Expired (${count})` : 'Payment Hold Expired',
            message:
              count === 1
                ? `Payment not completed within 30 minutes for ${groupedItems[0].label}. Hold released. You can book again.`
                : `Payment not completed within 30 minutes for ${count} bookings (holds released): ${formatGroupedItemList(groupedItems, 10)}`,
            readStatus: false,
            referenceId: bucket.firstSessionId,
            link: '/owner/mentors',
          }),
        );
      } catch (err: any) {
        console.warn('[mentor-marketplace.service] Suppressed non-critical error:', err?.message || err);
      }
    }

    return { expiredSessions, skippedNotLive };
  }

  startSession(sessionId: string): MentorSessionEntity {
    const session = this.findSession(sessionId);
    if (session.status !== 'escrow_funded') {
      throw new BadRequestException(`Session is already ${session.status}`);
    }
    const nowIso = this.getCurrentIso();
    session.status = 'active';
    session.startedAt = nowIso;

    const profile = this.profiles.find((m) => m.id === session.mentorId);
    if (session.projectId) {
      this.recordMentorActivity(session.projectId, profile?.userId || session.mentorId, 'session_held', nowIso);
    }
    try {
      this.notificationsService.create({
        userId: session.studentId,
        type: 'MENTOR_SESSION_STARTED',
        title: 'Mentor Session Started',
        message: `🟢 Your session with ${profile?.name ?? 'your mentor'} has started!`,
        readStatus: false,
        referenceId: sessionId,
      });
    } catch (err: any) {
        console.warn('[mentor-marketplace.service] Suppressed non-critical error:', err?.message || err);
      }

    return this.enrichSession(session);
  }

  private assertNotNeedsReview(session: MentorSessionEntity): void {
    if (session.status === 'needs_review') {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'SESSION_NEEDS_REVIEW',
        message:
          'Session is flagged needs_review due to a snapshot integrity issue and cannot release, refund, or dispute escrow until an admin clears it.',
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Mentor accepts the booking request — grants the mentor access to work
  // with the project owner (frontend wires this into project workspace access).
  // ─────────────────────────────────────────────────────────────────────────
  async acceptSession(sessionId: string, mentorUserId: string, isPrivileged = false): Promise<MentorSessionEntity> {
    const initialSession = this.findSession(sessionId);
    const initialProfile = this.profiles.find(
      (m) => String(m.id) === String(initialSession.mentorId) || String(m.userId) === String(initialSession.mentorId),
    );
    const mentorUserKey = initialProfile?.userId || this.resolveMentorUserId(initialSession.mentorId);

    return this.runWithBookingLocks(
      [`session:${sessionId}`, `mentor:${mentorUserKey}`, `owner:${initialSession.studentId}`],
      async () => {
        this.expireStalePaymentPendingSessions();

        if (!isPrivileged && !this.isMentorVerified(mentorUserId)) {
          throw new ForbiddenException('Only approved mentors can accept session bookings.');
        }
        const session = this.findSession(sessionId);
        const profile = this.profiles.find((m) => m.id === session.mentorId);
        if (!isPrivileged && (!profile || profile.userId !== mentorUserId)) {
          throw new ForbiddenException('This session was not booked with you.');
        }
        this.assertNotNeedsReview(session);
        if (session.status !== 'escrow_funded') {
          throw new BadRequestException(`Session is already ${session.status}`);
        }

        if (session.projectId) {
          const project = this.projectsRepository.findById(session.projectId, true);
          if (project) {
            const mentorRole = getProjectRole(project, mentorUserId);
            if (mentorRole === 'Owner' || mentorRole === 'Collaborator') {
              throw new ConflictException({
                statusCode: 409,
                error: 'Conflict',
                code: 'MENTOR_IS_PROJECT_MEMBER',
                message: 'A project owner or active collaborator cannot be booked as mentor on the same project.',
              });
            }
          }
        }

        // Phase 6 Rule 2: Accepting a mentor session must never replace or overwrite an existing mentor;
        // if one exists, the accept is refused and the session is refunded.
        if (session.projectId) {
          const project = this.projectsRepository.findById(session.projectId, true);
          if (project) {
            const hasConflictingMentor = Boolean(project.mentorId && String(project.mentorId) !== String(mentorUserId));
            const hasAnotherActiveSession = this.sessions.some(
              (s) => s.id !== session.id && String(s.projectId) === String(session.projectId) && s.status === 'active'
            );

            if (hasConflictingMentor || hasAnotherActiveSession) {
              try {
                this.escrowService.refund(session.escrowId);
              } catch (err: any) {
                console.warn('[mentor-marketplace.service] Suppressed non-critical error:', err?.message || err);
              }
              session.status = 'refunded';

              const { totalAmount } = calculateEscrowBreakdown(session.agreedPrice);

              try {
                this.notificationsService.create({
                  userId: session.studentId,
                  type: 'MENTOR_SESSION_REFUNDED',
                  title: 'Mentor Booking Refunded',
                  message: `🔴 Project #${session.projectId} already has an active mentor. Session #${session.id} was refused and ₹${session.totalAmount || totalAmount} refunded.`,
                  readStatus: false,
                  referenceId: session.id,
                });
              } catch (err: any) {
                console.warn('[mentor-marketplace.service] Suppressed non-critical error:', err?.message || err);
              }

              try {
                this.auditService.log({
                  action: 'booking-accept-conflict-refunded',
                  actor: 'System',
                  target: `Session #${sessionId}`,
                  entityType: 'mentor_session',
                  entityId: sessionId,
                  event: `Mentor accept refused: Project #${session.projectId} already has an active mentor. Refunded in full.`,
                  details: { projectId: session.projectId, agreedPrice: session.agreedPrice },
                });
              } catch (err: any) {
                console.warn('[mentor-marketplace.service] Suppressed non-critical error:', err?.message || err);
              }

              throw new ConflictException('This project already has an active mentor. The session has been refunded.');
            }
          }

          // Phase 25: Re-verify project live status, self/collaborator rule, and mentor availability/capacity
          this.assertBookable(
            session.projectId,
            session.mentorId,
            session.studentId,
            session.id,
          );

          if (project) {
            project.mentorId = mentorUserId;
            project.mentor = profile?.name || 'Mentor';
            this.projectsRepository.update(session.projectId, {
              mentorId: mentorUserId,
              mentor: profile?.name || 'Mentor',
            });
          }
        }

        const acceptNowIso = this.getCurrentIso();
        session.status = 'active';
        session.startedAt = acceptNowIso;
        if (session.projectId) {
          this.initMentorAssignmentActivity(session.projectId, mentorUserId, acceptNowIso);
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
        } catch (err: any) {
          console.warn('[mentor-marketplace.service] Suppressed non-critical error:', err?.message || err);
        }

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
        } catch (err: any) {
          console.warn('[mentor-marketplace.service] Suppressed non-critical error:', err?.message || err);
        }

        return this.enrichSession(session);
      },
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Mentor declines the booking request — escrow is refunded to the owner.
  // ─────────────────────────────────────────────────────────────────────────
  declineSession(
    sessionId: string,
    mentorUserId: string,
    isPrivileged = false,
    reason?: string,
    feedbackPayload?: any,
  ): MentorSessionEntity {
    if (!isPrivileged && !this.isMentorVerified(mentorUserId)) {
      throw new ForbiddenException('Only approved mentors can decline session bookings.');
    }
    const session = this.findSession(sessionId);
    const profile = this.profiles.find((m) => m.id === session.mentorId);
    if (!isPrivileged && (!profile || profile.userId !== mentorUserId)) {
      throw new ForbiddenException('This session was not booked with you.');
    }
    this.assertNotNeedsReview(session);
    if (session.status === 'active') {
      throw new ForbiddenException('A mentor cannot leave or be removed once a project has started.');
    }
    if (session.status !== 'escrow_funded') {
      throw new BadRequestException(`Session is already ${session.status}`);
    }

    let feedbackRecord: any;
    let trimmedReason = (reason || '').trim();
    if (this.feedbackService) {
      let fb = feedbackPayload?.reasons !== undefined
        ? { reasons: feedbackPayload.reasons, explanation: feedbackPayload.explanation }
        : ((feedbackPayload as any)?.feedback || (trimmedReason ? { reasons: ['OTHER'], explanation: trimmedReason } : undefined));
      if (!fb) {
        fb = { reasons: [] };
      }
      const validated = this.feedbackService.validate('MENTOR_DECLINE_ASSIGNMENT', fb, mentorUserId, session);
      trimmedReason = validated.explanation || validated.reasons.join(', ');
      feedbackRecord = this.feedbackService.record({
        actionType: 'MENTOR_DECLINE_ASSIGNMENT',
        entityType: 'MENTOR_SESSION',
        entityId: sessionId,
        projectId: session.projectId,
        actorUserId: mentorUserId,
        targetUserId: String(session.studentId),
        reasons: validated.reasons,
        explanation: validated.explanation,
      });
    } else {
      if (!trimmedReason || trimmedReason.length < 10 || trimmedReason.length > 500) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          code: 'REASON_REQUIRED',
          message: 'A decline reason between 10 and 500 characters is required.',
        });
      }
    }

    this.escrowService.refund(session.escrowId);
    session.status = 'refunded';
    session.refundedAt = this.getCurrentIso();
    session.endedAt = this.getCurrentIso();
    session.declineReason = trimmedReason;
    session.declinedBy = 'mentor';

    const { totalAmount } = calculateEscrowBreakdown(session.agreedPrice);

    try {
      this.notificationsService.create({
        userId: session.studentId,
        type: 'MENTOR_SESSION_DECLINED',
        title: 'Mentor Request Declined',
        message: `🔴 ${profile?.name || 'Mentor'} declined your mentor request: "${trimmedReason}". ₹${totalAmount} has been refunded.`,
        readStatus: false,
        referenceId: sessionId,
      });
    } catch (err: any) {
      console.warn('[mentor-marketplace.service] Suppressed non-critical error:', err?.message || err);
    }

    try {
      this.auditService.log({
        action: 'booking-declined',
        actor: profile?.name || 'Mentor',
        target: `Session #${sessionId}`,
        entityType: 'mentor_session',
        entityId: sessionId,
        event: `${profile?.name || 'Mentor'} declined mentorship booking: "${trimmedReason}" (₹${totalAmount} refunded)`,
        details: { status: 'refunded', agreedPrice: session.agreedPrice, totalAmount, declineReason: trimmedReason, declinedBy: 'mentor' },
      });
    } catch (err: any) {
      console.warn('[mentor-marketplace.service] Suppressed non-critical error:', err?.message || err);
    }

    return this.enrichSession(session);
  }

  /**
   * System auto-declines a booking request after 3 days without response.
   * Idempotent: running multiple times refunds only once.
   */
  expireSession(sessionId: string): MentorSessionEntity | null {
    const session = this.findSession(sessionId);
    if (!session) return null;
    if (session.status === 'needs_review' || session.status === 'disputed' || this.hasOpenDispute(session.id)) {
      return session;
    }
    if (session.status !== 'escrow_funded' && session.status !== 'payment_pending') {
      return session;
    }

    const { totalAmount } = calculateEscrowBreakdown(session.agreedPrice);
    if (session.escrowId) {
      this.escrowService.refund(session.escrowId);
    }
    session.status = 'refunded';
    session.refundedAt = this.getCurrentIso();
    session.endedAt = this.getCurrentIso();
    session.declineReason = 'No response within 3 days';
    session.declinedBy = 'system';

    const profile = this.profiles.find((m) => m.id === session.mentorId);

    // Notify owner
    try {
      this.notificationsService.create({
        userId: session.studentId,
        type: 'MENTOR_SESSION_DECLINED',
        title: 'Mentor Request Expired',
        message: `🔴 Mentor booking request expired: No response within 3 days. ₹${totalAmount} has been refunded.`,
        readStatus: false,
        referenceId: sessionId,
      });
    } catch (err: any) {
      console.warn('[mentor-marketplace.service] Suppressed non-critical error:', err?.message || err);
    }

    // Notify mentor
    try {
      this.notificationsService.create({
        userId: profile?.userId || session.mentorId,
        type: 'MENTOR_SESSION_EXPIRED',
        title: 'Mentor Request Expired',
        message: `🔴 Mentorship booking request expired due to no response within 3 days.`,
        readStatus: false,
        referenceId: sessionId,
      });
    } catch (err: any) {
      console.warn('[mentor-marketplace.service] Suppressed non-critical error:', err?.message || err);
    }

    // Audit log
    try {
      this.auditService.log({
        action: 'booking-expired',
        actor: 'System',
        target: `Session #${sessionId}`,
        entityType: 'mentor_session',
        entityId: sessionId,
        event: `Mentor request automatically expired after 3 days without response (₹${totalAmount} refunded)`,
        details: { status: 'refunded', agreedPrice: session.agreedPrice, totalAmount, declineReason: 'No response within 3 days', declinedBy: 'system' },
      });
    } catch (err: any) {
      console.warn('[mentor-marketplace.service] Suppressed non-critical error:', err?.message || err);
    }

    return this.enrichSession(session);
  }

  findAllSessions(): MentorSessionEntity[] {
    return this.sessions;
  }

  // requesterId/isPrivileged: the project owner who booked the session can
  // complete their own session (e.g. when they close out their project);
  // admin/superuser may complete any session for support purposes.
  completeSession(sessionId: string, requesterId?: string, isPrivileged = false): MentorSessionEntity {
    const session = this.findSession(sessionId);
    if (!isPrivileged && requesterId !== undefined && session.studentId !== requesterId) {
      throw new ForbiddenException('Only the project owner who booked this session (or an admin) can mark it complete.');
    }
    this.assertNotNeedsReview(session);
    if (session.status === 'disputed' || this.hasOpenDispute(session.id)) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'SESSION_DISPUTED',
        message: 'Payout is frozen while this session is under dispute.',
      });
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

    const completeNowIso = this.getCurrentIso();
    session.status = 'completed';
    session.completedAt = completeNowIso;
    session.endedAt = completeNowIso;
    if (session.projectId) {
      this.recordMentorActivity(session.projectId, profile?.userId || session.mentorId, 'session_held', completeNowIso);
    }

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
    } catch (err: any) {
        console.warn('[mentor-marketplace.service] Suppressed non-critical error:', err?.message || err);
      }

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
    } catch (err: any) {
        console.warn('[mentor-marketplace.service] Suppressed non-critical error:', err?.message || err);
      }

    return this.enrichSession(session);
  }

  cancelSession(
    sessionId: string,
    requesterId?: string,
    isPrivileged = false,
    feedbackPayload?: any,
  ): MentorSessionEntity {
    const session = this.findSession(sessionId);
    if (!isPrivileged && requesterId && String(session.studentId) !== String(requesterId)) {
      throw new ForbiddenException('Only the project owner who booked this session (or an admin) can cancel it.');
    }
    this.assertNotNeedsReview(session);
    if (session.status === 'disputed' || this.hasOpenDispute(session.id)) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'SESSION_DISPUTED',
        message: 'Refund is frozen while this session is under dispute.',
      });
    }
    if (session.status === 'completed') {
      throw new BadRequestException('Cannot cancel a completed session.');
    }
    if (session.status === 'active' && !isPrivileged) {
      throw new ForbiddenException('A mentor cannot leave or be removed once a project has started.');
    }

    let feedbackRecord: any;
    if (this.feedbackService) {
      let fb = feedbackPayload?.reasons !== undefined
        ? { reasons: feedbackPayload.reasons, explanation: feedbackPayload.explanation }
        : ((feedbackPayload as any)?.feedback || (feedbackPayload?.reason ? { reasons: ['OTHER'], explanation: feedbackPayload.reason } : undefined));
      if (!fb && (!feedbackPayload || Object.keys(feedbackPayload).length === 0)) {
        fb = { reasons: ['OTHER'], explanation: 'Cancelled by student' };
      }
      if (!fb) {
        fb = { reasons: [] };
      }
      const profile = this.profiles.find((m) => m.id === session.mentorId);
      const validated = this.feedbackService.validate('STUDENT_CANCEL_MENTORSHIP', fb, requesterId, session);
      feedbackRecord = this.feedbackService.record({
        actionType: 'STUDENT_CANCEL_MENTORSHIP',
        entityType: 'MENTOR_SESSION',
        entityId: sessionId,
        projectId: session.projectId,
        actorUserId: requesterId || String(session.studentId),
        targetUserId: profile?.userId || session.mentorId,
        reasons: validated.reasons,
        explanation: validated.explanation,
      });
    }

    this.escrowService.refund(session.escrowId);
    session.status = 'refunded';
    session.refundedAt = this.getCurrentIso();
    session.endedAt = this.getCurrentIso();

    const { totalAmount } = calculateEscrowBreakdown(session.agreedPrice);

    try {
      this.notificationsService.create({
        userId: session.studentId,
        type: 'MENTOR_SESSION_CANCELLED',
        message: `🔴 Your session has been cancelled. ₹${totalAmount} has been refunded.`,
        readStatus: false,
        referenceId: sessionId,
      });
    } catch (err: any) {
        console.warn('[mentor-marketplace.service] Suppressed non-critical error:', err?.message || err);
      }

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
      createdAt: this.getCurrentIso(),
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
    this.reconcileDuplicateSessionsOnStartup();
    this.syncCompletedProjectSessions();

    if (this.feedbackService) {
      this.feedbackService.registerEntityResolver('MENTOR_SESSION', (sessionId: string) => {
        const session = this.findSession(sessionId);
        if (!session) return { exists: false, parties: [] };
        const profile = this.profiles.find((m) => m.id === session.mentorId);
        const mentorUserId = profile?.userId || session.mentorId;
        const parties = [String(session.studentId), String(mentorUserId)];
        return {
          exists: true,
          projectId: session.projectId,
          parties,
          actorId: String(mentorUserId),
          targetId: String(session.studentId),
        };
      });
    }
  }

  reconcileDuplicateSessionsOnStartup(options?: { silent?: boolean }): void {
    const silent = Boolean(options?.silent);
    const liveByProject = new Map<string, MentorSessionEntity[]>();
    for (const session of this.sessions) {
      if (this.isSessionLive(session)) {
        const list = liveByProject.get(session.projectId) || [];
        list.push(session);
        liveByProject.set(session.projectId, list);
      }
    }

    const studentRefundBuckets = new Map<
      string,
      { totalAmount: number; lastProjectId: string; lastSessionId: string; items: NotificationGroupedItem[] }
    >();
    const mentorCancelBuckets = new Map<
      string,
      { lastProjectId: string; lastSessionId: string; items: NotificationGroupedItem[] }
    >();

    for (const [projectId, sessions] of liveByProject.entries()) {
      if (sessions.length <= 1) continue;

      // Keep earliest accepted or active one (or earliest otherwise)
      sessions.sort((a, b) => {
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (b.status === 'active' && a.status !== 'active') return 1;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

      const kept = sessions[0];
      const duplicates = sessions.slice(1);

      console.log(
        `[Startup Reconciliation] Found ${sessions.length} live sessions for project ${projectId}. Keeping ${kept.id} (${kept.status}), refunding ${duplicates.length} duplicate(s).`
      );

      for (const dup of duplicates) {
        try {
          if (dup.escrowId) {
            this.escrowService.refund(dup.escrowId);
          }
        } catch (e: any) {
          console.warn('[mentor-marketplace.service] Suppressed non-critical error:', e?.message || e);
        }
        dup.status = 'refunded';

        const { totalAmount } = calculateEscrowBreakdown(dup.agreedPrice);
        const refunded = dup.totalAmount || totalAmount;

        const studentKey = String(dup.studentId);
        const sBucket = studentRefundBuckets.get(studentKey) || {
          totalAmount: 0,
          lastProjectId: String(projectId),
          lastSessionId: dup.id,
          items: [],
        };
        sBucket.totalAmount += refunded;
        sBucket.lastProjectId = String(projectId);
        sBucket.lastSessionId = dup.id;
        sBucket.items.push({
          label: `Project #${projectId} session #${dup.id} (₹${refunded} refunded)`,
          link: `/projects/${projectId}`,
        });
        studentRefundBuckets.set(studentKey, sBucket);

        const profile = this.profiles.find((m) => m.id === dup.mentorId);
        if (profile?.userId) {
          const mentorKey = String(profile.userId);
          const mBucket = mentorCancelBuckets.get(mentorKey) || {
            lastProjectId: String(projectId),
            lastSessionId: dup.id,
            items: [],
          };
          mBucket.lastProjectId = String(projectId);
          mBucket.lastSessionId = dup.id;
          mBucket.items.push({
            label: `Booking #${dup.id} for project #${projectId}`,
            link: `/projects/${projectId}`,
          });
          mentorCancelBuckets.set(mentorKey, mBucket);
        }

        // Audit entry
        if (!silent) {
          try {
            this.auditService.log({
              action: 'duplicate-session-refunded',
              actor: 'System',
              target: `Session #${dup.id}`,
              entityType: 'mentor_session',
              entityId: dup.id,
              event: `Duplicate mentor session for project #${projectId} refunded (Reason: Duplicate booking)`,
              details: {
                projectId,
                reason: 'Duplicate booking',
                refundedSessionId: dup.id,
                keptSessionId: kept.id,
                amount: refunded,
              },
            });
          } catch (err: any) {
            console.warn('[mentor-marketplace.service] Suppressed non-critical error:', err?.message || err);
          }
        }

        console.log(
          `[Startup Reconciliation] Fixed duplicate session ${dup.id} for project ${projectId}: Refunded duplicate booking.`
        );
      }
    }

    if (silent) {
      return;
    }

    for (const [studentId, bucket] of studentRefundBuckets.entries()) {
      try {
        dispatchGroupedNotification(
          this.notificationsService,
          studentId,
          'mentor-duplicate-refund',
          bucket.items,
          (items, count) => ({
            type: 'MENTOR_SESSION_REFUNDED',
            title: count === 1 ? 'Duplicate Booking Refunded' : `${count} Duplicate Bookings Refunded`,
            message:
              count === 1
                ? `🔴 Duplicate mentor booking for project #${bucket.lastProjectId} was cancelled and ₹${bucket.totalAmount} refunded. Reason: Duplicate booking.`
                : `🔴 ${count} duplicate mentor bookings were cancelled and ₹${bucket.totalAmount} refunded (${formatGroupedItemList(items, 10)}).`,
            readStatus: false,
            referenceId: bucket.lastSessionId,
          }),
        );
      } catch (err: any) {
        console.warn('[mentor-marketplace.service] Suppressed non-critical error:', err?.message || err);
      }
    }

    for (const [mentorUserId, bucket] of mentorCancelBuckets.entries()) {
      try {
        dispatchGroupedNotification(
          this.notificationsService,
          mentorUserId,
          'mentor-duplicate-cancel',
          bucket.items,
          (items, count) => ({
            type: 'MENTOR_SESSION_CANCELLED',
            title: count === 1 ? 'Duplicate Booking Cancelled' : `${count} Duplicate Bookings Cancelled`,
            message:
              count === 1
                ? `⚠️ Mentorship booking #${bucket.lastSessionId} for project #${bucket.lastProjectId} was cancelled. Reason: Duplicate booking.`
                : `⚠️ ${count} duplicate mentorship bookings were cancelled (${formatGroupedItemList(items, 10)}).`,
            readStatus: false,
            referenceId: bucket.lastSessionId,
          }),
        );
      } catch (err: any) {
        console.warn('[mentor-marketplace.service] Suppressed non-critical error:', err?.message || err);
      }
    }
  }

  syncCompletedProjectSessions(): void {
    for (const session of this.sessions) {
      if (this.hasOpenDispute(session.id) || session.status === 'disputed') {
        continue;
      }
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
    let projectDueDate: string | undefined = undefined;
    try {
      const user = this.usersService.findUserSafe(session.studentId);
      if (user) ownerName = user.name;
    } catch (err: any) {
      console.warn('[mentor-marketplace.service] Suppressed non-critical error:', err?.message || err);
    }
    try {
      const proj = this.projectsRepository.findById(session.projectId);
      if (proj) {
        projectName = proj.title || proj.name || session.projectId;
        projectDueDate = proj.dueDate || undefined;
      }
    } catch (err: any) {
      console.warn('[mentor-marketplace.service] Suppressed non-critical error:', err?.message || err);
    }

    const hasFeedback = this.sessionFeedbacks.some((f) => String(f.sessionId) === String(session.id));
    const dispute = this.findDisputeForSession(session.id) || null;
    const isDisputed = Boolean(session.status === 'disputed' || this.hasOpenDispute(session.id));
    const resolvedPlatformFee = session.platformFee !== undefined ? session.platformFee : platformFee;
    const resolvedGatewayFee = session.gatewayFee !== undefined ? session.gatewayFee : gatewayFee;
    const resolvedPayout = session.payout !== undefined ? session.payout : mentorPayout;
    return {
      ...session,
      platformFee: resolvedPlatformFee,
      gatewayFee: resolvedGatewayFee,
      totalAmount: session.totalAmount || totalAmount,
      payout: resolvedPayout,
      refundAmount: session.refundAmount ?? 0,
      ownerName,
      projectName,
      projectDueDate,
      hasFeedback,
      disputed: isDisputed,
      feedbackHistory: this.feedbackService?.findByEntity('MENTOR_SESSION', session.id) || [],
      ...(dispute ? { dispute } : {}),
    } as any;
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

  getMentoredProjects(mentorUserId: string): MentoredProjectsResponse {
    return this.getMentoredProjectsForUser(mentorUserId);
  }

  getMentoredProjectsForUser(
    mentorUserId: string,
    options?: { completedOnly?: boolean },
  ): MentoredProjectsResponse {
    this.syncCompletedProjectSessions();

    const canonicalUserId = this.resolveMentorUserId(mentorUserId);
    if (!canonicalUserId) {
      return { items: [], counts: { all: 0, active: 0, completed: 0 } };
    }

    const mentorProfile = this.profiles.find(
      (p) =>
        String(p.userId) === canonicalUserId ||
        String(p.id) === canonicalUserId ||
        String(p.userId) === String(mentorUserId) ||
        String(p.id) === String(mentorUserId),
    );
    const profileId = mentorProfile?.id;

    // 1. Gather sessions for this mentor
    const mentorSessions = this.sessions.filter((s) => {
      const sMid = String(s.mentorId);
      return (
        sMid === canonicalUserId ||
        sMid === String(mentorUserId) ||
        (profileId && (sMid === profileId || sMid === String(mentorProfile?.userId)))
      );
    });

    // 2. Gather candidate project IDs
    const candidateProjectIds = new Set<string>();

    for (const s of mentorSessions) {
      if (s.projectId) candidateProjectIds.add(String(s.projectId));
    }

    for (const a of this.mentorActivities) {
      if (
        (String(a.mentorId) === canonicalUserId ||
          String(a.mentorId) === String(mentorUserId) ||
          (profileId && String(a.mentorId) === profileId)) &&
        a.projectId
      ) {
        candidateProjectIds.add(String(a.projectId));
      }
    }

    const allProjects = this.projectsRepository ? this.projectsRepository.findAll(true) : [];
    for (const p of allProjects) {
      const rawPMentor = p.mentorId || (p as any).completedMentorUserId || (p as any).mentorUserId;
      const pMentorId = rawPMentor ? this.resolveMentorUserId(rawPMentor) : null;
      const pCompletedMentorId = (p as any).completedMentorUserId
        ? this.resolveMentorUserId((p as any).completedMentorUserId)
        : null;
      const isDirectMentor =
        pMentorId === canonicalUserId ||
        pMentorId === String(mentorUserId) ||
        pCompletedMentorId === canonicalUserId ||
        pCompletedMentorId === String(mentorUserId) ||
        (profileId && (String(p.mentorId) === profileId || pMentorId === profileId));
      const isMemberMentor =
        Array.isArray(p.members) &&
        p.members.some((m: any) => {
          const role = String(m.role || '').toLowerCase();
          const uid = String(m.userId || m.id || '');
          return (
            role === 'mentor' &&
            (uid === canonicalUserId || uid === String(mentorUserId) || (profileId && uid === profileId))
          );
        });

      if (isDirectMentor || isMemberMentor) {
        candidateProjectIds.add(String(p.id));
      }
    }

    const items: MentoredProjectItem[] = [];

    for (const pid of candidateProjectIds) {
      const project = this.projectsRepository.findById(pid);
      if (!project) continue;

      // Soft-deleted projects are excluded
      if (project.deletedAt || project.deletionScheduledAt || project.isDeleted) {
        continue;
      }

      // Projects the mentor was released from via an abandonment review (Phase 14) are excluded
      const wasReleasedByAbandonment =
        this.mentorAbandonmentHistory.some(
          (h) =>
            String(h.projectId) === String(pid) &&
            (String(h.mentorUserId) === canonicalUserId ||
              String(h.mentorUserId) === String(mentorUserId) ||
              String(h.mentorId) === canonicalUserId ||
              (profileId && String(h.mentorId) === profileId)),
        ) ||
        this.abandonmentReviews.some(
          (r) =>
            String(r.projectId) === String(pid) &&
            (String(r.mentorId) === canonicalUserId ||
              String(r.mentorId) === String(mentorUserId) ||
              this.resolveMentorUserId(r.mentorId) === canonicalUserId) &&
            r.status === 'released',
        );

      if (wasReleasedByAbandonment) {
        continue;
      }

      // Check sessions for this project
      const projSessions = mentorSessions.filter((s) => String(s.projectId) === String(pid));

      // If sessions exist, at least one session must have reached accepted, active, completed, or released.
      // Exclude bookings that never started or were refunded/cancelled/declined
      if (projSessions.length > 0) {
        const hasStartedOrQualifying = projSessions.some((s) => {
          const st = String(s.status || '').toLowerCase();
          if (st === 'refunded' || st === 'cancelled' || st === 'declined') {
            return false;
          }
          if (
            [
              'accepted',
              'active',
              'completed',
              'released',
              'payout_pending',
              'settled',
              'paid_out',
              'disputed',
              'needs_review',
              'split',
            ].includes(st)
          ) {
            return true;
          }
          if (s.startedAt) return true;
          return false;
        });

        if (!hasStartedOrQualifying) {
          // All bookings for this project were unaccepted/never started
          continue;
        }
      }

      // Sort project sessions to pick best/latest
      const sortedSessions = [...projSessions].sort((a, b) => {
        const statusScore = (s: MentorSessionEntity) => {
          const st = String(s.status || '').toLowerCase();
          if (st === 'completed' || st === 'released') return 4;
          if (st === 'active') return 3;
          if (st === 'accepted' || st === 'escrow_funded') return 2;
          return 1;
        };
        const diff = statusScore(b) - statusScore(a);
        if (diff !== 0) return diff;
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });
      const bestSession = sortedSessions[0];

      const pStatus = String(project.status || '').toLowerCase();
      const isCompleted = project.isCompleted === true || pStatus === 'completed';
      const isClosed = pStatus === 'closed';

      let status: string;
      let closedReason: string | undefined;
      let completedAt: string | undefined;

      if (isClosed) {
        status = 'Closed';
        closedReason = project.closureReason || project.closedReason || 'Project closed';
        if (project.completedAt) {
          completedAt = new Date(project.completedAt).toISOString();
        } else if (project.closedAt) {
          completedAt = new Date(project.closedAt).toISOString();
        }
      } else if (isCompleted) {
        status = 'Completed';
        if (project.completedAt) {
          completedAt = new Date(project.completedAt).toISOString();
        } else if (bestSession?.completedAt) {
          completedAt = new Date(bestSession.completedAt).toISOString();
        } else {
          completedAt = new Date(project.updatedAt || project.createdAt || Date.now()).toISOString();
        }
      } else {
        status = project.status || 'In Progress';
      }

      const pMentorId = project.mentorId ? this.resolveMentorUserId(project.mentorId) : null;
      const isCurrentlyAssigned =
        pMentorId === canonicalUserId ||
        pMentorId === String(mentorUserId) ||
        (profileId && (String(project.mentorId) === profileId || pMentorId === profileId)) ||
        (Array.isArray(project.members) &&
          project.members.some((m: any) => {
            const role = String(m.role || '').toLowerCase();
            const uid = String(m.userId || m.id || '');
            return (
              role === 'mentor' &&
              (uid === canonicalUserId || uid === String(mentorUserId) || (profileId && uid === profileId))
            );
          })) ||
        Boolean(bestSession && ['active', 'accepted', 'escrow_funded'].includes(String(bestSession.status).toLowerCase()));

      let tab: 'active' | 'completed';
      if (isCompleted || isClosed) {
        tab = 'completed';
      } else if (isCurrentlyAssigned) {
        tab = 'active';
      } else {
        // Project is neither completed/closed nor is mentor currently assigned
        continue;
      }

      let sessionStatus = 'active';
      let amount = 0;
      if (bestSession) {
        sessionStatus = bestSession.status;
        amount = bestSession.agreedPrice || bestSession.payout || 0;
      } else if (isCompleted) {
        sessionStatus = 'completed';
      }

      let ownerName = 'Project Owner';
      try {
        if (project.ownerId) {
          const ownerUser =
            typeof this.usersService?.findUserSafe === 'function'
              ? this.usersService.findUserSafe(project.ownerId)
              : typeof this.usersService?.findById === 'function'
              ? this.usersService.findById(project.ownerId)
              : undefined;
          if (ownerUser?.name) ownerName = ownerUser.name;
          else if (project.owner) ownerName = project.owner;
        } else if (project.owner) {
          ownerName = project.owner;
        }
      } catch {}

      if (options?.completedOnly && !isCompleted) {
        continue;
      }

      const finalLink =
        project.finalLink ||
        project.finishedLink ||
        project.finalProjectUrl ||
        project.projectLink ||
        project.deliverableUrl ||
        null;

      const acceptedAt =
        bestSession?.startedAt ||
        bestSession?.createdAt ||
        (project.createdAt ? new Date(project.createdAt).toISOString() : undefined);

      items.push({
        projectId: String(project.id),
        id: String(project.id),
        title: project.title || project.name || 'Untitled Project',
        desc: project.desc || project.description || '',
        ownerName,
        status,
        closedReason,
        dueDate: project.dueDate || project.projectDueDate || undefined,
        acceptedAt,
        completedAt,
        finalLink,
        mentorUserId: canonicalUserId,
        sessionStatus,
        amount,
        progress: Number(project.progress) || 0,
        skills: project.skills || [],
        tab,
      });
    }

    // Sort items: Active projects first, completed sorted by completedAt desc
    items.sort((a, b) => {
      if (a.tab !== b.tab) {
        return a.tab === 'active' ? -1 : 1;
      }
      if (a.tab === 'completed') {
        return new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime();
      }
      return 0;
    });

    const activeCount = items.filter((it) => it.tab === 'active').length;
    const completedCount = items.filter((it) => it.tab === 'completed').length;

    return {
      items,
      counts: {
        all: items.length,
        active: activeCount,
        completed: completedCount,
      },
    };
  }

  getAllSessions(): MentorSessionEntity[] {
    this.syncCompletedProjectSessions();
    return this.sessions.map((s) => this.enrichSession(s));
  }

  getAdminStats() {
    this.expireStalePaymentPendingSessions();
    this.syncCompletedProjectSessions();

    const completed = this.sessions.filter((s) => s.status === 'completed');
    const fundedOrActive = this.sessions.filter((s) => s.status === 'escrow_funded' || s.status === 'active');
    const awaitingResponse = this.sessions.filter((s) => s.status === 'escrow_funded');
    const active = this.sessions.filter((s) => s.status === 'active');
    const refunded = this.sessions.filter((s) => s.status === 'refunded');
    const paymentPending = this.sessions.filter((s) => s.status === 'payment_pending');

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
      paymentPendingSessions: paymentPending.length,
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
        !this.hasOpenDispute(s.id) &&
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
        !this.hasOpenDispute(s.id) &&
        (s.status === 'active' || s.status === 'escrow_funded' || s.status === 'payout_pending'),
    );

    const studentBuckets = new Map<
      string,
      { totalAmount: number; lastSessionId: string; items: NotificationGroupedItem[] }
    >();
    const mentorBuckets = new Map<string, NotificationGroupedItem[]>();

    for (const session of projectSessions) {
      try {
        this.escrowService.refund(session.escrowId);
        session.status = 'refunded';
        const { totalAmount } = calculateEscrowBreakdown(session.agreedPrice);
        const profile = this.profiles.find((m) => m.id === session.mentorId);

        const sKey = String(session.studentId);
        const sBucket = studentBuckets.get(sKey) || {
          totalAmount: 0,
          lastSessionId: session.id,
          items: [],
        };
        sBucket.totalAmount += totalAmount;
        sBucket.lastSessionId = session.id;
        sBucket.items.push({
          label: `Session #${session.id} (₹${totalAmount} refunded)`,
          link: `/projects/${projectId}`,
        });
        studentBuckets.set(sKey, sBucket);

        if (profile?.userId) {
          const mKey = String(profile.userId);
          const list = mentorBuckets.get(mKey) || [];
          list.push({
            label: `Session #${session.id} for project #${projectId}`,
            link: `/projects/${projectId}`,
          });
          mentorBuckets.set(mKey, list);
        }
      } catch (err) {
        console.error(`Failed to refund mentor escrow for session ${session.id} on project delete:`, err);
      }
    }

    for (const [studentId, bucket] of studentBuckets.entries()) {
      try {
        dispatchGroupedNotification(
          this.notificationsService,
          studentId,
          `project-deleted-refund:${projectId}`,
          bucket.items,
          (groupedItems, count) => ({
            type: 'MENTOR_SESSION_CANCELLED',
            title: count === 1 ? 'Project Deleted - Escrow Refunded' : `Project Deleted - ${count} Escrows Refunded`,
            message:
              count === 1
                ? `🔴 Project has been deleted. ₹${bucket.totalAmount} mentor escrow has been refunded to your account.`
                : `🔴 Project has been deleted. ${count} mentor escrows totalling ₹${bucket.totalAmount} have been refunded (${formatGroupedItemList(groupedItems, 10)}).`,
            readStatus: false,
            referenceId: bucket.lastSessionId,
          }),
        );
      } catch (err) {
        console.error(`Failed to send delete refund notification to ${studentId}:`, err);
      }
    }

    for (const [mentorUserId, items] of mentorBuckets.entries()) {
      try {
        dispatchGroupedNotification(
          this.notificationsService,
          mentorUserId,
          `project-deleted-mentor:${projectId}`,
          items,
          (groupedItems, count) => ({
            type: 'PROJECT_DELETED',
            title: 'Project Deleted',
            message:
              count === 1
                ? `⚠️ Project #${projectId} has been deleted. The mentorship session has been closed and escrow settled.`
                : `⚠️ Project #${projectId} has been deleted. ${count} mentorship sessions were closed and escrows settled (${formatGroupedItemList(groupedItems, 10)}).`,
            readStatus: false,
            referenceId: projectId,
          }),
        );
      } catch (err) {
        console.error(`Failed to send delete notification to mentor ${mentorUserId}:`, err);
      }
    }
  }

  retryPayout(sessionId: string): MentorSessionEntity {
    const session = this.findSession(sessionId);
    this.assertNotNeedsReview(session);
    if (session.status === 'disputed' || this.hasOpenDispute(session.id)) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'SESSION_DISPUTED',
        message: 'Payout retry is blocked while this session is under dispute.',
      });
    }
    if (session.status !== 'payout_pending' && session.status !== 'active') {
      throw new BadRequestException(`Session is not in payout_pending or active state (current: ${session.status}).`);
    }
    session.status = 'active';
    return this.completeSession(sessionId, undefined, true);
  }


  handleProjectClosed(projectId: string, reason: string, refundAll = false): void {
    const liveSessions = this.sessions.filter(
      (s) =>
        String(s.projectId) === String(projectId) &&
        s.status !== 'disputed' &&
        !this.hasOpenDispute(s.id) &&
        (s.status === 'active' ||
          s.status === 'escrow_funded' ||
          s.status === 'payment_pending' ||
          s.status === 'payout_pending'),
    );

    const isSuspension = reason.toLowerCase().includes('suspen');
    const shouldRefundActive = refundAll || !isSuspension;

    const studentRefundBuckets = new Map<
      string,
      { totalAmount: number; hadActive: boolean; lastSessionId: string; items: NotificationGroupedItem[] }
    >();
    const studentCancelBuckets = new Map<
      string,
      { lastSessionId: string; items: NotificationGroupedItem[] }
    >();
    const mentorRefundBuckets = new Map<
      string,
      { hadActive: boolean; lastSessionId: string; items: NotificationGroupedItem[] }
    >();

    for (const session of liveSessions) {
      if (session.status === 'active' || session.status === 'payout_pending') {
        if (shouldRefundActive) {
          try {
            if (session.escrowId) {
              this.escrowService.refund(session.escrowId);
            }
          } catch (err: any) {
            console.warn('[mentor-marketplace.service] Error refunding active session on project close:', err?.message || err);
          }
          session.status = 'refunded';
          session.declineReason = `Project closed: ${reason}`;
          const { totalAmount } = calculateEscrowBreakdown(session.agreedPrice);
          const refundedAmount = session.totalAmount || totalAmount;

          const sKey = String(session.studentId);
          const sBucket = studentRefundBuckets.get(sKey) || {
            totalAmount: 0,
            hadActive: true,
            lastSessionId: session.id,
            items: [],
          };
          sBucket.totalAmount += refundedAmount;
          sBucket.hadActive = true;
          sBucket.lastSessionId = session.id;
          sBucket.items.push({
            label: `Active session #${session.id} (₹${refundedAmount} refunded)`,
            link: `/projects/${projectId}`,
          });
          studentRefundBuckets.set(sKey, sBucket);

          const mKey = String(session.mentorId);
          const mBucket = mentorRefundBuckets.get(mKey) || {
            hadActive: true,
            lastSessionId: session.id,
            items: [],
          };
          mBucket.hadActive = true;
          mBucket.lastSessionId = session.id;
          mBucket.items.push({
            label: `Active session #${session.id}`,
            link: `/projects/${projectId}`,
          });
          mentorRefundBuckets.set(mKey, mBucket);

          try {
            this.auditService.log({
              action: 'project-closed-mentor-refund',
              actor: 'System',
              target: `Session #${session.id}`,
              entityType: 'mentor_session',
              entityId: session.id,
              event: `Project closed (${reason}): Active mentor session refunded in full to project owner`,
              details: { projectId, reason, sessionPrice: session.agreedPrice, refundedAmount, status: 'refunded' },
            });
          } catch (err: any) {
            console.warn('[mentor-marketplace.service] Suppressed audit log error:', err?.message || err);
          }
        } else {
          try {
            session.status = 'active';
            this.completeSession(session.id, undefined, true);
            this.auditService.log({
              action: 'owner-suspension-payout',
              actor: 'System',
              target: `Session #${session.id}`,
              entityType: 'mentor_session',
              entityId: session.id,
              event: `Project closed (${reason}): Active mentor session paid out to mentor from escrow`,
              details: { projectId, reason, sessionPrice: session.agreedPrice, payout: session.payout },
            });
          } catch (err: any) {
            console.warn('[mentor-marketplace.service] Error completing session on project close:', err?.message || err);
          }
        }
      } else if (session.status === 'escrow_funded') {
        try {
          if (session.escrowId) {
            this.escrowService.refund(session.escrowId);
          }
        } catch (err: any) {
          console.warn('[mentor-marketplace.service] Error refunding pending session on project close:', err?.message || err);
        }
        session.status = 'refunded';
        session.declineReason = `Project closed: ${reason}`;
        const { totalAmount } = calculateEscrowBreakdown(session.agreedPrice);
        const refundedAmount = session.totalAmount || totalAmount;

        const sKey = String(session.studentId);
        const sBucket = studentRefundBuckets.get(sKey) || {
          totalAmount: 0,
          hadActive: false,
          lastSessionId: session.id,
          items: [],
        };
        sBucket.totalAmount += refundedAmount;
        sBucket.lastSessionId = session.id;
        sBucket.items.push({
          label: `Pending booking #${session.id} (₹${refundedAmount} refunded)`,
          link: `/projects/${projectId}`,
        });
        studentRefundBuckets.set(sKey, sBucket);

        const mKey = String(session.mentorId);
        const mBucket = mentorRefundBuckets.get(mKey) || {
          hadActive: false,
          lastSessionId: session.id,
          items: [],
        };
        mBucket.lastSessionId = session.id;
        mBucket.items.push({
          label: `Pending booking #${session.id}`,
          link: `/projects/${projectId}`,
        });
        mentorRefundBuckets.set(mKey, mBucket);

        try {
          this.auditService.log({
            action: 'project-closed-mentor-refund',
            actor: 'System',
            target: `Session #${session.id}`,
            entityType: 'mentor_session',
            entityId: session.id,
            event: `Project closed (${reason}): Pending mentor booking refunded in full (₹${refundedAmount})`,
            details: { projectId, reason, refundedAmount, status: 'refunded' },
          });
        } catch (err: any) {
          console.warn('[mentor-marketplace.service] Suppressed audit log error:', err?.message || err);
        }
      } else if (session.status === 'payment_pending') {
        session.status = 'cancelled';
        session.declineReason = `Project closed (${reason})`;
        try {
          this.paymentProvider.cancelPayment(session.paymentIntentId || session.id);
        } catch (err: any) {
          console.warn('[mentor-marketplace.service] Error cancelling payment hold on project close:', err?.message || err);
        }

        const sKey = String(session.studentId);
        const cBucket = studentCancelBuckets.get(sKey) || {
          lastSessionId: session.id,
          items: [],
        };
        cBucket.lastSessionId = session.id;
        cBucket.items.push({
          label: `Payment hold #${session.id}`,
          link: `/projects/${projectId}`,
        });
        studentCancelBuckets.set(sKey, cBucket);

        try {
          this.auditService.log({
            action: 'project-closed-mentor-cancel',
            actor: 'System',
            target: `Session #${session.id}`,
            entityType: 'mentor_session',
            entityId: session.id,
            event: `Project closed (${reason}): Pending payment session cancelled and hold released`,
            details: { projectId, reason, status: 'cancelled' },
          });
        } catch (err: any) {
          console.warn('[mentor-marketplace.service] Suppressed audit log error:', err?.message || err);
        }
      }
    }

    for (const [studentId, bucket] of studentRefundBuckets.entries()) {
      try {
        dispatchGroupedNotification(
          this.notificationsService,
          studentId,
          `project-closed-refund:${projectId}`,
          bucket.items,
          (items, count) => ({
            type: 'MENTOR_SESSION_REFUNDED',
            title:
              count === 1
                ? bucket.hadActive
                  ? 'Mentor Session Refunded'
                  : 'Mentor Booking Refunded'
                : `${count} Mentor Sessions Refunded`,
            message:
              count === 1
                ? bucket.hadActive
                  ? `Project was closed (${reason}). ₹${bucket.totalAmount} refunded in full.`
                  : `Project was closed (${reason}). ₹${bucket.totalAmount} refunded.`
                : `Project was closed (${reason}). ${count} mentor sessions totalling ₹${bucket.totalAmount} were refunded (${formatGroupedItemList(items, 10)}).`,
            readStatus: false,
            referenceId: bucket.lastSessionId,
          }),
        );
      } catch (err: any) {
        console.warn('[mentor-marketplace.service] Suppressed notification error:', err?.message || err);
      }
    }

    for (const [studentId, bucket] of studentCancelBuckets.entries()) {
      try {
        dispatchGroupedNotification(
          this.notificationsService,
          studentId,
          `project-closed-cancel:${projectId}`,
          bucket.items,
          (items, count) => ({
            type: 'MENTOR_SESSION_CANCELLED',
            title: count === 1 ? 'Mentor Booking Cancelled' : `${count} Mentor Bookings Cancelled`,
            message:
              count === 1
                ? `Project was closed (${reason}). The pending payment was cancelled.`
                : `Project was closed (${reason}). ${count} pending mentor payments were cancelled (${formatGroupedItemList(items, 10)}).`,
            readStatus: false,
            referenceId: bucket.lastSessionId,
          }),
        );
      } catch (err: any) {
        console.warn('[mentor-marketplace.service] Suppressed notification error:', err?.message || err);
      }
    }

    for (const [mentorId, bucket] of mentorRefundBuckets.entries()) {
      try {
        dispatchGroupedNotification(
          this.notificationsService,
          mentorId,
          `project-closed-mentor-refund:${projectId}`,
          bucket.items,
          (items, count) => ({
            type: 'PROJECT_CLOSED',
            title: 'Project Closed - Session Refunded',
            message:
              count === 1
                ? bucket.hadActive
                  ? `Project was closed (${reason}). The mentor session was cancelled and refunded in full.`
                  : `Project was closed (${reason}). The mentor booking was cancelled and refunded.`
                : `Project was closed (${reason}). ${count} mentor sessions were cancelled and refunded (${formatGroupedItemList(items, 10)}).`,
            readStatus: false,
            referenceId: bucket.lastSessionId,
          }),
        );
      } catch (err: any) {
        console.warn('[mentor-marketplace.service] Suppressed notification error:', err?.message || err);
      }
    }
  }

  /**
   * Phase 9: Escrow Reconciliation
   * Invariant: owner paid = mentor payout + platform fee + refunds (+ inEscrow for unreleased)
   */
  reconcileEscrow(): {
    ok: boolean;
    totalSessions: number;
    reconciledCount: number;
    totals: {
      ownerPaid: number;
      mentorPayout: number;
      platformFee: number;
      refunds: number;
      inEscrow: number;
    };
    mismatches: Array<{
      sessionId: string;
      status: string;
      ownerPaid: number;
      mentorPayout: number;
      platformFee: number;
      refunds: number;
      inEscrow: number;
      diff: number;
    }>;
  } {
    const mismatches: any[] = [];
    let totalOwnerPaid = 0;
    let totalMentorPayout = 0;
    let totalPlatformFee = 0;
    let totalRefunds = 0;
    let totalInEscrow = 0;

    for (const session of this.sessions) {
      const breakdown = calculateEscrowBreakdown(session.agreedPrice || 0);
      const totalSessionAmount = session.totalAmount ?? breakdown.totalAmount;
      const payoutAmount = session.payout !== undefined ? session.payout : breakdown.mentorPayout;
      const platformFeeTotal =
        (session.platformFee !== undefined ? session.platformFee : breakdown.platformFee) +
        (session.gatewayFee !== undefined ? session.gatewayFee : breakdown.gatewayFee);

      let ownerPaid = 0;
      let mentorPayout = 0;
      let platformFee = 0;
      let refunds = 0;
      let inEscrow = 0;

      switch (session.status) {
        case 'completed':
          ownerPaid = totalSessionAmount;
          mentorPayout = payoutAmount;
          platformFee = platformFeeTotal;
          refunds = 0;
          inEscrow = 0;
          break;

        case 'split':
          ownerPaid = totalSessionAmount;
          mentorPayout = session.payout ?? 0;
          platformFee =
            (session.platformFee ?? 0) + (session.gatewayFee ?? 0);
          refunds =
            session.refundAmount !== undefined
              ? session.refundAmount
              : Math.max(0, totalSessionAmount - mentorPayout - platformFee);
          inEscrow = 0;
          break;

        case 'refunded':
          ownerPaid = totalSessionAmount;
          mentorPayout = 0;
          platformFee = 0;
          refunds = session.refundAmount ?? totalSessionAmount;
          inEscrow = 0;
          break;

        case 'disputed':
        case 'active':
        case 'escrow_funded':
        case 'payout_pending':
          // Funded sessions not yet released or refunded (including open disputes) remain held in escrow
          ownerPaid = totalSessionAmount;
          mentorPayout = 0;
          platformFee = 0;
          refunds = 0;
          inEscrow = totalSessionAmount;
          break;

        case 'payment_pending':
        case 'cancelled':
        default:
          // Unfunded or cancelled before payment
          ownerPaid = 0;
          mentorPayout = 0;
          platformFee = 0;
          refunds = 0;
          inEscrow = 0;
          break;
      }

      totalOwnerPaid += ownerPaid;
      totalMentorPayout += mentorPayout;
      totalPlatformFee += platformFee;
      totalRefunds += refunds;
      totalInEscrow += inEscrow;

      // Check invariant: ownerPaid === mentorPayout + platformFee + refunds + inEscrow
      const diff = ownerPaid - (mentorPayout + platformFee + refunds + inEscrow);
      if (Math.abs(diff) > 0.01) {
        mismatches.push({
          sessionId: session.id,
          status: session.status,
          ownerPaid,
          mentorPayout,
          platformFee,
          refunds,
          inEscrow,
          diff,
        });
      }
    }

    return {
      ok: mismatches.length === 0,
      totalSessions: this.sessions.length,
      reconciledCount: this.sessions.length - mismatches.length,
      totals: {
        ownerPaid: totalOwnerPaid,
        mentorPayout: totalMentorPayout,
        platformFee: totalPlatformFee,
        refunds: totalRefunds,
        inEscrow: totalInEscrow,
      },
      mismatches,
    };
  }

  handleMentorSuspension(mentorUserId: string): void {
    const profile = this.profiles.find(
      (p) => String(p.userId) === String(mentorUserId) || String(p.id) === String(mentorUserId),
    );
    const mentorId = profile?.id || mentorUserId;

    const liveSessions = this.sessions.filter(
      (s) =>
        (String(s.mentorId) === String(mentorId) || String(s.mentorId) === String(mentorUserId)) &&
        s.status !== 'disputed' &&
        !this.hasOpenDispute(s.id) &&
        (s.status === 'active' || s.status === 'escrow_funded' || s.status === 'payment_pending'),
    );

    const freedByOwner = new Map<string, { items: NotificationGroupedItem[]; refId: string }>();
    const refundedByStudent = new Map<string, { items: NotificationGroupedItem[]; refId: string; totalRefunded: number }>();

    for (const session of liveSessions) {
      if (session.status === 'payment_pending') {
        session.status = 'cancelled';
      } else if (session.status === 'escrow_funded' || session.status === 'active') {
        const wasActive = session.status === 'active';
        try {
          this.escrowService.refund(session.escrowId);
        } catch (err: any) {
          console.warn('[mentor-marketplace.service] Suppressed escrow refund error on mentor suspension:', err?.message || err);
        }
        session.status = 'refunded';

        const { totalAmount } = calculateEscrowBreakdown(session.agreedPrice);
        const refundAmt = session.totalAmount || totalAmount;

        if (wasActive && session.projectId) {
          try {
            const project = this.projectsRepository.findById(session.projectId);
            if (project) {
              this.clearProjectMentorSlot(project);

              const oid = String(project.ownerId);
              if (!freedByOwner.has(oid)) freedByOwner.set(oid, { items: [], refId: project.id });
              freedByOwner.get(oid)!.items.push({
                label: project.title || project.name || `Project #${project.id}`,
                link: `/owner/workspace/${project.id}`,
              });
            }
          } catch (err: any) {
            console.warn('[mentor-marketplace.service] Error freeing project mentor slot:', err?.message || err);
          }
        } else {
          const sid = String(session.studentId);
          if (!refundedByStudent.has(sid)) {
            refundedByStudent.set(sid, { items: [], refId: session.id, totalRefunded: 0 });
          }
          const bucket = refundedByStudent.get(sid)!;
          bucket.totalRefunded += refundAmt;
          bucket.items.push({
            label: `Session #${session.id} (₹${refundAmt})`,
            link: `/owner/mentors`,
          });
        }

        try {
          this.auditService.log({
            action: 'mentor-suspension-session-refunded',
            actor: 'System',
            target: `Session #${session.id}`,
            entityType: 'mentor_session',
            entityId: session.id,
            event: `Mentor suspended: ${wasActive ? 'active' : 'pending'} session refunded in full (₹${refundAmt}) and slot freed`,
            details: { projectId: session.projectId, wasActive },
          });
        } catch (err: any) {
          console.warn('[mentor-marketplace.service] Error logging audit on mentor suspension:', err?.message || err);
        }
      }
    }

    for (const [ownerId, bucket] of freedByOwner.entries()) {
      try {
        dispatchGroupedNotification(
          this.notificationsService,
          ownerId,
          `mentor_suspended_freed:${mentorUserId}`,
          bucket.items,
          (groupedItems, count) => ({
            type: 'MENTOR_SUSPENDED',
            title: count > 1 ? `Mentor Slots Freed (${count})` : 'Mentor Slot Freed',
            message:
              count === 1
                ? `The project mentor was suspended. Your active session has been refunded in full and the mentor slot is freed for booking another mentor.`
                : `Your mentor was suspended. ${count} active sessions were refunded and slots freed: ${formatGroupedItemList(groupedItems, 10)}`,
            readStatus: false,
            referenceId: bucket.refId,
            link: groupedItems[0]?.link,
          }),
        );
      } catch {}
    }

    for (const [studentId, bucket] of refundedByStudent.entries()) {
      try {
        dispatchGroupedNotification(
          this.notificationsService,
          studentId,
          `mentor_suspended_refunded:${mentorUserId}`,
          bucket.items,
          (groupedItems, count) => ({
            type: 'MENTOR_SESSION_REFUNDED',
            title: count > 1 ? `Mentor Bookings Refunded (${count})` : 'Mentor Booking Refunded',
            message:
              count === 1
                ? `Your mentor was suspended. ₹${bucket.totalRefunded} has been refunded in full.`
                : `Your mentor was suspended. ₹${bucket.totalRefunded} refunded across ${count} bookings: ${formatGroupedItemList(groupedItems, 10)}`,
            readStatus: false,
            referenceId: bucket.refId,
            link: '/owner/mentors',
          }),
        );
      } catch {}
    }
  }

  findSession(id: string): MentorSessionEntity {
    const s = this.sessions.find((s) => s.id === id);
    if (!s) throw new NotFoundException(`Session ${id} not found`);
    return s;
  }

  resetLifecycle(): void {
    this.mentorActivities = [];
    this.abandonmentReviews = [];
    this.sessionFeedbacks = [];
    this.mentorAbandonmentHistory = [];
    this.disputes = [];
  }

  private clearProjectMentorSlot(project: any): void {
    if (!project) return;
    const prevMentorId = project.mentorId ? String(project.mentorId).trim() : '';
    const prevMentorResolved = prevMentorId ? this.resolveMentorUserId(prevMentorId) : '';

    project.mentorId = null as any;
    project.mentor = null as any;

    const patch: Record<string, any> = {
      mentorId: null,
      mentor: null,
    };

    const isStaleMentorEntry = (entry: any): boolean => {
      if (!entry || typeof entry !== 'object') return false;
      const role = String(entry.role || '').trim().toLowerCase();
      if (role === 'mentor') return true;
      return false;
    };

    if (Array.isArray(project.members)) {
      const cleanedMembers = project.members.filter((m: any) => !isStaleMentorEntry(m));
      project.members = cleanedMembers;
      patch.members = cleanedMembers;
    }

    if (Array.isArray(project.collaborators)) {
      const cleanedCollaborators = project.collaborators.filter((c: any) => {
        if (isStaleMentorEntry(c)) return false;
        // Also clean any collaborator entry whose ID matches prevMentorId ONLY if it lacked an explicit collaborator role
        if (typeof c === 'object' && !c.role && prevMentorId) {
          const cid = String(c.userId || c.id || '').trim();
          const cResolved = cid ? this.resolveMentorUserId(cid) : '';
          if (cid === prevMentorId || (prevMentorResolved && cResolved === prevMentorResolved)) {
            return false;
          }
        }
        return true;
      });
      project.collaborators = cleanedCollaborators;
      patch.collaborators = cleanedCollaborators;
    }

    if (typeof this.projectsRepository?.update === 'function') {
      this.projectsRepository.update(project.id, patch as any);
    }
  }

  private resolveMentorUserId(mentorIdOrProfileId: string): string {
    const strId = String(mentorIdOrProfileId || '').trim();
    const byProfile = this.profiles.find((p) => String(p.id) === strId || String(p.userId) === strId);
    return byProfile ? String(byProfile.userId) : strId;
  }

  private getCurrentMs(): number {
    return (this.clockService ? this.clockService.now() : new Date()).getTime();
  }

  private getCurrentIso(): string {
    return this.clockService ? this.clockService.nowIso() : new Date().toISOString();
  }

  initMentorAssignmentActivity(projectId: string, mentorIdOrProfileId: string, assignedAtIso?: string): void {
    const pid = String(projectId);
    const mid = this.resolveMentorUserId(mentorIdOrProfileId);
    const ts = assignedAtIso || this.getCurrentIso();
    const existing = this.mentorActivities.find((a) => a.projectId === pid && a.mentorId === mid);
    if (!existing) {
      this.mentorActivities.push({
        projectId: pid,
        mentorId: mid,
        assignedAt: ts,
      });
    } else {
      existing.assignedAt = ts;
      existing.firstWeekNoticeSentAt = undefined;
      existing.inactivity7dNotifiedAt = undefined;
    }
  }

  recordMentorActivity(
    projectId: string,
    mentorIdOrProfileId: string,
    activityType: 'chat_message' | 'session_note' | 'badge_awarded' | 'session_held' | 'confirm_active',
    customNowIso?: string,
  ): void {
    if (!projectId || !mentorIdOrProfileId) return;
    const pid = String(projectId);
    const mid = this.resolveMentorUserId(mentorIdOrProfileId);
    const nowIso = customNowIso || this.getCurrentIso();

    let record = this.mentorActivities.find((a) => a.projectId === pid && a.mentorId === mid);
    if (!record) {
      record = {
        projectId: pid,
        mentorId: mid,
        assignedAt: nowIso,
      };
      this.mentorActivities.push(record);
    }
    record.lastActivityAt = nowIso;
    record.lastActivityType = activityType;
    record.inactivity7dNotifiedAt = undefined;

    try {
      const project = this.projectsRepository?.findById?.(pid);
      if (project && String(project.mentorId) === mid) {
        (project as any).mentorLastActivityAt = nowIso;
        this.projectsRepository.update(pid, { mentorLastActivityAt: nowIso } as any);
      }
    } catch {}
  }

  getMentorActivitySummary(projectId: string, mentorIdOrProfileId?: string): {
    assignedAt: string | null;
    lastActivityAt: string | null;
    inactiveDays: number;
    hasRecentActivityInLast7d: boolean;
  } {
    const pid = String(projectId);
    const project = this.projectsRepository?.findById?.(pid);
    const resolvedMid = mentorIdOrProfileId
      ? this.resolveMentorUserId(mentorIdOrProfileId)
      : (project?.mentorId ? String(project.mentorId) : '');
    if (!resolvedMid) {
      return {
        assignedAt: null,
        lastActivityAt: null,
        inactiveDays: 0,
        hasRecentActivityInLast7d: true,
      };
    }

    const record = this.mentorActivities.find((a) => a.projectId === pid && a.mentorId === resolvedMid);
    const activeSess = this.sessions.find(
      (s) =>
        String(s.projectId) === pid &&
        (String(s.mentorId) === resolvedMid || this.resolveMentorUserId(s.mentorId) === resolvedMid) &&
        s.status === 'active',
    );
    const assignedAt =
      record?.assignedAt ||
      activeSess?.startedAt ||
      (project?.createdAt ? new Date(project.createdAt).toISOString() : this.getCurrentIso());
    const lastActivityAt = record?.lastActivityAt || (project as any)?.mentorLastActivityAt || null;

    const nowMs = this.getCurrentMs();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const refIso = lastActivityAt || assignedAt;
    const refMs = new Date(refIso).getTime();
    const elapsedMs = !Number.isNaN(refMs) && refMs > 0 ? Math.max(0, nowMs - refMs) : 0;

    return {
      assignedAt,
      lastActivityAt,
      inactiveDays: Math.floor(elapsedMs / (24 * 60 * 60 * 1000)),
      hasRecentActivityInLast7d: elapsedMs < SEVEN_DAYS_MS,
    };
  }

  addSessionNote(sessionId: string, callerUserId: string, noteText: string, isPrivileged = false): MentorSessionEntity {
    const session = this.findSession(sessionId);
    const trimmed = String(noteText || '').trim();
    if (!trimmed || trimmed.length > 2000) {
      throw new BadRequestException('Session note must be between 1 and 2000 characters.');
    }

    const profile = this.profiles.find((p) => String(p.id) === String(session.mentorId));
    const mentorUserId = profile ? String(profile.userId) : String(session.mentorId);
    const isMentorCaller = String(callerUserId) === mentorUserId || String(callerUserId) === String(session.mentorId);
    const isOwnerCaller = String(callerUserId) === String(session.studentId);

    if (!isPrivileged && !isMentorCaller && !isOwnerCaller) {
      throw new ForbiddenException('Only session participants or admins can save session notes.');
    }

    const nowIso = this.getCurrentIso();
    if (!Array.isArray(session.notes)) {
      session.notes = [];
    }
    session.notes.push({
      id: randomUUID(),
      authorId: String(callerUserId || 'System'),
      note: trimmed,
      createdAt: nowIso,
    });

    if (isMentorCaller && session.projectId) {
      this.recordMentorActivity(session.projectId, mentorUserId, 'session_note', nowIso);
    }

    return this.enrichSession(session);
  }

  openAbandonmentReview(projectId: string, callerUserId: string, reason?: string): AbandonmentReviewEntity {
    const project = this.projectsRepository?.findById?.(projectId);
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found.`);
    }

    const isOwner = isProjectOwner(project, callerUserId) || String(project.ownerId) === String(callerUserId);
    if (!isOwner) {
      throw new ForbiddenException('Only the project owner can open a mentor abandonment review.');
    }

    if (!project.mentorId) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'NO_MENTOR_ASSIGNED',
        message: 'This project does not have an assigned mentor.',
      });
    }

    const mentorUserId = this.resolveMentorUserId(String(project.mentorId));
    const mentorProfile = this.profiles.find((p) => String(p.userId) === mentorUserId);

    const existingOpen = this.abandonmentReviews.find(
      (r) => String(r.projectId) === String(projectId) && r.status === 'open',
    );
    if (existingOpen) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'REVIEW_ALREADY_OPEN',
        message: 'An abandonment review is already open for this project.',
      });
    }

    const nowMs = this.getCurrentMs();
    const nowIso = this.getCurrentIso();
    const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

    const latestPrior = [...this.abandonmentReviews]
      .filter(
        (r) =>
          String(r.projectId) === String(projectId) &&
          String(r.mentorId) === mentorUserId &&
          (r.status === 'cancelled' || r.status === 'confirmed'),
      )
      .sort((a, b) => new Date(b.decidedAt || b.openedAt).getTime() - new Date(a.decidedAt || a.openedAt).getTime())[0];

    if (latestPrior) {
      const priorMs = new Date(latestPrior.decidedAt || latestPrior.openedAt).getTime();
      if (!Number.isNaN(priorMs) && nowMs - priorMs < FOURTEEN_DAYS_MS) {
        const availableAt = new Date(priorMs + FOURTEEN_DAYS_MS).toISOString();
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          code: 'REVIEW_COOLDOWN',
          availableAt,
          message: `Another abandonment review cannot be opened within 14 days of the previous cancelled or confirmed review (available at ${availableAt}).`,
        });
      }
    }

    const summary = this.getMentorActivitySummary(projectId, mentorUserId);
    if (summary.hasRecentActivityInLast7d) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'MENTOR_STILL_ACTIVE',
        message: 'Mentor has recorded activity within the last 7 days and cannot be reported as inactive.',
      });
    }

    const deadlineIso = new Date(nowMs + 48 * 60 * 60 * 1000).toISOString();
    const review: AbandonmentReviewEntity = {
      id: randomUUID(),
      projectId: String(projectId),
      mentorId: mentorUserId,
      mentorProfileId: mentorProfile?.id,
      openedBy: String(callerUserId),
      status: 'open',
      openedAt: nowIso,
      deadlineAt: deadlineIso,
      reason: reason?.trim() || undefined,
    };
    this.abandonmentReviews.push(review);

    try {
      this.notificationsService.create({
        userId: mentorUserId,
        type: 'MENTOR_ABANDONMENT_REVIEW_OPENED',
        title: 'Action Required: Confirm Active Mentorship',
        message: `The owner of "${project.title || project.name}" opened an inactivity abandonment review. Confirm you are still active within 48 hours or you will be unassigned.`,
        readStatus: false,
        referenceId: review.id,
        link: `/mentor/projects`,
        metadata: { projectId: project.id, reviewId: review.id, deadlineAt: deadlineIso },
      });
    } catch {}

    try {
      this.auditService.log({
        action: 'mentor-abandonment-review-opened',
        actor: String(callerUserId),
        target: mentorUserId,
        entityType: 'abandonment_review',
        entityId: review.id,
        event: `Owner opened 48h mentor abandonment review for project "${project.title || project.name}"`,
        details: { projectId, mentorId: mentorUserId, deadlineAt: deadlineIso },
      });
    } catch {}

    return review;
  }

  confirmAbandonmentReview(reviewId: string, mentorUserId: string): AbandonmentReviewEntity {
    const review = this.abandonmentReviews.find((r) => r.id === reviewId);
    if (!review) {
      throw new NotFoundException(`Abandonment review ${reviewId} not found.`);
    }

    const callerCanonical = this.resolveMentorUserId(mentorUserId);
    if (String(review.mentorId) !== callerCanonical && String(review.mentorId) !== String(mentorUserId)) {
      throw new ForbiddenException('Only the assigned mentor can confirm this review.');
    }

    if (review.status !== 'open') {
      throw new ConflictException(`Review is already ${review.status}.`);
    }

    const nowIso = this.getCurrentIso();
    review.status = 'confirmed';
    review.decidedAt = nowIso;

    // Restart the 7-day activity clock immediately
    this.recordMentorActivity(review.projectId, review.mentorId, 'confirm_active', nowIso);

    const project = this.projectsRepository?.findById?.(review.projectId);
    if (project?.ownerId) {
      try {
        this.notificationsService.create({
          userId: String(project.ownerId),
          type: 'MENTOR_REVIEW_CONFIRMED',
          title: 'Mentor Confirmed Active',
          message: `Your mentor confirmed they are still active on "${project.title || project.name}".`,
          readStatus: false,
          referenceId: project.id,
          link: `/owner/workspace/${project.id}`,
        });
      } catch {}
    }

    try {
      this.auditService.log({
        action: 'mentor-abandonment-review-confirmed',
        actor: callerCanonical,
        target: review.id,
        entityType: 'abandonment_review',
        entityId: review.id,
        event: `Mentor confirmed activity on project #${review.projectId}; 7-day clock restarted.`,
        details: { projectId: review.projectId },
      });
    } catch {}

    return review;
  }

  cancelAbandonmentReview(reviewId: string, adminUserId: string, reason?: string): AbandonmentReviewEntity {
    const review = this.abandonmentReviews.find((r) => r.id === reviewId);
    if (!review) {
      throw new NotFoundException(`Abandonment review ${reviewId} not found.`);
    }
    const trimmed = String(reason || '').trim();
    if (!trimmed) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'REASON_REQUIRED',
        message: 'A cancellation reason is required.',
      });
    }
    if (review.status !== 'open') {
      throw new ConflictException(`Review is already ${review.status}.`);
    }

    const nowIso = this.getCurrentIso();
    review.status = 'cancelled';
    review.decidedAt = nowIso;
    review.cancelledBy = String(adminUserId);
    review.reason = trimmed;

    const project = this.projectsRepository?.findById?.(review.projectId);
    const projectTitle = project?.title || project?.name || review.projectId;
    try {
      if (project?.ownerId) {
        this.notificationsService.create({
          userId: String(project.ownerId),
          type: 'MENTOR_REVIEW_CANCELLED',
          title: 'Abandonment Review Cancelled by Admin',
          message: `An admin cancelled the mentor abandonment review on "${projectTitle}". Reason: ${trimmed}`,
          readStatus: false,
          referenceId: review.projectId,
          link: `/owner/workspace/${review.projectId}`,
        });
      }
      this.notificationsService.create({
        userId: String(review.mentorId),
        type: 'MENTOR_REVIEW_CANCELLED',
        title: 'Abandonment Review Cancelled',
        message: `An admin cancelled the abandonment review on "${projectTitle}". Reason: ${trimmed}`,
        readStatus: false,
        referenceId: review.id,
      });
    } catch {}

    try {
      this.auditService.log({
        action: 'mentor-abandonment-review-cancelled',
        actor: String(adminUserId),
        target: review.id,
        entityType: 'abandonment_review',
        entityId: review.id,
        event: `Admin cancelled mentor abandonment review: ${trimmed}`,
        details: { projectId: review.projectId, reason: trimmed },
      });
    } catch {}

    return review;
  }

  getAbandonmentReviewForProject(projectId: string, callerUserId: string, callerRole?: string) {
    const project = this.projectsRepository?.findById?.(projectId);
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found.`);
    }
    const roleLower = String(callerRole || '').toLowerCase();
    const isAdmin = roleLower === 'admin' || roleLower === 'superuser' || roleLower === 'administrator' || roleLower === 'portal_admin';
    const isOwner = isProjectOwner(project, callerUserId) || String(project.ownerId) === String(callerUserId);
    const mentorUid = project.mentorId ? this.resolveMentorUserId(String(project.mentorId)) : null;
    const isProjectMentor = Boolean(
      mentorUid && (String(callerUserId) === mentorUid || String(callerUserId) === String(project.mentorId)),
    );
    const reviewsForProj = this.abandonmentReviews.filter((r) => String(r.projectId) === String(projectId));
    const isReviewMentor = reviewsForProj.some((r) => String(r.mentorId) === String(callerUserId));

    if (!isAdmin && !isOwner && !isProjectMentor && !isReviewMentor) {
      throw new ForbiddenException('Only the project owner, assigned mentor, or an admin can inspect mentor abandonment status.');
    }

    const openReview = reviewsForProj.find((r) => r.status === 'open');
    const latestReview = openReview || [...reviewsForProj].sort((a, b) => b.openedAt.localeCompare(a.openedAt))[0] || null;
    const summary = this.getMentorActivitySummary(projectId);

    return {
      ...(latestReview || { id: null, status: null, projectId: String(projectId) }),
      review: latestReview,
      ...summary,
    };
  }

  getOpenReviewsForMentor(mentorUserId: string): AbandonmentReviewEntity[] {
    const canonical = this.resolveMentorUserId(mentorUserId);
    return this.abandonmentReviews
      .filter((r) => r.status === 'open' && (String(r.mentorId) === canonical || String(r.mentorId) === String(mentorUserId)))
      .map((r) => {
        const proj = this.projectsRepository?.findById?.(r.projectId);
        return { ...r, projectTitle: proj?.title || proj?.name || r.projectId } as any;
      });
  }

  /**
   * Hourly job 11: release open abandonment reviews past their 48-hour deadline.
   */
  processExpiredAbandonmentReviews(): { releasedReviews: string[]; refundedSessions: string[]; errors: string[]; skippedNotLive: number } {
    const nowMs = this.getCurrentMs();
    const nowIso = this.getCurrentIso();
    const releasedReviews: string[] = [];
    const refundedSessions: string[] = [];
    const errors: string[] = [];
    let skippedNotLive = 0;
    const ownerReleasedNotices = new Map<string, { items: NotificationGroupedItem[]; refProjectId: string }>();
    const mentorReleasedNotices = new Map<string, { items: NotificationGroupedItem[]; refReviewId: string }>();

    for (const review of this.abandonmentReviews) {
      if (review.status !== 'open') continue;
      const project = review.projectId && typeof this.projectsRepository?.findById === 'function'
        ? this.projectsRepository.findById(review.projectId, true)
        : undefined;
      if (review.projectId && typeof this.projectsRepository?.findById === 'function' && !isLiveProject(project)) {
        skippedNotLive += 1;
        continue;
      }
      const deadlineMs = new Date(review.deadlineAt).getTime();
      if (Number.isNaN(deadlineMs) || nowMs < deadlineMs) continue;

      try {
        review.status = 'released';
        review.decidedAt = nowIso;

        const projectTitle = project?.title || project?.name || review.projectId;
        const mentorProfile = this.profiles.find(
          (p) => String(p.userId) === String(review.mentorId) || String(p.id) === String(review.mentorProfileId),
        );

        let refundedCount = 0;
        const matchingSessions = this.sessions.filter(
          (s) =>
            String(s.projectId) === String(review.projectId) &&
            s.status !== 'disputed' &&
            !this.hasOpenDispute(s.id) &&
            (String(s.mentorId) === String(review.mentorId) ||
              (mentorProfile && String(s.mentorId) === String(mentorProfile.id))),
        );

        for (const sess of matchingSessions) {
          if (sess.status === 'payment_pending') {
            sess.status = 'cancelled';
            sess.declineReason = 'Mentor unassigned after 48-hour abandonment review timeout';
            refundedCount += 1;
            refundedSessions.push(sess.id);
          } else if (sess.status === 'escrow_funded' || sess.status === 'active') {
            try {
              this.escrowService.refund(sess.escrowId);
            } catch (err: any) {
              errors.push(`Escrow refund failed for session ${sess.id}: ${err?.message || err}`);
            }
            sess.status = 'refunded';
            sess.declineReason = 'Mentor unassigned after 48-hour abandonment review timeout';
            refundedCount += 1;
            refundedSessions.push(sess.id);
          }
        }

        if (project) {
          this.clearProjectMentorSlot(project);
        }

        this.mentorAbandonmentHistory.push({
          id: randomUUID(),
          reviewId: review.id,
          projectId: review.projectId,
          projectTitle,
          mentorId: mentorProfile?.id || review.mentorId,
          mentorUserId: review.mentorId,
          releasedAt: nowIso,
          reason: review.reason || 'No confirmation within 48 hours of abandonment review',
          refundedSessionsCount: refundedCount,
        });

        if (project?.ownerId) {
          const oid = String(project.ownerId);
          if (!ownerReleasedNotices.has(oid)) {
            ownerReleasedNotices.set(oid, { items: [], refProjectId: review.projectId });
          }
          ownerReleasedNotices.get(oid)!.items.push({
            label: projectTitle,
            link: `/owner/workspace/${review.projectId}`,
          });
        }
        const mUid = String(review.mentorId);
        if (!mentorReleasedNotices.has(mUid)) {
          mentorReleasedNotices.set(mUid, { items: [], refReviewId: review.id });
        }
        mentorReleasedNotices.get(mUid)!.items.push({
          label: projectTitle,
          link: `/mentor/requests`,
        });

        try {
          this.auditService.log({
            action: 'mentor-abandonment-released',
            actor: 'System',
            target: review.mentorId,
            entityType: 'abandonment_review',
            entityId: review.id,
            event: `Mentor ${review.mentorId} released from project ${review.projectId}; ${refundedCount} uncompleted session(s) refunded.`,
            details: { projectId: review.projectId, refundedCount },
          });
        } catch {}

        releasedReviews.push(review.id);
      } catch (err: any) {
        errors.push(err?.message || String(err));
      }
    }

    const abRunKey = nowIso.slice(0, 13);
    for (const [ownerId, bucket] of ownerReleasedNotices.entries()) {
      try {
        dispatchGroupedNotification(
          this.notificationsService,
          ownerId,
          `mentor_abandonment_owner:${abRunKey}`,
          bucket.items,
          (groupedItems, count) => ({
            type: 'MENTOR_ABANDONMENT_RELEASED',
            title: count > 1 ? `Mentors Released & Escrow Refunded (${count})` : 'Mentor Released & Escrow Refunded',
            message:
              count === 1
                ? `Your mentor did not confirm within 48 hours on "${groupedItems[0].label}". The mentor slot is now free and uncompleted session escrow has been refunded in full.`
                : `${count} mentors were released after 48-hour abandonment timeouts (slots freed & escrow refunded): ${formatGroupedItemList(groupedItems, 10)}`,
            readStatus: false,
            referenceId: bucket.refProjectId,
            link: groupedItems[0]?.link || `/owner/workspace/${bucket.refProjectId}`,
          }),
        );
      } catch {}
    }
    for (const [mentorId, bucket] of mentorReleasedNotices.entries()) {
      try {
        dispatchGroupedNotification(
          this.notificationsService,
          mentorId,
          `mentor_abandonment_mentor:${abRunKey}`,
          bucket.items,
          (groupedItems, count) => ({
            type: 'MENTOR_ABANDONMENT_RELEASED',
            title: count > 1 ? `Unassigned From Projects (${count})` : 'Unassigned From Project Due to Inactivity',
            message:
              count === 1
                ? `You were unassigned from "${groupedItems[0].label}" after no response within the 48-hour abandonment review window.`
                : `You were unassigned from ${count} projects after no response within 48-hour abandonment windows: ${formatGroupedItemList(groupedItems, 10)}`,
            readStatus: false,
            referenceId: bucket.refReviewId,
          }),
        );
      } catch {}
    }

    return { releasedReviews, refundedSessions, errors, skippedNotLive };
  }

  /**
   * Hourly job 12: send first-week (7-day) and 7-day idle notices for active mentored projects (once per idle spell).
   */
  checkMentorActivityNotices(): { firstWeekNotices: string[]; idle7dNotices: string[]; errors: string[]; skippedNotLive: number } {
    const nowMs = this.getCurrentMs();
    const nowIso = this.getCurrentIso();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

    const firstWeekNotices: string[] = [];
    const idle7dNotices: string[] = [];
    const errors: string[] = [];
    let skippedNotLive = 0;
    const firstWeekByOwner = new Map<string, { items: NotificationGroupedItem[]; refProjectId: string }>();
    const idle7dByOwner = new Map<string, { items: NotificationGroupedItem[]; refProjectId: string }>();

    const allProjects = typeof this.projectsRepository?.findAll === 'function'
      ? this.projectsRepository.findAll(true)
      : [];

    for (const project of allProjects) {
      if (!project) continue;
      if (!isLiveProject(project)) {
        skippedNotLive += 1;
        continue;
      }
      if (!project.mentorId) continue;

      const mentorUid = this.resolveMentorUserId(String(project.mentorId));
      let record = this.mentorActivities.find((a) => a.projectId === String(project.id) && a.mentorId === mentorUid);
      if (!record) {
        const activeSess = this.sessions.find(
          (s) =>
            String(s.projectId) === String(project.id) &&
            this.resolveMentorUserId(s.mentorId) === mentorUid &&
            s.status === 'active',
        );
        const baseline =
          activeSess?.startedAt ||
          (project.createdAt ? new Date(project.createdAt).toISOString() : undefined);
        if (!baseline) continue;
        record = {
          projectId: String(project.id),
          mentorId: mentorUid,
          assignedAt: baseline,
          lastActivityAt: (project as any).mentorLastActivityAt,
        };
        this.mentorActivities.push(record);
      }

      const projectTitle = project.title || project.name || project.id;

      if (!record.lastActivityAt) {
        const assignedMs = new Date(record.assignedAt).getTime();
        if (!Number.isNaN(assignedMs) && nowMs - assignedMs >= SEVEN_DAYS_MS && !record.firstWeekNoticeSentAt) {
          try {
            if (project.ownerId) {
              const oid = String(project.ownerId);
              if (!firstWeekByOwner.has(oid)) firstWeekByOwner.set(oid, { items: [], refProjectId: project.id });
              firstWeekByOwner.get(oid)!.items.push({
                label: projectTitle,
                link: `/owner/workspace/${project.id}`,
              });
            }
            record.firstWeekNoticeSentAt = nowIso;
            firstWeekNotices.push(project.id);
          } catch (err: any) {
            errors.push(err?.message || String(err));
          }
        }
      } else {
        const lastMs = new Date(record.lastActivityAt).getTime();
        if (!Number.isNaN(lastMs) && nowMs - lastMs >= SEVEN_DAYS_MS && !record.inactivity7dNotifiedAt) {
          try {
            if (project.ownerId) {
              const oid = String(project.ownerId);
              if (!idle7dByOwner.has(oid)) idle7dByOwner.set(oid, { items: [], refProjectId: project.id });
              idle7dByOwner.get(oid)!.items.push({
                label: projectTitle,
                link: `/owner/workspace/${project.id}`,
              });
            }
            record.inactivity7dNotifiedAt = nowIso;
            idle7dNotices.push(project.id);
          } catch (err: any) {
            errors.push(err?.message || String(err));
          }
        }
      }
    }

    const actRunKey = nowIso.slice(0, 13);
    for (const [ownerId, bucket] of firstWeekByOwner.entries()) {
      try {
        dispatchGroupedNotification(
          this.notificationsService,
          ownerId,
          `mentor_first_week_inactive:${actRunKey}`,
          bucket.items,
          (groupedItems, count) => ({
            type: 'MENTOR_FIRST_WEEK_INACTIVE',
            title: count > 1 ? `Mentor First-Week Inactivity (${count})` : 'Mentor First-Week Inactivity',
            message:
              count === 1
                ? `Your mentor has shown no activity in their first week on "${groupedItems[0].label}". You may open an abandonment review.`
                : `Your mentors have shown no first-week activity on ${count} projects: ${formatGroupedItemList(groupedItems, 10)}`,
            readStatus: false,
            referenceId: bucket.refProjectId,
            link: groupedItems[0]?.link,
          }),
        );
      } catch {}
    }
    for (const [ownerId, bucket] of idle7dByOwner.entries()) {
      try {
        dispatchGroupedNotification(
          this.notificationsService,
          ownerId,
          `mentor_inactive_7d:${actRunKey}`,
          bucket.items,
          (groupedItems, count) => ({
            type: 'MENTOR_INACTIVE_7D',
            title: count > 1 ? `Mentors Inactive for 7 Days (${count})` : 'Mentor Inactive for 7 Days',
            message:
              count === 1
                ? `Your mentor on "${groupedItems[0].label}" has had no activity for 7 days. You may open an abandonment review.`
                : `Mentors on ${count} projects have had no activity for 7 days: ${formatGroupedItemList(groupedItems, 10)}`,
            readStatus: false,
            referenceId: bucket.refProjectId,
            link: groupedItems[0]?.link,
          }),
        );
      } catch {}
    }

    return { firstWeekNotices, idle7dNotices, errors, skippedNotLive };
  }

  /**
   * Post-session private feedback (once per completed session, owner only, rating 1-5, optional comment <= 500 chars).
   * Visible to admins in full and to the mentor only as aggregate average (never affects payout).
   */
  submitSessionFeedback(
    sessionId: string,
    callerUserId: string,
    body: { rating?: any; comment?: string },
  ): { id: string; sessionId: string; rating: number; createdAt: string } {
    const session = this.findSession(sessionId);
    const project = this.projectsRepository?.findById?.(session.projectId);
    const isOwner =
      String(session.studentId) === String(callerUserId) ||
      Boolean(project && (isProjectOwner(project, callerUserId) || String(project.ownerId) === String(callerUserId)));
    if (!isOwner) {
      throw new ForbiddenException('Only the owner of this session can submit post-session feedback.');
    }

    if (session.status !== 'completed') {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'SESSION_NOT_COMPLETED',
        message: 'Feedback can only be submitted after the session is completed.',
      });
    }

    const rawRating = body?.rating;
    const ratingNum = typeof rawRating === 'number' ? rawRating : Number(rawRating);
    if (
      rawRating === undefined ||
      rawRating === null ||
      rawRating === '' ||
      typeof rawRating === 'boolean' ||
      !Number.isInteger(ratingNum) ||
      ratingNum < 1 ||
      ratingNum > 5
    ) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'INVALID_RATING',
        message: 'Rating must be a whole number from 1 to 5.',
      });
    }

    const commentStr = body?.comment !== undefined && body?.comment !== null ? String(body.comment).trim() : undefined;
    if (commentStr && commentStr.length > 500) {
      throw new BadRequestException('Feedback comment cannot exceed 500 characters.');
    }

    if (this.sessionFeedbacks.some((f) => String(f.sessionId) === String(sessionId))) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'ALREADY_RATED',
        message: 'Post-session feedback has already been submitted for this session.',
      });
    }

    const mentorUserId = this.resolveMentorUserId(session.mentorId);
    const nowIso = this.getCurrentIso();
    const record: SessionFeedbackEntity = {
      id: randomUUID(),
      sessionId: session.id,
      mentorId: session.mentorId,
      mentorUserId,
      projectId: session.projectId,
      studentId: String(callerUserId),
      rating: ratingNum,
      comment: commentStr || undefined,
      createdAt: nowIso,
    };
    this.sessionFeedbacks.push(record);
    session.hasFeedback = true;

    const mentorFeedback = this.sessionFeedbacks.filter(
      (f) => String(f.mentorId) === String(session.mentorId) || String(f.mentorUserId) === mentorUserId,
    );
    const profile = this.profiles.find(
      (p) => String(p.id) === String(session.mentorId) || String(p.userId) === mentorUserId,
    );
    if (profile && mentorFeedback.length > 0) {
      profile.rating = Math.round(
        (mentorFeedback.reduce((sum, f) => sum + f.rating, 0) / mentorFeedback.length) * 10,
      ) / 10;
    }

    try {
      this.auditService.log({
        action: 'session-feedback-submitted',
        actor: String(callerUserId),
        target: session.id,
        entityType: 'mentor_session',
        entityId: session.id,
        event: `Owner submitted post-session rating (${ratingNum}/5) for session #${session.id}`,
        details: { mentorUserId, rating: ratingNum },
      });
    } catch {}

    return {
      id: record.id,
      sessionId: record.sessionId,
      rating: record.rating,
      createdAt: record.createdAt,
    };
  }

  getAdminMentorFeedback(mentorIdOrUserId: string) {
    const profile = this.profiles.find(
      (p) => String(p.id) === String(mentorIdOrUserId) || String(p.userId) === String(mentorIdOrUserId),
    );
    const mentorUserId = profile ? String(profile.userId) : String(mentorIdOrUserId);
    const mentorUser = this.usersService.findUserSafe(mentorUserId);
    const mentorName = profile?.name || mentorUser?.name || mentorUserId;

    const feedback = this.sessionFeedbacks
      .filter((f) => String(f.mentorUserId) === mentorUserId || (profile && String(f.mentorId) === String(profile.id)))
      .map((f) => {
        const ownerUser = this.usersService.findUserSafe(f.studentId);
        return {
          ...f,
          ownerName: ownerUser?.name || f.studentId,
        };
      });

    const averageRating = feedback.length > 0
      ? Math.round((feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length) * 10) / 10
      : null;

    const abandonmentHistory = this.mentorAbandonmentHistory.filter(
      (h) => String(h.mentorUserId) === mentorUserId || (profile && String(h.mentorId) === String(profile.id)),
    );

    return {
      mentorId: profile?.id || mentorUserId,
      mentorUserId,
      mentorName,
      averageRating,
      totalFeedbackCount: feedback.length,
      feedback,
      abandonmentHistory,
    };
  }

  getMentorPrivateStats(mentorUserId: string) {
    const canonical = this.resolveMentorUserId(mentorUserId);
    const profile = this.profiles.find((p) => String(p.userId) === canonical);
    const feedback = this.sessionFeedbacks.filter(
      (f) => String(f.mentorUserId) === canonical || (profile && String(f.mentorId) === String(profile.id)),
    );
    const averageRating = feedback.length > 0
      ? Math.round((feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length) * 10) / 10
      : (profile?.rating ?? null);
    const completedSessions = this.sessions.filter(
      (s) =>
        (String(s.mentorId) === canonical || (profile && String(s.mentorId) === String(profile.id))) &&
        s.status === 'completed',
    ).length;

    return {
      mentorUserId: canonical,
      profileId: profile?.id || null,
      averageRating,
      totalFeedbackCount: feedback.length,
      completedSessions,
      activeMenteesCount: profile ? this.getActiveMenteeCount(profile) : 0,
      maxActiveMentees: profile?.maxActiveMentees ?? 3,
      openAbandonmentReviews: this.getOpenReviewsForMentor(canonical),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 17: Escrow Disputes & Project Financial Escrow Summary
  // ─────────────────────────────────────────────────────────────────────────

  async openSessionDispute(
    sessionId: string,
    callerId: string,
    rawReason: string,
    isPrivileged = false,
  ): Promise<SessionDisputeEntity> {
    const trimmedReason = typeof rawReason === 'string' ? rawReason.trim() : '';
    if (!trimmedReason || trimmedReason.length < 10 || trimmedReason.length > 1000) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'REASON_REQUIRED',
        message: 'Dispute reason is required and must be between 10 and 1000 characters.',
      });
    }

    return this.runInSessionQueue(sessionId, async () => {
      const session = this.findSession(sessionId);
      const profile = this.profiles.find((p) => String(p.id) === String(session.mentorId));
      const mentorUserId = profile?.userId ? String(profile.userId) : String(session.mentorId);

      const isOwnerParty = String(session.studentId) === String(callerId);
      const isMentorParty =
        String(session.mentorId) === String(callerId) || mentorUserId === String(callerId);

      if (!isPrivileged && !isOwnerParty && !isMentorParty) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'Forbidden',
          code: 'NOT_SESSION_PARTY',
          message: 'Only the project owner or assigned mentor can dispute this session.',
        });
      }

      this.assertNotNeedsReview(session);

      const existing = this.findDisputeForSession(sessionId);
      if (existing) {
        if (existing.status === 'open') {
          throw new ConflictException({
            statusCode: 409,
            error: 'Conflict',
            code: 'DISPUTE_ALREADY_OPEN',
            message: 'A dispute is already open for this session.',
          });
        }
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          code: 'DISPUTE_ALREADY_DECIDED',
          message: 'A dispute for this session has already been decided.',
        });
      }

      const disputableStatuses = ['escrow_funded', 'active', 'payout_pending', 'completed', 'refunded'];
      if (!disputableStatuses.includes(session.status)) {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          code: 'SESSION_NOT_DISPUTABLE',
          message: `Sessions in status '${session.status}' cannot be disputed.`,
        });
      }

      const nowMs = this.getCurrentMs();
      const nowIso = new Date(nowMs).toISOString();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

      // Dispute window: while booking is accepted or active, or within 7 days after it was released or refunded
      if (session.status === 'completed' || session.status === 'refunded') {
        const eventMs = new Date(
          session.completedAt || session.endedAt || session.refundedAt || session.createdAt,
        ).getTime();
        if (!Number.isNaN(eventMs) && nowMs - eventMs > sevenDaysMs) {
          throw new ConflictException({
            statusCode: 409,
            error: 'Conflict',
            code: 'DISPUTE_WINDOW_EXPIRED',
            message:
              'Disputes must be opened while booking is accepted or active, or within 7 days after it was released or refunded.',
          });
        }
      }

      const preStatus = session.status;
      session.preDisputeStatus = preStatus;
      session.status = 'disputed';
      session.disputed = true;
      if (session.escrowId) {
        try {
          this.escrowService.freezeForDispute(session.escrowId);
        } catch (err: any) {
          console.warn('[mentor-marketplace.service] Escrow freeze warning:', err?.message || err);
        }
      }

      const project = this.projectsRepository?.findById?.(session.projectId);
      const ownerUser = this.usersService?.findUserSafe?.(session.studentId);
      const dispute: SessionDisputeEntity = {
        id: `disp-${randomUUID().slice(0, 8)}-${nowMs}`,
        sessionId: session.id,
        projectId: session.projectId,
        projectTitle: project?.title || project?.name || session.projectName,
        mentorId: session.mentorId,
        mentorUserId,
        mentorName: profile?.name,
        studentId: session.studentId,
        studentName: ownerUser?.name || session.ownerName,
        openedBy: String(callerId),
        openedByRole: isOwnerParty ? 'owner' : isMentorParty ? 'mentor' : 'admin',
        reason: trimmedReason,
        status: 'open',
        preDisputeStatus: preStatus,
        openedAt: nowIso,
      };
      this.disputes.push(dispute);

      // Notify the other party
      const otherPartyId = isOwnerParty ? mentorUserId : session.studentId;
      if (otherPartyId) {
        try {
          this.notificationsService.create({
            userId: String(otherPartyId),
            type: 'ESCROW_DISPUTE_OPENED',
            title: 'Escrow Dispute Opened',
            message: `An escrow dispute was opened for session #${session.id} (${dispute.projectTitle || session.projectId}). Payout is frozen pending admin review. Reason: ${trimmedReason}`,
            readStatus: false,
            referenceId: session.id,
          });
        } catch {}
      }

      try {
        this.auditService.log({
          action: 'escrow-dispute-opened',
          actor: String(callerId),
          performedBy: String(callerId),
          target: `Session #${session.id}`,
          entityType: 'escrow_dispute',
          entityId: dispute.id,
          event: `Escrow dispute opened on session #${session.id} by ${dispute.openedByRole}`,
          details: { sessionId: session.id, projectId: session.projectId, reason: trimmedReason },
        });
      } catch {}

      return { ...dispute };
    });
  }

  listDisputes(status?: string): Array<SessionDisputeEntity & { session?: MentorSessionEntity }> {
    const normStatus = status ? String(status).toLowerCase() : '';
    return this.disputes
      .filter((d) => !normStatus || normStatus === 'all' || d.status === normStatus)
      .sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime())
      .map((d) => {
        const s = this.sessions.find((sess) => String(sess.id) === String(d.sessionId));
        return {
          ...d,
          session: s ? { ...s } : undefined,
        };
      });
  }

  async decideDispute(
    disputeId: string,
    adminId: string,
    dto: { decision?: DisputeDecision | string; mentorPercent?: number; reason?: string },
  ): Promise<{ dispute: SessionDisputeEntity; session: MentorSessionEntity }> {
    const existingDispute = this.disputes.find((d) => String(d.id) === String(disputeId));
    if (!existingDispute) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'Not Found',
        code: 'DISPUTE_NOT_FOUND',
        message: `Dispute ${disputeId} not found.`,
      });
    }

    if (existingDispute.status !== 'open') {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'DISPUTE_ALREADY_DECIDED',
        message: 'This escrow dispute has already been decided.',
      });
    }

    const decision = String(dto?.decision || '').trim() as DisputeDecision;
    if (!['release_to_mentor', 'refund_to_owner', 'split'].includes(decision)) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'INVALID_DECISION',
        message: 'Decision must be release_to_mentor, refund_to_owner, or split.',
      });
    }

    const reason = typeof dto?.reason === 'string' ? dto.reason.trim() : '';
    if (!reason || reason.length < 10 || reason.length > 500) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'REASON_REQUIRED',
        message: 'Decision reason is required and must be between 10 and 500 characters.',
      });
    }

    let pct: number | undefined;
    if (decision === 'split') {
      const rawPct = Number(dto?.mentorPercent);
      if (!Number.isFinite(rawPct) || rawPct < 0 || rawPct > 100) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          code: 'INVALID_PERCENT',
          message: 'mentorPercent must be a number between 0 and 100.',
        });
      }
      pct = Math.round(rawPct);
    }

    return this.runInSessionQueue(existingDispute.sessionId, async () => {
      const dispute = this.disputes.find((d) => String(d.id) === String(disputeId))!;
      if (dispute.status !== 'open') {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          code: 'DISPUTE_ALREADY_DECIDED',
          message: 'This escrow dispute has already been decided.',
        });
      }

      const session = this.findSession(dispute.sessionId);
      this.assertNotNeedsReview(session);
      const profile = this.profiles.find((p) => String(p.id) === String(session.mentorId));
      const breakdown = calculateEscrowBreakdown(session.agreedPrice || 0);
      const totalSessionAmount = session.totalAmount ?? breakdown.totalAmount;
      const nowIso = this.getCurrentIso();

      let mentorAmount = 0;
      let platformFee = 0;
      let gatewayFee = 0;
      let ownerRefundAmount = 0;
      let mentorUnassigned = false;

      if (decision === 'release_to_mentor' || (decision === 'split' && pct === 100)) {
        if (session.escrowId) {
          this.escrowService.release(session.escrowId);
        }
        mentorAmount = breakdown.mentorPayout;
        platformFee = breakdown.platformFee;
        gatewayFee = breakdown.gatewayFee;
        ownerRefundAmount = 0;
        this.payoutsService.recordTransaction({
          payerId: 'platform',
          payeeId: profile?.userId ?? session.mentorId,
          amount: mentorAmount,
          type: 'mentor_session_payout',
        });
        if (profile && profile.totalSessions !== undefined) profile.totalSessions += 1;
        session.status = 'completed';
        session.completedAt = nowIso;
        session.payout = mentorAmount;
        session.platformFee = platformFee;
        session.gatewayFee = gatewayFee;
        session.refundAmount = 0;
        session.disputed = false;
      } else if (decision === 'refund_to_owner' || (decision === 'split' && pct === 0)) {
        if (session.escrowId) {
          this.escrowService.refund(session.escrowId);
        }
        mentorAmount = 0;
        platformFee = 0;
        gatewayFee = 0;
        ownerRefundAmount = totalSessionAmount;
        session.status = 'refunded';
        session.completedAt = nowIso;
        session.payout = 0;
        session.platformFee = 0;
        session.gatewayFee = 0;
        session.refundAmount = ownerRefundAmount;
        session.disputed = false;

        // Policy: Clear project mentor slot if assigned to this refunded mentor
        if (session.projectId && this.projectsRepository) {
          try {
            const project = this.projectsRepository.findById(session.projectId);
            if (project) {
              const projMentorId = String(project.mentorId || '');
              const sessMentorId = String(session.mentorId || '');
              const mentorProfileId = profile?.id ? String(profile.id) : '';
              const mentorUserId = profile?.userId
                ? String(profile.userId)
                : this.resolveMentorUserId(sessMentorId);

              const isIdMatch = (candidateId: string) => {
                if (!candidateId) return false;
                const resolved = this.resolveMentorUserId(candidateId);
                return Boolean(
                  candidateId === sessMentorId ||
                    (mentorProfileId && candidateId === mentorProfileId) ||
                    (mentorUserId && candidateId === mentorUserId) ||
                    (resolved && mentorUserId && resolved === mentorUserId),
                );
              };

              const hasMatchingMemberOrCollabMentor =
                (Array.isArray(project.members) &&
                  project.members.some(
                    (m: any) =>
                      String(m?.role || '').trim().toLowerCase() === 'mentor' &&
                      isIdMatch(String(m?.userId || m?.id || '').trim()),
                  )) ||
                (Array.isArray(project.collaborators) &&
                  project.collaborators.some(
                    (c: any) =>
                      String(c?.role || '').trim().toLowerCase() === 'mentor' &&
                      isIdMatch(String(c?.userId || c?.id || '').trim()),
                  ));

              const isMatchingMentor = Boolean(
                (projMentorId && isIdMatch(projMentorId)) || hasMatchingMemberOrCollabMentor,
              );

              if (isMatchingMentor) {
                this.clearProjectMentorSlot(project);
                mentorUnassigned = true;
              }
            }
          } catch (err: any) {
            console.warn('[mentor-marketplace.service] Error freeing project mentor slot on dispute refund:', err?.message || err);
          }
        }
      } else {
        mentorAmount = Math.round(breakdown.price * ((pct || 0) / 100));
        platformFee = Math.round(mentorAmount * 0.15);
        gatewayFee = 0;
        ownerRefundAmount = Math.max(0, totalSessionAmount - mentorAmount - platformFee);
        if (session.escrowId) {
          this.escrowService.split(session.escrowId, mentorAmount, platformFee, ownerRefundAmount);
        }
        if (mentorAmount > 0) {
          this.payoutsService.recordTransaction({
            payerId: 'platform',
            payeeId: profile?.userId ?? session.mentorId,
            amount: mentorAmount,
            type: 'mentor_session_payout',
          });
        }
        session.status = 'split';
        session.completedAt = nowIso;
        session.payout = mentorAmount;
        session.platformFee = platformFee;
        session.gatewayFee = 0;
        session.refundAmount = ownerRefundAmount;
        session.disputed = false;
      }

      dispute.status = 'decided';
      dispute.decision = decision;
      if (pct !== undefined) dispute.mentorPercent = pct;
      dispute.mentorAmount = mentorAmount;
      dispute.platformFee = platformFee;
      dispute.gatewayFee = gatewayFee;
      dispute.ownerRefundAmount = ownerRefundAmount;
      dispute.decidedBy = String(adminId);
      dispute.decisionReason = reason;
      dispute.decidedAt = nowIso;

      // Notify both owner and mentor
      const summaryLine =
        decision === 'release_to_mentor'
          ? `Released ₹${mentorAmount} to mentor`
          : decision === 'refund_to_owner'
            ? `Refunded ₹${ownerRefundAmount} to project owner`
            : `Split (${pct}% mentor: ₹${mentorAmount}, fee: ₹${platformFee}, owner refund: ₹${ownerRefundAmount})`;

      for (const recipient of [session.studentId, profile?.userId || session.mentorId]) {
        if (!recipient) continue;
        try {
          const isOwner = String(recipient) === String(session.studentId);
          let message = `${summaryLine}. Admin decision reason: ${reason}`;
          if (isOwner && mentorUnassigned) {
            message = `${summaryLine}. The mentor has been unassigned and the project is open for a new mentor booking. Admin decision reason: ${reason}`;
          }
          this.notificationsService.create({
            userId: String(recipient),
            type: 'ESCROW_DISPUTE_DECIDED',
            title: 'Escrow Dispute Decided',
            message,
            readStatus: false,
            referenceId: session.id,
          });
        } catch {}
      }

      try {
        const auditDetails: Record<string, any> = {
          disputeId: dispute.id,
          sessionId: session.id,
          decision,
          mentorPercent: pct,
          mentorAmount,
          platformFee,
          ownerRefundAmount,
          reason,
        };
        if (mentorUnassigned) {
          auditDetails.mentorUnassigned = true;
        }

        this.auditService.log({
          action: 'escrow-dispute-decided',
          actor: String(adminId),
          performedBy: String(adminId),
          target: `Session #${session.id}`,
          entityType: 'escrow_dispute',
          entityId: dispute.id,
          event: `Admin ${adminId} decided dispute ${dispute.id} (${decision}): ${summaryLine}`,
          details: auditDetails,
        });
      } catch {}

      return {
        dispute: { ...dispute },
        session: this.enrichSession(session),
      };
    });
  }

  getProjectEscrowSummary(projectId: string) {
    const project = this.projectsRepository?.findById?.(projectId);
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found.`);
    }

    const projectSessions = this.sessions.filter(
      (s) => String(s.projectId) === String(projectId),
    );

    let ownerPaidTotal = 0;
    let mentorPayoutTotal = 0;
    let platformFeeTotal = 0;
    let refundsTotal = 0;
    let inEscrowTotal = 0;

    const sessionRows = projectSessions.map((session) => {
      const breakdown = calculateEscrowBreakdown(session.agreedPrice || 0);
      const totalSessionAmount = session.totalAmount ?? breakdown.totalAmount;
      const payoutAmount = session.payout !== undefined ? session.payout : breakdown.mentorPayout;
      const feeSum =
        (session.platformFee !== undefined ? session.platformFee : breakdown.platformFee) +
        (session.gatewayFee !== undefined ? session.gatewayFee : breakdown.gatewayFee);

      let ownerPaid = 0;
      let mentorPayout = 0;
      let platformFee = 0;
      let refunds = 0;
      let inEscrow = 0;

      switch (session.status) {
        case 'completed':
          ownerPaid = totalSessionAmount;
          mentorPayout = payoutAmount;
          platformFee = feeSum;
          break;
        case 'split':
          ownerPaid = totalSessionAmount;
          mentorPayout = session.payout ?? 0;
          platformFee = (session.platformFee ?? 0) + (session.gatewayFee ?? 0);
          refunds = session.refundAmount ?? Math.max(0, totalSessionAmount - mentorPayout - platformFee);
          break;
        case 'refunded':
          ownerPaid = totalSessionAmount;
          refunds = session.refundAmount ?? totalSessionAmount;
          break;
        case 'disputed':
        case 'active':
        case 'escrow_funded':
        case 'payout_pending':
          ownerPaid = totalSessionAmount;
          inEscrow = totalSessionAmount;
          break;
        default:
          break;
      }

      ownerPaidTotal += ownerPaid;
      mentorPayoutTotal += mentorPayout;
      platformFeeTotal += platformFee;
      refundsTotal += refunds;
      inEscrowTotal += inEscrow;

      const dispute = this.findDisputeForSession(session.id) || null;
      const profile = this.profiles.find((p) => String(p.id) === String(session.mentorId));

      return {
        sessionId: session.id,
        mentorId: session.mentorId,
        mentorName: profile?.name || session.mentorId,
        status: session.status,
        agreedPrice: session.agreedPrice,
        ownerPaid,
        held: inEscrow,
        released: mentorPayout,
        refunded: refunds,
        platformFee,
        createdAt: session.createdAt,
        dispute,
      };
    });

    return {
      projectId: String(projectId),
      projectTitle: project.title || project.name || String(projectId),
      sessions: sessionRows,
      totals: {
        ownerPaid: ownerPaidTotal,
        mentorPayout: mentorPayoutTotal,
        platformFee: platformFeeTotal,
        refunds: refundsTotal,
        inEscrow: inEscrowTotal,
      },
      ok:
        Math.abs(
          ownerPaidTotal - (mentorPayoutTotal + platformFeeTotal + refundsTotal + inEscrowTotal),
        ) <= 0.01,
    };
  }

  notifyOverdueDisputesToSuperUser(): { notifiedDisputes: string[] } {
    const nowMs = this.getCurrentMs();
    const nowIso = new Date(nowMs).toISOString();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const notifiedDisputes: string[] = [];

    const overdue = this.disputes.filter((d) => {
      if (d.status !== 'open' || d.superUserNotifiedAt) return false;
      const openedMs = new Date(d.openedAt).getTime();
      return !Number.isNaN(openedMs) && nowMs - openedMs >= sevenDaysMs;
    });

    if (overdue.length === 0) {
      return { notifiedDisputes };
    }

    const allUsers = this.usersService?.findAll ? this.usersService.findAll() : [];
    const superUsers = allUsers.filter(
      (u: any) => normalizeRole(u.role) === 'superuser' || String(u.id) === 'u-superuser',
    );
    const recipients =
      superUsers.length > 0 ? superUsers.map((u: any) => String(u.id)) : ['u-superuser'];

    const overdueBySuperUser = new Map<string, { items: NotificationGroupedItem[]; firstDisputeId: string }>();
    for (const dispute of overdue) {
      for (const suId of recipients) {
        if (!overdueBySuperUser.has(suId)) {
          overdueBySuperUser.set(suId, { items: [], firstDisputeId: dispute.id });
        }
        overdueBySuperUser.get(suId)!.items.push({
          label: `Dispute #${dispute.id} (${dispute.projectTitle || dispute.projectId})`,
          link: `/admin/reports`,
        });
      }
      dispute.superUserNotifiedAt = nowIso;
      notifiedDisputes.push(dispute.id);
    }

    const dispRunKey = nowIso.slice(0, 13);
    for (const [suId, bucket] of overdueBySuperUser.entries()) {
      try {
        dispatchGroupedNotification(
          this.notificationsService,
          suId,
          `dispute_overdue:${dispRunKey}`,
          bucket.items,
          (groupedItems, count) => ({
            type: 'DISPUTE_OVERDUE',
            title: count > 1 ? `Escrow Disputes Unresolved 7+ Days (${count})` : 'Escrow Dispute Unresolved 7+ Days',
            message:
              count === 1
                ? `Escrow ${groupedItems[0].label} has remained undecided for 7+ days.`
                : `${count} escrow disputes have remained undecided for 7+ days: ${formatGroupedItemList(groupedItems, 10)}`,
            readStatus: false,
            referenceId: bucket.firstDisputeId,
            link: '/admin/reports',
          }),
        );
      } catch {}
    }

    return { notifiedDisputes };
  }

  getAllMarketplaceRecords() {
    return {
      profiles: this.profiles,
      sessions: this.sessions,
      reviews: this.reviews,
      mentorActivities: this.mentorActivities,
      abandonmentReviews: this.abandonmentReviews,
      sessionFeedbacks: this.sessionFeedbacks,
      mentorAbandonmentHistory: this.mentorAbandonmentHistory,
      disputes: this.disputes,
    };
  }

  getAllProfiles(): MentorProfileEntity[] {
    return this.profiles;
  }

  listNeedsReviewSessions(): MentorSessionEntity[] {
    return this.sessions
      .filter((s) => s.status === 'needs_review')
      .map((s) => this.enrichSession(s));
  }

  clearSessionReview(sessionId: string, adminId: string, reason: string): MentorSessionEntity {
    const session = this.findSession(sessionId);
    if (session.status !== 'needs_review') {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'SESSION_NOT_NEEDS_REVIEW',
        message: 'Session is not flagged as needs_review.',
      });
    }

    const trimmedReason = typeof reason === 'string' ? reason.trim() : '';
    if (!trimmedReason || trimmedReason.length < 10 || trimmedReason.length > 500) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'REASON_REQUIRED',
        message: 'A review clearance reason between 10 and 500 characters is required.',
      });
    }

    const restoredStatus =
      session.preReviewStatus && session.preReviewStatus !== 'needs_review'
        ? session.preReviewStatus
        : 'escrow_funded';
    const nowIso = this.getCurrentIso();

    session.status = restoredStatus;
    session.reviewClearedBy = String(adminId);
    session.reviewClearedAt = nowIso;
    session.reviewClearedReason = trimmedReason;

    try {
      this.auditService.log({
        action: 'SESSION_REVIEW_CLEARED',
        actor: String(adminId),
        performedBy: String(adminId),
        target: `Session #${session.id}`,
        entityType: 'mentor_session',
        entityId: session.id,
        event: `Cleared needs_review flag on session #${session.id} -> ${restoredStatus}: ${trimmedReason}`,
        details: {
          sessionId: session.id,
          restoredStatus,
          reason: trimmedReason,
        },
      });
    } catch (err: any) {
      console.warn('[mentor-marketplace.service] Suppressed audit error:', err?.message || err);
    }

    return this.enrichSession(session);
  }

  anonymizeUser(userId: string): void {
    const uid = String(userId || '');
    for (const p of this.profiles) {
      if (String(p.userId) === uid) {
        p.name = 'Deleted user';
        p.bio = '';
        p.isAvailable = false;
        (p as any).isDeleted = true;
      }
    }
  }
}
