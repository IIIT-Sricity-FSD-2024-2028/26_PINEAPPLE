import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { RolesGuard } from '../core/guards/roles.guard';

@Controller('teams')
@UseGuards(RolesGuard)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post()
  create(@Body() createTeamDto: any) {
    return this.teamsService.create(createTeamDto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.teamsService.findOne(+id);
  }

  @Post(':id/members')
  addMember(@Param('id') id: string, @Body() memberDto: any) {
    return this.teamsService.addMember(+id, memberDto);
  }
}
