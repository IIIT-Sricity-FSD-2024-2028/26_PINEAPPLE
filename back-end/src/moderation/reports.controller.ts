import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { normalizeRole } from '../common/utils/role.util';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';
import { ActionReportDto } from './dto/action-report.dto';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller()
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  private getCallerId(caller: any, headerUserId?: string): string {
    if (process.env.AUTH_MODE === 'legacy') {
      return headerUserId || caller?.uid || caller?.id || 'System';
    }
    return caller?.uid || caller?.id || 'System';
  }

  @Post('reports')
  @UseGuards(EmailVerifiedGuard)
  @ApiOperation({ summary: 'Submit a report against another user' })
  @ApiResponse({ status: 201, description: 'Report created successfully.' })
  @ApiResponse({ status: 400, description: 'Validation failed.' })
  @ApiResponse({ status: 403, description: 'Cannot report self or admin.' })
  @ApiResponse({ status: 409, description: 'Duplicate open report.' })
  @ApiResponse({ status: 429, description: 'Daily report limit reached.' })
  createReport(
    @Body() dto: CreateReportDto,
    @CurrentUser() caller: any,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const callerId = this.getCallerId(caller, headerUserId);
    return this.reportsService.createReport(callerId, dto);
  }

  @Get('reports/mine')
  @ApiOperation({ summary: 'Get current user submitted reports with outcome lines' })
  @ApiResponse({ status: 200, description: 'Returns own reports.' })
  getMyReports(
    @CurrentUser() caller: any,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const callerId = this.getCallerId(caller, headerUserId);
    return this.reportsService.getReporterReports(callerId);
  }

  @Get('admin/reports')
  @Roles('admin', 'superuser')
  @ApiOperation({ summary: 'Admin list and filter user reports (requires "reports" permission)' })
  @ApiResponse({ status: 200, description: 'Returns paginated reports.' })
  getAdminReports(
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reportsService.getAdminReports({
      status,
      q,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('admin/reports/open-count')
  @Roles('admin', 'superuser')
  @ApiOperation({ summary: 'Get open reports count for admin badge' })
  @ApiResponse({ status: 200, description: 'Returns open reports count.' })
  getOpenReportsCount() {
    return this.reportsService.getOpenReportsCount();
  }

  @Get('admin/reports/owner-patterns')
  @Roles('admin', 'superuser')
  @ApiOperation({ summary: 'Get 30-day rejection & approval statistics per project owner' })
  @ApiResponse({ status: 200, description: 'Returns owner rejection patterns and review pattern flags.' })
  getOwnerRejectionPatterns(@Query('days') days?: string) {
    const parsedDays = days ? parseInt(days, 10) : 30;
    return this.reportsService.getOwnerRejectionPatterns(parsedDays);
  }

  @Get('admin/reports/:id')
  @Roles('admin', 'superuser')
  @ApiOperation({ summary: 'Admin get full report details, earlier warnings & reports' })
  @ApiResponse({ status: 200, description: 'Returns report details.' })
  @ApiResponse({ status: 404, description: 'Report not found.' })
  getAdminReportById(@Param('id') id: string) {
    return this.reportsService.getAdminReportById(id);
  }

  @Patch('admin/reports/:id/status')
  @Roles('admin', 'superuser')
  @ApiOperation({ summary: 'Update report status (Open, Under review, Resolved, Dismissed)' })
  @ApiResponse({ status: 200, description: 'Report status updated.' })
  updateReportStatus(
    @Param('id') id: string,
    @Body() dto: UpdateReportStatusDto,
    @CurrentUser() caller: any,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const adminId = this.getCallerId(caller, headerUserId);
    return this.reportsService.updateReportStatus(id, dto, adminId);
  }

  @Post('admin/reports/:id/action')
  @Roles('admin', 'superuser')
  @ApiOperation({ summary: 'Execute administrative action on a report (warn, suspend, dismiss)' })
  @ApiResponse({ status: 200, description: 'Action executed successfully.' })
  actionReport(
    @Param('id') id: string,
    @Body() dto: ActionReportDto,
    @CurrentUser() caller: any,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const adminId = this.getCallerId(caller, headerUserId);
    const adminRole = normalizeRole(caller?.role || 'admin');
    return this.reportsService.actionReport(id, dto, adminId, adminRole);
  }
}
