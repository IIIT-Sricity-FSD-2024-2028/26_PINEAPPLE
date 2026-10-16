import { Module, forwardRef } from '@nestjs/common';
import { MentorMarketplaceController } from './mentor-marketplace.controller';
import { MentorMarketplaceService } from './mentor-marketplace.service';
import { EscrowModule } from '../escrow/escrow.module';
import { PayoutsModule } from '../payouts/payouts.module';
import { UsersModule } from '../users/users.module';
import { GamificationModule } from '../gamification/gamification.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MentorApplicationsModule } from '../mentor-applications/mentor-applications.module';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [
    EscrowModule,
    PayoutsModule,
    UsersModule,
    GamificationModule,
    NotificationsModule,
    MentorApplicationsModule,
    forwardRef(() => ProjectsModule),
  ],
  controllers: [MentorMarketplaceController],
  providers: [MentorMarketplaceService],
  exports: [MentorMarketplaceService],
})
export class MentorMarketplaceModule {}
