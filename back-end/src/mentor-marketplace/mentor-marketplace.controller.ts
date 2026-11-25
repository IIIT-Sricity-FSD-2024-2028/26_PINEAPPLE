import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  BadRequestException, Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post, Patch, Put, Query, Req, UseGuards,
} from '@nestjs/common';
import {
  ApiBody, ApiCreatedResponse, ApiHeader, ApiOkResponse,
  ApiOperation, ApiParam, ApiQuery, ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard, normalizeRole } from '../common/guards/roles.guard';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { MentorMarketplaceService } from './mentor-marketplace.service';
import { validateMentorPrice } from './mentor-marketplace.config';
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
@Controller(['mentor-marketplace', ''])
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
  @ApiQuery({ name: 'sort',         required: false, enum: ['price_asc', 'price_desc'] })
  @ApiOkResponse({ description: 'List of verified mentor profiles' })
  listMentors(@Query() query: FilterMentorsDto) {
    return this.svc.listMentors(query);
  }

  @Get('mentors/me')
  @Roles('mentor', 'admin', 'superuser')
  @ApiOperation({ summary: 'Mentor: get my own listing (null if not created yet)' })
  getMyProfile(
    @CurrentUser('uid') authUid: string,
    @Headers('x-user-id') userId: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveUserId = isLegacy ? userId : authUid;
    return this.svc.getMyProfile(effectiveUserId);
  }

  @Get('mentors/me/stats')
  @Roles('mentor', 'admin', 'superuser')
  @ApiOperation({ summary: 'Mentor: private aggregate stats, feedback average, and open abandonment reviews' })
  getMyStats(
    @CurrentUser('uid') authUid: string,
    @Headers('x-user-id') userId: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveUserId = isLegacy ? userId : authUid;
    return this.svc.getMentorPrivateStats(effectiveUserId);
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
    @CurrentUser('uid') authUid: string,
    @Headers('x-user-id') userId: string,
    @Body() dto: CreateMentorProfileDto,
    @Req() req: any,
  ) {
    if (
      req?.body &&
      ((Object.prototype.hasOwnProperty.call(req.body, 'username') && req.body.username !== undefined) ||
        (req.body.profile && Object.prototype.hasOwnProperty.call(req.body.profile, 'username') && req.body.profile.username !== undefined))
    ) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'USERNAME_IMMUTABLE',
        message: "Your username can't be changed.",
      });
    }
    const rawPrice = req?.body?.sessionPrice !== undefined ? req.body.sessionPrice : dto?.sessionPrice;
    dto.sessionPrice = validateMentorPrice(rawPrice);
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveUserId = isLegacy ? userId : authUid;
    return this.svc.createProfile(effectiveUserId, dto);
  }

  @Patch('mentors/availability')
  @Roles('mentor', 'admin', 'superuser')
  @ApiOperation({ summary: 'Mentor toggles their availability on/off' })
  @ApiBody({ type: UpdateAvailabilityDto })
  updateAvailability(
    @CurrentUser('uid') authUid: string,
    @Headers('x-user-id') userId: string,
    @Body() dto: UpdateAvailabilityDto,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveUserId = isLegacy ? userId : authUid;
    return this.svc.updateAvailability(effectiveUserId, dto.isAvailable);
  }

  @Patch('mentors/confirm-role')
  @Roles('mentor', 'admin', 'superuser')
  @ApiOperation({ summary: 'Self-service: sync the caller\'s backend user record to role=Mentor' })
  confirmMentorRole(
    @CurrentUser('uid') authUid: string,
    @Headers('x-user-id') userId: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveUserId = isLegacy ? userId : authUid;
    return this.svc.confirmMentorRole(effectiveUserId);
  }

  @Patch('mentors/profile')
  @Roles('mentor', 'admin', 'superuser')
  @ApiOperation({ summary: 'Mentor edits their own listing (e.g. change price)' })
  @ApiBody({ type: UpdateMentorProfileDto })
  updateProfile(
    @CurrentUser('uid') authUid: string,
    @Headers('x-user-id') userId: string,
    @Body() dto: UpdateMentorProfileDto,
    @Req() req: any,
  ) {
    if (
      req?.body &&
      ((Object.prototype.hasOwnProperty.call(req.body, 'username') && req.body.username !== undefined) ||
        (req.body.profile && Object.prototype.hasOwnProperty.call(req.body.profile, 'username') && req.body.profile.username !== undefined))
    ) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'USERNAME_IMMUTABLE',
        message: "Your username can't be changed.",
      });
    }
    if (req?.body && Object.prototype.hasOwnProperty.call(req.body, 'sessionPrice')) {
      dto.sessionPrice = validateMentorPrice(req.body.sessionPrice);
    } else if (dto?.sessionPrice !== undefined) {
      dto.sessionPrice = validateMentorPrice(dto.sessionPrice);
    }
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveUserId = isLegacy ? userId : authUid;
    return this.svc.updateProfile(effectiveUserId, dto);
  }

  @Put('mentors/profile')
  @Roles('mentor', 'admin', 'superuser')
  @ApiOperation({ summary: 'Mentor edits their own listing (PUT alias)' })
  @ApiBody({ type: UpdateMentorProfileDto })
  updateProfilePut(
    @CurrentUser('uid') authUid: string,
    @Headers('x-user-id') userId: string,
    @Body() dto: UpdateMentorProfileDto,
    @Req() req: any,
  ) {
    return this.updateProfile(authUid, userId, dto, req);
  }

  // ── Sessions ───────────────────────────────────────────────────────────
  @Post('sessions/:id/confirm-payment')
  @HttpCode(HttpStatus.OK)
  @UseGuards(EmailVerifiedGuard)
  @Roles('project-owner', 'admin', 'superuser')
  @ApiOperation({ summary: 'Owner confirms demo UPI payment -> escrow funded' })
  @ApiParam({ name: 'id' })
  confirmPayment(
    @Param('id') id: string,
    @CurrentUser('uid') authUid: string,
    @Headers('x-user-id') studentId: string,
    @CurrentUser('role') authRole: string,
    @Headers('x-user-role') role: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveStudentId = isLegacy ? studentId : authUid;
    const effectiveRole = isLegacy ? role : authRole;
    const isPrivileged = ['admin', 'superuser'].includes(normalizeRole(effectiveRole));
    return this.svc.confirmPayment(id, effectiveStudentId, isPrivileged, idempotencyKey);
  }

  @Post('sessions/:id/pay')
  @HttpCode(HttpStatus.OK)
  @UseGuards(EmailVerifiedGuard)
  @Roles('project-owner', 'admin', 'superuser')
  @ApiOperation({ summary: 'Owner pays for session with Idempotency-Key -> escrow funded' })
  @ApiParam({ name: 'id' })
  paySession(
    @Param('id') id: string,
    @CurrentUser('uid') authUid: string,
    @Headers('x-user-id') studentId: string,
    @CurrentUser('role') authRole: string,
    @Headers('x-user-role') role: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveStudentId = isLegacy ? studentId : authUid;
    const effectiveRole = isLegacy ? role : authRole;
    const isPrivileged = ['admin', 'superuser'].includes(normalizeRole(effectiveRole));
    return this.svc.confirmPayment(id, effectiveStudentId, isPrivileged, idempotencyKey);
  }

  @Post('sessions/:id/cancel-payment')
  @HttpCode(HttpStatus.OK)
  @Roles('project-owner', 'admin', 'superuser')
  @ApiOperation({ summary: 'Owner cancels demo UPI payment -> releases project hold' })
  @ApiParam({ name: 'id' })
  cancelPayment(
    @Param('id') id: string,
    @CurrentUser('uid') authUid: string,
    @Headers('x-user-id') studentId: string,
    @CurrentUser('role') authRole: string,
    @Headers('x-user-role') role: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveStudentId = isLegacy ? studentId : authUid;
    const effectiveRole = isLegacy ? role : authRole;
    const isPrivileged = ['admin', 'superuser'].includes(normalizeRole(effectiveRole));
    return this.svc.cancelPayment(id, effectiveStudentId, isPrivileged);
  }

  @Post('sessions/book')
  @UseGuards(EmailVerifiedGuard)
  @Roles('project-owner', 'admin', 'superuser')
  @ApiOperation({ summary: 'Project owner books a mentor for their project — money goes to escrow' })
  @ApiBody({ type: BookSessionDto })
  @ApiCreatedResponse({ description: 'Session created, escrow funded' })
  bookSession(
    @CurrentUser('uid') authUid: string,
    @Headers('x-user-id') studentId: string,
    @Body() dto: BookSessionDto,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveStudentId = isLegacy ? studentId : authUid;
    return this.svc.bookSession(effectiveStudentId, dto);
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
  mySessionsStudent(
    @CurrentUser('uid') authUid: string,
    @Headers('x-user-id') studentId: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveStudentId = isLegacy ? studentId : authUid;
    return this.svc.getSessionsByStudent(effectiveStudentId);
  }

  @Get('sessions/mentor-view')
  @Roles('mentor', 'admin', 'superuser')
  @ApiOperation({ summary: 'Mentor: sessions assigned to me' })
  mySessionsMentor(
    @CurrentUser() authUser: any,
    @Headers('x-user-id') mentorUserId: string,
    @Headers('x-user-role') role: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveMentorId = isLegacy ? mentorUserId : authUser?.uid;
    const effectiveRole = isLegacy ? role : authUser?.role;
    const isPrivileged = ['admin', 'superuser'].includes(normalizeRole(effectiveRole));
    return this.svc.getSessionsByMentor(effectiveMentorId, isPrivileged);
  }

  @Get('mentored-projects')
  @Roles('mentor', 'admin', 'superuser')
  @ApiOperation({ summary: 'Mentor: get my mentored projects (active and completed)' })
  getMentoredProjects(
    @CurrentUser() authUser: any,
    @Headers('x-user-id') mentorUserId: string,
    @Headers('x-user-role') role: string,
    @Query('mentorUserId') mentorUserIdParam?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveRole = isLegacy ? role : (authUser?.role || role);
    const isPrivileged = ['admin', 'superuser'].includes(normalizeRole(effectiveRole));
    let effectiveMentorId = isLegacy ? mentorUserId : (authUser?.uid || mentorUserId);
    if (isPrivileged && mentorUserIdParam) {
      effectiveMentorId = mentorUserIdParam;
    }
    return this.svc.getMentoredProjects(effectiveMentorId);
  }

  @Post('sessions/:id/start')
  @Roles('admin', 'superuser')
  @ApiOperation({ summary: 'Admin: start a session (escrow_funded → active)' })
  @ApiParam({ name: 'id' })
  startSession(@Param('id') id: string) {
    return this.svc.startSession(id);
  }

  @Post('sessions/:id/accept')
  @HttpCode(HttpStatus.OK)
  @Roles('mentor', 'admin', 'superuser')
  @ApiOperation({ summary: 'Mentor accepts a booking request — grants project workspace access' })
  @ApiParam({ name: 'id' })
  acceptSession(
    @Param('id') id: string,
    @CurrentUser() authUser: any,
    @Headers('x-user-id') mentorUserId: string,
    @Headers('x-user-role') role: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveMentorId = isLegacy ? mentorUserId : authUser?.uid;
    const effectiveRole = isLegacy ? role : authUser?.role;
    const isPrivileged = ['admin', 'superuser'].includes(normalizeRole(effectiveRole));
    return this.svc.acceptSession(id, effectiveMentorId, isPrivileged);
  }

  @Post('sessions/:id/decline')
  @Patch('sessions/:id/decline')
  @HttpCode(HttpStatus.OK)
  @Roles('mentor', 'admin', 'superuser')
  @ApiOperation({ summary: 'Mentor declines a booking request — escrow is refunded' })
  @ApiParam({ name: 'id' })
  declineSession(
    @Param('id') id: string,
    @Body() body: any,
    @CurrentUser() authUser: any,
    @Headers('x-user-id') mentorUserId: string,
    @Headers('x-user-role') role: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveMentorId = isLegacy ? mentorUserId : (authUser?.uid || authUser?.id);
    const effectiveRole = isLegacy ? role : authUser?.role;
    const isPrivileged = ['admin', 'superuser'].includes(normalizeRole(effectiveRole));
    const reason = body?.reason || body?.declineReason;
    return this.svc.declineSession(id, effectiveMentorId, isPrivileged, reason, body);
  }

  @Post('sessions/:id/complete')
  @Roles('project-owner', 'admin', 'superuser')
  @ApiOperation({ summary: 'Project owner (or admin) completes a session — releases escrow, pays mentor, awards XP' })
  @ApiParam({ name: 'id' })
  completeSession(
    @Param('id') id: string,
    @CurrentUser() authUser: any,
    @Headers('x-user-id') requesterId: string,
    @Headers('x-user-role') role: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveRequesterId = isLegacy ? requesterId : (authUser?.uid || authUser?.id);
    const effectiveRole = isLegacy ? role : (authUser?.role || authUser?.roleName);
    const isPrivileged = ['admin', 'superuser'].includes(normalizeRole(effectiveRole));
    return this.svc.completeSession(id, effectiveRequesterId, isPrivileged);
  }

  @Post('sessions/:id/cancel')
  @Roles('admin', 'superuser', 'project-owner')
  @ApiOperation({ summary: 'Admin/Owner: cancel session and refund student' })
  @ApiParam({ name: 'id' })
  cancelSession(
    @Param('id') id: string,
    @Body() body: any,
    @CurrentUser() authUser: any,
    @Headers('x-user-id') userId: string,
    @Headers('x-user-role') role: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveUserId = isLegacy ? userId : (authUser?.uid || authUser?.id);
    const effectiveRole = isLegacy ? role : (authUser?.role || authUser?.roleName);
    const isPrivileged = ['admin', 'superuser'].includes(normalizeRole(effectiveRole));
    return this.svc.cancelSession(id, effectiveUserId, isPrivileged, body);
  }

  @Post('sessions/:id/review')
  @Roles('user', 'project-owner', 'collaborator', 'admin', 'superuser')
  @ApiOperation({ summary: 'Student submits a star rating + review after completion' })
  @ApiParam({ name: 'id', description: 'Session ID' })
  @ApiBody({ type: SubmitReviewDto })
  submitReview(
    @Param('id') sessionId: string,
    @CurrentUser('uid') authUid: string,
    @Headers('x-user-id') studentId: string,
    @Body() dto: SubmitReviewDto,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveStudentId = isLegacy ? studentId : authUid;
    return this.svc.submitReview(sessionId, effectiveStudentId, dto);
  }

  @Post('sessions/:id/notes')
  @HttpCode(HttpStatus.OK)
  @Roles('mentor', 'project-owner', 'admin', 'superuser')
  @ApiOperation({ summary: 'Save session note and record mentor project activity' })
  @ApiParam({ name: 'id' })
  addSessionNote(
    @Param('id') id: string,
    @CurrentUser() authUser: any,
    @Headers('x-user-id') headerUserId: string,
    @Headers('x-user-role') headerRole: string,
    @Body() body: { note?: string },
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveUserId = isLegacy ? headerUserId : (authUser?.uid || authUser?.id);
    const effectiveRole = isLegacy ? headerRole : (authUser?.role || authUser?.roleName);
    const isPrivileged = ['admin', 'superuser'].includes(normalizeRole(effectiveRole));
    return this.svc.addSessionNote(id, effectiveUserId, body?.note || '', isPrivileged);
  }

  @Post('sessions/:id/feedback')
  @HttpCode(HttpStatus.OK)
  @Roles('user', 'project-owner', 'collaborator', 'admin', 'superuser')
  @ApiOperation({ summary: 'Project owner submits private 1-5 post-session feedback once' })
  @ApiParam({ name: 'id' })
  submitFeedback(
    @Param('id') id: string,
    @CurrentUser('uid') authUid: string,
    @Headers('x-user-id') studentId: string,
    @Body() body: { rating?: any; comment?: string },
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveUserId = isLegacy ? studentId : authUid;
    return this.svc.submitSessionFeedback(id, effectiveUserId, body || {});
  }

  @Post('sessions/:id/retry-payout')
  @Roles('admin', 'superuser', 'project-owner', 'mentor')
  @ApiOperation({ summary: 'Retry releasing escrow for a session with payout_pending status' })
  @ApiParam({ name: 'id' })
  retryPayout(@Param('id') id: string) {
    return this.svc.retryPayout(id);
  }

  @Post('sessions/:id/dispute')
  @UseGuards(EmailVerifiedGuard)
  @HttpCode(HttpStatus.CREATED)
  @Roles('user', 'project-owner', 'collaborator', 'mentor', 'admin', 'superuser')
  @ApiOperation({ summary: 'Open an escrow dispute on an accepted, active, or awaiting-release session' })
  @ApiParam({ name: 'id' })
  openDispute(
    @Param('id') id: string,
    @CurrentUser() authUser: any,
    @Headers('x-user-id') headerUserId: string,
    @Headers('x-user-role') headerRole: string,
    @Body() body: { reason?: string },
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveUserId = isLegacy ? headerUserId : (authUser?.uid || authUser?.id);
    const effectiveRole = isLegacy ? headerRole : (authUser?.role || authUser?.roleName);
    const isPrivileged = ['admin', 'superuser'].includes(normalizeRole(effectiveRole));
    return this.svc.openSessionDispute(id, effectiveUserId, body?.reason || '', isPrivileged);
  }
}
