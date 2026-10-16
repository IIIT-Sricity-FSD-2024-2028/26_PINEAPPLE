import { Global, Module } from '@nestjs/common';
import { PlatformConfigService } from './platform-config.service';

@Global()
@Module({
  providers: [PlatformConfigService],
  exports: [PlatformConfigService],
})
export class PlatformConfigModule {}
