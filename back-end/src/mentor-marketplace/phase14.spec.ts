import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { MentorMarketplaceService } from './mentor-marketplace.service';
import { EscrowService } from '../escrow/escrow.service';
import { DemoUpiProvider } from './payments/demo-upi.provider';
import { ClockService } from '../common/services/clock.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PlatformConfigService } from '../platform-config/platform-config.service';
import { MentorApplicationsService } from '../mentor-applications/mentor-applications.service';
import { UserRole } from '../users/dto/create-user.dto';

function createSpy(impl?: (...args: any[]) => any) {
  const calls: any[][] = [];
  const fn: any = (...args: any[]) => {
    calls.push(args);
    return impl ? impl(...args) : undefined;
  };
  fn.calls = calls;
  fn.reset = () => {
    calls.length = 0;
  };
  return fn;
}

describe('Phase 14: Mentor Lifecycle Unit Tests', () => {
  let service: MentorMarketplaceService;
  let escrowService: EscrowService;
  let paymentProvider: DemoUpiProvider;
  let clockService: ClockService;
  let notificationsService: NotificationsService;
  let platformConfigService: PlatformConfigService;
  let mentorApplicationsService: MentorApplicationsService;
  let auditLogs: any[] = [];
  let projectStore: Map<string, any>;
  let usersMap: Map<string, any>;

  const BASE_TIME = '2026-06-01T12:00:00.000Z';

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.ALLOW_STORE_RESET = 'true';

    clockService = new ClockService();
    clockService.setTime(BASE_TIME);

    escrowService = new EscrowService();
    paymentProvider = new DemoUpiProvider();
    notificationsService = new NotificationsService();
    platformConfigService = new PlatformConfigService();
    auditLogs = [];

    usersMap = new Map([
      ['1', { id: '1', name: 'Priya Patel', email: 'priya@teamforge.io', role: UserRole.ProjectOwner, data: {}, profile: {} }],
      ['2', { id: '2', name: 'Arjun Sharma', email: 'arjun@teamforge.io', role: UserRole.Collaborator, data: {}, profile: {} }],
      ['7', { id: '7', name: 'Neha Gupta', email: 'neha@teamforge.io', role: UserRole.Mentor, data: {}, profile: {} }],
      ['5', { id: '5', name: 'Sneha Iyer', email: 'sneha@teamforge.io', role: UserRole.Mentor, data: {}, profile: {} }],
      ['u-admin', { id: 'u-admin', name: 'Admin', email: 'admin@teamforge.io', role: UserRole.Administrator, data: {}, profile: {} }],
    ]);

    projectStore = new Map();
    const createProject = (id: string, extra: Record<string, any> = {}) => {
      projectStore.set(id, {
        id,
        ownerId: '1',
        title: `Project ${id}`,
        status: 'Open',
        isCompleted: false,
        dueDate: '2026-08-30T00:00:00.000Z',
        collaborators: [{ id: '2', name: 'Arjun Sharma', role: 'Collaborator' }],
        ...extra,
      });
    };
    createProject('proj-life-1');
    createProject('proj-life-2');
    createProject('proj-cap-1');
    createProject('proj-cap-2');
    createProject('proj-cap-3');
    createProject('proj-cap-4');

    const mockProjectsRepository: any = {
      findById: (id: string) => projectStore.get(id) || null,
      findAll: () => Array.from(projectStore.values()),
      update: (id: string, patch: any) => {
        const existing = projectStore.get(id);
        if (existing) Object.assign(existing, patch);
        return existing;
      },
    };

    const mockAuditService: any = {
      log: (entry: any) => {
        auditLogs.push(entry);
      },
    };

    const mockPayoutsService: any = {
      recordTransaction: createSpy(),
    };

    const mockUsersService: any = {
      findById: (id: string) => usersMap.get(String(id)) || null,
      findUserSafe: (id: string) => usersMap.get(String(id)) || null,
      findAll: () => Array.from(usersMap.values()),
      update: (id: string, patch: any) => {
        const u = usersMap.get(String(id));
        if (u) Object.assign(u, patch);
        return u;
      },
    };

    const mockGamificationService: any = {
      awardBadges: createSpy(),
      awardXp: createSpy(),
    };

    const mockMentorApplicationsGate: any = {
      isMentorVerified: () => true,
      findByUser: (uid: string) => [{ id: 'app-1', userId: uid, status: 'approved' }],
      findByStatus: () => [{ id: 'app-1', status: 'approved' }],
    };

    service = new MentorMarketplaceService(
      escrowService,
      mockPayoutsService,
      mockUsersService,
      mockGamificationService,
      notificationsService,
      mockMentorApplicationsGate,
      mockProjectsRepository,
      mockAuditService,
      paymentProvider,
      clockService,
    );
    service.reconcileDuplicateSessionsOnStartup();

    mentorApplicationsService = new MentorApplicationsService(
      mockUsersService,
      mockAuditService,
      platformConfigService,
      notificationsService,
      {} as any,
      {} as any,
      undefined,
      clockService,
    );
  });

  async function assignMentorViaSession(projectId: string, mentorProfileId = 'mentor-profile-1', mentorUserId = '7', offsetDays = 3) {
    const booked = await service.bookSession('1', {
      mentorId: mentorProfileId,
      projectId,
      projectDescription: `Mentorship for ${projectId}`,
    });
    const sessionId = booked.session.id;
    await service.confirmPayment(sessionId, '1', false, `idem-${sessionId}`);
    return service.acceptSession(sessionId, mentorUserId, false);
  }

  describe('1. First-Week Activity & Abandonment Review Lifecycle', () => {
    it('sends first-week inactivity notice at day 7 when no activity happened, once only', async () => {
      await assignMentorViaSession('proj-life-1');

      // Day 6 -> no first-week notice yet
      clockService.advanceDays(6);
      const day6Res = service.checkMentorActivityNotices();
      expect(day6Res.firstWeekNotices).toHaveLength(0);

      // Day 7 -> first-week notice sent to owner and mentor
      clockService.advanceDays(1);
      const day7Res = service.checkMentorActivityNotices();
      expect(day7Res.firstWeekNotices).toHaveLength(1);

      const ownerNotifs = notificationsService.findByUser('1');
      expect(ownerNotifs.some((n) => n.type === 'MENTOR_FIRST_WEEK_INACTIVE')).toBe(true);

      // Second call at day 7 is idempotent (no duplicate notice)
      const secondRes = service.checkMentorActivityNotices();
      expect(secondRes.firstWeekNotices).toHaveLength(0);
    });

    it('refuses abandonment review before 7 days of inactivity (409 MENTOR_STILL_ACTIVE) and rejects collaborator (403)', async () => {
      await assignMentorViaSession('proj-life-1');

      // Collaborator refused with 403
      expect(() => service.openAbandonmentReview('proj-life-1', '2')).toThrow(ForbiddenException);

      // Owner on day 4 refused with 409 MENTOR_STILL_ACTIVE
      clockService.advanceDays(4);
      try {
        service.openAbandonmentReview('proj-life-1', '1');
        fail('Expected ConflictException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        const resp = err.getResponse();
        expect(resp?.code).toBe('MENTOR_STILL_ACTIVE');
      }

      // Mentor saves activity on day 5 -> still blocks at day 10 (only 5d since last activity)
      clockService.advanceDays(1);
      service.recordMentorActivity('proj-life-1', '7', 'chat_message');
      clockService.advanceDays(5);
      expect(() => service.openAbandonmentReview('proj-life-1', '1')).toThrow(ConflictException);
    });

    it('mentor confirm closes review, logs activity, restarts 7d clock, and enforces 14d cooldown on next review', async () => {
      await assignMentorViaSession('proj-life-1');
      clockService.advanceDays(7);

      const review = service.openAbandonmentReview('proj-life-1', '1', 'No messages during week 1');
      expect(review.status).toBe('open');

      const confirmed = service.confirmAbandonmentReview(review.id, '7');
      expect(confirmed.status).toBe('confirmed');
      expect(confirmed.decidedAt).toBeDefined();

      // Owner informed
      const ownerNotifs = notificationsService.findByUser('1');
      expect(ownerNotifs.some((n) => n.type === 'MENTOR_REVIEW_CONFIRMED')).toBe(true);

      // Trying another review within 14d fails (MENTOR_STILL_ACTIVE for <7d or REVIEW_COOLDOWN days 7..13)
      clockService.advanceDays(8);
      try {
        service.openAbandonmentReview('proj-life-1', '1');
        fail('Expected REVIEW_COOLDOWN');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        expect(err.getResponse()?.code).toBe('REVIEW_COOLDOWN');
      }

      // After 14 days from confirmation (total >=14d since confirm) and >=7d inactive, new review is allowed
      clockService.advanceDays(6);
      const nextReview = service.openAbandonmentReview('proj-life-1', '1');
      expect(nextReview.status).toBe('open');
    });

    it('49h expired review releases mentor, refunds non-completed sessions via escrow, leaves completed untouched, frees slot, and logs incident', async () => {
      const sDone = await assignMentorViaSession('proj-life-2', 'mentor-profile-1', '7', 10);
      await service.completeSession(sDone.id, '1', false);

      const sActive = await assignMentorViaSession('proj-life-1', 'mentor-profile-1', '7', 12);

      // Advance 7 days past last activity, open review, advance 49 hours
      clockService.advanceDays(7);
      const review = service.openAbandonmentReview('proj-life-1', '1');
      clockService.advanceHours(49);

      const releaseRes = service.processExpiredAbandonmentReviews();
      expect(releaseRes.releasedReviews).toContain(review.id);
      expect(releaseRes.refundedSessions).toContain(sActive.id);
      expect(releaseRes.refundedSessions).not.toContain(sDone.id);

      // Completed session untouched, non-completed refunded
      expect(service.findSession(sDone.id).status).toBe('completed');
      expect(service.findSession(sActive.id).status).toBe('refunded');

      // Escrow reconciles cleanly
      const reconcile = service.reconcileEscrow();
      expect(reconcile.ok).toBe(true);
      expect(reconcile.mismatches).toEqual([]);

      // Slot freed on project so another mentor can be booked
      const proj = projectStore.get('proj-life-1');
      expect(proj.mentorId).toBeNull();
      const altMentorSession = await assignMentorViaSession('proj-life-1', 'mentor-profile-4', '5', 15);
      expect(altMentorSession.mentorId).toBe('mentor-profile-4');

      // Incident recorded on mentor record visible to admins
      const adminRecord = service.getAdminMentorFeedback('7');
      expect(adminRecord.abandonmentHistory).toHaveLength(1);
      expect(adminRecord.abandonmentHistory[0].projectId).toBe('proj-life-1');
    });

    it('admin cancel requires reason and prevents immediate re-open via 14d cooldown', async () => {
      await assignMentorViaSession('proj-life-1');
      clockService.advanceDays(7);
      const review = service.openAbandonmentReview('proj-life-1', '1');

      try {
        service.cancelAbandonmentReview(review.id, 'u-admin', '   ');
        fail('Expected REASON_REQUIRED');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect(err.getResponse()?.code).toBe('REASON_REQUIRED');
      }

      const cancelled = service.cancelAbandonmentReview(review.id, 'u-admin', 'Mentor had pre-approved medical absence.');
      expect(cancelled.status).toBe('cancelled');

      // 14-day cooldown still blocks immediate reopen even 8 days later
      clockService.advanceDays(8);
      try {
        service.openAbandonmentReview('proj-life-1', '1');
        fail('Expected REVIEW_COOLDOWN');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        expect(err.getResponse()?.code).toBe('REVIEW_COOLDOWN');
      }
    });
  });

  describe('2. Re-Application Cooldown', () => {
    const buildAppDto = () => ({
      userId: '2',
      email: 'arjun@teamforge.io',
      name: 'Arjun Sharma',
      years: 6,
      bio: 'Senior software engineer mentoring student developers for over 6 years.',
      skills: ['Node.js', 'TypeScript', 'NestJS'],
      cvFileName: 'arjun-cv.pdf',
      certificates: [
        {
          title: 'AWS Certified Architect',
          issuer: 'AWS',
          holderName: 'Arjun Sharma',
          documentNumber: 'AWS-100',
        },
      ],
    });

    it('blocks re-application on day 13 with 409 REAPPLY_COOLDOWN + availableAt and allows on day 15', () => {
      const app = mentorApplicationsService.create(buildAppDto());
      const rejected = mentorApplicationsService.reject(app.id, 'Insufficient portfolio artifacts.', 'Admin');
      expect(rejected.rejectedAt).toBeDefined();

      // Day 13 -> blocked
      clockService.advanceDays(13);
      try {
        mentorApplicationsService.create(buildAppDto());
        fail('Expected REAPPLY_COOLDOWN');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        const resp = err.getResponse();
        expect(resp?.code).toBe('REAPPLY_COOLDOWN');
        expect(resp?.availableAt).toBeDefined();
      }

      // Day 15 (2 more days) -> allowed
      clockService.advanceDays(2);
      const reapplied = mentorApplicationsService.create(buildAppDto());
      expect(reapplied.status).toBe('pending');
    });
  });

  describe('3. Active Mentee Capacity Cap', () => {
    it('enforces maxActiveMentees = 3 default: allows 3 active mentees and blocks 4th with 409 MENTOR_AT_CAPACITY', async () => {
      await assignMentorViaSession('proj-cap-1', 'mentor-profile-1', '7', 3);
      await assignMentorViaSession('proj-cap-2', 'mentor-profile-1', '7', 4);
      await assignMentorViaSession('proj-cap-3', 'mentor-profile-1', '7', 5);

      const { profile } = service.getMentor('mentor-profile-1');
      expect(profile.maxActiveMentees).toBe(3);
      expect(profile.activeMenteesCount).toBe(3);
      expect(profile.isFull).toBe(true);

      try {
        await service.bookSession('1', {
          mentorId: 'mentor-profile-1',
          projectId: 'proj-cap-4',
          projectDescription: '4th mentee request',
        });
        fail('Expected MENTOR_AT_CAPACITY');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        expect(err.getResponse()?.code).toBe('MENTOR_AT_CAPACITY');
      }

      // Increasing cap to 4 allows 4th booking; lowering cap later leaves active mentees untouched
      service.updateProfile('7', { maxActiveMentees: 4 });
      const fourth = await assignMentorViaSession('proj-cap-4', 'mentor-profile-1', '7', 6);
      expect(fourth.status).toBe('active');
    });
  });

  describe('4. Private Post-Session Feedback', () => {
    it('validates rating 1..5, rejects second feedback (409 ALREADY_RATED), leaves payout unchanged, and hides details from public endpoints', async () => {
      const active = await assignMentorViaSession('proj-life-1', 'mentor-profile-1', '7', 2);
      const completed = await service.completeSession(active.id, '1', false);
      const payoutBefore = completed.payout;

      // Invalid ratings -> 400 INVALID_RATING
      for (const badRating of [0, 6, 3.5, -1]) {
        try {
          service.submitSessionFeedback(completed.id, '1', { rating: badRating, comment: 'Bad rating test' });
          fail(`Expected INVALID_RATING for ${badRating}`);
        } catch (err: any) {
          expect(err).toBeInstanceOf(BadRequestException);
          expect(err.getResponse()?.code).toBe('INVALID_RATING');
        }
      }

      // Collaborator cannot rate owner session
      expect(() => service.submitSessionFeedback(completed.id, '2', { rating: 5 })).toThrow(ForbiddenException);

      // Valid feedback once
      const res = service.submitSessionFeedback(completed.id, '1', {
        rating: 4,
        comment: 'Clear system design guidance and constructive architecture review.',
      });
      expect(res.rating).toBe(4);
      expect(service.findSession(completed.id).payout).toBe(payoutBefore);
      expect(service.findSession(completed.id).hasFeedback).toBe(true);

      // Second feedback rejected -> 409 ALREADY_RATED
      try {
        service.submitSessionFeedback(completed.id, '1', { rating: 5, comment: 'Duplicate feedback' });
        fail('Expected ALREADY_RATED');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        expect(err.getResponse()?.code).toBe('ALREADY_RATED');
      }

      // Public mentor profile never leaks individual comments or student names
      const publicMentor = service.getMentor('mentor-profile-1');
      expect(publicMentor.reviews).toEqual([]);

      // Mentor aggregate stats expose average only, no comments or owner names
      const mentorStats = service.getMentorPrivateStats('7');
      expect(mentorStats.averageRating).toBe(4);
      expect(mentorStats.totalFeedbackCount).toBe(1);
      expect((mentorStats as any).feedback).toBeUndefined();

      // Admin sees full feedback + owner name
      const adminView = service.getAdminMentorFeedback('7');
      expect(adminView.feedback).toHaveLength(1);
      expect(adminView.feedback[0].comment).toContain('Clear system design guidance');
      expect(adminView.feedback[0].ownerName).toBe('Priya Patel');
    });
  });
});
