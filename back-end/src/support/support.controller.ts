import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
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
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { normalizeRole } from '../common/utils/role.util';
import { CreateReplyDto } from './dto/create-reply.dto';
import { CreateSupportRequestDto } from './dto/create-support-request.dto';
import { UpdateSupportStatusDto } from './dto/update-support-status.dto';
import { SupportRequestEntity } from './entities/support-request.entity';
import { SupportService } from './support.service';

@ApiTags('Support')
@ApiHeader({
  name: 'x-user-role',
  description: 'User role for RBAC authorization',
  required: false,
  schema: { type: 'string', enum: ['admin', 'project-owner', 'collaborator', 'mentor', 'superuser', 'user'] },
})
@Controller('support')
@UseGuards(RolesGuard)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  private isAdminRole(role?: string): boolean {
    return ['admin', 'superuser'].includes(normalizeRole(role));
  }

  private assertAdminHasSupportPermission(authUser: any, role?: string): void {
    const normRole = normalizeRole(role);
    if (normRole === 'superuser') return;
    if (normRole === 'admin') {
      const perms = Array.isArray(authUser?.permissions) ? authUser.permissions : [];
      if (!perms.includes('*') && !perms.includes('support')) {
        throw new ForbiddenException('You do not have permission to access the "support" section.');
      }
    }
  }

  private resolveCallerUid(authUser: any, headerUserId?: string): string {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const uid = isLegacy ? (authUser?.uid || headerUserId) : (authUser?.uid || authUser?.id);
    if (!uid) {
      throw new UnauthorizedException('Authentication required.');
    }
    return String(uid);
  }

  // ── Phase 27 Canonical User Ticket Routes (declared before :id) ──────────

  @Get('tickets')
  @Roles('admin', 'superuser', 'user', 'project-owner', 'collaborator', 'mentor')
  @ApiOperation({ summary: 'List support tickets submitted by the authenticated user (internal notes hidden)' })
  @ApiOkResponse({ description: 'User support tickets returned.', type: [SupportRequestEntity] })
  getMyTickets(
    @CurrentUser() authUser: any,
    @Headers('x-user-id') xUserId?: string,
  ): SupportRequestEntity[] {
    const uid = this.resolveCallerUid(authUser, xUserId);
    return this.supportService.listUserTickets(uid);
  }

  @Public()
  @Post('tickets')
  @ApiOperation({ summary: 'Create a help support ticket (authenticated user or visitor with email)' })
  @ApiBody({ type: CreateSupportRequestDto })
  @ApiCreatedResponse({ description: 'Support ticket created.', type: SupportRequestEntity })
  createTicket(
    @Body() dto: CreateSupportRequestDto,
    @CurrentUser() authUser?: any,
    @Req() req?: Request,
    @Headers('x-user-id') xUserId?: string,
    @Headers('x-user-email') xUserEmail?: string,
  ): SupportRequestEntity {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const uid = authUser?.uid || authUser?.id || (isLegacy ? xUserId : undefined);
    const email = authUser?.email || (isLegacy ? xUserEmail : undefined) || dto.email;

    if (!uid && !email) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'EMAIL_REQUIRED',
        message: 'A valid email address is required for visitor support requests.',
      });
    }

    const clientIp = String(
      (req?.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req?.ip ||
        req?.socket?.remoteAddress ||
        'unknown',
    );

    return this.supportService.create({
      ...dto,
      type: dto.type || 'help',
      userId: uid ? String(uid) : undefined,
      from: email ? String(email) : undefined,
      clientIp,
    });
  }

  @Get('tickets/:id')
  @Roles('admin', 'superuser', 'user', 'project-owner', 'collaborator', 'mentor')
  @ApiOperation({ summary: 'Get a single support ticket owned by the authenticated user (internal notes stripped)' })
  @ApiParam({ name: 'id', description: 'Support ticket ID' })
  @ApiOkResponse({ description: 'Support ticket returned.', type: SupportRequestEntity })
  @ApiNotFoundResponse({ description: 'Ticket not found or belongs to another user (404 TICKET_NOT_FOUND)' })
  getMyTicketById(
    @Param('id') id: string,
    @CurrentUser() authUser: any,
    @Headers('x-user-id') xUserId?: string,
  ): SupportRequestEntity {
    const uid = this.resolveCallerUid(authUser, xUserId);
    return this.supportService.getUserTicket(id, uid);
  }

  @Post('tickets/:id/replies')
  @Roles('admin', 'superuser', 'user', 'project-owner', 'collaborator', 'mentor')
  @ApiOperation({ summary: 'Reply to own open, in_progress, or waiting_user support ticket' })
  @ApiParam({ name: 'id', description: 'Support ticket ID' })
  @ApiBody({ type: CreateReplyDto })
  @ApiCreatedResponse({ description: 'Reply added to ticket.', type: SupportRequestEntity })
  replyToMyTicket(
    @Param('id') id: string,
    @Body() dto: CreateReplyDto,
    @CurrentUser() authUser: any,
    @Headers('x-user-id') xUserId?: string,
  ): SupportRequestEntity {
    const uid = this.resolveCallerUid(authUser, xUserId);
    return this.supportService.addUserReply(id, uid, dto.body);
  }

  // ── Existing Support Routes (Preserved & Hardened) ──────────────────────

  private resolveRequesterId(role: string, queryUserId?: string, headerUserId?: string): string | null {
    if (this.isAdminRole(role)) {
      return null;
    }

    if (queryUserId && headerUserId && queryUserId !== headerUserId) {
      throw new ForbiddenException('Mismatched user identifiers. Use a single user ID for requester-scoped access.');
    }

    const effectiveUserId = queryUserId || headerUserId;
    if (!effectiveUserId) {
      throw new ForbiddenException('Requester access requires authentication.');
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
    @CurrentUser() authUser: any,
    @Headers('x-user-role') xUserRole: string,
    @Headers('x-user-id') xUserId?: string,
    @Query('status') status?: string,
    @Query('userId') userId?: string,
  ): SupportRequestEntity[] {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const role = isLegacy ? (authUser?.role || xUserRole) : authUser?.role;
    const uid = isLegacy ? (authUser?.uid || xUserId) : authUser?.uid;

    if (this.isAdminRole(role)) {
      this.assertAdminHasSupportPermission(authUser, role);
      return this.supportService.listAdminTickets({ status }).items;
    }

    const requesterId = this.resolveRequesterId(role, userId, uid);
    let tickets = requesterId ? this.supportService.listUserTickets(requesterId) : [];
    if (status) {
      tickets = tickets.filter((t) => String(t.status) === String(status));
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
    @CurrentUser() authUser: any,
    @Headers('x-user-role') xUserRole: string,
    @Headers('x-user-id') xUserId: string,
    @Param('id') id: string,
  ): SupportRequestEntity {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const role = isLegacy ? (authUser?.role || xUserRole) : authUser?.role;
    const uid = isLegacy ? (authUser?.uid || xUserId) : authUser?.uid;

    if (this.isAdminRole(role)) {
      this.assertAdminHasSupportPermission(authUser, role);
      return this.supportService.getAdminTicket(id);
    }

    return this.supportService.getUserTicket(id, String(uid));
  }

  @Post()
  @Roles('admin', 'project-owner', 'collaborator', 'mentor', 'superuser', 'user')
  @ApiOperation({ summary: 'Submit a new support ticket' })
  @ApiBody({ type: CreateSupportRequestDto })
  @ApiCreatedResponse({ description: 'Support ticket created successfully.', type: SupportRequestEntity })
  @ApiForbiddenResponse({ description: 'Forbidden - insufficient permissions' })
  create(
    @Body() createSupportRequestDto: CreateSupportRequestDto,
    @CurrentUser() authUser?: any,
    @Headers('x-user-id') xUserId?: string,
    @Headers('x-user-email') xUserEmail?: string,
  ): SupportRequestEntity {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const userId = isLegacy ? (authUser?.uid || xUserId || 'anonymous') : (authUser?.uid || authUser?.id || 'anonymous');
    const fromEmail = isLegacy
      ? (authUser?.email || xUserEmail || 'anonymous@local')
      : (authUser?.email || 'anonymous@local');
    return this.supportService.create({
      ...createSupportRequestDto,
      userId: String(userId),
      from: String(fromEmail),
    });
  }

  @Put(':id/status')
  @Roles('admin', 'superuser')
  @ApiOperation({ summary: 'Update support ticket status (Admin with support permission)' })
  @ApiParam({ name: 'id', description: 'Support ticket ID' })
  @ApiBody({ type: UpdateSupportStatusDto })
  @ApiOkResponse({ description: 'Support ticket status updated successfully.', type: SupportRequestEntity })
  @ApiNotFoundResponse({ description: 'Support ticket not found' })
  @ApiForbiddenResponse({ description: 'Forbidden - admin support permission required' })
  updateStatus(
    @Param('id') id: string,
    @Body() updateSupportStatusDto: UpdateSupportStatusDto,
    @CurrentUser() authUser?: any,
  ): SupportRequestEntity {
    this.assertAdminHasSupportPermission(authUser, authUser?.role);
    return this.supportService.updateAdminTicket(id, authUser || {}, {
      status: updateSupportStatusDto.status as any,
      note: updateSupportStatusDto.note,
    });
  }

  @Delete(':id')
  @Roles('admin', 'superuser')
  @ApiOperation({ summary: 'Delete a support ticket (Admin only)' })
  @ApiParam({ name: 'id', description: 'Support ticket ID' })
  @ApiOkResponse({ description: 'Support ticket deleted successfully.', type: Object })
  @ApiNotFoundResponse({ description: 'Support ticket not found' })
  @ApiForbiddenResponse({ description: 'Forbidden - admin role required' })
  remove(@Param('id') id: string, @CurrentUser() authUser?: any): { message: string } {
    this.assertAdminHasSupportPermission(authUser, authUser?.role);
    this.supportService.remove(id);
    return { message: `Support ticket ${id} deleted successfully` };
  }
}
