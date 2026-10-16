import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayNotEmpty, ArrayUnique, IsArray, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateMentorApplicationDto {
  @ApiPropertyOptional({ description: 'Applicant biography or motivation statement', example: 'I have mentored six student teams and enjoy helping new developers.' })
  @IsOptional()
  @IsString()
  @MinLength(10)
  bio?: string;

  @ApiPropertyOptional({ description: 'Applicant experience summary', example: '7 years in software engineering with leadership and mentoring roles.' })
  @IsOptional()
  @IsString()
  experience?: string;

  @ApiPropertyOptional({ description: 'Years of professional experience', example: 5 })
  @IsOptional()
  years?: number;

  @ApiPropertyOptional({ description: 'Years of professional experience', example: 5 })
  @IsOptional()
  yearsOfExperience?: number;

  @ApiPropertyOptional({ description: 'Applicant LinkedIn URL' })
  @IsOptional()
  @IsString()
  linkedin?: string;

  @ApiPropertyOptional({ description: 'Applicant portfolio URL' })
  @IsOptional()
  @IsString()
  portfolio?: string;

  @ApiPropertyOptional({ description: 'Applicant motivation statement' })
  @IsOptional()
  @IsString()
  motivation?: string;

  @ApiPropertyOptional({ description: 'Area of expertise' })
  @IsOptional()
  @IsString()
  expertise?: string;

  @ApiPropertyOptional({ description: 'University or institution' })
  @IsOptional()
  @IsString()
  university?: string;

  @ApiPropertyOptional({ description: 'Skills or expertise offered by the applicant', example: ['JavaScript', 'Node.js', 'React'] })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  skills?: string[];

  @ApiPropertyOptional({ description: 'Application status', enum: ['pending', 'approved', 'rejected', 'Pending', 'Approved', 'Rejected'], example: 'approved' })
  @IsOptional()
  @IsIn(['pending', 'approved', 'rejected', 'Pending', 'Approved', 'Rejected'])
  status?: string;
}
