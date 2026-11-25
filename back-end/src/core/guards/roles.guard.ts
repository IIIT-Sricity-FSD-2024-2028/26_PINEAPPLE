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
import { normalizeRole } from '../../common/utils/role.util';
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
    const method = String(request.method || 'GET').toUpperCase();

    // Bypass CORS preflight and documentation/assets
    if (method === 'OPTIONS' || path.startsWith('/api') || (path.startsWith('/uploads') && !path.startsWith('/uploads/cv'))) {
      return true;
    }

    // Determine user identity: prefer request.user (from AuthGuard / strategy), fallback to legacy headers ONLY in legacy mode
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const authUser = request.user;
    const rawRole = isLegacy ? (authUser?.role || request.headers['x-user-role']) : authUser?.role;
    const normalizedUserRole = rawRole ? normalizeRole(rawRole) : '';
    const isPortalAdmin = ['admin', 'superuser', 'portal_admin'].includes(normalizedUserRole);

    // ──────────────────────────────────────────────────────────────
    // 0. Maintenance Mode Enforcement (HTTP 503)
    // ──────────────────────────────────────────────────────────────
    if (this.platformConfigService?.isMaintenanceActive()) {
      const isExempt =
        isPortalAdmin ||
        path.startsWith('/admin') ||
        path.startsWith('/uploads');
      if (!isExempt) {
        throw new ServiceUnavailableException('Platform is undergoing maintenance. Please check back later.');
      }
    }

    // ──────────────────────────────────────────────────────────────
    // 0.1 Suspended User Enforcement (HTTP 403)
    // ──────────────────────────────────────────────────────────────
    const userId = isLegacy ? (authUser?.uid || request.headers['x-user-id']) : authUser?.uid;
    if (userId && !isPortalAdmin && !path.startsWith('/auth') && this.usersService) {
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

    if (!rawRole) {
      throw new UnauthorizedException('Authentication required. Missing user role.');
    }

    // Super User role overrides all other role requirements
    if (normalizedUserRole === 'superuser') {
      return true;
    }

    // Check specific role match
    const hasRole = requiredRoles.some((requiredRole) => {
      const normalizedReq = normalizeRole(requiredRole);
      if (normalizedReq === 'superuser') {
        return normalizedUserRole === 'superuser';
      }
      if (normalizedReq === normalizedUserRole) return true;
      if (normalizedUserRole === 'admin' && normalizedReq !== 'superuser') return true;
      if (normalizedReq === 'user' && normalizedUserRole) return true;
      return false;
    });

    if (!hasRole) {
      throw new ForbiddenException('You do not have the required permissions to access this resource.');
    }

    // ──────────────────────────────────────────────────────────────
    // Section-based Permissions Enforcement for Portal Admins
    // ──────────────────────────────────────────────────────────────
    if (normalizedUserRole === 'admin') {
      const userPerms = Array.isArray(authUser?.permissions) ? authUser.permissions : [];
      if (!userPerms.includes('*')) {
        const cleanPath = String(path || '').split('?')[0].replace(/\/+$/, '');
        let requiredSection: string | null = null;
        if (
          path.startsWith('/admin/users') ||
          path.startsWith('/admin/moderation-actions') ||
          cleanPath === '/users'
        ) {
          requiredSection = 'users';
        }
        else if (path.startsWith('/admin/projects')) requiredSection = 'projects';
        else if (path.startsWith('/admin/mentor-sessions')) requiredSection = 'reports';
        else if (
          path.startsWith('/admin/mentor') ||
          path.startsWith('/admin/abandonment-reviews') ||
          path.startsWith('/mentor-applications') ||
          path.startsWith('/uploads/cv')
        ) requiredSection = 'mentor_apps';
        else if (path.startsWith('/admin/revenue') || path === '/mentor-marketplace/sessions' || path.startsWith('/mentor-marketplace/sessions/admin-stats') || path.startsWith('/escrow')) requiredSection = 'revenue';
        else if (path.startsWith('/admin/audit')) requiredSection = 'audit';
        else if (path.startsWith('/admin/stats') || path === '/admin') requiredSection = 'dashboard';
        else if (path.startsWith('/admin/su-admins') || path.startsWith('/portal-admins')) requiredSection = 'manage_admins';
        else if (path.startsWith('/admin/su-config') || path.startsWith('/admin/config')) requiredSection = 'config';
        else if (path.startsWith('/admin/support')) requiredSection = 'support';
        else if (path.startsWith('/admin/reports') || path.startsWith('/admin/appeals') || path.startsWith('/admin/disputes')) requiredSection = 'reports';

        if (requiredSection && !userPerms.includes(requiredSection)) {
          throw new ForbiddenException(`You do not have permission to access the "${requiredSection}" section.`);
        }
      }
    }

    return true;
  }
}
