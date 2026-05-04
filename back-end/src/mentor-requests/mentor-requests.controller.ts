import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateMentorRequestDto } from './dto/create-mentor-request.dto';
import { UpdateMentorRequestDto } from './dto/update-mentor-request.dto';
import { MentorRequestEntity } from './entities/mentor-request.entity';
import { MentorRequestsService } from './mentor-requests.service';

@ApiTags('Mentor Requests')
@ApiHeader({
  name: 'x-user-role',
  description: 'Role used by the RBAC guard',
  required: true,
  schema: { type: 'string', enum: ['admin', 'mentor', 'project-owner', 'collaborator', 'superuser'] },
})
@Controller('mentor-requests')
@UseGuards(RolesGuard)
export class MentorRequestsController {
  constructor(private readonly mentorRequestsService: MentorRequestsService) {}

  @Get()
  @Roles('admin', 'user')
  @ApiOperation({ summary: 'List mentor requests' })
  @ApiQuery({ name: 'projectId', required: false, description: 'Filter mentor requests by project ID' })
  @ApiQuery({ name: 'mentorId', required: false, description: 'Filter mentor requests by mentor ID or email' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter mentor requests by status' })
  @ApiOkResponse({ description: 'List of mentor requests returned successfully.', type: [MentorRequestEntity] })
  @ApiForbiddenResponse({ description: 'Forbidden - insufficient permissions' })
  getAll(
    @Query('projectId') projectId?: string,
    @Query('mentorId') mentorId?: string,
    @Query('status') status?: string,
  ): MentorRequestEntity[] {
    let requests = this.mentorRequestsService.findAll();

    if (projectId) {
      requests = requests.filter((request: MentorRequestEntity) => request.projectId === projectId);
    }
    if (mentorId) {
      requests = requests.filter((request: MentorRequestEntity) => request.mentorId === mentorId || request.mentorEmail === mentorId);
    }
    if (status) {
      requests = requests.filter((request: MentorRequestEntity) => request.status === status);
    }

    return requests;
  }

  @Get(':id')
  @Roles('admin', 'user')
  @ApiOperation({ summary: 'Get a mentor request by ID' })
  @ApiParam({ name: 'id', description: 'Mentor request ID', type: 'string' })
  @ApiOkResponse({ description: 'Mentor request returned successfully.', type: MentorRequestEntity })
  @ApiNotFoundResponse({ description: 'Mentor request not found.' })
  @ApiForbiddenResponse({ description: 'Forbidden - insufficient permissions' })
  getOne(@Param('id') id: string): MentorRequestEntity {
    try {
      return this.mentorRequestsService.findOne(id);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(`Mentor request with id ${id} not found`);
      }
      throw error;
    }
  }

  @Post()
  @Roles('admin', 'user')
  @ApiOperation({ summary: 'Create a new mentor request' })
  @ApiBody({ type: CreateMentorRequestDto })
  @ApiCreatedResponse({ description: 'Mentor request created successfully.', type: MentorRequestEntity })
  @ApiForbiddenResponse({ description: 'Forbidden - insufficient permissions' })
  create(@Body() createMentorRequestDto: CreateMentorRequestDto): MentorRequestEntity {
    return this.mentorRequestsService.create(createMentorRequestDto);
  }

  @Put(':id')
  @Roles('admin', 'user')
  @ApiOperation({ summary: 'Update a mentor request' })
  @ApiParam({ name: 'id', description: 'Mentor request ID', type: 'string' })
  @ApiBody({ type: UpdateMentorRequestDto })
  @ApiOkResponse({ description: 'Mentor request updated successfully.', type: MentorRequestEntity })
  @ApiNotFoundResponse({ description: 'Mentor request not found.' })
  @ApiForbiddenResponse({ description: 'Forbidden - insufficient permissions' })
  update(
    @Param('id') id: string,
    @Body() updateMentorRequestDto: UpdateMentorRequestDto,
  ): MentorRequestEntity {
    try {
      return this.mentorRequestsService.update(id, updateMentorRequestDto);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(`Mentor request with id ${id} not found`);
      }
      throw error;
    }
  }

  @Put(':id/accept')
  @Roles('admin', 'user')
  @ApiOperation({ summary: 'Accept a mentor request' })
  @ApiParam({ name: 'id', description: 'Mentor request ID', type: 'string' })
  @ApiOkResponse({ description: 'Mentor request accepted successfully.', type: MentorRequestEntity })
  @ApiNotFoundResponse({ description: 'Mentor request not found.' })
  @ApiForbiddenResponse({ description: 'Forbidden - insufficient permissions' })
  accept(@Param('id') id: string): MentorRequestEntity {
    return this.mentorRequestsService.accept(id);
  }

  @Put(':id/decline')
  @Roles('admin', 'user')
  @ApiOperation({ summary: 'Decline a mentor request' })
  @ApiParam({ name: 'id', description: 'Mentor request ID', type: 'string' })
  @ApiOkResponse({ description: 'Mentor request declined successfully.', type: MentorRequestEntity })
  @ApiNotFoundResponse({ description: 'Mentor request not found.' })
  @ApiForbiddenResponse({ description: 'Forbidden - insufficient permissions' })
  decline(@Param('id') id: string): MentorRequestEntity {
    return this.mentorRequestsService.decline(id);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete a mentor request (Admin only)' })
  @ApiParam({ name: 'id', description: 'Mentor request ID', type: 'string' })
  @ApiOkResponse({ description: 'Mentor request deleted successfully.' })
  @ApiNotFoundResponse({ description: 'Mentor request not found.' })
  @ApiForbiddenResponse({ description: 'Forbidden - admin role required' })
  remove(@Param('id') id: string): { message: string } {
    try {
      this.mentorRequestsService.remove(id);
      return { message: `Mentor request ${id} deleted successfully` };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(`Mentor request with id ${id} not found`);
      }
      throw error;
    }
  }
}
