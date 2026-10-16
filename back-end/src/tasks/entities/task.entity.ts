import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TaskEntity {
  @ApiProperty({ description: 'Unique identifier for the task' })
  id!: string;

  @ApiProperty({ description: 'Task title' })
  title!: string;

  @ApiPropertyOptional({ description: 'Task description' })
  description?: string;

  @ApiPropertyOptional({ description: 'Assignee User ID' })
  assigneeId?: string;

  @ApiPropertyOptional({ description: 'Assignee Display Name' })
  assigneeName?: string;

  @ApiPropertyOptional({ description: 'Assigned user (email or name)' })
  assignedTo?: string;

  @ApiPropertyOptional({ description: 'Assignee (duplicate for redundancy)' })
  assignee?: string;

  @ApiProperty({ description: 'Task status', enum: ['pending', 'in-progress', 'submitted', 'approved'] })
  status!: 'pending' | 'in-progress' | 'submitted' | 'approved';

  @ApiPropertyOptional({ description: 'Proof link (URL to proof of completion)' })
  proofLink?: string;

  @ApiPropertyOptional({ description: 'Due date (ISO date string)' })
  due?: string;

  @ApiProperty({ description: 'Task priority', enum: ['Low', 'Medium', 'High'] })
  priority!: 'Low' | 'Medium' | 'High';

  @ApiProperty({ description: 'Parent project ID' })
  projectId!: string;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt!: Date;

  @ApiProperty({ description: 'XP points awarded for completion', minimum: 0 })
  points!: number;

  @ApiPropertyOptional({ description: 'Whether XP and reputation have been awarded for this task' })
  xpAwarded?: boolean;

  @ApiPropertyOptional({ description: 'Amount of XP awarded' })
  awardedXp?: number;

  @ApiPropertyOptional({ description: 'Amount of reputation awarded' })
  awardedRep?: number;
}