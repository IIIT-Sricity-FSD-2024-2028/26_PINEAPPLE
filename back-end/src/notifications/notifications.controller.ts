import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiHeader,
  ApiBody,
} from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { NotificationsService } from './notifications.service';
import { Notification } from './notification.entity';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { AdminCreateNotificationDto } from './dto/admin-create-notification.dto';
import { normalizeRole } from '../common/utils/role.util';

@ApiTags('Notifications')
@ApiHeader({
  name: 'x-user-role',
  description: 'User role for authorization',
  required: false,
  schema: { enum: ['admin', 'user', 'superuser'] },
})
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  private resolveCaller(authUser: any, headerUserId?: string, headerRole?: string) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveUserId = isLegacy ? headerUserId : (authUser?.uid || authUser?.id);
    const effectiveRole = normalizeRole(isLegacy ? headerRole : (authUser?.role || authUser?.roleName));
    if (!effectiveUserId) {
      throw new UnauthorizedException('Authentication required.');
    }
    return {
      userId: String(effectiveUserId),
      role: effectiveRole,
    };
  }

  @Get()
  @Roles('admin', 'superuser', 'user')
  @ApiOperation({ summary: 'Get notifications for the authenticated user' })
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'Admin-only optional user filter',
  })
  @ApiResponse({
    status: 200,
    description: 'List of notifications',
    type: [Notification],
  })
  findAll(
    @CurrentUser() authUser?: any,
    @Query('userId') queryUserId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Headers('x-user-id') headerUserId?: string,
    @Headers('x-user-role') headerRole?: string,
  ): Notification[] {
    const { userId, role } = this.resolveCaller(authUser, headerUserId, headerRole);
    const isAdmin = role === 'admin' || role === 'superuser';
    const targetUserId = isAdmin && queryUserId ? String(queryUserId) : userId;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    const offsetNum = offset ? parseInt(offset, 10) : undefined;
    return this.notificationsService.findByUser(targetUserId, limitNum, offsetNum);
  }

  @Get('unread-count')
  @Roles('admin', 'superuser', 'user')
  @ApiOperation({ summary: 'Get unread notification count for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Unread count' })
  getUnreadCount(
    @CurrentUser() authUser?: any,
    @Headers('x-user-id') headerUserId?: string,
    @Headers('x-user-role') headerRole?: string,
  ): { count: number; unreadCount: number } {
    const { userId } = this.resolveCaller(authUser, headerUserId, headerRole);
    return this.notificationsService.getUnreadCount(userId);
  }

  @Patch('read-all')
  @Roles('admin', 'superuser', 'user')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all notifications for the current user as read' })
  @ApiResponse({ status: 200, description: 'Notifications marked as read' })
  patchReadAll(
    @CurrentUser() authUser?: any,
    @Headers('x-user-id') headerUserId?: string,
    @Headers('x-user-role') headerRole?: string,
  ): { updated: number; unread: number } {
    const { userId } = this.resolveCaller(authUser, headerUserId, headerRole);
    return this.notificationsService.markAllAsRead(userId);
  }

  @Put('read-all')
  @Roles('admin', 'superuser', 'user')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all notifications for the current user as read' })
  @ApiResponse({ status: 200, description: 'Notifications marked as read' })
  markAllAsRead(
    @CurrentUser() authUser?: any,
    @Headers('x-user-id') headerUserId?: string,
    @Headers('x-user-role') headerRole?: string,
  ): { updated: number; unread: number } {
    const { userId } = this.resolveCaller(authUser, headerUserId, headerRole);
    return this.notificationsService.markAllAsRead(userId);
  }

  @Get(':id')
  @Roles('admin', 'superuser', 'user')
  @ApiOperation({ summary: 'Get a single owned notification by ID' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({ status: 200, description: 'Notification details', type: Notification })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() authUser?: any,
    @Headers('x-user-id') headerUserId?: string,
    @Headers('x-user-role') headerRole?: string,
  ): Notification {
    const { userId } = this.resolveCaller(authUser, headerUserId, headerRole);
    return this.notificationsService.findOne(id, userId);
  }

  @Post()
  @Roles('admin', 'superuser')
  @ApiOperation({ summary: 'Create a system notification for a user (Admin / Super User only)' })
  @ApiBody({ type: AdminCreateNotificationDto })
  @ApiResponse({ status: 201, description: 'Notification created successfully', type: Notification })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 403, description: 'Forbidden (Admin or Super User required)' })
  create(@Body() dto: AdminCreateNotificationDto): Notification {
    return this.notificationsService.create({
      userId: String(dto.userId),
      type: dto.type || 'PROJECT_UPDATE',
      title: dto.title || 'System Notification',
      message: dto.message.trim(),
      readStatus: false,
      ...(dto.referenceId ? { referenceId: dto.referenceId } : {}),
      ...(dto.link ? { link: dto.link } : {}),
    } as any);
  }

  @Put(':id')
  @Roles('admin', 'superuser', 'user')
  @ApiOperation({ summary: 'Update an owned notification' })
  @ApiBody({ type: UpdateNotificationDto })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({ status: 200, description: 'Notification updated successfully', type: Notification })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  update(
    @Param('id') id: string,
    @Body() updateNotificationDto: UpdateNotificationDto,
    @CurrentUser() authUser?: any,
    @Headers('x-user-id') headerUserId?: string,
    @Headers('x-user-role') headerRole?: string,
  ): Notification {
    const { userId } = this.resolveCaller(authUser, headerUserId, headerRole);
    return this.notificationsService.update(id, updateNotificationDto, userId);
  }

  @Patch(':id/read')
  @Roles('admin', 'superuser', 'user')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark an owned notification as read' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({ status: 200, description: 'Notification marked as read', type: Notification })
  patchMarkAsRead(
    @Param('id') id: string,
    @CurrentUser() authUser?: any,
    @Headers('x-user-id') headerUserId?: string,
    @Headers('x-user-role') headerRole?: string,
  ): Notification {
    const { userId } = this.resolveCaller(authUser, headerUserId, headerRole);
    return this.notificationsService.markAsRead(id, userId);
  }

  @Put(':id/read')
  @Roles('admin', 'superuser', 'user')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark an owned notification as read' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({ status: 200, description: 'Notification marked as read', type: Notification })
  markAsRead(
    @Param('id') id: string,
    @CurrentUser() authUser?: any,
    @Headers('x-user-id') headerUserId?: string,
    @Headers('x-user-role') headerRole?: string,
  ): Notification {
    const { userId } = this.resolveCaller(authUser, headerUserId, headerRole);
    return this.notificationsService.markAsRead(id, userId);
  }

  @Delete(':id')
  @Roles('admin', 'superuser', 'user')
  @ApiOperation({ summary: 'Delete an owned notification' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({ status: 200, description: 'Notification deleted successfully' })
  remove(
    @Param('id') id: string,
    @CurrentUser() authUser?: any,
    @Headers('x-user-id') headerUserId?: string,
    @Headers('x-user-role') headerRole?: string,
  ): void {
    const { userId } = this.resolveCaller(authUser, headerUserId, headerRole);
    return this.notificationsService.remove(id, userId);
  }
}
