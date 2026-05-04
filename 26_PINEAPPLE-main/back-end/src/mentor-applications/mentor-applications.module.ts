import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { MentorApplicationsService } from './mentor-applications.service';
import { MentorApplicationsController } from './mentor-applications.controller';

@Module({
  imports: [UsersModule],
  controllers: [MentorApplicationsController],
  providers: [MentorApplicationsService],
  exports: [MentorApplicationsService],
})
export class MentorApplicationsModule {}
