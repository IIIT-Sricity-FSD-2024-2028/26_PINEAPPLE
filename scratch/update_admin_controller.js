const fs = require('fs');
const file = 'back-end/src/admin/admin.controller.ts';
let content = fs.readFileSync(file, 'utf8');

// 1. Add SuspendUserDto and ReactivateUserDto to imports
content = content.replace(
  "import { WarnUserDto } from './dto/warn-user.dto';",
  "import { WarnUserDto } from './dto/warn-user.dto';\nimport { SuspendUserDto } from './dto/suspend-user.dto';\nimport { ReactivateUserDto } from './dto/reactivate-user.dto';"
);

// 2. Replace routes
const oldRoutesTarget = `  @Patch('users/:id/status')
  @Roles('admin')
  @ApiOperation({ summary: "Update a user's moderation status" })
  @ApiParam({ name: 'id', description: 'User ID to update' })
  @ApiBody({ type: ModerateUserDto })
  @ApiOkResponse({ description: 'User status updated successfully.', type: Object })
  @ApiForbiddenResponse({ description: 'Forbidden - admin role required' })
  updateUserStatus(@Param('id') id: string, @Body() body: any) {
    const action = (body.action || body.status || '').toLowerCase();
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
  }`;

const newRoutes = `  @Patch('users/:id/status')
  @Roles('admin')
  @ApiOperation({ summary: "Update a user's moderation status" })
  @ApiParam({ name: 'id', description: 'User ID to update' })
  @ApiBody({ type: ModerateUserDto })
  @ApiOkResponse({ description: 'User status updated successfully.', type: Object })
  @ApiForbiddenResponse({ description: 'Forbidden - admin role required' })
  updateUserStatus(@Param('id') id: string, @Body() body: any) {
    const action = (body.action || body.status || '').toLowerCase();
    if (action === 'warn' || action === 'warned') {
      return this.adminService.warnUser(id, { reason: body.reason });
    }
    if (action === 'flag' || action === 'flagged') {
      return this.adminService.flagUser(id);
    }
    if (action === 'suspend' || action === 'suspended') {
      return this.adminService.suspendUser(id, { reason: body.reason });
    }
    if (action === 'activate' || action === 'active' || action === 'reactivate') {
      return this.adminService.reactivateUser(id, { reason: body.reason });
    }
    return this.adminService.updateUserStatus(id, body);
  }

  @Put('users/:id/status')
  @Roles('admin')
  @ApiOperation({ summary: "Update a user's moderation status" })
  updateUserStatusPut(@Param('id') id: string, @Body() body: any) {
    return this.updateUserStatus(id, body);
  }

  @Post('users/:id/status')
  @Roles('admin')
  @ApiOperation({ summary: "Update a user's moderation status" })
  updateUserStatusPost(@Param('id') id: string, @Body() body: any) {
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
  @ApiBody({ type: SuspendUserDto })
  @ApiOkResponse({ description: 'User suspended successfully.', type: Object })
  @ApiForbiddenResponse({ description: 'Forbidden - admin role required' })
  suspendUser(@Param('id') id: string, @Body() suspendUserDto: SuspendUserDto) {
    return this.adminService.suspendUser(id, suspendUserDto);
  }

  @Post('users/:id/suspend')
  @Roles('admin')
  @ApiOperation({ summary: 'Suspend a user account' })
  @ApiParam({ name: 'id', description: 'User ID to suspend' })
  @ApiBody({ type: SuspendUserDto })
  @ApiOkResponse({ description: 'User suspended successfully.', type: Object })
  @ApiForbiddenResponse({ description: 'Forbidden - admin role required' })
  suspendUserPost(@Param('id') id: string, @Body() suspendUserDto: SuspendUserDto) {
    return this.adminService.suspendUser(id, suspendUserDto);
  }

  @Put('users/:id/reactivate')
  @Roles('admin')
  @ApiOperation({ summary: 'Reactivate a suspended user account' })
  @ApiParam({ name: 'id', description: 'User ID to reactivate' })
  @ApiBody({ type: ReactivateUserDto })
  @ApiOkResponse({ description: 'User reactivated successfully.', type: Object })
  @ApiForbiddenResponse({ description: 'Forbidden - admin role required' })
  reactivateUser(@Param('id') id: string, @Body() reactivateUserDto: ReactivateUserDto) {
    return this.adminService.reactivateUser(id, reactivateUserDto);
  }

  @Post('users/:id/reactivate')
  @Roles('admin')
  @ApiOperation({ summary: 'Reactivate a suspended user account' })
  @ApiParam({ name: 'id', description: 'User ID to reactivate' })
  @ApiBody({ type: ReactivateUserDto })
  @ApiOkResponse({ description: 'User reactivated successfully.', type: Object })
  @ApiForbiddenResponse({ description: 'Forbidden - admin role required' })
  reactivateUserPost(@Param('id') id: string, @Body() reactivateUserDto: ReactivateUserDto) {
    return this.adminService.reactivateUser(id, reactivateUserDto);
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

  @Post('users/:id/warn')
  @Roles('admin')
  @ApiOperation({ summary: 'Issue a warning to a user' })
  @ApiParam({ name: 'id', description: 'User ID to warn' })
  @ApiBody({ type: WarnUserDto })
  @ApiOkResponse({ description: 'User warned successfully.', type: Object })
  @ApiForbiddenResponse({ description: 'Forbidden - admin role required' })
  warnUserPost(@Param('id') id: string, @Body() warnUserDto: WarnUserDto) {
    return this.adminService.warnUser(id, warnUserDto);
  }`;

if (content.includes(oldRoutesTarget)) {
  content = content.replace(oldRoutesTarget, newRoutes);
} else {
  const oldRoutesTargetCRLF = oldRoutesTarget.replace(/\n/g, '\r\n');
  const newRoutesCRLF = newRoutes.replace(/\n/g, '\r\n');
  content = content.replace(oldRoutesTargetCRLF, newRoutesCRLF);
}

fs.writeFileSync(file, content, 'utf8');
console.log('Successfully updated admin.controller.ts');
