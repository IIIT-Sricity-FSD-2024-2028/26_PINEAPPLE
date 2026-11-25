import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ActionFeedbackEntity {
  @ApiProperty({ description: 'Unique feedback record identifier' })
  id: string;

  @ApiProperty({ description: 'Action type, e.g. REJECT_WORK, DECLINE_INVITATION' })
  actionType: string;

  @ApiProperty({ description: 'Entity type, e.g. TASK, APPLICATION, INVITE, PROJECT, MENTOR_SESSION' })
  entityType: string;

  @ApiProperty({ description: 'ID of the affected entity' })
  entityId: string;

  @ApiPropertyOptional({ description: 'Associated project ID if applicable' })
  projectId?: string;

  @ApiProperty({ description: 'ID of the user who performed the action' })
  actorUserId: string;

  @ApiPropertyOptional({ description: 'ID of the user affected by the action' })
  targetUserId?: string;

  @ApiProperty({ description: 'Reason IDs in UPPER_SNAKE_CASE', type: [String] })
  reasons: string[];

  @ApiPropertyOptional({ description: 'Human-readable labels for selected reason IDs', type: [String] })
  reasonLabels?: string[];

  @ApiPropertyOptional({ description: 'Optional or mandatory free-text explanation (max 500 characters)' })
  explanation?: string;

  @ApiProperty({ description: 'UTC ISO timestamp of the action' })
  createdAt: string;
}
