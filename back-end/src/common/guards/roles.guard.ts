import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * RolesGuard - Enforces Role-Based Access Control (RBAC)
 *
 * Reads the `x-user-role` header from the HTTP request and checks
 * if the user's role is authorized for the target endpoint.
 *
 * Usage:
 *  @UseGuards(RolesGuard)
 *  @Roles('admin', 'mentor')
 *  @Get('/protected')
 *  getProtected() { ... }
 *
 * Requirements:
 * - Client must pass `x-user-role` header with request
 * - Header value must match one of the authorized roles (case-insensitive)
 *
 * Throws:
 * - 403 Forbidden: If header is missing or role is not authorized
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // ──────────────────────────────────────────────────────────────
    // 1. Get required roles from @Roles() decorator
    // ──────────────────────────────────────────────────────────────
    const requiredRoles = this.reflector.get<string[]>(
      ROLES_KEY,
      context.getHandler(),
    );

    // If no roles are required, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // ──────────────────────────────────────────────────────────────
    // 2. Extract x-user-role header
    // ──────────────────────────────────────────────────────────────
    const request = context.switchToHttp().getRequest();
    const userRole = String(request.headers['x-user-role'] || '')
      .trim()
      .toLowerCase();

    // Log the authorization attempt (useful for debugging)
    this.logger.debug(
      `Authorization check: required=[${requiredRoles.join(', ')}], provided='${userRole}'`,
    );

    // ──────────────────────────────────────────────────────────────
    // 3. Validate header is present
    // ──────────────────────────────────────────────────────────────
    if (!userRole) {
      this.logger.warn('Missing x-user-role header in request');
      throw new ForbiddenException(
        'Missing required x-user-role header. Provide one of: ' +
          requiredRoles.join(', '),
      );
    }

    // ──────────────────────────────────────────────────────────────
    // 4. Check if role is authorized
    // ──────────────────────────────────────────────────────────────
    const isAuthorized = requiredRoles.some(
      (role) => role.toLowerCase() === userRole,
    );

    if (!isAuthorized) {
      this.logger.warn(
        `Unauthorized access attempt: role='${userRole}' not in [${requiredRoles.join(', ')}]`,
      );
      throw new ForbiddenException(
        `Your role '${userRole}' is not authorized. Required: ${requiredRoles.join(', ')}`,
      );
    }

    // ──────────────────────────────────────────────────────────────
    // 5. Authorization successful
    // ──────────────────────────────────────────────────────────────
    this.logger.debug(`Authorization granted for role: '${userRole}'`);
    return true;
  }
}
