import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Optional,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { BootService } from '../system/boot.service';
import { ClockService } from '../common/services/clock.service';
import { parseCorsOrigins } from '../common/config/cors.config';
import {
  clearRefreshCookie,
  extractCookieFromRequest,
  getAdminRefreshCookieName,
  getAdminRefreshCookieOptions,
  parseDurationMs,
  setRefreshCookie,
} from '../common/utils/refresh-cookie.util';
import { normalizeRole } from '../common/utils/role.util';
import { buildSuspendedResponse } from '../common/utils/suspended-response.util';
import { PortalAdminsService } from '../portal-admins/portal-admins.service';
import { UsersService } from '../users/users.service';

export interface AdminRefreshRecord {
  tokenHash: string;
  adminId: string;
  email: string;
  rotationId: string;
  chainId: string;
  sessionStartedAt: number;
  issuedAt: number;
  expiresAt: number;
  tokenVersion: number;
  rotatedOut: boolean;
}

export interface ResolvedActiveAdmin {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'superuser';
  permissions: string[];
  status: string;
  tokenVersion: number;
  rawEntity?: any;
}

export interface AdminAuthSessionResponse {
  token: string;
  role: 'admin' | 'superuser';
  permissions: string[];
  name: string;
  email: string;
  admin: {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'superuser';
    permissions: string[];
  };
}

@Injectable()
export class AdminRefreshService {
  private readonly recordsByHash = new Map<string, AdminRefreshRecord>();
  private readonly adminTokenVersions = new Map<string, number>();
  private readonly refreshRateBuckets = new Map<string, number[]>();
  private readonly fallbackJwtService = new JwtService({});

  constructor(
    @Optional() private readonly jwtService?: JwtService,
    @Optional() private readonly clockService?: ClockService,
    @Optional() private readonly bootService?: BootService,
    @Optional() private readonly portalAdminsService?: PortalAdminsService,
    @Optional() private readonly usersService?: UsersService,
  ) {}

  private nowMs(): number {
    return this.clockService ? this.clockService.now().getTime() : Date.now();
  }

  private hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  getCookieName(): string {
    return getAdminRefreshCookieName();
  }

  getAccessTokenTtl(): string {
    return (
      process.env.ADMIN_ACCESS_TOKEN_TTL ||
      process.env.ACCESS_TOKEN_TTL ||
      '15m'
    );
  }

  getRefreshTtlMs(): number {
    return parseDurationMs(process.env.ADMIN_REFRESH_TTL, 12 * 3_600_000);
  }

  getSessionMaxLifetimeMs(): number {
    const rawHours = Number(process.env.ADMIN_SESSION_MAX_HOURS);
    const hours = Number.isFinite(rawHours) && rawHours > 0 ? rawHours : 24;
    return Math.floor(hours * 3_600_000);
  }

  private getRateLimitMax(): number {
    const raw = Number(process.env.ADMIN_REFRESH_RATE_LIMIT_MAX);
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 30;
  }

  private getRateLimitWindowMs(): number {
    const raw = Number(process.env.ADMIN_REFRESH_RATE_LIMIT_WINDOW_MS);
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 15 * 60_000;
  }

  private getJwtSigner(): JwtService {
    return this.jwtService || this.fallbackJwtService;
  }

  getTokenVersion(adminId: string): number {
    const key = String(adminId);
    const storedVersion = this.adminTokenVersions.get(key) ?? 1;

    const portalAdmin = this.portalAdminsService?.findById(key);
    const portalVersion = portalAdmin?.tokenVersion ?? 1;

    const user = this.usersService?.findRawUserById?.(key);
    const userVersion = user?.tokenVersion ?? 1;

    return Math.max(storedVersion, portalVersion, userVersion, 1);
  }

  bumpTokenVersion(adminId: string): number {
    const key = String(adminId);
    const nextVersion = this.getTokenVersion(key) + 1;
    this.adminTokenVersions.set(key, nextVersion);

    const portalAdmin = this.portalAdminsService?.findById?.(key);
    if (portalAdmin) {
      portalAdmin.tokenVersion = nextVersion;
    }

    if (this.usersService?.findRawUserById?.(key)) {
      const userVersion = this.usersService.bumpTokenVersion(key);
      if (userVersion > nextVersion) {
        this.adminTokenVersions.set(key, userVersion);
      }
    }

    this.revokeAllForAdmin(key);
    return this.getTokenVersion(key);
  }

