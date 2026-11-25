import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Patch,
  Param,
  Delete,
  Headers,
  Query,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { Roles } from '../core/decorators/roles.decorator';

@ApiTags('Tasks')
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  private resolveCaller(authUser: any, headerUserId?: string, headerRole?: string) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveUserId = isLegacy ? headerUserId : (authUser?.uid || authUser?.id);
    const effectiveRole = isLegacy ? headerRole : (authUser?.role || authUser?.roleName);
    if (!effectiveUserId) {
      throw new UnauthorizedException('Authentication required.');
    }
    const uid = String(effectiveUserId);
    return {
      userId: uid,
      role: effectiveRole ? String(effectiveRole) : undefined,
      caller: {
        ...(authUser && typeof authUser === 'object' ? authUser : {}),
        uid,
        id: uid,
        role: effectiveRole,
      },
    };
  }

  @Get('project/:projectId')
  @ApiOperation({ summary: 'Get all tasks for a specific project (Project member or Admin/Super User)' })
  @ApiResponse({ status: 200, description: 'Returns an array of tasks.' })
  @ApiResponse({ status: 403, description: 'Forbidden (NOT_A_PROJECT_MEMBER).' })
  findAllByProjectId(
    @Param('projectId') projectId: string,
    @CurrentUser() authUser?: any,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-role') role?: string,
  ) {
    const { caller } = this.resolveCaller(authUser, userId, role);
    return this.tasksService.findAllByProjectId(projectId, caller);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a task by ID (Project member or Admin/Super User)' })
  @ApiResponse({ status: 200, description: 'Returns a single task.' })
  @ApiResponse({ status: 403, description: 'Forbidden (NOT_A_PROJECT_MEMBER).' })
  @ApiResponse({ status: 404, description: 'Task not found.' })
  findById(
    @Param('id') id: string,
    @Query('projectId') projectId?: string,
    @CurrentUser() authUser?: any,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-role') role?: string,
  ) {
    const { caller } = this.resolveCaller(authUser, userId, role);
    return this.tasksService.findById(id, caller, undefined, projectId);
  }

  @Post()
  @Roles('Project Owner', 'Collaborator', 'Mentor', 'Administrator', 'Super User')
  @ApiHeader({ name: 'x-user-role', description: 'User role for authorization', required: false })
  @ApiOperation({ summary: 'Create a new task (Project Owner or Admin/Super User)' })
  @ApiResponse({ status: 201, description: 'The task has been successfully created.' })
  @ApiResponse({ status: 400, description: 'Validation error / INVALID_INITIAL_STATUS / CONTENT_NOT_ALLOWED.' })
  @ApiResponse({ status: 403, description: 'Forbidden (NOT_A_PROJECT_MEMBER).' })
  create(
    @Body() createTaskDto: CreateTaskDto,
    @CurrentUser() authUser?: any,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-role') role?: string,
  ) {
    const { caller, role: effectiveRole } = this.resolveCaller(authUser, userId, role);
    return this.tasksService.create(createTaskDto, caller, effectiveRole, { enforceInitialStatus: true });
  }

  @Patch(':id')
  @Roles('Project Owner', 'Collaborator', 'Mentor', 'Administrator', 'Super User')
  @ApiHeader({ name: 'x-user-role', description: 'User role for authorization', required: false })
  @ApiOperation({ summary: 'Update a task' })
  @ApiResponse({ status: 200, description: 'The task has been successfully updated.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Task not found.' })
  update(
    @Param('id') id: string,
    @Body() updateTaskDto: UpdateTaskDto,
    @Query('projectId') queryProjectId?: string,
    @CurrentUser() authUser?: any,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-role') role?: string,
  ) {
    const { caller, role: effectiveRole } = this.resolveCaller(authUser, userId, role);
    return this.tasksService.update(id, updateTaskDto, caller, effectiveRole, queryProjectId);
  }

  @Put(':id')
  @Roles('Project Owner', 'Collaborator', 'Mentor', 'Administrator', 'Super User')
  updatePut(
    @Param('id') id: string,
    @Body() updateTaskDto: UpdateTaskDto,
    @Query('projectId') queryProjectId?: string,
    @CurrentUser() authUser?: any,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-role') role?: string,
  ) {
    return this.update(id, updateTaskDto, queryProjectId, authUser, userId, role);
  }

  /**
   * Dedicated status transition endpoint.
   *
   * Accepts a canonical/aliased `status` string.
   */
  @Patch(':id/status')
  @Roles('Project Owner', 'Collaborator', 'Mentor', 'Administrator', 'Super User')
  @ApiHeader({ name: 'x-user-role', description: 'User role for authorization', required: false })
  @ApiOperation({ summary: 'Update a task status' })
  @ApiResponse({ status: 200, description: 'The task status has been updated.' })
  @ApiResponse({ status: 400, description: 'Invalid status value.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Task not found.' })
  updateStatus(
    @Param('id') id: string,
    @Body() updateTaskStatusDto: UpdateTaskStatusDto,
    @Query('projectId') queryProjectId?: string,
    @CurrentUser() authUser?: any,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-role') role?: string,
  ) {
    const { caller, role: effectiveRole } = this.resolveCaller(authUser, userId, role);
    return this.tasksService.updateStatus(id, updateTaskStatusDto, caller, effectiveRole, queryProjectId);
  }

  @Put(':id/status')
  @Roles('Project Owner', 'Collaborator', 'Mentor', 'Administrator', 'Super User')
  updateStatusPut(
    @Param('id') id: string,
    @Body() updateTaskStatusDto: UpdateTaskStatusDto,
    @Query('projectId') queryProjectId?: string,
    @CurrentUser() authUser?: any,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-role') role?: string,
  ) {
    return this.updateStatus(id, updateTaskStatusDto, queryProjectId, authUser, userId, role);
  }

  @Post(':id/review')
  @Roles('Project Owner', 'Collaborator', 'Mentor', 'Administrator', 'Super User')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Review a submitted task (approve or reject with mandatory reason)' })
  reviewTask(
    @Param('id') id: string,
    @Body() body: {
      decision?: string;
      status?: string;
      reason?: string;
      rejectionReason?: string;
      projectId?: string;
      extendedProjectDueDate?: string;
      projectDueDate?: string;
      projectReason?: string;
      projectDeadlineReason?: string;
    },
    @Query('projectId') queryProjectId?: string,
    @CurrentUser() authUser?: any,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-role') role?: string,
  ) {
    const { caller, role: effectiveRole } = this.resolveCaller(authUser, userId, role);
    return this.tasksService.reviewTask(id, body, caller, effectiveRole, queryProjectId);
  }

  @Post(':id/unassign')
  @Roles('Project Owner', 'Collaborator', 'Mentor', 'Administrator', 'Super User')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Drop / unassign a task (requires feedback reason)' })
  unassignTask(
    @Param('id') id: string,
    @Body() body: any,
    @Query('projectId') queryProjectId?: string,
    @CurrentUser() authUser?: any,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-role') role?: string,
  ) {
    const { caller, role: effectiveRole } = this.resolveCaller(authUser, userId, role);
    return this.tasksService.unassignTask(
      id,
      body?.reason,
      caller,
      effectiveRole,
      queryProjectId ?? body?.projectId,
      body,
    );
  }

  @Post(':id/comments')
  @Roles('Project Owner', 'Collaborator', 'Mentor', 'Administrator', 'Super User')
  @ApiOperation({ summary: 'Add a comment to a task' })
  addComment(
    @Param('id') id: string,
    @Body() body: { text?: string; comment?: string; message?: string; projectId?: string },
    @Query('projectId') queryProjectId?: string,
    @CurrentUser() authUser?: any,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-role') role?: string,
  ) {
    const { caller, role: effectiveRole } = this.resolveCaller(authUser, userId, role);
    const text = body?.text || body?.comment || body?.message || '';
    return this.tasksService.addComment(
      id,
      text,
      caller,
      effectiveRole,
      queryProjectId ?? body?.projectId,
    );
  }

  @Delete(':id')
  @Roles('Project Owner', 'Collaborator', 'Mentor', 'Administrator', 'Super User')
  @ApiHeader({ name: 'x-user-role', description: 'User role for authorization', required: false })
  @ApiOperation({ summary: 'Delete a task (Project Owner or Admin/Super User)' })
  @ApiResponse({ status: 200, description: 'The task has been successfully deleted.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Task not found.' })
  delete(
    @Param('id') id: string,
    @Query('projectId') queryProjectId?: string,
    @Body() body?: { projectId?: string },
    @CurrentUser() authUser?: any,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-role') role?: string,
  ) {
    const { caller, role: effectiveRole } = this.resolveCaller(authUser, userId, role);
    return this.tasksService.delete(id, caller, effectiveRole, queryProjectId ?? body?.projectId);
  }
}
