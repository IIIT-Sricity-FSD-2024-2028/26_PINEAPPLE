import { IsEmail, IsString, IsEnum, IsOptional, IsArray, IsBoolean, IsUrl, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum UserRole {
  Collaborator = 'Collaborator',
  ProjectOwner = 'Project Owner',
  Mentor = 'Mentor',
  Administrator = 'Administrator',
  SuperUser = 'Super User',
}

export enum UserStatus {
  Active = 'Active',
  Suspended = 'Suspended',
  Warned = 'Warned',
  Flagged = 'Flagged',
  Banned = 'Banned',
}

export class CreateUserDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ enum: UserRole, example: UserRole.Collaborator })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiPropertyOptional({ type: [String], example: ['React', 'NestJS'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  skills?: string[];

  @ApiPropertyOptional({ example: 'https://linkedin.com/in/johndoe' })
  @IsUrl()
  @IsOptional()
  linkedIn?: string;

  @ApiPropertyOptional({ enum: UserStatus, default: UserStatus.Active })
  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus;

  @ApiPropertyOptional({ example: false, default: false })
  @IsBoolean()
  @IsOptional()
  flags?: boolean;

  /** Extended profile object — bio, username, phone, avatarUrl, xp, rep, etc. */
  @ApiPropertyOptional({ description: 'Extended profile fields', type: 'object' })
  @IsObject()
  @IsOptional()
  profile?: Record<string, any>;
}
