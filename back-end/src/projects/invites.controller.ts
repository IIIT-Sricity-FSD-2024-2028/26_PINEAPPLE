import {
  Controller,
  Post,
  Param,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { ProjectInvitesService } from './invites.service';

@ApiTags('Invites')
@Controller('invites')
export class InvitesController {
  constructor(private readonly invitesService: ProjectInvitesService) {}

  @Post(':id/accept')
  @UseGuards(EmailVerifiedGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept a pending project invitation (Invited user)' })
  @ApiResponse({ status: 200, description: 'Invitation accepted and user added to project.' })
  @ApiResponse({ status: 409, description: 'PROJECT_FULL, ACTIVE_PROJECT_CAP, or INVITE_EXPIRED.' })
  acceptInvite(
    @Param('id') id: string,
    @CurrentUser() authUser: any,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveUserId = isLegacy ? headerUserId : (authUser?.uid || authUser?.id);
    if (!effectiveUserId) {
      throw new UnauthorizedException('Authentication required.');
    }
    return this.invitesService.acceptInvite(id, effectiveUserId);
  }

  @Post(':id/decline')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Decline a pending project invitation (Invited user)' })
  @ApiResponse({ status: 200, description: 'Invitation declined.' })
  declineInvite(
    @Param('id') id: string,
    @Body() body: any,
    @CurrentUser() authUser: any,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveUserId = isLegacy ? headerUserId : (authUser?.uid || authUser?.id);
    if (!effectiveUserId) {
      throw new UnauthorizedException('Authentication required.');
    }
    return this.invitesService.declineInvite(id, effectiveUserId, Boolean(body?.block), body);
  }
}