  generateAdminAccessToken(
    uid: string,
    email: string,
    role: string,
    permissions: string[],
    tokenVersion?: number,
  ): string {
    if (process.env.AUTH_MODE === 'legacy') {
      return role === 'superuser' ? 'mock-su-token-456' : 'mock-admin-token-123';
    }
    const secret =
      process.env.JWT_SECRET ||
      'teamforge-jwt-secret-key-development-minimum-32-chars';
    const tv = tokenVersion ?? this.getTokenVersion(uid);

    return this.getJwtSigner().sign(
      {
        sub: uid,
        email,
        role,
        permissions,
        tv,
        jti: crypto.randomUUID(),
        ...(this.bootService?.bootId ? { bootId: this.bootService.bootId } : {}),
      },
      {
        secret,
        algorithm: 'HS256',
        expiresIn: this.getAccessTokenTtl() as any,
        issuer: 'teamforge',
        audience: 'teamforge-web',
      },
    );
  }

  resolveActiveAdmin(
    adminId: string,
    emailHint?: string,
  ): ResolvedActiveAdmin | null {
    const id = String(adminId || '');
    const emailLower = (emailHint || '').trim().toLowerCase();

    if (id === 'u-superuser' || (!id && emailLower === 'superuser@teamforge.io')) {
      return {
        id: 'u-superuser',
        email: 'superuser@teamforge.io',
        name: 'Super User',
        role: 'superuser',
        permissions: ['*'],
        status: 'active',
        tokenVersion: this.getTokenVersion('u-superuser'),
      };
    }

    if (id === 'u-admin' || (!id && emailLower === 'admin@teamforge.io')) {
      return {
        id: 'u-admin',
        email: 'admin@teamforge.io',
        name: 'Default Admin',
        role: 'admin',
        permissions: ['*'],
        status: 'active',
        tokenVersion: this.getTokenVersion('u-admin'),
      };
    }

    const portalAdmin =
      this.portalAdminsService?.findById(id) ||
      (emailLower ? this.portalAdminsService?.findByEmail(emailLower) : undefined);

    if (portalAdmin) {
      const role =
        normalizeRole(portalAdmin.portalRole) === 'superuser'
          ? 'superuser'
          : 'admin';
      const permissions =
        role === 'superuser'
          ? ['*']
          : Array.isArray(portalAdmin.permissions)
            ? [...portalAdmin.permissions]
            : ['dashboard'];
      return {
        id: String(portalAdmin.id),
        email: portalAdmin.email,
        name: portalAdmin.name || 'Admin',
        role,
        permissions,
        status: String(portalAdmin.status || 'active').toLowerCase(),
        tokenVersion: this.getTokenVersion(String(portalAdmin.id)),
        rawEntity: portalAdmin,
      };
    }

    const dbUser = this.usersService?.findRawUserById?.(id);
    if (dbUser && !(dbUser as any).isDeleted && !(dbUser as any).deletedAt) {
      const norm = normalizeRole(dbUser.role);
      if (norm === 'admin' || norm === 'superuser') {
        const role = norm === 'superuser' ? 'superuser' : 'admin';
        return {
          id: String(dbUser.id),
          email: dbUser.email,
          name: dbUser.name || 'Admin',
          role,
          permissions: ['*'],
          status: String(dbUser.status || 'active').toLowerCase(),
          tokenVersion: this.getTokenVersion(String(dbUser.id)),
          rawEntity: dbUser,
        };
      }
    }

    return null;
  }

  /**
   * Issues a new opaque refresh cookie and records its SHA-256 hash server-side.
   * Called strictly after admin login succeeds.
   */
  issueSessionForAdmin(
    res: any,
    admin: {
      id: string;
      email: string;
      role: 'admin' | 'superuser' | string;
      permissions: string[];
      name: string;
      tokenVersion?: number;
    },
  ): void {
    const rawToken = crypto.randomBytes(48).toString('base64url');
    const tokenHash = this.hashToken(rawToken);
    const now = this.nowMs();
    const ttlMs = this.getRefreshTtlMs();
    const maxCapAt = now + this.getSessionMaxLifetimeMs();
    const expiresAt = Math.min(now + ttlMs, maxCapAt);
    const maxAge = Math.max(0, expiresAt - now);

    const record: AdminRefreshRecord = {
      tokenHash,
      adminId: String(admin.id),
      email: admin.email,
      rotationId: crypto.randomUUID(),
      chainId: crypto.randomUUID(),
      sessionStartedAt: now,
      issuedAt: now,
      expiresAt,
      tokenVersion: admin.tokenVersion ?? this.getTokenVersion(String(admin.id)),
      rotatedOut: false,
    };

    this.recordsByHash.set(tokenHash, record);
    setRefreshCookie(
      res,
      this.getCookieName(),
      rawToken,
      getAdminRefreshCookieOptions(maxAge),
    );
  }

