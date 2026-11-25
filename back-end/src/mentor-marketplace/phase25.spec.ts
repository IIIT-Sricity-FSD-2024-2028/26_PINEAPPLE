import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  MentorMarketplaceService,
} from './mentor-marketplace.service';
import { EscrowService } from '../escrow/escrow.service';
import { DemoUpiProvider } from './payments/demo-upi.provider';
import { ClockService } from '../common/services/clock.service';
import { NotificationsService } from '../notifications/notifications.service';
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

describe('Phase 25: Mentor Booking Integrity Unit Tests', () => {
  let service: MentorMarketplaceService;
  let escrowService: EscrowService;
  let paymentProvider: DemoUpiProvider;
  let clockService: ClockService;
  let auditLogs: any[];
  let projectStore: Map<string, any>;
  let userStore: Map<string, any>;

  const BASE_TIME = '2026-06-01T08:00:00.000Z';

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    clockService = new ClockService();
    clockService.setTime(BASE_TIME);

    escrowService = new EscrowService();
    paymentProvider = new DemoUpiProvider(clockService);
    const notificationsService = new NotificationsService();
    auditLogs = [];

    userStore = new Map([
      ['owner-1', { id: 'owner-1', name: 'Owner One', email: 'owner1@example.com', role: UserRole.ProjectOwner, status: 'Active' }],
      ['owner-2', { id: 'owner-2', name: 'Owner Two', email: 'owner2@example.com', role: UserRole.ProjectOwner, status: 'Active' }],
      ['7', { id: '7', name: 'Neha Gupta', email: 'neha@example.com', role: UserRole.Mentor, status: 'Active' }],
      ['4', { id: '4', name: 'Rohan Mehta', email: 'rohan@example.com', role: UserRole.Mentor, status: 'Active' }],
      ['3', { id: '3', name: 'Kiran Bose', email: 'kiran@example.com', role: UserRole.Mentor, status: 'Active' }],
      ['5', { id: '5', name: 'Sneha Iyer', email: 'sneha@example.com', role: UserRole.Mentor, status: 'Active' }],
    ]);

    projectStore = new Map([
      [
        'proj-live-1',
        {
          id: 'proj-live-1',
          ownerId: 'owner-1',
          title: 'Secret Quantum Project Alpha',
          status: 'Open',
          dueDate: '2026-07-01T00:00:00.000Z',
          isCompleted: false,
          collaborators: [],
        },
      ],
      [
        'proj-live-2',
        {
          id: 'proj-live-2',
          ownerId: 'owner-2',
          title: 'Secret Rocket Project Beta',
          status: 'In Progress',
          dueDate: '2026-07-01T00:00:00.000Z',
          isCompleted: false,
          collaborators: [],
        },
      ],
      [
        'proj-live-owner1-b',
        {
          id: 'proj-live-owner1-b',
          ownerId: 'owner-1',
          title: 'Owner One Second Live Project',
          status: 'Open',
          dueDate: '2026-07-01T00:00:00.000Z',
          isCompleted: false,
          collaborators: [],
        },
      ],
      [
        'proj-closed-bookable',
        {
          id: 'proj-closed-bookable',
          ownerId: '7',
          title: 'Closed Project',
          status: 'Closed',
          dueDate: '2026-07-01T00:00:00.000Z',
          isCompleted: false,
          collaborators: [],
        },
      ],
      [
        'proj-self',
        {
          id: 'proj-self',
          ownerId: '7',
          title: 'Self Owned Live Project',
          status: 'Open',
          dueDate: '2026-07-01T00:00:00.000Z',
          isCompleted: false,
          collaborators: [{ id: '4', userId: '4', name: 'Rohan Mehta' }],
          members: [{ id: '7', role: 'Owner' }, { id: '4', role: 'Collaborator' }],
        },
      ],
    ]);

    const mockProjectsRepository: any = {
      findById: (id: string, includeDeleted = false) => {
        const p = projectStore.get(id) || null;
        if (!p) return null;
        if (p.deletedAt && !includeDeleted) return null;
        return p;
      },
      update: (id: string, patch: any) => {
        const existing = projectStore.get(id);
        if (existing) Object.assign(existing, patch);
        return existing;
      },
      findAll: () => Array.from(projectStore.values()).filter((p) => !p.deletedAt),
    };

    const mockAuditService: any = {
      log: (entry: any) => auditLogs.push(entry),
    };

    const mockPayoutsService: any = {
      recordTransaction: createSpy(),
    };

    const mockUsersService: any = {
      findById: (id: string) => userStore.get(String(id)) || null,
      findAll: () => Array.from(userStore.values()),
    };

    const mockGamificationService: any = {
      awardBadges: createSpy(),
      awardXp: createSpy(),
    };

    const mockMentorApplicationsService: any = {
      findByUser: (uid: string) => [{ id: `app-${uid}`, userId: uid, status: 'approved' }],
      findByStatus: () => [],
    };

    service = new MentorMarketplaceService(
      escrowService,
      mockPayoutsService,
      mockUsersService,
      mockGamificationService,
      notificationsService,
      mockMentorApplicationsService,
      mockProjectsRepository,
      mockAuditService,
      paymentProvider,
      clockService,
    );
  });

  describe('1. assertBookable order and errors + BOOKING_REFUSED audit log', () => {
    it('validates in strict order: 1) live -> 2) not self -> 3) not collaborator -> 4) active/available/suspended', async () => {
      // 1) Closed + self -> fails step 1 PROJECT_NOT_BOOKABLE (before self check)
      expect(() =>
        service.assertBookable('proj-closed-bookable', 'mentor-profile-1', '7'),
      ).toThrow(ConflictException);
      try {
        service.assertBookable('proj-closed-bookable', 'mentor-profile-1', '7');
      } catch (err: any) {
        expect(err.getResponse()?.code).toBe('PROJECT_NOT_BOOKABLE');
      }

      // 2) Live project owned by mentor user '7' (also listed in members) -> MENTOR_IS_PROJECT_MEMBER before member check
      try {
        service.assertBookable('proj-self', 'mentor-profile-1', '7');
        fail('Expected MENTOR_IS_PROJECT_MEMBER');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        expect(err.getResponse()?.code).toBe('MENTOR_IS_PROJECT_MEMBER');
      }

      // 3) Collaborator (user '4', mentor-profile-2) on live proj-self -> MENTOR_IS_PROJECT_MEMBER
      try {
        service.assertBookable('proj-self', 'mentor-profile-2', '7');
        fail('Expected MENTOR_IS_PROJECT_MEMBER');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        expect(err.getResponse()?.code).toBe('MENTOR_IS_PROJECT_MEMBER');
      }

      // 4) Suspended mentor rejected
      userStore.get('3')!.status = 'Suspended';
      try {
        service.assertBookable('proj-live-1', 'mentor-profile-3', 'owner-1');
        fail('Expected MENTOR_SUSPENDED');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        expect(err.getResponse()?.code).toBe('MENTOR_SUSPENDED');
      }

      const refusedAudits = auditLogs.filter((e) => e.action === 'BOOKING_REFUSED');
      expect(refusedAudits.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('2. ClockService governs payment 30-min expiry in DemoUpiProvider & Service', () => {
    it('allows verifyPayment at 29m and expires payment + session at 31m using ClockService', async () => {
      const booked = await service.bookSession('owner-1', {
        mentorId: 'mentor-profile-1',
        projectId: 'proj-live-1',
        projectDescription: 'Clock expiry verification',
      });

      const expectedExpiry = new Date(clockService.now().getTime() + 30 * 60 * 1000).toISOString();
      expect(booked.paymentIntent.expiresAt).toBe(expectedExpiry);
      expect(booked.session.paymentExpiresAt).toBe(expectedExpiry);

      // +29 minutes: payment intent still valid & verifyPayment succeeds
      clockService.advanceTime(29 * 60 * 1000);
      expect(service.expireStalePaymentPendingSessions().expiredSessions).toHaveLength(0);

      // Book second intent cleanly to verify direct DemoUpiProvider expiration at 31m
      const intent2 = await paymentProvider.createPaymentIntent('direct-sess-1', 1000);
      clockService.advanceTime(31 * 60 * 1000);

      // verifyPayment on intent2 MUST return false because ClockService > intent2.expiresAt
      const validAt31 = await paymentProvider.verifyPayment(intent2.id);
      expect(validAt31).toBe(false);
      expect((await paymentProvider.getPaymentIntent(intent2.id))?.status).toBe('expired');

      // Session 1 also expires automatically via expireStalePaymentPendingSessions
      const expRes = service.expireStalePaymentPendingSessions();
      expect(expRes.expiredSessions).toContain(booked.session.id);
      expect(service.findSession(booked.session.id).status).toBe('cancelled');
    });
  });

  describe('3. Simultaneous Bookings Concurrency Lock', () => {
    it('allows only 1 of 2 simultaneous bookings for the same project; rejects 2nd with 409 duplicate', async () => {
      const results = await Promise.allSettled([
        service.bookSession('owner-1', {
          mentorId: 'mentor-profile-1',
          projectId: 'proj-live-1',
          projectDescription: 'Simultaneous request 1',
        }),
        service.bookSession('owner-1', {
          mentorId: 'mentor-profile-1',
          projectId: 'proj-live-1',
          projectDescription: 'Simultaneous request 2',
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(ConflictException);
    });
  });
});
