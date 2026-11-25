import { Module, forwardRef } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { UsersModule } from '../users/users.module';
import { ProjectsModule } from '../projects/projects.module';
import { TasksModule } from '../tasks/tasks.module';
import { MentorApplicationsModule } from '../mentor-applications/mentor-applications.module';
import { PortalAdminsModule } from '../portal-admins/portal-admins.module';
import { MailModule } from '../mail/mail.module';
import { GamificationModule } from '../gamification/gamification.module';
import { MentorMarketplaceModule } from '../mentor-marketplace/mentor-marketplace.module';
import { JobsModule } from '../jobs/jobs.module';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';

@Module({
  imports: [
    UsersModule,
    ProjectsModule,
    TasksModule,
    MentorApplicationsModule,
    PortalAdminsModule,
    MailModule,
    GamificationModule,
    forwardRef(() => MentorMarketplaceModule),
    JobsModule,
    forwardRef(() => LeaderboardModule),
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
