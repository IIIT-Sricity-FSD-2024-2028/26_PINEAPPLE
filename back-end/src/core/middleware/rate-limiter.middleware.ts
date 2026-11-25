import { Injectable, NestMiddleware, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * RateLimiterMiddleware
 *
 * Implements an in-memory sliding-window rate limiter per client.
 * Identifies clients by req.user.uid, x-user-id header when present, and by IP address otherwise.
 *
 * Defaults:
 *   - Window: 1 hour (3,600,000 ms)
 *   - Max requests: 5,000 requests per window
 *   - Response: HTTP 429 Too Many Requests with Retry-After header
 */
@Injectable()
export class RateLimiterMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RateLimiterMiddleware.name);

  // Map of client identifier -> array of request timestamps (epoch ms)
  private readonly requestMap = new Map<string, number[]>();

  // Configuration
  private readonly windowMs: number = 60 * 60 * 1000; // 1 hour
  private maxRequests: number = 5000; // requests per window

  constructor() {
    // Periodically prune stale keys every 10 minutes to prevent memory leaks
    setInterval(() => this.pruneStaleEntries(), 10 * 60 * 1000).unref();
  }

  /**
   * Override maxRequests for testing purposes.
   */
  setMaxRequestsForTesting(limit: number): void {
    this.maxRequests = limit;
  }

  /**
   * Reset maxRequests to default after testing.
   */
  resetMaxRequestsForTesting(): void {
    this.maxRequests = 5000;
  }

  /**
   * Clear all tracked request records (for test isolation).
   */
  clearRecordsForTesting(): void {
    this.requestMap.clear();
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const rawPath = req.baseUrl || req.path || req.originalUrl || '';
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

    // Identify client by uid when present, x-user-id header, and by IP otherwise
    const authUser = (req as any).user;
    const rawUserId = authUser?.uid || req.headers['x-user-id'];
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

    // Decorate response with standard rate limit headers
    res.setHeader('X-RateLimit-Limit', String(this.maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(this.maxRequests - timestamps.length));
    res.setHeader(
      'X-RateLimit-Reset',
      new Date(timestamps[0] + this.windowMs).toISOString(),
    );

    next();
  }

  /**
   * Prune expired timestamps and clean up map entries with no active requests.
   */
  private pruneStaleEntries(): void {
    const windowStart = Date.now() - this.windowMs;
    for (const [key, timestamps] of this.requestMap.entries()) {
      const active = timestamps.filter((ts) => ts > windowStart);
      if (active.length === 0) {
        this.requestMap.delete(key);
      } else {
        this.requestMap.set(key, active);
      }
    }
  }
}
