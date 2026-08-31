import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class RegisterParticipantDto {
  @ApiProperty() @IsString() hackathonId!: string;
  @ApiProperty() @IsString() userId!: string;
  @ApiProperty() @IsString() teamId!: string;
  @ApiProperty({ enum: ['lead', 'member'] }) @IsString() role!: 'lead' | 'member';
  @ApiProperty() @IsString() fullName!: string;
  @ApiProperty() @IsString() collegeName!: string;
  @ApiProperty() @IsInt() @Min(13) age!: number;
  @ApiProperty() @IsString() idCardImageRef!: string;
}

export class VerifyRegistrationDto {
  @ApiProperty({ description: 'Platform admin user ID performing the verification' })
  @IsString()
  verifiedBy!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
