import {
  Injectable,
  PipeTransform,
  ArgumentMetadata,
  SetMetadata,
  CallHandler,
  ExecutionContext,
  NestInterceptor,
  Inject,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { ContentFilterService } from '../services/content-filter.service';

export const FILTERED_CONTENT_FIELDS_KEY = 'filtered_content_fields';
export const FILTERED_ENTITY_TYPE_KEY = 'filtered_content_entity_type';

/**
 * Declares which body fields on a DTO class or controller route should be checked
 * against ContentFilterService.
 */
export function FilteredContent(...fields: string[]) {
  return SetMetadata(FILTERED_CONTENT_FIELDS_KEY, fields);
}

export function FilteredEntityType(entityType: string) {
  return SetMetadata(FILTERED_ENTITY_TYPE_KEY, entityType);
}

@Injectable()
export class ContentFilterPipe implements PipeTransform {
  constructor(
    @Optional()
    @Inject(ContentFilterService)
    private readonly contentFilterService?: ContentFilterService,
  ) {}

  transform(value: any, metadata: ArgumentMetadata) {
    if (!this.contentFilterService || !value || typeof value !== 'object') {
      return value;
    }

    const dtoClass = metadata.metatype;
    let fields: string[] | undefined;
    let entityType = 'content';

    if (dtoClass && typeof Reflect !== 'undefined' && typeof (Reflect as any).getMetadata === 'function') {
      fields = (Reflect as any).getMetadata(FILTERED_CONTENT_FIELDS_KEY, dtoClass);
      entityType = (Reflect as any).getMetadata(FILTERED_ENTITY_TYPE_KEY, dtoClass) || 'content';
    }

    const targetFields =
      Array.isArray(fields) && fields.length > 0
        ? fields
        : Object.keys(value).filter((k) => typeof value[k] === 'string' || Array.isArray(value[k]));

    this.contentFilterService.assertClean(value, targetFields, { entityType });
    return value;
  }
}

@Injectable()
export class ContentFilterInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    @Optional()
    @Inject(ContentFilterService)
    private readonly contentFilterService?: ContentFilterService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (!this.contentFilterService) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const fields = this.reflector.getAllAndOverride<string[]>(FILTERED_CONTENT_FIELDS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (Array.isArray(fields) && fields.length > 0 && request?.body && typeof request.body === 'object') {
      const entityType =
        this.reflector.getAllAndOverride<string>(FILTERED_ENTITY_TYPE_KEY, [
          context.getHandler(),
          context.getClass(),
        ]) || 'content';
      const actorId = request?.user?.uid || request?.user?.id || request?.headers?.['x-user-id'] || 'anonymous';
      this.contentFilterService.assertClean(request.body, fields, {
        actorId: String(actorId),
        entityType,
      });
      request._contentFiltered = true;
    }

    return next.handle();
  }
}
