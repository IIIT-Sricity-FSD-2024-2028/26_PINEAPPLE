import { Module, forwardRef } from '@nestjs/common';
import { MentorshipController } from './mentorship.controller';
import { MentorshipService } from './mentorship.service';
import { MentorshipRepository } from './mentorship.repository';
import { UsersModule } from '../users/users.module';
import { ProjectsModule } from '../projects/projects.module';
import { MentorMarketplaceModule } from '../mentor-marketplace/mentor-marketplace.module';

@Module({
  imports: [
    UsersModule,
    forwardRef(() => ProjectsModule),
    forwardRef(() => MentorMarketplaceModule),
  ],
  controllers: [MentorshipController],
  providers: [MentorshipService, MentorshipRepository],
  exports: [MentorshipService, MentorshipRepository],
})
export class MentorshipModule {}
