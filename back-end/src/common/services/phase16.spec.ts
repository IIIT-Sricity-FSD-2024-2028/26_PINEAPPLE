import { BadRequestException, ConflictException, ExecutionContext, ForbiddenException, HttpException } from '@nestjs/common';
import { ContentFilterService } from './content-filter.service';
import { AuditService } from '../../audit/audit.service';
import { UsersRepository } from '../../users/users.repository';
import { DuplicateDetectionService } from '../../users/duplicate-detection.service';
import { ClockService } from './clock.service';
import { EmailVerifiedGuard } from '../../auth/guards/email-verified.guard';
import { UsersService } from '../../users/users.service';
import { UserRole } from '../../users/dto/create-user.dto';

describe('Phase 16 Unit Tests: Trust and Safety Services & Guards', () => {
  let auditService: AuditService;
  let contentFilter: ContentFilterService;
  let usersRepo: UsersRepository;
  let duplicateService: DuplicateDetectionService;
  let clockService: ClockService;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.ALLOW_STORE_RESET = 'true';
    auditService = new AuditService();
    contentFilter = new ContentFilterService(auditService);
    usersRepo = new UsersRepository();
    duplicateService = new DuplicateDetectionService(usersRepo, auditService);
    clockService = new ClockService();
  });

  describe('ContentFilterService', () => {
    it('blocks profanity & spam variants with case, spacing, and character swaps without echoing blocked words', () => {
      const blockedSamples = [
        'This is F U C K unacceptable',
        'Do not touch this sh1t code',
        'S.H.I.T project',
        'Get FREE CRYPTO right now',
        'Click to buy followers fast',
        'Stop being an a$$h0le',
        'f_u_c_k you',
      ];

      for (const sample of blockedSamples) {
        expect(contentFilter.containsBlockedContent(sample)).toBe(true);
        let thrown: any = null;
        try {
          contentFilter.assertClean({ description: sample }, ['description'], {
            actorId: 'u1',
            entityType: 'project',
          });
        } catch (err) {
          thrown = err;
        }
        expect(thrown).toBeInstanceOf(BadRequestException);
        const body = thrown.getResponse();
        expect(body.code).toBe('CONTENT_NOT_ALLOWED');
        expect(body.field).toBe('description');
        expect(JSON.stringify(body).toLowerCase()).not.toContain('fuck');
        expect(JSON.stringify(body).toLowerCase()).not.toContain('shit');
        expect(JSON.stringify(body).toLowerCase()).not.toContain('crypto');
      }

      const auditLogs = auditService.findAll();
      const blockedLogs = auditLogs.filter((l) => l.action === 'CONTENT_BLOCKED');
      expect(blockedLogs.length).toBe(blockedSamples.length);
      for (const log of blockedLogs) {
        expect(log.details).toEqual({ field: 'description' });
        expect(JSON.stringify(log)).not.toContain('crypto');
        expect(JSON.stringify(log)).not.toContain('followers');
      }
    });

    it('never false-positives on innocent words like class, assistant, analysis, scrum, assignment, hello, pass, python, react, skill', () => {
      const safeSamples = [
        'class assignment for CS101',
        'AI teaching assistant for data analysis and scrum planning',
        'hello team, pass the python and react skill assessment',
        'Push it forward with clean TypeScript metadata',
        'Compass associate database script for project management',
      ];

      for (const sample of safeSamples) {
        expect(contentFilter.containsBlockedContent(sample)).toBe(false);
        expect(() =>
          contentFilter.assertClean({ title: sample, description: sample }, ['title', 'description']),
        ).not.toThrow();
      }
    });
  });

  describe('DuplicateDetectionService', () => {
    it('normalizes Gmail dots and +tags (case-insensitive) while keeping custom domain dots intact', () => {
      expect(duplicateService.normalizeEmail('Alice.Smith+work@Gmail.com')).toBe('alicesmith@gmail.com');
      expect(duplicateService.normalizeEmail('ALICE.SMITH@googlemail.com')).toBe('alicesmith@gmail.com');
      expect(duplicateService.normalizeEmail('bob+test@outlook.com')).toBe('bob@outlook.com');
      expect(duplicateService.normalizeEmail('a.b@university.edu')).toBe('a.b@university.edu');
    });

    it('detects normalized email and shared verified phone duplicate groups and flags users without blocking', () => {
      const u1 = usersRepo.create({
        name: 'Alice One',
        username: 'alice_one_p16',
        email: 'alice.smith@gmail.com',
        role: UserRole.Collaborator,
      }, 'u-dup-1');
      const u2 = usersRepo.create({
        name: 'Alice Two',
        username: 'alice_two_p16',
        email: 'alicesmith+promo@gmail.com',
        role: UserRole.Collaborator,
      }, 'u-dup-2');
      const u3 = usersRepo.create({
        name: 'Phone Twin One',
        username: 'phone_twin_1',
        email: 'twin1@university.edu',
        role: UserRole.Collaborator,
      }, 'u-dup-3');
      const u4 = usersRepo.create({
        name: 'Phone Twin Two',
        username: 'phone_twin_2',
        email: 'twin2@university.edu',
        role: UserRole.Collaborator,
      }, 'u-dup-4');

      u3.phone = '+919999900001';
      u3.phoneVerified = true;
      u4.phone = '+91 99999-00001';
      u4.phoneVerified = true;

      const groups = duplicateService.scanAndFlag();
      expect(groups.some((g) => g.type === 'email' && g.normalizedValue === 'alicesmith@gmail.com')).toBe(true);
      expect(groups.some((g) => g.type === 'phone' && g.normalizedValue === '+919999900001')).toBe(true);

      expect(u1.duplicateFlag).toBe(true);
      expect(u2.duplicateFlag).toBe(true);
      expect(u1.status).toBe('Active');
      expect(u2.status).toBe('Active');
      expect(u3.duplicateFlag).toBe(true);
      expect(u4.duplicateFlag).toBe(true);
    });
  });

  describe('EmailVerifiedGuard', () => {
    const makeCtx = (userObj: any): ExecutionContext =>
      ({
        switchToHttp: () => ({
          getRequest: () => ({ user: userObj, headers: {} }),
        }),
      } as any);

    it('blocks unverified non-admin users with 403 EMAIL_NOT_VERIFIED and permits verified & admin users', () => {
      const mockUsersService: Partial<UsersService> = {
        findRawUserById: (id: string) =>
          id === 'u-unverified'
            ? ({ id: 'u-unverified', emailVerified: false } as any)
            : ({ id, emailVerified: true } as any),
      };
      const guard = new EmailVerifiedGuard(mockUsersService as UsersService);

      let thrown: any = null;
      try {
        guard.canActivate(makeCtx({ uid: 'u-unverified', role: 'collaborator', emailVerified: false }));
      } catch (err) {
        thrown = err;
      }
      expect(thrown).toBeInstanceOf(ForbiddenException);
      expect(thrown.getResponse().code).toBe('EMAIL_NOT_VERIFIED');

      expect(guard.canActivate(makeCtx({ uid: '2', role: 'collaborator', emailVerified: true }))).toBe(true);
      expect(guard.canActivate(makeCtx({ uid: 'u-admin', role: 'admin', emailVerified: false }))).toBe(true);
    });
  });

  describe('UsersService OTP attempt limit & phone uniqueness', () => {
    it('voids OTP and locks for 15 minutes via ClockService on 5th wrong attempt; resets after expiry or success', () => {
      const usersService = new UsersService(
        usersRepo,
        { findByUserId: () => [] } as any,
        {} as any,
        { isConfigured: () => false } as any,
        auditService,
        { create: () => ({}) } as any,
        clockService,
        contentFilter,
        duplicateService,
      );

      clockService.setTime('2026-12-01T10:00:00.000Z');
      usersService.setOtpChallengeForTest('2', '+919876543211', '654321');

      // 4 wrong attempts throw 400 with decrementing attemptsRemaining
      for (let i = 1; i <= 4; i++) {
        let caught: any;
        try {
          usersService.verifyPhoneOtp('2', '000000');
        } catch (err) {
          caught = err;
        }
        expect(caught).toBeInstanceOf(BadRequestException);
        expect(caught.getResponse().wrongAttempts).toBe(i);
        expect(caught.getResponse().attemptsRemaining).toBe(5 - i);
      }

      // 5th wrong attempt -> 429 OTP_LOCKED & code void
      let lockErr: any;
      try {
        usersService.verifyPhoneOtp('2', '000000');
      } catch (err) {
        lockErr = err;
      }
      expect(lockErr).toBeInstanceOf(HttpException);
      expect(lockErr.getStatus()).toBe(429);
      expect(lockErr.getResponse().code).toBe('OTP_LOCKED');

      const statusLocked = usersService.getOtpStatus('2');
      expect(statusLocked.locked).toBe(true);
      expect(statusLocked.codeVoid).toBe(true);
      expect(statusLocked.remainingSeconds).toBe(900);

      // Even the previously right code cannot be used while locked
      expect(() => usersService.verifyPhoneOtp('2', '654321')).toThrow(HttpException);
      expect(() => usersService.requestPhoneOtp('2', '+919876543211')).toThrow(HttpException);

      // Advance 14m 59s -> still locked
      clockService.advanceTime(14 * 60 * 1000 + 59 * 1000);
      expect(usersService.getOtpStatus('2').locked).toBe(true);

      // Advance 2s more (15m 1s total) -> lock lifts
      clockService.advanceTime(2000);
      expect(usersService.getOtpStatus('2').locked).toBe(false);

      // Old void code cannot succeed even after unlock
      expect(() => usersService.verifyPhoneOtp('2', '654321')).toThrow(BadRequestException);

      // Request new challenge, try 2 wrong, then right code -> resets counter
      usersService.setOtpChallengeForTest('2', '+919876543211', '112233');
      expect(() => usersService.verifyPhoneOtp('2', '999999')).toThrow(BadRequestException);
      expect(() => usersService.verifyPhoneOtp('2', '999999')).toThrow(BadRequestException);
      expect(usersService.getOtpStatus('2').wrongAttempts).toBe(2);

      const verifiedUser = usersService.verifyPhoneOtp('2', '112233');
      expect(verifiedUser.phoneVerified).toBe(true);
      expect(verifiedUser.phone).toBe('+919876543211');
      expect(usersService.getOtpStatus('2').wrongAttempts).toBe(0);

      // Active user 6 cannot reuse +919876543211
      let dupPhoneErr: any;
      try {
        usersService.requestPhoneOtp('6', '+919876543211');
      } catch (err) {
        dupPhoneErr = err;
      }
      expect(dupPhoneErr).toBeInstanceOf(ConflictException);
      expect(dupPhoneErr.getResponse().code).toBe('PHONE_ALREADY_USED');
    });
  });
});
