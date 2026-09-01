import { Body, Controller, Get, Param, Post, UseGuards, Req } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../core/decorators/roles.decorator';
import { RolesGuard } from '../core/guards/roles.guard';
import { HackathonRegistrationsService } from './hackathon-registrations.service';
import { SubmitVerificationDto, VerifyStudentDto, RejectStudentDto } from './dto/register.dto';

@ApiTags('Hackathon Registrations')
@Controller('hackathon-registrations')
@UseGuards(RolesGuard)
export class HackathonRegistrationsController {
  constructor(private readonly service: HackathonRegistrationsService) {}

  @Post('verify-student')
  @Roles('user', 'admin')
  @ApiOperation({ summary: 'Submit student ID for KYC verification' })
  @ApiBody({ type: SubmitVerificationDto })
  submitVerification(@Body() dto: SubmitVerificationDto) {
    return this.service.submitVerification(dto);
  }

  @Get('pending')
  @Roles('admin')
  @ApiOperation({ summary: 'Admin gets all pending student KYC requests' })
  getPending() {
    return this.service.getPendingVerifications();
  }
  
  @Get('status/:userId')
  @Roles('user', 'admin')
  @ApiOperation({ summary: 'Get student KYC verification status' })
  getStatus(@Param('userId') userId: string) {
    return this.service.findByUserId(userId) || { status: 'NotSubmitted' };
  }

  @Post(':id/verify')
  @Roles('admin')
  @ApiOperation({ summary: 'Admin approves KYC' })
  @ApiBody({ type: VerifyStudentDto })
  verify(@Param('id') id: string, @Body() dto: VerifyStudentDto) {
    return this.service.verify(id, dto.verifiedBy);
  }

  @Post(':id/reject')
  @Roles('admin')
  @ApiOperation({ summary: 'Admin rejects KYC with reason' })
  @ApiBody({ type: RejectStudentDto })
  reject(@Param('id') id: string, @Body() dto: RejectStudentDto) {
    return this.service.reject(id, dto.verifiedBy, dto.reason);
  }
}
