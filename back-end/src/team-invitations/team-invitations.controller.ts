import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles } from '../core/decorators/roles.decorator';
import { RolesGuard } from '../core/guards/roles.guard';
import { TeamInvitationsService } from './team-invitations.service';
import { CreateInvitationDto, AcceptInvitationDto } from './dto/team-invitation.dto';

@ApiTags('Team Invitations')
@Controller('team-invitations')
@UseGuards(RolesGuard)
export class TeamInvitationsController {
  constructor(private readonly invitationsService: TeamInvitationsService) {}

  @Get()
  @Roles('user')
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'teamId', required: false })
  find(@Query('userId') userId?: string, @Query('teamId') teamId?: string) {
    if (userId) return this.invitationsService.findForUser(userId);
    if (teamId) return this.invitationsService.findForTeam(teamId);
    return this.invitationsService.findAll();
  }

  @Post()
  @Roles('user')
  @ApiOperation({ summary: 'Team lead invites a specific person to their hackathon team' })
  @ApiBody({ type: CreateInvitationDto })
  invite(@Body() dto: CreateInvitationDto) {
    return this.invitationsService.invite(dto);
  }

  @Post(':id/accept')
  @Roles('user')
  @ApiOperation({ summary: "Invitee accepts and submits their KYC (college, age, ID card) in the same step" })
  @ApiBody({ type: AcceptInvitationDto })
  accept(@Param('id') id: string, @Body() dto: AcceptInvitationDto) {
    return this.invitationsService.accept(id, dto);
  }

  @Post(':id/decline')
  @Roles('user')
  decline(@Param('id') id: string) {
    return this.invitationsService.decline(id);
  }
}
