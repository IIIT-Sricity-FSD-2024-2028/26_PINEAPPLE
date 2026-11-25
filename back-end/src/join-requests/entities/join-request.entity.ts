import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class JoinRequestEntity {
  @ApiProperty({ description: 'Unique identifier for the join request' })
  id!: string;

  @ApiProperty({ description: 'User ID making the request' })
  userId!: string;

  @ApiProperty({ description: 'User display name' })
  userName!: string;

  @ApiProperty({ description: 'Target project ID' })
  projectId!: string;

  @ApiProperty({ description: 'Request status' })
  status!: string;

  @ApiProperty({ description: 'User\'s pitch/application message' })
  message!: string;

  @ApiPropertyOptional({ description: 'Role requested' })
  role?: string;

  @ApiPropertyOptional({ description: 'Rejection explanation given by project owner' })
  rejectionReason?: string;

  @ApiPropertyOptional({ description: 'Timestamp when request was decided or closed' })
  decidedAt?: Date | string;

  @ApiPropertyOptional({ description: 'Reason for system closure or member removal' })
  closureReason?: string;

  @ApiPropertyOptional({ description: 'Timestamp when 3-day inactivity reminder was sent' })
  remindedAt?: Date | string;

  @ApiPropertyOptional({ description: 'Alias timestamp when pending review reminder was sent' })
  pendingReminderSentAt?: Date | string;

  @ApiPropertyOptional({ description: 'Timestamp when join request was sent (UTC ISO)' })
  sentAt?: Date | string;

  @ApiPropertyOptional({ description: 'Timestamp when project owner opened the request list (UTC ISO)' })
  viewedAt?: Date | string | null;

  @ApiPropertyOptional({ description: 'Whether this request counts toward the 2-request limit' })
  countedTowardLimit?: boolean;

  @ApiPropertyOptional({ description: 'Up to 3 skill-matched open alternative projects suggested on rejection' })
  suggestedProjects?: Array<{
    id: string;
    title: string;
    description?: string;
    requiredSkills?: string[];
    ownerId?: string;
    owner?: string;
    percent: number;
    shared: string[];
    missing: string[];
  }>;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt!: Date;
}