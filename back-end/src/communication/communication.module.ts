import { Module, forwardRef } from '@nestjs/common';
import { CommunicationController } from './communication.controller';
import { CommunicationService } from './communication.service';
import { CommunicationRepository } from './communication.repository';
import { UsersModule } from '../users/users.module';
import { ProjectsModule } from '../projects/projects.module';
import { NotificationsModule } from '../notifications/notifications.module';

import { MentorMarketplaceModule } from '../mentor-marketplace/mentor-marketplace.module';

@Module({
  imports: [
    UsersModule,
    forwardRef(() => ProjectsModule),
    forwardRef(() => MentorMarketplaceModule),
    NotificationsModule,
  ],
  controllers: [CommunicationController],
  providers: [CommunicationService, CommunicationRepository],
  exports: [CommunicationService, CommunicationRepository], // Exported so other modules can push notifications & snapshot read state
})
export class CommunicationModule {}
