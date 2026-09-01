import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum EscrowState {
  Created = 'Created',
  PaymentPending = 'PaymentPending',
  Funded = 'Funded',
  Locked = 'Locked',
  Disputed = 'Disputed',
  ReadyForDistribution = 'ReadyForDistribution',
  Distributed = 'Distributed',
  Refunded = 'Refunded'
}

export class EscrowAccountEntity {
  @ApiProperty() id!: string;
  @ApiPropertyOptional({ description: 'Hackathon ID (if hackathon escrow)' }) hackathonId?: string;
  @ApiPropertyOptional({ description: 'Mentor session ID (if mentor-marketplace escrow)' }) mentorSessionId?: string;
  @ApiProperty() prizeAmount!: number;
  @ApiProperty() platformFee!: number;
  @ApiProperty() gatewayFee!: number;
  @ApiProperty() totalFunded!: number;
  
  @ApiProperty({ enum: EscrowState }) status!: EscrowState;
  
  @ApiProperty() createdAt!: string;
  @ApiPropertyOptional() fundedAt?: string;
  @ApiPropertyOptional() distributedAt?: string;
}

