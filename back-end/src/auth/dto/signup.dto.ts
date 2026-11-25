import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const ALLOWED_PUBLIC_SIGNUP_ROLES = [
  'Collaborator',
  'Project Owner',
  'collaborator',
  'project-owner',
] as const;

export class SignupDto {
  @ApiPropertyOptional({ example: 'Aditya Sai' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'adityasai' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiProperty({ example: 'aditya@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ example: 'Collaborator', enum: ['Collaborator', 'Project Owner'] })
  @IsOptional()
  @IsString()
  @IsIn(ALLOWED_PUBLIC_SIGNUP_ROLES as unknown as string[], {
    message: 'Public signup only allows Collaborator or Project Owner roles.',
  })
  role?: string;
}
