import {
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { DemoResetService } from '../../system/demo-reset.service';

export const MAINTENANCE_RETRY_AFTER_SECONDS = 5;

@Injectable()
export class MaintenanceMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    if (!DemoResetService.isMaintenanceMode()) {
      return next();
    }

    const method = String(req.method || 'GET').toUpperCase();
    if (method === 'OPTIONS') {
      return next();
    }

    const rawUrl = String(req.originalUrl || req.url || req.path || '');
    const cleanPath = rawUrl.split('?')[0].replace(/\/+$/, '');

    // Allow Swagger docs and the reset-demo endpoint itself so concurrent resets receive 409 RESET_IN_PROGRESS
    if (
      cleanPath === '/api' ||
      cleanPath.startsWith('/api/swagger') ||
      cleanPath === '/api-json' ||
      cleanPath === '/api-yaml' ||
      (method === 'POST' && (cleanPath === '/admin/system/reset-demo' || cleanPath === '/api/admin/system/reset-demo'))
    ) {
      return next();
    }

    res.setHeader('Retry-After', String(MAINTENANCE_RETRY_AFTER_SECONDS));
    res.status(503).json({
      statusCode: 503,
      error: 'Service Unavailable',
      code: 'MAINTENANCE',
      message: 'The system is being reset for maintenance. Please retry shortly.',
      retryAfterSeconds: MAINTENANCE_RETRY_AFTER_SECONDS,
      timestamp: new Date().toISOString(),
      path: rawUrl,
    });
  }
}
