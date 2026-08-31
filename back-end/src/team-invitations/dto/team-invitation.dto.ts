import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Min } from 'class-validator';

export class CreateInvitationDto {
  @ApiProperty() @IsString() teamId!: string;
  @ApiProperty() @IsString() invitedUserId!: string;
  @ApiProperty({ description: 'User ID of the inviting team lead' }) @IsString() invitedBy!: string;
}

export class AcceptInvitationDto {
  @ApiProperty({ description: 'Full name as it appears on ID' }) @IsString() fullName!: string;
  @ApiProperty() @IsString() collegeName!: string;
  @ApiProperty() @IsInt() @Min(13) age!: number;
  @ApiProperty({ description: 'Base64/URL reference to an uploaded ID card image' }) @IsString() idCardImageRef!: string;
}
