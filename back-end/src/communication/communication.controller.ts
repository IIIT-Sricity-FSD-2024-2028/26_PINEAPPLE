import { Controller, Get, Post, Body, Patch, Param, Headers, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { CommunicationService } from './communication.service';
import { SendMessageDto } from './dto/send-message.dto';

@ApiTags('Communication')
@Controller('communication')
export class CommunicationController {
  constructor(private readonly communicationService: CommunicationService) {}

  @Get('messages/project/:projectId')
  @ApiOperation({ summary: 'Get chat history for a specific project' })
  @ApiResponse({ status: 200, description: 'Returns an array of messages sorted chronologically.' })
  getMessagesByProjectId(@Param('projectId') projectId: string) {
    return this.communicationService.getMessagesByProjectId(projectId);
  }

  @Post('messages')
  @ApiOperation({ summary: 'Send a message to a project chat board' })
  @ApiHeader({ name: 'x-user-id', description: 'ID of the user sending the message', required: true })
  @ApiResponse({ status: 201, description: 'The message has been successfully sent.' })
  @ApiResponse({ status: 401, description: 'Unauthorized: missing x-user-id header.' })
  sendMessage(
    @Headers('x-user-id') senderId: string,
    @Body() dto: SendMessageDto,
  ) {
    if (!senderId) {
      throw new UnauthorizedException('x-user-id header is missing.');
    }
    return this.communicationService.sendMessage(senderId, dto);
  }

  @Get('notifications')
  @ApiOperation({ summary: 'Get notifications for the logged-in user' })
  @ApiHeader({ name: 'x-user-id', description: 'ID of the logged-in user', required: true })
  @ApiResponse({ status: 200, description: 'Returns an array of notifications sorted reverse-chronologically.' })
  @ApiResponse({ status: 401, description: 'Unauthorized: missing x-user-id header.' })
  getNotificationsByUserId(@Headers('x-user-id') userId: string) {
    if (!userId) {
      throw new UnauthorizedException('x-user-id header is missing.');
    }
    return this.communicationService.getNotificationsByUserId(userId);
  }

  @Patch('notifications/:id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiResponse({ status: 200, description: 'The notification has been marked as read.' })
  @ApiResponse({ status: 404, description: 'Notification not found.' })
  markNotificationAsRead(@Param('id') id: string) {
    return this.communicationService.markNotificationAsRead(id);
  }
}
