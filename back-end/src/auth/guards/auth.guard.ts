import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  ServiceUnavailableException,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthStrategyResolver } from '../strategies/auth-strategy.resolver';
import { PlatformConfigService } from '../../platform-config/platform-config.service';
import { UsersService } from '../../users/users.service';
import { ClockService } from '../../common/services/clock.service';
import { buildSuspendedResponse } from '../../common/utils/suspended-response.util';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly strategyResolver: AuthStrategyResolver,
    private readonly platformConfigService: PlatformConfigService,
    private readonly usersService: UsersService,
    @Optional()
    private readonly clockService?: ClockService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const path = String(request.url || request.path || '');
    const method = String(request.method || 'GET').toUpperCase();

    const cleanPath = path.split('?')[0].replace(/\/+$/, '');

    // Always permit OPTIONS requests for CORS preflight
    if (method === 'OPTIONS') {
      return true;
    }

    // Always bypass docs, health, and static upload assets
    const isDocOrStatic =
      cleanPath === '/api' ||
      cleanPath.startsWith('/api/swagger') ||
      cleanPath === '/api-json' ||
      cleanPath === '/api-yaml' ||
      (cleanPath.startsWith('/uploads') && !cleanPath.startsWith('/uploads/cv')) ||
      cleanPath === '/health' ||
      cleanPath === '';

    if (isDocOrStatic) {
      return true;
    }

    const strategy = this.strategyResolver.getStrategy();

    // If public route, optionally extract user if token present, but don't reject
    if (isPublic) {
      try {
        const user = await strategy.verify(request);
        if (user) {
          request.user = user;
        }
      } catch (err: any) {
        console.warn('[auth.guard] Suppressed non-critical error:', err?.message || err);
      }
      return true;
    }

    // Protected route: strategy MUST verify identity or throw UnauthorizedException
    const user = await strategy.verify(request);
    if (!user) {
      throw new UnauthorizedException('Authentication required.');
    }
    request.user = user;

    // ──────────────────────────────────────────────────────────────
    // Profile Incomplete Enforcement (HTTP 403)
    // ──────────────────────────────────────────────────────────────
    if (user.profileComplete === false) {
      const allowedPaths = [
        '/users/me',
        '/auth/me',
        '/auth/profile',
        '/users/username-available',
        '/auth/logout',
        '/auth/logout-all',
        '/admin/audit',
      ];
      const isAllowed = allowedPaths.some(
        (p) => cleanPath === p || cleanPath === `/api${p}`,
      );
      if (!isAllowed) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'Forbidden',
          code: 'PROFILE_INCOMPLETE',
          message: 'Please complete your profile before accessing platform resources.',
        });
      }
    }

    const normalizedRole = String(user.role || '').toLowerCase();
    const isPortalAdmin = ['admin', 'superuser', 'portal_admin'].includes(normalizedRole);

    // ──────────────────────────────────────────────────────────────
    // Maintenance Mode Enforcement (HTTP 503)
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
    // Suspended User Enforcement (HTTP 403)
    // ──────────────────────────────────────────────────────────────
    if (user.uid && !isPortalAdmin && this.usersService) {
      const foundUser = this.usersService.findUserSafe(String(user.uid)) || this.usersService.findRawUserById(String(user.uid));
      if (
        foundUser &&
        (String(foundUser.status || '').toLowerCase() === 'suspended' ||
          String(foundUser.status || '').toLowerCase() === 'banned')
      ) {
        throw new ForbiddenException(buildSuspendedResponse(foundUser));
      }
    }

    // Update user.lastActiveAt at most once per 10 minutes (in-memory)
    if (user?.uid && this.usersService && typeof this.usersService.touchLastActive === 'function') {
      try {
        const now = this.clockService ? this.clockService.now() : new Date();
        this.usersService.touchLastActive(String(user.uid), now.getTime(), now.toISOString(), false);
      } catch (err: any) {
        console.warn('[auth.guard] Failed to update lastActiveAt:', err?.message || err);
      }
    }

    return true;
  }
}
