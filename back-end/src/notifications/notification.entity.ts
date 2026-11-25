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
    description: 'Title of the notification',
    example: 'Project Membership Ended',
    required: false,
  })
  title?: string;

  @ApiProperty({
    description: 'Type of notification',
    example: 'APPLICATION_APPROVED',
    enum: ['APPLICATION_APPROVED', 'TASK_APPROVED', 'MENTOR_REQUEST', 'NEW_MESSAGE', 'PROJECT_UPDATE', 'PROJECT_COMPLETED'],
  })
  type!: string;

  @ApiProperty({
    description: 'Notification message content',
    example: 'Your application to join the AI Study Planner project has been approved',
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

  @ApiProperty({
    description: 'Optional route or URL linking to the relevant resource/project',
    example: '/collaborator/workspace/proj-1',
    required: false,
  })
  link?: string;

  @ApiProperty({
    description: 'Optional structured metadata for UI actions or deep links',
    required: false,
  })
  metadata?: Record<string, any>;

  @ApiProperty({
    description: 'Optional suggested alternative open projects (e.g., on request rejection)',
    required: false,
  })
  suggestedProjects?: any[];

  @ApiProperty({
    description: 'Optional grouping key for aggregated bulk notifications',
    required: false,
  })
  groupKey?: string;

  @ApiProperty({
    description: 'Number of items represented by an aggregated notification',
    required: false,
  })
  count?: number;

  @ApiProperty({
    description: 'List of items (label and optional link) in an aggregated notification',
    required: false,
  })
  items?: Array<{ label: string; link?: string }>;

  priority?: 'immediate' | 'digest';
}