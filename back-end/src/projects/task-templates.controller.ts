import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RolesGuard } from '../core/guards/roles.guard';
import { TemplatesService } from './templates.service';

@ApiTags('Task Templates')
@Controller('task-templates')
@UseGuards(RolesGuard)
export class TaskTemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  @ApiOperation({ summary: 'Get starter task templates for a project category (any logged-in user)' })
  @ApiQuery({ name: 'category', required: false, example: 'Web App' })
  @ApiResponse({ status: 200, description: 'Returns resolved category and starter task template items.' })
  getForCategory(@Query('category') category?: string) {
    return this.templatesService.getForCategory(category);
  }
}
