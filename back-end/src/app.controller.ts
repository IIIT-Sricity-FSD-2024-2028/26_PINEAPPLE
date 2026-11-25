import { Controller, Get, Optional } from '@nestjs/common';
import { ApiHeader, ApiOperation } from '@nestjs/swagger';
import { Roles } from './core/decorators/roles.decorator';
import { Public } from './auth/decorators/public.decorator';
import { BootService } from './system/boot.service';

@Controller()
export class AppController {
  constructor(@Optional() private readonly bootService?: BootService) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Public server health & boot identity probe' })
  health() {
    if (this.bootService) {
      return this.bootService.getHealth();
    }
    return {
      status: 'ok',
      bootId: 'unknown',
      startedAt: new Date().toISOString(),
    };
  }

  // Public route, no Roles decorator
  @Get('ping')
  ping() {
    return { message: 'Backend is live!' };
  }

  // Protected route, requires Administrator role (or Super User bypass)
  @Get('admin-test')
  @Roles('Administrator')
  @ApiHeader({ name: 'x-user-role', description: 'User role for authorization', required: true })
  adminTest() {
    return { message: 'Success! You have Administrator access.' };
  }
}
