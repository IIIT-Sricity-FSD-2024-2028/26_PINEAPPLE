import { Module, OnModuleInit, forwardRef } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { UploadAuditInterceptor } from './upload-audit.interceptor';
import { MentorApplicationsModule } from '../mentor-applications/mentor-applications.module';
import { ensureUploadDirectories } from '../core/middleware/file-upload.middleware';

@Module({
  imports: [forwardRef(() => MentorApplicationsModule)],
  controllers: [UploadsController],
  providers: [UploadAuditInterceptor],
})
export class UploadsModule implements OnModuleInit {
  onModuleInit(): void {
    ensureUploadDirectories();
  }
}
