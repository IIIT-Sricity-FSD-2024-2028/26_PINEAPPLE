import { Controller, Get } from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';
import { Roles } from './core/decorators/roles.decorator';

@Controller()
export class AppController {
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
