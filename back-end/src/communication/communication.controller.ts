import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Controller, Get, Post, Body, Patch, Param, Headers, HttpCode, HttpStatus, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader, ApiBearerAuth } from '@nestjs/swagger';
import { CommunicationService } from './communication.service';
import { SendMessageDto } from './dto/send-message.dto';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';

@ApiTags('Communication')
@Controller('communication')
export class CommunicationController {
  constructor(private readonly communicationService: CommunicationService) {}

  @Get('messages/project/:projectId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get chat history for a specific project' })
  @ApiResponse({ status: 200, description: 'Returns an array of messages sorted chronologically.' })
  @ApiResponse({ status: 401, description: 'Unauthorized: missing authentication.' })
  @ApiResponse({ status: 403, description: 'Forbidden: not a project member or admin.' })
  getMessagesByProjectId(
    @Param('projectId') projectId: string,
    @CurrentUser() authUser: any,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveCaller = isLegacy ? (headerUserId || authUser) : authUser;
    const callerId = isLegacy ? headerUserId : (authUser?.uid || authUser?.id);
    if (!callerId) {
      throw new UnauthorizedException('Authentication required.');
    }
    return this.communicationService.getMessagesByProjectId(projectId, effectiveCaller || callerId);
  }

  @Post('messages')
  @UseGuards(EmailVerifiedGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send a message to a project chat board' })
  @ApiHeader({ name: 'x-user-id', description: 'ID of the user sending the message', required: true })
  @ApiHeader({ name: 'x-user-role', description: 'Role of the user sending the message', required: false })
  @ApiResponse({ status: 201, description: 'The message has been successfully sent.' })
  @ApiResponse({ status: 401, description: 'Unauthorized: missing authentication.' })
  @ApiResponse({ status: 403, description: 'Forbidden: not a project member or unverified email.' })
  sendMessage(
    @CurrentUser() authUser: any,
    @Headers('x-user-id') senderId: string,
    @Body() dto: SendMessageDto,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveSenderId = isLegacy ? senderId : (authUser?.uid || authUser?.id);
    if (!effectiveSenderId) {
      throw new UnauthorizedException('Authentication required.');
    }
    return this.communicationService.sendMessage(effectiveSenderId, dto, authUser || effectiveSenderId);
  }

  @Post('messages/:id/report')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Report a chat message with a 20-message conversation snapshot' })
  @ApiResponse({ status: 201, description: 'Chat message report created.' })
  @ApiResponse({ status: 400, description: 'REASON_REQUIRED or CANNOT_REPORT_SELF.' })
  @ApiResponse({ status: 403, description: 'CHAT_MEMBERSHIP_REQUIRED.' })
  @ApiResponse({ status: 409, description: 'ALREADY_REPORTED.' })
  @ApiResponse({ status: 429, description: 'TOO_MANY_REPORTS.' })
  reportMessage(
    @Param('id') messageId: string,
    @Body() body: { reason: string },
    @CurrentUser() authUser: any,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveCaller = isLegacy ? (headerUserId || authUser) : authUser;
    const callerId = isLegacy ? headerUserId : (authUser?.uid || authUser?.id);
    if (!callerId) {
      throw new UnauthorizedException('Authentication required.');
    }
    return this.communicationService.reportMessage(messageId, String(callerId), body?.reason, effectiveCaller || callerId);
  }

  @Get('notifications')
  @ApiOperation({ summary: 'Get notifications for the logged-in user' })
  @ApiHeader({ name: 'x-user-id', description: 'ID of the logged-in user', required: true })
  @ApiResponse({ status: 200, description: 'Returns an array of notifications sorted reverse-chronologically.' })
  @ApiResponse({ status: 401, description: 'Unauthorized: missing x-user-id header.' })
  getNotificationsByUserId(
    @CurrentUser('uid') authUid: string,
    @Headers('x-user-id') userId: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveUserId = isLegacy ? userId : authUid;
    if (!effectiveUserId) {
      throw new UnauthorizedException('Authentication required.');
    }
    return this.communicationService.getNotificationsByUserId(effectiveUserId);
  }

  @Get('unread')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get unread chat counts per project and total across caller memberships' })
  getUnreadCounts(
    @CurrentUser() authUser: any,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveCaller = isLegacy ? (headerUserId || authUser) : authUser;
    const callerId = isLegacy ? headerUserId : (authUser?.uid || authUser?.id);
    if (!callerId) {
      throw new UnauthorizedException('Authentication required.');
    }
    return this.communicationService.getUnreadSummary(effectiveCaller || callerId);
  }

  @Post('projects/:id/read')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark all messages in a project chat as read for the caller' })
  markProjectChatRead(
    @Param('id') projectId: string,
    @CurrentUser() authUser: any,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveCaller = isLegacy ? (headerUserId || authUser) : authUser;
    const callerId = isLegacy ? headerUserId : (authUser?.uid || authUser?.id);
    if (!callerId) {
      throw new UnauthorizedException('Authentication required.');
    }
    return this.communicationService.markProjectRead(projectId, effectiveCaller || callerId);
  }

  @Patch('notifications/:id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiResponse({ status: 200, description: 'The notification has been marked as read.' })
  @ApiResponse({ status: 404, description: 'Notification not found.' })
  markNotificationAsRead(@Param('id') id: string) {
    return this.communicationService.markNotificationAsRead(id);
  }
}
