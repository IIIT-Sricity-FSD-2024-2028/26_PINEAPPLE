import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { normalizeRole } from '../../common/guards/roles.guard';
import { PlatformConfigService } from '../../platform-config/platform-config.service';
import { UsersService } from '../../users/users.service';

export { normalizeRole };

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private platformConfigService: PlatformConfigService,
    private usersService: UsersService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const path = String(request.url || request.path || '');
    const userRole = request.headers['x-user-role'];
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

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    if (!userRole) {
      throw new UnauthorizedException('x-user-role header is missing.');
    }

    // Super User role overrides all other role requirements
    if (normalizedUserRole === 'superuser') {
      return true;
    }

    const hasRole = requiredRoles.some((requiredRole) => {
      const normalizedReq = normalizeRole(requiredRole);
      if (normalizedReq === normalizedUserRole) return true;
      if (normalizedUserRole === 'admin') return true;
      if (normalizedReq === 'user' && normalizedUserRole) return true;
      return false;
    });

    if (!hasRole) {
      throw new ForbiddenException('You do not have the required permissions to access this resource.');
    }

    return true;
  }
}
