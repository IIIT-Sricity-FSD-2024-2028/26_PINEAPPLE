import { Module, Global } from '@nestjs/common';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';
import { ActionFeedbackRepository } from './feedback.repository';
import { AuditModule } from '../audit/audit.module';
import { ClockService } from '../common/services/clock.service';
import { ContentFilterService } from '../common/services/content-filter.service';

@Global()
@Module({
  imports: [AuditModule],
  controllers: [FeedbackController],
  providers: [
    FeedbackService,
    ActionFeedbackRepository,
  ],
  exports: [FeedbackService, ActionFeedbackRepository],
})
export class FeedbackModule {}
