import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import {
  findDisallowedSelfUpdateFields,
  hasUsernameMutationAttempt,
} from '../dto/self-update-user.dto';

@Injectable()
export class SelfAccountUpdateGuard implements CanActivate {
  constructor(@Optional() private readonly auditService?: AuditService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const authUser = request?.user;
    const callerId = isLegacy
      ? authUser?.uid || request?.headers?.['x-user-id']
      : authUser?.uid || authUser?.id;

    if (!callerId) {
      throw new UnauthorizedException('Authentication required.');
    }

    const targetId = request?.params?.id;
    if (String(callerId) !== String(targetId)) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'NOT_YOUR_ACCOUNT',
        message: 'You can only update your own account.',
      });
    }

    if (hasUsernameMutationAttempt(request?.body)) {
      try {
        this.auditService?.log({
          action: 'USER_UPDATE_REJECTED_FIELD',
          actor: String(callerId),
          performedBy: String(callerId),
          target: `User #${String(targetId)}`,
          entityType: 'user',
          entityId: String(targetId),
          event: 'Rejected username change attempt in self-update (username is immutable)',
          details: { rejectedFields: ['username'] },
        });
      } catch {
        // Non-blocking audit logging
      }
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'USERNAME_IMMUTABLE',
        message: "Your username can't be changed.",
      });
    }

    const rejectedFields = findDisallowedSelfUpdateFields(request?.body);
    if (rejectedFields.length > 0) {
      try {
        this.auditService?.log({
          action: 'USER_UPDATE_REJECTED_FIELD',
          actor: String(callerId),
          performedBy: String(callerId),
          target: `User #${String(targetId)}`,
          entityType: 'user',
          entityId: String(targetId),
          event: `Rejected disallowed field(s) in self-update: ${rejectedFields.join(', ')}`,
          details: { rejectedFields },
        });
      } catch {
        // Non-blocking audit logging
      }

      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'FIELD_NOT_ALLOWED',
        message: `Field(s) not allowed: ${rejectedFields.join(', ')}`,
        rejectedFields,
      });
    }

    return true;
  }
}
