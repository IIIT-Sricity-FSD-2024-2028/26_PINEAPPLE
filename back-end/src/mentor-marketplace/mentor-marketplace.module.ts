import { Module } from '@nestjs/common';
import { MentorMarketplaceController } from './mentor-marketplace.controller';
import { MentorMarketplaceService } from './mentor-marketplace.service';
import { EscrowModule } from '../escrow/escrow.module';
import { PayoutsModule } from '../payouts/payouts.module';
import { UsersModule } from '../users/users.module';
import { GamificationModule } from '../gamification/gamification.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    EscrowModule,
    PayoutsModule,
    UsersModule,
    GamificationModule,
    NotificationsModule,
  ],
  controllers: [MentorMarketplaceController],
  providers: [MentorMarketplaceService],
  exports: [MentorMarketplaceService],
})
export class MentorMarketplaceModule {}
