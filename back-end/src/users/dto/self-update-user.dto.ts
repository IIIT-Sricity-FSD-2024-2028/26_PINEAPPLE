import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const SELF_UPDATE_ALLOWED_PROFILE_FIELDS = new Set<string>([
  'fullName',
  'bio',
  'title',
  'university',
  'avatar',
  'avatarUrl',
  'skills',
  'linkedin',
  'linkedIn',
  'portfolio',
  'website',
]);

export const SELF_UPDATE_ALLOWED_TOP_FIELDS = new Set<string>([
  'name',
  'email',
  'bio',
  'title',
  'university',
  'avatar',
  'avatarUrl',
  'skills',
  'linkedIn',
  'linkedin',
  'portfolio',
  'website',
  'links',
  'digestEnabled',
  'digestHour',
  'utcOffsetMinutes',
  'settings',
  'profile',
]);

export function hasUsernameMutationAttempt(body: any): boolean {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return false;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'username') && body.username !== undefined) {
    return true;
  }
  if (
    body.profile &&
    typeof body.profile === 'object' &&
    !Array.isArray(body.profile) &&
    Object.prototype.hasOwnProperty.call(body.profile, 'username') &&
    body.profile.username !== undefined
  ) {
    return true;
  }
  return false;
}

export function findDisallowedSelfUpdateFields(body: any): string[] {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return [];
  }
  const rejected: string[] = [];
  for (const key of Object.keys(body)) {
    if (!SELF_UPDATE_ALLOWED_TOP_FIELDS.has(key)) {
      rejected.push(key);
    }
  }
  if (body.profile && typeof body.profile === 'object' && !Array.isArray(body.profile)) {
    for (const pKey of Object.keys(body.profile)) {
      if (!SELF_UPDATE_ALLOWED_PROFILE_FIELDS.has(pKey)) {
        rejected.push(`profile.${pKey}`);
      }
    }
  }
  return rejected;
}

export class SelfUpdateProfileDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  @ValidateIf((o) => typeof o.university === 'string' && o.university.trim() !== '')
  @Length(2, 100, { message: 'University must be between 2 and 100 characters' })
  @Matches(/^[a-zA-Z0-9\s.,&\-'()]+$/, {
    message:
      "University contains invalid characters. Use letters, numbers, spaces, and common punctuation (. , & - ' ( ))",
  })
  university?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  @IsString()
  linkedin?: string;

  @IsOptional()
  @IsString()
  linkedIn?: string;

  @IsOptional()
  @IsString()
  portfolio?: string;

  @IsOptional()
  @IsString()
  website?: string;
}

export class SelfUpdateUserDto {
  @ApiPropertyOptional({ example: 'Arjun Sharma' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'arjun.new@teamforge.io' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'Full-stack developer passionate about distributed systems.' })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ example: 'Full-stack Developer' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 'IIT Delhi' })
  @IsOptional()
  @IsString()
  @ValidateIf((o) => typeof o.university === 'string' && o.university.trim() !== '')
  @Length(2, 100, { message: 'University must be between 2 and 100 characters' })
  @Matches(/^[a-zA-Z0-9\s.,&\-'()]+$/, {
    message:
      "University contains invalid characters. Use letters, numbers, spaces, and common punctuation (. , & - ' ( ))",
  })
  university?: string;

  @ApiPropertyOptional({ example: '/uploads/avatar-123.png' })
  @IsOptional()
  @IsString()
  avatar?: string;

  @ApiPropertyOptional({ example: '/uploads/avatar-123.png' })
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional({ type: [String], example: ['React', 'TypeScript'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @ApiPropertyOptional({ example: 'https://linkedin.com/in/arjunsharma' })
  @IsOptional()
  @IsString()
  linkedIn?: string;

  @ApiPropertyOptional({ example: 'https://linkedin.com/in/arjunsharma' })
  @IsOptional()
  @IsString()
  linkedin?: string;

  @ApiPropertyOptional({ example: 'https://arjun.dev' })
  @IsOptional()
  @IsString()
  portfolio?: string;

  @ApiPropertyOptional({ example: 'https://arjun.dev/blog' })
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: { type: 'string' } })
  @IsOptional()
  @IsObject()
  links?: Record<string, string>;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  digestEnabled?: boolean;

  @ApiPropertyOptional({ example: 9 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  digestHour?: number;

  @ApiPropertyOptional({ example: 330 })
  @IsOptional()
  @IsInt()
  @Min(-720)
  @Max(840)
  utcOffsetMinutes?: number;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'User notification and UI preferences',
  })
  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;

  @ApiPropertyOptional({ type: SelfUpdateProfileDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SelfUpdateProfileDto)
  profile?: SelfUpdateProfileDto;
}
