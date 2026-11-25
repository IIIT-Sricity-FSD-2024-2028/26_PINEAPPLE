import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type SupportTicketType = 'help' | 'project_closure';

export type SupportRequestCategory =
  | 'Bug Report'
  | 'Feature Request'
  | 'Account Issue'
  | 'Project Closure Request'
  | 'Help Inquiry'
  | 'Other';

export type SupportTicketPriority = 'low' | 'normal' | 'high';

export type SupportTicketCanonicalStatus =
  | 'open'
  | 'in_progress'
  | 'waiting_user'
  | 'resolved'
  | 'rejected';

export type SupportRequestStatus = SupportTicketCanonicalStatus | 'in-progress';

export const ALLOWED_STATUS_TRANSITIONS: Record<
  SupportTicketCanonicalStatus,
  SupportTicketCanonicalStatus[]
> = {
  open: ['in_progress', 'waiting_user', 'resolved', 'rejected'],
  in_progress: ['waiting_user', 'resolved', 'rejected'],
  waiting_user: ['in_progress', 'resolved', 'rejected'],
  resolved: [],
  rejected: [],
};

export function normalizeTicketStatus(status?: string): SupportTicketCanonicalStatus {
  const raw = String(status || 'open').trim().toLowerCase();
  if (raw === 'in-progress' || raw === 'in_progress') return 'in_progress';
  if (raw === 'waiting_user') return 'waiting_user';
  if (raw === 'resolved') return 'resolved';
  if (raw === 'rejected') return 'rejected';
  return 'open';
}

export interface SupportReplyEntity {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: 'user' | 'admin';
  body: string;
  internal: boolean;
  createdAt: string;
}

export interface SupportProjectFacts {
  projectId: string;
  projectTitle: string;
  projectStatus: string;
  isDeleted: boolean;
  ownerId: string;
  ownerName?: string;
  ownerLastActiveAt: string | null;
  membersLastActiveAt: string | null;
  openTasksCount: number;
  totalTasksCount: number;
  escrowHeldAmount: number;
  pendingRequestsCount: number;
}

export class SupportRequestEntity {
  @ApiProperty({ description: 'Unique support ticket identifier' })
  id!: string;

  @ApiProperty({ description: 'Ticket type', enum: ['help', 'project_closure'] })
  type!: SupportTicketType;

  @ApiProperty({ description: 'User ID (or visitor identifier) that submitted the request' })
  userId!: string;

  @ApiPropertyOptional({ description: 'Requester display name' })
  userName?: string;

  @ApiProperty({ description: 'Email address of the requester' })
  from!: string;

  @ApiProperty({
    description: 'Support request category',
    enum: ['Bug Report', 'Feature Request', 'Account Issue', 'Project Closure Request', 'Help Inquiry', 'Other'],
  })
  category!: SupportRequestCategory | string;

  @ApiProperty({ description: 'Subject line for the support request (5-120 chars)' })
  subject!: string;

  @ApiProperty({ description: 'Detailed support request message (10-2000 chars)' })
  message!: string;

  @ApiProperty({ description: 'Ticket priority', enum: ['low', 'normal', 'high'] })
  priority!: SupportTicketPriority;

  @ApiPropertyOptional({ description: 'Optional associated project ID' })
  projectId?: string;

  @ApiPropertyOptional({ description: 'Optional metadata for the case' })
  metadata?: Record<string, any>;

  @ApiProperty({
    description: 'Current ticket status',
    enum: ['open', 'in_progress', 'waiting_user', 'resolved', 'rejected'],
  })
  status!: SupportRequestStatus;

  @ApiPropertyOptional({ description: 'Assigned admin ID (or null if unassigned)' })
  assigneeId?: string | null;

  @ApiPropertyOptional({ description: 'Assigned admin display name' })
  assigneeName?: string | null;

  @ApiPropertyOptional({ description: 'Resolution/rejection note visible to requester (10-500 chars)' })
  resolutionNote?: string;

  @ApiPropertyOptional({ description: 'Timestamp when ticket moved to resolved/rejected' })
  resolvedAt?: string;

  @ApiPropertyOptional({ description: 'Reference to parent resolved/rejected ticket if follow-up' })
  parentTicketId?: string;

  @ApiPropertyOptional({ description: 'Last timestamp when an admin acted on this ticket' })
  lastAdminActionAt?: string;

  @ApiPropertyOptional({ description: 'Timestamp when 7-day untouched Super User reminder was sent' })
  untouchedReminderSentAt?: string;

  @ApiProperty({ description: 'Reply thread entries (internal notes filtered for end users)' })
  replies!: SupportReplyEntity[];

  @ApiProperty({ description: 'Ticket creation timestamp in ISO format' })
  createdAt!: string;

  @ApiPropertyOptional({ description: 'Last update timestamp in ISO format' })
  updatedAt?: string;

  @ApiPropertyOptional({ description: 'Live project facts populated for project_closure tickets in admin views' })
  projectFacts?: SupportProjectFacts | null;
}
