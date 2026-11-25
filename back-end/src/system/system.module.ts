import { Module, Global } from '@nestjs/common';
import { BootService } from './boot.service';
import { StartupCleanupService } from './startup-cleanup.service';
import { DemoResetService } from './demo-reset.service';
import { BootHeaderMiddleware, BootIdInterceptor } from './boot-id.interceptor';

@Global()
@Module({
  providers: [
    BootService,
    StartupCleanupService,
    DemoResetService,
    BootHeaderMiddleware,
    BootIdInterceptor,
  ],
  exports: [
    BootService,
    StartupCleanupService,
    DemoResetService,
    BootHeaderMiddleware,
    BootIdInterceptor,
  ],
})
export class SystemModule {}
