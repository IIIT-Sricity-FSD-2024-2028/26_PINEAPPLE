import { Module, Global, forwardRef } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JobRunsService } from './job-runs.service';
import { StorageHygieneService } from './storage-hygiene.service';
import { ProjectsModule } from '../projects/projects.module';
import { JoinRequestsModule } from '../join-requests/join-requests.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TasksModule } from '../tasks/tasks.module';
import { ModerationModule } from '../moderation/moderation.module';
import { MentorMarketplaceModule } from '../mentor-marketplace/mentor-marketplace.module';
import { AuditModule } from '../audit/audit.module';
import { SupportModule } from '../support/support.module';

@Global()
@Module({
  imports: [
    forwardRef(() => ProjectsModule),
    forwardRef(() => JoinRequestsModule),
    forwardRef(() => TasksModule),
    forwardRef(() => ModerationModule),
    forwardRef(() => MentorMarketplaceModule),
    forwardRef(() => SupportModule),
    NotificationsModule,
    AuditModule,
  ],
  providers: [JobsService, JobRunsService, StorageHygieneService],
  exports: [JobsService, JobRunsService, StorageHygieneService],
})
export class JobsModule {}
