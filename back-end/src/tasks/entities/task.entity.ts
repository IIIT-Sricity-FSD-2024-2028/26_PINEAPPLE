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

  @ApiPropertyOptional({ description: 'Visible rejection reason when sent back for revision' })
  rejectionReason?: string;

  @ApiPropertyOptional({ description: 'Timestamp of the latest rejection' })
  rejectedAt?: string;

  @ApiPropertyOptional({ description: 'User ID of who rejected the submission' })
  rejectedBy?: string;

  @ApiPropertyOptional({ description: 'History of all task rejection reasons' })
  rejectionHistory?: Array<{ reason: string; at: string; by: string }>;

  @ApiPropertyOptional({ description: 'Whether the task was auto-approved after 7 days' })
  autoApproved?: boolean;

  @ApiPropertyOptional({ description: 'Timestamp when day-3 review reminder was sent' })
  reviewReminderSentAt?: string;

  @ApiPropertyOptional({ description: 'Timestamp when task entered In Review status' })
  inReviewSince?: string;

  @ApiPropertyOptional({ description: 'Timestamp when task was approved' })
  approvedAt?: string;

  @ApiPropertyOptional({ description: 'Timestamp when task was assigned to the current assignee' })
  assignedAt?: string;

  @ApiPropertyOptional({ description: 'Timestamp when task was submitted for review' })
  submittedAt?: string;

  @ApiPropertyOptional({ description: 'History of task due date changes' })
  dueDateHistory?: Array<{
    previousDueDate: string;
    newDueDate: string;
    creditMs?: number;
    reason: string;
    at: string;
    extendedProject?: boolean;
  }>;

  @ApiPropertyOptional({ description: 'Submission timestamp that was last credited for review' })
  lastCreditedSubmissionAt?: string;

  @ApiPropertyOptional({ description: 'Timestamp when due-soon notification was sent' })
  dueSoonNotifiedAt?: string;

  @ApiPropertyOptional({ description: 'Timestamp when overdue notification was sent' })
  overdueNotifiedAt?: string;
}