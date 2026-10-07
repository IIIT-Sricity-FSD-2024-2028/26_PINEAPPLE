import { PartialType } from '@nestjs/swagger';
import { CreateJoinRequestDto } from './create-join-request.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsIn } from 'class-validator';

export class UpdateJoinRequestDto extends PartialType(CreateJoinRequestDto) {
  @ApiPropertyOptional({ description: 'Request status', enum: ['pending', 'approved', 'rejected', 'Pending', 'Approved', 'Rejected'] })
  @IsOptional()
  @IsIn(['pending', 'approved', 'rejected', 'Pending', 'Approved', 'Rejected'])
  status?: 'pending' | 'approved' | 'rejected' | 'Pending' | 'Approved' | 'Rejected';
}