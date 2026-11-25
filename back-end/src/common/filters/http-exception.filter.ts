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
function getMachineCode(status: number, exceptionResponse: any, message: any): string {
  if (typeof exceptionResponse === 'object' && exceptionResponse !== null && exceptionResponse.code) {
    return exceptionResponse.code;
  }
  const msgStr = Array.isArray(message) ? message.join(' ') : String(message || '');
  const lower = msgStr.toLowerCase();
  if (
    lower.includes('password is required') ||
    lower.includes('password should not be empty') ||
    lower.includes('password must be a string')
  ) {
    return 'PASSWORD_REQUIRED';
  }
  if (lower.includes('complete your profile') || lower.includes('profile incomplete')) {
    return 'PROFILE_INCOMPLETE';
  }
  if (lower.includes('username is required') || lower.includes('username required') || lower.includes('username should not be empty')) {
    return 'USERNAME_REQUIRED';
  }
  if (lower.includes('username is already taken') || lower.includes('username taken') || lower.includes('username already in use')) {
    return 'USERNAME_TAKEN';
  }
  if (lower.includes('category') || lower.includes('reason is required') || lower.includes('rejection reason') || lower.includes('decline reason') || lower.includes('leave category')) {
    return 'REASON_REQUIRED';
  }
  if (lower.includes('at least 10 characters') || lower.includes('explanation')) {
    return 'REASON_REQUIRED';
  }
  if (lower.includes('task due date is required') || lower.includes('due date is required')) {
    return 'DUE_DATE_REQUIRED';
  }
  if (lower.includes('due date cannot be in the past') || lower.includes('cannot be in the past')) {
    return 'DUE_DATE_PAST';
  }
  if (lower.includes('cannot be after the project') || lower.includes("after the project's due date")) {
    return 'DUE_DATE_AFTER_PROJECT';
  }
  if (lower.includes('due date is locked') || lower.includes('due date locked') || lower.includes('task due date is locked')) {
    return 'DUE_DATE_LOCKED';
  }
  if (lower.includes('must be in the future') || lower.includes('deadline must be in the future')) {
    return 'DEADLINE_NOT_FUTURE';
  }
  if (lower.includes('cannot be earlier than task') || lower.includes('earlier than task due date')) {
    return 'DEADLINE_BEFORE_TASKS';
  }
  if (lower.includes('already been awarded')) {
    return 'ALREADY_AWARDED';
  }
  if (lower.includes('suspended')) {
    return 'ACCOUNT_SUSPENDED';
  }
  if (lower.includes('project is completed or closed') || lower.includes('completed or closed project') || lower.includes('cannot change deadline of a completed or closed')) {
    return 'PROJECT_LOCKED';
  }
  if (lower.includes('request limit reached')) {
    return 'REQUEST_LIMIT_REACHED';
  }
  if (lower.includes('closed')) {
    return 'PROJECT_CLOSED';
  }
  if (lower.includes('full')) {
    return 'PROJECT_FULL';
  }
  switch (status) {
    case 400: return 'BAD_REQUEST';
    case 401: return 'UNAUTHORIZED';
    case 403: return 'FORBIDDEN';
    case 404: return 'NOT_FOUND';
    case 409: return 'CONFLICT';
    case 429: return 'TOO_MANY_REQUESTS';
    default: return 'INTERNAL_SERVER_ERROR';
  }
}

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
      const rawMessage =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as any).message || 'HTTP Exception';

      const message = Array.isArray(rawMessage) ? rawMessage[0] : String(rawMessage);
      const errorStr = (typeof exceptionResponse === 'object' && (exceptionResponse as any).error)
        ? (exceptionResponse as any).error
        : (HttpStatus[status] || 'Error');
      const machineCode = getMachineCode(status, exceptionResponse, rawMessage);

      this.logger.error(
        `[${correlationId.substring(0, 8)}] HTTP Exception [${request.method} ${request.path}] Status: ${status} (${machineCode}) — ${message}`,
      );

      // Log to file via LogManagerService
      this.logManager.logError({
        timestamp,
        correlationId,
        method: request.method,
        url: request.url,
        statusCode: status,
        message,
        stack: exception.stack,
        userId,
        userRole,
      });

      const extraFields: Record<string, any> = {};
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const forwardedKeys = [
          'runId',
          'availableAt',
          'cooldownDays',
          'currentCount',
          'maxAllowed',
          'projects',
          'retryAt',
          'field',
          'rejectedFields',
          'wrongAttempts',
          'attemptsRemaining',
          'cooldownSeconds',
          'retryAfter',
          'retryAfterSeconds',
          'conflictingRange',
          'conflictStart',
          'conflictEnd',
          'obligations',
          'blockers',
          'allowed',
          'tasksToRelease',
          'tasksKept',
          'reason',
          'suspendedAt',
          'suspensionType',
          'appealAvailable',
          'supportContact',
          'details',
          'minProjectDueDate',
          'currentProjectDueDate',
          'newDueDate',
          'reviewCreditMs',
        ];
        for (const key of forwardedKeys) {
          if ((exceptionResponse as any)[key] !== undefined) {
            extraFields[key] = (exceptionResponse as any)[key];
          }
        }
      }

      response.status(status).json({
        statusCode: status,
        error: errorStr,
        code: machineCode,
        message,
        timestamp,
        path: request.url,
        correlationId,
        ...extraFields,
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
      error: 'Internal Server Error',
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
      timestamp,
      path: request.url,
      correlationId,
    });
  }
}
