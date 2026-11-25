import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard, normalizeRole } from '../common/guards/roles.guard';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { MentorMarketplaceService } from './mentor-marketplace.service';

@ApiTags('Mentor Lifecycle')
@ApiHeader({ name: 'x-user-role', required: false, schema: { type: 'string' } })
@ApiHeader({ name: 'x-user-id', required: false, schema: { type: 'string' } })
@Controller('mentor')
@UseGuards(RolesGuard)
export class MentorLifecycleController {
  constructor(private readonly svc: MentorMarketplaceService) {}

  @Post('abandonment-reviews/:id/confirm')
  @HttpCode(HttpStatus.OK)
  @Roles('mentor', 'admin', 'superuser')
  @ApiOperation({ summary: 'Assigned mentor confirms they are still active during an abandonment review' })
  @ApiParam({ name: 'id', description: 'Abandonment review ID' })
  confirmAbandonmentReview(
    @Param('id') id: string,
    @CurrentUser() authUser: any,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveUserId = isLegacy ? headerUserId : (authUser?.uid || authUser?.id);
    return this.svc.confirmAbandonmentReview(id, effectiveUserId);
  }

  @Get('abandonment-reviews/mine')
  @Roles('mentor', 'admin', 'superuser')
  @ApiOperation({ summary: 'Mentor lists open abandonment reviews requiring confirmation' })
  getMyOpenAbandonmentReviews(
    @CurrentUser() authUser: any,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveUserId = isLegacy ? headerUserId : (authUser?.uid || authUser?.id);
    return this.svc.getOpenReviewsForMentor(effectiveUserId);
  }
}

@ApiTags('Mentor Sessions Lifecycle')
@ApiHeader({ name: 'x-user-role', required: false, schema: { type: 'string' } })
@ApiHeader({ name: 'x-user-id', required: false, schema: { type: 'string' } })
@Controller('mentor-sessions')
@UseGuards(RolesGuard)
export class MentorSessionsLifecycleController {
  constructor(private readonly svc: MentorMarketplaceService) {}

  @Post(':id/feedback')
  @HttpCode(HttpStatus.OK)
  @Roles('user', 'project-owner', 'collaborator', 'admin', 'superuser')
  @ApiOperation({ summary: 'Project owner submits private 1-5 post-session feedback once' })
  @ApiParam({ name: 'id', description: 'Session ID' })
  submitFeedback(
    @Param('id') id: string,
    @CurrentUser() authUser: any,
    @Headers('x-user-id') headerUserId?: string,
    @Body() body?: { rating?: any; comment?: string },
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveUserId = isLegacy ? headerUserId : (authUser?.uid || authUser?.id);
    return this.svc.submitSessionFeedback(id, effectiveUserId, body || {});
  }

  @Post(':id/notes')
  @HttpCode(HttpStatus.OK)
  @Roles('mentor', 'project-owner', 'admin', 'superuser')
  @ApiOperation({ summary: 'Save mentor session notes and record mentor activity' })
  @ApiParam({ name: 'id', description: 'Session ID' })
  addSessionNote(
    @Param('id') id: string,
    @CurrentUser() authUser: any,
    @Headers('x-user-id') headerUserId?: string,
    @Headers('x-user-role') headerRole?: string,
    @Body() body?: { note?: string },
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveUserId = isLegacy ? headerUserId : (authUser?.uid || authUser?.id);
    const effectiveRole = isLegacy ? headerRole : (authUser?.role || authUser?.roleName);
    const isPrivileged = ['admin', 'superuser'].includes(normalizeRole(effectiveRole));
    return this.svc.addSessionNote(id, effectiveUserId, body?.note || '', isPrivileged);
  }

  @Post(':id/dispute')
  @UseGuards(EmailVerifiedGuard)
  @HttpCode(HttpStatus.CREATED)
  @Roles('user', 'project-owner', 'collaborator', 'mentor', 'admin', 'superuser')
  @ApiOperation({ summary: 'Open an escrow dispute on an accepted, active, or awaiting-release session' })
  @ApiParam({ name: 'id', description: 'Session ID' })
  openDispute(
    @Param('id') id: string,
    @CurrentUser() authUser: any,
    @Headers('x-user-id') headerUserId?: string,
    @Headers('x-user-role') headerRole?: string,
    @Body() body?: { reason?: string },
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveUserId = isLegacy ? headerUserId : (authUser?.uid || authUser?.id);
    const effectiveRole = isLegacy ? headerRole : (authUser?.role || authUser?.roleName);
    const isPrivileged = ['admin', 'superuser'].includes(normalizeRole(effectiveRole));
    return this.svc.openSessionDispute(id, effectiveUserId, body?.reason || '', isPrivileged);
  }
}
