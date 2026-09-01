import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { TeamState } from '../entities/team.entity';

export class CreateTeamDto {
  @ApiProperty() @IsString() hackathonId!: string;
  @ApiProperty() @IsString() name!: string;
  @ApiProperty({ description: 'User ID of the team lead (creator)' }) @IsString() leadUserId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() college?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() studentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() idCardImage?: string;
  @ApiPropertyOptional({ enum: TeamState }) @IsOptional() status?: TeamState;
}

export class ApproveTeamDto {
  @ApiProperty({ description: 'Admin user ID approving the team' }) @IsString() verifiedBy!: string;
}

export class RejectTeamDto {
  @ApiProperty({ description: 'Admin user ID rejecting the team' }) @IsString() verifiedBy!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
}

export class SubmitProjectDto {
  @ApiProperty() @IsString() submittedBy!: string;
  @ApiProperty() @IsString() repoUrl!: string;
  @ApiProperty() @IsString() demoUrl!: string;
  @ApiProperty() @IsString() presentationUrl!: string;
}
