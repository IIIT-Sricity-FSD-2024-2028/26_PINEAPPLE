import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, IsOptional, IsEnum, IsBoolean } from 'class-validator';

export class CreateNotificationDto {
  @ApiProperty({
    description: 'ID of the user who will receive this notification',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsUUID()
  userId!: string;

  @ApiProperty({
    description: 'Type of notification',
    example: 'PROJECT_INVITATION',
    enum: ['PROJECT_INVITATION', 'APPLICATION_APPROVED', 'TASK_APPROVED', 'MENTOR_REQUEST', 'NEW_MESSAGE', 'PROJECT_UPDATE'],
  })
  @IsString()
  @IsEnum(['PROJECT_INVITATION', 'APPLICATION_APPROVED', 'TASK_APPROVED', 'MENTOR_REQUEST', 'NEW_MESSAGE', 'PROJECT_UPDATE'])
  type!: string;

  @ApiProperty({
    description: 'Notification message content',
    example: 'You have been invited to join the AI Study Planner project',
  })
  @IsString()
  message!: string;

  @ApiProperty({
    description: 'Whether the notification should be marked as read initially',
    example: false,
    default: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  readStatus?: boolean = false;

  @ApiProperty({
    description: 'Reference ID (could be project ID, task ID, etc.)',
    example: '123e4567-e89b-12d3-a456-426614174002',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  referenceId?: string;
}