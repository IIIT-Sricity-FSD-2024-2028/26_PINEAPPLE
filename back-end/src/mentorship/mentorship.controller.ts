import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Controller, Get, Post, Body, Patch, Param, Headers, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { MentorshipService } from './mentorship.service';
import { IssueBadgeDto } from './dto/issue-badge.dto';
import { Roles } from '../core/decorators/roles.decorator';
import { throwLegacyEndpointRemoved } from '../common/utils/legacy-route.util';

@ApiTags('Mentorship')
@ApiBearerAuth()
@Controller('mentorship')
export class MentorshipController {
  constructor(private readonly mentorshipService: MentorshipService) {}

  @Post('apply')
  @ApiOperation({
    deprecated: true,
    summary: 'Retired legacy endpoint (returns 410 LEGACY_ENDPOINT_REMOVED; use POST /mentor-applications)',
  })
  @ApiResponse({ status: 410, description: 'Legacy endpoint retired.' })
  applyForMentorship(): never {
    return throwLegacyEndpointRemoved('POST /mentorship/apply', 'POST /mentor-applications');
  }

  @Get('application')
  @ApiOperation({
    deprecated: true,
    summary: 'Retired legacy endpoint (returns 410 LEGACY_ENDPOINT_REMOVED; use GET /mentor-applications/me)',
  })
  @ApiResponse({ status: 410, description: 'Legacy endpoint retired.' })
  getApplicationByUserId(): never {
    return throwLegacyEndpointRemoved('GET /mentorship/application', 'GET /mentor-applications/me');
  }

  @Patch('application/:id/review')
  @ApiOperation({
    deprecated: true,
    summary:
      'Retired legacy endpoint (returns 410 LEGACY_ENDPOINT_REMOVED; use PUT /mentor-applications/:id/approve or PUT /mentor-applications/:id/reject)',
  })
  @ApiResponse({ status: 410, description: 'Legacy endpoint retired.' })
  reviewApplication(): never {
    return throwLegacyEndpointRemoved(
      'PATCH /mentorship/application/:id/review',
      'PUT /mentor-applications/:id/approve or PUT /mentor-applications/:id/reject',
    );
  }

  @Post('badge')
  @Roles('Mentor', 'Administrator', 'Super User')
  @ApiHeader({ name: 'x-user-id', description: 'Legacy-mode mentor user ID (ignored in JWT mode)', required: false })
  @ApiHeader({ name: 'x-user-role', description: 'Legacy-mode user role (ignored in JWT mode)', required: false })
  @ApiOperation({ summary: 'Issue a recommendation badge (Mentor/Admin only)' })
  issueBadge(
    @CurrentUser() user: any,
    @Headers('x-user-id') headerUserId: string,
    @Headers('x-user-role') headerRole: string,
    @Body() dto: IssueBadgeDto,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveMentorId = isLegacy ? headerUserId : (user?.uid || user?.id);
    const effectiveRole = isLegacy ? headerRole : user?.role;
    if (!effectiveMentorId) throw new UnauthorizedException('Authentication required.');
    return this.mentorshipService.issueBadge(effectiveMentorId, dto, effectiveRole);
  }

  @Post('badges')
  @Roles('Mentor', 'Administrator', 'Super User')
  @ApiOperation({ summary: 'Issue a recommendation badge (alias for POST /mentorship/badge)' })
  issueBadgesAlias(
    @CurrentUser() user: any,
    @Headers('x-user-id') headerUserId: string,
    @Headers('x-user-role') headerRole: string,
    @Body() dto: IssueBadgeDto,
  ) {
    return this.issueBadge(user, headerUserId, headerRole, dto);
  }

  @Get('badges/:userId')
  @Roles('user', 'project-owner', 'collaborator', 'mentor', 'admin', 'superuser')
  @ApiOperation({ summary: 'Get all badges for a user' })
  getBadgesByUserId(@Param('userId') userId: string) {
    return this.mentorshipService.getBadgesByUserId(userId);
  }

  @Get('badges/project/:projectId')
  @Roles('user', 'project-owner', 'collaborator', 'mentor', 'admin', 'superuser')
  @ApiOperation({ summary: 'Get all badges for a project' })
  getBadgesByProjectId(@Param('projectId') projectId: string) {
    return this.mentorshipService.getBadgesByProjectId(projectId);
  }
}
