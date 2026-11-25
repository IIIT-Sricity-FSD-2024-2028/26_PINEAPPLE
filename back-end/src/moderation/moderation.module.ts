import { Module, Global, forwardRef } from '@nestjs/common';
import { ReputationService } from './reputation.service';
import { SuspensionConsequencesService } from './suspension-consequences.service';
import { ModerationService } from './moderation.service';
import { ReportsService } from './reports.service';
import { AppealsService } from './appeals.service';
import { ModerationController } from './moderation.controller';
import { ReportsController } from './reports.controller';
import { AppealsController } from './appeals.controller';
import { UsersModule } from '../users/users.module';
import { ProjectsModule } from '../projects/projects.module';
import { TasksModule } from '../tasks/tasks.module';
import { JoinRequestsModule } from '../join-requests/join-requests.module';
import { MentorMarketplaceModule } from '../mentor-marketplace/mentor-marketplace.module';
import { GamificationModule } from '../gamification/gamification.module';
import { MailModule } from '../mail/mail.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../audit/audit.module';
import { PlatformConfigModule } from '../platform-config/platform-config.module';

@Global()
@Module({
  imports: [
    forwardRef(() => UsersModule),
    forwardRef(() => ProjectsModule),
    forwardRef(() => TasksModule),
    forwardRef(() => JoinRequestsModule),
    forwardRef(() => MentorMarketplaceModule),
    forwardRef(() => GamificationModule),
    MailModule,
    NotificationsModule,
    AuditModule,
    PlatformConfigModule,
  ],
  controllers: [
    ModerationController,
    ReportsController,
    AppealsController,
  ],
  providers: [
    ReputationService,
    SuspensionConsequencesService,
    ModerationService,
    ReportsService,
    AppealsService,
  ],
  exports: [
    ReputationService,
    SuspensionConsequencesService,
    ModerationService,
    ReportsService,
    AppealsService,
  ],
})
export class ModerationModule {}
