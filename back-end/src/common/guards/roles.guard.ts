import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PlatformConfigService } from '../../platform-config/platform-config.service';
import { UsersService } from '../../users/users.service';

/**
 * Normalizes role names into canonical role identifiers:
 * - 'project owner', 'project-owner', 'owner' -> 'project-owner'
 * - 'admin', 'administrator', 'portal admin', 'portal_admin', 'portal-admin' -> 'admin'
 * - 'superuser', 'super user', 'super-user' -> 'superuser'
 * - 'mentor' -> 'mentor'
 * - 'collaborator', 'collab', 'member' -> 'collaborator'
 * - 'user' -> 'user'
 */
export function normalizeRole(role: string): string {
  const normalized = String(role || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-');
  if (['project-owner', 'owner', 'projectowner'].includes(normalized)) {
    return 'project-owner';
  }
  if (
    [
      'admin',
      'administrator',
      'portal-admin',
      'portaladmin',
      'super-admin',
      'finance-admin',
    ].includes(normalized)
  ) {
    return 'admin';
  }
  if (['superuser', 'super-user'].includes(normalized)) {
    return 'superuser';
  }
  if (['mentor'].includes(normalized)) {
    return 'mentor';
  }
  if (['collaborator', 'collab', 'member'].includes(normalized)) {
    return 'collaborator';
  }
  if (['user'].includes(normalized)) {
    return 'user';
  }
  return normalized;
}

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

  constructor(
    private readonly reflector: Reflector,
    private readonly platformConfigService: PlatformConfigService,
    private readonly usersService: UsersService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const path = String(request.url || request.path || '');
    const userRole = String(request.headers['x-user-role'] || '')
      .trim()
      .toLowerCase();
    const normalizedUserRole = userRole ? normalizeRole(userRole) : '';
    const isPortalAdmin = ['admin', 'superuser', 'portal_admin'].includes(normalizedUserRole);

    // ──────────────────────────────────────────────────────────────
    // 0. Maintenance Mode Enforcement (HTTP 503)
    // ──────────────────────────────────────────────────────────────
    if (this.platformConfigService?.isMaintenanceActive()) {
      const isExempt =
        isPortalAdmin ||
        path.startsWith('/admin') ||
        path.startsWith('/api') ||
        path.startsWith('/uploads');
      if (!isExempt) {
        throw new ServiceUnavailableException('Platform is undergoing maintenance. Please check back later.');
      }
    }

    // ──────────────────────────────────────────────────────────────
    // 0.1 Suspended User Enforcement (HTTP 403)
    // ──────────────────────────────────────────────────────────────
    const userId = request.headers['x-user-id'];
    if (userId && !isPortalAdmin && this.usersService) {
      const user = this.usersService.findUserSafe(String(userId));
      if (
        user &&
        (String(user.status || '').toLowerCase() === 'suspended' ||
          String(user.status || '').toLowerCase() === 'banned')
      ) {
        throw new ForbiddenException('This account is suspended. Contact support.');
      }
    }

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
    // 2. Extract and validate x-user-role header
    // ──────────────────────────────────────────────────────────────
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

    // Super User role overrides all other role requirements
    if (normalizedUserRole === 'superuser') {
      this.logger.debug(`Authorization granted for Super User`);
      return true;
    }

    const isAuthorized = requiredRoles.some((requiredRole) => {
      const normalizedReq = normalizeRole(requiredRole);
      if (normalizedReq === normalizedUserRole) return true;
      if (normalizedUserRole === 'admin') return true;
      if (normalizedReq === 'user' && normalizedUserRole) return true;
      return false;
    });

    if (!isAuthorized) {
      this.logger.warn(
        `Unauthorized access attempt: role='${userRole}' (normalized: '${normalizedUserRole}') not in [${requiredRoles.join(', ')}]`,
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
