import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class CreateOrganizationDto {
  @ApiProperty() @IsString() name!: string;
  @ApiProperty() @IsString() domain!: string;
  @ApiProperty() @IsEmail() contactEmail!: string;
  @ApiProperty({ description: 'User ID to designate as the initial Org Admin (the host account)' })
  @IsString()
  orgAdminUserId!: string;
}
