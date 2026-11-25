import { Module, Global } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { DigestService } from './digest.service';
import { AuditModule } from '../audit/audit.module';

@Global()
@Module({
  imports: [AuditModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, DigestService],
  exports: [NotificationsService, DigestService],
})
export class NotificationsModule {}