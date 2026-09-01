import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles } from '../core/decorators/roles.decorator';
import { RolesGuard } from '../core/guards/roles.guard';
import { TeamsService } from './teams.service';
import { CreateTeamDto, SubmitProjectDto, ApproveTeamDto, RejectTeamDto } from './dto/create-team.dto';

@ApiTags('Teams')
@Controller('teams')
@UseGuards(RolesGuard)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  @Roles('user')
  @ApiQuery({ name: 'hackathonId', required: false })
  findAll(@Query('hackathonId') hackathonId?: string) {
    return hackathonId ? this.teamsService.findByHackathon(hackathonId) : this.teamsService.findAll();
  }

  @Get('pending-approvals')
  @Roles('admin')
  @ApiOperation({ summary: 'Admin gets all teams awaiting ID card verification' })
  getPendingApprovals() {
    return this.teamsService.getPendingApprovals();
  }

  @Post(':id/approve')
  @Roles('admin')
  @ApiOperation({ summary: 'Admin approves team registration ID card' })
  @ApiBody({ type: ApproveTeamDto })
  approve(@Param('id') id: string, @Body() dto: ApproveTeamDto) {
    return this.teamsService.approve(id, dto.verifiedBy);
  }

  @Post(':id/reject')
  @Roles('admin')
  @ApiOperation({ summary: 'Admin rejects team registration ID card' })
  @ApiBody({ type: RejectTeamDto })
  reject(@Param('id') id: string, @Body() dto: RejectTeamDto) {
    return this.teamsService.reject(id, dto.verifiedBy, dto.reason);
  }

  @Get('leaderboard')
  @Roles('user')
  @ApiOperation({ summary: "Host's judging leaderboard for a hackathon — re-sorts as scores come in" })
  @ApiQuery({ name: 'hackathonId', required: true })
  getLeaderboard(@Query('hackathonId') hackathonId: string) {
    return this.teamsService.getLeaderboard(hackathonId);
  }

  @Get(':id')
  @Roles('user')
  findOne(@Param('id') id: string) {
    return this.teamsService.findOne(id);
  }

  @Get(':id/members')
  @Roles('user')
  getMembers(@Param('id') id: string) {
    return this.teamsService.getMembers(id);
  }

  @Post()
  @Roles('user')
  @ApiOperation({ summary: 'Team lead creates a team for a hackathon (registration step 1)' })
  @ApiBody({ type: CreateTeamDto })
  create(@Body() dto: CreateTeamDto) {
    return this.teamsService.create(dto);
  }

  @Post(':id/submit')
  @Roles('user')
  @ApiOperation({ summary: 'Team submits their final hackathon project' })
  @ApiBody({ type: SubmitProjectDto })
  submitProject(@Param('id') id: string, @Body() dto: SubmitProjectDto) {
    return this.teamsService.submitProject(id, dto);
  }
}
