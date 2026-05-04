import { Controller, Get, Post, Body, Patch, Param, Headers, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader, ApiBody } from '@nestjs/swagger';
import { MentorshipService } from './mentorship.service';
import { CreateApplicationDto, ApplicationStatus } from './dto/create-application.dto';
import { IssueBadgeDto } from './dto/issue-badge.dto';
import { Roles } from '../core/decorators/roles.decorator';

@ApiTags('Mentorship')
@Controller('mentorship')
export class MentorshipController {
  constructor(private readonly mentorshipService: MentorshipService) {}

  @Post('apply')
  @ApiOperation({ summary: 'Submit a mentorship application' })
  @ApiHeader({ name: 'x-user-id', required: true })
  @ApiResponse({ status: 201, description: 'Application submitted successfully.' })
  applyForMentorship(
    @Headers('x-user-id') userId: string,
    @Body() dto: CreateApplicationDto,
  ) {
    if (!userId) throw new UnauthorizedException('x-user-id header is missing.');
    return this.mentorshipService.applyForMentorship(userId, dto);
  }

  @Get('application')
  @ApiOperation({ summary: 'Get current user application status' })
  @ApiHeader({ name: 'x-user-id', required: true })
  getApplicationByUserId(@Headers('x-user-id') userId: string) {
    if (!userId) throw new UnauthorizedException('x-user-id header is missing.');
    return this.mentorshipService.getApplicationByUserId(userId);
  }

  @Patch('application/:id/review')
  @Roles('Administrator')
  @ApiHeader({ name: 'x-user-role', description: 'User role for authorization', required: true })
  @ApiOperation({ summary: 'Review an application (Admin only)' })
  @ApiBody({ schema: { type: 'object', properties: { status: { type: 'string', example: 'Approved' } } } })
  reviewApplication(
    @Param('id') id: string,
    @Body('status') status: ApplicationStatus,
  ) {
    return this.mentorshipService.reviewApplication(id, status);
  }

  @Post('badge')
  @Roles('Mentor', 'Administrator')
  @ApiOperation({ summary: 'Issue a recommendation badge (Mentor/Admin only)' })
  @ApiHeader({ name: 'x-user-id', description: 'ID of the mentor', required: true })
  @ApiHeader({ name: 'x-user-role', description: 'User role for authorization', required: true })
  issueBadge(
    @Headers('x-user-id') mentorId: string,
    @Body() dto: IssueBadgeDto,
  ) {
    if (!mentorId) throw new UnauthorizedException('x-user-id header is missing.');
    return this.mentorshipService.issueBadge(mentorId, dto);
  }

  @Get('badges/:userId')
  @ApiOperation({ summary: 'Get all badges for a user' })
  getBadgesByUserId(@Param('userId') userId: string) {
    return this.mentorshipService.getBadgesByUserId(userId);
  }
}
