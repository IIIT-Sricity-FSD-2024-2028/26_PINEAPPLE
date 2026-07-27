import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
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
import { LoggerMiddleware } from './core/middleware/logger.middleware';

@Module({
  imports: [
    CoreModule,
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
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}

