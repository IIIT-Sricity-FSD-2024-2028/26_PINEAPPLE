import { Controller, Get, Post, Body, Patch, Param, Headers, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { GovernanceService } from './governance.service';
import { CreateReportDto } from './dto/create-report.dto';
import { ResolveReportDto } from './dto/resolve-report.dto';
import { Roles } from '../core/decorators/roles.decorator';

@ApiTags('Governance')
@Controller('governance')
export class GovernanceController {
  constructor(private readonly governanceService: GovernanceService) {}

  @Post('reports')
  @ApiOperation({ summary: 'File a moderation report' })
  @ApiHeader({ name: 'x-user-id', required: true })
  @ApiResponse({ status: 201, description: 'Report filed successfully.' })
  createReport(
    @Headers('x-user-id') reporterId: string,
    @Body() dto: CreateReportDto,
  ) {
    if (!reporterId) throw new UnauthorizedException('x-user-id header is missing.');
    return this.governanceService.createReport(reporterId, dto);
  }

  @Get('reports')
  @Roles('Administrator')
  @ApiHeader({ name: 'x-user-role', description: 'User role for authorization', required: true })
  @ApiOperation({ summary: 'Get all reports (Admin only)' })
  getAllReports() {
    return this.governanceService.getAllReports();
  }

  @Get('reports/:id')
  @Roles('Administrator')
  @ApiHeader({ name: 'x-user-role', description: 'User role for authorization', required: true })
  @ApiOperation({ summary: 'Get a specific report by ID (Admin only)' })
  getReportById(@Param('id') id: string) {
    return this.governanceService.getReportById(id);
  }

  @Patch('reports/:id/resolve')
  @Roles('Administrator')
  @ApiHeader({ name: 'x-user-role', description: 'User role for authorization', required: true })
  @ApiOperation({ summary: 'Resolve a report (Admin only)' })
  resolveReport(
    @Param('id') id: string,
    @Body() dto: ResolveReportDto,
  ) {
    return this.governanceService.resolveReport(id, dto);
  }
}
