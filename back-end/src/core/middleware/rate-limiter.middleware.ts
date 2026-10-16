import { Injectable, NestMiddleware, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * ============================================================================
 * RATE LIMITER CONFIGURATION (Phase 8, Part C)
 * ============================================================================
 * Easily configurable window duration and request limit.
 * Change these constants to adjust the rate limit across the backend.
 */
export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour (in milliseconds)
export const RATE_LIMIT_MAX_REQUESTS = 5000; // 5,000 requests per client per window

/**
 * RateLimiterMiddleware — Client-aware Sliding Window Rate Limiter
 *
 * Identifies clients by the `x-user-id` header when present and by IP address otherwise.
 * Covers all application routes including `/uploads` and `/escrow`.
 * Automatically bypasses documentation (`/api`, `/swagger`, `/api-json`) and
 * health check (`/ping`, `/health`) routes.
 *
 * When exceeded:
 *   - HTTP Status: 429 Too Many Requests
 *   - Response Header: `Retry-After` (in seconds)
 *   - Additional Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
 */
@Injectable()
export class RateLimiterMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RateLimiterMiddleware.name);

  // Sliding window configuration
  public static readonly WINDOW_MS = RATE_LIMIT_WINDOW_MS;
  public static readonly MAX_REQUESTS = RATE_LIMIT_MAX_REQUESTS;

  private readonly windowMs = RATE_LIMIT_WINDOW_MS;
  private readonly maxRequests = RATE_LIMIT_MAX_REQUESTS;

  // In-memory store: Client Key (user:<id> or ip:<address>) → array of request timestamps
  private readonly requestMap = new Map<string, number[]>();

  // Periodic cleanup to prevent memory leaks (every 10 minutes)
  private readonly CLEANUP_INTERVAL = 10 * 60 * 1000;

  constructor() {
    setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL);
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const rawPath = (req.originalUrl || req.url || '').split('?')[0];
    const path = rawPath.toLowerCase();

    // Health or docs routes must not be blocked by the rate limiter
    if (
      path === '/' ||
      path === '/ping' ||
      path === '/health' ||
      path === '/api' ||
      path.startsWith('/api/') ||
      path === '/api-json' ||
      path.startsWith('/swagger')
    ) {
      return next();
    }

    // Identify client by x-user-id header when present, and by IP otherwise
    const rawUserId = req.headers['x-user-id'];
    const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;
    const clientKey =
      typeof userId === 'string' && userId.trim()
        ? `user:${userId.trim()}`
        : `ip:${req.ip || req.socket?.remoteAddress || 'unknown'}`;

    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get existing timestamps for this client, filtering out expired entries
    let timestamps = this.requestMap.get(clientKey) || [];
    timestamps = timestamps.filter((ts) => ts > windowStart);

    if (timestamps.length >= this.maxRequests) {
      this.logger.warn(
        `Rate limit exceeded for client [${clientKey}] — ${timestamps.length}/${this.maxRequests} requests in window`,
      );

      // Time in seconds until the oldest request in the window expires
      const retryAfterMs = Math.max(0, timestamps[0] + this.windowMs - now);
      const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));

      res.setHeader('Retry-After', String(retryAfterSeconds));
      res.setHeader('X-RateLimit-Limit', String(this.maxRequests));
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', new Date(timestamps[0] + this.windowMs).toISOString());

      res.status(HttpStatus.TOO_MANY_REQUESTS).json({
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: 'Too many requests. Please try again later.',
        retryAfterSeconds,
      });
      return;
    }

    // Record this request timestamp
    timestamps.push(now);
    this.requestMap.set(clientKey, timestamps);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', String(this.maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(this.maxRequests - timestamps.length));

    next();
  }

  /**
   * Cleans up expired entries to prevent memory leaks.
   */
  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    let cleaned = 0;

    for (const [key, timestamps] of this.requestMap.entries()) {
      const valid = timestamps.filter((ts) => ts > windowStart);
      if (valid.length === 0) {
        this.requestMap.delete(key);
        cleaned++;
      } else {
        this.requestMap.set(key, valid);
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Rate limiter cleanup: removed ${cleaned} expired client entries`);
    }
  }
}
