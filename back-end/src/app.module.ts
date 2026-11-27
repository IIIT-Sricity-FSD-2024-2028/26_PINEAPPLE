import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR, DiscoveryModule } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { CoreModule } from './core/core.module';
import { RolesGuard } from './core/guards/roles.guard';
import { AuthGuard } from './auth/guards/auth.guard';
import { UsersModule } from './users/users.module';
import { GamificationModule } from './gamification/gamification.module';
import { ProjectsModule } from './projects/projects.module';
import { TasksModule } from './tasks/tasks.module';

// Orphaned Modules added:
import { AdminModule } from './admin/admin.module';
import { AuditModule } from './audit/audit.module';
import { CommunicationModule } from './communication/communication.module';
import { GovernanceModule } from './governance/governance.module';
import { JoinRequestsModule } from './join-requests/join-requests.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { MentorApplicationsModule } from './mentor-applications/mentor-applications.module';
import { MentorRequestsModule } from './mentor-requests/mentor-requests.module';
import { MentorshipModule } from './mentorship/mentorship.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PortalAdminsModule } from './portal-admins/portal-admins.module';
import { SupportModule } from './support/support.module';

// Escrow/payouts — shared ledger services (used by the mentor marketplace):
import { EscrowModule } from './escrow/escrow.module';
import { PayoutsModule } from './payouts/payouts.module';
import { MentorMarketplaceModule } from './mentor-marketplace/mentor-marketplace.module';

import { PlatformConfigModule } from './platform-config/platform-config.module';
import { FeedbackModule } from './feedback/feedback.module';

// Middleware imports:
import { LoggerMiddleware } from './core/middleware/logger.middleware';
import { SecurityMiddleware } from './core/middleware/security.middleware';
import { RateLimiterMiddleware } from './core/middleware/rate-limiter.middleware';
import { SanitizerMiddleware } from './core/middleware/sanitizer.middleware';
import { CompressionMiddleware } from './core/middleware/compression.middleware';
import { UploadsModule } from './uploads/uploads.module';
import { AuthModule } from './auth/auth.module';
import { FirebaseModule } from './firebase/firebase.module';
import { MailModule } from './mail/mail.module';
import { JobsModule } from './jobs/jobs.module';
import { ModerationModule } from './moderation/moderation.module';
import { SystemModule } from './system/system.module';
import { BootHeaderMiddleware, BootIdInterceptor } from './system/boot-id.interceptor';

@Module({
  imports: [
    DiscoveryModule,
    ScheduleModule.forRoot(),
    CoreModule,
    PlatformConfigModule,
    FeedbackModule,
    SystemModule,
    JobsModule,
    UsersModule,
    GamificationModule,
    ModerationModule,
    ProjectsModule,
    TasksModule,
    AdminModule,
    AuditModule,
    CommunicationModule,
    GovernanceModule,
    JoinRequestsModule,
    LeaderboardModule,
    MentorApplicationsModule,
    MentorRequestsModule,
    MentorshipModule,
    NotificationsModule,
    PortalAdminsModule,
    SupportModule,
    EscrowModule,
    PayoutsModule,
    MentorMarketplaceModule,
    UploadsModule,
    FirebaseModule,
    AuthModule,
    MailModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: BootIdInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  /**
   * Configure middleware with route-specific bindings.
   *
   * Middleware execution order per request:
   *   0. BootHeaderMiddleware → Attaches X-Boot-Id header on every response
   *   1. SecurityMiddleware   → Sets security headers (all routes)
   *   2. LoggerMiddleware     → Logs request/response (all routes)
   *   3. SanitizerMiddleware  → Sanitizes input (POST/PATCH/PUT only)
   *   4. RateLimiterMiddleware → Rate limits sensitive routes
   */
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(BootHeaderMiddleware)
      .forRoutes('*');

    // ──────────────────────────────────────────────────────────
    // 1. GLOBAL: Security headers on ALL routes
    // ──────────────────────────────────────────────────────────
    consumer
      .apply(SecurityMiddleware)
      .forRoutes('*');

    // ──────────────────────────────────────────────────────────
    // 1.1 GLOBAL: Zero-dependency response compression on ALL routes
    // ──────────────────────────────────────────────────────────
    consumer
      .apply(CompressionMiddleware)
      .forRoutes('*');

    // ──────────────────────────────────────────────────────────
    // 2. GLOBAL: Request logging on ALL routes
    // ──────────────────────────────────────────────────────────
    consumer
      .apply(LoggerMiddleware)
      .forRoutes('*');

    // ──────────────────────────────────────────────────────────
    // 3. GLOBAL: Input sanitization on mutation routes (POST, PATCH, PUT filtered internally)
    consumer
      .apply(SanitizerMiddleware)
      .forRoutes('*');

    // ──────────────────────────────────────────────────────────
    // 4. Rate limiting: 5,000 requests per 1-hour window per client
    //    Identifies clients by authenticated user uid, x-user-id header, or IP address.
    //    Covers all application routes (including uploads and escrow).
    //    Docs and health routes are automatically bypassed inside the middleware.
    // ──────────────────────────────────────────────────────────
    consumer
      .apply(RateLimiterMiddleware)
      .forRoutes('*');
  }
}
