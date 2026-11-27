import { Module, Global } from '@nestjs/common';
import { BootService } from './boot.service';
import { StartupCleanupService } from './startup-cleanup.service';
import { BootHeaderMiddleware, BootIdInterceptor } from './boot-id.interceptor';

@Global()
@Module({
  providers: [
    BootService,
    StartupCleanupService,
    BootHeaderMiddleware,
    BootIdInterceptor,
  ],
  exports: [
    BootService,
    StartupCleanupService,
    BootHeaderMiddleware,
    BootIdInterceptor,
  ],
})
export class SystemModule {}
