import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsBoolean } from 'class-validator';

export class ChangeDeadlineDto {
  @ApiProperty({
    description: 'New project deadline (ISO string)',
    example: '2027-06-30T23:59:59.000Z',
  })
  @IsNotEmpty({ message: 'Project deadline is required.' })
  @IsString()
  dueDate!: string;

  @ApiProperty({
    description: 'Written reason for changing the deadline (minimum 10 characters)',
    example: 'Team requested additional time for QA testing and final polish.',
    minLength: 10,
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    description: 'Whether to shift open task deadlines forward by the difference in days',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  shiftTasks?: boolean;
}

