import {
  Body, Controller, Get, Headers, Param, Post, Patch, Query, UseGuards,
} from '@nestjs/common';
import {
  ApiBody, ApiCreatedResponse, ApiHeader, ApiOkResponse,
  ApiOperation, ApiParam, ApiQuery, ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { MentorMarketplaceService } from './mentor-marketplace.service';
import {
  BookSessionDto,
  CreateMentorProfileDto,
  FilterMentorsDto,
  SubmitReviewDto,
  UpdateAvailabilityDto,
  UpdateMentorProfileDto,
} from './dto/mentor-marketplace.dto';

@ApiTags('Mentor Marketplace')
@ApiHeader({ name: 'x-user-role', required: true, schema: { type: 'string' } })
@ApiHeader({ name: 'x-user-id', required: false, schema: { type: 'string' } })
@Controller('mentor-marketplace')
@UseGuards(RolesGuard)
export class MentorMarketplaceController {
  constructor(private readonly svc: MentorMarketplaceService) {}

  // ── Browse mentors ─────────────────────────────────────────────────────
  @Get('mentors')
  @Roles('user', 'admin', 'project-owner', 'collaborator', 'mentor', 'superuser')
  @ApiOperation({ summary: 'Browse verified mentors with filters and sorting' })
  @ApiQuery({ name: 'search',       required: false })
  @ApiQuery({ name: 'skills',       required: false, isArray: true })
  @ApiQuery({ name: 'minPrice',     required: false, type: Number })
  @ApiQuery({ name: 'maxPrice',     required: false, type: Number })
  @ApiQuery({ name: 'minExp',       required: false, type: Number })
  @ApiQuery({ name: 'availability', required: false })
  @ApiQuery({ name: 'minRating',    required: false, type: Number })
  @ApiQuery({ name: 'sort',         required: false, enum: ['price_asc', 'price_desc', 'rating', 'sessions'] })
  @ApiOkResponse({ description: 'List of verified mentor profiles' })
  listMentors(@Query() query: FilterMentorsDto) {
    return this.svc.listMentors(query);
  }

  @Get('mentors/me')
  @Roles('mentor', 'admin', 'superuser')
  @ApiOperation({ summary: 'Mentor: get my own listing (null if not created yet)' })
  getMyProfile(@Headers('x-user-id') userId: string) {
    return this.svc.getMyProfile(userId);
  }

  @Get('mentors/:id')
  @Roles('user', 'admin', 'project-owner', 'collaborator', 'mentor', 'superuser')
  @ApiOperation({ summary: 'Mentor profile detail + reviews' })
  @ApiParam({ name: 'id' })
  getMentor(@Param('id') id: string) {
    return this.svc.getMentor(id);
  }

  @Post('mentors/profile')
  @Roles('mentor', 'admin', 'superuser')
  @ApiOperation({ summary: 'Create mentor listing (Mentor role required)' })
  @ApiBody({ type: CreateMentorProfileDto })
  @ApiCreatedResponse({ description: 'Mentor profile created' })
  createProfile(
    @Headers('x-user-id') userId: string,
    @Body() dto: CreateMentorProfileDto,
  ) {
    return this.svc.createProfile(userId, dto);
  }

  @Patch('mentors/availability')
  @Roles('mentor')
  @ApiOperation({ summary: 'Mentor toggles their availability on/off' })
  @ApiBody({ type: UpdateAvailabilityDto })
  updateAvailability(
    @Headers('x-user-id') userId: string,
    @Body() dto: UpdateAvailabilityDto,
  ) {
    return this.svc.updateAvailability(userId, dto.isAvailable);
  }

  @Patch('mentors/confirm-role')
  @Roles('mentor', 'admin', 'superuser')
  @ApiOperation({ summary: 'Self-service: sync the caller\'s backend user record to role=Mentor' })
  confirmMentorRole(@Headers('x-user-id') userId: string) {
    return this.svc.confirmMentorRole(userId);
  }

  @Patch('mentors/profile')
  @Roles('mentor')
  @ApiOperation({ summary: 'Mentor edits their own listing (e.g. change price)' })
  @ApiBody({ type: UpdateMentorProfileDto })
  updateProfile(
    @Headers('x-user-id') userId: string,
    @Body() dto: UpdateMentorProfileDto,
  ) {
    return this.svc.updateProfile(userId, dto);
  }

  // ── Sessions ───────────────────────────────────────────────────────────
  @Post('sessions/book')
  @Roles('project-owner', 'admin', 'superuser')
  @ApiOperation({ summary: 'Project owner books a mentor for their project — money goes to escrow' })
  @ApiBody({ type: BookSessionDto })
  @ApiCreatedResponse({ description: 'Session created, escrow funded' })
  bookSession(
    @Headers('x-user-id') studentId: string,
    @Body() dto: BookSessionDto,
  ) {
    return this.svc.bookSession(studentId, dto);
  }

  @Get('sessions')
  @Roles('admin', 'superuser')
  @ApiOperation({ summary: 'Admin: list all sessions' })
  getAllSessions() {
    return this.svc.getAllSessions();
  }

  @Get('sessions/admin-stats')
  @Roles('admin', 'superuser')
  @ApiOperation({ summary: 'Admin: revenue and session statistics' })
  getAdminStats() {
    return this.svc.getAdminStats();
  }

  @Get('sessions/mine')
  @Roles('user', 'project-owner', 'collaborator', 'admin', 'superuser')
  @ApiOperation({ summary: 'Student: my booked sessions' })
  mySessionsStudent(@Headers('x-user-id') studentId: string) {
    return this.svc.getSessionsByStudent(studentId);
  }

  @Get('sessions/mentor-view')
  @Roles('mentor', 'admin', 'superuser')
  @ApiOperation({ summary: 'Mentor: sessions assigned to me' })
  mySessionsMentor(@Headers('x-user-id') mentorUserId: string) {
    return this.svc.getSessionsByMentor(mentorUserId);
  }

  @Post('sessions/:id/start')
  @Roles('admin', 'superuser')
  @ApiOperation({ summary: 'Admin: start a session (escrow_funded → active)' })
  @ApiParam({ name: 'id' })
  startSession(@Param('id') id: string) {
    return this.svc.startSession(id);
  }

  @Post('sessions/:id/accept')
  @Roles('mentor', 'admin', 'superuser')
  @ApiOperation({ summary: 'Mentor accepts a booking request — grants project workspace access' })
  @ApiParam({ name: 'id' })
  acceptSession(@Param('id') id: string, @Headers('x-user-id') mentorUserId: string) {
    return this.svc.acceptSession(id, mentorUserId);
  }

  @Post('sessions/:id/decline')
  @Roles('mentor', 'admin', 'superuser')
  @ApiOperation({ summary: 'Mentor declines a booking request — escrow is refunded' })
  @ApiParam({ name: 'id' })
  declineSession(@Param('id') id: string, @Headers('x-user-id') mentorUserId: string) {
    return this.svc.declineSession(id, mentorUserId);
  }

  @Post('sessions/:id/complete')
  @Roles('project-owner', 'admin', 'superuser')
  @ApiOperation({ summary: 'Project owner (or admin) completes a session — releases escrow, pays mentor, awards XP' })
  @ApiParam({ name: 'id' })
  completeSession(
    @Param('id') id: string,
    @Headers('x-user-id') requesterId: string,
    @Headers('x-user-role') role: string,
  ) {
    const isPrivileged = ['admin', 'superuser'].includes(String(role || '').toLowerCase());
    return this.svc.completeSession(id, requesterId, isPrivileged);
  }

  @Post('sessions/:id/cancel')
  @Roles('admin', 'superuser')
  @ApiOperation({ summary: 'Admin: cancel session and refund student' })
  @ApiParam({ name: 'id' })
  cancelSession(@Param('id') id: string) {
    return this.svc.cancelSession(id);
  }

  @Post('sessions/:id/review')
  @Roles('user', 'project-owner', 'collaborator', 'admin', 'superuser')
  @ApiOperation({ summary: 'Student submits a star rating + review after completion' })
  @ApiParam({ name: 'id', description: 'Session ID' })
  @ApiBody({ type: SubmitReviewDto })
  submitReview(
    @Param('id') sessionId: string,
    @Headers('x-user-id') studentId: string,
    @Body() dto: SubmitReviewDto,
  ) {
    return this.svc.submitReview(sessionId, studentId, dto);
  }
}
