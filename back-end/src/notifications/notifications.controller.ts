import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Headers,
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
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { NotificationsService } from './notifications.service';
import { Notification } from './notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';

@ApiTags('Notifications')
@ApiHeader({
  name: 'x-user-role',
  description: 'User role for authorization',
  required: true,
  schema: { enum: ['admin', 'user'] },
})
@Controller('notifications')
@UseGuards(RolesGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @Roles('admin', 'user')
  @ApiOperation({ summary: 'Get all notifications or filter by user' })
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'Filter notifications by user ID',
  })
  @ApiResponse({
    status: 200,
    description: 'List of notifications',
    type: [Notification],
  })
  findAll(@Query('userId') userId?: string): Notification[] {
    if (userId) {
      return this.notificationsService.findByUser(userId);
    }
    return this.notificationsService.findAll();
  }

  @Get(':id')
  @Roles('admin', 'user')
  @ApiOperation({ summary: 'Get a notification by ID' })
  @ApiParam({
    name: 'id',
    description: 'Notification ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Notification details',
    type: Notification,
  })
  @ApiResponse({
    status: 404,
    description: 'Notification not found',
  })
  findOne(@Param('id') id: string): Notification {
    return this.notificationsService.findOne(id);
  }

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Create a new notification' })
  @ApiBody({ type: CreateNotificationDto })
  @ApiResponse({
    status: 201,
    description: 'Notification created successfully',
    type: Notification,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  create(@Body() createNotificationDto: CreateNotificationDto): Notification {
    return this.notificationsService.create(createNotificationDto);
  }

  @Put(':id')
  @Roles('admin', 'user')
  @ApiOperation({ summary: 'Update a notification' })
  @ApiBody({ type: UpdateNotificationDto })
  @ApiParam({
    name: 'id',
    description: 'Notification ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Notification updated successfully',
    type: Notification,
  })
  @ApiResponse({
    status: 404,
    description: 'Notification not found',
  })
  update(
    @Param('id') id: string,
    @Body() updateNotificationDto: UpdateNotificationDto,
  ): Notification {
    return this.notificationsService.update(id, updateNotificationDto);
  }

  @Put(':id/read')
  @Roles('admin', 'user')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiParam({
    name: 'id',
    description: 'Notification ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as read',
    type: Notification,
  })
  @ApiResponse({
    status: 404,
    description: 'Notification not found',
  })
  markAsRead(@Param('id') id: string): Notification {
    return this.notificationsService.markAsRead(id);
  }

  @Put('read-all')
  @Roles('admin', 'user')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all notifications as read, optionally filtered by user' })
  @ApiHeader({
    name: 'x-user-id',
    description: 'Optional user ID to mark only that user\'s notifications as read',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Notifications marked as read',
    type: [Notification],
  })
  markAllAsRead(@Headers('x-user-id') userId?: string): Notification[] {
    return this.notificationsService.markAllAsRead(userId);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete a notification' })
  @ApiParam({
    name: 'id',
    description: 'Notification ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Notification deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Notification not found',
  })
  remove(@Param('id') id: string): void {
    return this.notificationsService.remove(id);
  }
}