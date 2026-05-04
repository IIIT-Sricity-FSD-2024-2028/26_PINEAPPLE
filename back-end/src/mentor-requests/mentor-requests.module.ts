import { Module } from '@nestjs/common';
import { MentorRequestsService } from './mentor-requests.service';
import { MentorRequestsController } from './mentor-requests.controller';

@Module({
  controllers: [MentorRequestsController],
  providers: [MentorRequestsService],
  exports: [MentorRequestsService],
})
export class MentorRequestsModule {}
