import { PartialType } from '@nestjs/swagger';
import { CreateJoinRequestDto } from './create-join-request.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsIn } from 'class-validator';

export class UpdateJoinRequestDto extends PartialType(CreateJoinRequestDto) {
  @ApiPropertyOptional({ description: 'Request status', enum: ['pending', 'approved', 'rejected'] })
  @IsOptional()
  @IsIn(['pending', 'approved', 'rejected'])
  status?: 'pending' | 'approved' | 'rejected';
}