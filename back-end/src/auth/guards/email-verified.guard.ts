import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  Inject,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { UsersService } from '../../users/users.service';
import { normalizeRole } from '../../common/utils/role.util';

@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  constructor(
    @Optional()
    @Inject(forwardRef(() => UsersService))
    private readonly usersService?: UsersService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const authUser = request?.user;

    const rawRole = isLegacy ? (authUser?.role || request?.headers?.['x-user-role']) : authUser?.role;
    const role = normalizeRole(rawRole);
    if (role === 'admin' || role === 'superuser') {
      return true;
    }

    const userId = isLegacy
      ? (authUser?.uid || request?.headers?.['x-user-id'])
      : (authUser?.uid || authUser?.id);

    if (!userId) {
      throw new UnauthorizedException('Authentication required.');
    }

    const storedUser = this.usersService?.findRawUserById?.(String(userId));
    if (storedUser) {
      if (storedUser.emailVerified === false) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'Forbidden',
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Verify your email address before doing this.',
        });
      }
      return true;
    }

    // Fallback when UsersService is unavailable (e.g. isolated guard unit test)
    if (authUser && authUser.emailVerified === false) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Verify your email address before doing this.',
      });
    }

    return true;
  }
}