  private validateOriginIfPresent(req: any): void {
    const originHeader = req?.headers?.origin;
    if (!originHeader || typeof originHeader !== 'string') return;
    const allowedOrigins = parseCorsOrigins(process.env.CORS_ORIGINS);
    if (!allowedOrigins.includes(originHeader.trim())) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'ORIGIN_MISMATCH',
        error: 'Forbidden',
        message: 'Origin is not permitted for admin authentication requests.',
      });
    }
  }

  private extractClientIp(req: any): string {
    const forwarded = req?.headers?.['x-forwarded-for'];
    return (
      (forwarded ? String(forwarded).split(',')[0].trim() : '') ||
      req?.ip ||
      req?.socket?.remoteAddress ||
      'unknown'
    );
  }

  private consumeRateLimit(bucketKey: string, now: number): void {
    const windowMs = this.getRateLimitWindowMs();
    const maxAttempts = this.getRateLimitMax();
    const existing = this.refreshRateBuckets.get(bucketKey) || [];
    const active = existing.filter((ts) => now - ts < windowMs);
    if (active.length >= maxAttempts) {
      this.refreshRateBuckets.set(bucketKey, active);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          code: 'RATE_LIMITED',
          error: 'Too Many Requests',
          message: 'Too many admin refresh attempts. Please wait and try again.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    active.push(now);
    this.refreshRateBuckets.set(bucketKey, active);
  }

  private clearCookie(res: any): void {
    clearRefreshCookie(res, this.getCookieName(), getAdminRefreshCookieOptions());
  }

  private throwInvalid(res: any, message = 'Invalid admin refresh session.'): never {
    this.clearCookie(res);
    throw new HttpException(
      {
        statusCode: HttpStatus.UNAUTHORIZED,
        code: 'REFRESH_INVALID',
        error: 'Unauthorized',
        message,
      },
      HttpStatus.UNAUTHORIZED,
    );
  }

  /**
   * Cookie-only refresh endpoint logic with strict rotation, reuse detection,
   * max 24h lifetime cap, and live admin claim/status rehydration.
   */
  refresh(req: any, res: any): AdminAuthSessionResponse {
    this.validateOriginIfPresent(req);
    const now = this.nowMs();
    const clientIp = this.extractClientIp(req);
    this.consumeRateLimit(`ip:${clientIp}`, now);

    const rawToken = extractCookieFromRequest(req, this.getCookieName());
    if (!rawToken) {
      this.throwInvalid(res, 'Missing admin refresh cookie.');
    }

    const tokenHash = this.hashToken(rawToken);
    const record = this.recordsByHash.get(tokenHash);
    if (!record) {
      this.throwInvalid(res, 'Admin refresh session not found or revoked.');
    }

    this.consumeRateLimit(`admin:${record.adminId}`, now);

    if (record.rotatedOut) {
      this.revokeChain(record.chainId);
      this.revokeAllForAdmin(record.adminId);
      this.clearCookie(res);
      throw new HttpException(
        {
          statusCode: HttpStatus.UNAUTHORIZED,
          code: 'REFRESH_REUSED',
          error: 'Unauthorized',
          message: 'Admin refresh token reuse detected. All sessions revoked.',
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const hardDeadline = record.sessionStartedAt + this.getSessionMaxLifetimeMs();
    if (now >= record.expiresAt || now >= hardDeadline) {
      this.recordsByHash.delete(tokenHash);
      this.clearCookie(res);
      throw new HttpException(
        {
          statusCode: HttpStatus.UNAUTHORIZED,
          code: 'REFRESH_EXPIRED',
          error: 'Unauthorized',
          message: 'Admin session expired. Please log in again.',
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const liveAdmin = this.resolveActiveAdmin(record.adminId, record.email);
    if (!liveAdmin) {
      this.revokeAllForAdmin(record.adminId);
      this.throwInvalid(res, 'Admin account no longer exists or lacks admin privileges.');
    }

    if (
      liveAdmin.status === 'suspended' ||
      liveAdmin.status === 'disabled' ||
      liveAdmin.status === 'banned' ||
      liveAdmin.status === 'inactive' ||
      liveAdmin.status === 'deactivated'
    ) {
      this.revokeAllForAdmin(record.adminId);
      this.clearCookie(res);
      const basePayload = buildSuspendedResponse(liveAdmin.rawEntity || liveAdmin);
      throw new ForbiddenException({
        ...basePayload,
        code: 'ACCOUNT_SUSPENDED',
      });
    }

    if (liveAdmin.tokenVersion !== record.tokenVersion) {
      this.revokeAllForAdmin(record.adminId);
      this.throwInvalid(res, 'Admin session has been invalidated. Please log in again.');
    }

    const nextExpiresAt = Math.min(now + this.getRefreshTtlMs(), hardDeadline);
    if (nextExpiresAt <= now) {
      this.revokeChain(record.chainId);
      this.clearCookie(res);
      throw new HttpException(
        {
          statusCode: HttpStatus.UNAUTHORIZED,
          code: 'REFRESH_EXPIRED',
          error: 'Unauthorized',
          message: 'Admin maximum session duration reached. Please log in again.',
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Rotate strictly: mark old record rotatedOut (tombstone) and issue a new opaque token
    record.rotatedOut = true;

    const nextRawToken = crypto.randomBytes(48).toString('base64url');
    const nextTokenHash = this.hashToken(nextRawToken);
    const nextRecord: AdminRefreshRecord = {
      tokenHash: nextTokenHash,
      adminId: liveAdmin.id,
      email: liveAdmin.email,
      rotationId: crypto.randomUUID(),
      chainId: record.chainId,
      sessionStartedAt: record.sessionStartedAt,
      issuedAt: now,
      expiresAt: nextExpiresAt,
      tokenVersion: liveAdmin.tokenVersion,
      rotatedOut: false,
    };
    this.recordsByHash.set(nextTokenHash, nextRecord);

    const maxAge = Math.max(0, nextExpiresAt - now);
    setRefreshCookie(
      res,
      this.getCookieName(),
      nextRawToken,
      getAdminRefreshCookieOptions(maxAge),
    );

    const accessToken = this.generateAdminAccessToken(
      liveAdmin.id,
      liveAdmin.email,
      liveAdmin.role,
      liveAdmin.permissions,
      liveAdmin.tokenVersion,
    );

    return {
      token: accessToken,
      role: liveAdmin.role,
      permissions: liveAdmin.permissions,
      name: liveAdmin.name,
      email: liveAdmin.email,
      admin: {
        id: liveAdmin.id,
        email: liveAdmin.email,
        name: liveAdmin.name,
        role: liveAdmin.role,
        permissions: liveAdmin.permissions,
      },
    };
  }

  logout(req: any, res: any): { success: true; loggedOut: true } {
    this.validateOriginIfPresent(req);
    const rawToken = extractCookieFromRequest(req, this.getCookieName());
    if (rawToken) {
      const tokenHash = this.hashToken(rawToken);
      const record = this.recordsByHash.get(tokenHash);
      if (record) {
        this.revokeChain(record.chainId);
      }
    }
    this.clearCookie(res);
    return { success: true, loggedOut: true };
  }

  revokeChain(chainId: string): void {
    for (const [hash, rec] of this.recordsByHash.entries()) {
      if (rec.chainId === chainId) {
        this.recordsByHash.delete(hash);
      }
    }
  }

  revokeAllForAdmin(adminId: string): void {
    const id = String(adminId);
    for (const [hash, rec] of this.recordsByHash.entries()) {
      if (rec.adminId === id) {
        this.recordsByHash.delete(hash);
      }
    }
  }

  getActiveRecordCountForAdmin(adminId: string): number {
    const id = String(adminId);
    let count = 0;
    for (const rec of this.recordsByHash.values()) {
      if (rec.adminId === id && !rec.rotatedOut) {
        count++;
      }
    }
    return count;
  }

  reset(): void {
    this.recordsByHash.clear();
    this.adminTokenVersions.clear();
    this.refreshRateBuckets.clear();
  }
}
