import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length } from 'class-validator';

export class CreateMentorRequestDto {
  @ApiProperty({ description: 'Target project ID for the mentor request', example: 'proj-1' })
  @IsString()
  projectId!: string;

  @ApiPropertyOptional({ description: 'Target mentor user ID', example: '3' })
  @IsOptional()
  @IsString()
  mentorId?: string;

  @ApiPropertyOptional({ description: 'Target mentor email address', example: 'mentor@example.com' })
  @IsOptional()
  @IsEmail()
  mentorEmail?: string;

  @ApiPropertyOptional({ description: 'Optional message or pitch shared with the mentor', example: 'We would love your guidance on our full-stack project with React and Node.' })
  @IsOptional()
  @IsString()
  @Length(10, 500)
  message?: string;
}
