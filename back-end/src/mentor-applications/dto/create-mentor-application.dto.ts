import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, ArrayUnique, IsArray, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateMentorApplicationDto {
  @ApiProperty({ description: 'User ID of the applicant', example: '1' })
  @IsString()
  userId!: string;

  @ApiProperty({ description: 'Applicant email address', example: 'mentor@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'Applicant full name', example: 'Riya Sharma' })
  @IsString()
  @MinLength(3)
  name!: string;

  @ApiProperty({ description: 'Applicant biography or motivation statement', example: 'I have mentored six student teams and enjoy helping new developers.', required: false })
  @IsOptional()
  @IsString()
  @MinLength(10)
  bio?: string;

  @ApiProperty({ description: 'Applicant experience summary', example: '7 years in software engineering with leadership and mentoring roles.', required: false })
  @IsOptional()
  @IsString()
  experience?: string;

  @ApiProperty({ description: 'Years of professional experience', example: 5, required: false })
  @IsOptional()
  years?: number;

  @ApiProperty({ description: 'Years of professional experience', example: 5, required: false })
  @IsOptional()
  yearsOfExperience?: number;

  @ApiProperty({ description: 'Applicant LinkedIn URL', example: 'https://linkedin.com/in/mentor', required: false })
  @IsOptional()
  @IsString()
  linkedin?: string;

  @ApiProperty({ description: 'Applicant portfolio URL', example: 'https://portfolio.dev', required: false })
  @IsOptional()
  @IsString()
  portfolio?: string;

  @ApiProperty({ description: 'Applicant motivation statement', example: 'I enjoy mentoring...', required: false })
  @IsOptional()
  @IsString()
  motivation?: string;

  @ApiProperty({ description: 'Area of expertise', example: 'React, Node.js', required: false })
  @IsOptional()
  @IsString()
  expertise?: string;

  @ApiProperty({ description: 'University or institution', example: 'Stanford University', required: false })
  @IsOptional()
  @IsString()
  university?: string;

  @ApiProperty({ description: 'Skills or expertise offered by the applicant', example: ['JavaScript', 'Node.js', 'React'], required: false })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  skills?: string[];
}
