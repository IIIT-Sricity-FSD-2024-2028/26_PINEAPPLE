import { Module, forwardRef } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { UploadAuditInterceptor } from './upload-audit.interceptor';
import { MentorApplicationsModule } from '../mentor-applications/mentor-applications.module';

@Module({
  imports: [forwardRef(() => MentorApplicationsModule)],
  controllers: [UploadsController],
  providers: [UploadAuditInterceptor],
})
export class UploadsModule {}
