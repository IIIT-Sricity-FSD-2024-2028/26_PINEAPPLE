import { Injectable, NestMiddleware, Logger, Inject } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { LogManagerService } from '../services/log-manager.service';

/**
 * LoggerMiddleware — Enhanced Structured Request Logger
 *
 * Responsibilities:
 * 1. Generates a unique correlationId (UUID) per request for tracing.
 * 2. Records structured log entries with: timestamp, level, correlationId,
 *    method, URL, status code, response time, user agent, IP, userId, userRole.
 * 3. Delegates log persistence to LogManagerService (buffered, periodic flush).
 * 4. Also logs to NestJS console for development visibility.
 *
 * Applied globally to all routes via AppModule MiddlewareConsumer.
 */
@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  constructor(private readonly logManager: LogManagerService) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const startTime = Date.now();

    // Generate a unique correlation ID for this request
    const correlationId = randomUUID();

    // Attach correlationId to the request for downstream use
    (request as any).correlationId = correlationId;

    // Set correlation ID as response header for client-side tracing
    response.setHeader('X-Correlation-Id', correlationId);

    const { method, originalUrl, ip } = request;
    const userAgent = request.get('user-agent') || '';
    const userId = request.headers['x-user-id'] as string || '';
    const userRole = request.headers['x-user-role'] as string || '';

    response.on('finish', () => {
      const { statusCode } = response;
      const contentLength = response.get('content-length') || '';
      const responseTime = Date.now() - startTime;
      const timestamp = new Date().toISOString();

      // Determine log level based on status code
      const level = statusCode >= 500 ? 'ERROR' : statusCode >= 400 ? 'WARN' : 'INFO';

      // Console log with level-appropriate coloring
      const logMessage = `[${correlationId.substring(0, 8)}] ${method} ${originalUrl} ${statusCode} ${responseTime}ms`;
      if (level === 'ERROR') {
        this.logger.error(logMessage);
      } else if (level === 'WARN') {
        this.logger.warn(logMessage);
      } else {
        this.logger.log(logMessage);
      }

      // Delegate structured log entry to LogManagerService buffer
      this.logManager.logRequest({
        timestamp,
        correlationId,
        method,
        url: originalUrl,
        statusCode,
        responseTime,
        contentLength,
        userAgent,
        ip: ip || '',
        userId,
        userRole,
      });
    });

    next();
  }
}
