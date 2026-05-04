import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { UsersModule } from '../users/users.module';
import { ProjectsModule } from '../projects/projects.module';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports: [UsersModule, ProjectsModule, TasksModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
