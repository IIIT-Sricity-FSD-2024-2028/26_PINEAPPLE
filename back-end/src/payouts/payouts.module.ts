import { Module } from '@nestjs/common';
import { PayoutsService } from './payouts.service';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [PayoutsService],
  exports: [PayoutsService],
})
export class PayoutsModule {}
