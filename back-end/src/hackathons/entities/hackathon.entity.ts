import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum HackathonState {
  Draft = 'Draft',
  Published = 'Published',
  RegistrationOpen = 'RegistrationOpen',
  Ongoing = 'Ongoing',
  SubmissionClosed = 'SubmissionClosed',
  Judging = 'Judging',
  ReadyToClose = 'ReadyToClose',
  Closed = 'Closed',
  Completed = 'Completed'
}

export class HackathonEntity {
  @ApiProperty() id!: string;
  @ApiProperty({ description: 'Hosting Organization ID / hostId' }) hostId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() description!: string;
  @ApiPropertyOptional({ description: 'Theme/tags for search, e.g. "AI, Fintech"' }) theme?: string;
  
  @ApiProperty({ description: 'Start and end dates/deadlines', type: 'object' })
  dates!: {
    registrationClose: string;
    start: string;
    submissionClose: string;
    end: string;
  };
  
  @ApiProperty({ description: 'Location (if offline/hybrid)' }) location?: string;
  @ApiProperty({ enum: ['Online', 'Offline', 'Hybrid'] }) mode!: 'Online' | 'Offline' | 'Hybrid';
  
  @ApiProperty({ description: 'Eligibility criteria' }) eligibility!: string;
  @ApiProperty({ description: 'Rules of the hackathon' }) rules!: string;
  
  @ApiProperty({ type: 'object' })
  teamSizeLimits!: { min: number; max: number };
  
  @ApiProperty({ type: 'object' })
  prizes!: { totalPool: number; distribution: { rank: number; amount: number }[] };
  
  @ApiProperty({ description: 'Judging criteria and weights', type: 'object' })
  judgingCriteria!: Record<string, number>;
  
  @ApiProperty({ enum: HackathonState }) status!: HackathonState;
  
  @ApiProperty({ description: 'ESCROW_ACCOUNT ID holding the prize pool' }) escrowId!: string;
  @ApiProperty({ description: 'Premium feature flag' }) subjectMatterGuidesEnabled!: boolean;
  
  @ApiProperty({ description: 'Admin user ID who created this' }) createdBy!: string;
  @ApiProperty() createdAt!: string;
  @ApiPropertyOptional({ type: [String], description: 'Top 3 team IDs once closed' }) winningTeamIds?: string[];
  @ApiPropertyOptional() closedAt?: string;

  // ── Display / promotion fields (used by frontend card renderer) ──
  @ApiPropertyOptional({ description: 'Emoji logo for the card' }) logo?: string;
  @ApiPropertyOptional({ description: 'Organizer display name' }) organizer?: string;
  @ApiPropertyOptional({ description: 'Is this hackathon sponsored?' }) sponsored?: boolean;
  @ApiPropertyOptional({ description: 'Featured on homepage?' }) featured?: boolean;
  @ApiPropertyOptional({ description: 'Active promotion plan name' }) promotionPlan?: string;
  @ApiPropertyOptional({ description: 'View counter' }) views?: number;
  @ApiPropertyOptional({ description: 'Registration count' }) registrations?: number;
  @ApiPropertyOptional({ description: 'Team matches facilitated' }) teamMatches?: number;
  @ApiPropertyOptional({ type: [String], description: 'Tech stack tags' }) technologies?: string[];
  @ApiPropertyOptional({ description: 'Friendly reg deadline string YYYY-MM-DD' }) regDeadline?: string;
  @ApiPropertyOptional({ description: 'Friendly event date range string' }) eventDates?: string;
  @ApiPropertyOptional({ description: 'Friendly team size range e.g. "2–4"' }) teamSize?: string;
  @ApiPropertyOptional({ description: 'Shorthand prize pool (mirrors prizes.totalPool)' }) prizePool?: number;
}

