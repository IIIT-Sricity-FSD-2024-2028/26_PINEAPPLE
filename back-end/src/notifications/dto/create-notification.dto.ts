import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsBoolean } from 'class-validator';

export class CreateNotificationDto {
  @ApiProperty({
    description: 'ID of the user who will receive this notification',
    example: '1',
  })
  @IsString()
  userId!: string;

  @ApiProperty({
    description: 'Title of the notification',
    example: 'Project Membership Ended',
    required: false,
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({
    description: 'Type of notification',
    example: 'PROJECT_COMPLETED',
    enum: [
      'APPLICATION_APPROVED',
      'TASK_APPROVED',
      'MENTOR_REQUEST',
      'NEW_MESSAGE',
      'PROJECT_UPDATE',
      'PROJECT_COMPLETED',
      'MENTOR_SESSION_ACCEPTED',
      'MENTOR_SESSION_DECLINED',
      'MENTOR_SESSION_COMPLETED',
      'MENTOR_SESSION_CANCELLED',
    ],
  })
  @IsString()
  @IsEnum([
    'APPLICATION_APPROVED',
    'TASK_APPROVED',
    'MENTOR_REQUEST',
    'NEW_MESSAGE',
    'PROJECT_UPDATE',
    'PROJECT_COMPLETED',
    'MENTOR_SESSION_ACCEPTED',
    'MENTOR_SESSION_DECLINED',
    'MENTOR_SESSION_COMPLETED',
    'MENTOR_SESSION_CANCELLED',
  ])
  type!: string;

  @ApiProperty({
    description: 'Notification message content',
    example: 'Your application to join the AI Study Planner project has been approved',
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
    example: 'proj-1',
    required: false,
  })
  @IsOptional()
  @IsString()
  referenceId?: string;
}