import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  HttpException,
  HttpStatus,
  Logger,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FirebaseService } from '../firebase/firebase.service';
import { ClockService } from '../common/services/clock.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateProfileDto } from './dto/create-profile.dto';
import { normalizeRole } from '../common/utils/role.util';
import { UserRole } from '../users/dto/create-user.dto';
import { MailService } from '../mail/mail.service';
import { ContentFilterService } from '../common/services/content-filter.service';
import { DuplicateDetectionService } from '../users/duplicate-detection.service';
import { LoginThrottleService } from './login-throttle.service';
import { BootService } from '../system/boot.service';
import { buildSuspendedResponse } from '../common/utils/suspended-response.util';

export interface PasswordResetTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}

export interface EmailVerificationTokenRecord {
  id: string;
  userId: string;
  email: string;
  tokenHash: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}

export interface ForgotPasswordResponse {
  message: string;
  resetLink?: string;
  previewUrl?: string | false;
  mode?: string;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  // In-memory password reset tokens
  private resetTokens: PasswordResetTokenRecord[] = [];
  private tokenExpiryMs = 15 * 60 * 1000;

  // In-memory email verification tokens (24h expiry, single use, 2m resend cooldown)
  private emailVerificationTokens: EmailVerificationTokenRecord[] = [];
  private readonly EMAIL_VERIFY_EXPIRY_MS = 24 * 60 * 60 * 1000;
  private readonly EMAIL_RESEND_COOLDOWN_MS = 2 * 60 * 1000;
  private readonly lastVerificationSentAt = new Map<string, number>();

  // Stricter rate limiter for forgot password: max 5 requests per identifier per hour, 20 per IP per hour
  private readonly forgotAttempts = new Map<string, number[]>();
  private readonly forgotIpAttempts = new Map<string, number[]>();
  private readonly FORGOT_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
  private readonly MAX_FORGOT_REQUESTS_PER_HOUR = 5;
  private readonly MAX_FORGOT_REQUESTS_PER_IP_PER_HOUR = 20;

  // Refresh token rotation & theft detection tombstone
  private readonly rotatedRefreshTokens = new Map<string, { userId: string; rotatedAt: Date }>();

  private jwtSecret = '';

  constructor(
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly jwtService: JwtService,
    private readonly firebaseService: FirebaseService,
    private readonly mailService: MailService,
    @Optional()
    private readonly clockService?: ClockService,
    @Optional()
    private readonly contentFilterService?: ContentFilterService,
    @Optional()
    private readonly duplicateDetectionService?: DuplicateDetectionService,
    @Optional()
    private readonly loginThrottleService?: LoginThrottleService,
    @Optional()
    private readonly bootService?: BootService,
  ) {}

  onModuleInit() {
    this.initJwtSecret();
  }

