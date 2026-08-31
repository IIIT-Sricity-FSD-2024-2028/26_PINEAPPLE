import { Module } from '@nestjs/common';
import { HackathonRegistrationsService } from './hackathon-registrations.service';
import { HackathonRegistrationsController } from './hackathon-registrations.controller';

@Module({
  controllers: [HackathonRegistrationsController],
  providers: [HackathonRegistrationsService],
  exports: [HackathonRegistrationsService],
})
export class HackathonRegistrationsModule {}
