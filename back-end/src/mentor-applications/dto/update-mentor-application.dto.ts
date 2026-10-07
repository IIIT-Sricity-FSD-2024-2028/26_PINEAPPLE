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
  @MinLength(10)
  experience?: string;

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
