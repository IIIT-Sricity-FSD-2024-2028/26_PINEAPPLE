import {
  IsEmail,
  IsString,
  IsOptional,
  IsArray,
  IsNotEmpty,
  Length,
  Matches,
  ValidateIf,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const ALLOWED_SUPERUSER_CREATE_ROLES = [
  'Collaborator',
  'Project Owner',
  'Mentor',
  'Administrator',
  'Super User',
  'collaborator',
  'project-owner',
  'mentor',
  'admin',
  'administrator',
  'superuser',
  'super-user',
] as const;

export class SuperUserCreateUserDto {
  @ApiProperty({ example: 'Ops Admin' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'ops.admin@teamforge.io' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: 'ops_admin' })
  @IsOptional()
  @IsString()
  @Length(3, 30, { message: 'Username must be between 3 and 30 characters.' })
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Username must contain only letters, numbers, underscores, and hyphens.',
  })
  username?: string;

  @ApiPropertyOptional({
    example: 'Administrator',
    description: 'Role assigned by Super User (Collaborator, Project Owner, Mentor, Administrator, Super User)',
  })
  @IsOptional()
  @IsString()
  @IsIn(ALLOWED_SUPERUSER_CREATE_ROLES as unknown as string[], {
    message: 'Invalid role specified.',
  })
  role?: string;

  @ApiPropertyOptional({ type: [String], example: ['Governance', 'Auditing'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  skills?: string[];

  @ApiPropertyOptional({ example: 'Platform operations lead' })
  @IsString()
  @IsOptional()
  bio?: string;

  @ApiPropertyOptional({ example: 'IIT Bombay' })
  @IsString()
  @IsOptional()
  @ValidateIf((o) => typeof o.university === 'string' && o.university.trim() !== '')
  @Length(2, 100, { message: 'University must be between 2 and 100 characters' })
  @Matches(/^[a-zA-Z0-9\s.,&\-'()]+$/, {
    message:
      "University contains invalid characters. Use letters, numbers, spaces, and common punctuation (. , & - ' ( ))",
  })
  university?: string;

  @ApiPropertyOptional({ example: 'https://linkedin.com/in/opsadmin' })
  @IsString()
  @IsOptional()
  linkedIn?: string;
}
