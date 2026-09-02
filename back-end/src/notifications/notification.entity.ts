import { ApiProperty } from '@nestjs/swagger';

export class Notification {
  @ApiProperty({
    description: 'Unique identifier for the notification',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'ID of the user who owns this notification',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  userId!: string;

  @ApiProperty({
    description: 'Type of notification',
    example: 'PROJECT_INVITATION',
    enum: ['PROJECT_INVITATION', 'APPLICATION_APPROVED', 'TASK_APPROVED', 'MENTOR_REQUEST', 'NEW_MESSAGE', 'PROJECT_UPDATE'],
  })
  type!: string;

  @ApiProperty({
    description: 'Notification message content',
    example: 'You have been invited to join the AI Study Planner project',
  })
  message!: string;

  @ApiProperty({
    description: 'Whether the notification has been read',
    example: false,
    default: false,
  })
  readStatus!: boolean;

  @ApiProperty({
    description: 'Timestamp when the notification was created',
    example: '2024-01-15T10:30:00Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Reference ID (could be project ID, task ID, etc.)',
    example: '123e4567-e89b-12d3-a456-426614174002',
    required: false,
  })
  referenceId?: string;
}