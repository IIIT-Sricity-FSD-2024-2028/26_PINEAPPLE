import { IsIn, IsNotEmpty, IsOptional, IsString, Length, Matches, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProfileDto {
  @ApiProperty({ example: 'Aditya Sai' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'adityasai' })
  @IsString()
  @IsNotEmpty({ message: 'Username is required.' })
  @Length(3, 30, { message: 'Username must be between 3 and 30 characters.' })
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Username must contain only letters, numbers, underscores, and hyphens.',
  })
  username: string;

  @ApiPropertyOptional({ example: 'Collaborator', enum: ['Collaborator', 'Project Owner'] })
  @IsOptional()
  @IsString()
  @IsIn(['Collaborator', 'Project Owner', 'collaborator', 'project-owner'], {
    message: 'Profile creation only allows Collaborator or Project Owner roles.',
  })
  role?: string;

  @ApiPropertyOptional({ example: 'IIT Bombay' })
  @IsOptional()
  @IsString()
  @ValidateIf((o) => typeof o.university === 'string' && o.university.trim() !== '')
  @Length(2, 100, { message: 'University must be between 2 and 100 characters' })
  @Matches(/^[a-zA-Z0-9\s.,&\-'()]+$/, {
    message: "University contains invalid characters. Use letters, numbers, spaces, and common punctuation (. , & - ' ( ))",
  })
  university?: string;
}
