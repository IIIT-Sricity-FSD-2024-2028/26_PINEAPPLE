import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PromotionStatus {
  Active = 'Active',
  Expired = 'Expired',
  Pending = 'Pending',
  Cancelled = 'Cancelled',
}

export class PromotionPlanEntity {
  @ApiProperty() id!: string;
  @ApiProperty({ description: 'Display name of the plan' }) name!: string;
  @ApiProperty({ description: 'Price in INR' }) price!: number;
  @ApiProperty({ description: 'Duration in days' }) duration!: number;
  @ApiProperty({ description: 'Array of feature descriptions' }) features!: string[];
  @ApiProperty({ enum: ['Standard', 'High', 'Maximum'] }) visibilityBoost!: string;
  @ApiProperty({ description: 'Estimated reach in student count' }) estimatedReach!: number;
  @ApiProperty() createdAt!: string;
}

export class HackathonPromotionEntity {
  @ApiProperty() id!: string;
  @ApiProperty({ description: 'Hackathon ID being promoted' }) hackathonId!: string;
  @ApiProperty({ description: 'PromotionPlan ID' }) planId!: string;
  @ApiProperty() purchasedBy!: string; // Organizer/host user ID
  @ApiProperty() purchasedAt!: string;
  @ApiProperty() startDate!: string;
  @ApiProperty() endDate!: string;
  @ApiProperty({ enum: PromotionStatus }) status!: PromotionStatus;
  @ApiProperty({ description: 'Amount paid' }) amountPaid!: number;
  @ApiProperty({ description: 'Views during promotion period' }) viewsDuringPromotion?: number;
  @ApiProperty({ description: 'Registrations during promotion period' }) registrationsDuringPromotion?: number;
}
