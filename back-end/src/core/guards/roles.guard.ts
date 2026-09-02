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

    const roleAliases: Record<string, string[]> = {
      'admin': ['administrator', 'admin', 'portal admin', 'portal_admin'],
      'administrator': ['administrator', 'admin', 'portal admin', 'portal_admin'],
      'user': ['collaborator', 'project owner', 'mentor', 'administrator', 'admin', 'super user', 'superuser', 'user'],
      'collaborator': ['collaborator', 'administrator', 'admin', 'super user', 'superuser', 'user'],
      'project owner': ['project owner', 'administrator', 'admin', 'super user', 'superuser'],
      'mentor': ['mentor', 'administrator', 'admin', 'super user', 'superuser'],
      'superuser': ['super user', 'superuser'],
      'super user': ['super user', 'superuser'],
      'portal_admin': ['administrator', 'admin', 'portal admin', 'portal_admin'],
      'portal admin': ['administrator', 'admin', 'portal admin', 'portal_admin']
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
