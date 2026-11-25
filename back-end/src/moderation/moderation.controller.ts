import {
  Controller,
  Post,
  Put,
  Get,
  Param,
  Body,
  Query,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength, MaxLength } from 'class-validator';
import { ModerationService } from './moderation.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../core/decorators/roles.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../core/guards/roles.guard';
import { normalizeRole } from '../common/utils/role.util';
import { MIN_REASON_LENGTH, MAX_REASON_LENGTH } from './moderation.config';

export class ModerationActionDto {
  @ApiProperty({ description: 'Explanation reason between 10 and 500 characters', minLength: 10, maxLength: 500 })
  @IsString()
  @IsNotEmpty()
  @MinLength(MIN_REASON_LENGTH, { message: `Reason is required and must be between ${MIN_REASON_LENGTH} and ${MAX_REASON_LENGTH} characters.` })
  @MaxLength(MAX_REASON_LENGTH, { message: `Reason is required and must be between ${MIN_REASON_LENGTH} and ${MAX_REASON_LENGTH} characters.` })
  reason!: string;
}

@ApiTags('Moderation')
@Controller()
@UseGuards(AuthGuard, RolesGuard)
@ApiBearerAuth()
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Post('admin/users/:id/warn')
  @Put('admin/users/:id/warn')
  @Roles('admin', 'superuser')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Issue an administrative warning to a user' })
  @ApiResponse({ status: 201, description: 'Warning issued successfully' })
  async warnUser(
    @Param('id') targetUserId: string,
    @Body() dto: ModerationActionDto,
    @CurrentUser() actor: any,
  ) {
    const actorId = actor?.uid || actor?.id || 'admin';
    return this.moderationService.warn(actorId, targetUserId, dto?.reason);
  }

  @Post('admin/users/:id/suspend')
  @Put('admin/users/:id/suspend')
  @Roles('admin', 'superuser')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually suspend a user account (may queue for second approval)' })
  @ApiResponse({ status: 200, description: 'User account suspended' })
  @ApiResponse({ status: 202, description: 'Suspension queued for second admin or Super User approval' })
  async suspendUser(
    @Param('id') targetUserId: string,
    @Body() dto: ModerationActionDto,
    @CurrentUser() actor: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const actorId = actor?.uid || actor?.id || 'admin';
    const actorRole = normalizeRole(actor?.role || 'admin');
    const result = await this.moderationService.suspend(actorId, targetUserId, dto?.reason, actorRole);
    if (result?.status === 'pending_second_approval' && res) {
      res.status(HttpStatus.ACCEPTED);
    }
    return result;
  }

  @Get('admin/moderation-actions')
  @Roles('admin', 'superuser')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List second-approval moderation actions (pending, approved, rejected, expired)' })
  @ApiResponse({ status: 200, description: 'List of moderation actions returned' })
  listModerationActions(@Query('status') status?: string) {
    return this.moderationService.getPendingModerationActions(status);
  }

  @Post('admin/moderation-actions/:id/approve')
  @Roles('admin', 'superuser')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a pending second-approval moderation action' })
  @ApiResponse({ status: 200, description: 'Moderation action approved and executed' })
  async approveModerationAction(
    @Param('id') id: string,
    @Body() dto: ModerationActionDto,
    @CurrentUser() actor: any,
  ) {
    const actorId = actor?.uid || actor?.id || 'admin';
    return this.moderationService.approvePendingAction(id, actorId, dto?.reason);
  }

  @Post('admin/moderation-actions/:id/reject')
  @Roles('admin', 'superuser')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a pending second-approval moderation action' })
  @ApiResponse({ status: 200, description: 'Moderation action rejected' })
  rejectModerationAction(
    @Param('id') id: string,
    @Body() dto: ModerationActionDto,
    @CurrentUser() actor: any,
  ) {
    const actorId = actor?.uid || actor?.id || 'admin';
    return this.moderationService.rejectPendingAction(id, actorId, dto?.reason);
  }

  @Post('admin/users/:id/reactivate')
  @Put('admin/users/:id/reactivate')
  @Roles('admin', 'superuser')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reactivate a suspended user account' })
  @ApiResponse({ status: 200, description: 'User account reactivated' })
  async reactivateUser(
    @Param('id') targetUserId: string,
    @Body() dto: ModerationActionDto,
    @CurrentUser() actor: any,
  ) {
    const actorId = actor?.uid || actor?.id || 'admin';
    return this.moderationService.reactivate(actorId, targetUserId, dto?.reason);
  }

  @Get('admin/users/:id/warnings')
  @Roles('admin', 'superuser')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retrieve full warning history for a user (admin view)' })
  @ApiResponse({ status: 200, description: 'Array of warning records, newest first' })
  async getAdminWarnings(@Param('id') targetUserId: string) {
    return this.moderationService.getAdminUserWarnings(targetUserId);
  }

  @Get('users/me/warnings')
  @Roles('user')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retrieve own warning history' })
  @ApiResponse({ status: 200, description: 'Array of own warnings with N/4 label' })
  async getMyWarnings(@CurrentUser() user: any) {
    const userId = user?.uid || user?.id;
    return this.moderationService.getUserOwnWarnings(userId);
  }
}
