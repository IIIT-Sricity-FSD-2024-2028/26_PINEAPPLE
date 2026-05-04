import { Module, Global } from '@nestjs/common';
import { RolesGuard } from './guards/roles.guard';

@Global()
@Module({
  providers: [RolesGuard],
  exports: [RolesGuard],
})
export class CoreModule {}
