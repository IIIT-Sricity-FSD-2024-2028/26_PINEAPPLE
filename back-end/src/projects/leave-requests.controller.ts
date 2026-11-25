import {
  Controller,
  Post,
  Param,
  Body,
  Headers,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { LeaveRequestsService, RejectLeaveRequestDto } from './leave-requests.service';

@ApiTags('Leave Requests')
@Controller('leave-requests')
export class LeaveRequestsController {
  constructor(private readonly leaveRequestsService: LeaveRequestsService) {}

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiHeader({ name: 'x-user-id', required: false })
  @ApiHeader({ name: 'x-user-role', required: false })
  @ApiOperation({ summary: 'Approve a member leave request (Owner only)' })
  @ApiResponse({ status: 200, description: 'Leave request approved and member tasks released.' })
  @ApiResponse({ status: 403, description: 'Forbidden: only owner can approve.' })
  @ApiResponse({ status: 409, description: 'Conflict: request already decided.' })
  approve(
    @Param('id') id: string,
    @CurrentUser() authUser: any,
    @Headers('x-user-id') headerUserId?: string,
    @Headers('x-user-role') headerRole?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveUserId = isLegacy ? headerUserId : (authUser?.uid || authUser?.id);
    const effectiveRole = isLegacy ? headerRole : (authUser?.role || authUser?.roleName);
    if (!effectiveUserId) {
      throw new UnauthorizedException('Authentication required.');
    }
    return this.leaveRequestsService.approveRequest(id, effectiveUserId, effectiveRole);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiHeader({ name: 'x-user-id', required: false })
  @ApiHeader({ name: 'x-user-role', required: false })
  @ApiOperation({ summary: 'Reject a member leave request (Owner only, 24h cooldown begins)' })
  @ApiResponse({ status: 200, description: 'Leave request rejected.' })
  @ApiResponse({ status: 400, description: 'Bad Request: reasons and 10+ char explanation required.' })
  @ApiResponse({ status: 403, description: 'Forbidden: only owner can reject.' })
  @ApiResponse({ status: 409, description: 'Conflict: request already decided.' })
  reject(
    @Param('id') id: string,
    @Body() dto: RejectLeaveRequestDto,
    @CurrentUser() authUser: any,
    @Headers('x-user-id') headerUserId?: string,
    @Headers('x-user-role') headerRole?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveUserId = isLegacy ? headerUserId : (authUser?.uid || authUser?.id);
    const effectiveRole = isLegacy ? headerRole : (authUser?.role || authUser?.roleName);
    if (!effectiveUserId) {
      throw new UnauthorizedException('Authentication required.');
    }
    return this.leaveRequestsService.rejectRequest(id, effectiveUserId, effectiveRole, dto);
  }
}
