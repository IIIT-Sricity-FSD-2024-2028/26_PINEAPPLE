import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { LogManagerService } from '../../core/services/log-manager.service';

/**
 * HttpExceptionFilter - Global exception handler
 *
 * Catches all exceptions (both HttpException and unexpected errors) and:
 * 1. Formats them into consistent JSON error responses.
 * 2. Logs errors to the LogManagerService for buffered file persistence.
 * 3. Includes correlation ID from the request for traceability.
 *
 * Response format:
 * {
 *   "statusCode": 400,
 *   "message": "Error message",
 *   "error": { ... },
 *   "timestamp": "2026-03-15T10:30:00Z",
 *   "path": "/api/users",
 *   "correlationId": "abc-123-def"
 * }
 */
@Catch()
@Injectable()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(private readonly logManager: LogManagerService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const timestamp = new Date().toISOString();
    const correlationId = (request as any).correlationId || 'N/A';
    const userId = (request.headers['x-user-id'] as string) || '';
    const userRole = (request.headers['x-user-role'] as string) || '';

    // ──────────────────────────────────────────────────────────────
    // Handle HTTP Exceptions
    // ──────────────────────────────────────────────────────────────
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as any).message || 'HTTP Exception';

      this.logger.error(
        `[${correlationId.substring(0, 8)}] HTTP Exception [${request.method} ${request.path}] Status: ${status} — ${typeof message === 'string' ? message : JSON.stringify(message)}`,
      );

      // Log to file via LogManagerService
      this.logManager.logError({
        timestamp,
        correlationId,
        method: request.method,
        url: request.url,
        statusCode: status,
        message: typeof message === 'string' ? message : JSON.stringify(message),
        stack: exception.stack,
        userId,
        userRole,
      });

      response.status(status).json({
        statusCode: status,
        message,
        error: exceptionResponse,
        timestamp,
        path: request.url,
        correlationId,
      });
      return;
    }

    // ──────────────────────────────────────────────────────────────
    // Handle Unexpected Errors
    // ──────────────────────────────────────────────────────────────
    const errorMessage = exception instanceof Error ? exception.message : 'Unknown error';
    const errorStack = exception instanceof Error ? exception.stack : '';

    this.logger.error(
      `[${correlationId.substring(0, 8)}] Unhandled Exception [${request.method} ${request.path}] — ${errorMessage}`,
      errorStack,
    );

    // Log to file via LogManagerService
    this.logManager.logError({
      timestamp,
      correlationId,
      method: request.method,
      url: request.url,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: errorMessage,
      stack: errorStack,
      userId,
      userRole,
    });

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: errorMessage,
      timestamp,
      path: request.url,
      correlationId,
    });
  }
}
