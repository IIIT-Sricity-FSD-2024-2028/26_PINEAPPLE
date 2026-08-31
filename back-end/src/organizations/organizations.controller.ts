import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../core/decorators/roles.decorator';
import { RolesGuard } from '../core/guards/roles.guard';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/organization.dto';

@ApiTags('Organizations')
@Controller('organizations')
@UseGuards(RolesGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  @Roles('user')
  findAll() {
    return this.organizationsService.findAll();
  }

  @Get(':id')
  @Roles('user')
  findOne(@Param('id') id: string) {
    return this.organizationsService.findOne(id);
  }

  @Post()
  @Roles('user')
  @ApiOperation({ summary: 'Register a new Organization (becomes the initial Org Admin / hackathon host account)' })
  @ApiBody({ type: CreateOrganizationDto })
  create(@Body() dto: CreateOrganizationDto) {
    return this.organizationsService.registerOrganization(dto);
  }

  @Get('user/:userId/memberships')
  @Roles('user')
  @ApiOperation({ summary: "Which orgs a user administers — used to show a 'Host a Hackathon' option only where valid" })
  getOrgsForUser(@Param('userId') userId: string) {
    return this.organizationsService.getOrgsForUser(userId);
  }
}
