import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ── Mentor's public listing ─────────────────────────────────────────────────
export class MentorProfileEntity {
  @ApiProperty() id!: string;
  @ApiProperty({ description: 'User ID of the verified mentor' }) userId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ description: 'Emoji avatar' }) avatar!: string;
  @ApiProperty({ description: 'Professional title, e.g. "Senior Full-Stack Engineer, 6 yrs"' }) title!: string;
  @ApiProperty() bio!: string;
  @ApiProperty({ type: [String] }) skills!: string[];
  @ApiProperty({ description: 'Years of professional experience' }) experienceYears!: number;
  @ApiProperty({ description: 'Session price in INR' }) sessionPrice!: number;
  @ApiPropertyOptional({ type: [String], description: 'Languages spoken' }) languages?: string[];
  @ApiPropertyOptional({ description: 'Average rating 0–5' }) rating?: number;
  @ApiPropertyOptional({ description: 'Total completed sessions' }) totalSessions?: number;
  @ApiProperty({ description: 'Whether mentor is currently accepting bookings' }) isAvailable!: boolean;
  @ApiPropertyOptional({ description: 'Maximum active mentees (1 to 10, default 3)' }) maxActiveMentees?: number;
  @ApiPropertyOptional({ description: 'Current number of active mentees' }) activeMenteesCount?: number;
  @ApiPropertyOptional({ description: 'Whether mentor has reached active mentee cap' }) isFull?: boolean;
  @ApiPropertyOptional({ description: 'University or institution of mentor' }) university?: string;
  @ApiProperty() createdAt!: string;
}

export type MentorSessionStatus =
  | 'payment_pending'
  | 'escrow_funded'
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'refunded'
  | 'payout_pending'
  | 'disputed'
  | 'split'
  | 'needs_review';

// ── A booked mentoring session ───────────────────────────────────────────────
export class MentorSessionEntity {
  @ApiProperty() id!: string;
  @ApiProperty() mentorId!: string;
  @ApiProperty() studentId!: string;
  @ApiProperty({ description: 'ID of the project owner\'s project this session is for' }) projectId!: string;
  @ApiProperty({ description: 'What the student wants help with' }) projectDescription!: string;
  @ApiProperty({ description: 'Price agreed at booking time (INR)' }) agreedPrice!: number;
  @ApiPropertyOptional({ description: 'Total funded amount (session fee + platform 15% + gateway 2%)' }) totalAmount?: number;
  @ApiProperty({ description: 'EscrowAccountEntity ID' }) escrowId!: string;
  @ApiProperty({ enum: ['payment_pending', 'escrow_funded', 'active', 'completed', 'cancelled', 'refunded', 'payout_pending', 'disputed', 'split', 'needs_review'] })
  status!: MentorSessionStatus;
  @ApiPropertyOptional({ description: 'Session status prior to dispute freeze' })
  preDisputeStatus?: MentorSessionStatus;
  @ApiPropertyOptional({ description: 'Session status prior to integrity needs_review flag' })
  preReviewStatus?: MentorSessionStatus;
  @ApiPropertyOptional({ description: 'Reason the session was flagged needs_review by integrity check' })
  needsReviewReason?: string;
  @ApiPropertyOptional({ description: 'Timestamp when session was flagged needs_review' })
  needsReviewFlaggedAt?: string;
  @ApiPropertyOptional({ description: 'Admin ID who cleared the needs_review flag' })
  reviewClearedBy?: string;
  @ApiPropertyOptional({ description: 'Timestamp when needs_review flag was cleared' })
  reviewClearedAt?: string;
  @ApiPropertyOptional({ description: 'Reason given when clearing needs_review flag' })
  reviewClearedReason?: string;
  @ApiPropertyOptional({ description: 'Refund amount credited back to owner (used by refunds and split decisions)' })
  refundAmount?: number;
  @ApiPropertyOptional({ description: 'Whether an open dispute freezes this session escrow' })
  disputed?: boolean;
  @ApiPropertyOptional({ description: 'Timestamp when session ended (if applicable)' })
  endedAt?: string;
  @ApiPropertyOptional() platformFee?: number;
  @ApiPropertyOptional() gatewayFee?: number;
  @ApiPropertyOptional() payout?: number;
  @ApiPropertyOptional() paymentIntentId?: string;
  @ApiPropertyOptional() paymentExpiresAt?: string;
  @ApiPropertyOptional() upiUri?: string;
  @ApiPropertyOptional() payeeVpa?: string;
  @ApiPropertyOptional() ownerName?: string;
  @ApiPropertyOptional() projectName?: string;
  @ApiPropertyOptional({ description: 'Due date of the associated project' }) projectDueDate?: string;
  @ApiProperty() createdAt!: string;
  @ApiPropertyOptional({ description: 'Deadline for mentor to accept/decline (creation + 3 days)' })
  respondBy?: string;
  @ApiPropertyOptional({ description: 'Written reason for declining the session' })
  declineReason?: string;
  @ApiPropertyOptional({ description: 'Who declined the session', enum: ['mentor', 'system'] })
  declinedBy?: 'mentor' | 'system';
  @ApiPropertyOptional({ description: 'Timestamp when session was refunded (if applicable)' })
  refundedAt?: string;
  @ApiPropertyOptional() startedAt?: string;
  @ApiPropertyOptional() completedAt?: string;
  @ApiPropertyOptional({ description: 'Notes recorded during the mentorship session' })
  notes?: Array<{ id: string; authorId: string; note: string; createdAt: string }>;
  @ApiPropertyOptional({ description: 'Whether owner has submitted post-session feedback' })
  hasFeedback?: boolean;
}

