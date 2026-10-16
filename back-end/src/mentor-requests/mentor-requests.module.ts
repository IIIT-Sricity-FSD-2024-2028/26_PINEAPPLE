import { Module } from '@nestjs/common';
import { MentorRequestsService } from './mentor-requests.service';
import { MentorRequestsController } from './mentor-requests.controller';
import { ProjectsModule } from '../projects/projects.module';
import { UsersModule } from '../users/users.module';
import { MentorApplicationsModule } from '../mentor-applications/mentor-applications.module';

@Module({
  imports: [ProjectsModule, UsersModule, MentorApplicationsModule],
  controllers: [MentorRequestsController],
  providers: [MentorRequestsService],
  exports: [MentorRequestsService],
})
export class MentorRequestsModule {}
