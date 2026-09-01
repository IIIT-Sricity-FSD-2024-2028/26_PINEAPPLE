import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateInvitationDto {
  @ApiProperty() @IsString() teamId!: string;
  @ApiProperty() @IsString() invitedUserId!: string;
  @ApiProperty({ description: 'User ID of the inviting team lead' }) @IsString() invitedBy!: string;
}

export class AcceptInvitationDto {
  @ApiPropertyOptional({ description: 'Full name as it appears on ID' }) @IsOptional() @IsString() fullName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() collegeName?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(13) age?: number;
  @ApiPropertyOptional({ description: 'Base64/URL reference to an uploaded ID card image' }) @IsOptional() @IsString() idCardImageRef?: string;
}
