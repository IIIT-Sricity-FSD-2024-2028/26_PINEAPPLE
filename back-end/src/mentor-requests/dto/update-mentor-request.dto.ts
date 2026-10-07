import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateMentorRequestDto } from './create-mentor-request.dto';
import { IsIn, IsOptional } from 'class-validator';

export class UpdateMentorRequestDto extends PartialType(CreateMentorRequestDto) {
  @ApiPropertyOptional({ description: 'Mentor request status', enum: ['pending', 'accepted', 'declined', 'Pending', 'Accepted', 'Declined', 'rejected', 'Rejected'], example: 'accepted' })
  @IsOptional()
  @IsIn(['pending', 'accepted', 'declined', 'Pending', 'Accepted', 'Declined', 'rejected', 'Rejected'])
  status?: string;
}
