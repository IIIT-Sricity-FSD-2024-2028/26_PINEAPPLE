import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEmail, IsIn, IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class CreatePortalAdminDto {
  @ApiProperty({ description: 'Display name of the portal admin' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Email address of the portal admin' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'Password for the portal admin account', minLength: 8 })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message: 'Password must contain uppercase, lowercase, number and special character',
  })
  password!: string;

  @ApiProperty({ description: 'Portal admin role', enum: ['admin', 'superuser'], default: 'admin' })
  @IsString()
  @IsIn(['admin', 'superuser'])
  portalRole!: 'admin' | 'superuser';

  @ApiProperty({ description: 'Permissions granted to the portal admin', type: [String] })
  @IsArray()
  @IsString({ each: true })
  permissions!: string[];
}
