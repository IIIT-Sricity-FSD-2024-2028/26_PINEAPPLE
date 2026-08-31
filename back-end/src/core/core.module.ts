import { Module, Global } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { RolesGuard } from './guards/roles.guard';
import { LogManagerService } from './services/log-manager.service';
import { LogViewerController } from './services/log-viewer.controller';
import { LoggerMiddleware } from './middleware/logger.middleware';
import { SecurityMiddleware } from './middleware/security.middleware';
import { RateLimiterMiddleware } from './middleware/rate-limiter.middleware';
import { SanitizerMiddleware } from './middleware/sanitizer.middleware';
import { UploadsModule } from './uploads/uploads.module';

/**
 * CoreModule — Global Module for Cross-Cutting Concerns
 *
 * Registers and exports:
 *  - RolesGuard: RBAC authorization guard
 *  - LogManagerService: Central buffered log writer with periodic flush
 *  - LogViewerController: Admin API to view recent logs
 *  - Middleware providers: Logger, Security, RateLimiter, Sanitizer
 *  - ScheduleModule: Enables @Interval for periodic log flushing
 *  - UploadsModule: File upload endpoints
 */
@Global()
@Module({
  imports: [
    ScheduleModule.forRoot(),
    UploadsModule,
  ],
  controllers: [LogViewerController],
  providers: [
    RolesGuard,
    LogManagerService,
    LoggerMiddleware,
    SecurityMiddleware,
    RateLimiterMiddleware,
    SanitizerMiddleware,
  ],
  exports: [
    RolesGuard,
    LogManagerService,
    LoggerMiddleware,
    SecurityMiddleware,
    RateLimiterMiddleware,
    SanitizerMiddleware,
  ],
})
export class CoreModule {}
