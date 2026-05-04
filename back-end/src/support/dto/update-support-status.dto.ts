import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString } from 'class-validator';

const statuses = ['open', 'in-progress', 'resolved'] as const;

type SupportStatus = (typeof statuses)[number];

export class UpdateSupportStatusDto {
  @ApiProperty({ description: 'Updated support ticket status', enum: statuses })
  @IsString()
  @IsEnum(statuses)
  status!: SupportStatus;
}
