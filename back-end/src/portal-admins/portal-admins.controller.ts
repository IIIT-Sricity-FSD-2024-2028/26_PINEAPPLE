import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
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
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreatePortalAdminDto } from './dto/create-portal-admin.dto';
import { UpdatePortalAdminDto } from './dto/update-portal-admin.dto';
import { PortalAdminEntity } from './entities/portal-admin.entity';
import { PortalAdminsService } from './portal-admins.service';

@ApiTags('Portal Admins')
@ApiHeader({
  name: 'x-user-role',
  description: 'User role for RBAC authorization',
  required: true,
  schema: { type: 'string', enum: ['superuser', 'portal_admin'] },
})
@Controller('portal-admins')
@UseGuards(RolesGuard)
export class PortalAdminsController {
  constructor(private readonly portalAdminsService: PortalAdminsService) {}

  @Get()
  @Roles('superuser', 'portal_admin')
  @ApiOperation({ summary: 'List all portal admin accounts' })
  @ApiOkResponse({ description: 'List of portal admins returned successfully.', type: [PortalAdminEntity] })
  @ApiForbiddenResponse({ description: 'Forbidden - superuser or portal_admin role required' })
  list() {
    return this.portalAdminsService.findAll();
  }

  @Post()
  @Roles('superuser', 'portal_admin')
  @ApiOperation({ summary: 'Create a new portal admin account' })
  @ApiBody({ type: CreatePortalAdminDto })
  @ApiCreatedResponse({ description: 'Portal admin created successfully.', type: PortalAdminEntity })
  @ApiForbiddenResponse({ description: 'Forbidden - superuser or portal_admin role required' })
  create(@Body() dto: CreatePortalAdminDto) {
    return this.portalAdminsService.create(dto);
  }

  @Put(':id')
  @Roles('superuser', 'portal_admin')
  @ApiOperation({ summary: 'Update an existing portal admin account' })
  @ApiParam({ name: 'id', description: 'Portal admin ID' })
  @ApiBody({ type: UpdatePortalAdminDto })
  @ApiOkResponse({ description: 'Portal admin updated successfully.', type: PortalAdminEntity })
  @ApiNotFoundResponse({ description: 'Portal admin not found' })
  @ApiForbiddenResponse({ description: 'Forbidden - superuser or portal_admin role required' })
  update(@Param('id') id: string, @Body() dto: UpdatePortalAdminDto) {
    return this.portalAdminsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('superuser', 'portal_admin')
  @ApiOperation({ summary: 'Delete a portal admin account' })
  @ApiParam({ name: 'id', description: 'Portal admin ID' })
  @ApiOkResponse({ description: 'Portal admin deleted successfully.', type: Object })
  @ApiNotFoundResponse({ description: 'Portal admin not found' })
  @ApiForbiddenResponse({ description: 'Forbidden - superuser or portal_admin role required' })
  remove(@Param('id') id: string) {
    this.portalAdminsService.remove(id);
    return { message: `Portal admin ${id} deleted successfully` };
  }
}
