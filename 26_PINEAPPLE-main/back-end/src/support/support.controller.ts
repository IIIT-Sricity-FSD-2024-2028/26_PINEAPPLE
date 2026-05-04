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
import { CreateSupportRequestDto } from './dto/create-support-request.dto';
import { UpdateSupportStatusDto } from './dto/update-support-status.dto';
import { SupportRequestEntity } from './entities/support-request.entity';
import { SupportService } from './support.service';

@ApiTags('Support')
@ApiHeader({
  name: 'x-user-role',
  description: 'User role for RBAC authorization',
  required: true,
  schema: { type: 'string', enum: ['admin', 'project-owner', 'collaborator', 'mentor', 'superuser', 'user'] },
})
@ApiHeader({
  name: 'x-user-id',
  description: 'Optional user ID for access control and request ownership',
  required: false,
  schema: { type: 'string' },
})
@ApiHeader({
  name: 'x-user-email',
  description: 'Optional user email for support request submissions',
  required: false,
  schema: { type: 'string' },
})
@Controller('support')
@UseGuards(RolesGuard)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  private isAdminRole(role: string): boolean {
    return ['admin', 'superuser'].includes(role?.toLowerCase());
  }

  private resolveRequesterId(role: string, queryUserId?: string, headerUserId?: string): string | null {
    if (this.isAdminRole(role)) {
      return null;
    }

    if (queryUserId && headerUserId && queryUserId !== headerUserId) {
      throw new ForbiddenException('Mismatched user identifiers. Use a single user ID for requester-scoped access.');
    }

    const effectiveUserId = queryUserId || headerUserId;
    if (!effectiveUserId) {
      throw new ForbiddenException('Requester access requires x-user-id header or userId query parameter.');
    }

    return effectiveUserId;
  }

  @Get()
  @Roles('admin', 'superuser', 'user', 'project-owner', 'collaborator', 'mentor')
  @ApiOperation({ summary: 'List support tickets' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter support tickets by status' })
  @ApiQuery({ name: 'userId', required: false, description: 'Filter support tickets by user ID (owner-scoped access)' })
  @ApiOkResponse({ description: 'Support tickets returned successfully.', type: [SupportRequestEntity] })
  @ApiForbiddenResponse({ description: 'Forbidden - insufficient permissions or missing requester identification' })
  getAll(
    @Headers('x-user-role') xUserRole: string,
    @Headers('x-user-id') xUserId?: string,
    @Query('status') status?: string,
    @Query('userId') userId?: string,
  ): SupportRequestEntity[] {
    let tickets = this.supportService.findAll();

    if (status) {
      tickets = tickets.filter((ticket: SupportRequestEntity) => ticket.status === status);
    }

    const requesterId = this.resolveRequesterId(xUserRole, userId, xUserId);
    if (requesterId) {
      tickets = tickets.filter((ticket: SupportRequestEntity) => ticket.userId === requesterId);
    }

    return tickets;
  }

  @Get(':id')
  @Roles('admin', 'superuser', 'user', 'project-owner', 'collaborator', 'mentor')
  @ApiOperation({ summary: 'Get a specific support ticket by ID' })
  @ApiParam({ name: 'id', description: 'Support ticket ID' })
  @ApiOkResponse({ description: 'Support ticket returned successfully.', type: SupportRequestEntity })
  @ApiNotFoundResponse({ description: 'Support ticket not found' })
  @ApiForbiddenResponse({ description: 'Forbidden - insufficient permissions or not owner' })
  getOne(
    @Headers('x-user-role') xUserRole: string,
    @Headers('x-user-id') xUserId: string,
    @Param('id') id: string,
  ): SupportRequestEntity {
    const ticket = this.supportService.findOne(id);

    if (!this.isAdminRole(xUserRole) && ticket.userId !== xUserId) {
      throw new ForbiddenException('You can only access your own support ticket.');
    }

    return ticket;
  }

  @Post()
  @Roles('admin', 'project-owner', 'collaborator', 'mentor', 'superuser', 'user')
  @ApiOperation({ summary: 'Submit a new support ticket' })
  @ApiBody({ type: CreateSupportRequestDto })
  @ApiCreatedResponse({ description: 'Support ticket created successfully.', type: SupportRequestEntity })
  @ApiForbiddenResponse({ description: 'Forbidden - insufficient permissions' })
  create(
    @Body() createSupportRequestDto: CreateSupportRequestDto,
    @Headers('x-user-id') xUserId?: string,
    @Headers('x-user-email') xUserEmail?: string,
  ): SupportRequestEntity {
    return this.supportService.create({
      ...createSupportRequestDto,
      userId: xUserId || 'anonymous',
      from: xUserEmail || 'anonymous@local',
    });
  }

  @Put(':id/status')
  @Roles('admin', 'superuser')
  @ApiOperation({ summary: 'Update support ticket status (Admin only)' })
  @ApiParam({ name: 'id', description: 'Support ticket ID' })
  @ApiBody({ type: UpdateSupportStatusDto })
  @ApiOkResponse({ description: 'Support ticket status updated successfully.', type: SupportRequestEntity })
  @ApiNotFoundResponse({ description: 'Support ticket not found' })
  @ApiForbiddenResponse({ description: 'Forbidden - admin role required' })
  updateStatus(
    @Param('id') id: string,
    @Body() updateSupportStatusDto: UpdateSupportStatusDto,
  ): SupportRequestEntity {
    return this.supportService.updateStatus(id, updateSupportStatusDto);
  }

  @Delete(':id')
  @Roles('admin', 'superuser')
  @ApiOperation({ summary: 'Delete a support ticket (Admin only)' })
  @ApiParam({ name: 'id', description: 'Support ticket ID' })
  @ApiOkResponse({ description: 'Support ticket deleted successfully.', type: Object })
  @ApiNotFoundResponse({ description: 'Support ticket not found' })
  @ApiForbiddenResponse({ description: 'Forbidden - admin role required' })
  remove(@Param('id') id: string): { message: string } {
    this.supportService.remove(id);
    return { message: `Support ticket ${id} deleted successfully` };
  }
}
