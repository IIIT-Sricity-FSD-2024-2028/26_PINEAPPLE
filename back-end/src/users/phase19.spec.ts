import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../app.module';
import { MailService } from '../mail/mail.service';
import { ClockService } from '../common/services/clock.service';
import { AuditService } from '../audit/audit.service';
import { LoginThrottleService } from '../auth/login-throttle.service';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';
import { AuthService } from '../auth/auth.service';
import { serializeSafeUser, stripUserSecrets } from './user-serializer';
import { SelfUpdateUserDto, findDisallowedSelfUpdateFields } from './dto/self-update-user.dto';

describe('Phase 19 Unit Tests: Users Controller Lockdown & Security Controls', () => {
  let appRef: { close: () => Promise<void> };
  let clockService: ClockService;
  let auditService: AuditService;
  let loginThrottleService: LoginThrottleService;
  let usersRepository: UsersRepository;
  let usersService: UsersService;
  let authService: AuthService;

  const sentEmails: any[] = [];
  const mailMock = {
    sendMail: async (opts: any) => {
      sentEmails.push({ type: 'general', ...opts });
      return { success: true, mode: 'console', messageId: 'mock-1' };
    },
    sendEmailVerificationEmail: async (opts: any) => {
      sentEmails.push({ type: 'email-verification', ...opts });
      return { success: true, mode: 'console', messageId: 'mock-verify-1' };
    },
    sendPasswordResetEmail: async (opts: any) => {
      sentEmails.push({ type: 'password-reset', ...opts });
      return { success: true, mode: 'console', messageId: 'mock-reset-1' };
    },
    sendWarningEmail: async () => ({ success: true, mode: 'console', messageId: 'mock-warn' }),
    sendSuspensionEmail: async () => ({ success: true, mode: 'console', messageId: 'mock-susp' }),
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.ALLOW_STORE_RESET = 'true';
    process.env.SCHEDULER_ENABLED = 'false';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailService)
      .useValue(mailMock)
      .compile();

    const app = moduleRef.createNestApplication();
    await app.init();
    appRef = app;

    clockService = moduleRef.get(ClockService);
    auditService = moduleRef.get(AuditService);
    loginThrottleService = moduleRef.get(LoginThrottleService);
    usersRepository = moduleRef.get(UsersRepository);
    usersService = moduleRef.get(UsersService);
    authService = moduleRef.get(AuthService);
  });

  beforeEach(() => {
    sentEmails.length = 0;
    usersRepository.reset();
    auditService.reset();
    loginThrottleService.reset();
    authService.clearAttemptsForTest();
    clockService.reset();
  });

  afterAll(async () => {
    if (appRef) {
      await appRef.close();
    }
  });

  describe('1. LoginThrottleService', () => {
    it('locks account after 10 wrong attempts, audits LOGIN_THROTTLED, and includes retryAt', () => {
      const account = 'arjun.sharma@teamforge.io';
      for (let i = 0; i < 10; i++) {
        loginThrottleService.assertAllowed(account, '10.0.0.5');
        loginThrottleService.recordFailure(account, '10.0.0.5');
      }

      let caught: any = null;
      try {
        loginThrottleService.assertAllowed(account, '10.0.0.5');
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeTruthy();
      expect(caught.getStatus()).toBe(429);
      const body = caught.getResponse();
      expect(body.code).toBe('TOO_MANY_ATTEMPTS');
      expect(body.retryAt).toBeTruthy();
      expect(new Date(body.retryAt).getTime()).toBeGreaterThan(clockService.now().getTime());

      const throttledLogs = auditService
        .findAll()
        .filter((e) => e.action === 'LOGIN_THROTTLED');
      expect(throttledLogs.length).toBeGreaterThanOrEqual(1);
    });

    it('resetAccount clears account failures while preserving per-IP failures', () => {
      const account = 'arjun.sharma@teamforge.io';
      for (let i = 0; i < 9; i++) {
        loginThrottleService.recordFailure(account, '10.0.0.10');
      }
      expect(loginThrottleService.getAccountFailureCount(account)).toBe(9);
      expect(loginThrottleService.getIpFailureCount('10.0.0.10')).toBe(9);

      loginThrottleService.resetAccount(account);
      expect(loginThrottleService.getAccountFailureCount(account)).toBe(0);
      expect(loginThrottleService.getIpFailureCount('10.0.0.10')).toBe(9);
    });

    it('enforces 30 attempts per IP across distinct accounts in 15 minutes', () => {
      const sharedIp = '192.168.10.22';
      for (let i = 0; i < 30; i++) {
        const acct = `user${i}@example.com`;
        loginThrottleService.assertAllowed(acct, sharedIp);
        loginThrottleService.recordFailure(acct, sharedIp);
      }

      expect(() =>
        loginThrottleService.assertAllowed('brandnew@example.com', sharedIp),
      ).toThrow();
    });

    it('expires both account and IP windows after 15 minutes via ClockService', () => {
      const account = 'expiry.check@teamforge.io';
      const ip = '10.0.0.77';
      for (let i = 0; i < 10; i++) {
        loginThrottleService.recordFailure(account, ip);
      }
      expect(() => loginThrottleService.assertAllowed(account, ip)).toThrow();

      clockService.advanceTime(15 * 60 * 1000 + 1000);
      expect(() => loginThrottleService.assertAllowed(account, ip)).not.toThrow();
    });
  });

  describe('2. User Serializer Secret Stripping', () => {
    it('strips passwords, hashes, tokens, reset codes, and OTP fields recursively', () => {
      const dirty: any = {
        id: '2',
        name: 'Arjun',
        email: 'arjun.sharma@teamforge.io',
        password: '$2a$10$secrethashvalue',
        passwordHash: '$2a$10$anotherhash',
        salt: 'salty',
        tokenVersion: 4,
        allowedLegacyJti: 'jti-123',
        refreshTokens: [{ hash: 'rf-hash', expiresAt: new Date() }],
        resetToken: 'reset-tok-1',
        resetCode: '123456',
        verificationToken: 'ver-tok-1',
        otpChallenges: { phone: { codeHash: 'hash' } },
        profile: {
          fullName: 'Arjun',
          otpSecret: 'top-secret',
        },
      };

      const safe = serializeSafeUser(dirty);
      const strippedJson = JSON.stringify(stripUserSecrets(dirty));

      expect(safe.password).toBeUndefined();
      expect(safe.passwordHash).toBeUndefined();
      expect(safe.salt).toBeUndefined();
      expect(safe.refreshTokens).toBeUndefined();
      expect(safe.resetToken).toBeUndefined();
      expect(safe.resetCode).toBeUndefined();
      expect(safe.verificationToken).toBeUndefined();
      expect(safe.otpChallenges).toBeUndefined();
      expect(safe.tokenVersion).toBeUndefined();
      expect(safe.allowedLegacyJti).toBeUndefined();
      expect(safe.profile.otpSecret).toBeUndefined();
      expect(strippedJson).not.toContain('secrethashvalue');
      expect(strippedJson).not.toContain('top-secret');
      expect(safe.email).toBe('arjun.sharma@teamforge.io');
    });
  });

  describe('3. SelfUpdateUserDto Allow-List & Validation', () => {
    it('rejects role, status, emailVerified, xp, and reputation while accepting allowed fields', async () => {
      const pipe = new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      });

      const forbiddenPayloads = [
        { role: 'Super User' },
        { status: 'Active' },
        { emailVerified: true },
        { xp: 99999 },
        { reputation: 500 },
      ];

      for (const payload of forbiddenPayloads) {
        await expect(
          pipe.transform(payload, { type: 'body', metatype: SelfUpdateUserDto }),
        ).rejects.toThrow();
        expect(findDisallowedSelfUpdateFields(payload).length).toBeGreaterThan(0);
      }

      const validPayload = {
        name: 'Arjun Updated',
        bio: 'Updated bio for team collaboration.',
        avatar: '/uploads/avatar.png',
        skills: ['TypeScript', 'NestJS'],
        links: { github: 'https://github.com/arjun' },
        settings: { compactMode: true },
      };

      const transformed = await pipe.transform(validPayload, {
        type: 'body',
        metatype: SelfUpdateUserDto,
      });
      expect(transformed.name).toBe('Arjun Updated');
      expect(findDisallowedSelfUpdateFields(validPayload)).toEqual([]);
    });
  });

  describe('4. Email Change Verification & Session Revocation', () => {
    it('resets emailVerified to false, revokes other sessions, re-indexes email, and sends verification mail', async () => {
      const before = usersRepository.findById('2')!;
      const initialTv = before.tokenVersion || 1;
      const hashedOtherRefresh = 'other-session-refresh-hash';
      usersRepository.addRefreshToken('2', hashedOtherRefresh, new Date(Date.now() + 60_000));

      const updated = await usersService.selfUpdate(
        '2',
        { email: 'arjun.new@teamforge.io' },
        { callerId: '2', jti: 'caller-current-jti' },
      );

      expect(updated.email).toBe('arjun.new@teamforge.io');
      expect(updated.emailVerified).toBe(false);

      const rawAfter = usersRepository.findById('2')!;
      expect(rawAfter.tokenVersion).toBe(initialTv + 1);
      expect(rawAfter.allowedLegacyJti).toBe('caller-current-jti');
      expect(rawAfter.refreshTokens?.length || 0).toBe(0);
      expect(usersRepository.findByEmail('arjun.new@teamforge.io')?.id).toBe('2');
      expect(usersRepository.findByEmail('arjun.sharma@teamforge.io')).toBeUndefined();

      const verifyMails = sentEmails.filter(
        (m) => m.type === 'email-verification' && m.to === 'arjun.new@teamforge.io',
      );
      expect(verifyMails.length).toBe(1);
    });
  });

  describe('5. Password Storage Invariant', () => {
    it('hashes password when creating user via Super User and never returns password', async () => {
      const created = await usersService.createBySuperUser(
        {
          name: 'Ops Admin',
          email: 'ops.unit@teamforge.io',
          role: 'Administrator',
        },
        'u-superuser',
      );

      expect(created.password).toBeUndefined();
      expect(created.passwordHash).toBeUndefined();
      const raw = usersRepository.findById(String(created.id))!;
      expect(raw.password).toBeTruthy();
      expect(bcrypt.getRounds(raw.password!)).toBeGreaterThanOrEqual(10);
    });
  });
});
