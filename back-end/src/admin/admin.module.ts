import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { UsersModule } from '../users/users.module';
import { ProjectsModule } from '../projects/projects.module';
import { TasksModule } from '../tasks/tasks.module';
import { MentorApplicationsModule } from '../mentor-applications/mentor-applications.module';
import { PortalAdminsModule } from '../portal-admins/portal-admins.module';

@Module({
  imports: [UsersModule, ProjectsModule, TasksModule, MentorApplicationsModule, PortalAdminsModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
