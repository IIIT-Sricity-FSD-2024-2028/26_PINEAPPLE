import { Module, Global } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { RolesGuard } from './guards/roles.guard';
import { LogManagerService } from './services/log-manager.service';
import { LogViewerController } from './services/log-viewer.controller';
import { LoggerMiddleware } from './middleware/logger.middleware';
import { SecurityMiddleware } from './middleware/security.middleware';
import { RateLimiterMiddleware } from './middleware/rate-limiter.middleware';
import { SanitizerMiddleware } from './middleware/sanitizer.middleware';
import { ClockService } from '../common/services/clock.service';
import { ContentFilterService } from '../common/services/content-filter.service';
import { FileCleanupService } from '../common/services/file-cleanup.service';
import { ContentFilterPipe, ContentFilterInterceptor } from '../common/pipes/content-filter.pipe';

/**
 * CoreModule — Global Module for Cross-Cutting Concerns
 *
 * Registers and exports:
 *  - RolesGuard: RBAC authorization guard
 *  - ClockService: Central injectable clock service for time travel & scheduled jobs
 *  - ContentFilterService / Pipe / Interceptor: Phase 16 automated content filter
 *  - LogManagerService: Central buffered log writer with periodic flush
 *  - LogViewerController: Admin API to view recent logs
 *  - Middleware providers: Logger, Security, RateLimiter, Sanitizer
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
    ClockService,
    ContentFilterService,
    FileCleanupService,
    ContentFilterPipe,
    ContentFilterInterceptor,
    LogManagerService,
    LoggerMiddleware,
    SecurityMiddleware,
    RateLimiterMiddleware,
    SanitizerMiddleware,
  ],
  exports: [
    RolesGuard,
    ClockService,
    ContentFilterService,
    FileCleanupService,
    ContentFilterPipe,
    ContentFilterInterceptor,
    LogManagerService,
    LoggerMiddleware,
    SecurityMiddleware,
    RateLimiterMiddleware,
    SanitizerMiddleware,
  ],
})
export class CoreModule {}
