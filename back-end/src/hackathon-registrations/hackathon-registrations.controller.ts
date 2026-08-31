import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles } from '../core/decorators/roles.decorator';
import { RolesGuard } from '../core/guards/roles.guard';
import { HackathonRegistrationsService } from './hackathon-registrations.service';
import { VerifyRegistrationDto } from './dto/register.dto';

// Platform Admin's KYC verification queue — separate from Org Admin actions,
// since identity verification is a platform-trust concern, not an org one.
@ApiTags('Hackathon Registrations (KYC)')
@Controller('hackathon-registrations')
@UseGuards(RolesGuard)
export class HackathonRegistrationsController {
  constructor(private readonly registrationsService: HackathonRegistrationsService) {}

  @Get('pending')
  @Roles('admin', 'superuser')
  @ApiOperation({ summary: "Platform Admin's KYC review queue" })
  findPending() {
    return this.registrationsService.findPending();
  }

  @Get()
  @Roles('user')
  @ApiQuery({ name: 'hackathonId', required: false })
  @ApiQuery({ name: 'teamId', required: false })
  find(@Query('hackathonId') hackathonId?: string, @Query('teamId') teamId?: string) {
    if (teamId) return this.registrationsService.findByTeam(teamId);
    if (hackathonId) return this.registrationsService.findByHackathon(hackathonId);
    return this.registrationsService.findAll();
  }

  @Post(':id/verify')
  @Roles('admin', 'superuser')
  @ApiOperation({ summary: 'Platform Admin approves a participant\'s KYC' })
  @ApiBody({ type: VerifyRegistrationDto })
  verify(@Param('id') id: string, @Body() dto: VerifyRegistrationDto) {
    return this.registrationsService.verify(id, dto.verifiedBy);
  }

  @Post(':id/reject')
  @Roles('admin', 'superuser')
  @ApiBody({ type: VerifyRegistrationDto })
  reject(@Param('id') id: string, @Body() dto: VerifyRegistrationDto) {
    return this.registrationsService.reject(id, dto.verifiedBy, dto.reason);
  }
}
