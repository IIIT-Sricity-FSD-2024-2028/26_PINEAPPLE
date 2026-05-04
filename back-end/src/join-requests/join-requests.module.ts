import { Module } from '@nestjs/common';
import { JoinRequestsController } from './join-requests.controller';
import { JoinRequestsService } from './join-requests.service';

@Module({
  controllers: [JoinRequestsController],
  providers: [JoinRequestsService],
})
export class JoinRequestsModule {}