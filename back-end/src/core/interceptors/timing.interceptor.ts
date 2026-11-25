import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Response, Request } from 'express';

@Injectable()
export class TimingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = process.hrtime.bigint();
    const http = context.switchToHttp();
    const res = http.getResponse<Response>();
    const req = http.getRequest<Request>();
    const isPerfLog = process.env.PERF_LOG === 'true';

    return next.handle().pipe(
      tap(() => {
        const end = process.hrtime.bigint();
        const durationMs = Number(end - start) / 1e6;
        if (res && !res.headersSent) {
          try {
            res.setHeader('Server-Timing', `total;dur=${durationMs.toFixed(2)}`);
          } catch (_) {}
        }
        if (isPerfLog) {
          const method = req?.method || 'GET';
          const url = req?.originalUrl || req?.url || '';
          const status = res?.statusCode || 200;
          console.log(`[PERF] ${method} ${url} ${status} ${durationMs.toFixed(2)}ms`);
        }
      }),
      catchError((err) => {
        const end = process.hrtime.bigint();
        const durationMs = Number(end - start) / 1e6;
        if (res && !res.headersSent) {
          try {
            res.setHeader('Server-Timing', `total;dur=${durationMs.toFixed(2)}`);
          } catch (_) {}
        }
        if (isPerfLog) {
          const method = req?.method || 'GET';
          const url = req?.originalUrl || req?.url || '';
          const status = err?.status || res?.statusCode || 500;
          console.log(`[PERF] ${method} ${url} ${status} ${durationMs.toFixed(2)}ms`);
        }
        throw err;
      }),
    );
  }
}
