import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * SecurityMiddleware — Helmet-like Security Headers
 *
 * Sets critical HTTP security headers on every response to protect
 * against common web vulnerabilities (XSS, clickjacking, MIME sniffing,
 * protocol downgrade attacks, etc.).
 *
 * Applied globally to all routes via AppModule MiddlewareConsumer.
 */
@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // Prevent MIME type sniffing — browser must respect Content-Type
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Prevent clickjacking — page cannot be embedded in iframes
    res.setHeader('X-Frame-Options', 'DENY');

    // Enable browser XSS filter with blocking mode
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Enforce HTTPS connections (1 year max-age, include subdomains)
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

    // Basic Content Security Policy — restricts resource loading sources
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'",
    );

    // Control referrer information sent with requests
    res.setHeader('Referrer-Policy', 'no-referrer');

    // Prevent Adobe Flash and Acrobat from loading data from this domain
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

    // Disable browser DNS prefetching to prevent privacy leaks
    res.setHeader('X-DNS-Prefetch-Control', 'off');

    // Prevent the browser from caching sensitive responses
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');

    next();
  }
}
