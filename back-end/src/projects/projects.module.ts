import { Module, forwardRef } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectsRepository } from './projects.repository';
import { ProjectInvitesService } from './invites.service';
import { ProjectAccessService } from './project-access.service';
import { InvitesController } from './invites.controller';
import { TaskTemplatesController } from './task-templates.controller';
import { LeaveRequestsController } from './leave-requests.controller';
import { TemplatesService } from './templates.service';
import { DeletionPolicyService } from './deletion-policy.service';
import { LeaveRequestsService } from './leave-requests.service';
import { LeaveRequestsRepository } from './leave-requests.repository';
import { TasksModule } from '../tasks/tasks.module';
import { JoinRequestsModule } from '../join-requests/join-requests.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MentorMarketplaceModule } from '../mentor-marketplace/mentor-marketplace.module';
import { SupportModule } from '../support/support.module';

@Module({
  imports: [
    forwardRef(() => TasksModule),
    forwardRef(() => JoinRequestsModule),
    NotificationsModule,
    forwardRef(() => MentorMarketplaceModule),
    forwardRef(() => SupportModule),
  ],
  controllers: [ProjectsController, InvitesController, TaskTemplatesController, LeaveRequestsController],
  providers: [
    ProjectsService,
    ProjectsRepository,
    ProjectInvitesService,
    ProjectAccessService,
    TemplatesService,
    DeletionPolicyService,
    LeaveRequestsService,
    LeaveRequestsRepository,
  ],
  exports: [
    ProjectsService,
    ProjectsRepository,
    ProjectInvitesService,
    ProjectAccessService,
    TemplatesService,
    DeletionPolicyService,
    LeaveRequestsService,
    LeaveRequestsRepository,
  ],
})
export class ProjectsModule {}
