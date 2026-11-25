import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Patch,
  Query,
  UseGuards,
  NotFoundException,
  ForbiddenException,
  Headers,
  Inject,
  forwardRef,
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
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { CreateJoinRequestDto } from './dto/create-join-request.dto';
import { UpdateJoinRequestDto } from './dto/update-join-request.dto';
import { JoinRequestEntity } from './entities/join-request.entity';
import { JoinRequestsService } from './join-requests.service';
import { ProjectsService } from '../projects/projects.service';

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
  constructor(
    private readonly joinRequestsService: JoinRequestsService,
    @Inject(forwardRef(() => ProjectsService))
    private readonly projectsService: any,
  ) {}

  @Get('mine')
  @Roles('admin', 'user')
  @ApiOperation({ summary: 'Get current user join requests with rejectionReason and requestsLeft' })
  getMyRequests(
    @CurrentUser() authUser: any,
    @Headers('x-user-id') userId: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveUserId = isLegacy ? userId : (authUser?.uid || authUser?.id);
    return this.joinRequestsService.findMyRequests(effectiveUserId);
  }

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
    @CurrentUser() authUser?: any,
    @Headers('x-user-id') headerUserId?: string,
    @Headers('x-user-role') headerUserRole?: string,
  ): any[] {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const callerId = isLegacy ? headerUserId : (authUser?.uid || authUser?.id);
    const callerRole = isLegacy ? headerUserRole : (authUser?.role || authUser?.roleName);
    const isAdmin =
      callerRole === 'admin' ||
      callerRole === 'superuser' ||
      authUser?.role === 'admin' ||
      authUser?.role === 'superuser' ||
      authUser?.isSuperUser;

    if (projectId) {
      const project = this.projectsService?.findById?.(projectId);
      if (!project) {
        throw new NotFoundException(`Project with ID ${projectId} not found`);
      }
      const isOwner = String(project.ownerId) === String(callerId);
      if (!isOwner && !isAdmin) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'Forbidden',
          code: 'FORBIDDEN',
          message: 'Only the project owner can view join requests for this project.',
        });
      }
      if (callerId) {
        this.joinRequestsService.markViewedForProject(projectId, callerId);
      }

      return this.joinRequestsService.findByProjectDetailed(projectId, status);
    }

    if (userId) {
      if (callerId && String(callerId) !== String(userId) && !isAdmin) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'Forbidden',
          code: 'FORBIDDEN',
          message: 'You can only view your own join requests.',
        });
      }
      let reqs = this.joinRequestsService.findByUser(userId);
      if (status) {
        reqs = reqs.filter((r) => String(r.status || '').toLowerCase() === String(status).toLowerCase());
      }
      return reqs;
    }

    if (isAdmin) {
      let reqs = this.joinRequestsService.findAll();
      if (status) {
        reqs = reqs.filter((r) => String(r.status || '').toLowerCase() === String(status).toLowerCase());
      }
      return reqs;
    }

    let reqs = this.joinRequestsService.findForCaller(callerId);
    if (status) {
      reqs = reqs.filter((r) => String(r.status || '').toLowerCase() === String(status).toLowerCase());
    }
    return reqs;
  }

  @Get(':id')
  @Roles('admin', 'user')
  @ApiOperation({ summary: 'Get a join request by ID' })
  @ApiParam({ name: 'id', description: 'Join request ID', type: 'string' })
  @ApiOkResponse({ description: 'Join request returned successfully.', type: JoinRequestEntity })
  @ApiNotFoundResponse({ description: 'Join request not found.' })
  @ApiForbiddenResponse({ description: 'Forbidden - Insufficient permissions' })
  getOne(
    @Param('id') id: string,
    @CurrentUser() authUser?: any,
    @Headers('x-user-id') headerUserId?: string,
  ): JoinRequestEntity {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const callerId = isLegacy ? headerUserId : (authUser?.uid || authUser?.id);
    try {
      if (callerId) {
        this.joinRequestsService.markViewedSingle(id, callerId);
      }
      return this.joinRequestsService.findOne(id);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(`Join request with id ${id} not found`);
      }
      throw error;
    }
  }

  @Post()
  @UseGuards(EmailVerifiedGuard)
  @Roles('admin', 'user')
  @ApiOperation({ summary: 'Create a new join request' })
  @ApiHeader({ name: 'x-user-id', description: 'ID of the user making the request', required: false })
  @ApiBody({ type: CreateJoinRequestDto })
  @ApiCreatedResponse({ description: 'Join request created successfully.', type: JoinRequestEntity })
  @ApiForbiddenResponse({ description: 'Forbidden - Insufficient permissions' })
  create(
    @CurrentUser('uid') authUid: string,
    @Headers('x-user-id') userId: string,
    @Body() createJoinRequestDto: CreateJoinRequestDto,
  ): JoinRequestEntity {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveUserId = isLegacy ? userId : authUid;
    return this.joinRequestsService.create(createJoinRequestDto, effectiveUserId);
  }

  @Put(':id')
  @Roles('admin', 'user')
  @ApiOperation({ summary: 'Update an existing join request' })
  @ApiParam({ name: 'id', description: 'Join request ID', type: 'string' })
  @ApiBody({ type: UpdateJoinRequestDto })
  @ApiOkResponse({ description: 'Join request updated successfully.', type: JoinRequestEntity })
  @ApiNotFoundResponse({ description: 'Join request not found.' })
  @ApiForbiddenResponse({ description: 'Forbidden - Insufficient permissions' })
  async update(
    @Param('id') id: string,
    @Body() updateJoinRequestDto: UpdateJoinRequestDto,
    @CurrentUser() authUser: any,
    @Headers('x-user-id') userId: string,
    @Headers('x-user-role') role: string,
  ): Promise<JoinRequestEntity> {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveUserId = isLegacy ? userId : (authUser?.uid || authUser?.id);
    const effectiveRole = isLegacy ? role : authUser?.role;
    const callerUser = authUser || { uid: effectiveUserId, id: effectiveUserId, role: effectiveRole };
    try {
      return await this.joinRequestsService.update(id, updateJoinRequestDto, callerUser);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(`Join request with id ${id} not found`);
      }
      throw error;
    }
  }

  @Patch(':id')
  @Roles('admin', 'user')
  @ApiOperation({ summary: 'Patch an existing join request' })
  @ApiParam({ name: 'id', description: 'Join request ID', type: 'string' })
  @ApiBody({ type: UpdateJoinRequestDto })
  async patch(
    @Param('id') id: string,
    @Body() updateJoinRequestDto: UpdateJoinRequestDto,
    @CurrentUser() authUser: any,
    @Headers('x-user-id') userId: string,
    @Headers('x-user-role') role: string,
  ): Promise<JoinRequestEntity> {
    return this.update(id, updateJoinRequestDto, authUser, userId, role);
  }

  @Put(':id/status')
  @Roles('admin', 'user')
  @ApiOperation({ summary: 'Update an existing join request status' })
  @ApiParam({ name: 'id', description: 'Join request ID', type: 'string' })
  @ApiBody({ type: UpdateJoinRequestDto })
  async updateStatus(
    @Param('id') id: string,
    @Body() updateJoinRequestDto: UpdateJoinRequestDto,
    @CurrentUser() authUser: any,
    @Headers('x-user-id') userId: string,
    @Headers('x-user-role') role: string,
  ): Promise<JoinRequestEntity> {
    return this.update(id, updateJoinRequestDto, authUser, userId, role);
  }

  @Patch(':id/status')
  @Roles('admin', 'user')
  @ApiOperation({ summary: 'Patch an existing join request status' })
  async patchStatus(
    @Param('id') id: string,
    @Body() updateJoinRequestDto: UpdateJoinRequestDto,
    @CurrentUser() authUser: any,
    @Headers('x-user-id') userId: string,
    @Headers('x-user-role') role: string,
  ): Promise<JoinRequestEntity> {
    return this.update(id, updateJoinRequestDto, authUser, userId, role);
  }

  @Delete(':id')
  @Roles('admin', 'user')
  @ApiOperation({ summary: 'Delete or withdraw a join request' })
  @ApiParam({ name: 'id', description: 'Join request ID', type: 'string' })
  @ApiOkResponse({ description: 'Join request deleted successfully.' })
  @ApiNotFoundResponse({ description: 'Join request not found.' })
  @ApiForbiddenResponse({ description: 'Forbidden - Insufficient permissions' })
  async remove(
    @Param('id') id: string,
    @Body() body?: any,
    @CurrentUser() authUser?: any,
    @Headers('x-user-id') headerUserId?: string,
    @Headers('x-user-role') headerRole?: string,
  ): Promise<any> {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveUserId = isLegacy ? headerUserId : (authUser?.uid || authUser?.id);
    const effectiveRole = isLegacy ? headerRole : (authUser?.role || authUser?.roleName);
    const fbPayload = body?.feedback || (
      Array.isArray(body?.reasons)
        ? { reasons: body.reasons, explanation: body.explanation }
        : (body?.reason ? { reasons: ['OTHER'], explanation: body.reason } : undefined)
    );
    try {
      const result = await this.joinRequestsService.withdrawAsync(id, effectiveUserId, effectiveRole, fbPayload);
      return {
        message: `Join request ${id} deleted successfully`,
        ...result,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        return { message: `Join request ${id} was already removed or not found`, withdrawn: false, slotRestored: false };
      }
      throw error;
    }
  }
}