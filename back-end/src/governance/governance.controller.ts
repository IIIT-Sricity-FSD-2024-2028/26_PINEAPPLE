import { Controller, Get, Post, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { throwLegacyEndpointRemoved } from '../common/utils/legacy-route.util';

@ApiTags('Governance (Retired)')
@ApiBearerAuth()
@Controller('governance')
export class GovernanceController {
  @Post('reports')
  @ApiOperation({
    deprecated: true,
    summary: 'Retired legacy endpoint (returns 410 LEGACY_ENDPOINT_REMOVED; use POST /reports)',
  })
  @ApiResponse({ status: 410, description: 'Legacy endpoint retired.' })
  createReport(): never {
    return throwLegacyEndpointRemoved('POST /governance/reports', 'POST /reports');
  }

  @Get('reports')
  @ApiOperation({
    deprecated: true,
    summary: 'Retired legacy endpoint (returns 410 LEGACY_ENDPOINT_REMOVED; use GET /admin/reports)',
  })
  @ApiResponse({ status: 410, description: 'Legacy endpoint retired.' })
  getAllReports(): never {
    return throwLegacyEndpointRemoved('GET /governance/reports', 'GET /admin/reports');
  }

  @Get('reports/:id')
  @ApiOperation({
    deprecated: true,
    summary: 'Retired legacy endpoint (returns 410 LEGACY_ENDPOINT_REMOVED; use GET /admin/reports/:id)',
  })
  @ApiResponse({ status: 410, description: 'Legacy endpoint retired.' })
  getReportById(): never {
    return throwLegacyEndpointRemoved('GET /governance/reports/:id', 'GET /admin/reports/:id');
  }

  @Patch('reports/:id/resolve')
  @ApiOperation({
    deprecated: true,
    summary:
      'Retired legacy endpoint (returns 410 LEGACY_ENDPOINT_REMOVED; use PATCH /admin/reports/:id/status or POST /admin/reports/:id/action)',
  })
  @ApiResponse({ status: 410, description: 'Legacy endpoint retired.' })
  resolveReport(): never {
    return throwLegacyEndpointRemoved(
      'PATCH /governance/reports/:id/resolve',
      'PATCH /admin/reports/:id/status and POST /admin/reports/:id/action',
    );
  }
}
