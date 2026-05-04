import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  ForbiddenException,
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
import { CreateMentorApplicationDto } from './dto/create-mentor-application.dto';
import { UpdateMentorApplicationDto } from './dto/update-mentor-application.dto';
import { MentorApplicationEntity } from './entities/mentor-application.entity';
import { MentorApplicationsService } from './mentor-applications.service';

@ApiTags('Mentor Applications')
@ApiHeader({
  name: 'x-user-role',
  description: 'User role for RBAC authorization',
  required: true,
  schema: { type: 'string', enum: ['admin', 'project-owner', 'collaborator', 'mentor', 'superuser'] },
})
@ApiHeader({
  name: 'x-user-id',
  description: 'Optional user ID for applicant-scoped access',
  required: false,
  schema: { type: 'string' },
})
@Controller('mentor-applications')
@UseGuards(RolesGuard)
export class MentorApplicationsController {
  constructor(private readonly mentorApplicationsService: MentorApplicationsService) {}

  private isAdminRole(role: string): boolean {
    return ['admin', 'superuser'].includes(role.toLowerCase());
  }

  private resolveApplicantId(role: string, queryUserId?: string, headerUserId?: string): string | null {
    if (this.isAdminRole(role)) {
      return null;
    }

    if (queryUserId && headerUserId && queryUserId !== headerUserId) {
      throw new ForbiddenException('Mismatched user identifiers. Use a single user ID for applicant-scoped access.');
    }

    const effectiveUserId = queryUserId || headerUserId;
    if (!effectiveUserId) {
      throw new ForbiddenException('Applicant access requires x-user-id header or userId query parameter.');
    }

    return effectiveUserId;
  }

  @Get()
  @Roles('admin', 'project-owner', 'collaborator', 'mentor', 'superuser')
  @ApiOperation({ summary: 'List mentor applications' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter applications by status' })
  @ApiQuery({ name: 'userId', required: false, description: 'Filter applications by user ID (applicant-only)' })
  @ApiOkResponse({ description: 'List of mentor applications returned successfully.', type: [MentorApplicationEntity] })
  @ApiForbiddenResponse({ description: 'Forbidden - insufficient permissions or missing applicant identification' })
  getAll(
    @Headers('x-user-role') xUserRole: string,
    @Headers('x-user-id') xUserId?: string,
    @Query('status') status?: string,
    @Query('userId') userId?: string,
  ): MentorApplicationEntity[] {
    let applications = this.mentorApplicationsService.findAll();

    if (status) {
      applications = applications.filter((application: MentorApplicationEntity) => application.status === status);
    }

    const applicantId = this.resolveApplicantId(xUserRole, userId, xUserId);
    if (applicantId) {
      applications = applications.filter((application: MentorApplicationEntity) => application.userId === applicantId);
    }

    return applications;
  }

  @Get(':id')
  @Roles('admin', 'project-owner', 'collaborator', 'mentor', 'superuser')
  @ApiOperation({ summary: 'Get a specific mentor application by ID' })
  @ApiParam({ name: 'id', description: 'Mentor application ID' })
  @ApiOkResponse({ description: 'Mentor application returned successfully.', type: MentorApplicationEntity })
  @ApiNotFoundResponse({ description: 'Mentor application not found' })
  @ApiForbiddenResponse({ description: 'Forbidden - insufficient permissions or missing applicant identification' })
  getOne(
    @Headers('x-user-role') xUserRole: string,
    @Headers('x-user-id') xUserId: string,
    @Param('id') id: string,
  ): MentorApplicationEntity {
    const application = this.mentorApplicationsService.findOne(id);

    if (!this.isAdminRole(xUserRole) && application.userId !== xUserId) {
      throw new ForbiddenException('You can only access your own mentor application.');
    }

    return application;
  }

  @Post()
  @Roles('admin', 'project-owner', 'collaborator', 'mentor', 'superuser')
  @ApiOperation({ summary: 'Submit a new mentor application' })
  @ApiBody({ type: CreateMentorApplicationDto })
  @ApiCreatedResponse({ description: 'Mentor application submitted successfully.', type: MentorApplicationEntity })
  @ApiForbiddenResponse({ description: 'Forbidden - insufficient permissions' })
  create(@Body() createMentorApplicationDto: CreateMentorApplicationDto): MentorApplicationEntity {
    return this.mentorApplicationsService.create(createMentorApplicationDto);
  }

  @Put(':id')
  @Roles('admin', 'superuser')
  @ApiOperation({ summary: 'Update a mentor application (Admin only)' })
  @ApiParam({ name: 'id', description: 'Mentor application ID' })
  @ApiBody({ type: UpdateMentorApplicationDto })
  @ApiOkResponse({ description: 'Mentor application updated successfully.', type: MentorApplicationEntity })
  @ApiNotFoundResponse({ description: 'Mentor application not found' })
  @ApiForbiddenResponse({ description: 'Forbidden - admin role required' })
  update(
    @Param('id') id: string,
    @Body() updateMentorApplicationDto: UpdateMentorApplicationDto,
  ): MentorApplicationEntity {
    try {
      return this.mentorApplicationsService.update(id, updateMentorApplicationDto);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw error;
    }
  }

  @Put(':id/approve')
  @Roles('admin', 'superuser')
  @ApiOperation({ summary: 'Approve a mentor application and grant mentor role to the applicant' })
  @ApiParam({ name: 'id', description: 'Mentor application ID' })
  @ApiOkResponse({ description: 'Mentor application approved successfully.', type: MentorApplicationEntity })
  @ApiNotFoundResponse({ description: 'Mentor application not found' })
  @ApiForbiddenResponse({ description: 'Forbidden - admin role required' })
  approve(@Param('id') id: string): MentorApplicationEntity {
    return this.mentorApplicationsService.approve(id);
  }

  @Put(':id/reject')
  @Roles('admin', 'superuser')
  @ApiOperation({ summary: 'Reject a mentor application' })
  @ApiParam({ name: 'id', description: 'Mentor application ID' })
  @ApiOkResponse({ description: 'Mentor application rejected successfully.', type: MentorApplicationEntity })
  @ApiNotFoundResponse({ description: 'Mentor application not found' })
  @ApiForbiddenResponse({ description: 'Forbidden - admin role required' })
  reject(@Param('id') id: string): MentorApplicationEntity {
    return this.mentorApplicationsService.reject(id);
  }

  @Delete(':id')
  @Roles('admin', 'superuser')
  @ApiOperation({ summary: 'Delete a mentor application (Admin only)' })
  @ApiParam({ name: 'id', description: 'Mentor application ID' })
  @ApiOkResponse({ description: 'Mentor application deleted successfully.', type: Object })
  @ApiNotFoundResponse({ description: 'Mentor application not found' })
  @ApiForbiddenResponse({ description: 'Forbidden - admin role required' })
  remove(@Param('id') id: string): { message: string } {
    this.mentorApplicationsService.remove(id);
    return { message: `Mentor application ${id} deleted successfully` };
  }
}
