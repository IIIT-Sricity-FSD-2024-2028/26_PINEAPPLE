import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * HttpExceptionFilter - Global exception handler
 *
 * Catches all HttpException instances and formats them into
 * consistent error responses with proper status codes.
 *
 * Response format:
 * {
 *   "statusCode": 400,
 *   "message": "Error message",
 *   "error": { ... },
 *   "timestamp": "2026-03-15T10:30:00Z",
 *   "path": "/api/users"
 * }
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const timestamp = new Date().toISOString();

    // ──────────────────────────────────────────────────────────────
    // Handle HTTP Exceptions
    // ──────────────────────────────────────────────────────────────
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      this.logger.error(
        `HTTP Exception [${request.method} ${request.path}] Status: ${status}`,
        exception,
      );

      response.status(status).json({
        statusCode: status,
        message:
          typeof exceptionResponse === 'string'
            ? exceptionResponse
            : (exceptionResponse as any).message || 'HTTP Exception',
        error: exceptionResponse,
        timestamp,
        path: request.url,
      });
      return;
    }

    // ──────────────────────────────────────────────────────────────
    // Handle Unexpected Errors
    // ──────────────────────────────────────────────────────────────
    this.logger.error(
      `Unhandled Exception [${request.method} ${request.path}]`,
      exception as Error,
    );

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: exception instanceof Error ? exception.message : 'Unknown error',
      timestamp,
      path: request.url,
    });
  }
}
