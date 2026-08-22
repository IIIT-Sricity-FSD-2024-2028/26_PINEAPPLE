import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * SanitizerMiddleware — XSS & HTML Input Sanitization
 *
 * Recursively sanitizes all string fields in req.body, req.query,
 * and req.params to prevent Cross-Site Scripting (XSS) attacks.
 *
 * What it strips:
 *  - <script>...</script> tags and their content
 *  - HTML event handler attributes (onerror, onclick, onload, etc.)
 *  - javascript: URI schemes
 *  - data: URI schemes with text/html content type
 *  - HTML comment injection (<!-- -->)
 *
 * Applied to POST, PATCH, and PUT routes via AppModule MiddlewareConsumer.
 */
@Injectable()
export class SanitizerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SanitizerMiddleware.name);

  use(req: Request, res: Response, next: NextFunction): void {
    if (req.body && typeof req.body === 'object') {
      req.body = this.sanitizeObject(req.body);
    }
    if (req.query && typeof req.query === 'object') {
      req.query = this.sanitizeObject(req.query) as any;
    }
    if (req.params && typeof req.params === 'object') {
      req.params = this.sanitizeObject(req.params) as any;
    }

    next();
  }

  /**
   * Recursively traverses an object and sanitizes all string values.
   */
  private sanitizeObject(obj: any): any {
    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item));
    }

    if (obj !== null && typeof obj === 'object') {
      const sanitized: Record<string, any> = {};
      for (const key of Object.keys(obj)) {
        sanitized[key] = this.sanitizeObject(obj[key]);
      }
      return sanitized;
    }

    return obj;
  }

  /**
   * Sanitizes a single string value by stripping dangerous patterns.
   */
  private sanitizeString(input: string): string {
    let sanitized = input;

    // 1. Remove <script>...</script> tags and their content
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    // 2. Remove standalone <script> or </script> tags
    sanitized = sanitized.replace(/<\/?script\b[^>]*>/gi, '');

    // 3. Remove HTML event handler attributes (on*)
    sanitized = sanitized.replace(/\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '');

    // 4. Remove javascript: URI schemes
    sanitized = sanitized.replace(/javascript\s*:/gi, '');

    // 5. Remove data: URIs with text/html content
    sanitized = sanitized.replace(/data\s*:\s*text\/html/gi, '');

    // 6. Remove HTML comments
    sanitized = sanitized.replace(/<!--[\s\S]*?-->/g, '');

    // 7. Remove <iframe>, <object>, <embed>, <form> tags
    sanitized = sanitized.replace(/<\/?(iframe|object|embed|form)\b[^>]*>/gi, '');

    // Log if sanitization made changes (indicates potential XSS attempt)
    if (sanitized !== input) {
      this.logger.warn(`XSS content detected and sanitized. Original length: ${input.length}, Sanitized length: ${sanitized.length}`);
    }

    return sanitized.trim();
  }
}
