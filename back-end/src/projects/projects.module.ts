import { Module, forwardRef } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectsRepository } from './projects.repository';
import { TasksModule } from '../tasks/tasks.module';
import { JoinRequestsModule } from '../join-requests/join-requests.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MentorMarketplaceModule } from '../mentor-marketplace/mentor-marketplace.module';

@Module({
  imports: [
    forwardRef(() => TasksModule),
    forwardRef(() => JoinRequestsModule),
    NotificationsModule,
    MentorMarketplaceModule,
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectsRepository],
  exports: [ProjectsService, ProjectsRepository],
})
export class ProjectsModule {}
