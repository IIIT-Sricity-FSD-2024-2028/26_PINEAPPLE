import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Headers,
  Query,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  Inject,
  forwardRef,
  Optional,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { ProjectInvitesService } from './invites.service';
import { TemplatesService } from './templates.service';
import { MentorMarketplaceService } from '../mentor-marketplace/mentor-marketplace.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { LeaveProjectDto } from './dto/leave-project.dto';
import { ChangeDeadlineDto } from './dto/change-deadline.dto';
import { ApplyTaskTemplatesDto } from './dto/apply-task-templates.dto';
import { Roles } from '../core/decorators/roles.decorator';
import { RolesGuard } from '../core/guards/roles.guard';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { normalizeRole } from '../common/utils/role.util';

import { LeaveRequestsService, LeaveRequestDto, RejectLeaveRequestDto } from './leave-requests.service';

@ApiTags('Projects')
@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    @Optional()
    @Inject(forwardRef(() => MentorMarketplaceService))
    private readonly mentorMarketplaceService?: MentorMarketplaceService,
    @Optional()
    private readonly invitesService?: ProjectInvitesService,
    @Optional()
    private readonly templatesService?: TemplatesService,
    @Optional()
    private readonly leaveRequestsService?: LeaveRequestsService,
  ) {}

  private resolveCaller(authUser: any, headerUserId?: string, headerRole?: string) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveUserId = isLegacy ? headerUserId : (authUser?.uid || authUser?.id);
    const effectiveRole = isLegacy ? headerRole : (authUser?.role || authUser?.roleName);
    if (!effectiveUserId) {
      throw new UnauthorizedException('Authentication required.');
    }
    return {
      userId: String(effectiveUserId),
      caller: authUser || { uid: effectiveUserId, id: effectiveUserId, role: effectiveRole },
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all projects' })
  @ApiResponse({ status: 200, description: 'Returns an array of projects.' })
  findAll(
    @Query('status') status?: string,
    @Query('isCompleted') isCompleted?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @CurrentUser() authUser?: any,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-role') headerRole?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveUserId = isLegacy ? userId : (authUser?.uid || authUser?.id);
    const effectiveRole = isLegacy ? headerRole : (authUser?.role || authUser?.roleName || headerRole);
    const includeDeleted = ['admin', 'superuser'].includes(normalizeRole(effectiveRole));
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    const offsetNum = offset ? parseInt(offset, 10) : undefined;
    return this.projectsService.findAll(status, isCompleted, limitNum, offsetNum, effectiveUserId, includeDeleted);
  }

  @Get('collaborator/:userId')
  @ApiOperation({ summary: 'Get collaborator projects split into ongoing and completed' })
  @ApiResponse({ status: 200, description: 'Returns ongoing and completed projects with exact counts.' })
  findCollaboratorWork(@Param('userId') userId: string) {
    return this.projectsService.findCollaboratorWork(userId);
  }

  @Get('my-work')
  @ApiOperation({ summary: 'Get caller collaborator projects' })
  @ApiResponse({ status: 200, description: 'Returns ongoing and completed projects with exact counts for current user.' })
  getMyWork(
    @CurrentUser() authUser: any,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveUserId = isLegacy ? headerUserId : (authUser?.uid || authUser?.id);
    if (!effectiveUserId) {
      throw new UnauthorizedException('Authentication required.');
    }
    return this.projectsService.findCollaboratorWork(effectiveUserId);
  }

  @Get(':id/my-request-status')
  @ApiOperation({ summary: 'Get current user join request status for a project' })
  @ApiResponse({ status: 200, description: 'Returns user request status for the project.' })
  getMyRequestStatus(
    @Param('id') id: string,
    @CurrentUser() authUser: any,
    @Headers('x-user-id') userId: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveUserId = isLegacy ? userId : (authUser?.uid || authUser?.id);
    if (!effectiveUserId) {
      throw new UnauthorizedException('Authentication required.');
    }
    return this.projectsService.getMyRequestStatus(id, effectiveUserId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a project by ID' })
  @ApiResponse({ status: 200, description: 'Returns a single project.' })
  @ApiResponse({ status: 404, description: 'Project not found.' })
  findById(
    @Param('id') id: string,
    @CurrentUser() authUser?: any,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-role') headerRole?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveUserId = isLegacy ? userId : (authUser?.uid || authUser?.id);
    const effectiveRole = isLegacy ? headerRole : (authUser?.role || authUser?.roleName || headerRole);
    const includeDeleted = ['admin', 'superuser'].includes(normalizeRole(effectiveRole));
    return this.projectsService.findById(id, effectiveUserId, { includeDeleted, role: effectiveRole });
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'Get single distinct project members list' })
  @ApiResponse({ status: 200, description: 'Return single distinct list of project members.' })
  @ApiResponse({ status: 404, description: 'Project not found.' })
  getMembers(
    @Param('id') id: string,
  ) {
    return this.projectsService.getProjectMembers(id);
  }

  @Get(':id/deletion-check')
  @Roles('Project Owner', 'Administrator', 'superuser', 'admin')
  @ApiOperation({ summary: 'Check if project can be deleted and evaluate notice/impact' })
  @ApiResponse({ status: 200, description: 'Deletion check evaluation result.' })
  checkDeletion(
    @Param('id') id: string,
    @CurrentUser() authUser: any,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-role') headerRole?: string,
  ) {
    const { userId: callerId, caller } = this.resolveCaller(authUser, userId, headerRole);
    return this.projectsService.checkDeletion(id, callerId, caller?.role || headerRole);
  }

  @Post(':id/cancel-deletion')
  @Roles('Project Owner', 'Administrator', 'superuser', 'admin')
  @ApiOperation({ summary: 'Cancel a scheduled project deletion' })
  @ApiResponse({ status: 200, description: 'Deletion cancelled and project restored.' })
  cancelDeletion(
    @Param('id') id: string,
    @CurrentUser() authUser: any,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-role') headerRole?: string,
  ) {
    const { userId: callerId, caller } = this.resolveCaller(authUser, userId, headerRole);
    return this.projectsService.cancelDeletion(id, callerId, caller?.role || headerRole);
  }

  @Delete(':id')
  @Roles('Project Owner', 'Administrator', 'superuser', 'admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete or schedule project deletion' })
  @ApiResponse({ status: 200, description: 'Project deletion executed or scheduled.' })
  softDeleteProject(
    @Param('id') id: string,
    @Body() body: any,
    @CurrentUser() authUser: any,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-role') headerRole?: string,
  ) {
    const { userId: callerId, caller } = this.resolveCaller(authUser, userId, headerRole);
    const proj = this.projectsService.getProjectRaw(id);
    const expectedTitle = String(proj?.title || proj?.name || '').trim();
    const confirmTitle = typeof body?.confirmTitle === 'string' ? body.confirmTitle.trim() : '';
    if (!confirmTitle || confirmTitle !== expectedTitle) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'TITLE_MISMATCH',
        message: 'Project title confirmation does not match.',
      });
    }
    return this.projectsService.softDeleteProject(id, callerId, caller?.role || headerRole, body);
  }

  @Get('owner/:ownerId')
  @ApiOperation({ summary: 'Get projects by Owner ID' })
  @ApiResponse({ status: 200, description: 'Returns an array of projects belonging to the owner.' })
  findByOwnerId(@Param('ownerId') ownerId: string) {
    return this.projectsService.findByOwnerId(ownerId);
  }

  @Post()
  @UseGuards(EmailVerifiedGuard)
  @Roles('Project Owner', 'Administrator')
  @ApiOperation({ summary: 'Create a new project (Requires Project Owner or Administrator)' })
  @ApiHeader({ name: 'x-user-id', description: 'ID of the user creating the project', required: true })
  @ApiHeader({ name: 'x-user-role', description: 'User role for authorization', required: true })
  @ApiResponse({ status: 201, description: 'The project has been successfully created.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  create(
    @CurrentUser('uid') authUid: string,
    @Headers('x-user-id') ownerId: string,
    @Body() createProjectDto: CreateProjectDto,
    @CurrentUser() authUser?: any,
    @Headers('x-user-role') headerRole?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveOwnerId = isLegacy ? (ownerId || createProjectDto.ownerId) : authUid;
    if (!effectiveOwnerId) {
      throw new UnauthorizedException('Authentication required.');
    }
    const effectiveRole = isLegacy ? headerRole : (authUser?.role || authUser?.roleName || headerRole);
    return this.projectsService.createWithStarterTasks(
      effectiveOwnerId,
      createProjectDto,
      authUser,
      effectiveRole,
    );
  }

  @Patch(':id')
  @Roles('Project Owner', 'Administrator')
  @ApiHeader({ name: 'x-user-role', description: 'User role for authorization', required: true })
  @ApiHeader({ name: 'x-user-id', description: 'User ID for authorization', required: false })
  @ApiOperation({ summary: 'Update a project (Requires Project Owner or Administrator)' })
  @ApiResponse({ status: 200, description: 'The project has been successfully updated.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Project not found.' })
  update(
    @Param('id') id: string,
    @Body() updateProjectDto: UpdateProjectDto,
    @CurrentUser('uid') authUid?: string,
    @Headers('x-user-id') userId?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveUserId = isLegacy ? userId : authUid;
    return this.projectsService.update(id, updateProjectDto, effectiveUserId);
  }

  @Post(':id/complete')
  @Roles('Project Owner', 'Administrator')
  @ApiHeader({ name: 'x-user-role', description: 'User role for authorization', required: true })
  @ApiHeader({ name: 'x-user-id', description: 'ID of the owner completing the project', required: true })
  @ApiOperation({ summary: 'Complete a project by publishing the final link (Owner only)' })
  @ApiResponse({ status: 200, description: 'Project marked completed and locked.' })
  @ApiResponse({ status: 400, description: 'Validation failed: unapproved tasks, invalid link, or already locked.' })
  @ApiResponse({ status: 403, description: 'Forbidden: only owner can complete project.' })
  complete(
    @Param('id') id: string,
    @Body() body: { finalLink?: string; finishedLink?: string; projectLink?: string },
    @CurrentUser('uid') authUid: string,
    @Headers('x-user-id') userId: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveUserId = isLegacy ? userId : authUid;
    const link = body?.finalLink || body?.finishedLink || body?.projectLink;
    return this.projectsService.completeProject(id, effectiveUserId, link);
  }

  @Post(':id/leave')
  @ApiHeader({ name: 'x-user-role', description: 'User role for authorization', required: true })
  @ApiHeader({ name: 'x-user-id', description: 'User ID leaving the project', required: true })
  @ApiOperation({ summary: 'Leave a project (Collaborator)' })
  @ApiResponse({ status: 200, description: 'Successfully left project.' })
  @ApiResponse({ status: 400, description: 'REASON_REQUIRED: Category and 10+ char reason required.' })
  @ApiResponse({ status: 403, description: 'Forbidden: OWNER_CANNOT_LEAVE, MENTOR_CANNOT_LEAVE, or NOT_A_MEMBER.' })
  @ApiResponse({ status: 409, description: 'Conflict: PROJECT_LOCKED.' })
  leave(
    @Param('id') id: string,
    @Body() dto: LeaveProjectDto,
    @CurrentUser() authUser: any,
    @Headers('x-user-id') userId: string,
    @Headers('x-user-role') role?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveUserId = isLegacy ? userId : (authUser?.uid || authUser?.id);
    const effectiveRole = isLegacy ? role : (authUser?.role || authUser?.roleName);
    if (!effectiveUserId) {
      throw new UnauthorizedException('Authentication required.');
    }
    return this.projectsService.leaveProject(id, effectiveUserId, dto, effectiveRole);
  }

  @Post(':id/leave-requests')
  @ApiOperation({ summary: 'Submit a leave request for project owner approval' })
  @ApiResponse({ status: 201, description: 'Leave request created and pending owner approval.' })
  @ApiResponse({ status: 400, description: 'REASON_REQUIRED: reasons or explanation invalid.' })
  @ApiResponse({ status: 403, description: 'Forbidden: OWNER_CANNOT_LEAVE, MENTOR_CANNOT_LEAVE, or NOT_A_MEMBER.' })
  @ApiResponse({ status: 409, description: 'Conflict: LEAVE_REQUEST_PENDING or LEAVE_REQUEST_COOLDOWN.' })
  createLeaveRequest(
    @Param('id') id: string,
    @Body() dto: LeaveRequestDto,
    @CurrentUser() authUser: any,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveUserId = isLegacy ? headerUserId : (authUser?.uid || authUser?.id);
    if (!effectiveUserId) {
      throw new UnauthorizedException('Authentication required.');
    }
    return this.leaveRequestsService!.createRequest(id, effectiveUserId, dto);
  }

  @Get(':id/leave-requests/mine')
  @ApiOperation({ summary: 'Get current user leave request for project' })
  getMyLeaveRequest(
    @Param('id') id: string,
    @CurrentUser() authUser: any,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveUserId = isLegacy ? headerUserId : (authUser?.uid || authUser?.id);
    if (!effectiveUserId) {
      throw new UnauthorizedException('Authentication required.');
    }
    return this.leaveRequestsService!.getMyRequest(id, effectiveUserId);
  }

  @Delete(':id/leave-requests/mine')
  @ApiOperation({ summary: 'Withdraw pending leave request' })
  withdrawLeaveRequest(
    @Param('id') id: string,
    @CurrentUser() authUser: any,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveUserId = isLegacy ? headerUserId : (authUser?.uid || authUser?.id);
    if (!effectiveUserId) {
      throw new UnauthorizedException('Authentication required.');
    }
    return this.leaveRequestsService!.withdrawRequest(id, effectiveUserId);
  }

  @Get(':id/leave-requests')
  @ApiOperation({ summary: 'List leave requests with task summary (Owner only)' })
  listLeaveRequests(
    @Param('id') id: string,
    @CurrentUser() authUser: any,
    @Headers('x-user-id') headerUserId?: string,
    @Headers('x-user-role') headerRole?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveUserId = isLegacy ? headerUserId : (authUser?.uid || authUser?.id);
    const effectiveRole = isLegacy ? headerRole : (authUser?.role || authUser?.roleName);
    if (!effectiveUserId) {
      throw new UnauthorizedException('Authentication required.');
    }
    return this.leaveRequestsService!.listRequestsForProject(id, effectiveUserId, effectiveRole);
  }

  @Post(':id/leave-requests/:requestId/approve')
  @ApiOperation({ summary: 'Approve a leave request (Owner only)' })
  approveLeaveRequest(
    @Param('id') id: string,
    @Param('requestId') requestId: string,
    @CurrentUser() authUser: any,
    @Headers('x-user-id') headerUserId?: string,
    @Headers('x-user-role') headerRole?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveUserId = isLegacy ? headerUserId : (authUser?.uid || authUser?.id);
    const effectiveRole = isLegacy ? headerRole : (authUser?.role || authUser?.roleName);
    if (!effectiveUserId) {
      throw new UnauthorizedException('Authentication required.');
    }
    return this.leaveRequestsService!.approveRequest(requestId, effectiveUserId, effectiveRole);
  }

  @Post(':id/leave-requests/:requestId/reject')
  @ApiOperation({ summary: 'Reject a leave request (Owner only, 24h cooldown begins)' })
  rejectLeaveRequest(
    @Param('id') id: string,
    @Param('requestId') requestId: string,
    @Body() dto: RejectLeaveRequestDto,
    @CurrentUser() authUser: any,
    @Headers('x-user-id') headerUserId?: string,
    @Headers('x-user-role') headerRole?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveUserId = isLegacy ? headerUserId : (authUser?.uid || authUser?.id);
    const effectiveRole = isLegacy ? headerRole : (authUser?.role || authUser?.roleName);
    if (!effectiveUserId) {
      throw new UnauthorizedException('Authentication required.');
    }
    return this.leaveRequestsService!.rejectRequest(requestId, effectiveUserId, effectiveRole, dto);
  }

  @Get(':id/members/:userId/removal-check')
  @Roles('Project Owner', 'Administrator', 'admin', 'superuser')
  @ApiOperation({ summary: 'Pre-check if a collaborator can be removed based on submitted tasks' })
  @ApiResponse({ status: 200, description: 'Pre-check evaluation result.' })
  @ApiResponse({ status: 403, description: 'Forbidden: only project owner or admin can check removal.' })
  @ApiResponse({ status: 404, description: 'MEMBER_NOT_FOUND or project not found.' })
  getRemovalCheck(
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
    @CurrentUser() authUser: any,
    @Headers('x-user-id') headerUserId?: string,
    @Headers('x-user-role') headerRole?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveUserId = isLegacy ? headerUserId : (authUser?.uid || authUser?.id);
    const effectiveRole = isLegacy ? headerRole : (authUser?.role || authUser?.roleName);
    const callerUser = authUser || { uid: effectiveUserId, id: effectiveUserId, role: effectiveRole };
    return this.projectsService.getRemovalCheck(id, targetUserId, callerUser, effectiveRole);
  }

  @Delete(':id/members/:memberId')
  @Roles('Project Owner', 'Administrator')
  @ApiHeader({ name: 'x-user-role', description: 'User role for authorization', required: true })
  @ApiHeader({ name: 'x-user-id', description: 'Owner ID removing member', required: true })
  @ApiOperation({ summary: 'Remove a member from the project (requires >= 10 char reason)' })
  @ApiResponse({ status: 200, description: 'Member removed, unapproved tasks reset, reason recorded.' })
  @ApiResponse({ status: 400, description: 'Project is locked or reason is under 10 characters.' })
  @ApiResponse({ status: 403, description: 'Forbidden: only owner can remove member.' })
  removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() body: any,
    @Query('reason') queryReason: string,
    @CurrentUser() authUser: any,
    @Headers('x-user-id') userId: string,
    @Headers('x-user-role') role: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveUserId = isLegacy ? userId : (authUser?.uid || authUser?.id);
    const effectiveRole = isLegacy ? role : authUser?.role;
    const reason = body?.reason || queryReason;
    const callerUser = authUser || { uid: effectiveUserId, id: effectiveUserId, role: effectiveRole };
    return this.projectsService.removeMember(id, memberId, reason, callerUser, effectiveRole, body);
  }

  @Patch(':id/deadline')
  @ApiOperation({ summary: 'Owner changes project deadline' })
  @ApiResponse({ status: 200, description: 'Project deadline updated successfully.' })
  @ApiResponse({ status: 400, description: 'REASON_REQUIRED, DEADLINE_NOT_FUTURE, or DEADLINE_BEFORE_TASKS.' })
  @ApiResponse({ status: 403, description: 'FORBIDDEN: only project owner can change project deadline.' })
  @ApiResponse({ status: 409, description: 'PROJECT_LOCKED: project completed or closed.' })
  changeDeadline(
    @Param('id') id: string,
    @Body() dto: ChangeDeadlineDto,
    @CurrentUser() authUser: any,
    @Headers('x-user-id') userId: string,
    @Headers('x-user-role') role: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveUserId = isLegacy ? userId : (authUser?.uid || authUser?.id);
    const effectiveRole = isLegacy ? role : authUser?.role;
    const callerUser = authUser || { uid: effectiveUserId, id: effectiveUserId, role: effectiveRole };
    return this.projectsService.changeDeadline(id, dto, callerUser, effectiveRole);
  }

  @Post(':id/members/:userId/release-tasks')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Release Open & In Progress tasks assigned to a member (Owner or Admin)' })
  @ApiResponse({ status: 200, description: 'Tasks released back to Unassigned and Open.' })
  @ApiResponse({ status: 403, description: 'Forbidden: caller is not owner or admin.' })
  @ApiResponse({ status: 409, description: 'NOTHING_TO_RELEASE when no releasable tasks exist.' })
  releaseMemberTasks(
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
    @CurrentUser() authUser: any,
    @Headers('x-user-id') headerUserId?: string,
    @Headers('x-user-role') headerRole?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveUserId = isLegacy ? headerUserId : (authUser?.uid || authUser?.id);
    const effectiveRole = isLegacy ? headerRole : (authUser?.role || authUser?.roleName);
    if (!effectiveUserId && !authUser) {
      throw new UnauthorizedException('Authentication required.');
    }
    const callerUser = authUser || { uid: effectiveUserId, id: effectiveUserId, role: effectiveRole };
    return this.projectsService.releaseMemberTasks(id, targetUserId, callerUser, effectiveRole);
  }

  @Post(':id/request-close')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Active collaborator requests admin closure for 30-day inactive owner' })
  @ApiResponse({ status: 200, description: 'Closure request created in support queue.' })
  @ApiResponse({ status: 403, description: 'Forbidden: caller is not an active collaborator.' })
  @ApiResponse({ status: 409, description: 'NOT_ELIGIBLE if 30-day inactivity flag is not set.' })
  requestClose(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @CurrentUser() authUser: any,
    @Headers('x-user-id') headerUserId?: string,
    @Headers('x-user-role') headerRole?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveUserId = isLegacy ? headerUserId : (authUser?.uid || authUser?.id);
    const effectiveRole = isLegacy ? headerRole : (authUser?.role || authUser?.roleName);
    if (!effectiveUserId && !authUser) {
      throw new UnauthorizedException('Authentication required.');
    }
    const callerUser = authUser || { uid: effectiveUserId, id: effectiveUserId, role: effectiveRole };
    return this.projectsService.requestProjectClose(id, callerUser, body?.reason);
  }

  @Post(':id/close')
  @Roles('admin', 'superuser', 'Administrator')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Close a project administratively (Admin/Super User only)' })
  @ApiResponse({ status: 200, description: 'Project closed successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin role required.' })
  closeProjectAdmin(
    @Param('id') id: string,
    @Body() body: any,
    @CurrentUser() authUser: any,
  ) {
    const reason = (body?.reason || '').trim() || 'Owner inactive';
    const actor = authUser?.email || authUser?.name || authUser?.uid || 'Admin';
    return this.projectsService.closeProject(id, reason, actor, undefined, body);
  }

  @Post(':id/mentor/abandonment-review')
  @ApiOperation({ summary: 'Open mentor abandonment review when mentor inactive >= 7 days (Project Owner only)' })
  @ApiResponse({ status: 201, description: 'Abandonment review opened with 48-hour confirmation deadline.' })
  @ApiResponse({ status: 403, description: 'Forbidden - project owner only.' })
  @ApiResponse({ status: 409, description: 'MENTOR_STILL_ACTIVE, REVIEW_ALREADY_OPEN, or REVIEW_COOLDOWN.' })
  openMentorAbandonmentReview(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @CurrentUser() authUser: any,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveUserId = isLegacy ? headerUserId : (authUser?.uid || authUser?.id);
    if (!effectiveUserId) {
      throw new UnauthorizedException('Authentication required.');
    }
    return this.mentorMarketplaceService!.openAbandonmentReview(id, effectiveUserId, body?.reason);
  }

  @Get(':id/mentor/abandonment-review')
  @ApiOperation({ summary: 'Get mentor abandonment review and activity summary (Owner, Assigned Mentor, Admin)' })
  @ApiResponse({ status: 200, description: 'Current review and activity summary returned.' })
  @ApiResponse({ status: 403, description: 'Forbidden for collaborators or non-members.' })
  getMentorAbandonmentReview(
    @Param('id') id: string,
    @CurrentUser() authUser: any,
    @Headers('x-user-id') headerUserId?: string,
    @Headers('x-user-role') headerRole?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveUserId = isLegacy ? headerUserId : (authUser?.uid || authUser?.id);
    const effectiveRole = isLegacy ? headerRole : (authUser?.role || authUser?.roleName);
    if (!effectiveUserId) {
      throw new UnauthorizedException('Authentication required.');
    }
    return this.mentorMarketplaceService!.getAbandonmentReviewForProject(id, effectiveUserId, effectiveRole);
  }

  @Get(':id/match')
  @ApiOperation({ summary: 'Compute skill-match percentage and missing skills for current user' })
  @ApiResponse({ status: 200, description: 'Returns { percent, shared, missing } (percent is null when project lists no skills).' })
  getSkillMatch(
    @Param('id') id: string,
    @CurrentUser() authUser: any,
    @Headers('x-user-id') headerUserId?: string,
    @Headers('x-user-role') headerRole?: string,
  ) {
    const { userId } = this.resolveCaller(authUser, headerUserId, headerRole);
    return this.projectsService.getSkillMatchForProject(id, userId);
  }

  @Post(':id/invites')
  @ApiOperation({ summary: 'Send a direct project invitation by username (Project Owner only)' })
  @ApiResponse({ status: 201, description: 'Invite created and notification sent.' })
  @ApiResponse({ status: 400, description: 'CANNOT_INVITE_SELF.' })
  @ApiResponse({ status: 404, description: 'USER_NOT_FOUND.' })
  @ApiResponse({ status: 409, description: 'ALREADY_MEMBER, INVITE_ALREADY_PENDING, INVITE_LIMIT, USER_SUSPENDED, REINVITE_COOLDOWN.' })
  sendInvite(
    @Param('id') id: string,
    @Body() body: { username?: string; message?: string },
    @CurrentUser() authUser: any,
    @Headers('x-user-id') headerUserId?: string,
    @Headers('x-user-role') headerRole?: string,
  ) {
    const { caller } = this.resolveCaller(authUser, headerUserId, headerRole);
    return this.invitesService!.sendInvite(id, String(body?.username || ''), caller, body?.message);
  }

  @Get(':id/invites')
  @ApiOperation({ summary: 'List invites sent for a project (Project Owner or Admin)' })
  @ApiResponse({ status: 200, description: 'List of project invites returned.' })
  listProjectInvites(
    @Param('id') id: string,
    @CurrentUser() authUser: any,
    @Headers('x-user-id') headerUserId?: string,
    @Headers('x-user-role') headerRole?: string,
  ) {
    const { caller } = this.resolveCaller(authUser, headerUserId, headerRole);
    return this.invitesService!.listForProject(id, caller);
  }

  @Delete(':id/invites/:inviteId')
  @ApiOperation({ summary: 'Cancel a pending project invitation (Project Owner only)' })
  @ApiResponse({ status: 200, description: 'Invite cancelled.' })
  cancelInvite(
    @Param('id') id: string,
    @Param('inviteId') inviteId: string,
    @Body() body: any,
    @CurrentUser() authUser: any,
    @Headers('x-user-id') headerUserId?: string,
    @Headers('x-user-role') headerRole?: string,
  ) {
    const { caller } = this.resolveCaller(authUser, headerUserId, headerRole);
    return this.invitesService!.cancelInvite(id, inviteId, caller, body);
  }

  @Get(':id/task-templates')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Get starter task templates for a project category (Owner or Admin)' })
  @ApiResponse({ status: 200, description: 'Returns resolved category and template items.' })
  @ApiResponse({ status: 403, description: 'Forbidden: only owner or admin may view.' })
  @ApiResponse({ status: 404, description: 'Project not found.' })
  getProjectTaskTemplates(
    @Param('id') id: string,
    @CurrentUser() authUser: any,
    @Headers('x-user-id') headerUserId?: string,
    @Headers('x-user-role') headerRole?: string,
  ) {
    const { caller } = this.resolveCaller(authUser, headerUserId, headerRole);
    return this.templatesService!.getTemplatesForProject(id, caller, headerRole);
  }

  @Post(':id/task-templates/apply')
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Apply selected starter task templates to a project (Owner only)' })
  @ApiResponse({ status: 201, description: 'Returns created tasks and any skipped keys with reasons.' })
  @ApiResponse({ status: 403, description: 'Forbidden: owner only.' })
  @ApiResponse({ status: 404, description: 'Project not found.' })
  applyProjectTaskTemplates(
    @Param('id') id: string,
    @Body() dto: ApplyTaskTemplatesDto,
    @CurrentUser() authUser: any,
    @Headers('x-user-id') headerUserId?: string,
    @Headers('x-user-role') headerRole?: string,
  ) {
    const { caller } = this.resolveCaller(authUser, headerUserId, headerRole);
    return this.templatesService!.applyTemplatesForProject(id, caller, headerRole, dto);
  }
}
