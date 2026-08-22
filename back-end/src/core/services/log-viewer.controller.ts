import { Controller, Get, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { Roles } from '../../core/decorators/roles.decorator';
import { LogManagerService } from './log-manager.service';

/**
 * LogViewerController — Admin API for Viewing Server Logs
 *
 * Provides REST endpoints for administrators to view recent
 * request logs and error logs from the in-memory buffer.
 *
 * All endpoints require Administrator role.
 */
@ApiTags('Logs')
@Controller('logs')
export class LogViewerController {
  private readonly logger = new Logger(LogViewerController.name);

  constructor(private readonly logManagerService: LogManagerService) {}

  @Get('requests')
  @Roles('Administrator')
  @ApiHeader({ name: 'x-user-role', description: 'User role for authorization', required: true })
  @ApiOperation({ summary: 'View recent request logs (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Returns the most recent 200 request log entries.',
  })
  @ApiResponse({ status: 403, description: 'Forbidden — Administrator role required.' })
  getRequestLogs() {
    this.logger.log('Admin requested recent request logs');
    const logs = this.logManagerService.getRecentRequestLogs();
    return {
      count: logs.length,
      logs,
    };
  }

  @Get('errors')
  @Roles('Administrator')
  @ApiHeader({ name: 'x-user-role', description: 'User role for authorization', required: true })
  @ApiOperation({ summary: 'View recent error logs (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Returns the most recent 200 error log entries.',
  })
  @ApiResponse({ status: 403, description: 'Forbidden — Administrator role required.' })
  getErrorLogs() {
    this.logger.log('Admin requested recent error logs');
    const logs = this.logManagerService.getRecentErrorLogs();
    return {
      count: logs.length,
      logs,
    };
  }
}
