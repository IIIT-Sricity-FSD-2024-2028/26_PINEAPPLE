import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, ValidateIf } from 'class-validator';

export class UpdateAdminTicketDto {
  @ApiPropertyOptional({
    description: 'Updated ticket status',
    enum: ['open', 'in_progress', 'in-progress', 'waiting_user', 'resolved', 'rejected'],
  })
  @IsOptional()
  @IsIn(['open', 'in_progress', 'in-progress', 'waiting_user', 'resolved', 'rejected'])
  status?: 'open' | 'in_progress' | 'in-progress' | 'waiting_user' | 'resolved' | 'rejected';

  @ApiPropertyOptional({ description: 'Updated ticket priority', enum: ['low', 'normal', 'high'] })
  @IsOptional()
  @IsIn(['low', 'normal', 'high'])
  priority?: 'low' | 'normal' | 'high';

  @ApiPropertyOptional({ description: 'Assigned admin ID (or null/empty to unassign)' })
  @IsOptional()
  @ValidateIf((_obj, value) => value !== null)
  @IsString()
  assigneeId?: string | null;

  @ApiPropertyOptional({ description: 'Mandatory user-visible note when resolving or rejecting (10-500 chars)' })
  @IsOptional()
  @IsString()
  note?: string;
}
