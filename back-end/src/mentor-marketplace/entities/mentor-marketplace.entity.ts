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
  @ApiProperty({ description: 'Session duration in minutes', enum: [30, 60, 90] }) sessionDuration!: number;
  @ApiPropertyOptional({ type: [String], description: 'Languages spoken' }) languages?: string[];
  @ApiProperty({ enum: ['Weekdays', 'Weekends', 'Anytime'] }) availability!: string;
  @ApiProperty({ description: 'Average rating 0–5' }) rating!: number;
  @ApiProperty({ description: 'Total completed sessions' }) totalSessions!: number;
  @ApiProperty({ description: 'Whether mentor is currently accepting bookings' }) isAvailable!: boolean;
  @ApiProperty() createdAt!: string;
}

export type MentorSessionStatus =
  | 'escrow_funded'
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'refunded';

// ── A booked mentoring session ───────────────────────────────────────────────
export class MentorSessionEntity {
  @ApiProperty() id!: string;
  @ApiProperty() mentorId!: string;
  @ApiProperty() studentId!: string;
  @ApiProperty({ description: 'What the student wants help with' }) projectDescription!: string;
  @ApiProperty({ description: 'Price agreed at booking time (INR)' }) agreedPrice!: number;
  @ApiProperty({ description: 'EscrowAccountEntity ID' }) escrowId!: string;
  @ApiProperty({ enum: ['escrow_funded', 'active', 'completed', 'cancelled', 'refunded'] })
  status!: MentorSessionStatus;
  @ApiProperty() createdAt!: string;
  @ApiPropertyOptional() startedAt?: string;
  @ApiPropertyOptional() completedAt?: string;
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
