import { Module, Global } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { RolesGuard } from './guards/roles.guard';
import { LogManagerService } from './services/log-manager.service';
import { LogViewerController } from './services/log-viewer.controller';
import { LoggerMiddleware } from './middleware/logger.middleware';
import { RateLimiterMiddleware } from './middleware/rate-limiter.middleware';
import { SanitizerMiddleware } from './middleware/sanitizer.middleware';

/**
 * CoreModule — Global Module for Cross-Cutting Concerns
 *
 * Registers and exports:
 *  - RolesGuard: RBAC authorization guard
 *  - LogManagerService: Central buffered log writer with periodic flush
 *  - LogViewerController: Admin API to view recent logs
 *  - Middleware providers: Logger, RateLimiter, Sanitizer
 *  - ScheduleModule: Enables @Interval for periodic log flushing
 */
@Global()
@Module({
  imports: [
    ScheduleModule.forRoot(),
  ],
  controllers: [LogViewerController],
  providers: [
    RolesGuard,
    LogManagerService,
    LoggerMiddleware,
    RateLimiterMiddleware,
    SanitizerMiddleware,
  ],
  exports: [
    RolesGuard,
    LogManagerService,
    LoggerMiddleware,
    RateLimiterMiddleware,
    SanitizerMiddleware,
  ],
})
export class CoreModule {}
