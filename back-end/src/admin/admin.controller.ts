import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBody,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiAcceptedResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { RolesGuard, normalizeRole } from '../common/guards/roles.guard';
import { AdminStatsEntity } from './entities/admin-stats.entity';
import { ModerateUserDto } from './dto/moderate-user.dto';
import { WarnUserDto } from './dto/warn-user.dto';
import { SuspendUserDto } from './dto/suspend-user.dto';
import { ReactivateUserDto } from './dto/reactivate-user.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { UpdatePlatformConfigDto } from '../platform-config/dto/update-platform-config.dto';
import { AdminService } from './admin.service';
import { AdminRefreshService } from './admin-refresh.service';
import { JobsService } from '../jobs/jobs.service';
import { JobRunsService } from '../jobs/job-runs.service';
import { MentorMarketplaceService } from '../mentor-marketplace/mentor-marketplace.service';
import { ReputationService } from '../moderation/reputation.service';
import { ProjectsService } from '../projects/projects.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Admin')
@ApiHeader({
  name: 'x-user-role',
  description: 'User role for RBAC authorization',
  required: true,
  schema: { type: 'string', enum: ['admin', 'superuser'] },
})
@Controller('admin')
@UseGuards(RolesGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly adminRefreshService: AdminRefreshService,
    private readonly jobsService: JobsService,
    private readonly jobRunsService: JobRunsService,
    @Inject(forwardRef(() => MentorMarketplaceService))
    private readonly mentorMarketplaceService: MentorMarketplaceService,
    private readonly reputationService: ReputationService,
    private readonly projectsService: ProjectsService,
  ) {}

  @Get('users')
  @Roles('admin')
  @ApiOperation({ summary: 'List all users for administrative review' })
  @ApiOkResponse({ description: 'Users returned successfully.', type: [Object] })
  @ApiForbiddenResponse({ description: 'Forbidden - admin role required' })
  listUsers() {
    return this.adminService.getUsers();
  }

  @Get('users/duplicates')
  @Roles('admin', 'superuser')
  @ApiOperation({ summary: 'List groups of possible duplicate accounts (shared normalized email or verified phone)' })
  @ApiOkResponse({ description: 'Duplicate account groups returned successfully.' })
  @ApiForbiddenResponse({ description: 'Forbidden - users section permission required' })
  listDuplicateUsers() {
    return this.adminService.getDuplicateUsers();
  }

  @Get('users/counts')
  @Roles('admin')
  @ApiOperation({ summary: 'Get canonical platform user counts for the Users page filter chips' })
  @ApiOkResponse({ description: 'Platform user counts returned successfully.' })
  @ApiForbiddenResponse({ description: 'Forbidden - admin users permission required' })
  getUserCounts() {
    return this.adminService.getUserCounts();
  }

  @Get('reputation/reconcile')
  @Roles('superuser')
  @ApiOperation({ summary: 'Reconcile reputation ledger sums against leaderboard and profile views (Super User only)' })
  @ApiOkResponse({ description: 'Reputation reconciliation report returned.' })
  @ApiForbiddenResponse({ description: 'Forbidden - superuser role required' })
  reconcileReputation() {
    return this.adminService.reconcileReputation();
  }

  @Get('users/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Get detailed live user profile for administrative review' })
  @ApiParam({ name: 'id', description: 'User ID to inspect' })
  @ApiOkResponse({ description: 'User details returned successfully.' })
  @ApiForbiddenResponse({ description: 'Forbidden - admin role required' })
  getUserDetails(@Param('id') id: string) {
    return this.adminService.getUserDetails(id);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login as an admin or superuser' })
  @ApiOkResponse({ description: 'Logged in successfully.', type: Object })
  login(
    @Body() credentials: AdminLoginDto,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const forwarded = req?.headers?.['x-forwarded-for'];
    const clientIp =
      (forwarded ? String(forwarded).split(',')[0].trim() : '') ||
      req?.ip ||
      req?.socket?.remoteAddress ||
      'unknown';
    return this.adminService.login(credentials, clientIp, res);
  }

  @Public()
  @Post('auth/refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh an admin portal access token via httpOnly refresh cookie' })
  @ApiOkResponse({ description: 'Admin session refreshed successfully.', type: Object })
  refreshSession(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    return this.adminRefreshService.refresh(req, res);
  }

  @Public()
  @Post('auth/logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log out of admin portal and revoke the admin refresh cookie' })
  @ApiOkResponse({ description: 'Admin session logged out.', type: Object })
  logoutSession(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    return this.adminRefreshService.logout(req, res);
  }

  @Post('admins/:id/revoke-sessions')
  @Roles('superuser')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke all active sessions for an admin account (Super User only)' })
  @ApiOkResponse({ description: 'Admin sessions revoked successfully.', type: Object })
  revokeAdminSessions(@Param('id') id: string) {
    return this.adminService.revokeAdminSessions(id);
  }

  @Patch('users/:id/status')
  @Roles('admin')
  @ApiOperation({ summary: "Update a user's moderation status" })
  @ApiParam({ name: 'id', description: 'User ID to moderate' })
  @ApiBody({ type: ModerateUserDto })
  @ApiOkResponse({ description: 'User status updated successfully.', type: Object })
  @ApiForbiddenResponse({ description: 'Forbidden - admin role required' })
  async updateUserStatus(
    @Param('id') id: string,
    @Body() body: any,
    @CurrentUser() actor?: any,
    @Res({ passthrough: true }) res?: Response,
  ) {
    if (
      body &&
      ((Object.prototype.hasOwnProperty.call(body, 'username') && body.username !== undefined) ||
        (body.profile && Object.prototype.hasOwnProperty.call(body.profile, 'username') && body.profile.username !== undefined))
    ) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'USERNAME_IMMUTABLE',
        message: "Your username can't be changed.",
      });
    }
    const action = String(body.action || body.status || '').toLowerCase();
    if (action === 'suspend' || action === 'suspended') {
      const actorId = actor?.uid || actor?.id || 'admin';
      const actorRole = normalizeRole(actor?.role || 'admin');
      const result: any = await this.adminService.suspendWithModerationCheck(
        actorId,
        id,
        body.reason,
        actorRole,
      );
      if (result?.status === 'pending_second_approval' && res) {
        res.status(HttpStatus.ACCEPTED);
      }
      return result;
    }
    if (action === 'warn' || action === 'warned') {
      return this.adminService.warnUser(id, { reason: body.reason });
    }
    if (action === 'reactivate' || action === 'active' || action === 'activate') {
      return this.adminService.reactivateUser(id, { reason: body.reason });
    }
    if (action === 'flag' || action === 'flagged') {
      return this.adminService.flagUser(id);
    }
    return this.adminService.updateUserStatus(id, body);
  }

  @Put('users/:id/status')
  @Roles('admin')
  @ApiOperation({ summary: "Update a user's moderation status" })
  updateUserStatusPut(
    @Param('id') id: string,
    @Body() body: any,
    @CurrentUser() actor?: any,
    @Res({ passthrough: true }) res?: Response,
  ) {
    return this.updateUserStatus(id, body, actor, res);
  }

  @Post('users/:id/status')
  @Roles('admin')
  @ApiOperation({ summary: "Update a user's moderation status" })
  updateUserStatusPost(
    @Param('id') id: string,
    @Body() body: any,
    @CurrentUser() actor?: any,
    @Res({ passthrough: true }) res?: Response,
  ) {
    return this.updateUserStatus(id, body, actor, res);
  }

  @Put('users/:id/flag')
  @Roles('admin')
  @ApiOperation({ summary: 'Flag a user for review' })
  @ApiParam({ name: 'id', description: 'User ID to flag' })
  @ApiOkResponse({ description: 'User flagged successfully.', type: Object })
  @ApiForbiddenResponse({ description: 'Forbidden - admin role required' })
  flagUser(@Param('id') id: string) {
    return this.adminService.flagUser(id);
  }

  @Get('stats')
  @Roles('admin')
  @ApiOperation({ summary: 'Get platform usage and moderation statistics' })
  @ApiOkResponse({ description: 'Administration statistics returned successfully.', type: AdminStatsEntity })
  @ApiForbiddenResponse({ description: 'Forbidden - admin role required' })
  getStats(): AdminStatsEntity {
    return this.adminService.getStats();
  }

  @Get('audit')
  @Roles('admin')
  @ApiOperation({ summary: 'View recent administrative audit log entries' })
  @ApiOkResponse({ description: 'Audit log returned successfully.', type: [Object] })
  @ApiForbiddenResponse({ description: 'Forbidden - admin role required' })
  getAuditLog(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('userId') userId?: string,
    @Query('reportId') reportId?: string,
    @Query('action') action?: string,
    @Query('actor') actor?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    const offsetNum = offset ? parseInt(offset, 10) : undefined;
    return this.adminService.getAuditLog(limitNum, offsetNum, userId, reportId, action, actor);
  }

  @Get('audit/export')
  @Roles('admin', 'superuser')
  @ApiOperation({ summary: 'Export audit log in CSV or JSON with date, actor, action, userId, reportId filters (max 10,000 rows)' })
  @ApiOkResponse({ description: 'Audit log export generated.' })
  exportAuditLog(
    @Query('format') format?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('actor') actor?: string,
    @Query('action') action?: string,
    @Query('userId') userId?: string,
    @Query('reportId') reportId?: string,
    @CurrentUser() caller?: any,
    @Headers('x-user-id') headerUserId?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const requesterId = isLegacy ? (headerUserId || 'Admin') : (caller?.uid || caller?.id || 'Admin');
    const result = this.adminService.exportAuditLog({
      format,
      from,
      to,
      actor,
      action,
      userId,
      reportId,
      requesterId,
    });
    if (result.format === 'csv' && res) {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="audit-export.csv"');
      res.setHeader('X-Export-Count', String(result.exportedCount));
      res.setHeader('X-Export-Truncated', String(result.truncated));
      return result.csv;
    }
    return result;
  }

  @Post('audit')
  @Roles('user')
  @ApiOperation({ summary: 'Record an audit log entry' })
  @ApiOkResponse({ description: 'Audit log entry recorded successfully.', type: Object })
  recordAudit(@Body() entry: any) {
    return this.adminService.logClientAudit(entry);
  }

  @Get('config')
  @Roles('admin', 'superuser')
  @ApiOperation({ summary: 'Get current platform configuration' })
  @ApiOkResponse({ description: 'Platform configuration returned successfully.' })
  getConfig() {
    return this.adminService.getConfig();
  }

  @Public()
  @Get('config/public')
  @ApiOperation({ summary: 'Get public platform configuration' })
  @ApiOkResponse({ description: 'Public platform configuration returned.' })
  getPublicConfig() {
    return this.adminService.getConfig();
  }

  @Put('config')
  @Roles('superuser')
  @ApiOperation({ summary: 'Update platform configuration (Superuser only)' })
  @ApiOkResponse({ description: 'Platform configuration updated successfully.' })
  updateConfig(@Body() dto: UpdatePlatformConfigDto) {
    return this.adminService.updateConfig(dto);
  }

  @Post('jobs/tick')
  @Roles('superuser')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Trigger manual execution of hourly scheduled jobs (Super User only)' })
  @ApiAcceptedResponse({ description: 'Job tick triggered successfully.' })
  @ApiForbiddenResponse({ description: 'Forbidden - superuser role required' })
  async triggerJobsTick() {
    const run = await this.jobsService.runTick('manual');
    return { runId: run.id };
  }

  @Get('jobs/runs')
  @Roles('admin')
  @ApiOperation({ summary: 'List recent job execution runs (Admin and Super User)' })
  @ApiOkResponse({ description: 'List of job runs returned.' })
  @ApiForbiddenResponse({ description: 'Forbidden - admin role required' })
  getJobRuns(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.jobRunsService.list(limitNum);
  }

  @Get('jobs/runs/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Get details of a single job run (Admin and Super User)' })
  @ApiParam({ name: 'id', description: 'Run ID' })
  @ApiOkResponse({ description: 'Job run details returned.' })
  @ApiNotFoundResponse({ description: 'Job run not found.' })
  @ApiForbiddenResponse({ description: 'Forbidden - admin role required' })
  getJobRun(@Param('id') id: string) {
    const run = this.jobRunsService.findById(id);
    if (!run) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'Not Found',
        code: 'RUN_NOT_FOUND',
        message: `Job run with id "${id}" not found`,
      });
    }
    return run;
  }

  @Get('escrow/reconcile')
  @Roles('admin', 'superuser')
  @ApiOperation({ summary: 'Reconcile escrow balances across all mentor sessions (Admin and Super User)' })
  @ApiOkResponse({ description: 'Reconciliation result returned.' })
  reconcileEscrow() {
    return this.mentorMarketplaceService.reconcileEscrow();
  }

  @Get('users/:id/reputation')
  @Roles('admin')
  @ApiOperation({ summary: 'Get paginated reputation ledger for a user (Admin and Super User)' })
  getUserReputation(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
  ) {
    return this.reputationService.getPaginatedEntries(id, { page, limit, type });
  }

  @Get('reputation')
  @Roles('admin')
  @ApiOperation({ summary: 'Get paginated reputation ledger across users (Admin and Super User)' })
  getAllReputation(
    @Query('userId') userId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
  ) {
    return this.reputationService.getPaginatedEntries(userId, { page, limit, type });
  }

  @Post('projects/:id/close')
  @Roles('admin', 'superuser')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Administratively close an abandoned or escalated project (Admin and Super User)' })
  @ApiOkResponse({ description: 'Project closed successfully with Phase 9 closure refund rules.' })
  @ApiForbiddenResponse({ description: 'Forbidden - admin role with projects permission required' })
  closeProject(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @CurrentUser() authUser?: any,
  ) {
    const reason = (body?.reason || '').trim() || 'Owner inactive';
    const actor = authUser?.email || authUser?.name || authUser?.uid || 'Admin';
    return this.projectsService.closeProject(id, reason, actor);
  }

  @Post('abandonment-reviews/:id/cancel')
  @Roles('admin', 'superuser')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin/Super User cancels an open mentor abandonment review with reason' })
  @ApiOkResponse({ description: 'Abandonment review cancelled and both sides notified.' })
  cancelAbandonmentReview(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @CurrentUser() authUser?: any,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveAdminId = isLegacy ? (headerUserId || 'admin') : (authUser?.uid || authUser?.id || 'admin');
    return this.mentorMarketplaceService.cancelAbandonmentReview(id, effectiveAdminId, body?.reason);
  }

  @Get('mentors/:id/feedback')
  @Roles('admin', 'superuser')
  @ApiOperation({ summary: 'Admin/Super User inspects full private post-session feedback and abandonment history for a mentor' })
  @ApiOkResponse({ description: 'Full feedback list, aggregate rating, and abandonment history returned.' })
  getMentorFeedbackAdmin(@Param('id') id: string) {
    return this.mentorMarketplaceService.getAdminMentorFeedback(id);
  }

  @Get('disputes')
  @Roles('admin', 'superuser')
  @ApiOperation({ summary: 'List mentor escrow disputes (open, decided, or all)' })
  @ApiOkResponse({ description: 'Dispute list returned successfully.' })
  listDisputes(@Query('status') status?: string) {
    return this.mentorMarketplaceService.listDisputes(status);
  }

  @Post('disputes/:id/decide')
  @Roles('admin', 'superuser')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin decides an open escrow dispute once (release_to_mentor, refund_to_owner, or split)' })
  @ApiOkResponse({ description: 'Dispute decided and escrow settled.' })
  decideDispute(
    @Param('id') id: string,
    @Body() body: { decision?: string; mentorPercent?: number; reason?: string },
    @CurrentUser() caller?: any,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const adminId = isLegacy ? (headerUserId || 'admin') : (caller?.uid || caller?.id || 'admin');
    return this.mentorMarketplaceService.decideDispute(id, adminId, body || {});
  }

  @Get('projects/:id/escrow')
  @Roles('admin', 'superuser')
  @ApiOperation({ summary: 'Admin inspects project escrow held, released, refunded, platform fee, and disputes' })
  @ApiOkResponse({ description: 'Project escrow breakdown and reconciled totals returned.' })
  getProjectEscrow(@Param('id') id: string) {
    return this.mentorMarketplaceService.getProjectEscrowSummary(id);
  }

  @Post('projects/:id/restore')
  @Roles('admin', 'superuser')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore a soft-deleted project within 30 days of deletion (Admin and Super User)' })
  @ApiOkResponse({ description: 'Project restored successfully.' })
  restoreProject(
    @Param('id') id: string,
    @CurrentUser() caller?: any,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const adminId = isLegacy ? (headerUserId || 'admin') : (caller?.uid || caller?.id || 'admin');
    return this.projectsService.restoreProject(id, adminId);
  }
}

