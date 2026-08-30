import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { RolesGuard } from '../core/guards/roles.guard';
import { Roles } from '../core/decorators/roles.decorator';

@Controller('orgs')
@UseGuards(RolesGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  create(@Body() createOrganizationDto: any) {
    return this.organizationsService.create(createOrganizationDto);
  }

  @Get()
  @Roles('super_admin', 'org_success_manager')
  findAll() {
    return this.organizationsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.organizationsService.findOne(+id);
  }

  @Post(':id/members')
  @Roles('org_admin', 'super_admin')
  addMember(@Param('id') id: string, @Body() memberDto: any) {
    return this.organizationsService.addMember(+id, memberDto);
  }
}
