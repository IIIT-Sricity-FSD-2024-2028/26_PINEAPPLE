import { HttpException, HttpStatus, Injectable, Logger, Optional } from '@nestjs/common';
import { ClockService } from '../common/services/clock.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class LoginThrottleService {
  private readonly logger = new Logger(LoginThrottleService.name);
  static readonly WINDOW_MS = 15 * 60 * 1000; // 15 minutes
  static readonly MAX_ACCOUNT_ATTEMPTS = 10;
  static readonly MAX_IP_ATTEMPTS = 30;

  private readonly accountAttempts = new Map<string, number[]>();
  private readonly ipAttempts = new Map<string, number[]>();

  constructor(
    @Optional() private readonly clockService?: ClockService,
    @Optional() private readonly auditService?: AuditService,
  ) {}

  private getNowMs(): number {
    return this.clockService ? this.clockService.now().getTime() : Date.now();
  }

  private normalizeKeys(identifiers: string | string[]): string[] {
    const rawList = Array.isArray(identifiers) ? identifiers : [identifiers];
    const set = new Set<string>();
    for (const item of rawList) {
      const clean = String(item || '').trim().toLowerCase();
      if (clean) set.add(clean);
    }
    return Array.from(set);
  }

  private normalizeIp(ip?: string): string {
    const clean = String(ip || '').trim();
    return clean || 'unknown';
  }

  private pruneWindow(timestamps: number[] | undefined, nowMs: number): number[] {
    if (!timestamps || timestamps.length === 0) return [];
    const cutoff = nowMs - LoginThrottleService.WINDOW_MS;
    return timestamps.filter((ts) => ts > cutoff);
  }

  /**
   * Throws 429 TOO_MANY_ATTEMPTS if any account key reached 10 failures
   * or the client IP reached 30 failures within the 15-minute window.
   */
  assertAllowed(
    identifiers: string | string[],
    ip?: string,
    options?: { auditAction?: string },
  ): void {
    const nowMs = this.getNowMs();
    const accountKeys = this.normalizeKeys(identifiers);
    const ipKey = this.normalizeIp(ip);

    let blockedOldestMs: number | null = null;
    let limitType: 'account' | 'ip' | null = null;

    for (const key of accountKeys) {
      const pruned = this.pruneWindow(this.accountAttempts.get(key), nowMs);
      if (pruned.length === 0) {
        this.accountAttempts.delete(key);
      } else {
        this.accountAttempts.set(key, pruned);
      }
      if (pruned.length >= LoginThrottleService.MAX_ACCOUNT_ATTEMPTS) {
        limitType = 'account';
        const candidate = pruned[0];
        if (blockedOldestMs === null || candidate > blockedOldestMs) {
          blockedOldestMs = candidate;
        }
      }
    }

    const ipPruned = this.pruneWindow(this.ipAttempts.get(ipKey), nowMs);
    if (ipPruned.length === 0) {
      this.ipAttempts.delete(ipKey);
    } else {
      this.ipAttempts.set(ipKey, ipPruned);
    }

    if (ipPruned.length >= LoginThrottleService.MAX_IP_ATTEMPTS) {
      if (!limitType) limitType = 'ip';
      const candidate = ipPruned[0];
      if (blockedOldestMs === null || candidate > blockedOldestMs) {
        blockedOldestMs = candidate;
      }
    }

    if (limitType && blockedOldestMs !== null) {
      const retryAtMs = blockedOldestMs + LoginThrottleService.WINDOW_MS;
      const retryAt = new Date(retryAtMs).toISOString();
      const retryAfterSeconds = Math.max(1, Math.ceil((retryAtMs - nowMs) / 1000));
      const actorLabel = accountKeys[0] || ipKey;

      this.logger.warn(
        `Login throttled (${limitType}) for "${actorLabel}" from IP "${ipKey}" until ${retryAt}`,
      );

      try {
        this.auditService?.log({
          action: options?.auditAction || 'LOGIN_THROTTLED',
          actor: actorLabel,
          performedBy: actorLabel,
          target: 'Login Throttle',
          entityType: 'auth',
          event: `Login throttled (${limitType} limit) for "${actorLabel}" from IP "${ipKey}"`,
          details: {
            identifier: accountKeys[0] || null,
            ip: ipKey,
            limitType,
            retryAt,
          },
        });
      } catch (err: any) {
        this.logger.warn(`Failed to audit LOGIN_THROTTLED: ${err?.message}`);
      }

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          code: 'TOO_MANY_ATTEMPTS',
          message: `Too many failed login attempts. Try again after ${retryAt}.`,
          retryAt,
          retryAfter: retryAfterSeconds,
          retryAfterSeconds,
          cooldownSeconds: retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /**
   * Records a failed login attempt for the given account identifier(s) and IP.
   */
  recordFailure(identifiers: string | string[], ip?: string): void {
    const nowMs = this.getNowMs();
    const accountKeys = this.normalizeKeys(identifiers);
    const ipKey = this.normalizeIp(ip);

    for (const key of accountKeys) {
      const pruned = this.pruneWindow(this.accountAttempts.get(key), nowMs);
      pruned.push(nowMs);
      this.accountAttempts.set(key, pruned);
    }

    const ipPruned = this.pruneWindow(this.ipAttempts.get(ipKey), nowMs);
    ipPruned.push(nowMs);
    this.ipAttempts.set(ipKey, ipPruned);
  }

  /**
   * Resets account failure counters on a successful login.
   * IP counter is intentionally preserved to prevent bypassing IP throttling.
   */
  resetAccount(identifiers: string | string[]): void {
    const accountKeys = this.normalizeKeys(identifiers);
    for (const key of accountKeys) {
      this.accountAttempts.delete(key);
    }
  }

  getAccountFailureCount(identifier: string): number {
    const nowMs = this.getNowMs();
    const keys = this.normalizeKeys(identifier);
    if (keys.length === 0) return 0;
    const pruned = this.pruneWindow(this.accountAttempts.get(keys[0]), nowMs);
    return pruned.length;
  }

  getIpFailureCount(ip: string): number {
    const nowMs = this.getNowMs();
    const ipKey = this.normalizeIp(ip);
    const pruned = this.pruneWindow(this.ipAttempts.get(ipKey), nowMs);
    return pruned.length;
  }

  resetToSeed(): void {
    this.reset();
  }

  reset(): void {
    this.accountAttempts.clear();
    this.ipAttempts.clear();
  }
}
