import { PartialType } from '@nestjs/swagger';
import { CreateJoinRequestDto } from './create-join-request.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsIn, IsString } from 'class-validator';

export class UpdateJoinRequestDto extends PartialType(CreateJoinRequestDto) {
  @ApiPropertyOptional({
    description: 'Request status',
    enum: ['pending', 'approved', 'rejected', 'withdrawn', 'system_closed', 'Pending', 'Approved', 'Rejected'],
  })
  @IsOptional()
  @IsIn(['pending', 'approved', 'rejected', 'withdrawn', 'system_closed', 'Pending', 'Approved', 'Rejected'])
  status?: 'pending' | 'approved' | 'rejected' | 'withdrawn' | 'system_closed' | 'Pending' | 'Approved' | 'Rejected';

  @ApiPropertyOptional({ description: 'Rejection reason (10 to 500 characters)' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ description: 'Rejection reason alias' })
  @IsOptional()
  @IsString()
  rejectionReason?: string;

  @ApiPropertyOptional({ description: 'Feedback payload with structured reasons and optional explanation' })
  @IsOptional()
  feedback?: {
    reasons: string[];
    explanation?: string;
  };

  @ApiPropertyOptional({ description: 'Array of reason IDs' })
  @IsOptional()
  reasons?: string[];

  @ApiPropertyOptional({ description: 'Explanation string' })
  @IsOptional()
  @IsString()
  explanation?: string;
}
