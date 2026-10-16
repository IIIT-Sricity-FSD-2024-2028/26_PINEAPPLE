import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
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

  @Get('users/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Get detailed live user profile for administrative review' })
  @ApiParam({ name: 'id', description: 'User ID to inspect' })
  @ApiOkResponse({ description: 'User details returned successfully.' })
  @ApiForbiddenResponse({ description: 'Forbidden - admin role required' })
  getUserDetails(@Param('id') id: string) {
    return this.adminService.getUserDetails(id);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login as an admin or superuser' })
  @ApiOkResponse({ description: 'Logged in successfully.', type: Object })
  login(@Body() credentials: any) {
    return this.adminService.login(credentials);
  }

  @Patch('users/:id/status')
  @Roles('admin')
  @ApiOperation({ summary: "Update a user's moderation status" })
  @ApiParam({ name: 'id', description: 'User ID to moderate' })
  @ApiBody({ type: ModerateUserDto })
  @ApiOkResponse({ description: 'User status updated successfully.', type: Object })
  @ApiForbiddenResponse({ description: 'Forbidden - admin role required' })
  updateUserStatus(@Param('id') id: string, @Body() body: any) {
    const action = String(body.action || body.status || '').toLowerCase();
    if (action === 'suspend' || action === 'suspended') {
      return this.adminService.suspendUser(id);
    }
    if (action === 'warn' || action === 'warned') {
      return this.adminService.warnUser(id, { reason: body.reason || 'Admin warning' });
    }
    if (action === 'flag' || action === 'flagged') {
      return this.adminService.flagUser(id);
    }
    return this.adminService.updateUserStatus(id, body);
  }

  @Put('users/:id/status')
  @Roles('admin')
  @ApiOperation({ summary: "Update a user's moderation status" })
  updateUserStatusPut(@Param('id') id: string, @Body() body: any) {
    return this.updateUserStatus(id, body);
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

  @Post('audit')
  @Roles('user')
  @ApiOperation({ summary: 'Record an audit log entry' })
  @ApiOkResponse({ description: 'Audit log entry recorded successfully.', type: Object })
  recordAudit(@Body() entry: any) {
    return this.adminService.logClientAudit(entry);
  }

  @Get('config')
  @Roles('admin', 'superuser')
  @ApiOperation({ summary: 'Get current platform configuration' })
  @ApiOkResponse({ description: 'Platform configuration returned successfully.' })
  getConfig() {
    return this.adminService.getConfig();
  }

  @Get('config/public')
  @ApiOperation({ summary: 'Get public platform configuration' })
  @ApiOkResponse({ description: 'Public platform configuration returned.' })
  getPublicConfig() {
    return this.adminService.getConfig();
  }

  @Put('config')
  @Roles('superuser')
  @ApiOperation({ summary: 'Update platform configuration (Superuser only)' })
  @ApiOkResponse({ description: 'Platform configuration updated successfully.' })
  updateConfig(@Body() dto: any) {
    return this.adminService.updateConfig(dto);
  }
}

