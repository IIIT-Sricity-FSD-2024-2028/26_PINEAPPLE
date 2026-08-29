import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * ErrorLoggerMiddleware — Express-style Error Handling Middleware
 *
 * This middleware catches errors that slip past NestJS exception filters.
 * It acts as a safety net at the Express layer, logging errors with full
 * stack traces and returning a standardized JSON error response.
 *
 * IMPORTANT: Express error middleware must have exactly 4 parameters
 * (err, req, res, next) to be recognized as error-handling middleware.
 *
 * Applied at the Express app level in main.ts after NestJS initialization.
 */
@Injectable()
export class ErrorLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('ExpressErrorHandler');

  use(req: Request, res: Response, next: NextFunction): void {
    // This middleware is not an error handler itself.
    // The actual Express error handler is registered via getExpressErrorHandler().
    next();
  }

  /**
   * Returns an Express-compatible error-handling middleware function.
   * This must be registered AFTER all routes in main.ts.
   *
   * Usage in main.ts:
   *   const expressApp = app.getHttpAdapter().getInstance();
   *   expressApp.use(ErrorLoggerMiddleware.getExpressErrorHandler());
   */
  static getExpressErrorHandler() {
    const logger = new Logger('ExpressErrorHandler');

    return (err: any, req: Request, res: Response, next: NextFunction): void => {
      const timestamp = new Date().toISOString();
      const status = err.status || err.statusCode || 500;
      const message = err.message || 'Internal server error';
      const stack = err.stack || '';

      logger.error(
        `[${timestamp}] Unhandled Express Error [${req.method} ${req.path}] Status: ${status} — ${message}`,
        stack,
      );

      // Only send response if headers haven't already been sent
      if (!res.headersSent) {
        res.status(status).json({
          statusCode: status,
          message: message,
          error: 'Internal Server Error',
          timestamp: timestamp,
          path: req.url,
        });
      }
    };
  }
}
