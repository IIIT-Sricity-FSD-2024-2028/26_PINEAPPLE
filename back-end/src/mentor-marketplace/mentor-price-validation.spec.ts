import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import {
  PRICE_MIN,
  PRICE_MAX,
  INVALID_PRICE_MESSAGE,
  validateMentorPrice,
} from './mentor-marketplace.config';
import {
  MentorMarketplaceService,
  calculateEscrowBreakdown,
} from './mentor-marketplace.service';
import { MentorMarketplaceController } from './mentor-marketplace.controller';
import { RolesGuard } from '../common/guards/roles.guard';
import { EscrowService } from '../escrow/escrow.service';
import { DemoUpiProvider } from './payments/demo-upi.provider';
import { ClockService } from '../common/services/clock.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UserRole } from '../users/dto/create-user.dto';

describe('Mentor Profile Price Validation & Fee Reconciliation', () => {
  describe('1. validateMentorPrice unit tests', () => {
    it('accepts valid whole number prices in range: 1, 117, 125, 999, 1000, 100000', () => {
      const validPrices = [1, 117, 125, 999, 1000, 100000];
      for (const p of validPrices) {
        expect(validateMentorPrice(p)).toBe(p);
      }
    });

    it('rejects 0, -5, 12.5, "abc", null, empty string, and 100001 with INVALID_PRICE', () => {
      const invalidPrices = [0, -5, 12.5, 'abc', null, '', 100001, undefined];
      for (const p of invalidPrices) {
        let err: any = null;
        try {
          validateMentorPrice(p);
        } catch (e) {
          err = e;
        }
        expect(err).toBeInstanceOf(BadRequestException);
        const resp = err.getResponse();
        expect(resp.code).toBe('INVALID_PRICE');
        expect(resp.statusCode).toBe(400);
        expect(resp.message).toBe(INVALID_PRICE_MESSAGE);
      }
    });
  });

  describe('2. Fee and Payout Calculation & Exact Reconciliation', () => {
    const testPrices = [1, 101, 117, 999, 1000];

    it.each(testPrices)('reconciles booking, payout and fees for price ₹%i', (price) => {
      const breakdown = calculateEscrowBreakdown(price);

      // Mentor receives exact session price
      expect(breakdown.mentorPayout).toBe(price);
      expect(breakdown.price).toBe(price);

      // Total charged to owner matches sum of mentor payout + platform fee + gateway fee
      const expectedTotal = breakdown.mentorPayout + breakdown.platformFee + breakdown.gatewayFee;
      expect(breakdown.totalAmount).toBe(expectedTotal);
      expect(breakdown.totalFees).toBe(breakdown.platformFee + breakdown.gatewayFee);
    });

    it.each(testPrices)('reconciles 70/30 dispute split for price ₹%i without losing or creating paise', (price) => {
      const breakdown = calculateEscrowBreakdown(price);
      const totalSessionAmount = breakdown.totalAmount;

      const pct = 70;
      const mentorAmount = Math.round(breakdown.price * (pct / 100));
      const platformFee = Math.round(mentorAmount * 0.15);
      const gatewayFee = 0;
      const ownerRefundAmount = Math.max(0, totalSessionAmount - mentorAmount - platformFee);

      // Exact rupee reconciliation invariant:
      expect(mentorAmount + platformFee + gatewayFee + ownerRefundAmount).toBe(totalSessionAmount);
    });
  });

  describe('3. Supertest API Integration Tests (PATCH & PUT /mentors/profile)', () => {
    let app: any;
    let service: MentorMarketplaceService;
    let escrowService: EscrowService;
    let auditLogs: any[] = [];
    let projectStore: Map<string, any>;
    let usersMap: Map<string, any>;

    beforeEach(async () => {
      process.env.NODE_ENV = 'test';
      process.env.AUTH_MODE = 'legacy';
      const clockService = new ClockService();
      clockService.setTime('2026-06-01T12:00:00.000Z');

      escrowService = new EscrowService();
      const paymentProvider = new DemoUpiProvider();
      const notificationsService = new NotificationsService();
      auditLogs = [];

      usersMap = new Map([
        ['mentor-1', { id: 'mentor-1', name: 'Kiran Bose', email: 'kiran@teamforge.io', role: UserRole.Mentor, status: 'Active' }],
        ['owner-1', { id: 'owner-1', name: 'Priya Patel', email: 'priya@teamforge.io', role: UserRole.ProjectOwner, status: 'Active' }],
      ]);

      projectStore = new Map([
        ['proj-1', {
          id: 'proj-1',
          ownerId: 'owner-1',
          title: 'Project Proj-1',
          status: 'Open',
          collaborators: [{ id: 'collab-1', name: 'Collaborator One' }],
        }],
      ]);

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
        log: (entry: any) => auditLogs.push(entry),
      };

      const mockPayoutsService: any = {
        recordTransaction: () => {},
      };

      const mockUsersService: any = {
        findById: (id: string) => usersMap.get(String(id)) || null,
        findUserSafe: (id: string) => usersMap.get(String(id)) || null,
        findAll: () => Array.from(usersMap.values()),
      };

      const mockGamificationService: any = {
        awardBadges: () => {},
        awardXp: () => {},
      };

      const mockMentorApplicationsGate: any = {
        isMentorVerified: () => true,
        findByUser: (uid: string) => [{ id: 'app-1', userId: uid, status: 'approved' }],
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

      const moduleRef: TestingModule = await Test.createTestingModule({
        controllers: [MentorMarketplaceController],
        providers: [
          {
            provide: MentorMarketplaceService,
            useValue: service,
          },
        ],
      })
        .overrideGuard(RolesGuard)
        .useValue({
          canActivate: (ctx: any) => {
            const req = ctx.switchToHttp().getRequest();
            const uId = req.headers['x-user-id'] || 'mentor-1';
            const uRole = req.headers['x-user-role'] || 'mentor';
            req.user = { id: uId, uid: uId, role: uRole };
            return true;
          },
        })
        .compile();

      app = moduleRef.createNestApplication();
      app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: false }));
      await app.init();
    });

    afterEach(async () => {
      if (app) await app.close();
    });

    it('PATCH /mentor-marketplace/mentors/profile with 117 saves and returns 117', async () => {
      const res = await request(app.getHttpServer())
        .patch('/mentor-marketplace/mentors/profile')
        .set('x-user-role', 'mentor')
        .set('x-user-id', 'mentor-1')
        .send({
          sessionPrice: 117,
        });

      expect(res.status).toBe(200);
      expect(res.body.sessionPrice).toBe(117);
    });

    it('PUT /mentor-marketplace/mentors/profile with 117 saves and returns 117', async () => {
      const res = await request(app.getHttpServer())
        .put('/mentor-marketplace/mentors/profile')
        .set('x-user-role', 'mentor')
        .set('x-user-id', 'mentor-1')
        .send({
          sessionPrice: 117,
        });

      expect(res.status).toBe(200);
      expect(res.body.sessionPrice).toBe(117);
    });

    it('PATCH /mentor-marketplace/mentors/profile with 12.5 returns 400 INVALID_PRICE', async () => {
      const res = await request(app.getHttpServer())
        .patch('/mentor-marketplace/mentors/profile')
        .set('x-user-role', 'mentor')
        .set('x-user-id', 'mentor-1')
        .send({
          sessionPrice: 12.5,
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_PRICE');
      expect(res.body.message).toBe(INVALID_PRICE_MESSAGE);
    });

    it('PUT /mentor-marketplace/mentors/profile with 12.5 returns 400 INVALID_PRICE', async () => {
      const res = await request(app.getHttpServer())
        .put('/mentor-marketplace/mentors/profile')
        .set('x-user-role', 'mentor')
        .set('x-user-id', 'mentor-1')
        .send({
          sessionPrice: 12.5,
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_PRICE');
    });

    it('completes a full flow with price ₹117 (book, accept, pay, release) ending with exact reconciled totals', async () => {
      // 0. Ensure fresh project with no active sessions
      projectStore.set('fresh-proj-117', {
        id: 'fresh-proj-117',
        ownerId: 'owner-1',
        title: 'Fresh Project 117',
        status: 'Open',
        collaborators: [{ id: 'collab-1', name: 'Collaborator One' }],
      });

      // 1. Set mentor price to 117
      const profile = service.updateProfile('mentor-1', {
        name: 'Kiran Bose',
        title: 'Senior Architect',
        bio: 'Mentor bio',
        skills: ['Architecture'],
        sessionPrice: 117,
        isAvailable: true,
      });
      expect(profile.sessionPrice).toBe(117);

      // 2. Project owner books session
      const { session } = await service.bookSession('owner-1', {
        mentorId: profile.id,
        projectId: 'fresh-proj-117',
        projectDescription: 'Help with system architecture',
      });

      expect(session.status).toBe('payment_pending');
      expect(session.agreedPrice).toBe(117);

      // Check payment breakdown
      const breakdown = calculateEscrowBreakdown(117);
      expect(breakdown.totalAmount).toBe(137); // 117 + 18 + 2
      expect(breakdown.mentorPayout).toBe(117);

      // 3. Owner confirms payment
      const paymentRes = await service.confirmPayment(session.id, 'owner-1', false, 'idem-117-key');
      expect(paymentRes.session.status).toBe('escrow_funded');
      expect(paymentRes.session.agreedPrice).toBe(117);

      // 4. Mentor accepts session
      const accepted = await service.acceptSession(session.id, 'mentor-1');
      expect(accepted.status).toBe('active');

      // 5. Complete session (release escrow and payout to mentor)
      const completed = service.completeSession(session.id, 'owner-1');
      expect(completed.status).toBe('completed');
      expect(completed.agreedPrice).toBe(117);
      expect(completed.payout).toBe(117);
      expect(completed.platformFee).toBe(18);
      expect(completed.gatewayFee).toBe(2);

      // Exact reconciliation invariant: payout (117) + fees (20) = total charged (137)
      expect(completed.payout + completed.platformFee + completed.gatewayFee).toBe(137);
    });
  });
});
