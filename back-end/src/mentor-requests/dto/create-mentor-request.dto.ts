import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateMentorRequestDto {
  @ApiProperty({ description: 'Target project ID for the mentor request', example: 'c9b1d92a-a73f-4a4c-8b0f-2d2f78a8de12' })
  @IsUUID()
  projectId!: string;

  @ApiPropertyOptional({ description: 'Target mentor user ID', example: 'a1d2c3b4-e5f6-7890-1234-56789abcdef0' })
  @IsOptional()
  @IsUUID()
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
