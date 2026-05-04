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

    const hasRole = requiredRoles.some(
      (role) => role.toLowerCase() === userRole.toLowerCase()
    );

    if (!hasRole) {
      throw new ForbiddenException('You do not have the required permissions to access this resource.');
    }

    return true;
  }
}
