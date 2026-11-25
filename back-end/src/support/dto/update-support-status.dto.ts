import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import type { SupportRequestStatus } from '../entities/support-request.entity';

const statuses = ['open', 'in_progress', 'in-progress', 'waiting_user', 'resolved', 'rejected'] as const;

export class UpdateSupportStatusDto {
  @ApiProperty({ description: 'Updated support ticket status', enum: statuses })
  @IsString()
  @IsIn(statuses)
  status!: SupportRequestStatus;

  @ApiPropertyOptional({ description: 'Note visible to user when resolving/rejecting (10-500 chars)' })
  @IsOptional()
  @IsString()
  note?: string;
}
