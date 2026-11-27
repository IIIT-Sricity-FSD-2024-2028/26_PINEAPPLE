import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Headers,
  Req,
  Res,
  Inject,
  forwardRef,
  Optional,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { ModuleRef } from '@nestjs/core';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { SuperUserCreateUserDto } from './dto/superuser-create-user.dto';
import { SelfUpdateUserDto } from './dto/self-update-user.dto';
import { SuperUserDeleteUserDto } from './dto/superuser-delete-user.dto';
import { SelfAccountUpdateGuard } from './guards/self-update.guard';
import { stripUserSecrets } from './user-serializer';
import { normalizeRole } from '../common/utils/role.util';
import { UpdateUsernameDto } from './dto/update-username.dto';
import { VerifyPhoneDto } from './dto/verify-phone.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { UpdateUserSettingsDto } from './dto/update-user-settings.dto';
import { Roles } from '../core/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { ReputationService } from '../moderation/reputation.service';
import { JoinRequestsService } from '../join-requests/join-requests.service';
import { ProjectInvitesService } from '../projects/invites.service';
import { DataExportService } from './data-export.service';
import { AccountDeletionService } from './account-deletion.service';
import { TrustService } from './trust.service';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly reputationService: ReputationService,
    private readonly moduleRef: ModuleRef,
    @Optional() private readonly dataExportService?: DataExportService,
    @Optional() private readonly accountDeletionService?: AccountDeletionService,
    @Optional() private readonly trustService?: TrustService,
  ) {}

  @Roles('superuser')
  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new user with optional elevated role (Super User only)' })
  @ApiResponse({ status: 201, description: 'The user has been successfully created.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 403, description: 'Forbidden - Super User role required.' })
  create(
    @Body() createUserDto: SuperUserCreateUserDto,
    @CurrentUser() caller: any,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const actorId = isLegacy
      ? caller?.uid || headerUserId || 'superuser'
      : caller?.uid || caller?.id || 'superuser';
    return this.usersService.createBySuperUser(createUserDto, actorId);
  }

  @Post('switch-role')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Switch current active role' })
  switchRole(
    @CurrentUser() caller: any,
    @Headers('x-user-id') headerUserId: string,
    @Body() body: { role: string },
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const userId = isLegacy ? (caller?.uid || headerUserId) : (caller?.uid || caller?.id);
    if (!userId) {
      throw new UnauthorizedException('Authentication required.');
    }
    return this.usersService.switchRole(userId, body.role);
  }

  @Post('me/phone/verify')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify and link phone number using Firebase Phone Auth ID token' })
  @ApiResponse({ status: 200, description: 'Phone number verified and linked successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid token or token claims.' })
  @ApiResponse({ status: 409, description: 'Phone number already linked to another account.' })
  @ApiResponse({ status: 429, description: 'Too many verification attempts.' })
  @ApiResponse({ status: 503, description: 'Phone verification is not configured.' })
  verifyPhone(
    @Body() verifyPhoneDto: VerifyPhoneDto,
    @CurrentUser() caller: any,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const userId = isLegacy ? headerUserId : (caller?.uid || caller?.id);
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }
    return this.usersService.verifyPhone(userId, verifyPhoneDto.idToken);
  }

  @Get('me/phone/otp-status')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current OTP attempt count and lockout status for the signed-in user' })
  @ApiResponse({ status: 200, description: 'OTP challenge status returned.' })
  getPhoneOtpStatus(
    @CurrentUser() caller: any,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const userId = isLegacy ? headerUserId : (caller?.uid || caller?.id);
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }
    return this.usersService.getOtpStatus(userId);
  }

  @Post('me/phone/request-otp')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start a backend phone OTP challenge (enforces 15-min lockout after 5 wrong attempts)' })
  @ApiResponse({ status: 200, description: 'OTP challenge created.' })
  @ApiResponse({ status: 409, description: 'Phone already used by another account.' })
  @ApiResponse({ status: 429, description: 'OTP verification locked for 15 minutes.' })
  requestPhoneOtp(
    @Body() body: { phone: string },
    @CurrentUser() caller: any,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const userId = isLegacy ? headerUserId : (caller?.uid || caller?.id);
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }
    return this.usersService.requestPhoneOtp(userId, body?.phone);
  }

  @Post('me/phone/verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify a phone OTP code (5 wrong attempts voids code and locks for 15 minutes)' })
  @ApiResponse({ status: 200, description: 'Phone verified successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid, expired, or void OTP.' })
  @ApiResponse({ status: 429, description: 'OTP locked for 15 minutes.' })
  verifyPhoneOtp(
    @Body() body: { code: string; phone?: string },
    @CurrentUser() caller: any,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const userId = isLegacy ? headerUserId : (caller?.uid || caller?.id);
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }
    return this.usersService.verifyPhoneOtp(userId, body?.code, body?.phone);
  }

  @Post('me/phone/failed-attempt')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Record a failed OTP attempt (voids active challenge and locks on 5th wrong attempt)' })
  recordFailedOtpAttempt(
    @CurrentUser() caller: any,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const userId = isLegacy ? headerUserId : (caller?.uid || caller?.id);
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }
    return this.usersService.recordFailedOtpAttempt(userId);
  }

  @Delete('me/phone')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove phone number and reset verified flag' })
  @ApiResponse({ status: 200, description: 'Phone number removed successfully.' })
  deletePhone(
    @CurrentUser() caller: any,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const userId = isLegacy ? headerUserId : (caller?.uid || caller?.id);
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }
    return this.usersService.deletePhone(userId);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile, completion state, and confirmation flag' })
  @ApiResponse({ status: 200, description: 'Current authenticated user profile returned.' })
  async getMe(
    @CurrentUser() caller: any,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const userId = isLegacy ? headerUserId : (caller?.uid || caller?.id);
    if (!userId) {
      throw new UnauthorizedException('Authentication required.');
    }
    const fullUser = this.usersService.findRawUserById(userId);
    const profileComplete = caller?.profileComplete !== undefined
      ? caller.profileComplete
      : (fullUser ? fullUser.profileComplete !== false : false);
    const needsUsernameConfirmation = Boolean(
      caller?.usernameAutoGenerated ||
      fullUser?.usernameAutoGenerated
    );
    const mentoredProjects = await this.usersService.getLiveMentoredProjects(userId);

    if (!fullUser) {
      return stripUserSecrets({
        id: userId,
        uid: userId,
        email: caller?.email || '',
        name: caller?.name || '',
        username: caller?.username || '',
        role: caller?.role || 'Collaborator',
        profileComplete: Boolean(profileComplete),
        needsUsernameConfirmation,
        emailVerified: caller?.emailVerified !== false,
        mentoredProjects,
      });
    }

    const safe = this.usersService.findById(userId);
    return stripUserSecrets({
      ...safe,
      id: fullUser.id,
      uid: fullUser.id,
      email: fullUser.email,
      name: fullUser.name,
      username: fullUser.username,
      profileComplete: fullUser.profileComplete !== false,
      needsUsernameConfirmation,
      emailVerified: fullUser.emailVerified !== false,
      mentoredProjects,
    });
  }

  @Patch('me/username')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm or change username' })
  @ApiResponse({ status: 200, description: 'Username updated or confirmed successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request / Username required.' })
  @ApiResponse({ status: 409, description: 'Username already taken.' })
  updateUsername(
    @Body() body: UpdateUsernameDto,
    @CurrentUser() caller: any,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const userId = isLegacy ? headerUserId : (caller?.uid || caller?.id);
    if (!userId) {
      throw new UnauthorizedException('Authentication required.');
    }
    return this.usersService.confirmOrChangeUsername(userId, body);
  }

  @Get('me/reputation')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get paginated reputation ledger for current user' })
  @ApiResponse({ status: 200, description: 'Paginated reputation ledger returned successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid pagination parameters.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  getMyReputation(
    @CurrentUser() caller: any,
    @Headers('x-user-id') headerUserId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const userId = isLegacy ? headerUserId : (caller?.uid || caller?.id);
    if (!userId) {
      throw new UnauthorizedException('Authentication required.');
    }
    const paginated = this.reputationService.getPaginatedEntries(userId, { page, limit, type });
    return {
      ...paginated,
      reputation: this.reputationService.getTotal(userId),
    };
  }

  @Get('me/trust')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get trust summary for current authenticated user' })
  @ApiResponse({ status: 200, description: 'Trust summary returned successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  getMyTrust(
    @CurrentUser() caller: any,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const userId = isLegacy ? headerUserId : (caller?.uid || caller?.id);
    if (!userId) {
      throw new UnauthorizedException('Authentication required.');
    }
    if (!this.trustService) {
      throw new NotFoundException('Trust service unavailable.');
    }
    return this.trustService.getSummary(userId, caller || { id: userId });
  }

  @Post('trust-summaries')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get bulk trust summaries for multiple users (max 50)' })
  @ApiResponse({ status: 200, description: 'Bulk trust summaries returned successfully.' })
  @ApiResponse({ status: 400, description: 'Too many IDs or bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  getTrustSummaries(
    @Body() body: { ids: string[] },
    @CurrentUser() caller: any,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const userId = isLegacy ? headerUserId : (caller?.uid || caller?.id);
    if (!userId) {
      throw new UnauthorizedException('Authentication required.');
    }
    if (!this.trustService) {
      throw new NotFoundException('Trust service unavailable.');
    }
    if (!body || !Array.isArray(body.ids)) {
      throw new BadRequestException('Request body must contain an "ids" array.');
    }
    return this.trustService.getSummaries(body.ids, caller || { id: userId });
  }

  @Get('me/invites')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List direct project invitations received by the current user' })
  @ApiResponse({ status: 200, description: 'Returns list of project invitations.' })
  getMyInvites(
    @CurrentUser() caller: any,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const userId = isLegacy ? headerUserId : (caller?.uid || caller?.id);
    if (!userId) {
      throw new UnauthorizedException('Authentication required.');
    }
    const invitesService = this.moduleRef.get(ProjectInvitesService, { strict: false });
    if (!invitesService || typeof invitesService.listForUser !== 'function') {
      return [];
    }
    return invitesService.listForUser(userId);
  }

  @Post('me/export')
  @UseGuards(EmailVerifiedGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Request personal account data JSON export (max 1 per hour)' })
  @ApiResponse({ status: 202, description: 'Export created and ready for download for 24 hours.' })
  @ApiResponse({ status: 429, description: 'EXPORT_RATE_LIMIT: At most 1 export request per hour.' })
  requestDataExport(
    @CurrentUser() caller: any,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const userId = isLegacy ? headerUserId : (caller?.uid || caller?.id);
    if (!userId) {
      throw new UnauthorizedException('Authentication required.');
    }
    if (!isLegacy && !this.usersService.findRawUserById(userId)) {
      throw new UnauthorizedException({
        statusCode: 401,
        error: 'Unauthorized',
        code: 'SESSION_INVALID',
        message: 'Your session is no longer valid. Please log in again.',
      });
    }
    const exporter = this.dataExportService || this.moduleRef.get(DataExportService, { strict: false });
    return exporter.requestExport(userId);
  }

  @Get('me/export')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List personal data export requests for the current user' })
  listDataExports(
    @CurrentUser() caller: any,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const userId = isLegacy ? headerUserId : (caller?.uid || caller?.id);
    if (!userId) {
      throw new UnauthorizedException('Authentication required.');
    }
    const exporter = this.dataExportService || this.moduleRef.get(DataExportService, { strict: false });
    return exporter.listExportsForUser(userId);
  }

  @Get('me/export/:id/download')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Download personal account data JSON archive' })
  @ApiResponse({ status: 200, description: 'Returns JSON archive file.' })
  @ApiResponse({ status: 403, description: 'Forbidden for other users.' })
  @ApiResponse({ status: 404, description: 'EXPORT_NOT_FOUND or EXPORT_EXPIRED.' })
  downloadDataExport(
    @Param('id') id: string,
    @CurrentUser() caller: any,
    @Res() res: Response,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const userId = isLegacy ? headerUserId : (caller?.uid || caller?.id);
    if (!userId) {
      throw new UnauthorizedException('Authentication required.');
    }
    const exporter = this.dataExportService || this.moduleRef.get(DataExportService, { strict: false });
    const file = exporter.getExportDownload(id, userId);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    return res.status(HttpStatus.OK).send(file.content);
  }

  @Get('me/export/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check status of a personal data export request' })
  getDataExportStatus(
    @Param('id') id: string,
    @CurrentUser() caller: any,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const userId = isLegacy ? headerUserId : (caller?.uid || caller?.id);
    if (!userId) {
      throw new UnauthorizedException('Authentication required.');
    }
    const exporter = this.dataExportService || this.moduleRef.get(DataExportService, { strict: false });
    return exporter.getExportStatus(id, userId);
  }

  @Post('me/delete')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Permanently delete and anonymise the signed-in user account' })
  @ApiResponse({ status: 200, description: 'Account deleted and anonymised.' })
  @ApiResponse({ status: 400, description: 'USERNAME_MISMATCH when typed username does not match.' })
  @ApiResponse({ status: 403, description: 'ADMIN_CANNOT_SELF_DELETE or ACCOUNT_SUSPENDED.' })
  @ApiResponse({ status: 409, description: 'ACCOUNT_HAS_OPEN_OBLIGATIONS.' })
  @ApiResponse({ status: 429, description: 'DELETE_RATE_LIMIT (max 3 attempts per hour per account).' })
  deleteMyAccount(
    @Body() body: DeleteAccountDto,
    @CurrentUser() caller: any,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const userId = isLegacy ? headerUserId : (caller?.uid || caller?.id);
    if (!userId) {
      throw new UnauthorizedException('Authentication required.');
    }
    if (
      !isLegacy &&
      !this.usersService.findRawUserById(userId) &&
      !(caller?.email && this.usersService.findRawUserByEmail(caller.email))
    ) {
      throw new UnauthorizedException({
        statusCode: 401,
        error: 'Unauthorized',
        code: 'SESSION_INVALID',
        message: 'Your session is no longer valid. Please log in again.',
      });
    }
    const deletion =
      this.accountDeletionService || this.moduleRef.get(AccountDeletionService, { strict: false });
    return deletion.deleteMyAccount(
      userId,
      { username: body?.username },
      isLegacy ? undefined : caller?.email,
    );
  }

  @Get('me/deletion-check')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check if user account has active tasks or open obligations blocking deletion' })
  @ApiResponse({ status: 200, description: 'Deletion eligibility and blockers check.' })
  checkDeletionEligibility(
    @CurrentUser() caller: any,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const userId = isLegacy ? headerUserId : (caller?.uid || caller?.id);
    if (!userId) {
      throw new UnauthorizedException('Authentication required.');
    }
    const deletion =
      this.accountDeletionService || this.moduleRef.get(AccountDeletionService, { strict: false });
    return deletion.checkDeletionEligibility(userId, isLegacy ? undefined : caller?.email);
  }

  @Get('me/settings')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get settings for current user' })
  getMySettings(
    @CurrentUser() caller: any,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const userId = isLegacy ? headerUserId : (caller?.uid || caller?.id);
    if (!userId) {
      throw new UnauthorizedException('Authentication required.');
    }
    return this.usersService.getUserSettings(userId);
  }

  @Patch('me/settings')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update settings for current user' })
  updateMySettings(
    @Body() _body: UpdateUserSettingsDto,
    @CurrentUser() caller: any,
    @Req() req: any,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const rawBody = req?.body || _body || {};
    if (
      (Object.prototype.hasOwnProperty.call(rawBody, 'username') && rawBody.username !== undefined) ||
      (rawBody.profile && Object.prototype.hasOwnProperty.call(rawBody.profile, 'username') && rawBody.profile.username !== undefined)
    ) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'USERNAME_IMMUTABLE',
        message: "Your username can't be changed.",
      });
    }
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const userId = isLegacy ? headerUserId : (caller?.uid || caller?.id);
    if (!userId) {
      throw new UnauthorizedException('Authentication required.');
    }
    return this.usersService.updateUserSettings(userId);
  }

  @Get()
  @Roles('admin', 'superuser')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all users (Admin with users permission or Super User only)' })
  @ApiResponse({ status: 200, description: 'Returns an array of users.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  findAll(
    @CurrentUser() caller: any,
    @Headers('x-user-role') headerUserRole?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const role = normalizeRole(isLegacy ? (caller?.role || headerUserRole) : caller?.role);
    if (role !== 'superuser') {
      const perms = Array.isArray(caller?.permissions) ? caller.permissions : [];
      if (role !== 'admin' || (!perms.includes('*') && !perms.includes('users'))) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'Forbidden',
          code: 'FORBIDDEN',
          message: 'Admin users permission or Super User role required.',
        });
      }
    }
    return this.usersService.findAll();
  }

  @Public()
  @Get('username-available')
  @ApiOperation({ summary: 'Check if a username is available' })
  @ApiResponse({ status: 200, description: 'Returns whether the username is available.' })
  checkUsernameAvailable(
    @Query('username') username: string,
    @Query('excludeUserId') excludeUserId?: string,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const exclude = excludeUserId || headerUserId;
    const available = this.usersService.isUsernameAvailable(username, exclude);
    return { available };
  }

  @Get('search')
  @ApiOperation({ summary: 'Search users for reporting (min 2 chars, max 10, excludes self and portal accounts)' })
  @ApiResponse({ status: 200, description: 'Returns matching users with safe public fields only.' })
  searchUsers(
    @Query('q') query: string,
    @CurrentUser() caller: any,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const callerId = isLegacy ? headerUserId : (caller?.uid || caller?.id);
    return this.usersService.searchUsers(query, callerId || '');
  }

  @Get(':id/trust')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get trust summary for a user (public stats, or private score if self/admin)' })
  @ApiResponse({ status: 200, description: 'Trust summary returned successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  getTrust(
    @Param('id') id: string,
    @CurrentUser() caller: any,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const callerId = isLegacy ? headerUserId : (caller?.uid || caller?.id);
    if (!callerId) {
      throw new UnauthorizedException('Authentication required.');
    }
    if (!this.trustService) {
      throw new NotFoundException('Trust service unavailable.');
    }
    return this.trustService.getSummary(id, caller || { id: callerId });
  }

  @Get(':id/badges')
  @ApiOperation({ summary: 'Get all recommendation badges awarded to a user' })
  @ApiResponse({ status: 200, description: 'Returns an array of recommendation badges.' })
  getBadges(@Param('id') id: string) {
    const user = this.usersService.findById(id);
    return user?.data?.mentorRecommendations || [];
  }

  @Get(':id/public-profile')
  @ApiOperation({ summary: 'Get applicant public profile (restricted to authorized project owners & admins)' })
  @ApiResponse({ status: 200, description: 'Returns the applicant public profile.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  getPublicProfile(
    @Param('id') id: string,
    @CurrentUser() caller: any,
    @Headers('x-user-id') headerUserId?: string,
    @Headers('x-user-role') headerUserRole?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const callerId = isLegacy ? headerUserId : (caller?.uid || caller?.id);
    const callerRole = isLegacy ? headerUserRole : caller?.role;
    return this.usersService.getPublicProfile(id, callerId, callerRole);
  }

  @Public()
  @Get(':id/response-time')
  @ApiOperation({ summary: 'Get owner response time telemetry (public numbers only)' })
  @ApiResponse({ status: 200, description: 'Median response hours and sample count' })
  getResponseTime(@Param('id') id: string) {
    try {
      const joinRequestsService = this.moduleRef.get(JoinRequestsService, { strict: false });
      if (joinRequestsService) {
        return joinRequestsService.computeOwnerResponseTime(id);
      }
    } catch {}
    return { medianHours: null, sample: 0 };
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a user by ID (owner or Admin with users permission only)' })
  @ApiResponse({ status: 200, description: 'Returns a single user.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  findById(
    @Param('id') id: string,
    @CurrentUser() caller: any,
    @Headers('x-user-id') headerUserId?: string,
    @Headers('x-user-role') headerUserRole?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const callerId = isLegacy ? (caller?.uid || headerUserId) : (caller?.uid || caller?.id);
    const callerRole = normalizeRole(isLegacy ? (caller?.role || headerUserRole) : caller?.role);
    const perms = Array.isArray(caller?.permissions) ? caller.permissions : [];
    const isSelf = Boolean(callerId && String(callerId) === String(id));
    const isSuperUser = callerRole === 'superuser';
    const isAdminWithUsers =
      callerRole === 'admin' && (perms.includes('*') || perms.includes('users'));

    if (!isSelf && !isSuperUser && !isAdminWithUsers) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'FORBIDDEN',
        message: 'You do not have permission to view this user account.',
      });
    }

    const user = this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found.`);
    }
    return user;
  }

  @Patch(':id')
  @Roles('Administrator', 'Collaborator', 'Project Owner', 'Mentor', 'User', 'Super User')
  @UseGuards(SelfAccountUpdateGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update own profile (allow-listed fields only)' })
  @ApiResponse({ status: 200, description: 'The user has been successfully updated.' })
  @ApiResponse({ status: 400, description: 'Field not allowed or validation failed.' })
  @ApiResponse({ status: 403, description: 'Forbidden - not your account.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  update(
    @Param('id') id: string,
    @Body() updateUserDto: SelfUpdateUserDto,
    @CurrentUser() authUser: any,
    @Req() req: any,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const uid = isLegacy ? (authUser?.uid || headerUserId) : (authUser?.uid || authUser?.id);
    const jti = authUser?.claims?.jti;
    const refreshToken = req?.cookies?.teamforge_refresh_token || req?.cookies?.tf_refresh;
    return this.usersService.selfUpdate(id, updateUserDto, {
      callerId: String(uid || ''),
      jti,
      refreshToken,
      ip: req?.ip || req?.socket?.remoteAddress,
    });
  }

  @Delete(':id')
  @Roles('superuser')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a user account (Super User only, with written reason and open-obligations check)' })
  @ApiResponse({ status: 200, description: 'The user has been successfully deleted and anonymized.' })
  @ApiResponse({ status: 400, description: 'Deletion reason is required.' })
  @ApiResponse({ status: 403, description: 'Forbidden - Super User role required or cannot delete Super User.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  @ApiResponse({ status: 409, description: 'User has open obligations.' })
  delete(
    @Param('id') id: string,
    @Body() body: SuperUserDeleteUserDto,
    @CurrentUser() caller: any,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const actorId = isLegacy
      ? caller?.uid || headerUserId || 'superuser'
      : caller?.uid || caller?.id || 'superuser';
    return this.accountDeletionService!.deleteUserBySuperUser(
      String(actorId),
      id,
      body?.reason,
    );
  }
}
