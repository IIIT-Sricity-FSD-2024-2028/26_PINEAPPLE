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
  @MinLength(10)
  experience?: string;

  @ApiProperty({ description: 'Skills or expertise offered by the applicant', example: ['JavaScript', 'Node.js', 'React'], required: false })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  skills?: string[];
}
