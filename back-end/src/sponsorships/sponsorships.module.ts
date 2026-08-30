import { Module } from '@nestjs/common';
import { SponsorshipsService } from './sponsorships.service';

@Module({
  providers: [SponsorshipsService],
  exports: [SponsorshipsService],
})
export class SponsorshipsModule {}
