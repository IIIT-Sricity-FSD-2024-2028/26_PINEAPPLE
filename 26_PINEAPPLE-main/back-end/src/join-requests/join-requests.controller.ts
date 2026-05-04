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
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateJoinRequestDto } from './dto/create-join-request.dto';
import { UpdateJoinRequestDto } from './dto/update-join-request.dto';
import { JoinRequestEntity } from './entities/join-request.entity';
import { JoinRequestsService } from './join-requests.service';

@ApiTags('JoinRequests')
@ApiHeader({
  name: 'x-user-role',
  description: 'Role used by the RBAC guard',
  required: true,
  schema: { type: 'string', enum: ['admin', 'user'] },
})
@Controller('join-requests')
@UseGuards(RolesGuard)
export class JoinRequestsController {
  constructor(private readonly joinRequestsService: JoinRequestsService) {}

  @Get()
  @Roles('admin', 'user')
  @ApiOperation({ summary: 'List all join requests' })
  @ApiQuery({ name: 'projectId', required: false, description: 'Filter by project ID' })
  @ApiQuery({ name: 'userId', required: false, description: 'Filter by user ID' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status' })
  @ApiOkResponse({ description: 'List of join requests returned successfully.', type: [JoinRequestEntity] })
  @ApiForbiddenResponse({ description: 'Forbidden - Insufficient permissions' })
  getAll(
    @Query('projectId') projectId?: string,
    @Query('userId') userId?: string,
    @Query('status') status?: string,
  ): JoinRequestEntity[] {
    let requests = this.joinRequestsService.findAll();

    if (projectId) {
      requests = requests.filter((r: JoinRequestEntity) => r.projectId === projectId);
    }
    if (userId) {
      requests = requests.filter((r: JoinRequestEntity) => r.userId === userId);
    }
    if (status) {
      requests = requests.filter((r: JoinRequestEntity) => r.status === status);
    }

    return requests;
  }

  @Get(':id')
  @Roles('admin', 'user')
  @ApiOperation({ summary: 'Get a join request by ID' })
  @ApiParam({ name: 'id', description: 'Join request ID', type: 'string' })
  @ApiOkResponse({ description: 'Join request returned successfully.', type: JoinRequestEntity })
  @ApiNotFoundResponse({ description: 'Join request not found.' })
  @ApiForbiddenResponse({ description: 'Forbidden - Insufficient permissions' })
  getOne(@Param('id') id: string): JoinRequestEntity {
    try {
      return this.joinRequestsService.findOne(id);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(`Join request with id ${id} not found`);
      }
      throw error;
    }
  }

  @Post()
  @Roles('admin', 'user')
  @ApiOperation({ summary: 'Create a new join request' })
  @ApiBody({ type: CreateJoinRequestDto })
  @ApiCreatedResponse({ description: 'Join request created successfully.', type: JoinRequestEntity })
  @ApiForbiddenResponse({ description: 'Forbidden - Insufficient permissions' })
  create(@Body() createJoinRequestDto: CreateJoinRequestDto): JoinRequestEntity {
    return this.joinRequestsService.create(createJoinRequestDto);
  }

  @Put(':id')
  @Roles('admin', 'user')
  @ApiOperation({ summary: 'Update an existing join request' })
  @ApiParam({ name: 'id', description: 'Join request ID', type: 'string' })
  @ApiBody({ type: UpdateJoinRequestDto })
  @ApiOkResponse({ description: 'Join request updated successfully.', type: JoinRequestEntity })
  @ApiNotFoundResponse({ description: 'Join request not found.' })
  @ApiForbiddenResponse({ description: 'Forbidden - Insufficient permissions' })
  update(@Param('id') id: string, @Body() updateJoinRequestDto: UpdateJoinRequestDto): JoinRequestEntity {
    try {
      return this.joinRequestsService.update(id, updateJoinRequestDto);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(`Join request with id ${id} not found`);
      }
      throw error;
    }
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete a join request (Admin only)' })
  @ApiParam({ name: 'id', description: 'Join request ID', type: 'string' })
  @ApiOkResponse({ description: 'Join request deleted successfully.' })
  @ApiNotFoundResponse({ description: 'Join request not found.' })
  @ApiForbiddenResponse({ description: 'Forbidden - Admin role required' })
  remove(@Param('id') id: string): { message: string } {
    try {
      this.joinRequestsService.remove(id);
      return { message: `Join request ${id} deleted successfully` };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(`Join request with id ${id} not found`);
      }
      throw error;
    }
  }
}