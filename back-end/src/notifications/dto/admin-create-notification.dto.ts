import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AdminCreateNotificationDto {
  @ApiProperty({ description: 'Target recipient user ID' })
  @IsNotEmpty({ message: 'Target userId is required.' })
  @IsString()
  userId!: string;

  @ApiProperty({
    description: 'System notification body (10 to 500 characters)',
    minLength: 10,
    maxLength: 500,
  })
  @IsNotEmpty({ message: 'Notification message must be between 10 and 500 characters.' })
  @IsString()
  @MinLength(10, { message: 'Notification message must be between 10 and 500 characters.' })
  @MaxLength(500, { message: 'Notification message must be between 10 and 500 characters.' })
  message!: string;

  @ApiPropertyOptional({ description: 'Optional notification title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Optional notification type' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: 'Optional reference ID' })
  @IsOptional()
  @IsString()
  referenceId?: string;

  @ApiPropertyOptional({ description: 'Optional destination route/link' })
  @IsOptional()
  @IsString()
  link?: string;
}
