import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type EscrowStatus = 'funded' | 'released' | 'refunded' | 'disputed';

export class EscrowAccountEntity {
  @ApiProperty() id!: string;
  @ApiProperty({ description: 'What funded this escrow, e.g. "hackathon"' }) sourceType!: string;
  @ApiProperty({ description: 'ID of the hackathon (or other) row this escrow backs' }) sourceId!: string;
  @ApiProperty() heldAmount!: number;
  @ApiProperty({ default: 'INR' }) currency!: string;
  @ApiProperty({ enum: ['funded', 'released', 'refunded', 'disputed'] }) status!: EscrowStatus;
  @ApiProperty() fundedAt!: string;
  @ApiProperty({ description: 'What must happen before funds move' }) releaseCondition!: string;
  @ApiPropertyOptional() releasedAt?: string;
}
