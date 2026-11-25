import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AppealsService } from './appeals.service';
import { CreateAppealDto } from './dto/create-appeal.dto';
import { DecideAppealDto } from './dto/decide-appeal.dto';

@ApiTags('Appeals')
@ApiBearerAuth()
@Controller()
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class AppealsController {
  constructor(private readonly appealsService: AppealsService) {}

  private getCallerId(caller: any, headerUserId?: string): string {
    if (process.env.AUTH_MODE === 'legacy') {
      return headerUserId || caller?.uid || caller?.id || 'System';
    }
    return caller?.uid || caller?.id || 'System';
  }

  @Post('warnings/:id/appeal')
  @ApiOperation({ summary: 'Submit an appeal for an active warning within 7 days' })
  @ApiResponse({ status: 201, description: 'Appeal submitted successfully.' })
  @ApiResponse({ status: 400, description: 'Explanation length invalid.' })
  @ApiResponse({ status: 403, description: 'Not your warning or account suspended.' })
  @ApiResponse({ status: 409, description: 'Warning not active, window closed, or already appealed.' })
  createAppeal(
    @Param('id') warningId: string,
    @Body() dto: CreateAppealDto,
    @CurrentUser() caller: any,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const callerId = this.getCallerId(caller, headerUserId);
    return this.appealsService.createAppeal(warningId, dto, callerId);
  }

  @Get('users/me/appeals')
  @ApiOperation({ summary: 'Get current user submitted appeals' })
  @ApiResponse({ status: 200, description: 'Returns own appeals.' })
  getMyAppeals(
    @CurrentUser() caller: any,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const callerId = this.getCallerId(caller, headerUserId);
    return this.appealsService.getUserAppeals(callerId);
  }

  @Get('admin/appeals')
  @Roles('admin', 'superuser')
  @ApiOperation({ summary: 'Admin list appeals (requires "reports" permission)' })
  @ApiResponse({ status: 200, description: 'Returns appeals list.' })
  getAdminAppeals(@Query('status') status?: string) {
    return this.appealsService.getAdminAppeals(status);
  }

  @Post('admin/appeals/:id/decision')
  @Roles('admin', 'superuser')
  @ApiOperation({ summary: 'Decide on an appeal (accept or reject) with an admin note' })
  @ApiResponse({ status: 200, description: 'Appeal decided successfully.' })
  @ApiResponse({ status: 400, description: 'Decision note < 10 characters.' })
  @ApiResponse({ status: 404, description: 'Appeal not found.' })
  decideAppeal(
    @Param('id') id: string,
    @Body() dto: DecideAppealDto,
    @CurrentUser() caller: any,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const adminId = this.getCallerId(caller, headerUserId);
    return this.appealsService.decideAppeal(id, dto, adminId);
  }
}
