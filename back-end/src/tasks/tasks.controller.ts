import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
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

  @Get('project/:projectId')
  @ApiOperation({ summary: 'Get all tasks for a specific project' })
  @ApiResponse({ status: 200, description: 'Returns an array of tasks.' })
  findAllByProjectId(@Param('projectId') projectId: string) {
    return this.tasksService.findAllByProjectId(projectId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a task by ID' })
  @ApiResponse({ status: 200, description: 'Returns a single task.' })
  @ApiResponse({ status: 404, description: 'Task not found.' })
  findById(@Param('id') id: string) {
    return this.tasksService.findById(id);
  }

  @Post()
  @Roles('Project Owner', 'Collaborator', 'Administrator')
  @ApiHeader({ name: 'x-user-role', description: 'User role for authorization', required: true })
  @ApiOperation({ summary: 'Create a new task' })
  @ApiResponse({ status: 201, description: 'The task has been successfully created.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  create(@Body() createTaskDto: CreateTaskDto) {
    return this.tasksService.create(createTaskDto);
  }

  @Patch(':id')
  @Roles('Project Owner', 'Collaborator', 'Administrator')
  @ApiHeader({ name: 'x-user-role', description: 'User role for authorization', required: true })
  @ApiOperation({ summary: 'Update a task' })
  @ApiResponse({ status: 200, description: 'The task has been successfully updated.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Task not found.' })
  update(@Param('id') id: string, @Body() updateTaskDto: UpdateTaskDto) {
    return this.tasksService.update(id, updateTaskDto);
  }

  /**
   * Kanban board endpoint — dedicated status transition.
   *
   * Accepts either a canonical/aliased `status` string or a Kanban
   * `column` key. Delegates to the same service path as the generic
   * PATCH so gamification (XP on completion) still runs unchanged.
   *
   * Existing PATCH /tasks/:id continues to work — this endpoint is
   * purely additive and does not affect any current workflow.
   */
  @Patch(':id/status')
  @Roles('Project Owner', 'Collaborator', 'Administrator')
  @ApiHeader({ name: 'x-user-role', description: 'User role for authorization', required: true })
  @ApiOperation({ summary: 'Move a task between Kanban columns (status transition)' })
  @ApiResponse({ status: 200, description: 'The task status has been updated.' })
  @ApiResponse({ status: 400, description: 'Invalid status or column value.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Task not found.' })
  updateStatus(
    @Param('id') id: string,
    @Body() updateTaskStatusDto: UpdateTaskStatusDto,
  ) {
    return this.tasksService.updateStatus(id, updateTaskStatusDto);
  }

  @Delete(':id')
  @Roles('Project Owner', 'Collaborator', 'Administrator')
  @ApiHeader({ name: 'x-user-role', description: 'User role for authorization', required: true })
  @ApiOperation({ summary: 'Delete a task' })
  @ApiResponse({ status: 200, description: 'The task has been successfully deleted.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Task not found.' })
  delete(@Param('id') id: string) {
    return this.tasksService.delete(id);
  }
}
