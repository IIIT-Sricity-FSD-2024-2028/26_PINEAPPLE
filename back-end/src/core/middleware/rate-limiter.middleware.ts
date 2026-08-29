import { Injectable, NestMiddleware, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * RateLimiterMiddleware — IP-based Sliding Window Rate Limiter
 *
 * Limits each IP address to a configurable number of requests within
 * a rolling time window. No external dependencies required — uses an
 * in-memory Map with automatic cleanup.
 *
 * Configuration:
 *   - WINDOW_MS:    15 minutes (900,000 ms)
 *   - MAX_REQUESTS: 100 requests per window per IP
 *
 * Applied to sensitive routes via AppModule MiddlewareConsumer:
 *   /users, /projects, /tasks, /admin, /support
 */
@Injectable()
export class RateLimiterMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RateLimiterMiddleware.name);

  // Sliding window configuration
  private readonly WINDOW_MS = 15 * 60 * 1000; // 15 minutes
  private readonly MAX_REQUESTS = 100;

  // In-memory store: IP → array of request timestamps
  private readonly requestMap = new Map<string, number[]>();

  // Periodic cleanup to prevent memory leaks (every 5 minutes)
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000;

  constructor() {
    setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL);
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const windowStart = now - this.WINDOW_MS;

    // Get existing timestamps for this IP, filtering out expired ones
    let timestamps = this.requestMap.get(clientIp) || [];
    timestamps = timestamps.filter((ts) => ts > windowStart);

    if (timestamps.length >= this.MAX_REQUESTS) {
      this.logger.warn(
        `Rate limit exceeded for IP: ${clientIp} — ${timestamps.length}/${this.MAX_REQUESTS} requests in window`,
      );

      // Calculate time until the oldest request in the window expires
      const retryAfterMs = timestamps[0] - windowStart;
      const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);

      res.setHeader('Retry-After', String(retryAfterSeconds));
      res.setHeader('X-RateLimit-Limit', String(this.MAX_REQUESTS));
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', new Date(timestamps[0] + this.WINDOW_MS).toISOString());

      res.status(HttpStatus.TOO_MANY_REQUESTS).json({
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: 'Too many requests. Please try again later.',
        retryAfterSeconds,
      });
      return;
    }

    // Record this request
    timestamps.push(now);
    this.requestMap.set(clientIp, timestamps);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', String(this.MAX_REQUESTS));
    res.setHeader('X-RateLimit-Remaining', String(this.MAX_REQUESTS - timestamps.length));

    next();
  }

  /**
   * Cleans up expired entries to prevent memory leaks.
   */
  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.WINDOW_MS;
    let cleaned = 0;

    for (const [ip, timestamps] of this.requestMap.entries()) {
      const valid = timestamps.filter((ts) => ts > windowStart);
      if (valid.length === 0) {
        this.requestMap.delete(ip);
        cleaned++;
      } else {
        this.requestMap.set(ip, valid);
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Rate limiter cleanup: removed ${cleaned} expired IP entries`);
    }
  }
}
