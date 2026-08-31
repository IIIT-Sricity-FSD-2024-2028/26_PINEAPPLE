import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type HackathonStatus = 'open_for_registration' | 'ongoing' | 'judging' | 'closed' | 'cancelled';

export class HackathonEntity {
  @ApiProperty() id!: string;
  @ApiProperty({ description: 'Hosting Organization ID' }) orgId!: string;
  @ApiProperty() title!: string;
  @ApiProperty() description!: string;
  @ApiPropertyOptional({ description: 'Theme/tags for search, e.g. "AI, Fintech"' }) theme?: string;
  @ApiProperty({ description: 'Free-text eligibility criteria, e.g. "Open to all UG/PG students"' })
  eligibilityCriteria!: string;
  @ApiProperty() teamSizeMin!: number;
  @ApiProperty() teamSizeMax!: number;
  @ApiProperty() prizePool!: number;
  @ApiProperty({ description: 'Prize split percentages for 1st/2nd/3rd, must sum to 100', type: [Number] })
  prizeSplit!: number[];
  @ApiProperty({ description: 'ISO date-time — registration closes after this' }) registrationDeadline!: string;
  @ApiProperty({ enum: ['open_for_registration', 'ongoing', 'judging', 'closed', 'cancelled'] })
  status!: HackathonStatus;
  @ApiProperty({ description: 'ESCROW_ACCOUNT ID holding the prize pool' }) escrowId!: string;
  @ApiProperty({ description: 'Org Admin user ID who created this hackathon' }) createdBy!: string;
  @ApiProperty() createdAt!: string;
  @ApiPropertyOptional({ type: [String], description: 'Top 3 team IDs once closed' }) winningTeamIds?: string[];
  @ApiPropertyOptional() closedAt?: string;
}
