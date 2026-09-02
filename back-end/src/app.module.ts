import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { CoreModule } from './core/core.module';
import { RolesGuard } from './core/guards/roles.guard';
import { UsersModule } from './users/users.module';
import { GamificationModule } from './gamification/gamification.module';
import { ProjectsModule } from './projects/projects.module';
import { TasksModule } from './tasks/tasks.module';

// Orphaned Modules added:
import { AdminModule } from './admin/admin.module';
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


// Middleware imports:
import { LoggerMiddleware } from './core/middleware/logger.middleware';
import { SecurityMiddleware } from './core/middleware/security.middleware';
import { RateLimiterMiddleware } from './core/middleware/rate-limiter.middleware';
import { SanitizerMiddleware } from './core/middleware/sanitizer.middleware';
import { UploadsModule } from './uploads/uploads.module';

@Module({
  imports: [
    CoreModule,
    UploadsModule,
    UsersModule,
    GamificationModule,
    ProjectsModule,
    TasksModule,
    AdminModule,
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
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule implements NestModule {
  /**
   * Configure middleware with route-specific bindings.
   *
   * Middleware execution order per request:
   *   1. SecurityMiddleware   → Sets security headers (all routes)
   *   2. LoggerMiddleware     → Logs request/response (all routes)
   *   3. SanitizerMiddleware  → Sanitizes input (POST/PATCH/PUT only)
   *   4. RateLimiterMiddleware → Rate limits sensitive routes
   */
  configure(consumer: MiddlewareConsumer) {
    // ──────────────────────────────────────────────────────────
    // 1. GLOBAL: Security headers on ALL routes
    // ──────────────────────────────────────────────────────────
    consumer
      .apply(SecurityMiddleware)
      .forRoutes('*');

    // ──────────────────────────────────────────────────────────
    // 2. GLOBAL: Request logging on ALL routes
    // ──────────────────────────────────────────────────────────
    consumer
      .apply(LoggerMiddleware)
      .forRoutes('*');

    // ──────────────────────────────────────────────────────────
    // 3. ROUTE-SPECIFIC: Input sanitization on mutation routes
    //    Applied only to POST, PATCH, PUT methods
    // ──────────────────────────────────────────────────────────
    consumer
      .apply(SanitizerMiddleware)
      .forRoutes(
        { path: 'users', method: RequestMethod.POST },
        { path: 'users/*', method: RequestMethod.PATCH },
        { path: 'projects', method: RequestMethod.POST },
        { path: 'projects/*', method: RequestMethod.PATCH },
        { path: 'tasks', method: RequestMethod.POST },
        { path: 'tasks/*', method: RequestMethod.PATCH },
        { path: 'communication/*', method: RequestMethod.POST },
        { path: 'communication/*', method: RequestMethod.PATCH },
        { path: 'support', method: RequestMethod.POST },
        { path: 'support/*', method: RequestMethod.PUT },
        { path: 'governance/*', method: RequestMethod.POST },
        { path: 'governance/*', method: RequestMethod.PATCH },
        { path: 'join-requests', method: RequestMethod.POST },
        { path: 'join-requests/*', method: RequestMethod.PUT },
        { path: 'mentor-applications', method: RequestMethod.POST },
        { path: 'mentor-applications/*', method: RequestMethod.PUT },
        { path: 'mentor-requests', method: RequestMethod.POST },
        { path: 'mentor-requests/*', method: RequestMethod.PUT },
        { path: 'mentorship/*', method: RequestMethod.POST },
        { path: 'mentorship/*', method: RequestMethod.PATCH },
        { path: 'notifications', method: RequestMethod.POST },
        { path: 'notifications/*', method: RequestMethod.PUT },
        { path: 'admin/*', method: RequestMethod.PATCH },
        { path: 'admin/*', method: RequestMethod.PUT },
      );

    // ──────────────────────────────────────────────────────────
    // 4. ROUTE-SPECIFIC: Rate limiting on sensitive routes
    //    Applied to /users, /projects, /tasks, /admin, /support,
    //    /uploads, /governance
    // ──────────────────────────────────────────────────────────
    consumer
      .apply(RateLimiterMiddleware)
      .forRoutes(
        { path: 'users', method: RequestMethod.ALL },
        { path: 'users/*', method: RequestMethod.ALL },
        { path: 'projects', method: RequestMethod.ALL },
        { path: 'projects/*', method: RequestMethod.ALL },
        { path: 'tasks', method: RequestMethod.ALL },
        { path: 'tasks/*', method: RequestMethod.ALL },
        { path: 'admin', method: RequestMethod.ALL },
        { path: 'admin/*', method: RequestMethod.ALL },
        { path: 'support', method: RequestMethod.ALL },
        { path: 'support/*', method: RequestMethod.ALL },
        { path: 'uploads', method: RequestMethod.ALL },
        { path: 'uploads/*', method: RequestMethod.ALL },
        { path: 'governance', method: RequestMethod.ALL },
        { path: 'governance/*', method: RequestMethod.ALL },
      );
  }
}
