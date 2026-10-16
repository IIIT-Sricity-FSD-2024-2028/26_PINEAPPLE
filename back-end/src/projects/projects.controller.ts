import { Controller, Get, Post, Body, Patch, Param, Delete, Headers, Query, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { Roles } from '../core/decorators/roles.decorator';

@ApiTags('Projects')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all projects' })
  @ApiResponse({ status: 200, description: 'Returns an array of projects.' })
  findAll(
    @Query('status') status?: string,
    @Query('isCompleted') isCompleted?: string,
  ) {
    return this.projectsService.findAll(status, isCompleted);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a project by ID' })
  @ApiResponse({ status: 200, description: 'Returns a single project.' })
  @ApiResponse({ status: 404, description: 'Project not found.' })
  findById(@Param('id') id: string) {
    return this.projectsService.findById(id);
  }

  @Get('owner/:ownerId')
  @ApiOperation({ summary: 'Get projects by Owner ID' })
  @ApiResponse({ status: 200, description: 'Returns an array of projects belonging to the owner.' })
  findByOwnerId(@Param('ownerId') ownerId: string) {
    return this.projectsService.findByOwnerId(ownerId);
  }

  @Post()
  @Roles('Project Owner', 'Administrator')
  @ApiOperation({ summary: 'Create a new project (Requires Project Owner or Administrator)' })
  @ApiHeader({ name: 'x-user-id', description: 'ID of the user creating the project', required: true })
  @ApiHeader({ name: 'x-user-role', description: 'User role for authorization', required: true })
  @ApiResponse({ status: 201, description: 'The project has been successfully created.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  create(
    @Headers('x-user-id') ownerId: string,
    @Body() createProjectDto: CreateProjectDto,
  ) {
    console.log('📥 Received project creation request:');
    console.log('   Owner ID:', ownerId);
    console.log('   Project Data:', JSON.stringify(createProjectDto, null, 2));
    const effectiveOwnerId = ownerId || createProjectDto.ownerId;
    if (!effectiveOwnerId) {
      throw new UnauthorizedException('x-user-id header is missing.');
    }
    return this.projectsService.create(effectiveOwnerId, createProjectDto);
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
    @Headers('x-user-id') userId?: string,
  ) {
    return this.projectsService.update(id, updateProjectDto, userId);
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
    @Headers('x-user-id') userId: string,
  ) {
    const link = body?.finalLink || body?.finishedLink || body?.projectLink;
    return this.projectsService.completeProject(id, userId, link);
  }

  @Post(':id/publish')
  @Roles('Project Owner', 'Administrator')
  publish(
    @Param('id') id: string,
    @Body() body: { finalLink?: string; finishedLink?: string; projectLink?: string },
    @Headers('x-user-id') userId: string,
  ) {
    return this.complete(id, body, userId);
  }

  @Post(':id/leave')
  @ApiHeader({ name: 'x-user-role', description: 'User role for authorization', required: true })
  @ApiHeader({ name: 'x-user-id', description: 'User ID leaving the project', required: true })
  @ApiOperation({ summary: 'Leave a project (Collaborator)' })
  @ApiResponse({ status: 200, description: 'Successfully left project.' })
  @ApiResponse({ status: 400, description: 'Project is locked or user cannot leave.' })
  @ApiResponse({ status: 403, description: 'Forbidden: A mentor cannot leave or be removed once a project has started.' })
  leave(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
    @Headers('x-user-role') role?: string,
  ) {
    if (!userId) {
      throw new UnauthorizedException('x-user-id header is missing.');
    }
    if (String(role || '').toLowerCase() === 'mentor') {
      throw new ForbiddenException('A mentor cannot leave or be removed once a project has started.');
    }
    return this.projectsService.leaveProject(id, userId);
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
    @Body() body: { reason?: string },
    @Query('reason') queryReason: string,
    @Headers('x-user-id') userId: string,
    @Headers('x-user-role') role: string,
  ) {
    const reason = body?.reason || queryReason;
    return this.projectsService.removeMember(id, memberId, reason, userId, role);
  }

  @Delete(':id')
  @Roles('Project Owner', 'Administrator')
  @ApiHeader({ name: 'x-user-role', description: 'User role for authorization', required: true })
  @ApiOperation({ summary: 'Delete a project (Requires Project Owner or Administrator)' })
  @ApiResponse({ status: 200, description: 'The project has been successfully deleted.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Project not found.' })
  delete(@Param('id') id: string) {
    return this.projectsService.delete(id);
  }
}