// ── Post-session review by student ─────────────────────────────────────────
export class MentorReviewEntity {
  @ApiProperty() id!: string;
  @ApiProperty() sessionId!: string;
  @ApiProperty() mentorId!: string;
  @ApiProperty() studentId!: string;
  @ApiProperty({ minimum: 1, maximum: 5 }) rating!: number;
  @ApiPropertyOptional() comment?: string;
  @ApiProperty() createdAt!: string;
}

export interface MentorProjectActivityRecord {
  projectId: string;
  mentorId: string;
  assignedAt: string;
  lastActivityAt?: string;
  lastActivityType?: string;
  firstWeekNoticeSentAt?: string;
  inactivity7dNotifiedAt?: string;
}

export type AbandonmentReviewStatus = 'open' | 'confirmed' | 'released' | 'cancelled';

export interface AbandonmentReviewEntity {
  id: string;
  projectId: string;
  mentorId: string;
  mentorProfileId?: string;
  openedBy: string;
  status: AbandonmentReviewStatus;
  openedAt: string;
  deadlineAt: string;
  decidedAt?: string;
  cancelledBy?: string;
  reason?: string;
}

export interface SessionFeedbackEntity {
  id: string;
  sessionId: string;
  mentorId: string;
  mentorUserId: string;
  projectId: string;
  studentId: string;
  rating: number;
  comment?: string;
  createdAt: string;
}

export interface MentorAbandonmentIncident {
  id: string;
  reviewId: string;
  projectId: string;
  projectTitle?: string;
  mentorId: string;
  mentorUserId: string;
  releasedAt: string;
  reason: string;
  refundedSessionsCount: number;
}

export class MentoredProjectItem {
  @ApiProperty() projectId!: string;
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional() desc?: string;
  @ApiProperty() ownerName!: string;
  @ApiProperty() status!: string;
  @ApiPropertyOptional() closedReason?: string;
  @ApiPropertyOptional() dueDate?: string;
  @ApiPropertyOptional() acceptedAt?: string;
  @ApiPropertyOptional() completedAt?: string;
  @ApiPropertyOptional() finalLink?: string | null;
  @ApiPropertyOptional() mentorUserId?: string;
  @ApiProperty() sessionStatus!: string;
  @ApiProperty() amount!: number;
  @ApiPropertyOptional() progress?: number;
  @ApiPropertyOptional({ type: [String] }) skills?: string[];
  @ApiProperty({ enum: ['active', 'completed'] }) tab!: 'active' | 'completed';
}

export class MentoredProjectsCounts {
  @ApiProperty() all!: number;
  @ApiProperty() active!: number;
  @ApiProperty() completed!: number;
}

export class MentoredProjectsResponse {
  @ApiProperty({ type: [MentoredProjectItem] }) items!: MentoredProjectItem[];
  @ApiProperty({ type: MentoredProjectsCounts }) counts!: MentoredProjectsCounts;
}

export type DisputeStatus = 'open' | 'decided';
export type DisputeDecision = 'release_to_mentor' | 'refund_to_owner' | 'split';

export interface SessionDisputeEntity {
  id: string;
  sessionId: string;
  projectId: string;
  projectTitle?: string;
  mentorId: string;
  mentorUserId: string;
  mentorName?: string;
  studentId: string;
  studentName?: string;
  openedBy: string;
  openedByRole: 'owner' | 'mentor' | 'admin';
  reason: string;
  status: DisputeStatus;
  preDisputeStatus?: MentorSessionStatus;
  decision?: DisputeDecision;
  mentorPercent?: number;
  mentorAmount?: number;
  platformFee?: number;
  gatewayFee?: number;
  ownerRefundAmount?: number;
  decidedBy?: string;
  decisionReason?: string;
  openedAt: string;
  decidedAt?: string;
  superUserNotifiedAt?: string;
}
