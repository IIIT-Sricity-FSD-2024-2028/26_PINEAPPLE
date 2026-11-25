import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthStrategy, AuthUser } from './auth-strategy.interface';
import { normalizeRole } from '../../common/utils/role.util';

@Injectable()
export class LegacyHeaderStrategy implements AuthStrategy {
  readonly mode = 'legacy';

  verify(request: any): AuthUser {
    const rawRole = request.headers['x-user-role'];
    if (!rawRole) {
      throw new UnauthorizedException('x-user-role header is missing.');
    }

    const rawUserId = request.headers['x-user-id'];
    const rawEmail = request.headers['x-user-email'];
    const normalizedRole = normalizeRole(rawRole);

    return {
      uid: rawUserId ? String(rawUserId) : 'legacy-user',
      email: rawEmail ? String(rawEmail) : undefined,
      role: normalizedRole,
      permissions: ['*'],
    };
  }
}
