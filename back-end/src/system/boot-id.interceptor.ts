import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  NestMiddleware,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { Observable } from 'rxjs';
import { BootService } from './boot.service';

@Injectable()
export class BootHeaderMiddleware implements NestMiddleware {
  constructor(private readonly bootService: BootService) {}

  use(_req: Request, res: Response, next: NextFunction): void {
    if (res && typeof res.setHeader === 'function' && !res.headersSent) {
      res.setHeader('X-Boot-Id', this.bootService.bootId);
    }
    next();
  }
}

@Injectable()
export class BootIdInterceptor implements NestInterceptor {
  constructor(private readonly bootService: BootService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const res = http.getResponse<Response>();
    if (res && typeof res.setHeader === 'function' && !res.headersSent) {
      res.setHeader('X-Boot-Id', this.bootService.bootId);
    }
    return next.handle();
  }
}
