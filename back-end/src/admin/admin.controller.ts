import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminStatsEntity } from './entities/admin-stats.entity';
import { ModerateUserDto } from './dto/moderate-user.dto';
import { WarnUserDto } from './dto/warn-user.dto';
import { AdminService } from './admin.service';

@ApiTags('Admin')
@ApiHeader({
  name: 'x-user-role',
  description: 'User role for RBAC authorization',
  required: true,
  schema: { type: 'string', enum: ['admin', 'superuser'] },
})
@Controller('admin')
@UseGuards(RolesGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  @Roles('admin')
  @ApiOperation({ summary: 'List all users for administrative review' })
  @ApiOkResponse({ description: 'Users returned successfully.', type: [Object] })
  @ApiForbiddenResponse({ description: 'Forbidden - admin role required' })
  listUsers() {
    return this.adminService.getUsers();
  }

  @Patch('users/:id/status')
  @Roles('admin')
  @ApiOperation({ summary: "Update a user's moderation status" })
  @ApiParam({ name: 'id', description: 'User ID to moderate' })
  @ApiBody({ type: ModerateUserDto })
  @ApiOkResponse({ description: 'User status updated successfully.', type: Object })
  @ApiForbiddenResponse({ description: 'Forbidden - admin role required' })
  updateUserStatus(@Param('id') id: string, @Body() moderateUserDto: ModerateUserDto) {
    return this.adminService.updateUserStatus(id, moderateUserDto);
  }

  @Put('users/:id/flag')
  @Roles('admin')
  @ApiOperation({ summary: 'Flag a user for review' })
  @ApiParam({ name: 'id', description: 'User ID to flag' })
  @ApiOkResponse({ description: 'User flagged successfully.', type: Object })
  @ApiForbiddenResponse({ description: 'Forbidden - admin role required' })
  flagUser(@Param('id') id: string) {
    return this.adminService.flagUser(id);
  }

  @Put('users/:id/suspend')
  @Roles('admin')
  @ApiOperation({ summary: 'Suspend a user account' })
  @ApiParam({ name: 'id', description: 'User ID to suspend' })
  @ApiOkResponse({ description: 'User suspended successfully.', type: Object })
  @ApiForbiddenResponse({ description: 'Forbidden - admin role required' })
  suspendUser(@Param('id') id: string) {
    return this.adminService.suspendUser(id);
  }

  @Put('users/:id/warn')
  @Roles('admin')
  @ApiOperation({ summary: 'Issue a warning to a user' })
  @ApiParam({ name: 'id', description: 'User ID to warn' })
  @ApiBody({ type: WarnUserDto })
  @ApiOkResponse({ description: 'User warned successfully.', type: Object })
  @ApiForbiddenResponse({ description: 'Forbidden - admin role required' })
  warnUser(@Param('id') id: string, @Body() warnUserDto: WarnUserDto) {
    return this.adminService.warnUser(id, warnUserDto);
  }

  @Get('stats')
  @Roles('admin')
  @ApiOperation({ summary: 'Get platform usage and moderation statistics' })
  @ApiOkResponse({ description: 'Administration statistics returned successfully.', type: AdminStatsEntity })
  @ApiForbiddenResponse({ description: 'Forbidden - admin role required' })
  getStats(): AdminStatsEntity {
    return this.adminService.getStats();
  }

  @Get('audit')
  @Roles('admin')
  @ApiOperation({ summary: 'View recent administrative audit log entries' })
  @ApiOkResponse({ description: 'Audit log returned successfully.', type: [Object] })
  @ApiForbiddenResponse({ description: 'Forbidden - admin role required' })
  getAuditLog() {
    return this.adminService.getAuditLog();
  }
}
