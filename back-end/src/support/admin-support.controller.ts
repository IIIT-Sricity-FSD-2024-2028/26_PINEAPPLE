import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../core/decorators/roles.decorator';
import { RolesGuard } from '../core/guards/roles.guard';
import { CloseProjectTicketDto } from './dto/close-project-ticket.dto';
import { CreateReplyDto } from './dto/create-reply.dto';
import { UpdateAdminTicketDto } from './dto/update-admin-ticket.dto';
import { SupportRequestEntity } from './entities/support-request.entity';
import { SupportAssigneeOption, SupportService } from './support.service';

@ApiTags('Admin Support Inbox')
@ApiBearerAuth()
@Controller('admin/support')
@UseGuards(RolesGuard)
@Roles('admin', 'superuser')
export class AdminSupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get('tickets')
  @ApiOperation({ summary: 'List support & closure tickets for Admin Support Inbox (paged, newest first)' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'assignee', required: false })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiOkResponse({ description: 'Paged list of support tickets.' })
  @ApiForbiddenResponse({ description: 'Forbidden - "support" permission required' })
  listTickets(
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('assignee') assignee?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.supportService.listAdminTickets({
      status,
      type,
      assignee,
      q,
      page,
      limit,
    });
  }

  @Get('assignees')
  @ApiOperation({ summary: 'List active admins eligible to be assigned support tickets' })
  @ApiOkResponse({ description: 'Assignable admin options returned.' })
  @ApiForbiddenResponse({ description: 'Forbidden - "support" permission required' })
  listAssignees(): SupportAssigneeOption[] {
    return this.supportService.listAssignableAdmins();
  }

  @Get('tickets/:id')
  @ApiOperation({ summary: 'Get ticket detail including internal notes and live closure project facts' })
  @ApiParam({ name: 'id', description: 'Ticket ID' })
  @ApiOkResponse({ description: 'Full ticket detail returned.', type: SupportRequestEntity })
  @ApiNotFoundResponse({ description: 'Ticket not found (404 TICKET_NOT_FOUND)' })
  @ApiForbiddenResponse({ description: 'Forbidden - "support" permission required' })
  getTicket(@Param('id') id: string): SupportRequestEntity {
    return this.supportService.getAdminTicket(id);
  }

  @Patch('tickets/:id')
  @ApiOperation({ summary: 'Update ticket status, priority, or assignee (note required for resolved/rejected)' })
  @ApiParam({ name: 'id', description: 'Ticket ID' })
  @ApiBody({ type: UpdateAdminTicketDto })
  @ApiOkResponse({ description: 'Ticket updated.', type: SupportRequestEntity })
  @ApiForbiddenResponse({ description: 'Forbidden - "support" permission required' })
  updateTicket(
    @Param('id') id: string,
    @Body() dto: UpdateAdminTicketDto,
    @CurrentUser() adminUser: any,
  ): SupportRequestEntity {
    return this.supportService.updateAdminTicket(id, adminUser || {}, dto);
  }

  @Post('tickets/:id/replies')
  @ApiOperation({ summary: 'Post a public reply or internal admin note to a ticket' })
  @ApiParam({ name: 'id', description: 'Ticket ID' })
  @ApiBody({ type: CreateReplyDto })
  @ApiOkResponse({ description: 'Reply added.', type: SupportRequestEntity })
  @ApiForbiddenResponse({ description: 'Forbidden - "support" permission required' })
  addReply(
    @Param('id') id: string,
    @Body() dto: CreateReplyDto,
    @CurrentUser() adminUser: any,
  ): SupportRequestEntity {
    return this.supportService.addAdminReply(id, adminUser || {}, dto);
  }

  @Post('tickets/:id/close-project')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Close abandoned project ("Owner inactive") with Phase 9 refunds and resolve closure ticket' })
  @ApiParam({ name: 'id', description: 'Closure ticket ID' })
  @ApiBody({ type: CloseProjectTicketDto })
  @ApiOkResponse({ description: 'Project closed, escrow refunded, notifications sent, and ticket resolved.' })
  @ApiForbiddenResponse({ description: 'Forbidden - "support" permission required' })
  closeProjectFromTicket(
    @Param('id') id: string,
    @Body() dto: CloseProjectTicketDto,
    @CurrentUser() adminUser: any,
  ) {
    return this.supportService.closeProjectFromTicket(id, adminUser || {}, dto);
  }
}
