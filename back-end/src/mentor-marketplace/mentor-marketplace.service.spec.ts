import { BadRequestException, ConflictException } from '@nestjs/common';
import { MentorMarketplaceService, PAYMENT_PENDING_EXPIRY_MS, calculateEscrowBreakdown } from './mentor-marketplace.service';
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

describe('MentorMarketplaceService - Phase 9 Escrow & Payment Safety Unit Tests', () => {
  let service: MentorMarketplaceService;
  let escrowService: EscrowService;
  let paymentProvider: DemoUpiProvider;
  let clockService: ClockService;
  let auditLogs: any[] = [];
  let notificationsService: NotificationsService;
  let mockProjectsRepository: any;
  let projectStore: Map<string, any>;

  const BASE_TIME = '2026-03-01T12:00:00.000Z';

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.ALLOW_STORE_RESET = 'true';

    clockService = new ClockService();
    clockService.setTime(BASE_TIME);

    escrowService = new EscrowService();
    paymentProvider = new DemoUpiProvider();
    notificationsService = new NotificationsService();
    auditLogs = [];

    projectStore = new Map();
    projectStore.set('proj-100', {
      id: 'proj-100',
      ownerId: 'owner-1',
      title: 'Phase 9 Escrow Project',
      status: 'Open',
      dueDate: '2026-03-15T00:00:00.000Z',
      isCompleted: false,
    });
    projectStore.set('proj-no-due', {
      id: 'proj-no-due',
      ownerId: 'owner-1',
      title: 'Project Without Due Date',
      status: 'Open',
      isCompleted: false,
    });

    mockProjectsRepository = {
      findById: (id: string) => projectStore.get(id) || null,
      update: (id: string, patch: any) => {
        const existing = projectStore.get(id);
        if (existing) {
          Object.assign(existing, patch);
        }
      },
      findAll: () => Array.from(projectStore.values()),
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
      findById: (id: string) => ({ id, name: `User ${id}`, email: `user${id}@example.com`, role: UserRole.Mentor }),
      findAll: () => [
        { id: '7', name: 'Neha Gupta', email: 'neha@example.com', role: UserRole.Mentor },
        { id: '8', name: 'Rohan Verma', email: 'rohan@example.com', role: UserRole.Mentor },
        { id: '9', name: 'Kavita Rao', email: 'kavita@example.com', role: UserRole.Mentor },
        { id: 'owner-1', name: 'Owner', email: 'owner@example.com', role: UserRole.ProjectOwner },
      ],
    };

    const mockGamificationService: any = {
      awardBadges: createSpy(),
      awardXp: createSpy(),
    };

    const mockMentorApplicationsService: any = {
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
      mockMentorApplicationsService,
      mockProjectsRepository,
      mockAuditService,
      paymentProvider,
      clockService,
    );
  });

  describe('1. Booking Flow (No Date/Time, Request & Pay)', () => {
    it('succeeds with only mentorId, projectId, and projectDescription', async () => {
      const res = await service.bookSession('owner-1', {
        mentorId: 'mentor-profile-1',
        projectId: 'proj-100',
        projectDescription: 'Mentorship request without date/time',
      });

      expect(res.session).toBeDefined();
      expect(res.session.status).toBe('payment_pending');
      expect((res.session as any).scheduledAt).toBeUndefined();
      expect((res.session as any).durationMinutes).toBeUndefined();
      expect(res.paymentIntent).toBeDefined();
    });
  });

  describe('2. Payment Idempotency & 30-Minute Expiry', () => {
    it('same idempotency key returns original result and charges once; different key on paid session throws 409 ALREADY_PAID', async () => {
      const booking = await service.bookSession('owner-1', {
        mentorId: 'mentor-profile-1',
        projectId: 'proj-100',
        projectDescription: 'Test idempotency',
      });

      const keyA = 'idemp-key-aaa-111';
      const keyB = 'idemp-key-bbb-222';

      // 1st pay with keyA -> funded
      const pay1 = await service.confirmPayment(booking.session.id, 'owner-1', false, keyA);
      expect(pay1.session.status).toBe('escrow_funded');
      expect(pay1.escrow).toBeDefined();

      // 2nd pay with SAME keyA -> returns original result without re-funding
      const pay2 = await service.confirmPayment(booking.session.id, 'owner-1', false, keyA);
      expect(pay2.session.id).toBe(booking.session.id);
      expect(pay2.escrow.id).toBe(pay1.escrow.id);

      // 3rd pay with DIFFERENT keyB -> throws 409 ALREADY_PAID
      await expect(
        service.confirmPayment(booking.session.id, 'owner-1', false, keyB),
      ).rejects.toThrow(ConflictException);

      try {
        await service.confirmPayment(booking.session.id, 'owner-1', false, keyB);
      } catch (err: any) {
        const resp = err.getResponse ? err.getResponse() : err.response;
        expect(resp?.code).toBe('ALREADY_PAID');
        expect(resp?.statusCode).toBe(409);
      }
    });

    it('payment expiry: cancels payment_pending session at 31m and NOT at 29m', async () => {
      const booking = await service.bookSession('owner-1', {
        mentorId: 'mentor-profile-1',
        projectId: 'proj-100',
        projectDescription: 'Test expiry job',
      });

      expect(booking.session.status).toBe('payment_pending');

      // Advance clock by 29 minutes -> still payment_pending
      clockService.advanceTime(29 * 60 * 1000);
      const res29 = service.expireStalePaymentPendingSessions();
      expect(res29.expiredSessions).not.toContain(booking.session.id);
      expect(service.findSession(booking.session.id).status).toBe('payment_pending');

      // Advance clock by another 2 minutes (total 31 minutes > 30 min limit) -> cancelled!
      clockService.advanceTime(2 * 60 * 1000);
      const res31 = service.expireStalePaymentPendingSessions();
      expect(res31.expiredSessions).toContain(booking.session.id);

      const session = service.findSession(booking.session.id);
      expect(session.status).toBe('cancelled');
      expect(session.declineReason).toBe('Payment not completed');
    });
  });

  describe('3. Project Closure Refunds & Idempotency', () => {
    it('closure settlements: refunds escrow_funded and cancels payment_pending, leaves completed untouched', async () => {
      // Create session 1: completed
      const sCompleted = (service as any).sessions[0]; // seeded session-1 is completed or escrow_funded
      sCompleted.projectId = 'proj-closure-test';
      sCompleted.status = 'completed';

      // Create session 2: payment_pending
      const sPending: any = {
        id: 'sess-pending-1',
        mentorId: 'mentor-profile-1',
        studentId: 'owner-1',
        projectId: 'proj-closure-test',
        projectDescription: 'Hold session',
        agreedPrice: 1500,
        status: 'payment_pending' as const,
        createdAt: clockService.nowIso(),
      };
      (service as any).sessions.push(sPending);

      // Create session 3: escrow_funded
      const escrow = escrowService.fundForSession('sess-funded-1', 1500);
      const sFunded = {
        id: 'sess-funded-1',
        mentorId: 'mentor-profile-2',
        studentId: 'owner-1',
        projectId: 'proj-closure-test',
        projectDescription: 'Funded session',
        agreedPrice: 1500,
        escrowId: escrow.id,
        totalAmount: escrow.totalFunded,
        status: 'escrow_funded' as const,
        createdAt: clockService.nowIso(),
      };
      (service as any).sessions.push(sFunded);

      // Run closure settlement
      service.handleProjectClosed('proj-closure-test', 'Admin closed project', true);

      // Completed session must remain completed
      expect(sCompleted.status).toBe('completed');

      // Payment pending session must become cancelled
      expect(sPending.status).toBe('cancelled');
      expect(sPending.declineReason).toContain('Project closed');

      // Escrow funded session must become refunded
      expect(sFunded.status).toBe('refunded');
      expect(escrowService.findOne(escrow.id).status).toBe('Refunded');

      // Audit logs created for refund
      const refundLogs = auditLogs.filter((l) => l.action === 'project-closed-mentor-refund');
      expect(refundLogs.length).toBeGreaterThanOrEqual(1);

      // Pass 2: Running closure a second time must change nothing (idempotent)
      const auditCountBefore = auditLogs.length;
      service.handleProjectClosed('proj-closure-test', 'Admin closed project', true);
      expect(sCompleted.status).toBe('completed');
      expect(sPending.status).toBe('cancelled');
      expect(sFunded.status).toBe('refunded');
      expect(auditLogs.length).toBe(auditCountBefore); // No duplicate audit entries
    });
  });

  describe('4. Escrow Reconciliation Invariant', () => {
    it('reconciliation holds across all states: owner paid = mentor payout + platform fee + refunds (+ inEscrow)', () => {
      const result = service.reconcileEscrow();
      expect(result.ok).toBe(true);
      expect(result.mismatches).toHaveLength(0);
      expect(result.totalSessions).toBeGreaterThan(0);
      expect(result.reconciledCount).toBe(result.totalSessions);

      // Mathematically check invariant on totals
      const { ownerPaid, mentorPayout, platformFee, refunds, inEscrow } = result.totals;
      expect(ownerPaid).toBe(mentorPayout + platformFee + refunds + inEscrow);
    });
  });
});