  private initJwtSecret() {
    let secret = process.env.JWT_SECRET;
    if (!secret || !secret.trim()) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('FATAL: JWT_SECRET environment variable is missing in production!');
      } else {
        secret = 'teamforge-jwt-secret-key-development-minimum-32-chars';
        this.logger.warn('⚠️ JWT_SECRET is missing in development. Generated a temporary random secret.');
      }
    }
    this.jwtSecret = secret;
  }

  getSecret(): string {
    if (!this.jwtSecret) {
      this.initJwtSecret();
    }
    return this.jwtSecret;
  }

  private parseDurationMs(duration: string | undefined, defaultMs: number): number {
    if (!duration) return defaultMs;
    const trimmed = String(duration).trim().toLowerCase();
    const match = trimmed.match(/^(\d+)([smhdwy])?$/);
    if (!match) return defaultMs;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      case 'w': return value * 7 * 24 * 60 * 60 * 1000;
      case 'y': return value * 365 * 24 * 60 * 60 * 1000;
      default: return value;
    }
  }

  getAccessTokenTtl(): string {
    return (
      process.env.ACCESS_TOKEN_TTL ||
      process.env.JWT_ACCESS_TTL ||
      '15m'
    );
  }

  getRefreshTokenTtl(): string {
    return (
      process.env.REFRESH_TOKEN_TTL ||
      process.env.JWT_REFRESH_TTL ||
      '7d'
    );
  }

  getRefreshTokenTtlMs(): number {
    const rawTtl = process.env.REFRESH_TOKEN_TTL || process.env.JWT_REFRESH_TTL;
    const sessionMaxDays = process.env.SESSION_MAX_DAYS ? parseInt(process.env.SESSION_MAX_DAYS, 10) : undefined;
    const defaultMs = (sessionMaxDays && !isNaN(sessionMaxDays) ? sessionMaxDays : 7) * 24 * 60 * 60 * 1000;
    return this.parseDurationMs(rawTtl, defaultMs);
  }

  // ──────────────────────────────────────────────────────────────
  // Token Generation
  // ──────────────────────────────────────────────────────────────
  private generateAccessToken(user: any): string {
    const normRole = normalizeRole(user.role || 'Collaborator');
    const permissions =
      normRole === 'superuser'
        ? ['*']
        : normRole === 'admin'
        ? Array.isArray(user.permissions)
          ? user.permissions
          : ['*']
        : [];
    const rawUser = user?.id ? this.usersService.findRawUserById(String(user.id)) : null;
    const tv = user.tokenVersion ?? rawUser?.tokenVersion ?? 1;

    const payload = {
      sub: String(user.id),
      email: user.email,
      role: normRole,
      permissions,
      tv,
      jti: crypto.randomUUID(),
      ...(this.bootService?.bootId ? { bootId: this.bootService.bootId } : {}),
    };

    return this.jwtService.sign(payload, {
      secret: this.getSecret(),
      algorithm: 'HS256',
      expiresIn: this.getAccessTokenTtl() as any,
      issuer: 'teamforge',
      audience: 'teamforge-web',
    });
  }

  private generateRefreshToken(userId: string, req?: any): string {
    const rawUser = userId ? this.usersService.findRawUserById(String(userId)) : null;
    const tv = rawUser?.tokenVersion ?? 1;
    const rawToken = this.jwtService.sign(
      {
        sub: String(userId),
        type: 'refresh',
        tv,
        jti: crypto.randomUUID(),
        ...(this.bootService?.bootId ? { bootId: this.bootService.bootId } : {}),
      },
      {
        secret: this.getSecret(),
        algorithm: 'HS256',
        expiresIn: this.getRefreshTokenTtl() as any,
        issuer: 'teamforge',
        audience: 'teamforge-web',
      },
    );
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + this.getRefreshTokenTtlMs());
    const device = req?.headers ? (req.headers['user-agent'] as string) : undefined;

    this.usersService.addRefreshToken(userId, tokenHash, expiresAt, device);
    return rawToken;
  }

  private setRefreshTokenCookie(res: any, refreshToken: string): void {
    if (!res || typeof res.cookie !== 'function') return;
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('teamforge_refresh_token', refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      maxAge: this.getRefreshTokenTtlMs(),
      path: '/',
    });
  }

  private clearRefreshTokenCookie(res: any): void {
    if (!res || typeof res.clearCookie !== 'function') return;
    res.clearCookie('teamforge_refresh_token', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
  }

  private getNowDate(): Date {
    return this.clockService ? this.clockService.now() : new Date();
  }

  private async issueEmailVerification(user: any): Promise<void> {
    const uid = String(user.id);
    const now = this.getNowDate();
    const nowMs = now.getTime();

    // Invalidate any prior unused tokens for this user
    for (const rec of this.emailVerificationTokens) {
      if (rec.userId === uid && !rec.used) {
        rec.used = true;
      }
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    this.emailVerificationTokens.push({
      id: `verify-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId: uid,
      email: user.email,
      tokenHash,
      expiresAt: new Date(nowMs + this.EMAIL_VERIFY_EXPIRY_MS),
      used: false,
      createdAt: now,
    });
    this.lastVerificationSentAt.set(uid, nowMs);

    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
    const verificationLink = `${frontendUrl}/verify-email?token=${rawToken}`;

    try {
      await this.mailService.sendEmailVerificationEmail({
        to: user.email,
        name: user.name,
        verificationLink,
        expiryHours: 24,
      });
    } catch (err: any) {
      this.logger.warn(`Failed to dispatch verification email to ${user.email}: ${err?.message}`);
    }
  }

  public async issueEmailVerificationForUser(user: any): Promise<void> {
    await this.issueEmailVerification(user);
  }

  public async issuePasswordSetupLink(user: {
    id: string;
    email: string;
    name?: string;
    role?: string;
  }): Promise<{ sent: boolean; mode: string }> {
    this.resetTokens = this.resetTokens.filter((t) => t.userId !== String(user.id));

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const now = this.getNowDate();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    this.resetTokens.push({
      id: `rst-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId: String(user.id),
      tokenHash,
      expiresAt,
      used: false,
      createdAt: now,
    });

    const frontendBase = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
    const resetLink = `${frontendBase}/reset-password?token=${rawToken}`;

    let mode = 'console';
    try {
      const mailResult = await this.mailService.sendPasswordResetEmail({
        to: user.email,
        name: user.name || user.email,
        resetLink,
        expiryMinutes: 24 * 60,
      });
      mode = mailResult?.mode || 'console';
    } catch (err: any) {
      this.logger.warn(`Failed to dispatch password setup email to ${user.email}: ${err?.message}`);
    }

    return { sent: true, mode };
  }

  // ──────────────────────────────────────────────────────────────
  // Signup
  // ──────────────────────────────────────────────────────────────
  async signup(dto: SignupDto, req: any, res: any) {
    const cleanedEmail = (dto.email || '').trim().toLowerCase();
    const emailPrefix = (cleanedEmail.split('@')[0] || '').trim() || 'User';
    const providedName = typeof dto.name === 'string' ? dto.name.trim() : '';
    const temporaryName = providedName || emailPrefix;

    const normSignupRole = normalizeRole(dto.role || 'Collaborator');
    if (normSignupRole !== 'collaborator' && normSignupRole !== 'project-owner') {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'FORBIDDEN_ROLE',
        message: 'Public signup is allowed only for Collaborator or Project Owner accounts.',
      });
    }
    const targetSignupRole =
      normSignupRole === 'project-owner' ? UserRole.ProjectOwner : UserRole.Collaborator;

    if (providedName) {
      this.contentFilterService?.assertClean(
        { name: providedName },
        ['name'],
        { actorId: cleanedEmail || 'signup', entityType: 'user' },
      );
    }

    if (!this.usersService.isEmailAvailable(cleanedEmail)) {
      throw new ConflictException('An account with this email already exists');
    }

    // Signup no longer collects or stores a username; step 2 (/complete-profile -> POST /auth/profile)
    // collects, filters, and enforces uniqueness on username.
    const newUser = this.usersService.create({
      name: temporaryName,
      username: '',
      email: cleanedEmail,
      password: dto.password,
      role: targetSignupRole,
      emailVerified: false,
      profileComplete: false,
      usernameAutoGenerated: false,
    });

    const now = this.getNowDate();
    this.usersService.touchLastActive(String(newUser.id), now.getTime(), now.toISOString(), true);

    await this.issueEmailVerification(newUser);
    this.duplicateDetectionService?.scanAndFlag(String(newUser.id), newUser.name || newUser.email);

    const refreshedSafe = this.usersService.findById(String(newUser.id));
    const accessToken = this.generateAccessToken(refreshedSafe);
    const refreshToken = this.generateRefreshToken(String(newUser.id), req);
    this.setRefreshTokenCookie(res, refreshToken);

    this.auditService.log({
      action: 'signup',
      actor: refreshedSafe.name || refreshedSafe.username || refreshedSafe.email,
      target: 'Account Registration',
      entityType: 'user',
      entityId: String(newUser.id),
      event: `New user "${refreshedSafe.username || refreshedSafe.name || refreshedSafe.email}" signed up (${refreshedSafe.email})`,
      details: { role: refreshedSafe.role, emailVerified: false },
    });

    return {
      user: refreshedSafe,
      accessToken,
      refreshToken,
      verificationEmailSent: true,
    };
  }

  async verifyEmail(rawToken: string) {
    const token = String(rawToken || '').trim();
    if (!token) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'INVALID_VERIFICATION_TOKEN',
        message: 'Verification token is required.',
      });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const record = this.emailVerificationTokens.find((rec) => rec.tokenHash === tokenHash);
    if (!record) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'INVALID_VERIFICATION_TOKEN',
        message: 'Invalid verification link.',
      });
    }

    if (record.used) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'TOKEN_ALREADY_USED',
        message: 'This verification link has already been used.',
      });
    }

    const now = this.getNowDate();
    if (now.getTime() > record.expiresAt.getTime()) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'TOKEN_EXPIRED',
        message: 'This verification link has expired. Please request a new verification email.',
      });
    }

    // Consume this token and any remaining pending tokens for the user
    for (const rec of this.emailVerificationTokens) {
      if (rec.userId === record.userId && !rec.used) {
        rec.used = true;
      }
    }

    const rawUser = this.usersService.findRawUserById(record.userId);
    if (!rawUser) {
      throw new NotFoundException('Account not found.');
    }

    const verifiedAt = now.toISOString();
    rawUser.emailVerified = true;
    rawUser.emailVerifiedAt = verifiedAt;
    this.usersService.update(record.userId, {
      emailVerified: true,
      emailVerifiedAt: verifiedAt,
    } as any);

    this.auditService.log({
      action: 'email-verified',
      actor: rawUser.name || rawUser.email,
      target: 'Email Verification',
      entityType: 'user',
      entityId: String(record.userId),
      event: `User "${rawUser.username || rawUser.email}" verified their email address`,
      details: { userId: String(record.userId), verifiedAt },
    });

    return {
      verified: true,
      message: 'Email address verified successfully.',
      user: this.usersService.findById(record.userId),
    };
  }

  async resendVerificationEmail(userId: string) {
    const rawUser = this.usersService.findRawUserById(String(userId));
    if (!rawUser) {
      throw new NotFoundException('Account not found.');
    }

    if (rawUser.emailVerified !== false) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'EMAIL_ALREADY_VERIFIED',
        message: 'Your email address is already verified.',
      });
    }

    const uid = String(rawUser.id);
    const nowMs = this.getNowDate().getTime();
    const lastSentMs = this.lastVerificationSentAt.get(uid);

    if (lastSentMs !== undefined && nowMs - lastSentMs < this.EMAIL_RESEND_COOLDOWN_MS) {
      const retryAtMs = lastSentMs + this.EMAIL_RESEND_COOLDOWN_MS;
      const cooldownSeconds = Math.max(1, Math.ceil((retryAtMs - nowMs) / 1000));
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          code: 'RESEND_COOLDOWN',
          message: `Please wait ${cooldownSeconds} seconds before requesting another verification email.`,
          retryAt: new Date(retryAtMs).toISOString(),
          cooldownSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.issueEmailVerification(rawUser);

    this.auditService.log({
      action: 'email-verification-resent',
      actor: rawUser.name || rawUser.email,
      target: 'Email Verification Resend',
      entityType: 'user',
      entityId: uid,
      event: `Verification email resent to "${rawUser.email}"`,
    });

    return {
      sent: true,
      message: 'Verification email sent. Please check your inbox.',
      cooldownSeconds: Math.ceil(this.EMAIL_RESEND_COOLDOWN_MS / 1000),
    };
  }

  // ──────────────────────────────────────────────────────────────
  // Login
  // ──────────────────────────────────────────────────────────────
  async login(dto: LoginDto, req: any, res: any, explicitIp?: string) {
    if (typeof dto?.password !== 'string' || !dto.password.trim()) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'PASSWORD_REQUIRED',
        message: 'Password is required.',
      });
    }

    const identifier = (dto.identifier || dto.email || dto.username || '').trim();
    const forwarded = req?.headers?.['x-forwarded-for'];
    const clientIp =
      explicitIp ||
      (forwarded ? String(forwarded).split(',')[0].trim() : '') ||
      req?.ip ||
      req?.socket?.remoteAddress ||
      'unknown';

    // Lookup user so per-account throttle tracks canonical user keys across username/email aliases
    const matchedSafe =
      this.usersService.findRawUserById(identifier) ||
      this.usersService.findAll().find((u) => {
        const idStr = identifier.toLowerCase();
        return (
          (u.email && u.email.toLowerCase() === idStr) ||
          (u.username && u.username.toLowerCase() === idStr) ||
          (u.profile?.username && u.profile.username.toLowerCase() === idStr) ||
          (u.name && u.name.toLowerCase() === idStr)
        );
      });
    const rawUserFull = matchedSafe
      ? this.usersService.findRawUserById(String(matchedSafe.id))
      : null;

    const accountKeys: string[] = [identifier];
    if (rawUserFull) {
      accountKeys.push(
        String(rawUserFull.id),
        String(rawUserFull.email || ''),
        String(rawUserFull.username || ''),
      );
    }

    // 1. Shared throttle check: 10 attempts per account and 30 per IP in 15m window
    this.loginThrottleService?.assertAllowed(accountKeys, clientIp);

    // 2. If no user found or user was deleted, record failure and throw identical 401
    if (!rawUserFull || (rawUserFull as any).isDeleted || (rawUserFull as any).deletedAt) {
      this.loginThrottleService?.recordFailure(accountKeys, clientIp);
      this.auditService.log({
        action: 'login-failed',
        actor: identifier || 'anonymous',
        target: 'User Login',
        event: `Failed login attempt for identifier "${identifier}" (invalid credentials)`,
      });
      throw new UnauthorizedException({
        statusCode: 401,
        error: 'Unauthorized',
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid credentials',
      });
    }

    // 3. Check password hash (never passwordless)
    const storedPassword = rawUserFull.password;
    let passwordMatches = false;
    if (storedPassword) {
      if (storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$')) {
        passwordMatches = bcrypt.compareSync(dto.password, storedPassword);
      } else {
        passwordMatches = storedPassword === dto.password;
      }
    }

    if (!passwordMatches) {
      this.loginThrottleService?.recordFailure(accountKeys, clientIp);
      this.auditService.log({
        action: 'login-failed',
        actor: rawUserFull.name || identifier,
        target: 'User Login',
        event: `Failed login attempt for "${identifier}" (invalid credentials)`,
      });
      throw new UnauthorizedException({
        statusCode: 401,
        error: 'Unauthorized',
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid credentials',
      });
    }

    // Suspended accounts get suspension message ONLY AFTER correct password
    const status = String(rawUserFull.status || '').toLowerCase();
    if (status === 'suspended' || status === 'banned') {
      this.loginThrottleService?.resetAccount(accountKeys);
      try {
        this.auditService.log({
          action: 'LOGIN_BLOCKED_SUSPENDED',
          actor: `User #${rawUserFull.id}`,
          target: 'User Login',
          entityType: 'user',
          entityId: String(rawUserFull.id),
          event: `Login blocked: Account for user ${rawUserFull.id} is suspended.`,
          details: {
            userId: String(rawUserFull.id),
          },
        });
      } catch (err: any) {
        console.warn('[auth.service] Suppressed audit log error:', err?.message || err);
      }
      throw new ForbiddenException(buildSuspendedResponse(rawUserFull));
    }

    // Clear failed account counter on valid login (IP counter intentionally preserved)
    this.loginThrottleService?.resetAccount(accountKeys);

    const now = this.clockService ? this.clockService.now() : new Date();
    this.usersService.touchLastActive(String(rawUserFull.id), now.getTime(), now.toISOString(), true);

    const safeUser = this.usersService.findById(String(rawUserFull.id));
    const accessToken = this.generateAccessToken(rawUserFull);
    const refreshToken = this.generateRefreshToken(String(safeUser.id), req);
    this.setRefreshTokenCookie(res, refreshToken);

    this.auditService.log({
      action: 'login',
      actor: safeUser.name || safeUser.username || safeUser.email,
      target: 'User Login',
      entityType: 'user',
      entityId: String(safeUser.id),
      event: `User "${safeUser.username || safeUser.email}" logged in successfully`,
      details: { email: safeUser.email, role: safeUser.role },
    });

    return {
      user: safeUser,
      accessToken,
      refreshToken,
    };
  }

  // ──────────────────────────────────────────────────────────────
  // Refresh Token Rotation (Phase 1B Step 2f)
  // ──────────────────────────────────────────────────────────────
  async refresh(tokenValue: string | undefined, req: any, res: any) {
    const rawToken = tokenValue || req?.cookies?.teamforge_refresh_token;
    if (!rawToken || !String(rawToken).trim()) {
      throw new UnauthorizedException({
        statusCode: 401,
        error: 'Unauthorized',
        code: 'REFRESH_INVALID',
        message: 'Missing refresh token.',
      });
    }

    const trimmedToken = String(rawToken).trim();
    let refreshClaims: any = null;

    if (trimmedToken.split('.').length === 3) {
      try {
        refreshClaims = this.jwtService.verify(trimmedToken, {
          secret: this.getSecret(),
          algorithms: ['HS256'],
          issuer: 'teamforge',
          audience: 'teamforge-web',
        });
      } catch (err: any) {
        if (err?.name === 'TokenExpiredError' || String(err?.message || '').toLowerCase().includes('expired')) {
          this.clearRefreshTokenCookie(res);
          throw new UnauthorizedException({
            statusCode: 401,
            error: 'Unauthorized',
            code: 'REFRESH_INVALID',
            message: 'Refresh token has expired. Please log in again.',
          });
        }
        refreshClaims = this.jwtService.decode(trimmedToken);
      }

      // Check suspension for user associated with token claims before boot or session checks
      const tokenHashEarly = crypto.createHash('sha256').update(trimmedToken).digest('hex');
      const userFromHashEarly = this.usersService['usersRepository'].findUserByRefreshToken(tokenHashEarly);
      const earlyUserId = userFromHashEarly?.id || refreshClaims?.sub;
      if (earlyUserId) {
        const earlyUser = this.usersService.findRawUserById(String(earlyUserId));
        if (earlyUser) {
          const status = String(earlyUser.status || '').toLowerCase();
          if (status === 'suspended' || status === 'banned') {
            this.usersService.revokeAllRefreshTokens(String(earlyUser.id));
            this.clearRefreshTokenCookie(res);
            throw new ForbiddenException(buildSuspendedResponse(earlyUser));
          }
        }
      }

      if (this.bootService?.bootId && refreshClaims && refreshClaims.type === 'refresh') {
        if (!refreshClaims.bootId || refreshClaims.bootId !== this.bootService.bootId) {
          this.clearRefreshTokenCookie(res);
          throw new UnauthorizedException({
            statusCode: 401,
            error: 'Unauthorized',
            code: 'SESSION_INVALID',
            message: 'Your session is no longer valid because the server restarted. Please log in again.',
          });
        }
      }
    }

    const tokenHash = crypto.createHash('sha256').update(trimmedToken).digest('hex');

    // 1. Check if token was already rotated (theft detection with 10s grace window for concurrent requests)
    if (this.rotatedRefreshTokens.has(tokenHash)) {
      const tombstone = this.rotatedRefreshTokens.get(tokenHash)!;
      const elapsedMs = Date.now() - new Date(tombstone.rotatedAt).getTime();
      if (elapsedMs < 10000) {
        this.logger.warn(`Refresh token received within rotation grace period (${elapsedMs}ms). Skipping theft revocation.`);
        const safeUser = this.usersService.findById(tombstone.userId);
        if (safeUser) {
          const freshAccessToken = this.generateAccessToken(safeUser);
          return { accessToken: freshAccessToken };
        }
      }

      this.logger.error(`🚨 THEFT DETECTED: Reuse of rotated refresh token for user ${tombstone.userId}!`);

      // Revoke all sessions for this user
      this.usersService.revokeAllRefreshTokens(tombstone.userId);
      this.clearRefreshTokenCookie(res);

      this.auditService.log({
        action: 'token-reuse-detected',
        actor: `User #${tombstone.userId}`,
        target: 'Security Alert',
        entityType: 'user',
        entityId: tombstone.userId,
        event: `Refresh token theft/reuse detected! All active sessions revoked for user ${tombstone.userId}.`,
      });

      throw new UnauthorizedException({
        statusCode: 401,
        error: 'Unauthorized',
        code: 'REFRESH_INVALID',
        message: 'Refresh token reuse detected. All sessions have been revoked.',
      });
    }

    // 2. Find user who owns this active refresh token
    const userFromHash = this.usersService['usersRepository'].findUserByRefreshToken(tokenHash);
    const resolvedUserId = userFromHash?.id || (refreshClaims?.sub ? String(refreshClaims.sub) : '');
    const user = this.usersService.findRawUserById(resolvedUserId || '');

    if (!user) {
      this.clearRefreshTokenCookie(res);
      throw new UnauthorizedException({
        statusCode: 401,
        error: 'Unauthorized',
        code: 'REFRESH_INVALID',
        message: 'Invalid or expired refresh token. Please log in again.',
      });
    }

    if ((user as any).isDeleted || (user as any).deletedAt) {
      this.clearRefreshTokenCookie(res);
      throw new UnauthorizedException({
        statusCode: 401,
        error: 'Unauthorized',
        code: 'SESSION_INVALID',
        message: 'Account has been deleted.',
      });
    }

    // Reject if suspended
    const status = String(user.status || '').toLowerCase();
    if (status === 'suspended' || status === 'banned') {
      this.usersService.revokeAllRefreshTokens(String(user.id));
      this.clearRefreshTokenCookie(res);
      throw new ForbiddenException(buildSuspendedResponse(user));
    }

    // 3. Rotate token: invalidate old token, mark in tombstone, issue new token
    this.usersService.revokeRefreshToken(String(user.id), tokenHash);
    this.rotatedRefreshTokens.set(tokenHash, {
      userId: String(user.id),
      rotatedAt: new Date(),
    });

    const safeUser = this.usersService.findById(String(user.id));
    const newAccessToken = this.generateAccessToken(safeUser);
    const newRefreshToken = this.generateRefreshToken(String(safeUser.id), req);
    this.setRefreshTokenCookie(res, newRefreshToken);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: safeUser,
    };
  }

  // ──────────────────────────────────────────────────────────────
  // Logout & Logout-All
  // ──────────────────────────────────────────────────────────────
  async logout(userId: string | undefined, tokenValue: string | undefined, req: any, res: any) {
    const rawToken = tokenValue || req?.cookies?.teamforge_refresh_token;
    if (rawToken && userId) {
      const tokenHash = crypto.createHash('sha256').update(String(rawToken).trim()).digest('hex');
      this.usersService.revokeRefreshToken(userId, tokenHash);
    }
    this.clearRefreshTokenCookie(res);

    if (userId) {
      const user = this.usersService.findUserSafe(userId);
      this.auditService.log({
        action: 'logout',
        actor: user?.name || user?.username || `User #${userId}`,
        target: 'User Logout',
        entityType: 'user',
        entityId: userId,
        event: `User "${user?.name || userId}" logged out`,
      });
    }

    return { message: 'Logged out successfully' };
  }

  async logoutAll(userId: string, res: any) {
    this.usersService.revokeAllRefreshTokens(userId);
    this.clearRefreshTokenCookie(res);

    const user = this.usersService.findUserSafe(userId);
    this.auditService.log({
      action: 'logout-all',
      actor: user?.name || user?.username || `User #${userId}`,
      target: 'User Logout All',
      entityType: 'user',
      entityId: userId,
      event: `User "${user?.name || userId}" revoked all active sessions`,
    });

    return { message: 'All active sessions have been logged out' };
  }

  // ──────────────────────────────────────────────────────────────
  // Change Password
  // ──────────────────────────────────────────────────────────────
  async changePassword(userId: string, dto: ChangePasswordDto, res: any) {
    const rawUser = this.usersService.findRawUserById(userId);
    if (!rawUser) {
      throw new NotFoundException('User not found');
    }

    const storedPassword = rawUser.password;
    let currentMatches = false;
    if (storedPassword) {
      if (storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$')) {
        currentMatches = bcrypt.compareSync(dto.currentPassword, storedPassword);
      } else {
        currentMatches = storedPassword === dto.currentPassword;
      }
    }

    if (!currentMatches) {
      throw new BadRequestException('Current password does not match.');
    }

    // Update password with new bcrypt hash
    this.usersService.update(userId, {
      password: dto.newPassword,
    });

    // Invalidate all tokens
    this.usersService.revokeAllRefreshTokens(userId);
    this.clearRefreshTokenCookie(res);

    this.auditService.log({
      action: 'password-changed',
      actor: rawUser.name || rawUser.username || `User #${userId}`,
      target: 'Password Change',
      entityType: 'user',
      entityId: userId,
      event: `User "${rawUser.name || userId}" updated account password`,
    });

    return { message: 'Password changed successfully. Please log in again.' };
  }

  // ──────────────────────────────────────────────────────────────
  // Role Switch (Phase 1 Step 6 & Phase 1B Step 2i)
  // ──────────────────────────────────────────────────────────────
  async switchRole(userId: string, requestedRole: string, req?: any, res?: any) {
    const result = this.usersService.switchRole(userId, requestedRole);
    const updatedUser = this.usersService.findById(userId);

    // If Firebase mode, sync claim to Firebase
    if (process.env.AUTH_MODE === 'firebase') {
      try {
        await this.firebaseService.auth.setCustomUserClaims(userId, {
          role: result.role,
        });
      } catch (err: any) {
        this.logger.warn(`Could not set Firebase custom claims for ${userId}: ${err.message}`);
      }
    }

    this.auditService.log({
      action: 'role-switch',
      actor: updatedUser.name || updatedUser.username || `User #${userId}`,
      target: 'Role Change',
      entityType: 'user',
      entityId: userId,
      event: `User switched active role to "${result.role}"`,
      details: { previousRole: updatedUser.role, newRole: result.role },
    });

    // In JWT mode: issue new tokens with updated role claim
    const accessToken = this.generateAccessToken(updatedUser);
    const refreshToken = this.generateRefreshToken(userId, req);
    this.setRefreshTokenCookie(res, refreshToken);

    return {
      role: result.role,
      accessToken,
      refreshToken,
      user: updatedUser,
    };
  }

  // ──────────────────────────────────────────────────────────────
  // Profile Creation (Phase 1 Step 4)
  // ──────────────────────────────────────────────────────────────
  async createOrUpdateProfile(userId: string, email: string | undefined, dto: CreateProfileDto) {
    const rawUser = this.usersService.findRawUserById(String(userId));
    const existingUsername = rawUser?.username || rawUser?.profile?.username;
    if (existingUsername && String(existingUsername).trim()) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'USERNAME_ALREADY_SET',
        message: 'Username is already set and cannot be changed.',
      });
    }

    const rawUsername = dto.username;
    if (!rawUsername || typeof rawUsername !== 'string' || !rawUsername.trim()) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'USERNAME_REQUIRED',
        message: 'Username is required.',
      });
    }

    this.contentFilterService?.assertClean(
      {
        name: dto.name,
        username: rawUsername,
        university: dto.university,
      },
      ['name', 'username', 'university'],
      { actorId: String(userId), entityType: 'user', entityId: String(userId) },
    );

    const cleanUsername = rawUsername.trim().toLowerCase();
    if (!/^[a-zA-Z0-9_-]{3,30}$/.test(cleanUsername)) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'BAD_REQUEST',
        message: 'Username must be 3-30 characters long and can contain letters, numbers, underscores, and hyphens.',
      });
    }

    if (!this.usersService.isUsernameAvailable(cleanUsername, userId)) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'USERNAME_TAKEN',
        message: 'This username is already taken.',
      });
    }

    const normRole = normalizeRole(dto.role || 'Collaborator');
    if (normRole !== 'collaborator' && normRole !== 'project-owner') {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'FORBIDDEN_ROLE',
        message: 'Only Collaborator or Project Owner roles can be chosen during profile setup.',
      });
    }
    const user = this.usersService.completeSocialProfile(
      userId,
      email,
      {
        name: (dto.name || cleanUsername).trim(),
        username: cleanUsername,
        role: normRole,
        university: dto.university ? dto.university.trim() : '',
      },
    );

    this.duplicateDetectionService?.scanAndFlag(String(user.id || userId), user.name || user.username);

    return user;
  }

  // ──────────────────────────────────────────────────────────────
  // Username / Email Lookup (Phase 2 Step 3)
  // ──────────────────────────────────────────────────────────────
  resolveIdentifier(identifier: string) {
    const user = this.usersService.findByIdentifier(identifier);
    if (!user || !user.email) {
      throw new NotFoundException('Account not found');
    }
    // Return only email needed for sign-in and nothing else
    return { email: user.email };
  }

  getUserById(userId: string) {
    try {
      return this.usersService.findById(userId);
    } catch {
      return null;
    }
  }

  // ──────────────────────────────────────────────────────────────
  // Forgot & Reset Password (Existing flow preserved & enhanced)
  // ──────────────────────────────────────────────────────────────
  setTokenExpiryMsForTest(ms: number): void {
    this.tokenExpiryMs = ms;
  }

  resetTokenExpiryMs(): void {
    this.tokenExpiryMs = 15 * 60 * 1000;
  }

  getTokensForTest(): PasswordResetTokenRecord[] {
    return [...this.resetTokens];
  }

  clearAttemptsForTest(): void {
    this.forgotAttempts.clear();
    this.loginThrottleService?.reset();
    this.emailVerificationTokens = [];
    this.lastVerificationSentAt.clear();
  }

  resetToSeed(): void {
    this.resetTokens = [];
    this.emailVerificationTokens = [];
    this.lastVerificationSentAt.clear();
    this.forgotAttempts.clear();
    this.forgotIpAttempts.clear();
    this.rotatedRefreshTokens.clear();
    this.loginThrottleService?.resetToSeed?.();
  }

  getEmailVerificationTokensForTest(): EmailVerificationTokenRecord[] {
    return [...this.emailVerificationTokens];
  }

  private checkForgotRateLimit(rawIdentifier: string, clientIp?: string): void {
    const now = Date.now();
    const windowStart = now - this.FORGOT_RATE_LIMIT_WINDOW_MS;

    // 1. Identifier rate limiter: max 5 requests per identifier per hour
    const key = (rawIdentifier || '').trim().toLowerCase();
    if (key) {
      let timestamps = this.forgotAttempts.get(key) || [];
      timestamps = timestamps.filter((ts) => ts > windowStart);

      if (timestamps.length >= this.MAX_FORGOT_REQUESTS_PER_HOUR) {
        this.logger.warn(`Password reset rate limit exceeded for identifier: "${key}"`);
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Too many password reset requests for this account. Please try again later.',
            error: 'Too Many Requests',
            retryAfter: 3600,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      timestamps.push(now);
      this.forgotAttempts.set(key, timestamps);
    }

    // 2. IP rate limiter: max 20 requests per IP per hour
    const ipKey = (clientIp || '').trim();
    if (ipKey) {
      let ipTimestamps = this.forgotIpAttempts.get(ipKey) || [];
      ipTimestamps = ipTimestamps.filter((ts) => ts > windowStart);

      if (ipTimestamps.length >= this.MAX_FORGOT_REQUESTS_PER_IP_PER_HOUR) {
        this.logger.warn(`Password reset rate limit exceeded for IP: "${ipKey}"`);
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Too many password reset requests from this network. Please try again later.',
            error: 'Too Many Requests',
            retryAfter: 3600,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      ipTimestamps.push(now);
      this.forgotIpAttempts.set(ipKey, ipTimestamps);
    }
  }

  async forgotPassword(dto: ForgotPasswordDto, clientIp?: string): Promise<ForgotPasswordResponse> {
    const rawIdentifier = (dto.identifier || '').trim();
    this.checkForgotRateLimit(rawIdentifier, clientIp);

    const genericMessage =
      'If an account with that email or username exists, password reset instructions have been sent.';

    const user = this.usersService.findByIdentifier(rawIdentifier);
    const mailMode = this.mailService.getMode();

    if (!user) {
      return { message: genericMessage, mode: mailMode };
    }

    const status = String(user.status || '').toLowerCase();
    if (status === 'suspended' || status === 'banned') {
      return { message: genericMessage, mode: mailMode };
    }

    this.resetTokens = this.resetTokens.filter((t) => t.userId !== String(user.id));

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const now = this.getNowDate();
    const expiresAt = new Date(now.getTime() + this.tokenExpiryMs);

    const tokenRecord: PasswordResetTokenRecord = {
      id: `rst-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId: String(user.id),
      tokenHash,
      expiresAt,
      used: false,
      createdAt: now,
    };
    this.resetTokens.push(tokenRecord);

    const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${frontendBase}/reset-password?token=${rawToken}`;

    // Send reset email via MailService
    const mailResult = await this.mailService.sendPasswordResetEmail({
      to: user.email,
      name: user.name || user.username,
      resetLink,
      expiryMinutes: Math.round(this.tokenExpiryMs / 60000),
    });

    this.auditService.log({
      action: 'password-reset-requested',
      entityType: 'user',
      entityId: String(user.id),
      actor: user.name || user.username || user.email,
      target: 'Password Reset',
      event: `Password reset requested for user "${user.name || user.username || user.email}" (Mode: ${mailResult.mode})`,
      details: { email: user.email, userId: user.id, mailMode: mailResult.mode, messageId: mailResult.messageId },
    });

    const isProduction = process.env.NODE_ENV === 'production';
    const response: ForgotPasswordResponse = {
      message: genericMessage,
      mode: mailResult.mode,
    };

    if (!isProduction) {
      response.resetLink = resetLink;
      if (mailResult.previewUrl) {
        response.previewUrl = mailResult.previewUrl;
      }
    }
    return response;
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const token = (dto.token || '').trim();
    const newPassword = dto.newPassword;

    if (!token) {
      throw new BadRequestException('Reset token is required.');
    }

    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters long.');
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const record = this.resetTokens.find((t) => t.tokenHash === tokenHash);

    if (!record) {
      throw new BadRequestException('Invalid or expired reset token.');
    }

    if (record.used) {
      throw new BadRequestException('This reset token has already been used.');
    }

    const now = this.clockService ? this.clockService.now() : new Date();
    if (record.expiresAt < now) {
      throw new BadRequestException('This reset token has expired. Please request a new one.');
    }

    const user = this.usersService.findById(record.userId);
    if (!user) {
      throw new BadRequestException('User associated with token not found.');
    }

    record.used = true;

    // Update password with bcrypt hash
    this.usersService.update(String(user.id), { password: newPassword });

    // Revoke all sessions
    this.usersService.revokeAllRefreshTokens(String(user.id));

    this.auditService.log({
      action: 'password-reset-completed',
      entityType: 'user',
      entityId: String(user.id),
      actor: user.name || user.username || user.email,
      target: 'Password Reset',
      event: `Password was successfully reset for user "${user.name || user.username || user.email}"`,
      details: { email: user.email, userId: user.id },
    });

    try {
      this.notificationsService.create({
        userId: String(user.id),
        type: 'SECURITY_ALERT',
        title: 'Password Reset Successful',
        message: 'Your account password was successfully reset. If this was not you, please contact support immediately.',
      });
    } catch (notifErr: any) {
      this.logger.warn(`Failed to dispatch password reset notification: ${notifErr?.message}`);
    }

    return { message: 'Password reset successful. You can now log in with your new password.' };
  }

  clearUserTokens(userId: string): void {
    const uid = String(userId || '');
    this.resetTokens = this.resetTokens.filter((t) => String(t.userId) !== uid);
    this.emailVerificationTokens = this.emailVerificationTokens.filter((t) => String(t.userId) !== uid);
    this.lastVerificationSentAt.delete(uid);
  }
}
