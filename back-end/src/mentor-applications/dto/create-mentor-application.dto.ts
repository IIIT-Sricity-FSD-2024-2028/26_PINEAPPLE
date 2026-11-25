import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayNotEmpty, ArrayUnique, IsArray, IsEmail, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

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

  @ApiProperty({ description: 'Applicant headline', example: 'Senior Systems Engineer & Mentor', required: false })
  @IsOptional()
  @IsString()
  headline?: string;

  @ApiProperty({ description: 'Applicant biography or motivation statement', example: 'I have mentored six student teams and enjoy helping new developers.', required: false })
  @IsOptional()
  @IsString()
  @MinLength(10)
  bio?: string;

  @ApiProperty({ description: 'Applicant experience summary', example: '7 years in software engineering with leadership and mentoring roles.', required: false })
  @IsOptional()
  @IsString()
  experience?: string;

  @ApiProperty({ description: 'Years of professional experience (whole number 5 to 40)', example: 5, required: false })
  @IsOptional()
  @IsInt({ message: 'Years of experience must be an integer.' })
  @Min(5, { message: 'Years of experience must be between 5 and 40.' })
  @Max(40, { message: 'Years of experience must be between 5 and 40.' })
  years?: number;

  @ApiProperty({ description: 'Years of professional experience alias (whole number 5 to 40)', example: 5, required: false })
  @IsOptional()
  @IsInt({ message: 'Years of experience must be an integer.' })
  @Min(5, { message: 'Years of experience must be between 5 and 40.' })
  @Max(40, { message: 'Years of experience must be between 5 and 40.' })
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

  @ApiPropertyOptional({ description: 'University or institution alias', example: 'Stanford University' })
  @IsOptional()
  @IsString()
  institution?: string;

  @ApiProperty({ description: 'Uploaded CV filename on secure server', required: false })
  @IsOptional()
  @IsString()
  cvFileName?: string;

  @ApiProperty({ description: 'Original filename of the uploaded CV', required: false })
  @IsOptional()
  @IsString()
  cvOriginalName?: string;

  @ApiProperty({ description: 'Uploaded CV file size in bytes', required: false })
  @IsOptional()
  cvFileSize?: number;

  @ApiProperty({ description: 'Authorised download URL for CV', required: false })
  @IsOptional()
  @IsString()
  cvUrl?: string;

  @ApiProperty({ description: 'DigiLocker certificates', required: false })
  @IsOptional()
  @IsArray()
  certificates?: any[];

  @ApiProperty({ description: 'Excluded unverified certificates', required: false })
  @IsOptional()
  @IsArray()
  excludedCertificates?: any[];

  @ApiProperty({ description: 'Skills or expertise offered by the applicant', example: ['JavaScript', 'Node.js', 'React'], required: false })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  skills?: string[];
}
