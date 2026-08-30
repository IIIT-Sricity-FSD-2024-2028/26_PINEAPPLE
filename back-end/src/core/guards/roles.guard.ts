import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userRole = request.headers['x-user-role'];

    if (!userRole) {
      throw new UnauthorizedException('x-user-role header is missing.');
    }

    // Super User role overrides all other role requirements
    if (userRole.toLowerCase() === 'super user' || userRole.toLowerCase() === 'superuser') {
      return true;
    }

    // Extended logic for ADMIN_ROLE_ASSIGNMENT scopes
    const adminScope = request.headers['x-admin-scope'];
    if (adminScope) {
      if (adminScope.toLowerCase() === 'super_admin') {
        return true; // super_admin satisfies every check
      }
      // If the route specifically asks for an admin scope
      const hasScope = requiredRoles.some(role => role.toLowerCase() === adminScope.toLowerCase());
      if (hasScope) return true;
    }

    const roleAliases: Record<string, string[]> = {
      'admin': ['administrator', 'admin'],
      'user': ['collaborator', 'project owner', 'mentor', 'administrator', 'user'],
      'superuser': ['super user', 'superuser'],
      'portal_admin': ['administrator', 'portal admin', 'portal_admin'],
      // Map legacy admin to moderation_admin for backwards compatibility if needed
      'moderation_admin': ['administrator', 'admin', 'moderation_admin']
    };

    const hasRole = requiredRoles.some((requiredRole) => {
      const lowerReq = requiredRole.toLowerCase();
      const validRoles = roleAliases[lowerReq] || [lowerReq];
      return validRoles.includes(userRole.toLowerCase());
    });

    if (!hasRole) {
      throw new ForbiddenException('You do not have the required permissions to access this resource.');
    }

    return true;
  }
}
