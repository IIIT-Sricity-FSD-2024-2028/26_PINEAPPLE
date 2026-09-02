import { Controller, Get, Post, Body, Patch, Param, Delete, Headers, UnauthorizedException } from '@nestjs/common';
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
  findAll() {
    return this.projectsService.findAll();
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
    if (!ownerId) {
      throw new UnauthorizedException('x-user-id header is missing.');
    }
    return this.projectsService.create(ownerId, createProjectDto);
  }

  @Patch(':id')
  @Roles('Project Owner', 'Administrator')
  @ApiHeader({ name: 'x-user-role', description: 'User role for authorization', required: true })
  @ApiOperation({ summary: 'Update a project (Requires Project Owner or Administrator)' })
  @ApiResponse({ status: 200, description: 'The project has been successfully updated.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Project not found.' })
  update(@Param('id') id: string, @Body() updateProjectDto: UpdateProjectDto) {
    return this.projectsService.update(id, updateProjectDto);
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
