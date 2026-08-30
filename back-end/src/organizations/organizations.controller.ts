import { Controller, Get, Post, Body, Patch, Param, UseGuards } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { Roles } from '../core/decorators/roles.decorator';
import { RolesGuard } from '../core/guards/roles.guard';

@Controller('organizations')
@UseGuards(RolesGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  @Roles('Administrator') // Ensure only admins can access this data
  async getOrganizations() {
    return this.organizationsService.findAll();
  }

  @Post()
  @Roles('Administrator')
  async createOrganization(@Body() payload: any) {
    return this.organizationsService.create(payload);
  }

  @Patch(':id/status')
  @Roles('Administrator')
  async updateOrganizationStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.organizationsService.updateStatus(id, status);
  }
}
