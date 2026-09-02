import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TransactionEntity {
  @ApiProperty() id!: string;
  @ApiProperty() payerId!: string;
  @ApiPropertyOptional() payeeId?: string;
  @ApiProperty() amount!: number;
  @ApiProperty({ default: 'INR' }) currency!: string;
  @ApiProperty({ enum: ['mentor_session_payout', 'refund'] }) type!: string;
  @ApiProperty({ enum: ['completed'] }) status!: string;
  @ApiProperty() createdAt!: string;
}
