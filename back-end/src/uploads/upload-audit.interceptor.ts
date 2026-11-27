import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Optional,
} from '@nestjs/common';
import { Observable, catchError, throwError } from 'rxjs';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class UploadAuditInterceptor implements NestInterceptor {
  constructor(@Optional() private readonly auditService?: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    return next.handle().pipe(
      catchError((err) => {
        if (!req?.__uploadAuditHandled) {
          try {
            const user = req?.user;
            const isLegacy = process.env.AUTH_MODE === 'legacy';
            const actorId = String(user?.uid || user?.id || (isLegacy ? req?.headers?.['x-user-id'] : undefined) || 'user');
            const errResp = typeof err?.getResponse === 'function' ? err.getResponse() : undefined;
            const reason =
              (typeof errResp === 'object' && errResp?.message) ||
              err?.message ||
              'Upload rejected';
            this.auditService?.log({
              action: 'UPLOAD_REJECTED',
              actor: actorId,
              target: req?.path || '/uploads',
              entityType: 'upload',
              performedBy: actorId,
              event: `File upload rejected at ${req?.path || '/uploads'}: ${reason}`,
              details: {
                path: req?.path,
                code: typeof errResp === 'object' ? errResp?.code : undefined,
                reason,
              },
            });
          } catch {
            // Non-critical audit write
          }
        }
        return throwError(() => err);
      }),
    );
  }
}
