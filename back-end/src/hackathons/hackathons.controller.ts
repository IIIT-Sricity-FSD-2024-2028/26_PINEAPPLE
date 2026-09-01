import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles } from '../core/decorators/roles.decorator';
import { RolesGuard } from '../core/guards/roles.guard';
import { HackathonsService } from './hackathons.service';
import { CreateHackathonDto, RegisterLeadDto, ScoreTeamDto, CloseHackathonDto } from './dto/hackathon.dto';

@ApiTags('Hackathons')
@Controller('hackathons')
@UseGuards(RolesGuard)
export class HackathonsController {
  constructor(private readonly hackathonsService: HackathonsService) {}

  @Get()
  @Roles('user')
  @ApiOperation({ summary: 'Browse/search hackathons' })
  @ApiQuery({ name: 'search', required: false })
  search(@Query('search') search?: string) {
    return this.hackathonsService.search(search);
  }

  @Get('host/:orgId')
  @Roles('user')
  @ApiOperation({ summary: "Host's own hackathons" })
  findByOrg(@Param('orgId') orgId: string) {
    return this.hackathonsService.findByOrg(orgId);
  }

  @Get('user/:userId')
  @Roles('user')
  @ApiOperation({ summary: 'Hackathons where the user has a registered team (My Hackathons)' })
  findByUser(@Param('userId') userId: string) {
    return this.hackathonsService.findByUser(userId);
  }

  @Get(':id')
  @Roles('user')
  @ApiOperation({ summary: 'Hackathon detail — description, eligibility, team size, prize, dates' })
  findOne(@Param('id') id: string) {
    return this.hackathonsService.findOne(id);
  }

  @Post()
  @Roles('user')
  @ApiOperation({ summary: 'Host creates a hackathon and funds the prize pool into escrow' })
  @ApiBody({ type: CreateHackathonDto })
  create(@Body() dto: CreateHackathonDto) {
    return this.hackathonsService.createHackathon(dto);
  }

  @Post(':id/register-lead')
  @Roles('user')
  @ApiOperation({ summary: 'Team lead registers: submits KYC and creates their team' })
  @ApiBody({ type: RegisterLeadDto })
  registerLead(@Param('id') id: string, @Body() dto: RegisterLeadDto) {
    return this.hackathonsService.registerLead(id, dto);
  }

  @Post(':id/start')
  @Roles('user')
  @ApiOperation({ summary: 'Host starts the hackathon — every team gets its own workspace' })
  @ApiBody({ schema: { properties: { requesterId: { type: 'string' } } } })
  start(@Param('id') id: string, @Body('requesterId') requesterId: string) {
    return this.hackathonsService.start(id, requesterId);
  }

  @Post(':id/teams/:teamId/score')
  @Roles('user')
  @ApiOperation({ summary: "Host scores a submitted team's project (1-10)" })
  @ApiBody({ type: ScoreTeamDto })
  scoreTeam(@Param('id') id: string, @Param('teamId') teamId: string, @Body() dto: ScoreTeamDto) {
    return this.hackathonsService.scoreTeam(id, teamId, dto);
  }

  @Post(':id/close')
  @Roles('user')
  @ApiOperation({ summary: 'Host closes the hackathon — pays top 3 from escrow and notifies winners' })
  @ApiBody({ type: CloseHackathonDto })
  close(@Param('id') id: string, @Body() dto: CloseHackathonDto) {
    return this.hackathonsService.close(id, dto.closedBy);
  }

  @Post(':id/cancel')
  @Roles('user')
  @ApiOperation({ summary: 'Host cancels the hackathon — refunds the escrowed prize pool' })
  @ApiBody({ schema: { properties: { requesterId: { type: 'string' } } } })
  cancel(@Param('id') id: string, @Body('requesterId') requesterId: string) {
    return this.hackathonsService.cancel(id, requesterId);
  }
}
