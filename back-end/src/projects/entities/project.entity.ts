import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProjectMember {
  @ApiProperty({ description: 'Member name' })
  name!: string;

  @ApiProperty({ description: 'Member initials' })
  initials!: string;

  @ApiProperty({ description: 'Member role in the project', enum: ['Owner', 'Developer', 'Designer', 'QA', 'Contributor', 'Mentor'] })
  role!: 'Owner' | 'Developer' | 'Designer' | 'QA' | 'Contributor' | 'Mentor' | string;
}

export class ProjectTask {
  @ApiProperty({ description: 'Task ID' })
  id!: string;

  @ApiProperty({ description: 'Task title' })
  title!: string;

  @ApiPropertyOptional({ description: 'Task description' })
  description?: string;

  @ApiProperty({ description: 'Assigned user' })
  assignedTo!: string;

  @ApiProperty({ description: 'Task status', enum: ['pending', 'in-progress', 'submitted', 'approved'] })
  status!: 'pending' | 'in-progress' | 'submitted' | 'approved';

  @ApiPropertyOptional({ description: 'Proof link' })
  proofLink?: string;

  @ApiPropertyOptional({ description: 'Due date' })
  due?: string;

  @ApiProperty({ description: 'Priority', enum: ['Low', 'Medium', 'High'] })
  priority!: 'Low' | 'Medium' | 'High';
}

export class JoinRequest {
  @ApiProperty({ description: 'Request ID' })
  id!: string;

  @ApiProperty({ description: 'User ID making the request' })
  userId!: string;

  @ApiProperty({ description: 'User name' })
  userName!: string;

  @ApiProperty({ description: 'Request status', enum: ['pending', 'approved', 'rejected'] })
  status!: 'pending' | 'approved' | 'rejected';

  @ApiProperty({ description: 'Request message' })
  message!: string;

  @ApiProperty({ description: 'Request timestamp' })
  createdAt!: Date;
}

export class ProjectEntity {
  @ApiProperty({ description: 'Unique identifier for the project' })
  id!: string;

  @ApiProperty({ description: 'Project name' })
  name!: string;

  @ApiProperty({ description: 'Project description' })
  desc!: string;

  @ApiProperty({ description: 'Required skills', type: [String] })
  skills!: string[];

  @ApiProperty({ description: 'Project progress percentage', minimum: 0, maximum: 100 })
  progress!: number;

  @ApiProperty({ description: 'Number of collaborators' })
  collaborators!: number;

  @ApiPropertyOptional({ description: 'Target team size' })
  teamSize?: number;

  @ApiProperty({ description: 'Project owner (user name or email)' })
  owner!: string;

  @ApiProperty({ description: 'Project members', type: [ProjectMember] })
  members!: ProjectMember[];

  @ApiProperty({ description: 'Project status', enum: ['open', 'in-progress', 'completed', 'cancelled', 'closed', 'Closed'] })
  status!: 'open' | 'in-progress' | 'completed' | 'cancelled' | 'closed' | string;

  @ApiPropertyOptional({ description: 'Reason why the project was closed' })
  closureReason?: string;

  @ApiPropertyOptional({ description: 'Timestamp when project was closed' })
  closedAt?: Date | string;

  @ApiPropertyOptional({ description: 'Soft-delete UTC timestamp' })
  deletedAt?: string;

  @ApiPropertyOptional({ description: 'User ID who soft-deleted the project' })
  deletedBy?: string;

  @ApiPropertyOptional({ description: 'Timestamp when admin restored the soft-deleted project' })
  restoredAt?: string;

  @ApiPropertyOptional({ description: 'Admin ID who restored the project' })
  restoredBy?: string;

  @ApiPropertyOptional({ description: 'Timestamp when deletion is scheduled to execute' })
  deletionScheduledAt?: string;

  @ApiPropertyOptional({ description: 'User ID who requested deletion' })
  deletionRequestedBy?: string;

  @ApiPropertyOptional({ description: 'Previous project status prior to deletion schedule' })
  previousStatus?: string;

  @ApiPropertyOptional({ description: 'Timestamp when day 4 inactivity reminder was sent' })
  day4ReminderSentAt?: Date | string;

  @ApiPropertyOptional({ description: 'Timestamp when pending join requests reminder was sent' })
  pendingReviewReminderSentAt?: Date | string;

  @ApiPropertyOptional({ description: 'Timestamp when Day 5 auto-close was paused due to pending requests' })
  pausedAt?: Date | string;

  @ApiPropertyOptional({ description: 'Expiration timestamp (pausedAt + 48h) of Day 5 pause' })
  pendingReviewGraceExpiresAt?: Date | string;

  @ApiPropertyOptional({ description: 'Timestamp of last owner write/action on the project' })
  lastOwnerActionAt?: Date | string;

  @ApiPropertyOptional({ description: 'Timestamp when 14-day owner inactivity notice was sent' })
  ownerInactive14dNotifiedAt?: Date | string;

  @ApiPropertyOptional({ description: 'Flag indicating owner has been inactive 30+ days' })
  ownerInactive30d?: boolean;

  @ApiPropertyOptional({ description: 'Timestamp when 30-day inactivity flag was set' })
  ownerInactive30dFlaggedAt?: Date | string;

  @ApiPropertyOptional({ description: 'Timestamp when collaborator requested admin closure' })
  closeRequestedAt?: Date | string;

  @ApiPropertyOptional({ description: 'Support ticket ID created for close request' })
  closeRequestTicketId?: string;

  @ApiProperty({ description: 'Whether the project is completed/locked', default: false })
  isCompleted!: boolean;

  @ApiPropertyOptional({ description: 'Completion timestamp' })
  completedAt?: Date | string;

  @ApiPropertyOptional({ description: 'Final published project link' })
  finalLink?: string;

  @ApiPropertyOptional({ description: 'Alias for final published project link' })
  finishedLink?: string;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt!: Date;

  @ApiProperty({ description: 'Whether created via API', default: true })
  isUserCreated!: boolean;

  @ApiProperty({ description: 'Project tasks', type: [ProjectTask] })
  tasks!: ProjectTask[];

  @ApiProperty({ description: 'Pending join requests', type: [JoinRequest] })
  requests!: JoinRequest[];

  @ApiPropertyOptional({ description: 'Users removed by owner with stored reason' })
  removedUsers?: any[];

  @ApiPropertyOptional({ description: 'History of project deadline changes' })
  deadlineHistory?: any[];
}